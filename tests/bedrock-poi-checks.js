// SPDX-License-Identifier: GPL-3.0-only
// Disposable native QA entry only: never import this into a production world.
// Player proximity is simulated; all blocks, POIs, entities and riding are native.
import { world, system, BlockPermutation } from '@minecraft/server';
import { getQaHooks } from './main.js';
import { nearbyStationBlocks, restaurantChairBlocks } from './station_poi.js';
import { getStation, saveStation, nearbyStations, getRestaurant, restaurants, saveRestaurant } from './store.js';
import { createEntityService } from './entities.js';
const wait=ticks=>new Promise(resolve=>system.runTimeout(resolve,ticks));
const checks=[];
const test=(name,passed,detail)=>checks.push({name,passed:!!passed,...(detail?{detail}: {})});
function report(error){if(error)test('probe completed without exception',false,String(error?.stack||error));console.warn('OTC_POI_REPORT '+JSON.stringify({passed:checks.every(x=>x.passed),checks}));}
world.afterEvents.worldLoad.subscribe(()=>{
  const dim=world.getDimension('overworld');
  dim.runCommand('tickingarea add circle 0 70 0 2 otc_poi_qa');
  system.runTimeout(()=>run(dim).then(()=>report()).catch(report),80);
});
async function run(dim){
  const hooks=getQaHooks(),origin={x:0,y:70,z:0};
  test('exact candidate main entry initialized',hooks.ready);
  const place=(id,x,y,z,states)=>{const b=dim.getBlock({x,y,z});b.setPermutation(BlockPermutation.resolve('ordertocook:'+id,states));return b;};
  const shelfFar=place('shelf',5,70,0),shelfNear=place('shelf',2,70,0);
  const plates=place('plate_shelf',0,70,5);
  const boardFar=place('board',10,70,2),boardNear=place('board',3,70,2),boardCorner=place('board',21,70,21);
  const lower=place('refrigerator',8,70,0,{'ordertocook:half':'lower'});
  const edge=place('chair',24,78,0),corner=place('chair',20,70,20),tooHigh=place('chair',0,79,0);
  const close=place('chair',2,70,2);
  for(const b of [edge,corner,tooHigh,close]){b.above().setType('minecraft:air');b.above(2).setType('minecraft:air');}
  const machine=place('order_machine',0,70,0);
  await wait(8);
  for(const b of [shelfFar,shelfNear,plates,boardFar,boardNear,boardCorner,lower,edge,corner,tooHigh,close])hooks.onPlace(b);
  test('five tickets-zero native POI definitions return positions', ['shelf','plate_shelf','board','refrigerator','chair'].every(id=>dim.poiManager.blocks.getInRange({name:'ordertocook:'+id},origin,40).length>0));
  const shelves=nearbyStationBlocks(dim,origin,'ordertocook:shelf',5);
  test('native shelf candidates are nearest-first',[shelfNear,shelfFar].every((b,i)=>shelves[i]?.location.x===b.location.x),shelves.map(b=>b.location));
  const stored=getStation(shelfNear);stored.ownerId='poi-native-owner';stored.supplies=7;saveStation(stored);
  const records=nearbyStations(dim.id,origin,5,'ordertocook:shelf');
  test('native locations join unchanged canonical supply metadata',records[0]===stored&&stored.supplies===7&&stored.ownerId==='poi-native-owner');
  const fridges=nearbyStationBlocks(dim,origin,'ordertocook:refrigerator',24);
  test('upper refrigerator index hit does not duplicate its inventory',lower.above().typeId==='ordertocook:refrigerator'&&fridges.length===1&&fridges[0].location.y===70,fridges.map(b=>b.location));
  const chairs=restaurantChairBlocks(dim,origin).map(b=>b.location);
  test('native chair search includes elevated horizontal edge',chairs.some(p=>p.x===24&&p.y===78&&p.z===0),chairs);
  test('native chair search excludes square corner and Y beyond eight',!chairs.some(p=>(p.x===20&&p.z===20)||p.y===79));
  for(const b of [boardFar,boardNear]){const s=getStation(b);s.menu=[{typeId:'minecraft:bread',nutrition:5,label:'Bread'}];saveStation(s);}
  const cornerMenu=getStation(boardCorner);cornerMenu.menu=[{typeId:'minecraft:apple',nutrition:100,label:'Out-of-range corner'}];saveStation(cornerMenu);
  const restaurant=hooks.getMachine({id:'poi-native-owner',name:'Native POI QA'},machine);
  restaurant.orders=[];
  test('native menu selection excludes the richer square corner and breaks ties by distance',restaurant.boardId===getStation(boardNear).id,restaurant.boardId);
  const order={id:'poi-native-order',restaurantId:restaurant.id,type:'dine_in',status:'accepted',walkIn:true,items:[{typeId:'minecraft:bread',amount:1}],expiresAt:Date.now()+60000};
  restaurant.orders.push(order);saveRestaurant(restaurant);
  // Only player proximity is synthetic; dimensions, POIs, entities and riding are native.
  const worldView={getDimension:id=>world.getDimension(id),getEntity:id=>world.getEntity(id),getAllPlayers:()=>[{dimension:dim,location:origin}]};
  const entities=createEntityService({world:worldView,system,getStation,saveStation,getRestaurant,restaurants,saveRestaurant,random:()=>0.999});
  const customer=entities.spawnCustomer(restaurant,order);
  const seat=customer&&entities.getCustomerSeat(customer);
  test('native rider uses Java random free-chair selection and preserved elevated geometry',seat?.location.x===24&&seat?.location.y===78,seat?.location);
  entities.cleanupOrder(order.id);
  shelfNear.setType('minecraft:air');await wait(2);
  test('native removal no longer returns a usable supply',nearbyStationBlocks(dim,origin,'ordertocook:shelf',5).every(b=>b.location.x!==2));
}
