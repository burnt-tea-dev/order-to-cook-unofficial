// SPDX-License-Identifier: GPL-3.0-only
// Pinned Java OrderMachineBlockEntity: binding and nearby upgrade/benefit scans
// are distinct. Native doubles do not establish client acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mainFixture, balance } from './main.harness.js';
import { FakeItem, place } from './appliances.harness.js';
import { writePortableBlock, readPortableBlock } from '../runtime/BP/scripts/portable_blocks.js';
import { createRestaurant, getUpgradeQuote, getEffectiveBenefitLevel } from '../runtime/BP/scripts/core.js';

function addBoard(env, x, y, z, nutrition = 5, typeId = 'minecraft:bread') {
  const block = place(env, 'ordertocook:board', { x, y, z });
  const station = env.store.getStation(block);
  station.ownerId = env.player.id;
  station.menu = [{ typeId, nutrition, label: typeId }];
  env.store.saveStation(station); return { block, station };
}
function saved(env) {
  const key = 'ordertocook:r:' + env.restaurant.id, manifest = JSON.parse(env.properties.get(key));
  return JSON.parse(Array.from({ length: manifest.parts }, (_, i) => env.properties.get(`${key}:part:${manifest.buffer}:${i}`)).join(''));
}
function sync(env) { return env.hooks.getMachine(env.player, env.machine); }
function bind(env, value) {
  env.restaurant.boardId = value.station.id; env.restaurant.menu = env.core.normalizeMenu(value.station.menu);
  env.store.saveRestaurant(env.restaurant);
}

for (const [x,y,z] of [[24,8,0],[-24,-8,0],[0,8,24],[0,-8,-24]]) test(`board cylinder includes horizontal edge and vertical limit ${x},${y},${z}`, async () => {
  const env = await mainFixture(), board = addBoard(env,x,y,z);
  sync(env); assert.equal(saved(env).boardId,board.station.id);
});
for (const [x,y,z] of [[24,0,1],[-24,0,-1],[17,0,17],[0,9,0],[0,-9,0]]) test(`board scan excludes outside cylinder ${x},${y},${z}`, async () => {
  const env = await mainFixture(); addBoard(env,x,y,z,100);
  const fallback = addBoard(env,1,0,0,5);
  sync(env); assert.equal(saved(env).boardId,fallback.station.id);
  assert.equal(saved(env).nearbyBoardNutrition,5);
});

test('initial scan takes highest nutrition, then full 3D distance rather than registration order', async () => {
  const env = await mainFixture();
  addBoard(env,2,8,0,40); const nearer = addBoard(env,4,0,0,40); addBoard(env,1,0,0,39);
  sync(env); assert.equal(saved(env).boardId,nearer.station.id);
});

test('equal nutrition and distance follows Java x/z/y scan order, independent of registration', async () => {
  const env = await mainFixture();
  addBoard(env,0,0,5,40); const first = addBoard(env,-5,0,0,40);
  addBoard(env,0,5,0,40); addBoard(env,0,0,-5,40);
  sync(env); assert.equal(saved(env).boardId,first.station.id);
});

test('a valid bound board survives a richer or nearer board, including its empty-menu state', async () => {
  const env = await mainFixture(), original = addBoard(env,4,0,0,5); bind(env,original);
  addBoard(env,1,0,0,40); sync(env);
  assert.equal(saved(env).boardId,original.station.id);
  assert.deepEqual(saved(env).menu,env.core.normalizeMenu(original.station.menu));
  original.station.menu=[];env.store.saveStation(original.station);sync(env);
  assert.equal(saved(env).boardId,original.station.id);assert.deepEqual(saved(env).menu,[]);
  assert.equal(saved(env).nearbyBoardNutrition,40);
});

test('confirmed removal reselects the best eligible board and persists the new binding', async () => {
  const env=await mainFixture(),original=addBoard(env,2,0,0,5);bind(env,original);
  const next=addBoard(env,3,0,0,40);addBoard(env,4,0,0,40);
  original.block.setType('minecraft:air');sync(env);
  assert.equal(saved(env).boardId,next.station.id);assert.equal(saved(env).nearbyBoardNutrition,40);
});

test('legacy rectangle-corner binding is replaced by an in-cylinder board', async () => {
  const env=await mainFixture(),legacy=addBoard(env,24,0,24,100);bind(env,legacy);
  const next=addBoard(env,2,0,0,5);sync(env);
  assert.equal(saved(env).boardId,next.station.id);assert.equal(saved(env).nearbyBoardNutrition,5);
});

test('revoked staff board cannot remain bound or contribute upgrade nutrition', async () => {
  const env=await mainFixture(),foreign=addBoard(env,1,0,0,100),own=addBoard(env,2,0,0,5);
  foreign.station.ownerId='old-staff';env.store.saveStation(foreign.station);
  env.restaurant.staff=['old-staff'];bind(env,foreign);env.restaurant.staff=[];env.store.saveRestaurant(env.restaurant);
  sync(env);assert.equal(saved(env).boardId,own.station.id);assert.equal(saved(env).nearbyBoardNutrition,5);
});

test('upgrade and benefit use the highest single nearby board while generated dishes use the bound menu', async () => {
  const env=await mainFixture(),bound=addBoard(env,3,0,0,5);bind(env,bound);
  addBoard(env,4,0,0,40,'minecraft:carrot');sync(env);
  assert.equal(env.core.getUpgradeQuote(env.restaurant).currentNutrition,40);
  env.player.container.setItem(0,new FakeItem('ordertocook:chef_coin_1',2));env.formResponses.push(0);
  await env.hooks.upgradeForm(env.player,env.machine,env.restaurant);
  assert.equal(saved(env).level,1);assert.equal(balance(env.player),0);
  assert.equal(saved(env).boardId,bound.station.id);
  const order=env.core.generateOrder(env.restaurant,Date.now(),()=>0.999);
  assert.deepEqual(order.items.map(i=>i.typeId),['minecraft:bread']);assert.equal(order.benefitLevel,1);
});

