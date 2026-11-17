// SPDX-License-Identifier: GPL-3.0-only
import { system } from '@minecraft/server';
import { ActionFormData, ModalFormData, FormCancelationReason } from '@minecraft/server-ui';
import { readableActionButton } from './button_text.js';
import { message, translate } from './i18n.js';

const openForms = new Set();
export function notify(player, text) { if (player?.isValid) player.sendMessage(message('§6[', translate('otc.ui.brand'), ']§r ', text)); }
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
    notify(player, translate('otc.ui.busy'));
  } catch (error) { console.warn(`[OrderToCook] Form: ${error}`); }
  finally { openForms.delete(player.id); }
  return undefined;
}
export async function choose(player, title, body, buttons) {
  const form = new ActionFormData().title(title).body(body);
  for (const button of buttons) {
    // Optional icon-bearing handbook buttons; existing string/RawMessage
    // callers continue through the unchanged behavior.
    if (button && typeof button === 'object' && 'label' in button) {
      form.button(readableActionButton(button.label), button.icon);
    } else form.button(readableActionButton(button));
  }
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
    notify(player, translate('otc.ui.operation_failed'));
  });
}
