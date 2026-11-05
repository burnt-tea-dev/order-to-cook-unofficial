// SPDX-License-Identifier: GPL-3.0-only
// QA entry only: native simulated Player hits plus production dining/store.
// No client render or hardware-input verdict. GameTest is QA-only.
import {world,system,ItemStack,GameMode} from '@minecraft/server';
import * as gameTest from '@minecraft/server-gametest';
import {getQaHooks} from './main.js';
import {getRestaurant,saveRestaurant} from './store.js';
const KEY='ordertocook:qa_plate_recovery',DIRTY='ordertocook:dirty_plate';
const wait=ticks=>new Promise(resolve=>system.runTimeout(resolve,ticks));
let running=false;
system.afterEvents.scriptEventReceive.subscribe(event=>{
 if(event.id!=='ordertocook:qa_plate'||running)return;running=true;
 run().catch(error=>console.error('OTC_PLATE_FATAL '+String(error)+' '+error?.stack));
});
async function run(){
 const checks=[],dimension=world.getDimension('overworld'),hooks=getQaHooks();
 const check=(name,ok)=>{checks.push({name,passed:!!ok});console.warn('OTC_PLATE_CHECK '+JSON.stringify(checks.at(-1)));if(!ok)throw Error(name);};
 const drops=()=>dimension.getEntities({type:'minecraft:item',location:{x:.5,y:6,z:1.5},maxDistance:8})
  .map(entity=>({entity,stack:entity.getComponent('minecraft:item')?.itemStack})).filter(row=>row.stack?.typeId===DIRTY);
 const amount=()=>drops().reduce((sum,row)=>sum+row.stack.amount,0);
 const previous=world.getDynamicProperty(KEY);
 let player,customer,completed=false;
 const hits=[];
 const observeHit=event=>{if(event.damagingEntity.id===player?.id&&event.hitEntity.typeId==='ordertocook:dining_plate')hits.push(system.currentTick);};
 world.afterEvents.entityHitEntity.subscribe(observeHit);
 try{
  check('production entry initialized',hooks.ready);
  if(previous){
   const saved=JSON.parse(previous),restaurant=getRestaurant(saved.restaurant);
   check('same saved restaurant restored',!!restaurant);
   check('saved claimed meals do not return after restart',restaurant.pendingDishes.length===0);
   check('all three real dropped plates survive restart',amount()===3);
   hooks.dining.tick();await wait(10);
   check('reconciliation neither recreates actors nor duplicates plates',amount()===3&&dimension.getEntities({type:'ordertocook:dining_plate'}).length===0);
   check('saved physical drops stay plain and stackable',drops().every(row=>row.stack.getDynamicPropertyIds().length===0&&row.stack.isStackableWith(new ItemStack(DIRTY))));
   for(const row of drops())row.entity.remove();
   world.setDynamicProperty(KEY,undefined);completed=true;
  }else{
   dimension.runCommand('fill -3 4 -3 5 4 4 stone');dimension.runCommand('fill -3 5 -3 5 9 4 air');
   const machine=dimension.getBlock({x:4,y:5,z:0});machine.setType('ordertocook:order_machine');
   const chair=dimension.getBlock({x:0,y:5,z:0});chair.setType('ordertocook:chair');
   dimension.getBlock({x:0,y:5,z:1}).setType('minecraft:stone');
   await wait(3);
   player=gameTest.spawnSimulatedPlayer({dimension,x:3.5,y:5,z:1.5},'PlateRecovery',GameMode.Survival);
   player.setDynamicProperty('ordertocook:welcomed',true);
   const inventory=player.getComponent('minecraft:inventory').container;
   const restaurant=hooks.getMachine(player,machine);
   let index=0;
   function meal(){
    const now=Date.now(),order={id:'native-plate-'+(++index),restaurantId:restaurant.id,type:'dine_in',status:'completed',
     expiresAt:now+600000,items:[],platedVariant:0,meal:{startedAt:now-6000,finishAt:now-500,action:6,boomBonus:0}};
    restaurant.orders.push(order);
    customer=dimension.spawnEntity('ordertocook:customer',{x:.5,y:5.5625,z:.5});
    customer.setRotation({x:0,y:0});
    const pending=hooks.dining.queueMeal(restaurant,order,customer,now);
    saveRestaurant(restaurant);hooks.dining.tick(now);customer.remove();customer=undefined;
    return {pending,visual:world.getEntity(pending.visualEntityId)};
   }
   let rejected=false;
   try{new ItemStack(DIRTY).setDynamicProperty('example:receipt','not-supported');}catch{rejected=true;}
   check('native stackable plate rejects ItemStack dynamic properties',rejected);
   for(let slot=0;slot<inventory.size;slot++)inventory.setItem(slot,new ItemStack('minecraft:stone',64));
   const full=meal();check('production dining visual spawned',full.visual?.typeId==='ordertocook:dining_plate');
   hooks.collectDiningPlate(player,full.visual);
   check('full inventory falls back to one native world item',amount()===1&&restaurant.pendingDishes.length===0);
   check('every full inventory slot is preserved',Array.from({length:inventory.size},(_,slot)=>inventory.getItem(slot)).every(stack=>stack.typeId==='minecraft:stone'&&stack.amount===64));
   hooks.collectDiningPlate(player,full.visual);check('repeated pickup does not duplicate the drop',amount()===1);
   inventory.clearAll();const held=new ItemStack('minecraft:bread',2);held.nameTag='keep this';inventory.setItem(0,held);
   const broken=meal();player.attackEntity(broken.visual);await wait(3);
   check('native Player hit reached the shipped callback',hits.length===1);
   check('breaking drops exactly one additional plate and removes its actor',amount()===2&&!broken.visual.isValid&&restaurant.pendingDishes.length===0);
   check('break leaves held metadata and inventory intact',inventory.getItem(0)?.amount===2&&inventory.getItem(0)?.nameTag==='keep this'&&inventory.emptySlotsCount===inventory.size-1);
   const removed=meal();check('restaurant cleanup returns its last plate',hooks.dining.cleanupRestaurant(restaurant));
   check('three ordinary native plates exist without custom item properties',amount()===3&&drops().every(row=>row.stack.getDynamicPropertyIds().length===0&&row.stack.isStackableWith(new ItemStack(DIRTY))));
   check('cleanup retry never pays another plate',hooks.dining.cleanupRestaurant(restaurant)&&amount()===3);
   inventory.clearAll();world.setDynamicProperty(KEY,JSON.stringify({restaurant:restaurant.id}));completed=true;
  }
 }finally{
  world.afterEvents.entityHitEntity.unsubscribe(observeHit);try{customer?.remove();}catch{}try{player?.disconnect();}catch{}
  await wait(3);
  if(completed){check('QA simulated Player disconnected',world.getAllPlayers().length===0);
   console.warn('OTC_PLATE_RESULT '+JSON.stringify({passed:true,phase:previous?'restart':'first',playersAfter:world.getAllPlayers().length,checks,
    scope:'Actual native simulated Player hit and production dining/store drops with full-inventory, cleanup and same-world restart; fixture-owned completed orders. No real-client interaction/collision verdict.'}));}
 }
}
