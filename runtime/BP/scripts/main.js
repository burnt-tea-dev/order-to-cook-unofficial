// SPDX-License-Identifier: GPL-3.0-only
// Bedrock adapter. World state, inventory and UI stay outside the pure order core.
import { world, system, ItemStack, BlockPermutation, GameMode } from '@minecraft/server';
import {
  createRestaurant, refreshOrders, acceptOrder, packOrder, completeOrder,
  cancelOrder, expireOrders, upgradeRestaurant, getUpgradeQuote,
  getMenuNutrition, addMenuFood, removeMenuFood, generateWalkInOrder,
  getWalkInChance, synchronizeOfferRewards, normalizeFoodId
} from './core.js';
import { VANILLA_FOODS, DEFAULT_MENU, DEFAULT_CONFIG, TIER_LABELS, TIER_COLORS } from './config.js';
import {
  initStore, locationId, getRestaurant, restaurants, saveRestaurant, deleteRestaurant, getProfile, saveProfile,
  getStation, findStation, stations, saveStation, deleteStation,
  nearbyStations, nearestRestaurant, loadedBlock, distanceSquared, setBlockState
} from './store.js';
import {
  containerOf, heldItem, freeSlot, countItem, planExtraction, applyExtraction,
  restoreExtraction, consumeHeld, giveStack, giveItems, coinBalance, giveCoins, payCoins
} from './inventory.js';
import { notify, choose, textInput, safely } from './ui.js';
import { createEntityService } from './entities.js';
import { createApplianceService } from './appliances.js';
import { createDiningService, DINING_ENTITY } from './dining.js';
import { progressRows } from './progression.js';
import { createProgressionService, creditCompletedOrder, queueProgressEvent } from './progression_service.js';

