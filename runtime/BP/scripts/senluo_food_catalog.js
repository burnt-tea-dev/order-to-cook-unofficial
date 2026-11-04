// SPDX-License-Identifier: GPL-3.0-only
// Optional suppliers: these definitions never make an absent addon mandatory.
// Grilling main 7ba0c6ac0461f56d4de4d4aafd15baaddedc05af, data/java/foods.json
// pins Java 1.1.1 9a1acdab27698457bec16c9362678e574895a28c (NeoForge).
// OTC Java uses the Item's base food nutrition. Eating-duration and cuisine
// quality IDs below alias that Item; heat, seasoning and quality add no bonus.
// [item path, base nutrition, label, optional suffixes of equivalent native IDs]
/** @type {Array<[string, number, string, string[]?]>} */
const GRILLING = [
  ["braised_chicken_wings", 10, "紅燒雞翅", ["_cuisine_q0", "_cuisine_q1", "_cuisine_q2", "_cuisine_q3"]],
  ["chicken_wing", 2, "雞翅"],
  ["cold_houttuynia", 6, "涼拌折耳根"],
  ["dark_grilling", 1, "黑暗燒烤", ["_native_plain", "_java_three_alt"]],
  ["green_pepper_squid_tentacles", 8, "青椒炒魷魚鬚", ["_cuisine_q0", "_cuisine_q1", "_cuisine_q2", "_cuisine_q3"]],
  ["grilled_beef_skewer", 5, "烤牛肉串", ["_native_plain"]],
  ["grilled_bun_slice_skewer", 5, "烤饅頭片串", ["_native_plain"]],
  ["grilled_caterpillar_skewer", 12, "烤豬兒蟲串", ["_native_plain"]],
  ["grilled_chicken_skin_skewer", 4, "烤雞皮串", ["_native_plain"]],
  ["grilled_ender_pearl_skewer", 4, "烤末影珍珠串", ["_native_plain"]],
  ["grilled_fish_skewer", 6, "烤魚串", ["_native_plain"]],
  ["grilled_fried_egg_skewer", 4, "烤煎蛋串", ["_native_plain"]],
  ["grilled_gluten_skewer", 6, "烤麵筋串", ["_native_plain", "_java_three_alt"]],
  ["grilled_golden_skewer", 12, "黃金烤串", ["_native_plain", "_java_three_alt"]],
  ["grilled_lamb_skewer", 8, "烤羊肉串", ["_native_plain", "_java_three_alt"]],
  ["grilled_meat_and_bone_skewer", 4, "烤骨肉相連串", ["_native_plain", "_java_three_alt"]],
  ["grilled_meatball_skewer", 12, "烤丸子串", ["_native_plain", "_java_three_alt"]],
  ["grilled_mid_wing_skewer", 7, "烤中翅串", ["_native_plain", "_java_three_alt"]],
  ["grilled_mushroom_skewer", 5, "烤蘑菇串", ["_native_plain", "_java_three_alt"]],
  ["grilled_pork_belly_skewer", 5, "烤五花肉串", ["_native_plain"]],
  ["grilled_potato_slice_skewer", 6, "烤馬鈴薯片串", ["_native_plain", "_java_three_alt"]],
  ["grilled_slime_skewer", 4, "烤黏液串", ["_native_plain"]],
  ["grilled_squid_tentacle_skewer", 5, "烤魷魚鬚串", ["_native_plain", "_java_three_alt"]],
  ["grilled_sweet_potato_sheet_skewer", 6, "烤苕皮串", ["_native_plain"]],
  ["houttuynia", 2, "折耳根"],
  ["houttuynia_stir_fried_pork", 9, "折耳根炒肉", ["_cuisine_q0", "_cuisine_q1", "_cuisine_q2", "_cuisine_q3"]],
  ["mysterious_skewer", 2, "迷之烤串", ["_native_plain", "_java_three_alt"]],
  ["ordinary_skewer", 5, "“普通”烤串", ["_native_plain", "_java_three_alt"]],
  ["pepper_honey", 4, "花椒蜂蜜"],
  ["potato_beef_stew", 12, "馬鈴薯燉牛肉（煙火版）"],
  ["raw_beef_skewer", 2, "生牛肉串", ["_native_plain"]],
  ["raw_bun_slice_skewer", 2, "生饅頭片串", ["_native_plain"]],
  ["raw_caterpillar_skewer", 6, "生豬兒蟲串", ["_native_plain"]],
  ["raw_chicken_skin_skewer", 2, "生雞皮串", ["_native_plain"]],
  ["raw_ender_pearl_skewer", 2, "生末影珍珠串", ["_native_plain"]],
  ["raw_fish_skewer", 3, "生魚串", ["_native_plain"]],
  ["raw_fried_egg_skewer", 2, "生煎蛋串", ["_native_plain"]],
  ["raw_gluten_skewer", 3, "生麵筋串", ["_native_plain", "_java_three_alt"]],
  ["raw_golden_skewer", 6, "生黃金烤串", ["_native_plain", "_java_three_alt"]],
  ["raw_lamb_skewer", 4, "生羊肉串", ["_native_plain", "_java_three_alt"]],
  ["raw_meat_and_bone_skewer", 2, "生骨肉相連串", ["_native_plain", "_java_three_alt"]],
  ["raw_meatball_skewer", 4, "生丸子串", ["_native_plain", "_java_three_alt"]],
  ["raw_mid_wing_skewer", 3, "生中翅串", ["_native_plain", "_java_three_alt"]],
  ["raw_mushroom_skewer", 2, "生蘑菇串", ["_native_plain", "_java_three_alt"]],
  ["raw_pork_belly_skewer", 2, "生五花肉串", ["_native_plain"]],
  ["raw_potato_slice_skewer", 3, "生馬鈴薯片串", ["_native_plain", "_java_three_alt"]],
  ["raw_slime_skewer", 2, "生黏液串", ["_native_plain"]],
  ["raw_squid_tentacle_skewer", 2, "生魷魚鬚串", ["_native_plain", "_java_three_alt"]],
  ["raw_sweet_potato_sheet_skewer", 3, "生苕皮串", ["_native_plain"]],
  ["red_sweet_potato_porridge", 14, "紅苕稀飯"],
  ["roasted_chicken_wing", 5, "烤雞翅"],
  ["roasted_sweet_potato", 6, "烤番薯"],
  // Java OTC reads the Item's base food properties, not stack-aware eating
  // nutrition. Secret ingredients and plate contents therefore remain 1.
  ["secret_skewer", 1, "秘製烤串", ["_native_plain", "_java_three_alt"]],
  // Java registers this edible ingredient at 1. Bedrock harvests the real ID;
  // its missing handheld eating component does not change OTC menu nutrition.
  ["sichuan_pepper", 1, "花椒"],
  ["skewer_plate", 1, "烤串盤"],
  ["sour_spicy_noodles", 10, "酸辣粉"],
  ["sugared_tomato", 6, "糖拌番茄"],
  ["sweet_potato", 3, "番薯"],
  ["wedding_candy", 20, "喜糖"],
];