test('nearby board nutrition is a maximum, never a sum of different menus', async () => {
  const env=await mainFixture();addBoard(env,2,0,0,30);addBoard(env,3,0,0,30,'minecraft:carrot');sync(env);
  assert.equal(saved(env).nearbyBoardNutrition,30);
  const quote=env.core.getUpgradeQuote(env.restaurant);assert.equal(quote.currentNutrition,30);assert.equal(quote.ok,false);
});

test('removing an unbound rich board lowers offers, keeps bound dishes and committed orders unchanged', async () => {
  const env=await mainFixture(),bound=addBoard(env,2,0,0,5);bind(env,bound);
  const rich=addBoard(env,3,0,0,40,'minecraft:carrot');env.restaurant.level=1;sync(env);
  const offered=env.core.generateOrder(env.restaurant,Date.now(),()=>0.999);
  const committed=structuredClone(env.order);env.store.saveRestaurant(env.restaurant);
  assert.equal(offered.benefitLevel,1);rich.block.setType('minecraft:air');sync(env);
  const result=saved(env);assert.equal(result.boardId,bound.station.id);assert.equal(result.nearbyBoardNutrition,5);
  assert.equal(result.orders.find(o=>o.id===offered.id).benefitLevel,0);
  assert.deepEqual(result.orders.find(o=>o.id===committed.id),committed);
});

test('nearby-only nutrition changes persist and failed writes retry without changing the binding', async () => {
  const env=await mainFixture(),bound=addBoard(env,2,0,0,5);bind(env,bound);sync(env);
  const before=saved(env);addBoard(env,3,0,0,40);
  env.failWrite(id=>id==='ordertocook:r:'+env.restaurant.id);
  assert.throws(()=>sync(env),/persistence failure/);
  assert.deepEqual(saved(env),before);assert.deepEqual(env.store.getRestaurant(env.restaurant.id),before);
  const current=sync(env);assert.equal(saved(env).boardId,bound.station.id);assert.equal(saved(env).nearbyBoardNutrition,40);
  let writes=0;const original=env.world.setDynamicProperty;
  env.world.setDynamicProperty=(key,value)=>{if(key==='ordertocook:r:'+current.id)writes++;return original(key,value);};
  sync(env);assert.equal(writes,0);
});

test('core legacy records without nearby snapshot keep their previous menu-based upgrade behavior',()=>{
  const restaurant=createRestaurant({menu:[{typeId:'minecraft:bread',nutrition:40}],level:1});
  assert.equal(getUpgradeQuote(restaurant).currentNutrition,40);assert.equal(getEffectiveBenefitLevel(restaurant),1);
});

test('core nearby snapshot changes upgrade and benefit, not the selected menu total',()=>{
  const restaurant=createRestaurant({menu:[{typeId:'minecraft:bread',nutrition:5}],level:1});
  restaurant.nearbyBoardNutrition=40;
  assert.equal(getUpgradeQuote(restaurant).currentNutrition,40);assert.equal(getEffectiveBenefitLevel(restaurant),1);
  restaurant.nearbyBoardNutrition=0;
  assert.equal(getUpgradeQuote(restaurant).currentNutrition,0);assert.equal(getEffectiveBenefitLevel(restaurant),0);
});

for (const [positions, expected] of [
  [[[0,0,5],[0,5,0]], [0,5,0]],
  [[[0,5,0],[0,-5,0]], [0,-5,0]]
]) test(`equal-distance ties retain Java z/y order for ${JSON.stringify(positions)}`, async()=>{
  const env=await mainFixture();for(const [x,y,z] of positions)addBoard(env,x,y,z,40);
  sync(env);assert.equal(saved(env).boardId,env.store.locationId(env.dimension.id,{x:expected[0],y:expected[1],z:expected[2]}));
});

test('derived nearby nutrition and binding do not travel with a portable machine item',async()=>{
  const env=await mainFixture(),bound=addBoard(env,2,0,0,5);bind(env,bound);addBoard(env,3,0,0,100);sync(env);
  const stack=new FakeItem('ordertocook:order_machine');writePortableBlock(stack,env.restaurant);
  const data=readPortableBlock(stack);
  assert.equal(data.nearbyBoardNutrition,undefined);assert.equal(data.boardId,undefined);assert.equal(data.menu,undefined);
  assert.equal(data.level,env.restaurant.level);assert.deepEqual(data.stats,env.restaurant.stats);
});

for(const mode of ['throw','undefined']) test(`unavailable unbound rich board (${mode}) cannot grant stale nutrition`,async()=>{
  const env=await mainFixture(),bound=addBoard(env,2,0,0,5);bind(env,bound);
  const rich=addBoard(env,3,0,0,40);env.restaurant.level=1;sync(env);
  const original=env.dimension.getBlock;
  env.dimension.getBlock=location=>{
    if(location.x===rich.block.location.x&&location.y===0&&location.z===0){
      if(mode==='throw')throw Error('chunk unavailable');return undefined;
    }
    return original(location);
  };
  sync(env);assert.equal(saved(env).boardId,bound.station.id);assert.equal(saved(env).nearbyBoardNutrition,5);
  assert.equal(env.core.getEffectiveBenefitLevel(env.restaurant),0);
  env.dimension.getBlock=original;sync(env);
  assert.equal(saved(env).boardId,bound.station.id);assert.equal(saved(env).nearbyBoardNutrition,40);
  assert.equal(env.core.getEffectiveBenefitLevel(env.restaurant),1);
});
