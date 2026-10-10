// SPDX-License-Identifier: GPL-3.0-only
// Read-only Bedrock HUD adaptation of the pinned upstream Jade providers.
// Source: forge-1.20.1/src/main/java/cn/breezeth/ordertocook/compat/jade/OrderToCookJadePlugin.java
// The stove readout adapts the existing Bedrock stove form; it is not a Java Jade provider.
import { TOOL_CONSTANTS } from "./config.js";

export const INSPECTION_TYPES = Object.freeze([
  "ordertocook:shelf", "ordertocook:plate_shelf", "ordertocook:washingtable",
  "ordertocook:dishwasher", "ordertocook:refrigerator", "ordertocook:stove",
]);

const titles = Object.freeze({
  "ordertocook:shelf": "包裝架",
  "ordertocook:plate_shelf": "餐盤架",
  "ordertocook:washingtable": "洗碗池",
  "ordertocook:dishwasher": "洗碗機",
  "ordertocook:refrigerator": "冰箱",
  "ordertocook:stove": "爐灶",
});

const boundedCount = (value, maximum) => Number.isInteger(value) && value >= 0 && value <= maximum;

/**
 * A copied, non-authoritative snapshot only. Formatting never repairs or saves
 * state, and invalid/missing data never turns into a misleading zero count.
 * @param {{
 *   typeId: string, supplies?: number, upper?: boolean, occupied?: number,
 *   storageLoaded?: boolean,
 *   appliance?: { phase: number, remainingTicks: number, plates: number,
 *     litTime: number, litDuration: number, cookProgress: number }
 * }} snapshot
 * @returns {string | undefined}
 */
export function formatEquipmentInspection(snapshot) {
  const title = titles[snapshot.typeId];
  if (typeof title !== "string") return undefined;
  const prefix = "§f" + title + " · ";
  const invalid = "§e" + title + " · 設備資料異常";
  if (snapshot.typeId === "ordertocook:shelf" || snapshot.typeId === "ordertocook:plate_shelf") {
    const plates = snapshot.typeId === "ordertocook:plate_shelf";
    const maximum = plates ? TOOL_CONSTANTS.plateShelfCapacity : TOOL_CONSTANTS.packagingShelfCapacity;
    return boundedCount(snapshot.supplies, maximum)
      ? prefix + (plates ? "乾淨盤 " : "皮革 ") + snapshot.supplies + "/" + maximum : invalid;
  }
  if (snapshot.typeId === "ordertocook:refrigerator") {
    const capacity = snapshot.upper ? 27 : 54;
    const section = snapshot.upper ? "上層" : "下層";
    if (!snapshot.storageLoaded) return prefix + section + "儲物尚未載入";
    return boundedCount(snapshot.occupied, capacity)
      ? prefix + section + " 已用 " + snapshot.occupied + "/" + capacity + " 格" : invalid;
  }
  const d = snapshot.appliance;
  if (!d || typeof d !== "object" || Array.isArray(d) ||
      !["phase", "remainingTicks", "plates", "litTime", "litDuration", "cookProgress"]
        .every(key => Number.isFinite(d[key]) && d[key] >= 0) ||
      !boundedCount(d.phase, 5) || !boundedCount(d.plates, TOOL_CONSTANTS.dishwasherCapacity)) return invalid;
  if (snapshot.typeId === "ordertocook:washingtable") {
    return boundedCount(d.plates, 10) ? prefix + "髒盤 " + d.plates + "/10" : invalid;
  }
  if (snapshot.typeId === "ordertocook:dishwasher") {
    const phase = ["等待髒盤", "關閉中", "收盤中", "清洗中", "出盤中", "可取乾淨盤"][d.phase];
    return prefix + phase + " " + d.plates + "/" + TOOL_CONSTANTS.dishwasherCapacity;
  }
  if (!snapshot.storageLoaded) return prefix + "儲物尚未載入";
  return prefix + "烹調 " + Math.min(100, Math.floor(d.cookProgress / 2)) +
    "% · 燃燒剩餘 " + Math.ceil(d.litTime / 20) + " 秒";
}
