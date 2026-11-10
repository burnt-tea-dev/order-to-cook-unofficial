// SPDX-License-Identifier: GPL-3.0-only
// Bedrock adapter. World state, inventory and UI stay outside the pure order core.
import { world, system, ItemStack, ItemTypes, BlockPermutation, GameMode, MolangVariableMap } from '@minecraft/server';
import {
  createRestaurant, refreshOrders, acceptOrder, packOrder, completeOrder,
  cancelOrder, expireOrders, upgradeRestaurant, getUpgradeQuote,
  getMenuNutrition, getNearbyBoardNutrition, addMenuFood, removeMenuFood, generateWalkInOrder,
  getWalkInChance, synchronizeOfferRewards, normalizeFoodId, normalizeMenu,
  orderRemainingMs, adoptOrderDeadline, orderCarrier
} from './core.js';
import { VANILLA_FOODS, DEFAULT_MENU, DEFAULT_CONFIG, TIER_LABELS, TIER_COLORS } from './config.js';
import {
  initStore, locationId, getRestaurant, restaurants, saveRestaurant, deleteRestaurant, getProfile, saveProfile,
  getStation, getStationById, findStation, stations, saveStation, deleteStation,
  nearbyStations, nearestRestaurant, hasMachinePlacementConflict, loadedBlock, distanceSquared, setBlockState
} from './store.js';
import {
  containerOf, heldItem, freeSlot, countItem, planExtraction, applyExtraction,
  restoreExtraction, consumeHeld, giveStack, giveItems, coinBalance, giveCoins, payCoins
} from './inventory.js';
import { inspectSenluoFood, matchesSenluoFoodSnapshot, snapshotMenuFood, menuFoodKey, menuFoodsOverlap, menuFoodLabel } from './senluo_food.js';
import { createFoodCatalog, connectFoodCatalog } from './food_catalog.js';
import { guideBookScreen } from './guide_book.js';
import { notify, choose, textInput, safely } from './ui.js';
import { createEntityService } from './entities.js';
import { createApplianceService } from './appliances.js';
import { isFridge, isUpperFridge } from './native_fridge.js';
import { createSmokingRecipeRegistry } from './smoking_recipes.js';
import { createDiningService, DINING_ENTITY, DINING_BLOCK } from './dining.js';
import { progressRows } from './progression.js';
import { createProgressionService, creditBonusEarnings, creditCompletedOrder, queueProgressEvent } from './progression_service.js';
import { playEffects, playbackVolume, plateSound, freshMealEffects, newOrderEffects } from './audiovisual.js';
import { writePortableBlock, readPortableBlock } from './portable_blocks.js';
import { createMachineTiming } from './machine_timing.js';
import { defaultRestaurantName, restaurantNameIsDefault, sanitizeRestaurantName } from './restaurant_name.js';
import { tickCarriedOrderAlerts, alertCustomerName, ITEM_CUSTOMER_NAME } from './carried_order_alerts.js';

const PREFIX = 'ordertocook:';
const ITEM_RESTAURANT = 'ordertocook:restaurant';
const ITEM_ORDER = 'ordertocook:order_id';
const ITEM_PROOF = 'ordertocook:proof';
const ITEM_EXPIRY = 'ordertocook:expires_at';
const ITEM_EXPIRY_TICK = 'ordertocook:expires_tick';
const PARCEL_USE_HINT = '使用查看詳情；蹲下點擊方塊頂面可擺放';
function orderTime() { return { wall: Date.now(), tick: system.currentTick }; }
const pendingPlacements = new Map();
const liveStatus = new Set(['offered', 'accepted', 'packed']);
const foods = new Map(VANILLA_FOODS.map(food => [food.typeId, food]));
const foodOverrides = new Map();
const foodCatalog = createFoodCatalog();
const requestFoodCatalogs = connectFoodCatalog(system, foodCatalog);
const weatherByDimension = new Map();
let settings = { deliveryRate: Number(DEFAULT_CONFIG.deliveryRate), maxOrderMachinesWithin24: Number(DEFAULT_CONFIG.maxOrderMachinesWithin24), countertopConsumeLeather: DEFAULT_CONFIG.countertopConsumeLeather, currencyItem: '', refreshMs: Number(DEFAULT_CONFIG.refreshMs), orderMachineUpgradeBoardHunger: [...DEFAULT_CONFIG.orderMachineUpgradeBoardHunger] };
let ready = false;
/** @type {any} */ let entities;
/** @type {any} */ let appliances;
/** @type {any} */ let dining;
/** @type {any} */ let progression;
/** @type {any} */ let machineTiming;
const activeHudPlayers = new Set();
const interactionTicks = new Map();
// Cosmetic playback only: the restaurant/order store remains authoritative.
// Java raises the paper for 20 ticks, then holds it through a 45-tick PRINTING state.
const printerStarts = new Map();
const blockNames = {
  order_machine: '打單機', board: '菜單立牌', countertop: '操作台', shelf: '包裝架',
  plate_shelf: '餐盤架', washingtable: '洗碗池', chair: '椅子', dishwasher: '洗碗機',
  refrigerator: '冰箱', stove: '爐灶', motorcycle: '小電驢', otc_upgrade_box: 'oTc 升級工具箱',
  clean_plate: '乾淨餐盤', guide: '餐廳指南', controller: '小電驢遙控器'
};
const SHOP = [
  ['chair', 2], ['board', 2], ['countertop', 3], ['shelf', 3], ['plate_shelf', 3],
  ['washingtable', 5], ['clean_plate', 1], ['otc_upgrade_box', 20], ['motorcycle', 100], ['controller', 1]
];

