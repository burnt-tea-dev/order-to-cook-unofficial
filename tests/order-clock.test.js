// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRestaurant, generateOrder, generateWalkInOrder, refreshOrders, acceptOrder, packOrder, completeOrder, expireOrders, orderRemainingMs, adoptOrderDeadline } from '../runtime/BP/scripts/core.js';
import { mainFixture, balance } from './main.harness.js';
const WALL=1800000000000, time=(tick,wall=WALL)=>({wall,tick});
const restaurant=()=>createRestaurant({id:'clock',menu:[{typeId:'minecraft:bread',nutrition:5}],config:{deliveryRate:0,urgentRate:0}},WALL);
const emit=(signal,event)=>{for(const f of signal.subscriptions)f(event);return event;};

test('normal, urgent and walk-in orders keep the Java 36000/12000 world-tick deadlines',()=>{
 const r=restaurant(),normal=generateOrder(r,time(50),()=>.9999);
 assert.equal(normal.expiresTick,36050);r.config.urgentRate=1;
 assert.equal(generateOrder(r,time(70),()=>.9999).expiresTick,12070);
 assert.equal(generateWalkInOrder(r,time(90),()=>.9999).expiresTick,12090);
 const fresh=refreshOrders(r,time(100),()=>.9999);
 assert.ok(fresh.orders.every(o=>o.expiresTick===12100));
});

test('wall jumps and JSON reload cannot shorten tick deadlines; the exact tick rejects handoff',()=>{
 const r=restaurant(),order=generateOrder(r,time(100),()=>.9999);
 assert.equal(acceptOrder(r,order.id,time(101,WALL+86400000)).ok,true);
 const restored=JSON.parse(JSON.stringify(r));
 assert.equal(packOrder(restored,order.id,time(36099,WALL+172800000)).ok,true);
 assert.equal(completeOrder(restored,order.id,time(36100,WALL-10000)).reason,'expired');
 assert.equal(restored.stats.completed,0);assert.equal(restored.stats.failed,1);
});

test('timestamp-only order adopts its remaining partial tick once without changing saved data',()=>{
 const order={id:'legacy',expiresAt:WALL+51,proof:'kept',extra:{value:3}};
 assert.equal(adoptOrderDeadline(order,time(200)),true);assert.equal(order.expiresTick,202);
 assert.equal(adoptOrderDeadline(order,time(500,WALL+5000)),false);assert.equal(order.expiresTick,202);
 assert.deepEqual(order.extra,{value:3});assert.equal(order.proof,'kept');
 assert.equal(orderRemainingMs(order,time(201,WALL+1000000)),50);
 assert.equal(orderRemainingMs(order,time(202)),0);
});

test('production handoff obeys its tick despite an old wall deadline, and exact tick expiry keeps the parcel',async()=>{
 for(const expired of [false,true]){
  const env=await mainFixture();env.order.expiresTick=expired?0:40;
  env.order.expiresAt=expired?Date.now()+600000:Date.now()-600000;env.store.saveRestaurant(env.restaurant);
  env.hooks.customerInteract(env.player,env.customer,env.linkage,{rng:()=>.9999});
  assert.equal(env.order.status,expired?'expired':'completed');
  assert.equal(balance(env.player),expired?0:env.order.reward);
  assert.equal(env.player.container.getItem(0)?.typeId==='ordertocook:food_plate',expired);
 }
});

test('physical bag retains tick expiry through history pruning and native use/consume callbacks',async()=>{
 const env=await mainFixture(),deadline=env.system.currentTick+40;
 const bag=env.hooks.parcelFor(env.restaurant,{...env.order,type:'delivery',carrier:'bag',expiresTick:deadline,expiresAt:Date.now()-600000});
 assert.equal(bag.getDynamicProperty('ordertocook:expires_tick'),deadline);
 assert.ok(bag.getLore().every(line=>!line.includes('UTC')));
 env.restaurant.orders=[];env.store.saveRestaurant(env.restaurant);
 const before=emit(env.world.beforeEvents.itemUse,{source:env.player,itemStack:bag,cancel:false});
 assert.equal(before.cancel,true);assert.equal(env.store.getProfile(env.player.id),undefined);
 env.system.currentTick=deadline;
 assert.equal(emit(env.world.beforeEvents.itemUse,{source:env.player,itemStack:bag,cancel:false}).cancel,false);
 env.itemComponents.get('ordertocook:consume_bag').onConsume({source:env.player,itemStack:bag});
 assert.equal(!!env.store.getProfile(env.player.id).state.unlocked.expired_bag_eaten,true);
});

test('remaining-time display follows game ticks rather than its compatibility wall timestamp',async()=>{
 const env=await mainFixture();env.order.expiresTick=env.system.currentTick+1200;env.order.expiresAt=Date.now()-600000;
 assert.match(env.hooks.orderBody(env.order),/剩餘：1 分鐘/);
});

 test('legacy held orphan bag adopts one tick deadline without losing ItemStack metadata',async()=>{
 const env=await mainFixture();env.restaurant.orders=[];env.store.saveRestaurant(env.restaurant);
 const bag=env.hooks.parcelFor(env.restaurant,{...env.order,type:'delivery',carrier:'bag',expiresAt:Date.now()+60000});
 bag.nameTag='Saved parcel';bag.setLore(['saved lore']);bag.setDynamicProperty('test:kept','value');
 env.player.container.setItem(0,bag);
 emit(env.world.beforeEvents.itemUse,{source:env.player,itemStack:bag,cancel:false});
 for(const fn of env.system.callbacks.splice(0))fn();
 await new Promise(resolve=>setImmediate(resolve));
 const adopted=env.player.container.getItem(0);
 const deadline=adopted.getDynamicProperty('ordertocook:expires_tick');
 assert.ok(Number.isSafeInteger(deadline)&&deadline>0);
 assert.equal(adopted.nameTag,'Saved parcel');assert.deepEqual(adopted.getLore(),['saved lore']);assert.equal(adopted.getDynamicProperty('test:kept'),'value');
 emit(env.world.beforeEvents.itemUse,{source:env.player,itemStack:adopted,cancel:false});
 for(const fn of env.system.callbacks.splice(0))fn();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(env.player.container.getItem(0).getDynamicProperty('ordertocook:expires_tick'),deadline);
});
