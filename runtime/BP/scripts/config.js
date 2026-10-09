// SPDX-License-Identifier: GPL-3.0-only
// Order To Cook Bedrock unofficial port.
// Gameplay values: breezeth-CN/OrdertoCook, commit e59e3dbcabe19b783d9adb933db5fcb8bc1e4642.
// See docs/UPSTREAM_RULES.md for provenance and intentional platform differences.

export const NAMESPACE = "ordertocook";
export const UPSTREAM_COMMIT = "e59e3dbcabe19b783d9adb933db5fcb8bc1e4642";
export const UPSTREAM_VERSION = "1.3.7a";
export const MAX_LEVEL = 8;
export const MENU_CAPACITY = 150;
export const TIER_LABELS = Object.freeze(["普通", "優質", "高級", "豪華", "頂級"]);
export const TIER_COLORS = Object.freeze(["§f", "§a", "§9", "§d", "§c"]);
export const ORDER_SLOT_COUNTS = Object.freeze([1, 2, 3, 3, 4, 5, 5, 5, 5]);
export const UPGRADE_COSTS = Object.freeze([0, 2, 20, 40, 100, 300, 500, 500, 800]);
export const UPGRADE_NUTRITION = Object.freeze([0, 40, 80, 120, 160, 200, 300, 400, 600]);
export const HUNGER_BONUS_RATES = Object.freeze([0, 0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50, 0.75]);
export const URGENT_LEVEL_BONUSES = Object.freeze([0, 0, 0, 0.05, 0.05, 0.10, 0.15, 0.25, 0.30]);
export const DELIVERY_LEVEL_BONUSES = Object.freeze([0, 0, 0, 0, 0, 0.30, 0.40, 0.50, 1.00]);
export const PURPLE_WEIGHT_BONUSES = Object.freeze([0, 0, 0, 0.05, 0.05, 0.08, 0.10, 0.20, 0.20]);
export const RED_WEIGHT_BONUSES = Object.freeze([0, 0, 0, 0.02, 0.03, 0.03, 0.05, 0.10, 0.20]);
export const TIER_FOOD_KINDS = Object.freeze([1, 2, 3, 4, 6]);
export const TIER_MAX_COUNTS = Object.freeze([2, 3, 4, 5, 6]);
export const COIN_DENOMINATIONS = Object.freeze([10000, 100, 20, 5, 1]);
export const COIN_VALUES = Object.freeze(Object.fromEntries(
  COIN_DENOMINATIONS.map(value => [NAMESPACE + ":chef_coin_" + value, value])
));

export const DEFAULT_CONFIG = Object.freeze({
  maxLevel: MAX_LEVEL,
  menuCapacity: MENU_CAPACITY,
  maxOrderMachinesWithin24: 1,
  orderMachineRefreshSeconds: 600,
  refreshMs: 600000,
  walkInAttemptIntervalSeconds: 60,
  walkInIntervalMs: 60000,
  normalDurationMs: 1800000,
  rushDurationMs: 600000,
  orderMachineUpgradeBoardHunger: UPGRADE_NUTRITION,
  upgradeCosts: UPGRADE_COSTS,
  tierWeights: Object.freeze([50, 25, 15, 8, 2]),
  defaultCoinArray: Object.freeze([1, 2, 3, 4, 6]),
  walkInChances: Object.freeze([0, 0, 0, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35]),
  deliveryRate: 0.30,
  urgentRate: 0.10,
  longDistanceDeliveryChance: 0.10,
  rushBonus: 3,
  deliveryMultiplier: 1.8,
  longDistanceDeliveryMultiplier: 4.0,
  shortMinDistance: 50,
  shortMaxDistance: 450,
  longMinDistance: 1500,
  longMaxDistance: 3000,
  normalCustomerRate: 0.90,
  easterEggCustomerRate: 0.10,
  tipNormalChance: 0.10,
  tipUrgentChance: 0.50,
  tipEasterEggCustomerChance: 1.0,
  tipMin: 1,
  tipMax: 3,
  rainTipMin: 3,
  rainTipMax: 5,
  customCurrencyItem: "",
  countertopConsumeLeather: true
});

export const TOOL_CONSTANTS = Object.freeze({
  boardScanRadius: 24,
  chairScanRadius: 24,
  scanVertical: 8,
  scanCacheTicks: 200,
  ingredientRadius: 24,
  supplyRadius: 5,
  packagingShelfCapacity: 10,
  plateShelfCapacity: 18,
  dishwasherCapacity: 16,
  dishwasherLoadTicks: 30,
  dishwasherWashTicks: 40,
  dishwasherLargeWashTicks: 80,
  dishwasherOutputTicks: 24,
  deliverySubmitRadius: 12
});

