// SPDX-License-Identifier: GPL-3.0-only
// Registered production scheduling and real prepare/pickup paths, with native
// IO doubles. Item serialization here is not a native save/restart test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mainFixture, configure } from './main.harness.js';
import { tickCarriedOrderAlerts } from '../runtime/BP/scripts/carried_order_alerts.js';
import { FakeItem, FakePlayer, place } from './appliances.harness.js';
const P='ordertocook:', TICK=P+'expires_tick', NAME=P+'customer_name';
const FLAGS=[P+'expiry_warned_5m',P+'expiry_warned_1m',P+'expiry_expired_notified'];
const KEYS=['message.ordertocook.order_expiring_soon_5','message.ordertocook.order_expiring_soon_1','message.ordertocook.order_expired_named'];
const noticeKeys=env=>env.chat.map(m=>m.rawtext?.find(p=>p.translate)?.translate);
const snapshot=value=>JSON.stringify(value);
function pass(env,tick) { env.system.currentTick=tick; for(const timer of env.system.intervals) if(timer.ticks===20) timer.fn(); }
function setItem(env,fn,slot=10) { const item=env.player.container.getItem(slot);fn(item);env.player.container.setItem(slot,item); }
function counter(env) {
  const block=place(env,'ordertocook:countertop',{x:1,y:0,z:0});
  for(const [id,z]of [['shelf',1],['plate_shelf',2]]) { const supply=place(env,P+id,{x:1,y:0,z});const r=env.store.getStation(supply);r.ownerId=env.player.id;r.supplies=3;env.store.saveStation(r); }
  env.player.container.setItem(1,new FakeItem('minecraft:bread',64));return block;
}
async function fixture(carrier='ticket',type='dine_in') {
  // This suite exercises carrier alerts, not terrain admission. Delivery cases
  // explicitly substitute the entity-service boundary instead of inventing land.
  const env=await mainFixture([],type==='delivery'?{
    deliveryResolver:(_restaurant,candidate)=>({status:'ready',destination:candidate})
  }:{});env.restaurant.orders=[];
  for(let i=0;i<36;i++)env.player.container.setItem(i,undefined);
  const board=place(env,P+'board',{x:0,y:0,z:3});const record=env.store.getStation(board);
  record.initialized=true;record.menu=[{typeId:'minecraft:bread',label:'Bread',nutrition:5}];env.store.saveStation(record);env.hooks.syncMenu(env.restaurant);
  configure(env,{deliveryRate:type==='delivery'?1:0},'server');
  const original=Math.random;Math.random=()=>.9999;
  try{env.hooks.refreshMachineOrders(env.restaurant,env.machine);}finally{Math.random=original;}
  env.order=env.restaurant.orders.find(o=>o.status==='offered');env.order.customerName='Customer Lin';
  env.hooks.acceptWithTicket(env.player,env.restaurant,env.order);assert.equal(env.order.status,'accepted');assert.equal(env.order.type,type);
  if(carrier!=='ticket') { const block=counter(env);env.hooks.prepareOrderAtCountertop(env.player,block,env.restaurant,env.order,carrier);assert.equal(env.order.status,'packed');env.hooks.pickupDisplay(env.player,block.above()); }
  const typeId=P+(carrier==='ticket'?'order':carrier==='bag'?'takeout_bag':'food_plate');
  const slot=env.player.container.slots.findIndex(s=>s?.typeId===typeId);assert.ok(slot>=0);
  const item=env.player.container.getItem(slot);env.player.container.setItem(slot,undefined);env.player.container.setItem(10,item);env.player.selectedSlotIndex=0;
  env.chat=[];env.player.sendMessage=m=>env.chat.push(m);env.player.onScreenDisplay.setActionBar=()=>{};return env;
}

