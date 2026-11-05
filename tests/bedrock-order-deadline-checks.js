// Isolated production adapter test. Never import this observer on LIVE.
import {world,system,GameMode} from '@minecraft/server';
import * as gameTest from '@minecraft/server-gametest';
import {getQaHooks} from './main.js';
import {getRestaurant,saveRestaurant} from './store.js';
import {generateOrder,acceptOrder,packOrder,orderRemainingMs} from './core.js';
const KEY='ordertocook:qa_order_deadlines',wait=t=>new Promise(resolve=>system.runTimeout(resolve,t));
world.afterEvents.worldLoad.subscribe(()=>system.run(()=>run().catch(e=>console.error('OTC_NATIVE_CLOCK_FATAL '+e+' '+e?.stack))));
async function run(){
 const d=world.getDimension('overworld'),h=getQaHooks(),checks=[],time=()=>({wall:Date.now(),tick:system.currentTick});
 const check=(name,ok)=>{checks.push({name,passed:!!ok});console.warn('OTC_NATIVE_CLOCK_CHECK '+JSON.stringify(checks.at(-1)));if(!ok)throw Error(name);};
 while(!h.ready||!d.isChunkLoaded({x:0,y:5,z:0}))await wait(1);
 const raw=world.getDynamicProperty(KEY),saved=raw?JSON.parse(raw):undefined,phase=saved?'restart':'seed';let player;
 const coins=()=>{const c=player.getComponent('minecraft:inventory').container;let total=0;for(let i=0;i<c.size;i++){const s=c.getItem(i),m=s?.typeId.match(/^ordertocook:chef_coin_(\d+)$/);if(m)total+=+m[1]*s.amount;}return total;};
 try{
  player=gameTest.spawnSimulatedPlayer({dimension:d,x:2.5,y:5,z:1.5},phase==='seed'?'DeadlineSeed19':'DeadlineRestart19',GameMode.Survival);
  player.setDynamicProperty('ordertocook:welcomed',true);const inventory=player.getComponent('minecraft:inventory').container;inventory.clearAll();
  if(!saved){
   d.runCommand('fill -3 4 -3 15 4 8 stone');d.runCommand('fill -3 5 -3 15 9 8 air');
   const machine=d.getBlock({x:0,y:5,z:0});machine.setType('ordertocook:order_machine');
   const r=h.getMachine(player,machine);r.menu=[{typeId:'minecraft:bread',label:'Bread',nutrition:5}];r.config={...r.config,deliveryRate:1,urgentRate:0,tipNormalChance:0,tipUrgentChance:0};
   h.refreshMachineOrders(r,machine);check('production refresh gives normal orders 36000 world ticks',r.orders.find(o=>o.status==='offered').expiresTick-system.currentTick===36000);
   r.config.urgentRate=1;h.refreshMachineOrders(r,machine);check('production urgent refresh gives 12000 world ticks',r.orders.find(o=>o.status==='offered').expiresTick-system.currentTick===12000);
   r.config.urgentRate=0;r.config.normalDurationMs=5000;h.refreshMachineOrders(r,machine);
   const o=r.orders.find(o=>o.status==='offered');o.destination={dimensionId:d.id,x:2,y:5,z:0,distance:2};
   o.expiresAt=Date.now()-1000000;saveRestaurant(r);h.acceptWithTicket(player,r,o);
   check('production acceptance ignores an obsolete wall deadline',o.status==='accepted');
   check('production customer can spawn for its still-live tick deadline',!!world.getEntity(o.customerEntityId));
   packOrder(r,o.id,time());o.proof='native-deadline-19';saveRestaurant(r);
   const bag=h.parcelFor(r,o);check('physical bag has its own world tick deadline',bag.getDynamicProperty('ordertocook:expires_tick')===o.expiresTick);
   const chest=d.getBlock({x:7,y:5,z:0});chest.setType('minecraft:chest');chest.getComponent('minecraft:inventory').container.setItem(0,bag);
   d.runCommand('gamerule dodaylightcycle false');
   const before={tick:system.currentTick,absolute:world.getAbsoluteTime()};await wait(10);
   check('order time continues when the daylight clock is stopped',system.currentTick-before.tick===10&&world.getAbsoluteTime()===before.absolute);
   const remaining=orderRemainingMs(o,time());d.runCommand('time add 1000000');
   check('time command does not consume the order deadline',orderRemainingMs(o,time())===remaining);
   const legacy={...o,id:o.id+'-legacy',status:'offered',expiresAt:Date.now()+60000};delete legacy.expiresTick;delete legacy.customerEntityId;r.orders.push(legacy);saveRestaurant(r);
   world.setDynamicProperty(KEY,JSON.stringify({r:r.id,o:o.id,legacy:legacy.id,deadline:o.expiresTick,tick:system.currentTick,wall:Date.now(),npc:o.customerEntityId,proof:o.proof}));
   check('native world is saved with usable order time remaining',o.expiresTick-system.currentTick>50);
  }else{
   const r=getRestaurant(saved.r),o=r.orders.find(o=>o.id===saved.o),legacy=r.orders.find(o=>o.id===saved.legacy);
   console.warn('OTC_ORDER_CLOCK_RESTART '+JSON.stringify({savedTick:saved.tick,nowTick:system.currentTick,deadline:saved.deadline,offlineWall:Date.now()-saved.wall}));
   check('offline wall duration exceeds the configured five-second order',Date.now()-saved.wall>5000);
   check('world total tick resumes near its saved value without offline catchup',system.currentTick>=saved.tick&&system.currentTick<saved.tick+30);
   h.tickRestaurants();check('same canonical order stays packed after disk restart',o.status==='packed'&&orderRemainingMs(o,time())>0);
   check('old timestamp-only record adopts a tick exactly once',Number.isSafeInteger(legacy.expiresTick)&&orderRemainingMs(legacy,time())>0&&orderRemainingMs(legacy,time())<=60000);
   const chest=d.getBlock({x:7,y:5,z:0}).getComponent('minecraft:inventory').container;
   const bag=chest.getItem(0);check('same native chest bag preserves proof and tick deadline',bag.getDynamicProperty('ordertocook:proof')===saved.proof&&bag.getDynamicProperty('ordertocook:expires_tick')===saved.deadline);
   chest.moveItem(0,0,inventory);player.selectedSlotIndex=0;
   const customer=world.getEntity(saved.npc);check('same saved customer remains available for its live order',!!customer&&customer.isValid);
   h.customerInteract(player,customer,{restaurantId:r.id,orderId:o.id},{rng:()=>.9999});
   check('production handoff pays once despite the passed wall deadline',o.status==='completed'&&coins()===o.paidReward&&r.stats.completed===1);
   const paid=coins();h.customerInteract(player,customer,{restaurantId:r.id,orderId:o.id});check('replayed handoff cannot pay twice',coins()===paid&&r.stats.completed===1);
   r.config.normalDurationMs=600;r.config.urgentRate=0;
   const late=generateOrder(r,time(),()=>.9999);late.destination={dimensionId:d.id,x:4,y:5,z:0,distance:4};acceptOrder(r,late.id,time());packOrder(r,late.id,time());late.proof='native-expired-19';saveRestaurant(r);
   const npc=d.spawnEntity('ordertocook:customer',{x:4.5,y:5,z:.5});npc.setDynamicProperty('ordertocook:restaurant_id',r.id);npc.setDynamicProperty('ordertocook:order_id',late.id);
   const expired=h.parcelFor(r,late);inventory.setItem(8,expired);player.selectedSlotIndex=8;
   while(system.currentTick<late.expiresTick)await wait(1);
   h.customerInteract(player,npc,{restaurantId:r.id,orderId:late.id});
   console.warn('OTC_ORDER_CLOCK_EDGE '+JSON.stringify({tick:system.currentTick,expiry:late.expiresTick,status:late.status,coins:coins(),paid,bag:inventory.getItem(8)?.typeId}));
   check('exact world-tick expiry refuses payment and keeps native bag',late.status==='expired'&&coins()===paid&&inventory.getItem(8)?.getDynamicProperty('ordertocook:proof')===late.proof);
   r.orders=r.orders.filter(row=>row.id!==late.id);saveRestaurant(r);
   check('native simulated Player can begin eating the expired orphan bag',player.useItemInSlot(8));await wait(40);
   check('native consume event grants expired-bag progress after history pruning',inventory.getItem(8)===undefined&&!!h.progression.getState(player.id).unlocked.expired_bag_eaten);
   const old=h.parcelFor(r,{...late,id:'legacy-orphan',expiresTick:undefined,expiresAt:Date.now()+50000});old.nameTag='Legacy parcel';old.setLore(['old lore']);old.setDynamicProperty('otc_qa:kept','saved');
   inventory.setItem(8,old);player.selectedSlotIndex=8;player.useItemInSlot(8);await wait(3);
   const adopted=inventory.getItem(8);check('native legacy orphan adopts a tick deadline and keeps full metadata',Number.isSafeInteger(adopted.getDynamicProperty('ordertocook:expires_tick'))&&adopted.nameTag==='Legacy parcel'&&adopted.getLore()[0]==='old lore'&&adopted.getDynamicProperty('otc_qa:kept')==='saved');
   world.setDynamicProperty(KEY,undefined);
  }
 }finally{try{player?.disconnect();}catch{}await wait(3);}
 console.warn('OTC_NATIVE_CLOCK_RESULT '+JSON.stringify({passed:true,phase,checks,playersAfter:world.getAllPlayers().length,scope:'Real native items, saved customer/chest and production refresh/accept/handoff/expiry/consumption. Five-second and 12-tick QA deadlines are fixture configuration, not changed defaults. LIVE unchanged.'}));
}
