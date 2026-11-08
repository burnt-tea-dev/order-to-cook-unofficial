// SPDX-License-Identifier: GPL-3.0-only
// Actual stable adapters with native IO doubles, not a client/world test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mainFixture, itemCount } from './main.harness.js';
import { entityServices, FakePlayer, makeEnvironment, place } from './appliances.harness.js';

async function gateFixture(position) {
  const env=await mainFixture();env.chair.setType('minecraft:air');
  const chair=place(env,'ordertocook:chair',position);env.store.getStation(chair);
  return {...env,chair};
}
async function arrive(env) {
  const board=env.store.getStation(place(env,'ordertocook:board',{x:3,y:0,z:0}));
  board.menu=[{typeId:'minecraft:bread',nutrition:5}];env.store.saveStation(board);
  Object.assign(env.restaurant,{active:true,orders:[]});
  env.restaurant.config={...env.restaurant.config,refreshMs:100000000,walkInChances:Array(9).fill(1)};
  env.store.saveRestaurant(env.restaurant);
  const original=Math.random;Math.random=()=>0;
  try { for(let i=0;i<1201;i++)env.blockComponents.get('ordertocook:machine_timing').onTick({block:env.machine}); }
  finally {Math.random=original;}
  return env.restaurant.orders.filter(order=>order.walkIn);
}

for(const y of [-8,8])for(const [x,z] of [[24,0],[-24,0],[0,24],[0,-24]]){
  test(`walk-in acceptance admits the Java cylinder edge ${x},${y},${z}`,async()=>{
    const env=await gateFixture({x,y,z}),order=env.core.generateWalkInOrder(env.restaurant,Date.now(),()=>0.999);
    env.store.saveRestaurant(env.restaurant);env.hooks.acceptWithTicket(env.player,env.restaurant,order);
    assert.equal(order.status,'accepted');assert.equal(itemCount(env.player,'ordertocook:order'),1);
  });
  test(`native arrival gate admits the same Java cylinder edge ${x},${y},${z}`,async()=>{
    const env=await gateFixture({x,y,z});assert.equal((await arrive(env)).length,1);
  });
}
for(const [x,y,z] of [[24,0,1],[25,0,0],[0,9,0],[0,-9,0]]){
  test(`walk-in gates reject outside the cylinder ${x},${y},${z}`,async()=>{
    const env=await gateFixture({x,y,z}),order=env.core.generateWalkInOrder(env.restaurant,Date.now(),()=>0.999);
    env.store.saveRestaurant(env.restaurant);env.hooks.acceptWithTicket(env.player,env.restaurant,order);
    assert.equal(order.status,'offered');assert.equal(itemCount(env.player,'ordertocook:order'),0);
    assert.equal((await arrive(env)).length,0);
  });
}

test('cylinder option does not enlarge default spherical refrigerator queries',async()=>{
  const env=await mainFixture(),position={x:24,y:8,z:0};
  env.store.getStation(place(env,'ordertocook:refrigerator',position));
  assert.equal(env.store.nearbyStations(env.dimension.id,env.restaurant.location,24,'ordertocook:refrigerator').length,0);
  assert.equal(env.store.nearbyStations(env.dimension.id,env.restaurant.location,24,'ordertocook:refrigerator',{shape:'cylinder',halfHeight:8}).length,1);
});