for(const [carrier,type]of [['ticket','dine_in'],['bag','dine_in'],['bag','delivery']])test(`${carrier}/${type}: unselected item crosses boundaries once and keeps full metadata`,async()=>{
  const env=await fixture(carrier,type);
  setItem(env,item=>{item.nameTag='Kept';item.setLore(['not authority']);item.keepOnDeath=true;item.lockMode='slot';item.damage=7;item.setDynamicProperty('addon:unknown',{x:2,y:3,z:4});});
  const original=env.player.container.getItem(10), canonical=snapshot(env.order);let notices=0;
  for(const remaining of [6001,6000,5999,1201,1200,1199,1,0,-1]) {
    pass(env,36000-remaining);if([6000,1200,0].includes(remaining))notices++;
    assert.equal(env.chat.length,notices,`remaining ${remaining}`);
  }
  assert.deepEqual(noticeKeys(env),KEYS);assert.ok(env.chat.every(m=>JSON.stringify(m).includes('Customer Lin')));
  const result=env.player.container.getItem(10);for(const f of FLAGS){assert.equal(result.getDynamicProperty(f),true);original.setDynamicProperty(f,true);}
  assert.deepEqual(result,original,'native stack was updated, not rebuilt');
  assert.equal(env.order.status,'expired');assert.equal(env.restaurant.stats.failed,1);
  const before=JSON.parse(canonical);delete before.status;const after={...env.order};delete after.status;delete after.expiredAt;assert.deepEqual(after,before);
});

test('first observation selects only current severity, including exact boundary and beyond',async()=>{
  for(const [remaining,key]of [[6001,undefined],[6000,KEYS[0]],[5999,KEYS[0]],[1201,KEYS[0]],[1200,KEYS[1]],[1199,KEYS[1]],[1,KEYS[1]],[0,KEYS[2]],[-1,KEYS[2]]]){
    const env=await fixture('bag');pass(env,36000-remaining);
    assert.equal(noticeKeys(env)[0],key,`first observation at ${remaining}`);
    pass(env,36020-remaining);
    // Do not accidentally cross another threshold on the repeat control.
    if(remaining!==6001&&remaining!==1201&&remaining!==1)assert.equal(env.chat.length,1);
  }
});

test('flags belong to each physical item, survive slot/player transfer and serialization reload',async()=>{
  const env=await fixture();const copy=env.player.container.getItem(10);env.player.container.setItem(11,copy);
  pass(env,30000);assert.deepEqual(noticeKeys(env),[KEYS[0],KEYS[0]]);
  const other=new FakePlayer(env.dimension);other.sendMessage=m=>env.chat.push(m);env.world.players.push(other);
  env.player.container.moveItem(10,20,other.container);env.player.container.moveItem(11,25,env.player.container);
  const saved=JSON.parse(JSON.stringify(other.container.getItem(20)));const reloaded=Object.assign(new FakeItem(saved.typeId,saved.amount),saved);
  const restored=await mainFixture([...env.properties]);restored.chat=[];restored.world.players=[other];other.sendMessage=m=>restored.chat.push(m);other.container.setItem(20,reloaded);
  pass(env,30020);assert.equal(env.chat.length,2);pass(restored,30040);assert.equal(restored.chat.length,0);
  pass(restored,34800);assert.deepEqual(noticeKeys(restored),[KEYS[1]]);
});

test('freshly prepared bag starts new flags instead of inheriting its warned paper',async()=>{
  const env=await fixture();pass(env,30000);assert.deepEqual(noticeKeys(env),[KEYS[0]]);
  const block=counter(env);env.hooks.prepareOrderAtCountertop(env.player,block,env.restaurant,env.order,'bag');env.hooks.pickupDisplay(env.player,block.above());
  env.chat.length=0;pass(env,30020);assert.deepEqual(noticeKeys(env),[KEYS[0]]);
  const bag=env.player.container.slots.find(s=>s?.typeId===P+'takeout_bag');assert.equal(bag.getDynamicProperty(NAME),'Customer Lin');
});

