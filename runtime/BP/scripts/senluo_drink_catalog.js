// SPDX-License-Identifier: GPL-3.0-only
// Optional supplier snapshots, audited against:
// Tavern main 5b209aa9b365735bcbfcb42eea232fb90bf71c10
// World Liquor main 3424205a3c4a68b93316d15516594a2f3fb1c14d
// Sources: runtime/BP/items, runtime/RP/texts/zh_TW.lang, Tavern
// bedrock/{drink-effects,mixology,drink-completion}.js, and World Liquor
// bottled-drink.js. These items are consumed as drinks and have zero base
// food nutrition. Status effects, alcohol and quality are not nutrition.
//
// Zero-nutrition drink service is an explicit Bedrock menu extension: Java
// OTC MenuFoodCompatApi.Result.allowed() requires positive nutrition by default.
// Quality q1..q6 represents one Java Item, so use an existing q1 ID and
// accept the other five IDs without multiplying menu nutrition or rewards.
/** @type {Array<[string, string]>} */
const QUALITY_DRINKS = [
  ["kaleidoscope_tavern:brandy", "白蘭地"],
  ["kaleidoscope_tavern:carignan", "佳麗釀"],
  ["kaleidoscope_tavern:champagne", "香檳"],
  ["kaleidoscope_tavern:glowflower_brew", "螢花釀"],
  ["kaleidoscope_tavern:honey_wine", "蜂蜜葡萄酒"],
  ["kaleidoscope_tavern:ice_wine", "冰葡萄酒"],
  ["kaleidoscope_tavern:luminous_bride", "流明新娘"],
  ["kaleidoscope_tavern:madame_shexiang", "麝香夫人"],
  ["kaleidoscope_tavern:miners_star", "礦工之星"],
  ["kaleidoscope_tavern:mother_snow", "雪之母"],
  ["kaleidoscope_tavern:plum_wine", "梅酒"],
  ["kaleidoscope_tavern:polaris_sweet_white", "北極星甜白"],
  ["kaleidoscope_tavern:red_queen", "紅皇后"],
  ["kaleidoscope_tavern:riesling_dry_white", "雷司令乾白"],
  ["kaleidoscope_tavern:rum", "朗姆酒"],
  ["kaleidoscope_tavern:sakura_wine", "櫻花酒"],
  ["kaleidoscope_tavern:sauvignon_blanc_dry_white", "長相思乾白"],
  ["kaleidoscope_tavern:sherry", "雪莉"],
  ["kaleidoscope_tavern:sunset_glow", "落日餘暉"],
  ["kaleidoscope_tavern:sweet_berry_wine", "甜莓酒"],
  ["kaleidoscope_tavern:vinegar", "醋"],
  ["kaleidoscope_tavern:vodka", "伏特加"],
  ["kaleidoscope_tavern:whiskey", "威士忌"],
  ["kaleidoscope_tavern:wine", "葡萄酒"],
  ["kaleidoscope_world_liquor:absolut_vodka", "絕對伏特加"],
  ["kaleidoscope_world_liquor:bacardi_carta_blanca", "百加得白朗姆"],
  ["kaleidoscope_world_liquor:bamboo_leaf_green_liquor", "竹葉青"],
  ["kaleidoscope_world_liquor:bombay_sapphire_gin", "孟買藍寶石金酒"],
  ["kaleidoscope_world_liquor:cool_tea", "勁涼冰紅茶"],
  ["kaleidoscope_world_liquor:dassai", "獺祭"],
  ["kaleidoscope_world_liquor:ice_tea", "冰紅茶"],
  ["kaleidoscope_world_liquor:jack_daniel", "傑克丹尼"],
  ["kaleidoscope_world_liquor:johnnie_walker", "尊尼獲加"],
  ["kaleidoscope_world_liquor:kwas_chlebowy", "格瓦斯"],
  ["kaleidoscope_world_liquor:lafite_1982", "拉菲1982"],
  ["kaleidoscope_world_liquor:maotai", "飛天茅臺"],
  ["kaleidoscope_world_liquor:pina_colada", "馬利寶椰子朗姆酒"],
  ["kaleidoscope_world_liquor:skyy_vodka", "深藍伏特加"],
  ["kaleidoscope_world_liquor:smirnoff_red_vodka", "斯米諾紅牌伏特加"],
  ["kaleidoscope_world_liquor:sour_plum", "酸梅湯"],
  ["kaleidoscope_world_liquor:spiryt_vodka", "生命之水96"],
  ["kaleidoscope_world_liquor:strongbow", "詩莊堡"],
];