function seatingFixture(roll) {
  const env=makeEnvironment(),player=new FakePlayer(env.dimension);env.world.players.push(player);
  const restaurant={id:'chairs',name:'Chairs',dimensionId:env.dimension.id,location:{x:0,y:0,z:0},orders:[]};
  const order={id:'walk-in',restaurantId:restaurant.id,type:'dine_in',status:'offered',walkIn:true,items:[{typeId:'minecraft:bread',amount:1}],expiresAt:Date.now()+600000};
  restaurant.orders.push(order);env.restaurants.set(restaurant.id,restaurant);env.ctx.random=()=>roll;
  const chairs=[[10,0,0],[2,0,0],[24,8,0]].map(([x,y,z])=>{const block=place(env,'ordertocook:chair',{x,y,z});env.ctx.getStation(block);return block;});
  const service=entityServices.createEntityService(env.ctx);return {...env,player,restaurant,order,chairs,service};
}
for(const [roll,index] of [[0,0],[0.33332,0],[1/3,1],[0.66665,1],[2/3,2],[0.999999,2]])test(`free chairs use equal-width random bins at ${roll}`,()=>{
  const env=seatingFixture(roll),customer=env.service.spawnCustomer(env.restaurant,env.order);
  assert.ok(customer);assert.equal(env.service.getCustomerSeat(customer),env.chairs[index]);
});
for(const invalid of ['occupied','above','head','removed','unloaded','dimension','range'])test(`random chair pool excludes ${invalid} candidates before drawing`,()=>{
  const env=seatingFixture(0.9999),bad=env.chairs[2];
  if(invalid==='occupied')assert.equal(env.service.sitOnChair(env.player,bad),true);
  if(invalid==='above')place(env,'minecraft:stone',{...bad.location,y:bad.location.y+1});
  if(invalid==='head')place(env,'minecraft:stone',{...bad.location,y:bad.location.y+2});
  if(invalid==='removed')bad.setType('minecraft:air');
  if(invalid==='dimension')env.ctx.getStation(bad).dimensionId='minecraft:nether';
  if(invalid==='range')env.ctx.getStation(bad).location={x:25,y:8,z:0};
  if(invalid==='unloaded'){
    const original=env.dimension.getBlock.bind(env.dimension);
    env.dimension.getBlock=location=>{if(location.x===24)throw Error('chunk unavailable');return original(location);};
  }
  const customer=env.service.spawnCustomer(env.restaurant,env.order);
  assert.ok(customer);assert.equal(env.service.getCustomerSeat(customer),env.chairs[1]);
});

test('two sequentially spawned customers occupy distinct usable chairs',()=>{
  const env=seatingFixture(0.9999),first=env.service.spawnCustomer(env.restaurant,env.order);
  const secondOrder={...env.order,id:'walk-in-2',customerEntityId:undefined,customerAnchor:undefined};
  env.restaurant.orders.push(secondOrder);const second=env.service.spawnCustomer(env.restaurant,secondOrder);
  assert.ok(first);assert.ok(second);
  assert.equal(env.service.getCustomerSeat(first),env.chairs[2]);assert.equal(env.service.getCustomerSeat(second),env.chairs[1]);
});


for(const roll of [0,0.5,0.999999])test(`ordinary machine diners retain nearest-first behavior at RNG ${roll}`,()=>{
  const env=seatingFixture(roll);env.order.walkIn=false;env.order.status='accepted';
  const customer=env.service.spawnCustomer(env.restaurant,env.order);
  assert.ok(customer);assert.equal(env.service.getCustomerSeat(customer),env.chairs[1]);
});

test('an in-flight chair claim excludes the first seat before its customer is queryable',()=>{
  const env=seatingFixture(0.9999),spawn=env.dimension.spawnEntity.bind(env.dimension);
  const secondOrder={...env.order,id:'reentrant-walk-in'};env.restaurant.orders.push(secondOrder);
  let reentered=false,second;
  env.dimension.spawnEntity=(type,location)=>{
    if(type==='ordertocook:customer'&&!reentered){reentered=true;second=env.service.spawnCustomer(env.restaurant,secondOrder);}
    return spawn(type,location);
  };
  const first=env.service.spawnCustomer(env.restaurant,env.order);
  assert.ok(first);assert.ok(second);assert.equal(env.service.getCustomerSeat(first),env.chairs[2]);
  assert.equal(env.service.getCustomerSeat(second),env.chairs[1]);
});