// Tavern main 5b209aa9b365735bcbfcb42eea232fb90bf71c10, runtime/BP/items.
// 世界名酒 main 3424205a3c4a68b93316d15516594a2f3fb1c14d, runtime/BP/items.
// Fruit and snacks have positive authored nutrition; alcoholic effects do not.
/** @type {Array<[string, number, string]>} */
const FRUIT_AND_SNACKS = [
  ["kaleidoscope_tavern:gold_grape", 2, "金葡萄"],
  ["kaleidoscope_tavern:grape", 2, "葡萄"],
  ["kaleidoscope_tavern:green_grape", 2, "青提"],
  ["kaleidoscope_tavern:ice_grape", 2, "冰葡萄"],
  ["kaleidoscope_world_liquor:kita_stuffed_crisp", 5, "喜多夾心脆"],
  ["kaleidoscope_world_liquor:liangshan_ice_cone", 5, "涼山田筒"],
  ["kaleidoscope_world_liquor:magic_crispy_corner", 5, "妙脆角"],
  ["kaleidoscope_world_liquor:pochi_pudding", 5, "波奇布丁"],
];

export const SENLUO_FOODS = Object.freeze([
  ...GRILLING.map(([path, nutrition, label, suffixes]) => {
    const typeId = `kaleidoscope_grilling:${path}`;
    return Object.freeze({ typeId, nutrition, label,
      ...(suffixes ? { aliases: Object.freeze(suffixes.map(suffix => typeId + suffix)) } : {})
    });
  }),
  ...FRUIT_AND_SNACKS.map(([typeId, nutrition, label]) => Object.freeze({ typeId, nutrition, label }))
]);

// These are a processing ingredient and a tool, not restaurant foods.
// Their zero-nutrition use-trigger components do not make them edible.
export const SENLUO_UNSUPPORTED_IDS = Object.freeze([
  'kaleidoscope_grilling:skewer_recipe_book',
  'kaleidoscope_grilling:sweet_potato_powder'
]);