test('world storage and dropped items stay silent, retrieval gets only current severity; plates never warn',async()=>{
  const env=await fixture('bag');const chest=place(env,P+'refrigerator',{x:5,y:0,z:5});
  env.player.container.moveItem(10,0,chest.container);env.dimension.spawnItem(chest.container.getItem(0),{x:6,y:0,z:6});
  pass(env,30000);pass(env,34800);assert.equal(env.chat.length,0);
  chest.container.moveItem(0,10,env.player.container);pass(env,34820);assert.deepEqual(noticeKeys(env),[KEYS[1]]);
  const plate=await fixture('plate');pass(plate,30000);pass(plate,34800);pass(plate,36000);assert.equal(plate.chat.length,0);
});

test('terminal, wrong-proof and packed/reprinted papers are silent anti-stale controls',async()=>{
  for(const carrier of ['ticket','bag'])for(const status of ['completed','cancelled','offered']) {
    const env=await fixture(carrier);env.order.status=status;env.store.saveRestaurant(env.restaurant);pass(env,30000);pass(env,36000);assert.equal(env.chat.length,0,carrier+' '+status);
  }
  for(const carrier of ['ticket','bag']) { const env=await fixture(carrier);setItem(env,item=>item.setDynamicProperty(P+'proof','wrong'));pass(env,30000);assert.equal(env.chat.length,0); }
  const env=await fixture('bag');const reprint=env.hooks.parcelFor(env.restaurant,env.order,P+'order');env.player.container.setItem(10,reprint);
  pass(env,30000);pass(env,36000);assert.equal(env.chat.length,0,'expired reprint of already packed work is still stale');
});

test('history pruning preserves named self-contained bags, suppresses orphan paper, and legacy names use translation',async()=>{
  for(const carrier of ['ticket','bag']){
    const env=await fixture(carrier);env.restaurant.orders=[];env.store.saveRestaurant(env.restaurant);pass(env,30000);
    assert.equal(env.chat.length,carrier==='bag'?1:0);if(carrier==='bag')assert.ok(JSON.stringify(env.chat[0]).includes('Customer Lin'));
  }
  const env=await fixture('bag');env.restaurant.orders=[];env.store.saveRestaurant(env.restaurant);setItem(env,item=>{item.setDynamicProperty(NAME,undefined);item.setLore(['Customer Fake']);});
  pass(env,36000);assert.deepEqual(noticeKeys(env),[KEYS[2]]);assert.ok(JSON.stringify(env.chat[0]).includes('keyword.ordertocook.customer'));assert.ok(!JSON.stringify(env.chat[0]).includes('Fake'));
});

test('legacy linked paper and orphan bag adopt the existing clock once, without changing canonical data',async()=>{
  for(const carrier of ['ticket','bag']) {
    const env=await fixture(carrier);const wall=Date.now();
    setItem(env,item=>{item.setDynamicProperty(TICK,undefined);if(carrier==='bag')item.setDynamicProperty(P+'expires_at',wall+60000);});
    if(carrier==='bag'){env.restaurant.orders=[];env.store.saveRestaurant(env.restaurant);}
    const canonical=snapshot(env.restaurant.orders);const original=Date.now;Date.now=()=>wall;
    try{pass(env,30000);const deadline=env.player.container.getItem(10).getDynamicProperty(TICK);assert.equal(deadline,carrier==='bag'?31200:36000);Date.now=()=>wall+86400000;pass(env,30020);assert.equal(env.player.container.getItem(10).getDynamicProperty(TICK),deadline);}finally{Date.now=original;}
    assert.equal(snapshot(env.restaurant.orders),canonical);assert.equal(env.chat.length,1);
  }
});

test('malformed identity, deadline, flags and mismatched deadlines fail closed without rewriting items',async()=>{
  for(const [key,value]of [[P+'restaurant',7],[P+'order_id',''],[TICK,-1],[TICK,NaN],[TICK,'36000'],[TICK,36001],[FLAGS[0],'true'],[FLAGS[1],1],[FLAGS[2],{}]]){
    const env=await fixture('bag');setItem(env,item=>item.setDynamicProperty(key,value));const before=env.player.container.getItem(10);pass(env,30000);assert.equal(env.chat.length,0,key);assert.deepEqual(env.player.container.getItem(10),before);
  }
  const env=await fixture('bag');setItem(env,item=>item.setDynamicProperty(NAME,42));env.restaurant.orders=[];env.store.saveRestaurant(env.restaurant);pass(env,30000);assert.ok(JSON.stringify(env.chat[0]).includes('keyword.ordertocook.customer'));
});

