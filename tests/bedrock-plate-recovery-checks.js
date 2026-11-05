// SPDX-License-Identifier: GPL-3.0-only
// Isolated legacy-upgrade / native collision / same-world restart observer.
// Seed with0.1.14, then run unchanged with the new source in the same QA world.
import {world,system,GameMode} from '@minecraft/server';
import * as gameTest from '@minecraft/server-gametest';
import {getQaHooks} from './main.js';
import {getRestaurant,saveRestaurant} from './store.js';
const KEY='ordertocook:qa_native_plate',BLOCK='ordertocook:dining_plate_block',ACTOR='ordertocook:dining_plate';
const wait=ticks=>new Promise(resolve=>system.runTimeout(resolve,ticks));
let running=false;
system.afterEvents.scriptEventReceive.subscribe(event=>{
 if(event.id!=='ordertocook:qa_native_plate'||running)return;running=true;
 run().catch(error=>console.error('OTC_NATIVE_PLATE_FATAL '+String(error)+' '+error?.stack));
});
async function run(){
 const dimension=world.getDimension('overworld'),hooks=getQaHooks(),checks=[],heights={};
 const check=(name,ok)=>{checks.push({name,passed:!!ok});console.warn('OTC_NATIVE_PLATE_CHECK '+JSON.stringify(checks.at(-1)));if(!ok)throw Error(name);};
 const raw=world.getDynamicProperty(KEY),saved=raw?JSON.parse(raw):undefined;
 const phase=!saved?'seed':saved.phase==='seed'?'migrate':'restart';
 let player,completed=false;const probes=[];
 const at=row=>({x:Math.floor(row.location.x),y:Math.floor(row.location.y),z:Math.floor(row.location.z)});
 const stage=block=>Number(block.permutation.getState('ordertocook:stage'))+16*Number(block.permutation.getState('ordertocook:stage_high'));
 const dirty=()=>dimension.getEntities({type:'minecraft:item',location:{x:4,y:6,z:1},maxDistance:16}).reduce((sum,entity)=>{
  const item=entity.getComponent('minecraft:item')?.itemStack;return sum+(item?.typeId==='ordertocook:dirty_plate'?item.amount:0);
 },0);
 try{
  check('production entry initialized',hooks.ready);
  if(phase==='seed'){
   dimension.runCommand('fill -3 4 -3 16 4 4 stone');dimension.runCommand('fill -3 5 -3 16 9 4 air');
   const machine=dimension.getBlock({x:14,y:5,z:0});machine.setType('ordertocook:order_machine');
   player=gameTest.spawnSimulatedPlayer({dimension,x:12.5,y:5,z:2.5},'NativePlateProbe',GameMode.Survival);
   player.setDynamicProperty('ordertocook:welcomed',true);
   const restaurant=hooks.getMachine(player,machine),rows=[];
   for(let i=0;i<3;i++){
    const x=i*4,now=Date.now(),order={id:'legacy-native-'+i,restaurantId:restaurant.id,type:'dine_in',status:'completed',items:[],
     expiresAt:now+600000,platedVariant:[2,5,9][i],meal:{startedAt:now-6000,finishAt:now-500,action:6,boomBonus:0}};
    dimension.getBlock({x,y:5,z:1}).setType('minecraft:stone');restaurant.orders.push(order);
    const customer=dimension.spawnEntity('ordertocook:customer',{x:x+.5,y:5.5625,z:.5});customer.setRotation({x:0,y:0});
    const meal=hooks.dining.queueMeal(restaurant,order,customer,now);meal.extra={marker:'preserve-'+i};customer.remove();
    hooks.dining.tick(now);rows.push({id:meal.id,token:meal.token,location:meal.location,variant:meal.variant,extra:meal.extra});
   }
   saveRestaurant(restaurant);
   check('old source created three persistent helper-backed meals',restaurant.pendingDishes.length===3&&dimension.getEntities({type:ACTOR}).length===3);
   check('old source has no native dining blocks',rows.every(row=>dimension.getBlock(at(row)).isAir));
   world.setDynamicProperty(KEY,JSON.stringify({phase:'seed',restaurant:restaurant.id,owner:restaurant.ownerId,rows}));completed=true;
  }else{
   const restaurant=getRestaurant(saved.restaurant);
   check('original restaurant and owner restored',!!restaurant&&restaurant.ownerId===saved.owner);
   hooks.dining.tick();
   const retained=saved.rows[2],remaining=restaurant.pendingDishes.find(row=>row.id===retained.id);
   if(phase==='migrate'){
    check('three legacy meals retain tokens and unrelated data',saved.rows.every(old=>{
     const meal=restaurant.pendingDishes.find(row=>row.id===old.id);return meal?.token===old.token&&JSON.stringify(meal.extra)===JSON.stringify(old.extra);
    }));
    check('legacy meals now own native blocks and original stage models',saved.rows.every(row=>{
     const block=dimension.getBlock(at(row));return block.typeId===BLOCK&&stage(block)===row.variant*4+4;
    }));
    check('steady legacy display actors retired without item drops',dimension.getEntities({type:ACTOR}).length===0&&dirty()===0);
    const pos=at(saved.rows[0]);
    for(const [name,offset] of [['center',.5],['rim',.09],['outside',.025]]){
     probes.push({name,entity:dimension.spawnEntity('otc_qa:collision_probe',{x:pos.x+offset,y:pos.y+1,z:pos.z+.5})});
    }
    await wait(35);
    for(const {name,entity} of probes)heights[name]=entity.location.y;
    check('native center collider has original five-pixel height',Math.abs(heights.center-heights.outside-5/16)<.001);
    check('native rim collider has original two-pixel height',Math.abs(heights.rim-heights.outside-2/16)<.001);
    for(const row of probes)row.entity.remove();probes.length=0;
    player=gameTest.spawnSimulatedPlayer({dimension,x:2.5,y:5,z:1.5},'NativePlateProbe',GameMode.Creative);
    player.setDynamicProperty('ordertocook:welcomed',true);player.getComponent('minecraft:inventory').container.clearAll();
    player.lookAtLocation({x:pos.x+.5,y:pos.y+.2,z:pos.z+.5});await wait(3);
    check('native block ray selects the dining plate',player.getBlockFromViewDirection({maxDistance:6})?.block.typeId===BLOCK);
    player.interactWithBlock(pos);await wait(4);
    check('native block interaction collects exactly one plate',!restaurant.pendingDishes.some(row=>row.id===saved.rows[0].id)&&
      Array.from({length:player.getComponent('minecraft:inventory').container.size},(_,slot)=>player.getComponent('minecraft:inventory').container.getItem(slot)).filter(item=>item?.typeId==='ordertocook:dirty_plate').reduce((sum,item)=>sum+item.amount,0)===1);
    check('collected native block removed',dimension.getBlock(pos).isAir);
    player.stopInteracting();player.fly();player.teleport({x:12.5,y:8,z:2.5});
    const replaced=at(saved.rows[1]);dimension.runCommand(`setblock ${replaced.x} ${replaced.y} ${replaced.z} chest`);await wait(3);
    check('command replacement drops once and preserves the new player block',!restaurant.pendingDishes.some(row=>row.id===saved.rows[1].id)&&dirty()===1&&dimension.getBlock(replaced).typeId==='minecraft:chest');
    const now=Date.now(),order={id:'fresh-native-break',restaurantId:restaurant.id,type:'dine_in',status:'completed',items:[],expiresAt:now+600000,platedVariant:0,
     meal:{startedAt:now,finishAt:now+5500,action:6,boomBonus:0}};
    restaurant.orders.push(order);const customer=dimension.spawnEntity('ordertocook:customer',{x:4.5,y:5.5625,z:.5});customer.setRotation({x:0,y:0});
    const fresh=hooks.dining.queueMeal(restaurant,order,customer,now);customer.remove();saveRestaurant(restaurant);hooks.dining.tick(now);
    check('new placement retains the original animated actor',dimension.getEntities({type:ACTOR}).length===1);
    player.fly();player.teleport({x:fresh.location.x,y:fresh.location.y+3,z:fresh.location.z});player.stopInteracting();player.lookAtLocation({x:fresh.location.x,y:fresh.location.y+.15,z:fresh.location.z});
    player.breakBlock(at(fresh));await wait(8);player.stopBreakingBlock();
    check('native player block breaking drops one plate without pickup penalty',!restaurant.pendingDishes.some(row=>row.id===fresh.id)&&dirty()===2&&order.meal.action===6&&order.meal.startedAt===now);
    check('broken placement actor removed',dimension.getEntities({type:ACTOR}).length===0);
    player.getComponent('minecraft:inventory').container.clearAll();
    world.setDynamicProperty(KEY,JSON.stringify({...saved,phase:'migrated'}));completed=true;
   }else{
    check('unclaimed native block and legacy token survive restart',remaining?.token===retained.token&&JSON.stringify(remaining.extra)===JSON.stringify(retained.extra)&&dimension.getBlock(at(retained)).typeId===BLOCK);
    check('claimed meals and retired actors do not return',restaurant.pendingDishes.length===1&&dimension.getEntities({type:ACTOR}).length===0);
    check('physical drops survive without duplication',dirty()===(saved.expectedDrops??2));
    check('remaining native plate cleanup succeeds once',hooks.dining.cleanupRestaurant(restaurant)&&hooks.dining.cleanupRestaurant(restaurant)&&dirty()===(saved.expectedDrops??2)+1);
    check('native plate block removed after cleanup',dimension.getBlock(at(retained)).isAir);
    for(const item of dimension.getEntities({type:'minecraft:item',location:{x:4,y:6,z:1},maxDistance:16}))item.remove();
    world.setDynamicProperty(KEY,undefined);completed=true;
   }
  }
 }finally{
  for(const row of probes)try{row.entity.remove();}catch{}
  try{player?.disconnect();}catch{}await wait(3);
  if(completed){check('QA simulated Player disconnected',world.getAllPlayers().length===0);
   console.warn('OTC_NATIVE_PLATE_RESULT '+JSON.stringify({passed:true,phase,checks,heights,playersAfter:world.getAllPlayers().length,
    scope:'Actual old-source upgrade, two native collider heights, simulated-player block ray/use/break, command replacement and same-world restart. No client rendering or hardware-input verdict.'}));}
 }
}
