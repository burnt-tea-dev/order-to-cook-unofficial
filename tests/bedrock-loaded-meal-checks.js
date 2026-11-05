// Production adapters and native timers; isolated test world only.
import {world,system,GameMode} from '@minecraft/server';
import * as gameTest from '@minecraft/server-gametest';
import {getQaHooks} from './main.js';
import {generateOrder,acceptOrder,packOrder} from './core.js';
import {getRestaurant,saveRestaurant} from './store.js';
const KEY='ordertocook:qa_loaded_meal', AGE='ordertocook:reaction_tick';
const wait=t=>new Promise(resolve=>system.runTimeout(resolve,t));
world.afterEvents.worldLoad.subscribe(()=>system.run(()=>run().catch(e=>console.error('OTC_NATIVE_CLOCK_FATAL '+e+' '+e?.stack))));
async function run(){
 const d=world.getDimension('overworld'),h=getQaHooks(),checks=[];
 const check=(name,ok)=>{checks.push({name,passed:!!ok});console.warn('OTC_NATIVE_CLOCK_CHECK '+JSON.stringify(checks.at(-1)));if(!ok)throw Error(name);};
 while(!h.ready||!d.isChunkLoaded({x:0,y:5,z:0}))await wait(1);
 const raw=world.getDynamicProperty(KEY),saved=raw?JSON.parse(raw):undefined,phase=saved?'restart':'seed'; let player;
 const food=meal=>Number(world.getDynamicProperty('ordertocook:food_tick:'+meal.token)||0);
 const coin=who=>{let n=0;const c=who.getComponent('minecraft:inventory').container;for(let i=0;i<c.size;i++){const s=c.getItem(i),m=s?.typeId.match(/^ordertocook:chef_coin_(\d+)$/);if(m)n+=+m[1]*s.amount;}return n;};
 const plate=meal=>d.getBlock({x:Math.floor(meal.location.x),y:Math.floor(meal.location.y),z:Math.floor(meal.location.z)});
 const stage=meal=>{const p=plate(meal).permutation;return p.getState('ordertocook:stage')+16*p.getState('ordertocook:stage_high');};
 const deliver=(x,name)=>{
  const machine=d.getBlock({x,y:5,z:16});machine.setType('ordertocook:order_machine');
  player=gameTest.spawnSimulatedPlayer({dimension:d,x:x+1.5,y:5,z:17.5},name,GameMode.Survival);player.setDynamicProperty('ordertocook:welcomed',true);player.getComponent('minecraft:inventory').container.clearAll();
  const r=h.getMachine(player,machine);r.level=2;r.menu=[{typeId:'minecraft:bread',label:'Bread',nutrition:5}];r.config={...r.config,deliveryRate:0,tipNormalChance:0,tipUrgentChance:0};
  const now=Date.now(),o=generateOrder(r,now,()=>.9999);acceptOrder(r,o.id,now);packOrder(r,o.id,now);o.proof=name;saveRestaurant(r);
  const npc=d.spawnEntity('ordertocook:customer',{x:x+2.5,y:5.5625,z:16.5});npc.setDynamicProperty('ordertocook:restaurant_id',r.id);npc.setDynamicProperty('ordertocook:order_id',o.id);o.customerEntityId=npc.id;
  const seat=d.spawnEntity('ordertocook:seat',npc.location);seat.getComponent('minecraft:rideable').addRider(npc);
  player.getComponent('minecraft:inventory').container.setItem(0,h.parcelFor(r,o));player.selectedSlotIndex=0;let i=0;const rolls=[.9999,.05,.9999];h.customerInteract(player,npc,{restaurantId:r.id,orderId:o.id},{rng:()=>rolls[i++]});
  const meal=r.pendingDishes[0];check(name+' commits the loaded-tick meal and base payment',meal?.clock==='loaded'&&meal.action===5&&coin(player)===o.reward&&r.stats.earnings===o.reward);return{r,o,npc,meal,initial:coin(player)};
 };
 try{
  check('production loaded with native clock components',h.ready);
  if(!saved){
   d.runCommand('fill -3 4 13 30 4 21 stone');d.runCommand('fill -3 5 13 30 9 21 air');
   const a=deliver(0,'ClockOnline18');
   while(food(a.meal)<20)await wait(1);
   check('native food block advances through the 15-tick boundary',food(a.meal)<35&&stage(a.meal)===a.meal.variant*4+1);
   const age=Number(a.npc.getProperty(AGE)),count=food(a.meal),tick=system.currentTick;await wait(20);
   console.warn('OTC_NATIVE_CLOCK_PROGRESS '+JSON.stringify({age,next:Number(a.npc.getProperty(AGE)),count,food:food(a.meal),delta:system.currentTick-tick}));
   check('native customer and food each advance at one tick per game tick',Number(a.npc.getProperty(AGE))-age===20&&food(a.meal)-count===20);
   while(food(a.meal)<100)await wait(1);
   check('food is dirty at 100 while the 120-tick bonus stays unpaid',stage(a.meal)===a.meal.variant*4+4&&coin(player)===a.initial&&a.npc.isValid);
   check('dirty plate claim keeps the unfinished reaction',!h.dining.claim(player,a.r,a.meal).early&&a.r.pendingDishes.includes(a.meal));
   while(a.npc.isValid)await wait(1);
   check('native completion pays the bonus once',coin(player)===a.initial+6&&a.r.stats.earnings===a.initial+6&&!a.meal.reactionPending&&!a.meal.bonusPlayerId);
   await wait(8);check('completed plate and clock state retire without replay',a.r.pendingDishes.length===0&&world.getDynamicProperty('ordertocook:food_tick:'+a.meal.token)===undefined&&coin(player)===a.initial+6);
   player.disconnect();player=undefined;await wait(3);
   const b=deliver(8,'ClockEarly18');await wait(20);check('early plate interrupts the native reaction',h.dining.claim(player,b.r,b.meal).early&&b.meal.action===7);
   const interruption=system.currentTick;while(b.npc.isValid)await wait(1);
   console.warn('OTC_NATIVE_CLOCK_INTERRUPTION '+JSON.stringify({ticks:system.currentTick-interruption,income:b.r.stats.earnings,base:b.initial,coins:coin(player),pending:b.meal.reactionPending}));
   check('interruption uses ten simulation ticks and cancels bonus',system.currentTick-interruption>=10&&system.currentTick-interruption<=13&&b.r.stats.earnings===b.initial&&coin(player)===b.initial);
   player.disconnect();player=undefined;await wait(5);
   const c=deliver(16,'ClockRestart18');while(food(c.meal)<25)await wait(1);
   world.setDynamicProperty(KEY,JSON.stringify({r:c.r.id,o:c.o.id,npc:c.npc.id,food:food(c.meal),age:Number(c.npc.getProperty(AGE)),wall:Date.now(),initial:c.initial,payee:player.id}));
   check('both partially consumed clocks are saved before shutdown',food(c.meal)>=25&&food(c.meal)<50&&Number(c.npc.getProperty(AGE))<60);
  }else{
   const r=getRestaurant(saved.r),meal=r.pendingDishes.find(x=>x.id===saved.o);let npc;
   while(!(npc=world.getEntity(saved.npc)))await wait(1);
   check('offline period exceeds both nominal durations',Date.now()-saved.wall>6000);
   check('same saved NPC and food retain partial progress',Number(npc.getProperty(AGE))>=saved.age&&Number(npc.getProperty(AGE))<saved.age+25&&food(meal)>=saved.food&&food(meal)<saved.food+25&&r.stats.earnings===saved.initial);
   const age=Number(npc.getProperty(AGE)),count=food(meal);await wait(10);
   check('both saved clocks resume through actual native ticks',Number(npc.getProperty(AGE))===age+10&&food(meal)===count+10);
   while(npc.isValid)await wait(1);
   check('restored native completion credits restaurant once for offline recipient',r.stats.earnings===saved.initial+6&&!meal.bonusPlayerId&&!meal.reactionPending&&h.progression.getState(saved.payee).totals.earned===saved.initial);
   await wait(10);check('restart cannot repeat bonus',r.stats.earnings===saved.initial+6);
   world.setDynamicProperty(KEY,undefined);
  }
 }finally{try{player?.disconnect();}catch{}await wait(3);}
 console.warn('OTC_NATIVE_CLOCK_RESULT '+JSON.stringify({passed:true,phase,checks,playersAfter:world.getAllPlayers().length,scope:'Production native entity/block clocks and handoff/claim/payment adapters. No client rendering verdict; LIVE unchanged.'}));
}