test('native slot/property reads and writes can fail independently without loss, flag erasure or state changes',async()=>{
  for(const failure of ['slot-read','property-read','property-write','slot-write']){
    const env=await fixture('bag'),container=env.player.container,before=container.getItem(10),canonical=snapshot(env.order);
    const get=container.getItem.bind(container),set=container.setItem.bind(container);let armed=true;
    container.getItem=slot=>{if(slot===10&&armed&&failure==='slot-read'){armed=false;throw Error('read');}const item=get(slot);if(slot===10&&armed&&item){if(failure==='property-read')item.getDynamicProperty=()=>{armed=false;throw Error('property read');};if(failure==='property-write')item.setDynamicProperty=()=>{armed=false;throw Error('property write');};}return item;};
    container.setItem=(slot,item)=>{if(slot===10&&armed&&failure==='slot-write'){armed=false;throw Error('write');}return set(slot,item);};
    pass(env,30000);assert.equal(env.chat.length,0,failure);assert.deepEqual(get(10),before);assert.equal(snapshot(env.order),canonical);
    container.getItem=get;container.setItem=set;pass(env,30020);assert.deepEqual(noticeKeys(env),[KEYS[0]],failure+' next bounded retry');
  }
});

test('notification happens after item persistence; failed chat is marked and not replayed',async()=>{
  const env=await fixture('bag');let attempts=0;env.player.sendMessage=()=>{attempts++;assert.equal(env.player.container.getItem(10).getDynamicProperty(FLAGS[0]),true);throw Error('chat unavailable');};
  pass(env,30000);pass(env,30020);assert.equal(attempts,1);
});

test('one pass reads at most 36 slots/player; writes only a new marker or one-time legacy adoption',async()=>{
  const env=await fixture('bag');const other=new FakePlayer(env.dimension);env.world.players.push(other);
  let reads=0,writes=0;for(const player of [env.player,other]){const c=player.container,get=c.getItem.bind(c),set=c.setItem.bind(c);c.getItem=i=>{reads++;return get(i);};c.setItem=(i,s)=>{writes++;return set(i,s);};}
  // Only the existing 20-tick callback is invoked, not the independent held HUD.
  pass(env,29980);assert.equal(reads,72);assert.equal(writes,0);
  reads=0;pass(env,30000);assert.equal(reads,72);assert.equal(writes,1);
  reads=0;pass(env,30020);assert.equal(reads,72);assert.equal(writes,1);
  reads=0;pass(env,34800);pass(env,36000);assert.equal(reads,144);assert.equal(writes,3);
});

test('each supported locale contains original-style named alerts and a customer fallback',async()=>{
  for(const lang of ['en_US','zh_CN','zh_TW']){const text=await readFile(new URL(`../runtime/RP/texts/${lang}.lang`,import.meta.url),'utf8');for(const key of [...KEYS,'keyword.ordertocook.customer'])assert.ok(text.split('\n').some(line=>line.startsWith(key+'=')),lang+' '+key);}
});

test('independent negative controls: plates and world-stored bags never notify their former holder',async()=>{
  for(const carrier of ['plate','bag']){const env=await fixture(carrier);if(carrier==='bag'){const chest=place(env,P+'refrigerator',{x:5,y:0,z:5});env.player.container.moveItem(10,0,chest.container);}for(const tick of [30000,34800,36000])pass(env,tick);assert.equal(env.chat.length,0);assert.equal(env.order.status,'expired');}
});