// Java declares this setting as int and clamps its effective value to at least one.
function isMachineLimit(value) { return Number.isInteger(value) && value >= -2147483648 && value <= 2147483647; }
function isDeliveryRate(value) { return Number.isFinite(value) && value >= 0 && value <= 1; }
function isAdmin(player) { return player?.hasTag('otc_admin') || player?.getGameMode() === GameMode.Creative; }
function canManage(player, restaurant) {
  return !!restaurant && !restaurant.removing && (restaurant.ownerId === player.id || restaurant.staff?.includes(player.id) || isAdmin(player));
}
function nearBlock(player, block, radius = 8) {
  return player?.isValid && block?.isValid && player.dimension.id === block.dimension.id && distanceSquared(player.location, block.location) <= radius * radius;
}
function validRestaurant(player, restaurant, block) {
  return nearBlock(player, block) && block.typeId === 'ordertocook:order_machine' && getRestaurant(restaurant.id) === restaurant && canManage(player, restaurant);
}
function canUseStation(player, value) {
  if (!player?.isValid) return false;
  const block = value.dimension ? value : loadedBlock(value);
  if (!block?.isValid) return false;
  const station = findStation(block) || value;
  const restaurant = nearestRestaurant(block);
  if (restaurant) return canManage(player, restaurant);
  return !station.ownerId || station.ownerId === player.id || isAdmin(player);
}
function validStationAction(player, block, station) {
  return nearBlock(player, block) && findStation(block) === station && block.typeId === station.typeId && canUseStation(player, station);
}
function playAt(block, sound, volume = 1, pitch = 1) {
  const location = { x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5 };
  try { block.dimension.playSound(`ordertocook:${sound}`, location, { volume: playbackVolume(volume), pitch }); } catch { /* Cosmetic only. */ }
}
function beginBagPlacement(block) {
  if (block?.typeId !== 'ordertocook:takeout_bag') return;
  // Java's placed Geo renderer plays maked once for 0.5 seconds. Frame zero
  // is the held final pose; frames 1..10 sample 0..0.45 seconds at 20 TPS.
  try { block.setPermutation(block.permutation.withState('ordertocook:frame', 1)); }
  catch { /* Cosmetic state must not roll back a committed parcel. */ }
}
function tickBagPlacement(block) {
  if (!ready || !block?.isValid || block.typeId !== 'ordertocook:takeout_bag') return;
  try {
    const frame = Number(block.permutation.getState('ordertocook:frame'));
    if (Number.isInteger(frame) && frame > 0 && frame <= 10) {
      block.setPermutation(block.permutation.withState('ordertocook:frame', frame === 10 ? 0 : frame + 1));
    }
  } catch { /* An unloaded/replaced visual block has no transaction to undo. */ }
  // Native ticks exist only for frame > 0. Reloading midway finishes the
  // remaining poses; settled bags have no callback and never restart.
}
function syncPrinter(restaurant, block = loadedBlock(restaurant)) {
  if (block?.typeId !== 'ordertocook:order_machine') return;
  const pending = !restaurant.removing && restaurant.orders.some(order => order.status === 'offered' && !order.walkIn);
  const started = printerStarts.get(restaurant.id);
  const elapsed = started === undefined ? 45 : Math.max(0, system.currentTick - started);
  const printing = pending && elapsed < 45;
  if (!printing) printerStarts.delete(restaurant.id);
  const mode = !pending ? 'idle' : printing ? 'printing' : 'waiting';
  const frame = printing ? Math.min(15, Math.floor(elapsed * 15 / 20)) : 0;
  try {
    // Stable API typings enumerate vanilla state keys only; these custom keys
    // are declared in our block JSON and checked by the native probe.
    /** @type {any} */ const permutation = block.permutation;
    if (permutation.getState('ordertocook:mode') !== mode || permutation.getState('ordertocook:frame') !== frame) {
      block.setPermutation(permutation.withState('ordertocook:mode', mode).withState('ordertocook:frame', frame));
    }
  } catch { /* A cosmetic permutation must never undo a valid order transaction. */ }
}
function refreshMachineOrders(restaurant, block = loadedBlock(restaurant), now = orderTime()) {
  // Rollback replaces the canonical object. Never adopt a stale caller or save
  // its orders just to repair a config snapshot. All machine generation entries
  // pass here; the confirmed global rate wins even after partial propagation or
  // reload. The caller commits this config with the generated offers.
  if (getRestaurant(restaurant.id) !== restaurant) throw new Error('Stale machine restaurant; canonical refresh required');
  restaurant.config = { ...restaurant.config, deliveryRate: settings.deliveryRate };
  const unavailable = new Set();
  const result = refreshOrders(restaurant, now, Math.random, candidate => {
    const resolved = entities.resolveDeliveryDestination(restaurant, candidate);
    if (!resolved.destination) unavailable.add(resolved.status);
    return resolved.destination;
  });
  // An unavailable destination consumes this refresh interval, not an order ID.
  // Retrying on each native tick would scan the same unloaded terrain again.
  machineTiming.refreshed(restaurant);
  if (result.orders.length) printerStarts.set(restaurant.id, system.currentTick);
  else printerStarts.delete(restaurant.id);
  if (block?.typeId === 'ordertocook:order_machine') {
    if (result.orders.length) playEffects(block.dimension, newOrderEffects(block.location), MolangVariableMap);
    syncPrinter(restaurant, block);
  }
  return { ...result, deliveryReason: unavailable.has('unloaded') ? 'unloaded' : unavailable.has('water') ? 'water' : 'blocked' };
}
function deliveryDelayText(reason) {
  const detail = reason === 'unloaded' ? '候選目的地尚未載入，無法確認安全地面'
    : reason === 'water' ? '候選目的地在水面，未找到可站立陸地' : '候選目的地沒有安全站立空間';
  return `這輪未產生新單：${detail}；外送單已延後，將在下一輪刷新再試。`;
}
function tickPrinters() {
  if (!ready) return;
  for (const [id, started] of printerStarts) {
    const restaurant = getRestaurant(id);
    if (!restaurant || restaurant.removing) { printerStarts.delete(id); continue; }
    syncPrinter(restaurant);
    // Do not retain unloaded machines forever or restart their paper on reload.
    if (system.currentTick - started >= 45) printerStarts.delete(id);
  }
}
function foodFromStack(stack) {
  if (!stack) return undefined;
  const typeId = normalizeFoodId(stack.typeId);
  const configured = foodOverrides.get(typeId);
  if (configured) return snapshotMenuFood(stack, configured);
  const supplied = foodCatalog.resolve(stack);
  if (supplied.known) return supplied.food;
  const vanilla = foods.get(typeId);
  if (vanilla) return snapshotMenuFood(stack, vanilla);
  try {
    const component = stack.getComponent('minecraft:food');
    if (Number.isFinite(component?.nutrition) && component.nutrition >= 1) return snapshotMenuFood(stack, { typeId, nutrition: Math.min(10000, Math.floor(component.nutrition)), label: stack.nameTag || typeId });
  } catch { /* Vanilla food properties are supplied by the pinned catalog. */ }
  return undefined;
}
function foodLabel(typeId) { return foodOverrides.get(typeId)?.label || foodCatalog.labelFor(typeId) || foods.get(typeId)?.label || typeId; }
class UnavailableMenuBoardError extends Error {}
function syncMenu(restaurant) {
  const eligible = station => station?.typeId === 'ordertocook:board' && station.dimensionId === restaurant.dimensionId &&
    (!station.ownerId || station.ownerId === restaurant.ownerId || restaurant.staff?.includes(station.ownerId)) &&
    (station.location.x - restaurant.location.x) ** 2 + (station.location.z - restaurant.location.z) ** 2 <= 24 * 24 && Math.abs(station.location.y - restaurant.location.y) <= 8;
  // A missing chunk is not evidence that a saved board was removed. Defer both
  // rebinding and dependent actions until this eligible binding can be checked.
  const bound = restaurant.boardId ? getStationById(restaurant.boardId) : undefined;
  const boundBlock = eligible(bound) ? loadedBlock(bound) : undefined;
  if (eligible(bound) && !boundBlock) throw new UnavailableMenuBoardError('Bound menu board chunk is unavailable; defer menu synchronization');
  const candidates = stations().filter(station => eligible(station) &&
    (station === bound ? boundBlock : loadedBlock(station))?.typeId === station.typeId);
  // Java scans x, z, then y. Distance breaks equal nutrition; exact ties retain
  // that coordinate order instead of depending on Bedrock registration history.
  candidates.sort((a, b) => getMenuNutrition(b.menu) - getMenuNutrition(a.menu) ||
    distanceSquared(a.location, restaurant.location) - distanceSquared(b.location, restaurant.location) ||
    a.location.x - b.location.x || a.location.z - b.location.z || a.location.y - b.location.y);
  // A valid existing binding supplies dishes even if a richer board appears.
  // Upgrade eligibility and benefit use a separate highest-single-board value.
  const selected = boundBlock?.typeId === 'ordertocook:board' ? bound : candidates[0];
  // Registration is a snapshot. Catalog/override reloads affect new entries only.
  // Detect menu identity and reward-only changes so every caller can commit them,
  // including idle machines and forms that return without generating an order.
  const oldMenu = JSON.stringify(restaurant.menu);
  const oldBoardId = restaurant.boardId || '';
  const oldNearbyNutrition = restaurant.nearbyBoardNutrition;
  const offered = restaurant.orders.filter(order => order.status === 'offered')
    .map(order => [order, order.reward, order.benefitLevel]);
  restaurant.menu = normalizeMenu(selected?.menu || []);
  restaurant.boardId = selected?.id || '';
  restaurant.nearbyBoardNutrition = getMenuNutrition(candidates[0]?.menu || []);
  synchronizeOfferRewards(restaurant);
  return oldBoardId !== restaurant.boardId || oldMenu !== JSON.stringify(restaurant.menu) ||
    oldNearbyNutrition !== restaurant.nearbyBoardNutrition ||
    offered.some(([order, reward, benefit]) => order.reward !== reward || order.benefitLevel !== benefit);
}
function getMachine(player, block, placedByPlayer = false) {
  const id = locationId(block.dimension.id, block.location);
  let restaurant = getRestaurant(id);
  if (restaurant?.removing) return restaurant;
  if (!restaurant) {
    restaurant = createRestaurant({ id, name: defaultRestaurantName(player.name), ownerId: player.id, ownerName: player.name, dimensionId: block.dimension.id, location: block.location, menu: [], config: { deliveryRate: settings.deliveryRate, refreshMs: settings.refreshMs, orderMachineUpgradeBoardHunger: settings.orderMachineUpgradeBoardHunger } });
    restaurant.nameIsDefault = true;
    restaurant.staff = [];
    restaurant.pendingDishes = [];
    machineTiming.adopt(restaurant, orderTime());
    if (placedByPlayer) queueProgressEvent(restaurant, player.id, { type: 'order_machine_placed' });
    saveRestaurant(restaurant);
  } else if (placedByPlayer) {
    queueProgressEvent(restaurant, player.id, { type: 'order_machine_placed' });
    saveRestaurant(restaurant);
  }
  if (placedByPlayer) reconcileProgress(restaurant);
  if (syncMenu(restaurant)) saveRestaurant(restaurant);
  return restaurant;
}
function balance(player) { return settings.currencyItem ? countItem([containerOf(player)], settings.currencyItem) : coinBalance(player); }
/** @param {{ actions: any[] }} [receipt] */
function pay(player, value, receipt) {
  if (!settings.currencyItem) return payCoins(player, value, receipt);
  const plan = planExtraction([containerOf(player)], [{ typeId: settings.currencyItem, amount: value }]);
  const paid = applyExtraction(plan);
  if (paid && receipt) receipt.actions.push(...plan.actions);
  return paid;
}
function reward(player, value) {
  if (settings.currencyItem) giveItems(player, settings.currencyItem, value); else giveCoins(player, value);
}
function currencyLabel() { return settings.currencyItem || 'oTc 幣'; }
function orderHeading(order) {
  return `${TIER_COLORS[order.tier] || '§f'}${TIER_LABELS[order.tier] || '訂單'}§r ${order.walkIn ? '到店' : order.type === 'delivery' ? (order.longDistance ? '遠距外送' : '外送') : '堂食'}${order.rush ? ' §c加急§r' : ''}`;
}
function orderBody(order) {
  const minutes = Math.ceil(orderRemainingMs(order, orderTime()) / 60000);
  const destination = order.destination ? `\n目的地：${order.destination.x}, ${order.destination.y}, ${order.destination.z}（${order.destination.distance} 格）` : '';
  return `${orderHeading(order)}\n${order.items.map(item => `${menuFoodLabel(item, foodLabel(item.typeId))} ×${item.amount}`).join('\n')}\n報酬：${order.reward} ${currencyLabel()} + 可能的小費\n剩餘：${minutes} 分鐘${destination}`;
}
function reasonText(reason) {
  return ({ expired: '訂單已逾時。', already_completed: '這張訂單已交付，不能再次領款。', already_packed: '已經打包／裝盤，請取走原本的成品。', already_accepted: '訂單已被接取。', not_found: '找不到這張訂單。', menu_nutrition: '菜單總營養值不足。', max_level: '已達最高等級。', already_cancelled: '這張訂單已取消。' })[reason] || `目前不能執行：${reason}`;
}
function parcelType(order) {
  const carrier = orderCarrier(order);
  return carrier === 'bag' ? 'ordertocook:takeout_bag' : carrier === 'plate' ? 'ordertocook:food_plate' : undefined;
}
function parcelDisplayType(order) {
  const type = parcelType(order);
  return type === 'ordertocook:food_plate' ? 'ordertocook:food_plate_display' : type;
}
function destinationLore(order) {
  return order.destination ? `目的地 X:${order.destination.x} Z:${order.destination.z}` : undefined;
}
function parcelFor(restaurant, order, typeId) {
  const carrierType = typeId || parcelType(order);
  if (!carrierType) throw new Error('餐點承載物資料無效。');
  const stack = new ItemStack(carrierType);
  stack.nameTag = typeId === 'ordertocook:order' ? `訂單 · ${restaurant.name}` : `${order.type === 'delivery' ? '外送包裹' : stack.typeId === 'ordertocook:takeout_bag' ? '打包餐點' : '已裝盤餐點'} · ${restaurant.name}`;
  stack.setDynamicProperty(ITEM_RESTAURANT, restaurant.id);
  stack.setDynamicProperty(ITEM_ORDER, order.id);
  if (order.proof) stack.setDynamicProperty(ITEM_PROOF, order.proof);
  if (['ordertocook:order', 'ordertocook:takeout_bag'].includes(stack.typeId)) {
    const name = alertCustomerName(order.customerName);
    if (name) stack.setDynamicProperty(ITEM_CUSTOMER_NAME, name);
  }
  if (stack.typeId === 'ordertocook:takeout_bag') stack.setDynamicProperty(ITEM_EXPIRY, order.expiresAt);
  if (order.expiresTick !== undefined) stack.setDynamicProperty(ITEM_EXPIRY_TICK, order.expiresTick);
  stack.setLore([orderHeading(order), ...order.items.map(item => `${menuFoodLabel(item, foodLabel(item.typeId))} ×${item.amount}`), `報酬 ${order.reward} · 期限見訂單詳情`, ...(order.destination ? [destinationLore(order)] : []), PARCEL_USE_HINT]);
  return stack;
}
function itemOrder(stack) {
  if (!stack || !['ordertocook:order', 'ordertocook:takeout_bag', 'ordertocook:food_plate'].includes(stack.typeId)) return undefined;
  const restaurant = getRestaurant(stack.getDynamicProperty(ITEM_RESTAURANT));
  const order = restaurant?.orders.find(entry => entry.id === stack.getDynamicProperty(ITEM_ORDER));
  if (!restaurant || !order) return undefined;
  return { restaurant, order, proof: stack.getDynamicProperty(ITEM_PROOF) };
}
function removeTickets(player, orderId) {
  const container = containerOf(player);
  if (!container) return;
  for (let slot = 0; slot < container.size; slot++) {
    const stack = container.getItem(slot);
    if (stack?.typeId === 'ordertocook:order' && stack.getDynamicProperty(ITEM_ORDER) === orderId) container.setItem(slot, undefined);
  }
}

async function machineForm(player, block) {
  const restaurant = getMachine(player, block);
  if (restaurant.removing) { notify(player, '原餐廳正在收回餐盤或保存個人進度；請載入原桌面並等候清理完成，再開店。'); return; }
  if (!canManage(player, restaurant)) { notify(player, `這間餐廳由 ${restaurant.ownerName} 經營；店主可在「設定」加入員工。`); return; }
  expireOrders(restaurant, orderTime());
  saveRestaurant(restaurant);
  const available = restaurant.orders.filter(order => order.status === 'offered');
  const working = restaurant.orders.filter(order => ['accepted', 'packed'].includes(order.status));
  const next = Math.ceil(machineTiming.remaining(restaurant) / 20);
  const selection = await choose(player, `${restaurant.name} · Lv.${restaurant.level}`,
    `${restaurant.active ? '§a營業中' : '§7休息中'}§r\n菜單 ${restaurant.menu.length} 道 · 總營養 ${getMenuNutrition(restaurant)} · 附近單牌最高 ${getNearbyBoardNutrition(restaurant)}\n完成 ${restaurant.stats.completed} 單 · 總營業額 ${restaurant.stats.earnings}\n候選 ${available.length} 單 · 處理中 ${working.length} 單\n下次刷新 ${next} 秒 · 隨身餘額 ${balance(player)} ${currencyLabel()}`,
    [restaurant.active ? '暫停接新單' : '開始營業', `候選訂單（${available.length}）`, `處理中的訂單（${working.length}）`, '升級餐廳', '設備商店', '餐廳排行榜', '餐廳設定／員工', '個人進度', '玩法指南']);
  if (selection === undefined || !validRestaurant(player, restaurant, block)) return;
  if (selection === 0) {
    if (!restaurant.active && !restaurant.menu.length) { notify(player, '先在 24 格內放菜單立牌，用食品點擊立牌新增菜式。'); return; }
    restaurant.active = !restaurant.active;
    let refreshed;
    // Opening a brand new restaurant starts its first round; toggling does not reroll.
    if (restaurant.active && restaurant.orderSequence === 0) {
      refreshed = refreshMachineOrders(restaurant, block);
    }
    saveRestaurant(restaurant);
    notify(player, restaurant.active ? `開始營業；打單機每 ${Math.ceil((restaurant.config?.refreshMs ?? DEFAULT_CONFIG.refreshMs) / 1000)} 秒運作時間刷新候選單，暫停或區域未載入時停計。${refreshed && !refreshed.orders.length ? `\n${deliveryDelayText(refreshed.deliveryReason)}` : ''}` : '已暫停新單，已接訂單仍需按時完成。');
  } else if (selection === 1) await orderList(player, block, restaurant, 'offered');
  else if (selection === 2) await orderList(player, block, restaurant, 'working');
  else if (selection === 3) await upgradeForm(player, block, restaurant);
  else if (selection === 4) await shopForm(player, block, restaurant);
  else if (selection === 5) await leaderboardForm(player);
  else if (selection === 6) await settingsForm(player, block, restaurant);
  else if (selection === 7) await progressForm(player);
  else await guideForm(player);
}

async function orderList(player, block, restaurant, kind) {
  const choices = restaurant.orders.filter(order => kind === 'offered' ? order.status === 'offered' : ['accepted', 'packed'].includes(order.status));
  if (!choices.length) { notify(player, kind === 'offered' ? '目前沒有候選單；等待下一輪刷新。' : '目前沒有處理中的訂單。'); return; }
  const selected = await choose(player, kind === 'offered' ? '候選訂單' : '處理中的訂單', '接取打單機的一張候選單後，同輪其他候選會消失。', choices.map(order => `${orderHeading(order)}\n${order.reward} 幣 · ${order.status === 'packed' ? '已備妥' : order.items.length + ' 道菜'}`));
  if (selected === undefined || !validRestaurant(player, restaurant, block)) return;
  const order = choices[selected];
  if (kind === 'offered') {
    const accepted = await choose(player, '訂單詳情', orderBody(order), ['接單', '返回']);
    if (accepted !== 0 || !validRestaurant(player, restaurant, block)) return;
    acceptWithTicket(player, restaurant, order);
  } else {
    const action = await choose(player, '訂單詳情', orderBody(order) + `\n狀態：${order.status === 'packed' ? '已備妥，請拿成品交給顧客' : '已接取，請到操作台處理'}`, ['補印訂單／查看目的地', '取消訂單', '返回']);
    if (action === undefined || !validRestaurant(player, restaurant, block)) return;
    if (action === 0 && liveStatus.has(order.status)) {
      const slot = freeSlot(containerOf(player));
      if (slot < 0) { notify(player, '請空出一格背包。'); return; }
      removeTickets(player, order.id);
      giveStack(player, parcelFor(restaurant, order, 'ordertocook:order'));
    } else if (action === 1) {
      const confirm = await choose(player, '取消訂單', '已消耗的食品與包材不會退回；此單會計入失敗統計。', ['保留訂單', '確認取消']);
      if (confirm !== 1 || !validRestaurant(player, restaurant, block)) return;
      const result = cancelOrder(restaurant, order.id, orderTime());
      saveRestaurant(restaurant);
      if (result.ok) { entities.cleanupOrder(order.id, true); removeTickets(player, order.id); notify(player, '訂單已取消。'); }
      else notify(player, reasonText(result.reason));
    }
  }
}