const PREFIX = 'ordertocook:';
const ITEM_RESTAURANT = 'ordertocook:restaurant';
const ITEM_ORDER = 'ordertocook:order_id';
const ITEM_PROOF = 'ordertocook:proof';
const liveStatus = new Set(['offered', 'accepted', 'packed']);
const foods = new Map(VANILLA_FOODS.map(food => [food.typeId, food]));
const foodOverrides = new Map();
const weatherByDimension = new Map();
let settings = { currencyItem: '', refreshMs: Number(DEFAULT_CONFIG.refreshMs), orderMachineUpgradeBoardHunger: [...DEFAULT_CONFIG.orderMachineUpgradeBoardHunger] };
let ready = false;
/** @type {any} */ let entities;
/** @type {any} */ let appliances;
/** @type {any} */ let dining;
/** @type {any} */ let progression;
const activeHudPlayers = new Set();
const interactionTicks = new Map();
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
function playAt(block, sound) {
  try { block.dimension.playSound(`ordertocook:${sound}`, block.location); } catch { /* Cosmetic only. */ }
}
function foodFromStack(stack) {
  if (!stack) return undefined;
  const typeId = normalizeFoodId(stack.typeId);
  const configured = foodOverrides.get(typeId) || foods.get(typeId);
  if (configured) return { ...configured };
  try {
    const component = stack.getComponent('minecraft:food');
    if (component?.nutrition > 0) return { typeId, nutrition: Math.min(10000, Math.floor(component.nutrition)), label: stack.nameTag || typeId };
  } catch { /* Vanilla food properties are supplied by the pinned catalog. */ }
  return undefined;
}
function foodLabel(typeId) { return foodOverrides.get(typeId)?.label || foods.get(typeId)?.label || typeId; }
function syncMenu(restaurant) {
  const candidates = stations().filter(s => s.typeId === 'ordertocook:board' && s.dimensionId === restaurant.dimensionId &&
    (!s.ownerId || s.ownerId === restaurant.ownerId || restaurant.staff?.includes(s.ownerId)) &&
    Math.abs(s.location.x - restaurant.location.x) <= 24 && Math.abs(s.location.z - restaurant.location.z) <= 24 && Math.abs(s.location.y - restaurant.location.y) <= 8 &&
    loadedBlock(s)?.typeId === s.typeId);
  candidates.sort((a, b) => getMenuNutrition(b.menu) - getMenuNutrition(a.menu));
  restaurant.menu = candidates[0]?.menu.map(food => ({ ...foodOverrides.get(food.typeId) || food })) || [];
  restaurant.boardId = candidates[0]?.id || '';
  synchronizeOfferRewards(restaurant);
}
function getMachine(player, block, placedByPlayer = false) {
  const id = locationId(block.dimension.id, block.location);
  let restaurant = getRestaurant(id);
  if (restaurant?.removing) return restaurant;
  if (!restaurant) {
    restaurant = createRestaurant({ id, name: `${player.name} 的餐廳`, ownerId: player.id, ownerName: player.name, dimensionId: block.dimension.id, location: block.location, menu: [], config: { refreshMs: settings.refreshMs, orderMachineUpgradeBoardHunger: settings.orderMachineUpgradeBoardHunger } });
    restaurant.staff = [];
    restaurant.pendingDishes = [];
    if (placedByPlayer) queueProgressEvent(restaurant, player.id, { type: 'order_machine_placed' });
    saveRestaurant(restaurant);
  } else if (placedByPlayer) {
    queueProgressEvent(restaurant, player.id, { type: 'order_machine_placed' });
    saveRestaurant(restaurant);
  }
  if (placedByPlayer) reconcileProgress(restaurant);
  syncMenu(restaurant);
  return restaurant;
}
function balance(player) { return settings.currencyItem ? countItem([containerOf(player)], settings.currencyItem) : coinBalance(player); }
function pay(player, value) {
  return settings.currencyItem ? applyExtraction(planExtraction([containerOf(player)], [{ typeId: settings.currencyItem, amount: value }])) : payCoins(player, value);
}
function reward(player, value) {
  if (settings.currencyItem) giveItems(player, settings.currencyItem, value); else giveCoins(player, value);
}
function currencyLabel() { return settings.currencyItem || 'oTc 幣'; }
function orderHeading(order) {
  return `${TIER_COLORS[order.tier] || '§f'}${TIER_LABELS[order.tier] || '訂單'}§r ${order.walkIn ? '到店' : order.type === 'delivery' ? (order.longDistance ? '遠距外送' : '外送') : '堂食'}${order.rush ? ' §c加急§r' : ''}`;
}
function orderBody(order) {
  const minutes = Math.max(0, Math.ceil((order.expiresAt - Date.now()) / 60000));
  const destination = order.destination ? `\n目的地：${order.destination.x}, ${order.destination.y}, ${order.destination.z}（${order.destination.distance} 格）` : '';
  return `${orderHeading(order)}\n${order.items.map(item => `${foodLabel(item.typeId)} ×${item.amount}`).join('\n')}\n報酬：${order.reward} ${currencyLabel()} + 可能的小費\n剩餘：${minutes} 分鐘${destination}`;
}
function reasonText(reason) {
  return ({ expired: '訂單已逾時。', already_completed: '這張訂單已交付，不能再次領款。', already_packed: '已經打包／裝盤，請取走原本的成品。', already_accepted: '訂單已被接取。', not_found: '找不到這張訂單。', menu_nutrition: '菜單總營養值不足。', max_level: '已達最高等級。', already_cancelled: '這張訂單已取消。' })[reason] || `目前不能執行：${reason}`;
}
function parcelFor(restaurant, order, typeId) {
  const stack = new ItemStack(typeId || (order.type === 'delivery' ? 'ordertocook:takeout_bag' : 'ordertocook:food_plate'));
  stack.nameTag = typeId === 'ordertocook:order' ? `訂單 · ${restaurant.name}` : `${order.type === 'delivery' ? '外送包裹' : '已裝盤餐點'} · ${restaurant.name}`;
  stack.setDynamicProperty(ITEM_RESTAURANT, restaurant.id);
  stack.setDynamicProperty(ITEM_ORDER, order.id);
  if (order.proof) stack.setDynamicProperty(ITEM_PROOF, order.proof);
  stack.setLore([orderHeading(order), ...order.items.map(item => `${foodLabel(item.typeId)} ×${item.amount}`), `報酬 ${order.reward} · ${new Date(order.expiresAt).toISOString().slice(11, 16)} UTC 到期`, ...(order.destination ? [`目的地 X:${order.destination.x} Z:${order.destination.z}`] : []), '使用查看詳情；蹲下點擊方塊頂面可擺放']);
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
  expireOrders(restaurant);
  saveRestaurant(restaurant);
  const available = restaurant.orders.filter(order => order.status === 'offered');
  const working = restaurant.orders.filter(order => ['accepted', 'packed'].includes(order.status));
  const next = Math.max(0, Math.ceil((restaurant.nextRefreshAt - Date.now()) / 1000));
  const selection = await choose(player, `${restaurant.name} · Lv.${restaurant.level}`,
    `${restaurant.active ? '§a營業中' : '§7休息中'}§r\n菜單 ${restaurant.menu.length} 道 · 總營養 ${getMenuNutrition(restaurant)}\n完成 ${restaurant.stats.completed} 單 · 總營業額 ${restaurant.stats.earnings}\n候選 ${available.length} 單 · 處理中 ${working.length} 單\n下次刷新 ${next} 秒 · 隨身餘額 ${balance(player)} ${currencyLabel()}`,
    [restaurant.active ? '暫停接新單' : '開始營業', `候選訂單（${available.length}）`, `處理中的訂單（${working.length}）`, '升級餐廳', '設備商店', '餐廳排行榜', '餐廳設定／員工', '個人進度', '玩法指南']);
  if (selection === undefined || !validRestaurant(player, restaurant, block)) return;
  if (selection === 0) {
    if (!restaurant.active && !restaurant.menu.length) { notify(player, '先在 24 格內放菜單立牌，用食品點擊立牌新增菜式。'); return; }
    restaurant.active = !restaurant.active;
    // Opening a brand new restaurant starts its first round; toggling does not reroll.
    if (restaurant.active && restaurant.orderSequence === 0) refreshOrders(restaurant);
    saveRestaurant(restaurant);
    notify(player, restaurant.active ? '開始營業；打單機每 10 分鐘刷新一輪候選單。' : '已暫停新單，已接訂單仍需按時完成。');
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
      const result = cancelOrder(restaurant, order.id);
      saveRestaurant(restaurant);
      if (result.ok) { entities.cleanupOrder(order.id); removeTickets(player, order.id); notify(player, '訂單已取消。'); }
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
  if (order.walkIn && order.type === 'dine_in' && !nearbyStations(restaurant.dimensionId, restaurant.location, 24, 'ordertocook:chair').length) {
    notify(player, '到店顧客需要餐廳 24 格內有椅子。'); return;
  }
  const result = acceptOrder(restaurant, order.id);
  saveRestaurant(restaurant);
  if (!result.ok) { notify(player, reasonText(result.reason)); return; }
  giveStack(player, parcelFor(restaurant, order, 'ordertocook:order'));
  entities.spawnCustomer(restaurant, order);
  notify(player, '已接單。準備好食品後，在附近操作台選擇裝盤／打包。');
}

async function upgradeForm(player, block, restaurant) {
  syncMenu(restaurant);
  const quote = getUpgradeQuote(restaurant);
  if (quote.reason === 'max_level') { notify(player, reasonText(quote.reason)); return; }
  const choice = await choose(player, `升級至 Lv.${quote.nextLevel}`, `費用 ${quote.cost} ${currencyLabel()}\n菜單營養要求 ${quote.requiredNutrition} · 目前 ${quote.currentNutrition}\n每種菜只按一份計算，堆疊數量不會增加菜單營養。`, ['升級', '返回']);
  if (choice !== 0 || !validRestaurant(player, restaurant, block)) return;
  syncMenu(restaurant);
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
  playAt(block, 'prestige_get');
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
  const selection = await choose(player, '餐廳設定', `店主 ${restaurant.ownerName}\n員工 ${restaurant.staff?.length || 0} 人\n拆除打單機會重置該餐廳的等級與統計。`, ['更改餐廳名稱', '加入在線員工', '移除員工', '返回']);
  if (selection === undefined || !validRestaurant(player, restaurant, block)) return;
  if ((selection === 1 || selection === 2) && restaurant.ownerId !== player.id && !isAdmin(player)) { notify(player, '只有店主可以加入或移除員工。'); return; }
  if (selection === 0) {
    const name = await textInput(player, '餐廳名稱', '最多 32 字', restaurant.name);
    if (name && validRestaurant(player, restaurant, block)) { restaurant.name = name.replace(/§./g, '').slice(0, 32); saveRestaurant(restaurant); }
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
    notify(player, result.ok ? `已加入 ${currentFood.label}，不消耗手中食品。菜單總營養 ${getMenuNutrition(station.menu)}。` : result.reason === 'duplicate_food' ? '菜單已有這道菜。' : reasonText(result.reason));
    return;
  }
  const selection = await choose(player, '菜單立牌', `${station.menu.length}/150 道菜 · 總營養 ${getMenuNutrition(station.menu)}\n用食品點擊可直接加入，空手／蹲下點擊開啟管理。`, ['從背包新增菜品', '查看／移除菜品', '關閉']);
  if (selection === undefined || !validStationAction(player, block, station)) return;
  if (selection === 0) {
    const inventory = containerOf(player);
    const available = new Map();
    for (let slot = 0; slot < inventory.size; slot++) {
      const food = foodFromStack(inventory.getItem(slot));
      if (food && !station.menu.some(item => item.typeId === food.typeId)) available.set(food.typeId, food);
    }
    const options = [...available.values()];
    if (!options.length) { notify(player, '背包沒有新的可識別食品。特殊食品可由管理員註冊虛擬營養。'); return; }
    const index = await choose(player, '新增菜品', '只建立菜單範本，不消耗物品。', options.map(food => `${food.label} · 營養 ${food.nutrition}`));
    if (index !== undefined && validStationAction(player, block, station)) { addMenuFood(station, options[index]); saveStation(station); }
  } else if (selection === 1) {
    const snapshot = [...station.menu];
    if (!snapshot.length) return;
    const index = await choose(player, '點選移除', '每道菜按一份營養計算。', snapshot.map(food => `${food.label} · ${food.nutrition}`));
    if (index !== undefined && validStationAction(player, block, station)) { removeMenuFood(station, snapshot[index].typeId); saveStation(station); }
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
    playAt(block, plates ? 'plate_place' : 'bag_place');
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
  expireOrders(restaurant);
  saveRestaurant(restaurant);
  const orders = restaurant.orders.filter(order => order.status === 'accepted');
  if (!orders.length) { notify(player, '先在打單機接單；已備妥的成品不會重複製作。'); return; }
  const index = await choose(player, '操作台 · 裝盤／打包', '會消耗背包及附近 24 格冰箱內的指定成品食品。\n外送用 5 格內包裝架的皮革，堂食用餐盤架的乾淨盤子。\n請保持操作台上方空置，成品會擺在台上。', orders.map(order => `${orderHeading(order)}\n${order.items.map(item => foodLabel(item.typeId) + ' ×' + item.amount).join('、')}`));
  if (index === undefined || !nearBlock(player, block) || block.typeId !== 'ordertocook:countertop' || !canManage(player, restaurant)) return;
  const order = orders[index];
  return prepareOrderAtCountertop(player, block, restaurant, order);
}

function prepareOrderAtCountertop(player, block, restaurant, order) {
  if (!nearBlock(player, block) || block.typeId !== 'ordertocook:countertop' || !canManage(player, restaurant) || getRestaurant(restaurant.id) !== restaurant || loadedBlock(restaurant)?.typeId !== 'ordertocook:order_machine' || nearestRestaurant(block)?.id !== restaurant.id) return;
  if (!restaurant.orders.includes(order)) return;
  if (order.status !== 'accepted' || Date.now() >= order.expiresAt) { notify(player, '訂單狀態已改變或已逾時。'); return; }
  const output = block.above();
  if (!output?.isAir) { notify(player, '先取走操作台上方的成品／方塊。'); return; }
  const shelfId = order.type === 'delivery' ? 'ordertocook:shelf' : 'ordertocook:plate_shelf';
  const supply = nearbyStations(block.dimension.id, block.location, 5, shelfId).find(station => station.supplies > 0 && canUseStation(player, station));
  if (!supply) { notify(player, `缺少 5 格內的${order.type === 'delivery' ? '包裝架包材（皮革）' : '餐盤架乾淨餐盤'}。`); return; }
  const plan = planExtraction(ingredientContainers(player, block), order.items);
  if (!plan.ok) { notify(player, `食品不足：\n${plan.missing.map(line => { const [id, amount] = line.split(' ×'); return foodLabel(id) + ' ×' + amount; }).join('\n')}`); return; }
  // All inventory/currency/state changes below are synchronous: another form
  // callback cannot interleave between the preflight and this commit.
  const before = JSON.stringify(restaurant);
  const supplyBefore = supply.supplies;
  if (!applyExtraction(plan)) { notify(player, '食品格子已改變，請重新操作。'); return; }
  try {
    const result = packOrder(restaurant, order.id);
    if (!result.ok) throw new Error(reasonText(result.reason));
    order.proof = `${restaurant.orderSequence.toString(36)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    order.outputLocation = { ...output.location };
    order.platedVariant = Math.floor(Math.random() * 10);
    supply.supplies--;
    saveStation(supply);
    saveRestaurant(restaurant);
    output.setPermutation(BlockPermutation.resolve(order.type === 'delivery' ? 'ordertocook:takeout_bag' : 'ordertocook:food_plate_display'));
    const display = getStation(output);
    Object.assign(display, { restaurantId: restaurant.id, orderId: order.id, proof: order.proof, ownerId: restaurant.ownerId });
    saveStation(display);
    if (order.type === 'dine_in') setBlockState(output, 'ordertocook:stage', order.platedVariant * 4 + 1);
    const supplyBlock = loadedBlock(supply);
    if (supplyBlock) setBlockState(supplyBlock, order.type === 'delivery' ? 'ordertocook:papers' : 'ordertocook:plates', supply.supplies);
    removeTickets(player, order.id);
    playAt(block, order.type === 'delivery' ? 'bag_place' : 'food_plate_place');
    notify(player, '餐點已備妥並放到操作台上。空手點擊取走，再拿給對應顧客。');
  } catch (error) {
    restoreExtraction(plan);
    supply.supplies = supplyBefore;
    saveStation(supply);
    saveRestaurant(JSON.parse(before));
    if (output.typeId.startsWith(PREFIX)) output.setType('minecraft:air');
    const display = findStation(output);
    if (display) deleteStation(display);
    throw error;
  }
}

function displayStack(station) {
  const restaurant = getRestaurant(station.restaurantId);
  const order = restaurant?.orders.find(entry => entry.id === station.orderId);
  if (!order || order.status !== 'packed' || station.proof !== order.proof) return undefined;
  return parcelFor(restaurant, order);
}
function pickupDisplay(player, block) {
  const station = getStation(block);
  const stack = displayStack(station);
  if (!stack) { notify(player, '這是空／已失效的展示，沒有可交付的餐點。可直接拆除。'); return; }
  const inventory = containerOf(player);
  const slot = freeSlot(inventory);
  if (slot < 0) { notify(player, '請空出一格背包。'); return; }
  const before = block.permutation;
  try {
    inventory.setItem(slot, stack);
    block.setType('minecraft:air');
    deleteStation(station);
  } catch (error) {
    // The reserved slot was empty. Remove only the exact parcel issued by this
    // attempt, then restore its physical display if a later write failed.
    const issued = inventory.getItem(slot);
    if (issued?.typeId === stack.typeId && issued.getDynamicProperty(ITEM_PROOF) === station.proof) inventory.setItem(slot, undefined);
    block.setPermutation(before);
    saveStation(station);
    throw error;
  }
  playAt(block, 'bag_pickup');
}
function placeParcel(player, clickedBlock, face) {
  if (!nearBlock(player, clickedBlock) || face !== 'Up' || !player.isSneaking) {
    notify(player, '拿餐點點擊顧客交付；蹲下點擊方塊頂面可擺放。'); return;
  }
  const stack = heldItem(player);
  const linked = itemOrder(stack);
  if (!linked || linked.order.status !== 'packed' || linked.order.proof !== linked.proof ||
      stack.typeId !== (linked.order.type === 'delivery' ? 'ordertocook:takeout_bag' : 'ordertocook:food_plate')) { notify(player, '這份餐點已失效。'); return; }
  const output = clickedBlock.above();
  if (!output?.isAir) { notify(player, '上方沒有空間。'); return; }
  let station;
  const slot = player.selectedSlotIndex;
  const inventory = containerOf(player);
  try {
    output.setPermutation(BlockPermutation.resolve(linked.order.type === 'delivery' ? 'ordertocook:takeout_bag' : 'ordertocook:food_plate_display'));
    station = getStation(output);
    Object.assign(station, { restaurantId: linked.restaurant.id, orderId: linked.order.id, proof: linked.proof, ownerId: player.id });
    saveStation(station);
    if (linked.order.type === 'dine_in') setBlockState(output, 'ordertocook:stage', (linked.order.platedVariant || 0) * 4 + 1);
    if (!consumeHeld(player, stack.typeId, 1)) throw new Error('餐點已被移動，未完成擺放');
  } catch (error) {
    // A native write may throw after consuming the item; keep exactly one
    // carrier by removing the failed display before restoring its source slot.
    output.setType('minecraft:air');
    const failed = station || findStation(output);
    if (failed) deleteStation(failed);
    if (!inventory.getItem(slot)) inventory.setItem(slot, stack);
    throw error;
  }
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
      stack.typeId !== (order.type === 'delivery' ? 'ordertocook:takeout_bag' : 'ordertocook:food_plate') ||
      linked.proof !== order.proof || order.status !== 'packed') {
    notify(player, orderBody(order) + '\n請拿對應的已裝盤餐點／外送包裹交付。'); return;
  }
  if (player.dimension.id !== entity.dimension.id || distanceSquared(player.location, entity.location) > 36) return;
  if (order.type === 'delivery' && (!order.destination || player.dimension.id !== order.destination.dimensionId ||
    (player.location.x - order.destination.x) ** 2 + (player.location.z - order.destination.z) ** 2 > 12 ** 2)) {
    notify(player, '尚未抵達這張外送單的目的地。'); return;
  }
  if (order.type === 'dine_in' && !dining.hasVacancy(restaurant, entity)) {
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
    result = completeOrder(restaurant, order.id, now, {
      raining: weather === 'Rain' || weather === 'Thunder', easterEgg: !!order.easterEgg,
      customerSeated: !!entity.getComponent('minecraft:riding')?.entityRidingOn,
      rng: typeof options.rng === 'function' ? options.rng : Math.random
    });
    if (!result.ok) {
      inventory.setItem(slot, stack);
      saveRestaurant(restaurant);
      notify(player, reasonText(result.reason)); return;
    }
    if (order.type === 'dine_in') dining.queueMeal(restaurant, order, entity, now);
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
  entities.finishCustomer(order.id, result.completion);
  dining.tick(now);
  notify(player, `交付成功！獲得 ${result.reward} ${currencyLabel()}${result.tip ? `（含小費 ${result.tip}）` : ''}${result.boomBonus ? `（驚喜加賞 ${result.boomBonus}）` : ''}。${order.type === 'dine_in' ? '顧客用餐後會留下髒餐盤；點擊餐盤或下方桌面收回。' : ''}`);
}

function collectDiningPlate(player, value) {
  const linked = value?.meal ? value : dining?.resolveEntity(value);
  if (!linked) return false;
  const result = dining.claim(player, linked.restaurant, linked.meal);
  if (result.ok) {
    notify(player, result.early ? '顧客還沒吃完就被收盤了；已收回髒餐盤，顧客提前離開。' : '已收回一個髒餐盤，可送去清洗。');
  } else if (result.reason === 'inventory_full') notify(player, '請空出一格背包，或留出髒餐盤的堆疊空間。');
  else if (result.reason === 'permission') notify(player, '只有餐廳店主或員工可收取餐盤。');
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
      (row.id === 'expired_bag_eaten' ? '\n本版尚無食用過期外送包的動作，因此此項不會解鎖。' : ''),
      ['返回個人進度', '關閉']);
    if (action !== 0) return;
  }
}

async function guideForm(player) {
  const selection = await choose(player, '下單了 · 基岩版指南',
    '1. 合成打單機、立牌、操作台、包裝架、餐盤架、椅子、洗碗池。\n' +
    '2. 用食品點擊立牌設定菜單；所有設備放在打單機 24 格內。\n' +
    '3. 皮革補包裝架、乾淨餐盤補餐盤架，兩架距操作台不超過 5 格。\n' +
    '4. 打單機開始營業並接單；準備的是訂單要求的成品食品。\n' +
    '5. 點操作台裝盤／打包，再點台上的成品取走。\n' +
    '6. 拿餐點點對應顧客交付。外送持包裹可看方向和座標。\n' +
    '7. 堂食吃完留下髒盤；洗碗池清洗後回補餐盤架。\n' +
    '8. 金幣購買設備、升級餐廳；工具箱可升級空雙木桶／洗碗池／空煙燻爐。\n\n' +
    '小電驢：使用物品放車、點車騎乘，蹲下點車開保溫箱／控制面板。\n' +
    '機器每 10 分鐘刷新；普通單 30 分鐘，加急 10 分鐘；退出世界期間仍計時。\n' +
    '首次測試請使用新世界。本版為 alpha，詳見專案的功能差異與實機驗收表。',
    ['個人進度', '餐廳排行榜', '關於與授權', ...(isAdmin(player) ? ['領取測試用開店套組'] : []), '關閉']);
  if (selection === 0) await progressForm(player);
  else if (selection === 1) await leaderboardForm(player);
  else if (selection === 2) await aboutAndLicenseForm(player);
  else if (selection === 3 && isAdmin(player)) giveTestKit(player);
}


async function aboutAndLicenseForm(player) {
  await choose(player, '關於與授權 · Order To Cook',
    'Order To Cook／下單了\\n原作者：breezeth（breezeth-CN）\\n原作：github.com/breezeth-CN/OrdertoCook\\n原作發布：curseforge.com/minecraft/mc-mods/order-to-cook\\n\\n基岩版移植與維護：casama233／burnt-tea-dev\\n專案：github.com/burnt-tea-dev/order-to-cook-unofficial\\n上游基準：e59e3dbcabe19b783d9adb933db5fcb8bc1e4642\\n\\n授權：GNU GPL v3（本移植標示 GPL-3.0-only）\\n本作品是非官方的基岩版改編，未獲 Mojang／Microsoft 或原作者背書，亦不代表原 Java 模組。\\n原作程式及素材的來源、轉換與已知授權範圍請查看專案內 LICENSE、THIRD_PARTY_NOTICES.md 及 docs/ASSET_LICENSE_REGISTER.md。',
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
  const station = getStation(normalized);
  if (!station.ownerId) { station.ownerId = player.id; saveStation(station); }
  const restaurant = nearestRestaurant(normalized);
  if (restaurant) return canManage(player, restaurant);
  return station.ownerId === player.id || isAdmin(player);
}
async function interactBlock(player, block) {
  if (!ready || !nearBlock(player, block)) return;
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
  if (appliances?.onInteract(player, block)) return;
  if (entities?.onBlockInteract(player, block)) return;
  if (block.typeId === 'ordertocook:board') await boardForm(player, block);
  else if (block.typeId === 'ordertocook:countertop') await countertopForm(player, block);
  else if (['ordertocook:shelf', 'ordertocook:plate_shelf'].includes(block.typeId)) shelfInteract(player, block);
  else if (['ordertocook:takeout_bag', 'ordertocook:food_plate_display'].includes(block.typeId)) pickupDisplay(player, block);
}

function onUse(player, itemStack) {
  if (!ready || !player?.isValid) return;
  if (['ordertocook:motorcycle', 'ordertocook:controller'].includes(itemStack?.typeId)) { entities?.onItemUse?.(player, itemStack); return; }
  if (itemStack?.typeId === 'ordertocook:guide') { safely(player, () => guideForm(player)); return; }
  if (itemStack?.typeId === 'ordertocook:otc_upgrade_box') { notify(player, '使用工具箱點擊：兩個空木桶的下方木桶、空煙燻爐、或沒有餐盤的洗碗池。'); return; }
  const linked = itemOrder(itemStack);
  if (linked) notify(player, orderBody(linked.order));
}

function onPlace(block) {
  if (!ready || !block?.isValid || !block.typeId.startsWith(PREFIX)) return;
  // The refrigerator's upper half is owned by the lower-half station.
  if (block.typeId === 'ordertocook:refrigerator' && block.permutation.getState('ordertocook:half') === 'upper') return;
  const station = getStation(block);
  if (block.typeId === 'ordertocook:board' && !station.initialized) { station.menu = DEFAULT_MENU.map(food => ({ ...food })); station.initialized = true; saveStation(station); }
  appliances?.onPlace(block);
}
function onBreak(event) {
  if (!ready) return;
  const block = event.block;
  const typeId = event.brokenBlockPermutation.type.id;
  const station = findStation(block);
  if (appliances?.onBreak(block, station, event.brokenBlockPermutation)) return;
  entities?.onBlockBreak(block, station, event.brokenBlockPermutation);
  if (typeId === 'ordertocook:order_machine') {
    const restaurant = getRestaurant(locationId(block.dimension.id, block.location));
    if (restaurant) {
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
    if (['ordertocook:takeout_bag', 'ordertocook:food_plate_display'].includes(typeId)) {
      const stack = displayStack(station);
      if (stack) block.dimension.spawnItem(stack, { ...block.location, y: block.location.y + 0.5 });
    }
    deleteStation(station);
  }
}

function tickRestaurants() {
  if (!ready) return;
  const now = Date.now();
  for (const restaurant of restaurants()) {
    try {
      if (restaurant.removing) {
        for (const order of restaurant.orders) entities.cleanupOrder(order.id);
        if (reconcileProgress(restaurant) && dining.cleanupRestaurant(restaurant, now)) deleteRestaurant(restaurant.id);
        continue;
      }
      const expired = expireOrders(restaurant, now);
      for (const order of expired.orders) entities.cleanupOrder(order.id);
      let changed = expired.expired > 0;
      const machine = loadedBlock(restaurant);
      if (machine?.typeId === 'ordertocook:order_machine') {
        syncMenu(restaurant);
        const living = restaurant.orders.filter(order => liveStatus.has(order.status)).length;
        if (restaurant.active && restaurant.menu.length && living < 32 && now >= restaurant.nextRefreshAt) {
          refreshOrders(restaurant, now);
          playAt(machine, 'order_refresh');
          changed = true;
        }
        if (restaurant.active && restaurant.menu.length && living < 32 && now >= restaurant.nextWalkInAt) {
          restaurant.nextWalkInAt = now + DEFAULT_CONFIG.walkInIntervalMs;
          if (Math.random() < getWalkInChance(restaurant) && nearbyStations(restaurant.dimensionId, restaurant.location, 24, 'ordertocook:chair').length) {
            const order = generateWalkInOrder(restaurant, now);
            entities.spawnCustomer(restaurant, order);
          }
          changed = true;
        }
        const hasOrders = restaurant.orders.some(order => order.status === 'offered');
        setBlockState(machine, 'ordertocook:mode', restaurant.active && hasOrders ? 'waiting' : 'idle');
        setBlockState(machine, 'ordertocook:frame', Math.floor(system.currentTick / 20) % 3);
      }
      if (changed) saveRestaurant(restaurant);
      reconcileProgress(restaurant);
    } catch (error) { console.warn(`[OrderToCook] Restaurant ${restaurant.id}: ${error}`); }
  }
  for (const station of stations()) if (station.progressEvents?.length) reconcileStationProgress(station);
  updateProgressRankings();
}

function deliveryHint(player) {
  const linked = itemOrder(heldItem(player));
  const destination = linked?.order.destination;
  if (!destination || !['accepted', 'packed'].includes(linked.order.status) || linked.order.expiresAt <= Date.now()) return undefined;
  if (player.dimension.id !== destination.dimensionId) return '§e外送目的地位於另一個維度';
  const dx = destination.x - player.location.x, dz = destination.z - player.location.z;
  const distance = Math.round(Math.sqrt(dx * dx + dz * dz));
  const cardinal = `${dz < -5 ? '北' : dz > 5 ? '南' : ''}${dx < -5 ? '西' : dx > 5 ? '東' : ''}` || '已到達';
  return `§6外送 ${cardinal} · ${distance} 格 §fX:${destination.x} Z:${destination.z} · ${Math.max(0, Math.ceil((linked.order.expiresAt - Date.now()) / 60000))} 分`;
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
        if (machine) { syncMenu(machine); if (machine.menu.length) { refreshOrders(machine); saveRestaurant(machine); notify(player, '測試用訂單已刷新。'); } }
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
        if (typeof data.currencyItem === 'string') { if (data.currencyItem) new ItemStack(data.currencyItem); next.currencyItem = data.currencyItem; }
        if (Number.isInteger(data.refreshSeconds) && data.refreshSeconds >= 10 && data.refreshSeconds <= 86400) next.refreshMs = data.refreshSeconds * 1000;
        if (Array.isArray(data.upgradeNutrition) && data.upgradeNutrition.length === 9 && data.upgradeNutrition.every(n => Number.isInteger(n) && n >= 0 && n <= 10000)) next.orderMachineUpgradeBoardHunger = data.upgradeNutrition;
        world.setDynamicProperty('ordertocook:settings', JSON.stringify(next));
        settings = next;
        for (const restaurant of restaurants()) { restaurant.config = { ...restaurant.config, refreshMs: settings.refreshMs, orderMachineUpgradeBoardHunger: settings.orderMachineUpgradeBoardHunger }; saveRestaurant(restaurant); }
        if (player) notify(player, '伺服器餐廳設定已儲存。新刷新間隔於下次刷新後使用。');
      }
    } catch (error) { console.warn(`[OrderToCook] Config: ${error}`); if (player) notify(player, String(error)); }
  });
}

system.beforeEvents.startup.subscribe(event => {
  event.blockComponentRegistry.registerCustomComponent('ordertocook:interact', {
    beforeOnPlayerPlace: event => {
      if (!ready) { event.cancel = true; return; }
      const typeId = event.permutationToPlace.type.id;
      if (typeId === 'ordertocook:order_machine') {
        const nearby = nearestRestaurant(event.block, 24);
        if (nearby) { event.cancel = true; if (event.player) system.run(() => notify(event.player, '打單機需與另一台相隔超過 24 格。')); }
      }
      if (typeId === 'ordertocook:refrigerator') {
        const upper = event.block.above();
        if (!upper?.isAir) { event.cancel = true; if (event.player) system.run(() => notify(event.player, '冰箱需要兩格高的空間。')); }
      }
    },
    onPlace: event => system.run(() => { try { onPlace(event.block); } catch (error) { console.warn(`[OrderToCook] Place: ${error}`); } }),
    onPlayerBreak: event => { try { onBreak(event); } catch (error) { console.warn(`[OrderToCook] Break: ${error}`); } },
    onPlayerInteract: event => { if (event.player) safely(event.player, () => interactBlock(event.player, event.block)); }
  });
  event.itemComponentRegistry.registerCustomComponent('ordertocook:use', {
    onUse: event => onUse(event.source, event.itemStack)
  });
});

world.beforeEvents.playerInteractWithBlock.subscribe(event => {
  if (!ready) return;
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
  if (event.block.typeId.startsWith(PREFIX) || item?.typeId === 'ordertocook:otc_upgrade_box') {
    event.cancel = true;
    if (event.isFirstEvent) system.run(() => safely(event.player, () => interactBlock(event.player, event.block)));
  }
});
world.beforeEvents.playerInteractWithEntity.subscribe(event => {
  if (!ready || event.target?.typeId !== DINING_ENTITY) return;
  event.cancel = true;
  system.run(() => safely(event.player, () => collectDiningPlate(event.player, event.target)));
});
world.beforeEvents.playerBreakBlock.subscribe(event => {
  if (!ready || !event.block.typeId.startsWith(PREFIX)) return;
  const block = appliances?.normalizeBlock(event.block) || event.block;
  const restaurant = event.block.typeId === 'ordertocook:order_machine' ? getRestaurant(locationId(block.dimension.id, block.location)) : nearestRestaurant(block);
  const station = findStation(block);
  if ((restaurant && !canManage(event.player, restaurant)) || (!restaurant && station?.ownerId && station.ownerId !== event.player.id && !isAdmin(event.player))) {
    event.cancel = true; system.run(() => notify(event.player, '你不是這間餐廳的店主／員工。')); return;
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
world.afterEvents.playerPlaceBlock.subscribe(event => {
  if (!ready || !event.block.typeId.startsWith(PREFIX)) return;
  const block = appliances?.normalizeBlock(event.block) || event.block;
  const station = getStation(block);
  station.ownerId = event.player.id;
  saveStation(station);
  if (block.typeId === 'ordertocook:order_machine') {
    getMachine(event.player, block, true);
    updateProgressRankings();
  }
});
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
    const rawSettings = world.getDynamicProperty('ordertocook:settings');
    if (typeof rawSettings === 'string') settings = { ...settings, ...JSON.parse(rawSettings) };
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
    const context = { world, system, getStation, saveStation, deleteStation, stations, getRestaurant, restaurants, saveRestaurant, notify, canUseStation, food: { isFood: stack => !!foodFromStack(stack) }, onCustomerInteract: customerInteract };
    progression = createProgressionService({ getProfile, saveProfile, restaurants, saveRestaurant, saveStation,
      onUnlock: (playerId, definitions) => {
        const player = world.getAllPlayers().find(value => value.id === playerId);
        if (player?.isValid) for (const definition of definitions) notify(player, `進度達成：${definition.title}`);
      }
    });
    appliances = createApplianceService(context);
    entities = createEntityService(context);
    dining = createDiningService({ ...context, ItemStack, canManage,
      getCustomerSeat: entity => entities.getCustomerSeat?.(entity),
      resumeCustomerMeal: (...args) => entities.resumeCustomerMeal?.(...args),
      interruptCustomerMeal: (...args) => entities.interruptCustomerMeal?.(...args)
    });
    ready = true;
    appliances.init?.();
    entities.init?.();
    system.runInterval(tickRestaurants, 20);
    system.runInterval(() => { if (ready) dining.tick(); }, 5);
    system.runInterval(updateHud, 10);
    registerConfiguration();
    console.warn('[OrderToCook] Bedrock alpha loaded. Stable API 2.0; no experimental toggles required.');
  } catch (error) { console.error(`[OrderToCook] Initialization stopped; saved data was preserved. ${error}`); }
});

// Headless native-engine tests import these same adapters. No test hooks are
// exposed through chat, commands, script events or a separately installable pack.
export function getQaHooks() {
  return { ready, entities, appliances, dining, progression, updateHud, progressForm, recordProgress, reconcileProgress, updateProgressRankings, reconcileStationProgress, upgradeForm, getMachine, acceptWithTicket, prepareOrderAtCountertop, pickupDisplay, placeParcel, customerInteract, collectDiningPlate, tickRestaurants, itemOrder, onPlace, onBreak, shelfInteract, upgradeAppliance, canUseStation };
}