test('legitimate large live histories remain eligible with one referenced-record traversal per pass',async()=>{
  const env=await fixture();
  env.restaurant.orders.unshift(...Array.from({length:200},(_,i)=>({...env.order,id:'other-'+i})));
  env.store.saveRestaurant(env.restaurant);assert.equal(env.restaurant.orders.length,201);
  env.player.container.setItem(11,env.player.container.getItem(10));
  let visited=0;const iterator=env.restaurant.orders[Symbol.iterator].bind(env.restaurant.orders);
  env.restaurant.orders[Symbol.iterator]=function*(){for(const order of iterator()){visited++;yield order;}};
  // Invoke the same production service separately to exclude the existing
  // restaurant expiry loop's own traversal from this feature's cost assertion.
  tickCarriedOrderAlerts([env.player],{tick:30000,wall:Date.now()},env.store.getRestaurant);
  assert.deepEqual(noticeKeys(env),[KEYS[0],KEYS[0]]);assert.equal(visited,201);
});

test('failed canonical save and subsequent reload cannot leave a stale terminal-order lookup',async()=>{
  const env=await fixture('bag');env.order.status='completed';env.failWrite(id=>id.startsWith(P+'r:'));
  assert.throws(()=>env.store.saveRestaurant(env.restaurant));
  assert.notEqual(env.store.getRestaurant(env.restaurant.id),env.restaurant);
  pass(env,30000);assert.deepEqual(noticeKeys(env),[KEYS[0]],'rollback restored packed canonical order');
  const canonical=env.store.getRestaurant(env.restaurant.id);canonical.orders[0].status='completed';env.store.saveRestaurant(canonical);
  pass(env,34800);assert.equal(env.chat.length,1,'successful terminal save takes effect immediately');
});

test('committed item write followed by an exception retains the marker without rolling back or replaying',async()=>{
  const env=await fixture('bag'),c=env.player.container,set=c.setItem.bind(c);let writes=0;
  c.setItem=(slot,item)=>{writes++;set(slot,item);throw Error('write applied then threw');};
  pass(env,30000);assert.equal(env.chat.length,0);assert.equal(c.getItem(10).getDynamicProperty(FLAGS[0]),true);
  c.setItem=set;pass(env,30020);assert.equal(writes,1);assert.equal(env.chat.length,0);
});

test('a later failed marker write preserves previous flags and retries only at the next pass',async()=>{
  const env=await fixture('bag');pass(env,30000);const before=env.player.container.getItem(10);
  env.player.container.failNextSlot=10;pass(env,34800);assert.deepEqual(env.player.container.getItem(10),before);assert.equal(env.chat.length,1);
  pass(env,34820);assert.deepEqual(noticeKeys(env),KEYS.slice(0,2));assert.equal(env.player.container.getItem(10).getDynamicProperty(FLAGS[0]),true);
});

test('legacy adoption before thresholds writes once; invalid legacy expiry remains untouched',async()=>{
  const env=await fixture('bag');env.restaurant.orders=[];env.store.saveRestaurant(env.restaurant);const now=Date.now();
  setItem(env,item=>{item.setDynamicProperty(TICK,undefined);item.setDynamicProperty(P+'expires_at',now+600000);});
  const original=Date.now;Date.now=()=>now;try{pass(env,0);const adopted=env.player.container.getItem(10);assert.equal(adopted.getDynamicProperty(TICK),12000);assert.equal(env.chat.length,0);Date.now=()=>now+999999;pass(env,20);assert.deepEqual(env.player.container.getItem(10),adopted);}finally{Date.now=original;}
  for(const bad of ['36000',-1,NaN,undefined]){setItem(env,item=>{item.setDynamicProperty(TICK,undefined);item.setDynamicProperty(P+'expires_at',bad);});const before=env.player.container.getItem(10);pass(env,30000);assert.equal(env.chat.length,0);assert.deepEqual(env.player.container.getItem(10),before);}
});