// Canonical IDs were checked against Mojang's item registry, rather than
// the legacy filenames/identifiers still used by some example item JSONs.
// Nutrition facts: Mojang/bedrock-samples @ 46ba6ea985fb5a92d79a9419198f10dda14c199d.
export const VANILLA_FOODS = Object.freeze([
  {
    "typeId": "minecraft:apple",
    "nutrition": 4,
    "label": "蘋果"
  },
  {
    "typeId": "minecraft:enchanted_golden_apple",
    "nutrition": 4,
    "label": "附魔金蘋果"
  },
  {
    "typeId": "minecraft:baked_potato",
    "nutrition": 5,
    "label": "烤馬鈴薯"
  },
  {
    "typeId": "minecraft:beef",
    "nutrition": 3,
    "label": "生牛肉"
  },
  {
    "typeId": "minecraft:beetroot",
    "nutrition": 1,
    "label": "甜菜根"
  },
  {
    "typeId": "minecraft:beetroot_soup",
    "nutrition": 6,
    "label": "甜菜湯"
  },
  {
    "typeId": "minecraft:bread",
    "nutrition": 5,
    "label": "麵包"
  },
  {
    "typeId": "minecraft:carrot",
    "nutrition": 3,
    "label": "胡蘿蔔"
  },
  {
    "typeId": "minecraft:chicken",
    "nutrition": 2,
    "label": "生雞肉"
  },
  {
    "typeId": "minecraft:chorus_fruit",
    "nutrition": 4,
    "label": "歌萊果"
  },
  {
    "typeId": "minecraft:tropical_fish",
    "nutrition": 1,
    "label": "熱帶魚"
  },
  {
    "typeId": "minecraft:cooked_beef",
    "nutrition": 8,
    "label": "牛排"
  },
  {
    "typeId": "minecraft:cooked_chicken",
    "nutrition": 6,
    "label": "熟雞肉"
  },
  {
    "typeId": "minecraft:cooked_cod",
    "nutrition": 5,
    "label": "熟鱈魚"
  },
  {
    "typeId": "minecraft:cooked_porkchop",
    "nutrition": 8,
    "label": "熟豬肉"
  },
  {
    "typeId": "minecraft:cooked_rabbit",
    "nutrition": 5,
    "label": "熟兔肉"
  },
  {
    "typeId": "minecraft:cooked_salmon",
    "nutrition": 6,
    "label": "熟鮭魚"
  },
  {
    "typeId": "minecraft:cookie",
    "nutrition": 2,
    "label": "餅乾"
  },
  {
    "typeId": "minecraft:dried_kelp",
    "nutrition": 1,
    "label": "乾海帶"
  },
  {
    "typeId": "minecraft:cod",
    "nutrition": 2,
    "label": "生鱈魚"
  },
  {
    "typeId": "minecraft:glow_berries",
    "nutrition": 2,
    "label": "發光莓果"
  },
  {
    "typeId": "minecraft:golden_apple",
    "nutrition": 4,
    "label": "金蘋果"
  },
  {
    "typeId": "minecraft:golden_carrot",
    "nutrition": 6,
    "label": "金胡蘿蔔"
  },
  {
    "typeId": "minecraft:honey_bottle",
    "nutrition": 6,
    "label": "蜂蜜瓶"
  },
  {
    "typeId": "minecraft:melon_slice",
    "nutrition": 2,
    "label": "西瓜片"
  },
  {
    "typeId": "minecraft:mushroom_stew",
    "nutrition": 6,
    "label": "蘑菇湯"
  },
  {
    "typeId": "minecraft:cooked_mutton",
    "nutrition": 6,
    "label": "熟羊肉"
  },
  {
    "typeId": "minecraft:mutton",
    "nutrition": 2,
    "label": "生羊肉"
  },
  {
    "typeId": "minecraft:poisonous_potato",
    "nutrition": 2,
    "label": "毒馬鈴薯"
  },
  {
    "typeId": "minecraft:porkchop",
    "nutrition": 3,
    "label": "生豬肉"
  },
  {
    "typeId": "minecraft:potato",
    "nutrition": 1,
    "label": "馬鈴薯"
  },
  {
    "typeId": "minecraft:pufferfish",
    "nutrition": 1,
    "label": "河豚"
  },
  {
    "typeId": "minecraft:pumpkin_pie",
    "nutrition": 8,
    "label": "南瓜派"
  },
  {
    "typeId": "minecraft:rabbit",
    "nutrition": 3,
    "label": "生兔肉"
  },
  {
    "typeId": "minecraft:rabbit_stew",
    "nutrition": 10,
    "label": "兔肉湯"
  },
  {
    "typeId": "minecraft:rotten_flesh",
    "nutrition": 4,
    "label": "腐肉"
  },
  {
    "typeId": "minecraft:salmon",
    "nutrition": 2,
    "label": "生鮭魚"
  },
  {
    "typeId": "minecraft:spider_eye",
    "nutrition": 2,
    "label": "蜘蛛眼"
  },
  {
    "typeId": "minecraft:suspicious_stew",
    "nutrition": 6,
    "label": "可疑的燉湯"
  },
  {
    "typeId": "minecraft:sweet_berries",
    "nutrition": 2,
    "label": "甜莓果"
  }
].map(food => Object.freeze(food)));

export const VANILLA_FOOD_BY_ID = Object.freeze(Object.fromEntries(
  VANILLA_FOODS.map(food => [food.typeId, food])
));
export const DEFAULT_MENU = Object.freeze([
  "minecraft:cooked_porkchop", "minecraft:cooked_chicken",
  "minecraft:cooked_mutton", "minecraft:bread"
].map(typeId => VANILLA_FOOD_BY_ID[typeId]));

export const LEGACY_FOOD_ALIASES = Object.freeze({
  "minecraft:fish": "minecraft:cod",
  "minecraft:cooked_fish": "minecraft:cooked_cod",
  "minecraft:clownfish": "minecraft:tropical_fish",
  "minecraft:melon": "minecraft:melon_slice",
  "minecraft:muttonraw": "minecraft:mutton",
  "minecraft:muttoncooked": "minecraft:cooked_mutton",
  "minecraft:appleenchanted": "minecraft:enchanted_golden_apple"
});

