// SPDX-License-Identifier: GPL-3.0-only
// Narrow real ItemStack/container save-restart check. No client or Player input.
import {world,system,ItemStack,BlockPermutation} from '@minecraft/server';
import {compactFridgeInventory} from './native_fridge.js';
const KEY='ordertocook:qa_fridge_compaction';
function snapshot(container) {
  return Array.from({length:container.size},(_,slot)=>{
    const stack=container.getItem(slot); if(!stack)return null;
    return {id:stack.typeId,amount:stack.amount,name:stack.nameTag,lore:stack.getLore(),
      properties:stack.getDynamicPropertyIds().sort().map(id=>[id,stack.getDynamicProperty(id)]),
      damage:stack.getComponent('minecraft:durability')?.damage,keep:stack.keepOnDeath};
  });
}
system.afterEvents.scriptEventReceive.subscribe(event=>{
 if(event.id!=='ordertocook:qa')return;
 const checks=[],check=(id,passed)=>{checks.push({id,passed});if(!passed)throw Error(id);};
 try {
  check('zero players',world.getAllPlayers().length===0);
  const dimension=world.getDimension('overworld'),a={x:0,y:4,z:0},b={x:0,y:5,z:0};
  const previous=world.getDynamicProperty(KEY);
  if(!previous){
   dimension.getBlock(a).setPermutation(BlockPermutation.resolve('ordertocook:refrigerator'));
   dimension.getBlock(b).setPermutation(BlockPermutation.resolve('ordertocook:refrigerator_upper'));
  }
  const lower=dimension.getBlock(a).getComponent('minecraft:inventory')?.container;
  const upper=dimension.getBlock(b).getComponent('minecraft:inventory')?.container;
  check('native 54 and 27 slot inventories',lower?.size===54&&upper?.size===27);
  if(previous){
   const saved=JSON.parse(previous);
   check('lower cargo restored exactly',JSON.stringify(snapshot(lower))===JSON.stringify(saved.lower));
   check('upper cargo restored exactly',JSON.stringify(snapshot(upper))===JSON.stringify(saved.upper));
   dimension.getBlock(a).setType('minecraft:air');dimension.getBlock(b).setType('minecraft:air');
   world.setDynamicProperty(KEY,undefined);
  }else{
   const apple=new ItemStack('minecraft:apple',40);apple.nameTag='same data';apple.setLore(['original']);
   const later=apple.clone();later.amount=30;
   const variant=new ItemStack('minecraft:apple',4);variant.nameTag='different data';
   const sword=new ItemStack('minecraft:diamond_sword');sword.nameTag='saved sword';sword.setLore(['native cargo']);
   sword.setDynamicProperty('example:proof','fridge');sword.keepOnDeath=true;
   sword.getComponent('minecraft:durability').damage=7;
   lower.setItem(3,apple);lower.setItem(7,new ItemStack('minecraft:bread',2));lower.setItem(9,later);
   lower.setItem(11,variant);lower.setItem(53,sword);upper.setItem(26,new ItemStack('minecraft:apple',8));
   const upperBefore=JSON.stringify(snapshot(upper));compactFridgeInventory(lower);
   const rows=snapshot(lower),cargo=rows.filter(Boolean);
   check('first-seen groups and native stack limit',JSON.stringify(cargo.map(row=>[row.id,row.amount,row.name]))===JSON.stringify([
    ['minecraft:apple',64,'same data'],['minecraft:apple',6,'same data'],['minecraft:bread',2,undefined],
    ['minecraft:apple',4,'different data'],['minecraft:diamond_sword',1,'saved sword']]));
   check('metadata and native durability preserved',rows[0].lore[0]==='original'&&rows[4].damage===7&&rows[4].keep===true&&rows[4].properties[0][1]==='fridge');
   check('other compartment unchanged',JSON.stringify(snapshot(upper))===upperBefore);
   const lowerBefore=JSON.stringify(snapshot(lower));compactFridgeInventory(upper);
   check('upper compacts independently',upper.getItem(0)?.amount===8&&!upper.getItem(26)&&JSON.stringify(snapshot(lower))===lowerBefore);
   compactFridgeInventory(lower);check('repeated compaction does not duplicate cargo',JSON.stringify(snapshot(lower))===lowerBefore);
   world.setDynamicProperty(KEY,JSON.stringify({lower:snapshot(lower),upper:snapshot(upper)}));
  }
 }catch(error){console.warn('OTC_NATIVE_FATAL '+String(error));if(checks.every(row=>row.passed))checks.push({id:String(error),passed:false});}
 console.warn('OTC_NATIVE_REPORT '+JSON.stringify({mode:event.message,passed:checks.every(row=>row.passed),checks}));
});
