// SPDX-License-Identifier: GPL-3.0-only
import { system } from '@minecraft/server';
import { ActionFormData, ModalFormData, FormCancelationReason } from '@minecraft/server-ui';
import { readableActionButton } from './button_text.js';

const openForms = new Set();
export function notify(player, message) { if (player?.isValid) player.sendMessage(`§6[下單了]§r ${message}`); }
export async function showForm(player, form) {
  if (!player?.isValid || openForms.has(player.id)) return undefined;
  openForms.add(player.id);
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      if (!player.isValid) return undefined;
      const response = await form.show(player);
      if (response.canceled && response.cancelationReason === FormCancelationReason.UserBusy) {
        await new Promise(resolve => system.runTimeout(() => resolve(undefined), 4));
        continue;
      }
      return response.canceled ? undefined : response;
    }
    notify(player, '請關閉聊天／其他介面後再操作。');
  } catch (error) { console.warn(`[OrderToCook] Form: ${error}`); }
  finally { openForms.delete(player.id); }
  return undefined;
}
export async function choose(player, title, body, buttons) {
  const form = new ActionFormData().title(title).body(body);
  for (const button of buttons) form.button(readableActionButton(button));
  const result = await showForm(player, form);
  return result?.selection;
}
export async function textInput(player, title, label, initial = '') {
  const form = new ModalFormData().title(title).textField(label, '', { defaultValue: initial });
  const result = await showForm(player, form);
  return result ? String(result.formValues?.[0] || '').trim() : undefined;
}
export function safely(player, action) {
  Promise.resolve().then(action).catch(error => {
    console.warn(`[OrderToCook] Operation failed: ${error?.stack || error}`);
    notify(player, '操作未完成，請查看內容記錄。不要重複拆除設備；未能讀取的存檔會保留。');
  });
}