function acceptWithTicket(player, restaurant, order) {
  if (getRestaurant(restaurant.id) !== restaurant || !canManage(player, restaurant) || loadedBlock(restaurant)?.typeId !== 'ordertocook:order_machine') {
    notify(player, '餐廳狀態或權限已改變，請重新開啟打單機。'); return;
  }
  if (freeSlot(containerOf(player)) < 0) { notify(player, '請空出一格背包收取訂單。'); return; }
  // Ordinary machine diners can use the upstream standing fallback. Only
  // independently arriving walk-ins require a restaurant chair to accept.
  if (order.walkIn && order.type === 'dine_in' && !nearbyStations(restaurant.dimensionId, restaurant.location, 24, 'ordertocook:chair', { shape: 'cylinder', halfHeight: 8 }).length) {
    notify(player, '到店顧客需要餐廳水平 24 格、高低 8 格內有椅子。'); return;
  }
  const result = acceptOrder(restaurant, order.id, orderTime());
  saveRestaurant(restaurant);
  if (!result.ok) { notify(player, reasonText(result.reason)); return; }
  syncPrinter(restaurant);
  giveStack(player, parcelFor(restaurant, order, 'ordertocook:order'));
  const customer = entities.spawnCustomer(restaurant, order);
  if (order.walkIn && customer) playEffects(customer.dimension,
    [{ sound: 'random.orb', location: customer.location, volume: 1, pitch: 1 }], MolangVariableMap);
  notify(player, '已接單。準備好食品後，在附近操作台選擇裝盤／打包。');
}

async function upgradeForm(player, block, restaurant) {
  if (syncMenu(restaurant)) saveRestaurant(restaurant);
  const quote = getUpgradeQuote(restaurant);
  if (quote.reason === 'max_level') { notify(player, reasonText(quote.reason)); return; }
  const choice = await choose(player, `升級至 Lv.${quote.nextLevel}`, `費用 ${quote.cost} ${currencyLabel()}\n附近單牌營養要求 ${quote.requiredNutrition} · 範圍內最高 ${quote.currentNutrition}\n每種菜只按一份計算，堆疊數量不會增加菜單營養。`, ['升級', '返回']);
  if (choice !== 0 || !validRestaurant(player, restaurant, block)) return;
  if (syncMenu(restaurant)) saveRestaurant(restaurant);
  const current = getUpgradeQuote(restaurant);
  if (!current.ok) { notify(player, reasonText(current.reason)); return; }
  if (!pay(player, current.cost)) { notify(player, '貨幣不足，或背包放不下找零；請空出幾格。'); return; }
  try {
    const result = upgradeRestaurant(restaurant);
    if (!result.ok) { reward(player, current.cost); notify(player, reasonText(result.reason)); return; }
    if (restaurant.level === 8) queueProgressEvent(restaurant, player.id, { type: 'restaurant_upgraded', level: 8 });
    saveRestaurant(restaurant);
  } catch (error) {
    reward(player, current.cost);
    throw error;
  }
  playAt(block, 'order_refresh', 1, 1.2);
  notify(player, `餐廳已升至 Lv.${restaurant.level}。`);
  reconcileProgress(restaurant);
}

async function shopForm(player, block, restaurant) {
  const selection = await choose(player, '設備商店', `隨身餘額：${balance(player)} ${currencyLabel()}\n基岩版提供基本设备合成及此商店作為取得途徑。`, SHOP.map(([id, price]) => `${blockNames[id] || id}\n${price} ${currencyLabel()}`));
  if (selection === undefined || !validRestaurant(player, restaurant, block)) return;
  const [id, price] = SHOP[selection];
  if (!pay(player, price)) { notify(player, '貨幣不足，或背包放不下找零；請空出幾格。'); return; }
  giveItems(player, `${PREFIX}${id}`, 1);
  notify(player, `已購入 ${blockNames[id] || id}。`);
}

async function settingsForm(player, block, restaurant) {
  const selection = await choose(player, '餐廳設定', `店主 ${restaurant.ownerName}\n員工 ${restaurant.staff?.length || 0} 人\n拆除後的打單機物品會保留名稱、店主、員工、等級與統計；放置後保持暫停營業，訂單不會搬移。`, ['更改餐廳名稱', '加入在線員工', '移除員工', '返回']);
  if (selection === undefined || !validRestaurant(player, restaurant, block)) return;
  if ((selection === 1 || selection === 2) && restaurant.ownerId !== player.id && !isAdmin(player)) { notify(player, '只有店主可以加入或移除員工。'); return; }
  if (selection === 0) {
    if (restaurant.ownerId !== player.id && !isAdmin(player)) { notify(player, '只有店主可以更改餐廳名稱。'); return; }
    await renameForm(player, block, restaurant);
  } else if (selection === 1) {
    const players = world.getAllPlayers().filter(other => other.id !== restaurant.ownerId && !restaurant.staff?.includes(other.id));
    if (!players.length) { notify(player, '沒有可加入的在線玩家。'); return; }
    const index = await choose(player, '加入員工', '員工可共同接單、管理菜單及廚房。', players.map(other => other.name));
    if (index !== undefined && validRestaurant(player, restaurant, block) && (restaurant.ownerId === player.id || isAdmin(player))) { restaurant.staff ||= []; if (!restaurant.staff.includes(players[index].id)) restaurant.staff.push(players[index].id); saveRestaurant(restaurant); }
  } else if (selection === 2) {
    const ids = restaurant.staff || [];
    if (!ids.length) return;
    const index = await choose(player, '移除員工', '', ids.map(id => world.getAllPlayers().find(p => p.id === id)?.name || id));
    if (index !== undefined && validRestaurant(player, restaurant, block) && (restaurant.ownerId === player.id || isAdmin(player))) { restaurant.staff = (restaurant.staff || []).filter(id => id !== ids[index]); saveRestaurant(restaurant); }
  }
}

async function renameForm(player, block, restaurant) {
  const valid = () => validRestaurant(player, restaurant, block) &&
    locationId(block.dimension.id, block.location) === restaurant.id &&
    (restaurant.ownerId === player.id || isAdmin(player));
  if (!valid()) return;
  const quote = { name: restaurant.name, marker: restaurant.nameIsDefault,
    ownerId: restaurant.ownerId, ownerName: restaurant.ownerName,
    currencyItem: settings.currencyItem, cost: restaurantNameIsDefault(restaurant) ? 0 : 1 };
  const value = await textInput(player, '餐廳名稱',
    `最多 32 字；留空清除自訂名稱。\n本次${quote.cost ? `費用 1 ${currencyLabel()}` : '免費'}；目前有自訂名稱時，確認相同名稱或清除也會收費。`, restaurant.name);
  if (value === undefined) return;
  if (!valid() || restaurant.name !== quote.name || restaurant.nameIsDefault !== quote.marker ||
      restaurant.ownerId !== quote.ownerId || restaurant.ownerName !== quote.ownerName ||
      settings.currencyItem !== quote.currencyItem || (restaurantNameIsDefault(restaurant) ? 0 : 1) !== quote.cost) {
    notify(player, '餐廳狀態、權限或貨幣已改變，沒有收費；請重新開啟設定。'); return;
  }
  const name = sanitizeRestaurantName(value);
  if (name === undefined) { notify(player, '餐廳名稱資料無效，沒有收費。'); return; }
  // No await between validation, payment and canonical save. Receipts retain
  // complete native ItemStacks, not reconstructed denominations or item JSON.
  const receipt = { actions: [] };
  if (quote.cost && !pay(player, quote.cost, receipt)) {
    notify(player, '貨幣不足，或背包放不下找零；請空出幾格。'); return;
  }
  try {
    restaurant.name = name || defaultRestaurantName(restaurant.ownerName);
    restaurant.nameIsDefault = name === '';
    saveRestaurant(restaurant);
  } catch (error) {
    // saveRestaurant restores its canonical snapshot. Never save the detached
    // failed object again. Native inventory + world records are not atomic.
    for (const action of receipt.actions.reverse()) {
      try { restoreExtraction({ actions: [action] }); }
      catch (rollbackError) { console.warn(`[OrderToCook] Rename payment rollback failed: ${rollbackError}`); }
    }
    throw error;
  }
  notify(player, `餐廳名稱已${name ? '更新' : '清除'}。`);
}

async function leaderboardForm(player) {
  const ranking = restaurants().sort((a, b) => b.stats.earnings - a.stats.earnings).slice(0, 20);
  await choose(player, '餐廳排行榜', ranking.length ? ranking.map((restaurant, index) => `${index + 1}. ${restaurant.name} · Lv.${restaurant.level}\n收益 ${restaurant.stats.earnings} · 完成 ${restaurant.stats.completed} · 外送 ${restaurant.stats.delivery} · 遠距 ${restaurant.stats.longDistance}`).join('\n\n') : '還沒有餐廳。', ['關閉']);
}

async function boardForm(player, block) {
  const station = getStation(block);
  if (!station.initialized) { station.menu = DEFAULT_MENU.map(food => ({ ...food })); station.initialized = true; saveStation(station); }
  const currentFood = foodFromStack(heldItem(player));
  if (currentFood && !player.isSneaking) {
    const result = addMenuFood(station, currentFood);
    saveStation(station);
    notify(player, result.ok ? `已加入 ${menuFoodLabel(currentFood)}，不消耗手中物品。菜單總營養 ${getMenuNutrition(station.menu)}。` : result.reason === 'duplicate_food' ? '菜單已有這道菜或同 ID 的通用菜品；要改用指定變體，請先移除通用菜品。' : reasonText(result.reason));
    return;
  }
  const selection = await choose(player, '菜單立牌', `${station.menu.length}/150 道菜 · 總營養 ${getMenuNutrition(station.menu)}\n用食品或飲品點擊可直接加入，空手／蹲下點擊開啟管理。`, ['從背包新增菜品', '查看／移除菜品', '關閉']);
  if (selection === undefined || !validStationAction(player, block, station)) return;
  if (selection === 0) {
    const inventory = containerOf(player);
    const available = new Map();
    for (let slot = 0; slot < inventory.size; slot++) {
      const stack = inventory.getItem(slot);
      const food = foodFromStack(stack);
      if (food && !station.menu.some(item => menuFoodsOverlap(item, food))) {
        const key = menuFoodKey(food);
        if (!available.has(key)) available.set(key, { food, slot, typeId: stack.typeId, snapshot: inspectSenluoFood(stack) });
      }
    }
    const options = [...available.values()];
    if (!options.length) { notify(player, '背包沒有新的可識別食品或飲品。'); return; }
    const index = await choose(player, '新增菜品', '只建立菜單範本，不消耗物品。營養 0 的飲品也可供應訂單；不鎖定熱度、品質或調味。', options.map(({ food }) => `${menuFoodLabel(food)}${food.servingKind === 'drink' ? ' · 飲品' : ''} · 營養 ${food.nutrition}`));
    if (index === undefined || !validStationAction(player, block, station)) return;
    const selected = options[index];
    const stack = selected && inventory.getItem(selected.slot);
    const current = stack && foodFromStack(stack);
    if (!selected || !current || stack.typeId !== selected.typeId || menuFoodKey(current) !== menuFoodKey(selected.food) ||
        current.nutrition !== selected.food.nutrition || current.label !== selected.food.label ||
        current.servingKind !== selected.food.servingKind ||
        JSON.stringify(current.aliases) !== JSON.stringify(selected.food.aliases) ||
        !matchesSenluoFoodSnapshot(stack, selected.snapshot)) {
      notify(player, '選取的食品或資料已改變，請重新開啟菜單。'); return;
    }
    const result = addMenuFood(station, selected.food);
    if (result.ok) saveStation(station);
  } else if (selection === 1) {
    const snapshot = [...station.menu];
    if (!snapshot.length) return;
    const index = await choose(player, '點選移除', '每道菜按一份營養計算。', snapshot.map(food => `${menuFoodLabel(food)} · ${food.nutrition}`));
    if (index !== undefined && validStationAction(player, block, station)) { removeMenuFood(station, snapshot[index].typeId, snapshot[index].foodIdentity); saveStation(station); }
  }
}

function shelfInteract(player, block) {
  const station = getStation(block);
  const plates = block.typeId === 'ordertocook:plate_shelf';
  const typeId = plates ? 'ordertocook:clean_plate' : 'minecraft:leather';
  const maximum = plates ? 18 : 10;
  const current = heldItem(player);
  if (current?.typeId === typeId) {
    if (station.supplies >= maximum) { notify(player, '架子已滿。'); return; }
    const amount = player.isSneaking ? Math.min(current.amount, maximum - station.supplies) : 1;
    if (!consumeHeld(player, typeId, amount)) return;
    station.supplies += amount;
    saveStation(station);
    setBlockState(block, plates ? 'ordertocook:plates' : 'ordertocook:papers', station.supplies);
    playAt(block, plates ? 'plate_place' : 'bag_place', plates ? 0.75 : 1, plates ? 0.95 + Math.random() * 0.1 : 1);
  } else if (!current && player.isSneaking && station.supplies > 0) {
    station.supplies--;
    saveStation(station);
    giveItems(player, typeId, 1);
    setBlockState(block, plates ? 'ordertocook:plates' : 'ordertocook:papers', station.supplies);
  }
  notify(player, `${plates ? '餐盤' : '包材'} ${station.supplies}/${maximum}。用${plates ? '乾淨餐盤' : '皮革'}點擊補充；蹲下可整疊補入，空手蹲下取出一份。`);
}