test('invalid native players/containers and expanded inventories cannot expand the 36-slot boundary',async()=>{
  const env=await fixture('bag'),c=env.player.container;c.size=100;c.slots.length=100;
  c.setItem(40,c.getItem(10));c.setItem(10,undefined);let reads=0;const get=c.getItem.bind(c);c.getItem=i=>{reads++;assert.ok(i<36);return get(i);};
  pass(env,30000);assert.equal(reads,36);assert.equal(env.chat.length,0);
  for(const invalid of ['player','container','component']){reads=0;if(invalid==='player')env.player.isValid=false;else if(invalid==='container'){env.player.isValid=true;c.isValid=false;}else{c.isValid=true;env.player.getComponent=()=>{throw Error('unloaded');};}pass(env,30020);assert.equal(reads,0);}
});

test('new customer-name snapshots are bounded without splitting surrogate pairs; old missing names use canonical data',async()=>{
  const env=await fixture('bag');const name='x'.repeat(127)+'😋';env.order.customerName=name;
  const fresh=env.hooks.parcelFor(env.restaurant,env.order);assert.equal(fresh.getDynamicProperty(NAME),'x'.repeat(127));
  setItem(env,item=>item.setDynamicProperty(NAME,undefined));pass(env,30000);assert.ok(JSON.stringify(env.chat[0]).includes('x'.repeat(127)));
});

test('fresh per-pass lookup covers reload, array replacement, deletion and unsaved live additions',async()=>{
  const env=await fixture('bag'),r=env.restaurant;
  const restored=await mainFixture([...env.properties]);restored.chat=[];restored.player.sendMessage=m=>restored.chat.push(m);restored.player.container.setItem(10,env.player.container.getItem(10));
  pass(restored,30000);assert.deepEqual(noticeKeys(restored),[KEYS[0]]);
  r.orders=[{...env.order,status:'completed'}];pass(env,30000);assert.equal(env.chat.length,0,'replaced terminal record is current even before save');
  r.orders=[];r.orders.push(env.order);pass(env,30020);assert.deepEqual(noticeKeys(env),[KEYS[0]],'unsaved live additions do not leave a stale cached absence');
  env.store.deleteRestaurant(r.id);pass(env,34800);assert.deepEqual(noticeKeys(env),KEYS.slice(0,2),'deleted history follows documented self-contained bag policy');
});

test('registered machine reprint of accepted work is a fresh physical paper with fresh flags',async()=>{
  const env=await fixture();pass(env,30000);assert.deepEqual(noticeKeys(env),[KEYS[0]]);
  env.player.container.setItem(0,undefined);env.formResponses.push(2,0,0);
  const event={player:env.player,block:env.machine,isFirstEvent:true,cancel:false};
  for(const callback of env.world.beforeEvents.playerInteractWithBlock.subscriptions)callback(event);
  assert.equal(event.cancel,true);for(const callback of env.system.callbacks.splice(0))callback();
  await new Promise(resolve=>setImmediate(resolve));
  const paper=env.player.container.slots.find(item=>item?.typeId===P+'order');assert.ok(paper);assert.equal(paper.getDynamicProperty(FLAGS[0]),undefined);
  env.chat.length=0;pass(env,30020);assert.deepEqual(noticeKeys(env),[KEYS[0]]);
});

test('failed linked-record traversal is attempted once per pass and never treated as missing history',async()=>{
  const env=await fixture('bag');env.player.container.setItem(11,env.player.container.getItem(10));
  const iterator=env.restaurant.orders[Symbol.iterator].bind(env.restaurant.orders);let attempts=0;
  env.restaurant.orders[Symbol.iterator]=function*(){attempts++;throw Error('record read unavailable');};
  const before=env.player.container.getItem(10);
  tickCarriedOrderAlerts([env.player],{tick:30000,wall:Date.now()},env.store.getRestaurant);
  assert.equal(attempts,1);assert.equal(env.chat.length,0);assert.deepEqual(env.player.container.getItem(10),before);
  env.restaurant.orders[Symbol.iterator]=iterator;
  pass(env,30020);assert.deepEqual(noticeKeys(env),[KEYS[0],KEYS[0]]);
});