// Signature/mystery cocktails keep their Java Item identity. This catalog
// does not claim a private color/effect payload identifies a distinct recipe.
// Six juice buckets are drinkable (poison cure + bucket return), despite
// also being ingredients for pressing/brewing. No empty vessels are listed.
/** @type {Array<[string, string]>} */
const SINGLE_DRINKS = [
  ["kaleidoscope_tavern:allium_garden", "蔥花園"],
  ["kaleidoscope_tavern:bloody_mary", "血腥瑪麗"],
  ["kaleidoscope_tavern:brass_heart", "黃銅之心"],
  ["kaleidoscope_tavern:depth_charge", "深水炸彈"],
  ["kaleidoscope_tavern:emerald", "翡翠"],
  ["kaleidoscope_tavern:glow_berries_bucket", "發光漿果桶"],
  ["kaleidoscope_tavern:godfather", "教父"],
  ["kaleidoscope_tavern:gold_grape_bucket", "黃金葡萄桶"],
  ["kaleidoscope_tavern:grape_bucket", "葡萄桶"],
  ["kaleidoscope_tavern:grasshopper", "蚱蜢"],
  ["kaleidoscope_tavern:green_grape_bucket", "青提葡萄桶"],
  ["kaleidoscope_tavern:ice_grape_bucket", "冰葡萄桶"],
  ["kaleidoscope_tavern:mojito", "莫希托"],
  ["kaleidoscope_tavern:mystery_cocktail", "神秘雞尾酒"],
  ["kaleidoscope_tavern:nether_special", "下界特調"],
  ["kaleidoscope_tavern:screwdriver", "螺絲起子"],
  ["kaleidoscope_tavern:sculk_special", "幽匿特調"],
  ["kaleidoscope_tavern:signature_cocktail", "特調雞尾酒"],
  ["kaleidoscope_tavern:sweet_berries_bucket", "甜漿果桶"],
  ["kaleidoscope_tavern:watermelon_juice", "西瓜汁"],
  ["kaleidoscope_tavern:white_lady", "白色佳人"],
  ["kaleidoscope_world_liquor:around_the_world", "環遊世界"],
  ["kaleidoscope_world_liquor:cola", "可樂"],
  ["kaleidoscope_world_liquor:gin_tonic", "金湯力"],
  ["kaleidoscope_world_liquor:highball", "嗨棒"],
  ["kaleidoscope_world_liquor:jerk", "渣男"],
  ["kaleidoscope_world_liquor:long_island_iced_tea", "長島冰茶"],
  ["kaleidoscope_world_liquor:pine_colada", "椰林飄香"],
  ["kaleidoscope_world_liquor:shrimp_cocktail", "鮮蝦雞尾酒"],
  ["kaleidoscope_world_liquor:tonic_water", "湯力水"],
];

export const SENLUO_DRINKS = Object.freeze([
  ...QUALITY_DRINKS.map(([typeId, label]) => Object.freeze({
    typeId: `${typeId}_q1`, nutrition: 0, servingKind: "drink", label,
    aliases: Object.freeze([2, 3, 4, 5, 6].map(quality => `${typeId}_q${quality}`))
  })),
  ...SINGLE_DRINKS.map(([typeId, label]) => Object.freeze({
    typeId, nutrition: 0, servingKind: "drink", label
  }))
]);