function ingredientContainers(player, block) {
  const fridges = nearbyStations(block.dimension.id, block.location, 24, 'ordertocook:refrigerator').filter(station => canUseStation(player, station));
  return [...fridges.map(station => appliances.getStorage(station)).filter(Boolean), containerOf(player)].filter(Boolean);
}

async function countertopForm(player, block) {
  const restaurant = nearestRestaurant(block);
  if (!restaurant || !canManage(player, restaurant)) { notify(player, '操作台需要在你可管理的打單機 24 格內。'); return; }
  expireOrders(restaurant, orderTime());
  saveRestaurant(restaurant);
  const chooseCarrier = !!player.isSneaking;
  if (heldItem(player)?.typeId === 'ordertocook:order') {
    const linked = itemOrder(heldItem(player));
    if (!linked || linked.restaurant !== restaurant || linked.order.status !== 'accepted' ||
        linked.proof !== linked.order.proof || orderRemainingMs(linked.order, orderTime()) <= 0) {
      notify(player, '手持訂單無效、已處理，或不屬於這個操作台的餐廳。'); return;
    }
    return chooseCarrier && linked.order.type === 'dine_in'
      ? countertopCarrierForm(player, block, restaurant, linked.order, linked.proof, true)
      : prepareOrderAtCountertop(player, block, restaurant, linked.order);
  }
  const orders = restaurant.orders.filter(order => order.status === 'accepted');
  if (!orders.length) { notify(player, '先在打單機接單；已備妥的成品不會重複製作。'); return; }
  const ingredients = ingredientContainers(player, block);
  const outputBlocked = !block.above()?.isAir;
  const labels = orders.map(order => {
    const plan = planExtraction(ingredients, order.items);
    const shelfId = order.type === 'delivery' ? 'ordertocook:shelf' : 'ordertocook:plate_shelf';
    const supplies = (order.type === 'delivery' && !settings.countertopConsumeLeather) || nearbyStations(block.dimension.id, block.location, 5, shelfId, { shape: 'cube' })
      .some(station => station.supplies > 0 && canUseStation(player, station));
    const problems = [];
    if (outputBlocked && order.type !== 'delivery' && !chooseCarrier) problems.push('台上已有成品／方塊');
    if (!supplies) problems.push(order.type === 'delivery' ? '缺少包材' : '缺少乾淨餐盤');
    if (!plan.ok) problems.push(plan.missingFoods.length ? `缺少 ${plan.missingFoods.map(item => `${menuFoodLabel(item, foodLabel(item.typeId))} ×${item.amount}`).join('、')}` : '食品資料無法讀取');
    const dishes = order.items.map(item => `${menuFoodLabel(item, foodLabel(item.typeId))} ×${item.amount}`).join('、');
    return `${orderHeading(order)}\n${dishes}\n${problems.length ? problems.join('；') : '可製作'} · ${order.type === 'delivery' ? '打包' : chooseCarrier ? '選擇裝盤／打包' : '裝盤'}`;
  });
  const index = await choose(player, '操作台 · 裝盤／打包', '點選訂單直接製作；手持訂單點台可直接處理該單。\n蹲下點台可額外選擇把堂食打包帶走。\n使用背包與附近 24 格冰箱的食品；裝盤需 5 格內乾淨盤，打包依伺服器包材設定。\n裝盤需台上空置；打包時若台上已有成品／方塊，袋子會掉落在操作台上方。', labels);
  if (index === undefined || !nearBlock(player, block) || block.typeId !== 'ordertocook:countertop' || !canManage(player, restaurant)) return;
  const order = orders[index];
  if (!order) return;
  return chooseCarrier && order.type === 'dine_in'
    ? countertopCarrierForm(player, block, restaurant, order)
    : prepareOrderAtCountertop(player, block, restaurant, order);
}

async function countertopCarrierForm(player, block, restaurant, order, ticketProof = undefined, requireTicket = false) {
  const selection = await choose(player, '堂食 · 裝盤／打包', orderBody(order) + `\n裝盤使用乾淨餐盤；打包${settings.countertopConsumeLeather ? '使用皮革包材' : '不需包裝架或包材'}，不留下髒盤。取消不扣物。`, ['裝盤', '打包帶走']);
  if (![0, 1].includes(selection)) return;
  if (requireTicket) {
    const current = heldItem(player);
    const linked = itemOrder(current);
    if (current?.typeId !== 'ordertocook:order' || linked?.restaurant !== restaurant || linked?.order !== order ||
        linked.proof !== ticketProof || linked.proof !== order.proof) {
      notify(player, '手持訂單已改變，請重新操作。'); return;
    }
  }
  return prepareOrderAtCountertop(player, block, restaurant, order, selection === 1 ? 'bag' : 'plate');
}

