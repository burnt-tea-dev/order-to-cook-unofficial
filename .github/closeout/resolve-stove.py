from pathlib import Path
import re
root=Path.cwd()
pat=re.compile(r'<<<<<<<[^\n]*\n(.*?)=======\n(.*?)>>>>>>>[^\n]*(?:\n|$)', re.S)
def resolve(file, fn):
 p=root/file;s=p.read_text();i=0
 def sub(m):
  nonlocal i
  out=fn(i,m[1],m[2]);i+=1;return out
 s=pat.sub(sub,s);p.write_text(s);print(file,i)
resolve('runtime/BP/scripts/appliances.js',lambda i,a,b: a+b if i==0 else (a+'  }\n\n  function stoveInputKeys(container) {\n'+b.split('  function stoveInputKeys(container) {\n',1)[1] if i==1 else a))
resolve('runtime/BP/scripts/main.js',lambda i,a,b: a+b if i==0 else a.split('    console.warn')[0]+b[:b.rindex('    console.warn')]+a[a.index('    console.warn'):])
resolve('tests/main.harness.js',lambda i,a,b:b)
resolve('docs/PARITY.md',lambda i,a,b:'\n'.join(a.rstrip().splitlines()[:2]+[b.rstrip().splitlines()[2]])+'\n' if i==0 else a.splitlines()[0]+'\n'+b.splitlines()[1]+'\n')
resolve('docs/RUNTIME_ADAPTATIONS.md',lambda i,a,b:b if i==0 else b[:b.index('爐灶操作仍是逐槽')]+a[a.index('手持支援'):])
texts={
'en_US':['Use an ingredient or fuel stack on the stove to deposit it directly. Three lanes share fuel and a 10-second batch; replacing or emptying input resets progress.','Interact empty-handed for all seven slots, direct withdrawal, collecting all outputs and refilling. A blocked output affects only its lane.','Nine vanilla smoking recipes and two installed Grilling recipes are built in. Suppliers can publish explicit smoking recipes; skewers, mixing and wok dishes stay at their own stations.'],
'zh_TW':['手持食材或燃料點爐灶直接存入；三路共用燃料與10秒進度，更換或取空食材會重置進度。','空手開單頁七槽控制，可取單槽、收全部成品或補料；某個成品槽塞滿不會阻止其他路。','內建九條原版與兩條已安裝煙火的煙燻配方，供應方可公告明確煙燻配方；烤串、調酒和鍋具料理仍使用原設備。'],
'zh_CN':['手持食材或燃料点击炉灶直接存入；三路共用燃料和10秒进度，更换或取空食材会重置进度。','空手打开单页七槽控制，可取单槽、收全部成品或补料；某个成品槽塞满不会阻止其他路。','内置九条原版和两条已安装烟火的烟熏配方，供应方可公告明确烟熏配方；烤串、调酒和锅具料理仍使用原设备。']}
for lang,lines in texts.items():resolve(f'runtime/RP/texts/{lang}.lang',lambda i,a,b,lines=lines:''.join(f'otc.guide.page.stove.step{j}={t}\n' for j,t in enumerate(lines,1)))
p=root/'runtime/BP/scripts/appliances.js';s=p.read_text().replace('  const stoveForms = new Map();\n','')
s=s.replace('isIngredient: stack => !!recipes[stack.typeId],','isIngredient: stack => !!recipeResult(stack),')
s=s.replace('getProgress: data,\n','getProgress: data,\n    onChange: (station, inventory) => {\n      const d = data(station), before = { inputKeys: d.inputKeys, cookProgress: d.cookProgress };\n      try { syncStoveInputs(station, inventory); ctx.saveStation(station); }\n      catch (error) { Object.assign(d, before); throw error; }\n    },\n')
s=s.replace('    return stoveControls.interact(player, station);','    const inventory = getStorage(station);\n    if (inventory && syncStoveInputs(station, inventory)) ctx.saveStation(station);\n    return stoveControls.interact(player, station);')
s=s.replace('      for (const [id, session] of stoveForms) if (session.station.id === station.id) stoveForms.delete(id);','      stoveControls.forgetStation(station.id);')
s=s.replace('    for (const [id, session] of stoveForms) if (!accessible(session.player, session.station)) stoveForms.delete(id);','    stoveControls.forgetInaccessible();')
p.write_text(s)
p=root/'runtime/BP/scripts/stove_controls.js';s=p.read_text();s=s.replace('    const session = {};','    const session = { player, station };')
pos=s.index('  async function interact(')
s=s[:pos]+'''  // Keep direct controls and cooking-state persistence in the same synchronous
  // transaction. A save failure restores both native inventories and lets the
  // cooking owner restore its input fingerprint/progress, without another store.
  function commitChange(station, stove, inventory, transfer) {
    const beforeStove = snapshot(stove, ALL_SLOTS);
    const beforePlayer = snapshot(inventory, slotsOf(inventory));
    try {
      const result = transfer();
      if (result.ok) ctx.onChange?.(station, stove);
      return result;
    } catch (error) {
      for (const entry of beforeStove) stove.setItem(entry.slot, entry.stack);
      for (const entry of beforePlayer) inventory.setItem(entry.slot, entry.stack);
      throw error;
    }
  }

'''+s[pos:]
s=s.replace('const result = ctx.transferStackToRange(initialInventory, player.selectedSlotIndex, initialStove, targetSlots, held);','const result = commitChange(station, initialStove, initialInventory, () =>\n          ctx.transferStackToRange(initialInventory, player.selectedSlotIndex, initialStove, targetSlots, held));')
s=s.replace('ctx.notify(player, ctx.transferStackToRange(liveStove, selected, liveInventory, undefined, entry.stack).message);','ctx.notify(player, commitChange(station, liveStove, liveInventory, () =>\n            ctx.transferStackToRange(liveStove, selected, liveInventory, undefined, entry.stack)).message);')
s=s.replace('ctx.notify(player, moveBatch(liveStove, liveInventory, outputs.filter(entry => entry.stack), slotsOf(liveInventory)).message);','ctx.notify(player, commitChange(station, liveStove, liveInventory, () =>\n            moveBatch(liveStove, liveInventory, outputs.filter(entry => entry.stack), slotsOf(liveInventory))).message);')
s=s.replace('ctx.notify(player, moveBatch(liveInventory, liveStove, refill, [0, 1, 2, 3]).message);','ctx.notify(player, commitChange(station, liveStove, liveInventory, () =>\n            moveBatch(liveInventory, liveStove, refill, [0, 1, 2, 3])).message);')
s=s.replace('  return { interact, forgetPlayer: playerId => sessions.delete(playerId) };','''  return {
    interact,
    forgetPlayer: playerId => sessions.delete(playerId),
    forgetStation: stationId => {
      for (const [id, session] of sessions) if (session.station.id === stationId) sessions.delete(id);
    },
    forgetInaccessible: () => {
      for (const [id, session] of sessions) {
        if (!session.player.isValid || !ctx.isAccessible(session.player, session.station)) sessions.delete(id);
      }
    },
  };''')
p.write_text(s)