function prepareOrderAtCountertop(player, block, restaurant, order, carrier = undefined) {
  if (!nearBlock(player, block) || block.typeId !== 'ordertocook:countertop' || !canManage(player, restaurant) || getRestaurant(restaurant.id) !== restaurant || loadedBlock(restaurant)?.typeId !== 'ordertocook:order_machine' || nearestRestaurant(block)?.id !== restaurant.id) return;
  if (!restaurant.orders.includes(order)) return;
  const selected = orderCarrier({ ...order, carrier });
  if (!selected) { notify(player, '這張訂單不能使用所選承載物。'); return; }
  const bag = selected === 'bag';
  if (order.status !== 'accepted' || orderRemainingMs(order, orderTime()) <= 0) { notify(player, '訂單狀態已改變或已逾時。'); return; }
  const output = block.above();
  if (!output || (!bag && !output.isAir)) { notify(player, '先取走操作台上方的成品／方塊。'); return; }
  const dropBag = bag && !output.isAir;
  const dropPosition = { x: block.location.x + 0.5, y: block.location.y + 1.2, z: block.location.z + 0.5 };
  const shelfId = bag ? 'ordertocook:shelf' : 'ordertocook:plate_shelf';
  // Java RestaurantSupplyCompatApi scans each axis from -5 through +5.
  // Read the current global setting here, after any awaited picker/carrier form.
  // Disabled leather bypasses shelf discovery and every supply transaction.
  const needsSupply = !bag || settings.countertopConsumeLeather;
  const supply = needsSupply ? nearbyStations(block.dimension.id, block.location, 5, shelfId, { shape: 'cube' }).find(station => station.supplies > 0 && canUseStation(player, station)) : undefined;
  if (needsSupply && !supply) { notify(player, `缺少 5 格內的${bag ? '包裝架包材（皮革）' : '餐盤架乾淨餐盤'}。${!bag ? '蹲下點台可選擇打包帶走。' : ''}`); return; }
  const plan = planExtraction(ingredientContainers(player, block), order.items);
  if (!plan.ok) {
    const reasons = plan.missingFoods.length ? plan.missingFoods.map(item =>
      `${menuFoodLabel(item, foodLabel(item.typeId))} ×${item.amount}`) : ['食品資料無法安全讀取，請重新操作；原物品未扣除。'];
    notify(player, `食品不足或無法辨識：\n${reasons.join('\n')}`); return;
  }
  // All inventory/currency/state changes below are synchronous: another form
  // callback cannot interleave between the preflight and this commit.
  const before = JSON.stringify(restaurant);
  const supplyBefore = supply?.supplies;
  if (!applyExtraction(plan)) { notify(player, '食品格子已改變，請重新操作。'); return; }
  let dropped, placedDisplay = false;
  try {
    const result = packOrder(restaurant, order.id, orderTime(), selected);
    if (!result.ok) throw new Error(reasonText(result.reason));
    order.proof = `${restaurant.orderSequence.toString(36)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    order.outputLocation = dropBag ? dropPosition : { ...output.location };
    order.platedVariant = Math.floor(Math.random() * 10);
    if (supply) { supply.supplies--; saveStation(supply); }
    saveRestaurant(restaurant);
    if (dropBag) {
      // Java PACK preserves an occupied output and drops the same full bag.
      dropped = block.dimension.spawnItem(parcelFor(restaurant, order), dropPosition);
      dropped.clearVelocity();
      dropped.applyImpulse({ x: 0, y: 0.2, z: 0 });
    } else {
      placedDisplay = true;
      output.setPermutation(BlockPermutation.resolve(bag ? 'ordertocook:takeout_bag' : 'ordertocook:food_plate_display'));
      const display = getStation(output);
      Object.assign(display, { restaurantId: restaurant.id, orderId: order.id, proof: order.proof, ownerId: restaurant.ownerId, nativeParcel: true });
      saveStation(display);
      parcelInventory(output, display).setItem(0, parcelFor(restaurant, order));
      if (!bag) setBlockState(output, 'ordertocook:stage', order.platedVariant * 4 + 1);
    }
    if (supply) {
      const supplyBlock = loadedBlock(supply);
      if (supplyBlock) setBlockState(supplyBlock, bag ? 'ordertocook:papers' : 'ordertocook:plates', supply.supplies);
    }
    removeTickets(player, order.id);
    if (!bag) playAt(block, 'food_plate_place', 0.9);
    playEffects(output.dimension, freshMealEffects(output.location), MolangVariableMap);
    notify(player, dropBag ? '餐點已備妥並掉落在操作台上方。拾起袋子，再拿給對應顧客。' : '餐點已備妥並放到操作台上。空手點擊取走，再拿給對應顧客。');
  } catch (error) {
    if (dropped?.isValid) dropped.remove();
    restoreExtraction(plan);
    if (supply) { supply.supplies = supplyBefore; saveStation(supply); }
    saveRestaurant(JSON.parse(before));
    if (placedDisplay && isParcelDisplay(output)) {
      containerOf(output)?.setItem(0, undefined);
      output.setType('minecraft:air');
    }
    const display = placedDisplay && findStation(output);
    if (display) deleteStation(display);
    throw error;
  }
  if (!dropBag) beginBagPlacement(output);
}

function isParcelDisplay(block) {
  return ['ordertocook:takeout_bag', 'ordertocook:food_plate_display'].includes(block?.typeId);
}

// Only pre-native displays lack a physical carrier. This one-time adoption
// cannot recover annotations already discarded by the former implementation.
function legacyDisplayStack(station) {
  const restaurant = getRestaurant(station.restaurantId);
  const order = restaurant?.orders.find(entry => entry.id === station.orderId);
  if (!order || order.status !== 'packed' || station.proof !== order.proof || station.typeId !== parcelDisplayType(order)) return undefined;
  return parcelFor(restaurant, order);
}

function parcelInventory(block, station) {
  const inventory = containerOf(block);
  if (!inventory?.isValid || inventory.size !== 1) throw new Error('餐點原生儲存格尚未就緒，請保留展示稍後再試。');
  if (!station.nativeParcel) {
    const stored = inventory.getItem(0);
    const stack = stored || legacyDisplayStack(station);
    // Commit ownership before adding cargo: a failed record save must not leave
    // a legacy reconstruction path alongside a native item that will spill.
    station.nativeParcel = true;
    saveStation(station);
    try { if (!stored && stack) inventory.setItem(0, stack); }
    catch (error) {
      if (!inventory.getItem(0)) {
        delete station.nativeParcel;
        saveStation(station);
      }
      throw error;
    }
  }
  return inventory;
}

function adoptLegacyDisplays() {
  for (const station of stations()) {
    if (station.nativeParcel || !isParcelDisplay(station)) continue;
    const block = loadedBlock(station);
    if (!isParcelDisplay(block)) continue;
    try { parcelInventory(block, station); }
    catch (error) { console.warn(`[OrderToCook] Display adoption deferred: ${error}`); }
  }
}

function pickupDisplay(player, block) {
  const station = getStation(block);
  const storage = parcelInventory(block, station);
  const stack = storage.getItem(0);
  if (!stack) { notify(player, '這是空／已失效的展示，沒有可交付的餐點。可直接拆除。'); return; }
  const inventory = containerOf(player);
  const slot = freeSlot(inventory);
  if (slot < 0) { notify(player, '請空出一格背包。'); return; }
  const before = block.permutation;
  try {
    storage.moveItem(0, slot, inventory);
    block.setType('minecraft:air');
    deleteStation(station);
  } catch (error) {
    // The reserved slot was empty. Move this attempt's complete carrier back
    // into its restored display if a later write failed.
    const issued = inventory.getItem(slot);
    block.setPermutation(before);
    if (issued && !containerOf(block).getItem(0)) {
      inventory.moveItem(slot, 0, containerOf(block));
    }
    saveStation(station);
    throw error;
  }
  playAt(block, stack.typeId === 'ordertocook:food_plate' ? 'food_plate_place' : 'bag_pickup');
}
function placeParcel(player, clickedBlock, face) {
  if (!nearBlock(player, clickedBlock) || face !== 'Up' || !player.isSneaking) {
    notify(player, '拿餐點點擊顧客交付；蹲下點擊方塊頂面可擺放。'); return;
  }
  const stack = heldItem(player);
  const linked = itemOrder(stack);
  if (!linked || linked.order.status !== 'packed' || linked.order.proof !== linked.proof ||
      stack.typeId !== parcelType(linked.order)) { notify(player, '這份餐點已失效。'); return; }
  const output = clickedBlock.above();
  if (!output?.isAir) { notify(player, '上方沒有空間。'); return; }
  let station;
  const slot = player.selectedSlotIndex;
  const inventory = containerOf(player);
  try {
    output.setPermutation(BlockPermutation.resolve(parcelDisplayType(linked.order)));
    station = getStation(output);
    Object.assign(station, { restaurantId: linked.restaurant.id, orderId: linked.order.id, proof: linked.proof, ownerId: player.id, nativeParcel: true });
    saveStation(station);
    if (orderCarrier(linked.order) === 'plate') setBlockState(output, 'ordertocook:stage', (linked.order.platedVariant || 0) * 4 + 1);
    inventory.moveItem(slot, 0, parcelInventory(output, station));
  } catch (error) {
    // A native write may throw after consuming the item; keep exactly one
    // carrier by removing the failed display before restoring its source slot.
    const storage = containerOf(output);
    if (storage?.getItem(0)) {
      if (!inventory.getItem(slot)) storage.moveItem(0, slot, inventory);
      else storage.setItem(0, undefined);
    }
    output.setType('minecraft:air');
    const failed = station || findStation(output);
    if (failed) deleteStation(failed);
    if (!inventory.getItem(slot)) inventory.setItem(slot, stack);
    throw error;
  }
  beginBagPlacement(output);
}

function customerInteract(player, entity, linkage, options = {}) {
  const restaurant = getRestaurant(linkage.restaurantId);
  const order = restaurant?.orders.find(entry => entry.id === linkage.orderId);
  if (!restaurant || restaurant.removing || !order || !entity?.isValid || entity.typeId !== 'ordertocook:customer') { notify(player, '這位顧客的訂單已結束。'); return; }
  if (order.walkIn && order.status === 'offered') {
    if (!canManage(player, restaurant)) { notify(player, '請餐廳店主或員工接取到店訂單。'); return; }
    safely(player, async () => {
      const confirm = await choose(player, '到店顧客', orderBody(order), ['接單', '稍後']);
      if (confirm === 0 && entity.isValid && player.dimension.id === entity.dimension.id && distanceSquared(player.location, entity.location) < 36) acceptWithTicket(player, restaurant, order);
    });
    return;
  }
  const stack = heldItem(player);
  const linked = itemOrder(stack);
  if (!linked || linked.restaurant !== restaurant || linked.order !== order ||
      stack.typeId !== parcelType(order) ||
      linked.proof !== order.proof || order.status !== 'packed') {
    notify(player, orderBody(order) + '\n請拿對應的已裝盤餐點／打包餐點交付。'); return;
  }
  if (player.dimension.id !== entity.dimension.id || distanceSquared(player.location, entity.location) > 36) return;
  if (order.type === 'delivery' && (!order.destination || player.dimension.id !== order.destination.dimensionId ||
    (player.location.x - order.destination.x) ** 2 + (player.location.z - order.destination.z) ** 2 > 12 ** 2)) {
    notify(player, '尚未抵達這張外送單的目的地。'); return;
  }
  if (orderCarrier(order) === 'plate' && !dining.hasVacancy(restaurant, entity)) {
    notify(player, '先收走顧客桌前剩下的餐盤，再交付新餐。'); return;
  }
  const weather = weatherByDimension.get(restaurant.dimensionId.replace('minecraft:', ''));
  const now = Date.now();
  const before = JSON.stringify(restaurant);
  const inventory = containerOf(player);
  const slot = player.selectedSlotIndex;
  let result;
  try {
    // Consume the already-verified physical carrier before committing payment.
    // No await or form callback may interleave this synchronous transaction.
    if (!consumeHeld(player, stack.typeId, 1)) { notify(player, '餐點已被移動，請重新交付。'); return; }
    result = completeOrder(restaurant, order.id, orderTime(), {
      raining: weather === 'Rain' || weather === 'Thunder', easterEgg: !!order.easterEgg,
      customerSeated: !!entity.getComponent('minecraft:riding')?.entityRidingOn,
      rng: typeof options.rng === 'function' ? options.rng : Math.random
    });
    if (!result.ok) {
      inventory.setItem(slot, stack);
      saveRestaurant(restaurant);
      notify(player, reasonText(result.reason)); return;
    }
    if (orderCarrier(order) === 'plate') dining.queueMeal(restaurant, order, entity, now, player.id);
    creditCompletedOrder(restaurant, player.id, order);
    saveRestaurant(restaurant);
  } catch (error) {
    // Persisted order state and the exact unstackable parcel are restored before
    // a retry. The canonical store rejects stale restaurant objects afterwards.
    try { saveRestaurant(JSON.parse(before)); } catch (restoreError) { console.warn(`[OrderToCook] Submission state rollback failed: ${restoreError}`); }
    try { if (!inventory.getItem(slot)) inventory.setItem(slot, stack); } catch (restoreError) { console.warn(`[OrderToCook] Submission parcel rollback failed: ${restoreError}`); }
    throw error;
  }
  removeTickets(player, order.id);
  reward(player, result.reward);
  reconcileProgress(restaurant);
  if (orderCarrier(order) === 'plate') playEffects(entity.dimension,
    [{ sound: 'ordertocook:food_plate_place', location: entity.location, volume: 1, pitch: 1 }], MolangVariableMap);
  entities.finishCustomer(order.id, result.completion);
  dining.tick(now);
  notify(player, `交付成功！獲得 ${result.reward} ${currencyLabel()}${result.tip ? `（含小費 ${result.tip}）` : ''}。${orderCarrier(order) === 'plate' ? '顧客用餐後會留下髒餐盤；點擊餐盤或下方桌面收回。' : ''}`);
}

/** Java grants the extra coins at the end of the boom action. A disconnected
 * player receives no coins/prestige, but the restaurant still earns the bonus.
 */
function settleMealBonus(restaurant, meal, now) {
  const playerId = meal.bonusPlayerId;
  if (getRestaurant(restaurant.id) !== restaurant || !restaurant.pendingDishes.includes(meal)) return false;
  if (!playerId) {
    if (meal.reactionPending) {
      meal.reactionPending = false;
      try { saveRestaurant(restaurant); } catch (error) { meal.reactionPending = true; throw error; }
    }
    return true;
  }
  const player = world.getAllPlayers().find(value => value.isValid && value.id === playerId);
  const amount = meal.boomBonus;
  const before = JSON.stringify(restaurant);
  try {
    // The existing restaurant save claims this payment before native output.
    // Replayed ticks and trimmed order history cannot mint it again.
    delete meal.bonusPlayerId;
    meal.reactionPending = false;
    restaurant.stats.earnings += amount;
    restaurant.updatedAt = now;
    if (player) {
      creditBonusEarnings(restaurant, playerId, amount);
      const order = restaurant.orders.find(value => value.id === meal.id);
      if (order) order.paidReward += amount;
    }
    saveRestaurant(restaurant);
  } catch (error) {
    saveRestaurant(JSON.parse(before));
    throw error;
  }
  if (player) reward(player, amount);
  reconcileProgress(restaurant);
  world.sendMessage(`「${restaurant.name}」的顧客好吃到爆炸！驚喜加賞 ${amount} ${currencyLabel()}。`);
  return true;
}

function collectDiningPlate(player, value) {
  const linked = value?.meal ? value : value?.typeId === DINING_ENTITY ? dining?.resolveEntity(value) : dining?.atBlock(value);
  if (!linked) return false;
  const result = dining.claim(player, linked.restaurant, linked.meal);
  if (result.ok) {
    const location = { x: Math.floor(linked.meal.location.x) + 0.5, y: Math.floor(linked.meal.location.y) + 0.5, z: Math.floor(linked.meal.location.z) + 0.5 };
    playEffects(player.dimension, result.early
      ? [{ sound: 'ordertocook:food_plate_place', location, volume: 1, pitch: 1 }]
      : plateSound(location), MolangVariableMap);
    notify(player, (result.interruptedCustomer ? `${result.interruptedCustomer}還沒吃完就被收盤了；顧客提前離開。` : '') +
      (result.dropped ? '髒餐盤已落地，可拾起清洗。' : '已收回一個髒餐盤，可送去清洗。'));
  } else if (result.reason === 'permission') notify(player, '只有餐廳店主或員工可收取餐盤。');
  return true;
}

function upgradeAppliance(player, block) {
  if (heldItem(player)?.typeId !== 'ordertocook:otc_upgrade_box') return false;
  const before = block.permutation;
  let target;
  let upper;
  if (block.typeId === 'minecraft:barrel') {
    upper = block.above();
    if (upper?.typeId !== 'minecraft:barrel') { notify(player, '冰箱需要上下堆疊的兩個空木桶，點擊下方木桶升級。'); return true; }
    if ([block, upper].some(value => {
      const container = value.getComponent('minecraft:inventory')?.container;
      return container && container.emptySlotsCount !== container.size;
    })) { notify(player, '先取出兩個木桶內的全部物品，再升級冰箱。'); return true; }
    target = 'ordertocook:refrigerator';
  } else if (block.typeId === 'minecraft:smoker' || block.typeId === 'minecraft:lit_smoker') {
    const container = block.getComponent('minecraft:inventory')?.container;
    if (container && container.emptySlotsCount !== container.size) { notify(player, '先取出煙燻爐內的食品與燃料。'); return true; }
    target = 'ordertocook:stove';
  } else if (block.typeId === 'ordertocook:washingtable') {
    const station = getStation(block);
    if (station.appliance?.plates > 0) { notify(player, '先洗完並取出洗碗池的盤子。'); return true; }
    target = 'ordertocook:dishwasher';
  } else return false;
  const upperBefore = upper?.permutation;
  const oldStation = findStation(block);
  try {
    if (upper) upper.setType('minecraft:air');
    if (oldStation) deleteStation(oldStation);
    block.setPermutation(BlockPermutation.resolve(target));
    const station = getStation(block);
    station.ownerId = player.id;
    if (target === 'ordertocook:dishwasher') queueProgressEvent(station, player.id, { type: 'dishwasher_upgraded' });
    saveStation(station);
    appliances.onPlace(block);
    if (!consumeHeld(player, 'ordertocook:otc_upgrade_box', 1)) throw new Error('工具箱已被移動');
    notify(player, `已升級為${blockNames[target.split(':')[1]]}。`);
  } catch (error) {
    block.setPermutation(before);
    if (upper && upperBefore) upper.setPermutation(upperBefore);
    const newStation = findStation(block);
    if (newStation) deleteStation(newStation);
    if (oldStation) saveStation(oldStation);
    throw error;
  }
  if (target === 'ordertocook:dishwasher') reconcileStationProgress(findStation(block));
  return true;
}

function recordProgress(player, event) {
  if (!ready || !player?.isValid || !progression) return false;
  try { progression.recordEvent(player.id, event); return true; }
  catch (error) { console.warn(`[OrderToCook] Personal progress ${player.id}: ${error}`); return false; }
}
function reconcileProgress(restaurant) {
  try { progression?.reconcileRestaurant(restaurant); return true; }
  catch (error) {
    console.warn(`[OrderToCook] Pending progress ${restaurant.id}; ledger retained: ${error}`);
    return false;
  }
}
function reconcileStationProgress(station) {
  if (!station) return true;
  try { progression?.reconcileStation(station); return true; }
  catch (error) {
    console.warn(`[OrderToCook] Pending station progress ${station.id}; event retained: ${error}`);
    return false;
  }
}
function progressionRankingRecords() {
  return restaurants().map(restaurant => {
    let isPlaced = true;
    try {
      const block = loadedBlock(restaurant);
      if (block?.isValid) isPlaced = block.typeId === 'ordertocook:order_machine';
    } catch { /* Persisted, unloaded placed restaurants still count. */ }
    return { id: restaurant.id, ownerId: restaurant.ownerId, dimensionId: restaurant.dimensionId,
      stats: restaurant.stats, removing: restaurant.removing, isPlaced };
  });
}
function updateProgressRankings() {
  if (!ready || !progression) return;
  const current = progressionRankingRecords();
  for (const player of world.getAllPlayers()) {
    recordProgress(player, { type: 'restaurant_ranking', playerId: player.id, restaurants: current });
  }
}
async function progressForm(player) {
  if (!ready || !player?.isValid || !progression) return;
  progression.reconcilePlayer(player.id);
  progression.recordEvent(player.id, { type: 'restaurant_ranking', playerId: player.id, restaurants: progressionRankingRecords() });
  while (player.isValid) {
    const state = progression.getState(player.id);
    const rows = progressRows(state);
    const supported = rows.filter(row => row.supported);
    const unlocked = supported.filter(row => row.unlocked).length;
    const selection = await choose(player, '下單了 · 個人進度',
      `已達成 ${unlocked}/${supported.length} 項；原作共 ${rows.length} 項\n` +
      `本世界個人累積結算 ${state.totals.earned} · 完成 ${state.totals.completed} 單\n` +
      '個人收入自本版開始記錄，包含小費與驚喜加賞；不按目前餘額計算。\n' +
      '進度不另發金幣，也不會解鎖 Xbox 官方成就。點選條目查看條件。',
      [...rows.map(row => `${row.unlocked ? '§a✓' : row.supported ? '§7○' : '§8—'} ${row.title}\n§r${row.supported ? row.current + '/' + row.target : '尚未移植'}`), '關閉']);
    if (!player.isValid || selection === undefined || selection >= rows.length || selection < 0) return;
    const row = rows[selection];
    const action = await choose(player, row.title,
      row.description + '\n\n' + row.status +
      (row.supported ? ` · ${row.current}/${row.target}` : '') +
      (row.id === 'expired_bag_eaten' ? '\n長按食用已逾時的外送包裹，吃完才解鎖；不增加飽食度。' : ''),
      ['返回個人進度', '關閉']);
    if (action !== 0) return;
  }
}

async function guideForm(player) {
  // One native ActionForm at a time. This reuses the existing OTC guide item,
  // with its own chapter/topic/page tree; no Cookery host or extra guide item.
  let route = { kind: 'home' };
  for (let pageTurns = 0; pageTurns < 128 && player?.isValid; pageTurns++) {
    const screen = guideBookScreen(route, isAdmin(player));
    const selection = await choose(player, screen.title, screen.body, screen.buttons);
    if (selection === undefined) return;
    const action = screen.buttons[selection]?.action;
    if (!action || action.kind === 'close') return;
    if (action.kind === 'goto') { route = action.view; continue; }
    if (action.kind === 'progress') await progressForm(player);
    else if (action.kind === 'leaderboard') await leaderboardForm(player);
    else if (action.kind === 'about') await aboutAndLicenseForm(player);
    else if (action.kind === 'test_kit' && isAdmin(player)) giveTestKit(player);
    else return;
    // Returning from a secondary feature retains the place in this book.
  }
}

async function aboutAndLicenseForm(player) {
  await choose(player, '關於與授權 · Order To Cook',
    'Order To Cook／下單了\n原作者：breezeth（breezeth-CN）\n原作：github.com/breezeth-CN/OrdertoCook\n原作發布：curseforge.com/minecraft/mc-mods/order-to-cook\n\n基岩版移植與維護：casama233／burnt-tea-dev\n專案：github.com/burnt-tea-dev/order-to-cook-unofficial\n上游基準：e59e3dbcabe19b783d9adb933db5fcb8bc1e4642\n\n授權：GNU GPL v3（本移植標示 GPL-3.0-only）\n本作品是非官方的基岩版改編，未獲 Mojang／Microsoft 或原作者背書，亦不代表原 Java 模組。\n原作程式及素材的來源、轉換與已知授權範圍請查看專案內 LICENSE、THIRD_PARTY_NOTICES.md 及 docs/ASSET_LICENSE_REGISTER.md。',
    ['關閉']);
}

function giveTestKit(player) {
  const kit = [['order_machine', 1], ['board', 1], ['countertop', 1], ['shelf', 1], ['plate_shelf', 1], ['chair', 4], ['washingtable', 1], ['clean_plate', 18], ['otc_upgrade_box', 3], ['motorcycle', 1], ['controller', 1]];
  for (const [id, amount] of kit) giveItems(player, PREFIX + id, amount);
  for (const typeId of ['minecraft:cooked_porkchop', 'minecraft:cooked_chicken', 'minecraft:cooked_mutton', 'minecraft:bread', 'minecraft:leather']) giveItems(player, typeId, 64);
  notify(player, '測試套組已發放。請先放立牌，再開打單機開始營業。');
}

function claimStation(player, block) {
  const normalized = appliances?.normalizeBlock(block) || block;
  const restaurant = nearestRestaurant(normalized);
  // Deny before getStation can create a record or claim an unowned legacy one.
  if (restaurant && !canManage(player, restaurant)) return false;
  const station = getStation(normalized);
  if (!station.ownerId) { station.ownerId = player.id; saveStation(station); }
  if (restaurant) return true;
  return station.ownerId === player.id || isAdmin(player);
}
async function interactBlock(player, block, { nativeEntryCancelled = false } = {}) {
  if (!ready || !nearBlock(player, block)) return;
  if (block.typeId === DINING_BLOCK) { collectDiningPlate(player, block); return; }
  const tick = interactionTicks.get(player.id) ?? -100;
  if (system.currentTick - tick < 3) return;
  interactionTicks.set(player.id, system.currentTick);
  if (block.typeId === 'ordertocook:order_machine') { await machineForm(player, block); return; }
  if (block.typeId.startsWith(PREFIX) && !claimStation(player, block)) { notify(player, '這是其他玩家的餐廳設備。'); return; }
  if (heldItem(player)?.typeId === 'ordertocook:otc_upgrade_box') {
    const nearby = nearestRestaurant(block);
    if (nearby && !canManage(player, nearby)) return;
    if (upgradeAppliance(player, block)) return;
  }
  if (appliances?.onInteract(player, block, { nativeEntryCancelled })) return;
  if (entities?.onBlockInteract(player, block)) return;
  if (block.typeId === 'ordertocook:board') await boardForm(player, block);
  else if (block.typeId === 'ordertocook:countertop') await countertopForm(player, block);
  else if (['ordertocook:shelf', 'ordertocook:plate_shelf'].includes(block.typeId)) shelfInteract(player, block);
  else if (['ordertocook:takeout_bag', 'ordertocook:food_plate_display'].includes(block.typeId)) pickupDisplay(player, block);
}

function onUse(player, itemStack) {
  if (!ready || !player?.isValid) return;
  itemStack = adoptHeldBag(player, itemStack);
  itemStack = updateHeldDestinationLore(player, itemStack);
  if (['ordertocook:motorcycle', 'ordertocook:controller'].includes(itemStack?.typeId)) { entities?.onItemUse?.(player, itemStack); return; }
  if (itemStack?.typeId === 'ordertocook:guide') { safely(player, () => guideForm(player)); return; }
  if (itemStack?.typeId === 'ordertocook:otc_upgrade_box') { notify(player, '使用工具箱點擊：兩個空木桶的下方木桶、空煙燻爐、或沒有餐盤的洗碗池。'); return; }
  const linked = itemOrder(itemStack);
  if (linked) notify(player, orderBody(linked.order));
  else {
    const remaining = bagRemainingMs(itemStack);
    if (remaining !== undefined) notify(player, `外送包裹剩餘：${Math.ceil(remaining / 60000)} 分鐘遊戲時間。`);
  }
}

function updateHeldDestinationLore(player, requested) {
  const stack = heldItem(player);
  if (stack?.typeId !== 'ordertocook:takeout_bag' || requested?.typeId !== stack.typeId ||
      [ITEM_RESTAURANT, ITEM_ORDER, ITEM_PROOF].some(key => stack.getDynamicProperty(key) !== requested.getDynamicProperty(key))) return requested;
  const linked = itemOrder(stack);
  if (!linked || !['accepted', 'packed'].includes(linked.order.status) || linked.proof !== linked.order.proof ||
      orderRemainingMs(linked.order, orderTime()) <= 0) return requested;
  const destination = destinationLore(linked.order);
  if (!destination) return requested;
  const lore = stack.getLore();
  // Recognize only our factory's coordinate line followed by its own use hint.
  // Extra player lore, names and all native metadata remain on this same stack.
  const index = lore.findIndex((line, index) => /^目的地 X:-?\d+ Z:-?\d+$/.test(line) && lore[index + 1] === PARCEL_USE_HINT);
  if (index < 0 || lore[index] === destination) return requested;
  lore[index] = destination;
  stack.setLore(lore);
  containerOf(player).setItem(player.selectedSlotIndex, stack);
  return stack;
}

function bagRemainingMs(stack, time = orderTime()) {
  if (stack?.typeId !== 'ordertocook:takeout_bag') return undefined;
  // New parcels keep their deadline even after restaurant history is trimmed.
  const linked = itemOrder(stack)?.order;
  const tick = stack.getDynamicProperty(ITEM_EXPIRY_TICK) ?? linked?.expiresTick;
  if (tick !== undefined) return Number.isSafeInteger(tick) && tick >= 0
    ? orderRemainingMs({ expiresTick: tick }, time) : undefined;
  const expiry = stack.getDynamicProperty(ITEM_EXPIRY) ?? linked?.expiresAt;
  return Number.isSafeInteger(expiry) && expiry >= 0 ? orderRemainingMs({ expiresAt: expiry }, time) : undefined;
}

function expiredBag(stack) {
  return bagRemainingMs(stack) === 0;
}

/** An old held bag is rewritten only in read/write mode, preserving its full
 * ItemStack. Unloaded legacy bags retain Java's timestamp adoption contract.
 */
function adoptHeldBag(player, requested) {
  const stack = heldItem(player);
  if (stack?.typeId !== 'ordertocook:takeout_bag' || requested?.typeId !== stack.typeId ||
      [ITEM_RESTAURANT, ITEM_ORDER, ITEM_PROOF].some(key => stack.getDynamicProperty(key) !== requested.getDynamicProperty(key)) ||
      stack.getDynamicProperty(ITEM_EXPIRY_TICK) !== undefined) return requested;
  const linked = itemOrder(stack)?.order;
  const time = orderTime();
  const expiry = stack.getDynamicProperty(ITEM_EXPIRY) ?? linked?.expiresAt;
  if (!Number.isSafeInteger(expiry) || expiry < 0) return requested;
  const tick = linked?.expiresTick ?? time.tick + Math.max(0, Math.ceil((expiry - time.wall) / 50));
  stack.setDynamicProperty(ITEM_EXPIRY_TICK, tick);
  containerOf(player).setItem(player.selectedSlotIndex, stack);
  return stack;
}

function consumeBag(player, stack) {
  if (!ready || !player?.isValid || !expiredBag(stack)) return;
  if (!recordProgress(player, { type: 'expired_bag_eaten' })) {
    giveStack(player, stack.clone());
    notify(player, '個人進度未能保存，已退回包裹，稍後再試。');
  }
}

function capturePortablePlacement(event) {
  const typeId = event.permutationToPlace.type.id;
  if (!event.player || !['ordertocook:board', 'ordertocook:order_machine'].includes(typeId)) return;
  const stack = heldItem(event.player);
  if (stack?.typeId !== typeId) return;
  const id = locationId(event.block.dimension.id, event.block.location);
  pendingPlacements.delete(id);
  try {
    const data = readPortableBlock(stack);
    if (data) {
      const pending = { playerId: event.player.id, typeId, tick: system.currentTick, data, stack: stack.clone() };
      pendingPlacements.set(id, pending);
      system.run(() => { if (pendingPlacements.get(id) === pending) pendingPlacements.delete(id); });
    }
  } catch (error) {
    event.cancel = true;
    system.run(() => notify(event.player, '設備物品資料無法讀取；已保留原物品，沒有放置。'));
  }
}

function onPlace(block) {
  if (block.typeId === DINING_BLOCK) return;
  if (!ready || !block?.isValid || !block.typeId.startsWith(PREFIX)) return;
  // The refrigerator's upper half is owned by the lower-half station.
  if (isUpperFridge(block)) return;
  const station = getStation(block);
  if (block.typeId === 'ordertocook:board' && !station.initialized) { station.menu = DEFAULT_MENU.map(food => ({ ...food })); station.initialized = true; saveStation(station); }
  appliances?.onPlace(block);
}
function onBreak(event) {
  if (!ready) return;
  const block = event.block;
  const typeId = event.brokenBlockPermutation.type.id;
  if (typeId === DINING_BLOCK) { dining.removeBlock(block); return; }
  const station = findStation(block);
  // Native loot is empty: emit one data-bearing item before record cleanup.
  if (['ordertocook:board', 'ordertocook:order_machine'].includes(typeId)) {
    const record = typeId === 'ordertocook:board' ? station : getRestaurant(locationId(block.dimension.id, block.location));
    const stack = new ItemStack(typeId);
    if (record) writePortableBlock(stack, record);
    block.dimension.spawnItem(stack, { ...block.location, y: block.location.y + 0.5 });
  }
  if (appliances?.onBreak(block, station, event.brokenBlockPermutation)) return;
  entities?.onBlockBreak(block, station, event.brokenBlockPermutation);
  if (typeId === 'ordertocook:order_machine') {
    const restaurant = getRestaurant(locationId(block.dimension.id, block.location));
    if (restaurant) {
      printerStarts.delete(restaurant.id);
      machineTiming.forget(restaurant.id);
      restaurant.removing = true;
      saveRestaurant(restaurant);
      for (const order of restaurant.orders) entities.cleanupOrder(order.id);
      if (reconcileProgress(restaurant) && dining.cleanupRestaurant(restaurant)) deleteRestaurant(restaurant.id);
    }
  }
  if (station) {
    if (['ordertocook:shelf', 'ordertocook:plate_shelf'].includes(typeId) && station.supplies > 0) {
      block.dimension.spawnItem(new ItemStack(typeId === 'ordertocook:shelf' ? 'minecraft:leather' : 'ordertocook:clean_plate', station.supplies), { ...block.location, y: block.location.y + 0.5 });
    }
    if (['ordertocook:takeout_bag', 'ordertocook:food_plate_display'].includes(typeId) && !station.nativeParcel) {
      // Old records never had native cargo. Retain their former single drop
      // until adoption; native displays already spill their actual full stack.
      const stack = legacyDisplayStack(station);
      if (stack) block.dimension.spawnItem(stack, { ...block.location, y: block.location.y + 0.5 });
    }
    deleteStation(station);
  }
}

function tickMachine(block) {
  if (!ready || block.typeId !== 'ordertocook:order_machine') return;
  const restaurant = getRestaurant(locationId(block.dimension.id, block.location));
  if (restaurant) machineTiming.tick(restaurant, block);
}

function tickRestaurants() {
  if (!ready) return;
  // Ordinary carried paper/bags only, before independent world housekeeping.
  // At most 36P slot reads per 20 ticks; linked records are indexed once/pass.
  try { tickCarriedOrderAlerts(world.getAllPlayers(), orderTime(), getRestaurant); }
  catch { /* Player enumeration unavailable; independent expiry still proceeds. */ }
  adoptLegacyDisplays();
  const now = Date.now();
  for (const restaurant of restaurants()) {
    try {
      if (restaurant.removing) {
        for (const order of restaurant.orders) entities.cleanupOrder(order.id);
        if (reconcileProgress(restaurant) && dining.cleanupRestaurant(restaurant, now)) deleteRestaurant(restaurant.id);
        continue;
      }
      const time = orderTime();
      const expired = expireOrders(restaurant, time);
      for (const order of expired.orders) entities.cleanupOrder(order.id, true);
      // Expiry is independent of board chunk availability. Commit it before a
      // deferred menu check can interrupt this restaurant's remaining work.
      if (expired.expired > 0) saveRestaurant(restaurant);
      const machine = loadedBlock(restaurant);
      if (machine?.typeId === 'ordertocook:order_machine') {
        try { if (syncMenu(restaurant)) saveRestaurant(restaurant); }
        catch (error) {
          // Only defer the menu. Printer state and unrelated progress can still
          // advance. Persistence failures must exit: the canonical cache rolled
          // back and this restaurant object is no longer safe to commit.
          if (!(error instanceof UnavailableMenuBoardError)) throw error;
        }
        syncPrinter(restaurant, machine);
      } else machineTiming.forget(restaurant.id);
      reconcileProgress(restaurant);
    } catch (error) { console.warn(`[OrderToCook] Restaurant ${restaurant.id}: ${error}`); }
  }
  for (const station of stations()) if (station.progressEvents?.length) reconcileStationProgress(station);
  updateProgressRankings();
}

function deliveryHint(player) {
  const linked = itemOrder(heldItem(player));
  const destination = linked?.order.destination;
  if (!destination || !['accepted', 'packed'].includes(linked.order.status) || orderRemainingMs(linked.order, orderTime()) <= 0) return undefined;
  if (player.dimension.id !== destination.dimensionId) return '§e外送目的地位於另一個維度';
  const dx = destination.x - player.location.x, dz = destination.z - player.location.z;
  const distance = Math.round(Math.sqrt(dx * dx + dz * dz));
  const cardinal = `${dz < -5 ? '北' : dz > 5 ? '南' : ''}${dx < -5 ? '西' : dx > 5 ? '東' : ''}` || '已到達';
  return `§6外送 ${cardinal} · ${distance} 格 §fX:${destination.x} Z:${destination.z} · ${Math.ceil(orderRemainingMs(linked.order, orderTime()) / 60000)} 分`;
}

function updateHud() {
  if (!ready) return;
  for (const player of world.getAllPlayers()) {
    if (!player.isValid) { activeHudPlayers.delete(player.id); continue; }
    let navigation, primary;
    try { navigation = deliveryHint(player); } catch { /* Inventory/player unloaded. */ }
    try { primary = appliances?.getWashingProgress?.(player); } catch { /* Cosmetic read only. */ }
    if (!primary) {
      try {
        const hit = player.getBlockFromViewDirection({ maxDistance: 6, includeLiquidBlocks: false, includePassableBlocks: false });
        if (hit?.block) primary = appliances?.getInspection?.(player, hit.block);
      } catch { /* Ray targets can unload; preserve an independent delivery hint. */ }
    }
    const message = [primary, navigation].filter(Boolean).join('\n§r');
    try {
      if (message) {
        player.onScreenDisplay.setActionBar(message);
        activeHudPlayers.add(player.id);
      } else if (activeHudPlayers.delete(player.id)) {
        // Clear our last hint once; idle players do not repeatedly erase other HUDs.
        player.onScreenDisplay.setActionBar('');
      }
    } catch { activeHudPlayers.delete(player.id); }
  }
}

function registerConfiguration() {
  system.afterEvents.scriptEventReceive.subscribe(event => {
    if (!event.id.startsWith(PREFIX) || !ready) return;
    const player = event.sourceEntity?.typeId === 'minecraft:player' ? event.sourceEntity : undefined;
    if (event.sourceType !== 'Server' && (!player || !isAdmin(player))) return;
    try {
      if (event.id === 'ordertocook:kit' && player) { giveTestKit(player); return; }
      if (event.id === 'ordertocook:refresh' && player) {
        const machine = restaurants().filter(r => r.dimensionId === player.dimension.id && distanceSquared(r.location, player.location) < 24 * 24).sort((a, b) => distanceSquared(a.location, player.location) - distanceSquared(b.location, player.location))[0];
        if (machine) {
          if (syncMenu(machine)) saveRestaurant(machine);
          if (machine.menu.length) {
            const refreshed = refreshMachineOrders(machine);
            saveRestaurant(machine);
            notify(player, refreshed.orders.length ? '測試用訂單已刷新。' : deliveryDelayText(refreshed.deliveryReason));
          }
        }
        return;
      }
      if (event.id === 'ordertocook:food') {
        const data = JSON.parse(event.message);
        const typeId = normalizeFoodId(data.typeId);
        new ItemStack(typeId); // Reject missing addon IDs immediately.
        if (!Number.isInteger(data.nutrition) || data.nutrition < 1 || data.nutrition > 10000) throw new Error('nutrition 必須為 1..10000 整數');
        const food = { typeId, nutrition: data.nutrition, label: String(data.label || typeId).slice(0, 100) };
        if (foodOverrides.size >= 150 && !foodOverrides.has(typeId)) throw new Error('最多 150 個虛擬食品設定');
        // Each virtual food has its own small property, so 150 long translated
        // names cannot overflow a single 32 KiB settings string.
        world.setDynamicProperty('ordertocook:food_override:' + typeId, JSON.stringify(food));
        foodOverrides.set(typeId, food);
        if (player) notify(player, `已註冊 ${food.label}，營養 ${food.nutrition}。`);
      } else if (event.id === 'ordertocook:config') {
        const data = JSON.parse(event.message);
        const next = { ...settings };
        const hasDeliveryRateSetting = Object.hasOwn(data, 'deliveryRate');
        if (hasDeliveryRateSetting) {
          if (!isDeliveryRate(data.deliveryRate)) throw new Error('deliveryRate 必須為 0..1 有限數字');
          next.deliveryRate = data.deliveryRate;
        }
        const hasMachineLimitSetting = Object.hasOwn(data, 'maxOrderMachinesWithin24');
        if (hasMachineLimitSetting) {
          if (!isMachineLimit(data.maxOrderMachinesWithin24)) throw new Error('maxOrderMachinesWithin24 必須為 -2147483648..2147483647 整數；小於 1 時使用 1');
          next.maxOrderMachinesWithin24 = Math.max(1, data.maxOrderMachinesWithin24);
        }
        const hasLeatherSetting = Object.hasOwn(data, 'countertopConsumeLeather');
        if (hasLeatherSetting) {
          if (typeof data.countertopConsumeLeather !== 'boolean') throw new Error('countertopConsumeLeather 必須為 boolean（true 或 false）');
          next.countertopConsumeLeather = data.countertopConsumeLeather;
        }
        if (typeof data.currencyItem === 'string') { if (data.currencyItem) new ItemStack(data.currencyItem); next.currencyItem = data.currencyItem; }
        if (Number.isInteger(data.refreshSeconds) && data.refreshSeconds >= 10 && data.refreshSeconds <= 86400) next.refreshMs = data.refreshSeconds * 1000;
        if (Array.isArray(data.upgradeNutrition) && data.upgradeNutrition.length === 9 && data.upgradeNutrition.every(n => Number.isInteger(n) && n >= 0 && n <= 10000)) next.orderMachineUpgradeBoardHunger = data.upgradeNutrition;
        const encoded = JSON.stringify(next);
        world.setDynamicProperty('ordertocook:settings', encoded);
        // Verify these global settings before changing live behavior. Per-restaurant
        // propagation follows this commit; it is not an atomic multi-record update.
        if ((hasLeatherSetting || hasMachineLimitSetting || hasDeliveryRateSetting) && world.getDynamicProperty('ordertocook:settings') !== encoded) throw new Error('餐廳設定寫入未確認；全域設定未變更。');
        settings = next;
        // A count-only command affects future placements, not existing restaurant
        // records. Preserve the legacy propagation when its fields are supplied.
        if (!hasMachineLimitSetting || ['deliveryRate', 'countertopConsumeLeather', 'currencyItem', 'refreshSeconds', 'upgradeNutrition'].some(key => Object.hasOwn(data, key))) {
          for (const restaurant of restaurants()) { restaurant.config = { ...restaurant.config, deliveryRate: settings.deliveryRate, refreshMs: settings.refreshMs, orderMachineUpgradeBoardHunger: settings.orderMachineUpgradeBoardHunger }; saveRestaurant(restaurant); }
        }
        if (player) notify(player, '伺服器餐廳設定已儲存。新刷新間隔於下次刷新後使用。');
      }
    } catch (error) { console.warn(`[OrderToCook] Config: ${error}`); if (player) notify(player, String(error)); }
  });
}

system.beforeEvents.startup.subscribe(event => {
  // Kept separate from interact: Bedrock requires minecraft:tick on every
  // permutation carrying a component that listens to onTick.
  event.blockComponentRegistry.registerCustomComponent('ordertocook:bag_motion', {
    onTick: event => tickBagPlacement(event.block)
  });
  event.blockComponentRegistry.registerCustomComponent('ordertocook:meal_tick', {
    onTick: event => { if (ready) dining.tickFood(event.block); }
  });
  event.blockComponentRegistry.registerCustomComponent('ordertocook:interact', {
    beforeOnPlayerPlace: event => {
      if (!ready) { event.cancel = true; return; }
      const typeId = event.permutationToPlace.type.id;
      if (typeId === 'ordertocook:order_machine') {
        const retained = getRestaurant(locationId(event.block.dimension.id, event.block.location));
        if (retained?.removing) {
          event.cancel = true;
          if (event.player) system.run(() => notify(event.player, '舊餐廳仍在保存帳簿或清理餐盤，請完成後再放置。'));
        }
        const maxAllowed = settings.maxOrderMachinesWithin24;
        if (hasMachinePlacementConflict(event.block, maxAllowed)) {
          event.cancel = true;
          if (event.player) system.run(() => {
            if (event.player.isValid) event.player.sendMessage({ rawtext: [
              { text: '§6[下單了]§r ' }, { translate: 'otc.error.machine_placement_conflict', with: [String(maxAllowed)] }
            ] });
          });
        }
      }
      if (typeId === 'ordertocook:refrigerator') {
        const upper = event.block.above();
        if (!upper?.isAir) { event.cancel = true; if (event.player) system.run(() => notify(event.player, '冰箱需要兩格高的空間。')); }
      }
      if (!event.cancel) capturePortablePlacement(event);
    },
    onPlace: event => system.run(() => { try { onPlace(event.block); } catch (error) { console.warn(`[OrderToCook] Place: ${error}`); } }),
    onBreak: event => {
      if (['ordertocook:board', 'ordertocook:order_machine', DINING_BLOCK, 'ordertocook:food_plate_display', 'ordertocook:takeout_bag'].includes(event.brokenBlockPermutation.type.id)) {
        try { onBreak(event); } catch (error) { console.warn(`[OrderToCook] Device break: ${error}`); }
      }
    },
    onPlayerBreak: event => {
      if (!['ordertocook:board', 'ordertocook:order_machine', DINING_BLOCK, 'ordertocook:food_plate_display', 'ordertocook:takeout_bag'].includes(event.brokenBlockPermutation.type.id)) {
        try { onBreak(event); } catch (error) { console.warn(`[OrderToCook] Break: ${error}`); }
      }
    },
    onPlayerInteract: event => { if (event.player) safely(event.player, () => interactBlock(event.player, event.block)); }
  });
  event.blockComponentRegistry.registerCustomComponent('ordertocook:machine_timing', {
    onTick: event => tickMachine(event.block)
  });
  event.itemComponentRegistry.registerCustomComponent('ordertocook:use', {
    onUse: event => onUse(event.source, event.itemStack)
  });
  // Native BDS rejects onConsume on every non-food item sharing a component.
  event.itemComponentRegistry.registerCustomComponent('ordertocook:consume_bag', {
    onConsume: event => consumeBag(event.source, event.itemStack)
  });
});

world.beforeEvents.itemUse.subscribe(event => {
  if (event.itemStack?.typeId !== 'ordertocook:takeout_bag') return;
  if (!ready || !expiredBag(event.itemStack)) {
    event.cancel = true;
    system.run(() => safely(event.source, () => onUse(event.source, event.itemStack)));
  }
});

world.beforeEvents.playerInteractWithBlock.subscribe(event => {
  if (!ready) { if (isFridge(event.block) || isParcelDisplay(event.block) || event.block.typeId === 'ordertocook:stove') event.cancel = true; return; }
  const item = event.itemStack;
  const meal = dining?.atBlock(event.block);
  if (meal) {
    event.cancel = true;
    if (event.isFirstEvent) system.run(() => safely(event.player, () => collectDiningPlate(event.player, meal)));
    return;
  }
  const parcel = ['ordertocook:takeout_bag', 'ordertocook:food_plate'].includes(item?.typeId);
  if (parcel) {
    event.cancel = true;
    if (event.isFirstEvent) system.run(() => safely(event.player, () => placeParcel(event.player, event.block, event.blockFace)));
    return;
  }
  if (event.block.typeId === 'ordertocook:stove' && item?.typeId !== 'ordertocook:otc_upgrade_box') {
    if (appliances.canOpenStove(event.player, event.block)) return;
    event.cancel = true;
    system.run(() => safely(event.player, () => interactBlock(event.player, event.block, { nativeEntryCancelled: true })));
    return;
  }
  if (isFridge(event.block) && item?.typeId !== 'ordertocook:otc_upgrade_box') {
    // Ordinary use opens the native container; sneak-empty use compacts this
    // compartment through the same deferred permission check as other actions.
    const station = findStation(appliances.normalizeBlock(event.block));
    const compact = event.player.isSneaking && !item;
    if (!compact && station?.ownerId && appliances.canOpenFridge(event.player, event.block)) return;
    event.cancel = true;
    if (event.isFirstEvent) system.run(() => safely(event.player, () => interactBlock(event.player, event.block)));
    return;
  }
  if (event.block.typeId.startsWith(PREFIX) || item?.typeId === 'ordertocook:otc_upgrade_box') {
    event.cancel = true;
    // Cancellation suppresses the component callback too. A continuation must
    // still reach our owner; interactBlock already coalesces nearby callbacks.
    system.run(() => safely(event.player, () => interactBlock(event.player, event.block)));
  }
});
world.beforeEvents.playerBreakBlock.subscribe(event => {
  if (!ready || !event.block.typeId.startsWith(PREFIX)) return;
  const block = appliances?.normalizeBlock(event.block) || event.block;
  const restaurant = event.block.typeId === DINING_BLOCK ? dining.atBlock(block)?.restaurant
    : event.block.typeId === 'ordertocook:order_machine' ? getRestaurant(locationId(block.dimension.id, block.location)) : nearestRestaurant(block);
  const station = findStation(block);
  if ((restaurant && !canManage(event.player, restaurant)) || (!restaurant && station?.ownerId && station.ownerId !== event.player.id && !isAdmin(event.player))) {
    event.cancel = true; system.run(() => notify(event.player, '你不是這間餐廳的店主／員工。')); return;
  }
  if (event.block.typeId === 'ordertocook:order_machine' && restaurant) {
    try { restaurantNameIsDefault(restaurant); }
    catch {
      event.cancel = true;
      system.run(() => notify(event.player, '餐廳名稱資料無法讀取；已保留設備與存檔，請先修復資料。'));
      return;
    }
  }
  if (station?.progressEvents?.length) {
    event.cancel = true;
    system.run(() => {
      const current = findStation(block);
      const saved = reconcileStationProgress(current);
      notify(event.player, saved ? '個人進度已保存，請再拆除設備。' : '個人進度仍待保存；設備記錄已保留，稍後再試。');
    });
    return;
  }
  if (event.block.typeId === 'ordertocook:order_machine' && restaurant && (restaurant.active || restaurant.orders.some(order => ['accepted', 'packed'].includes(order.status)))) {
    event.cancel = true; system.run(() => notify(event.player, '先暫停營業，並完成或取消處理中的訂單，才可拆除打單機。'));
  }
});
function onPlayerPlace(event) {
  if (!ready || !event.block.typeId.startsWith(PREFIX)) return;
  const block = appliances?.normalizeBlock(event.block) || event.block;
  const id = locationId(block.dimension.id, block.location);
  const pending = pendingPlacements.get(id);
  pendingPlacements.delete(id);
  const portable = pending?.playerId === event.player.id && pending.typeId === block.typeId && pending.tick === system.currentTick ? pending.data : undefined;
  try {
    const station = getStation(block);
    station.ownerId = event.player.id;
    if (block.typeId === 'ordertocook:board' && portable) Object.assign(station, portable);
    saveStation(station);
    if (block.typeId === 'ordertocook:order_machine') {
      if (portable) {
        const restaurant = createRestaurant({ ...portable, id, dimensionId: block.dimension.id, location: block.location, config: { deliveryRate: settings.deliveryRate, refreshMs: settings.refreshMs, orderMachineUpgradeBoardHunger: settings.orderMachineUpgradeBoardHunger } });
        machineTiming.adopt(restaurant, orderTime());
        Object.assign(restaurant, portable, { pendingDishes: [] });
        queueProgressEvent(restaurant, event.player.id, { type: 'order_machine_placed' });
        saveRestaurant(restaurant);
        reconcileProgress(restaurant);
      } else getMachine(event.player, block, true);
      updateProgressRankings();
    }
  } catch (error) {
    if (!portable) throw error;
    // A synchronous save failure must not consume the only portable snapshot.
    // Replacing the block normally does not emit destruction loot/onBreak.
    block.setType('minecraft:air');
    giveStack(event.player, pending.stack);
    try { deleteStation(id); } catch (cleanupError) { console.warn(`[OrderToCook] Placement record retained: ${cleanupError}`); }
    notify(event.player, '設備資料未能保存，已退回完整原物品，稍後再試。');
    console.warn(`[OrderToCook] Portable placement rolled back: ${error}`);
  }
}
world.afterEvents.playerPlaceBlock.subscribe(onPlayerPlace);
world.afterEvents.playerSpawn.subscribe(event => {
  if (!ready || !event.initialSpawn) return;
  system.runTimeout(() => {
    const player = event.player;
    if (!player.isValid || player.getDynamicProperty('ordertocook:welcomed')) return;
    player.setDynamicProperty('ordertocook:welcomed', true);
    giveItems(player, 'ordertocook:guide', 1);
    notify(player, '已收到餐廳指南。合成打單機開始經營；本版為非官方移植 alpha。');
  }, 40);
});
world.afterEvents.playerLeave.subscribe(event => {
  interactionTicks.delete(event.playerId);
  activeHudPlayers.delete(event.playerId);
});
world.afterEvents.weatherChange.subscribe(event => {
  weatherByDimension.set(event.dimension.replace('minecraft:', ''), event.newWeather);
  if (ready) world.setDynamicProperty('ordertocook:weather', JSON.stringify([...weatherByDimension]));
});

world.afterEvents.worldLoad.subscribe(() => {
  try {
    initStore();
    machineTiming = createMachineTiming({ world, saveRestaurant, getRestaurant,
      refresh: (restaurant, block) => {
        if (syncMenu(restaurant)) saveRestaurant(restaurant);
        if (!restaurant.menu.length || restaurant.orders.filter(order => liveStatus.has(order.status)).length >= 32) return false;
        refreshMachineOrders(restaurant, block);
        return true;
      },
      arrive: (restaurant, block) => {
        if (syncMenu(restaurant)) saveRestaurant(restaurant);
        if (!restaurant.menu.length || restaurant.orders.filter(order => liveStatus.has(order.status)).length >= 32 ||
            Math.random() >= getWalkInChance(restaurant) || !nearbyStations(restaurant.dimensionId, restaurant.location, 24, 'ordertocook:chair', { shape: 'cylinder', halfHeight: 8 }).length) return false;
        const order = generateWalkInOrder(restaurant, orderTime());
        let noEligibleChair = false;
        if (entities.spawnCustomer(restaurant, order, () => { noEligibleChair = true; })) playAt(block, 'order_refresh');
        else if (noEligibleChair && getRestaurant(restaurant.id) === restaurant) {
          // This explicit gate ran before entity allocation. Other spawn misses
          // can have uncertain native outcomes and must retain pending behavior.
          const index = restaurant.orders.indexOf(order);
          if (index >= 0) restaurant.orders.splice(index, 1);
        }
        // Generation consumed an ID and updatedAt, even when its new offer was
        // withdrawn. Persist that bookkeeping and any simultaneous refresh.
        return true;
      }
    });
    const time = orderTime();
    for (const restaurant of restaurants()) {
      let changed = machineTiming.adopt(restaurant, time);
      for (const order of restaurant.orders || []) changed = adoptOrderDeadline(order, time) || changed;
      if (changed) saveRestaurant(restaurant);
    }
    const rawSettings = world.getDynamicProperty('ordertocook:settings');
    if (rawSettings !== undefined) {
      if (typeof rawSettings !== 'string') throw new Error('Expected settings JSON string');
      const saved = JSON.parse(rawSettings);
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Expected settings object');
      // Old saves and invalid field types fail safe to the Java default. Do not
      // repair/write the saved document during load; preserve recovery evidence.
      settings = { ...settings, ...saved, deliveryRate: isDeliveryRate(saved.deliveryRate) ? saved.deliveryRate : Number(DEFAULT_CONFIG.deliveryRate), maxOrderMachinesWithin24: isMachineLimit(saved.maxOrderMachinesWithin24) ? Math.max(1, saved.maxOrderMachinesWithin24) : Number(DEFAULT_CONFIG.maxOrderMachinesWithin24), countertopConsumeLeather: typeof saved.countertopConsumeLeather === 'boolean' ? saved.countertopConsumeLeather : DEFAULT_CONFIG.countertopConsumeLeather };
    }
    const rawFoods = world.getDynamicProperty('ordertocook:food_overrides');
    if (typeof rawFoods === 'string') for (const food of JSON.parse(rawFoods)) foodOverrides.set(food.typeId, food);
    for (const key of world.getDynamicPropertyIds()) {
      if (!key.startsWith('ordertocook:food_override:')) continue;
      try {
        const food = JSON.parse(String(world.getDynamicProperty(key)));
        if (food.typeId && Number.isInteger(food.nutrition) && food.nutrition > 0) foodOverrides.set(food.typeId, food);
      } catch (error) { console.warn(`[OrderToCook] Invalid virtual food entry ${key}; preserved unchanged. ${error}`); }
    }
    const rawWeather = world.getDynamicProperty('ordertocook:weather');
    if (typeof rawWeather === 'string') for (const [id, weather] of JSON.parse(rawWeather)) if (!weatherByDimension.has(id)) weatherByDimension.set(id, weather);
    const smoking = createSmokingRecipeRegistry({ hasItem: id => !!ItemTypes.get(id) });
    const context = { world, system, getStation, saveStation, deleteStation, stations, getRestaurant, restaurants, saveRestaurant, notify, canUseStation, smokingRecipes: smoking.recipes, food: { isFood: stack => !!foodFromStack(stack) }, onCustomerInteract: customerInteract, orderTime,
      onCustomerReactionFinished: (restaurantId, orderId) => dining?.finishReaction(restaurantId, orderId) };
    progression = createProgressionService({ getProfile, saveProfile, restaurants, saveRestaurant, saveStation,
      onUnlock: (playerId, definitions) => {
        const player = world.getAllPlayers().find(value => value.id === playerId);
        if (player?.isValid) for (const definition of definitions) notify(player, `進度達成：${definition.title}`);
      }
    });
    appliances = createApplianceService(context);
    entities = createEntityService(context);
    dining = createDiningService({ ...context, ItemStack, canManage, settleMealBonus,
      getCustomerSeat: entity => entities.getCustomerSeat?.(entity),
      resumeCustomerMeal: (...args) => entities.resumeCustomerMeal?.(...args),
      interruptCustomerMeal: (...args) => entities.interruptCustomerMeal?.(...args)
    });
    ready = true;
    adoptLegacyDisplays();
    appliances.init?.();
    entities.init?.();
    system.runInterval(tickRestaurants, 20);
    system.runInterval(tickPrinters, 2);
    system.runInterval(() => { if (ready) dining.tick(); }, 5);
    system.runInterval(updateHud, 10);
    registerConfiguration();
    requestFoodCatalogs();
    // Recipe suppliers announce after their own worldLoad and answer this one
    // deferred request. Both startup orders work without polling or saved caches.
    system.afterEvents.scriptEventReceive.subscribe(event => {
      if (!ready || event.id !== 'ordertocook:smoking_recipes_v1' || event.sourceType !== 'Server') return;
      try {
        const result = smoking.registerProvider(JSON.parse(event.message));
        if (!result.ok) console.warn(`[OrderToCook] Smoking provider rejected: ${result.reason}`);
      } catch (error) { console.warn(`[OrderToCook] Invalid smoking provider message: ${error}`); }
    });
    system.run(() => system.sendScriptEvent('ordertocook:request_smoking_recipes_v1', JSON.stringify({ version: 1 })));
    console.warn('[OrderToCook] Bedrock 26.60 alpha loaded. Server API 2.11; native refrigerator containers require Upcoming Creator Features.');
  } catch (error) { console.error(`[OrderToCook] Initialization stopped; saved data was preserved. ${error}`); }
});

// Headless native-engine tests import these same adapters. No test hooks are
// exposed through chat, commands, script events or a separately installable pack.
export function getQaHooks() {
  return { ready, capturePortablePlacement, onPlayerPlace, entities, appliances, dining, progression, guideForm, boardForm, foodFromStack, syncMenu, orderBody, parcelFor, updateHud, progressForm, recordProgress, reconcileProgress, updateProgressRankings, reconcileStationProgress, upgradeForm, getMachine, acceptWithTicket, countertopForm, prepareOrderAtCountertop, pickupDisplay, placeParcel, customerInteract, collectDiningPlate, tickRestaurants, tickMachine, machineTiming, refreshMachineOrders, syncPrinter, tickPrinters, itemOrder, onPlace, onBreak, shelfInteract, upgradeAppliance, canUseStation };
}
