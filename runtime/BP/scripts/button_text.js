// SPDX-License-Identifier: GPL-3.0-only
// Native action-form buttons already have a grey background. Do not rely on
// grey text alone to communicate locked/unsupported states; keep their labels.
/** @param {string | import('@minecraft/server').RawMessage} label */
export function readableActionButton(label) {
  if (typeof label !== 'string') return label;
  return label.replace(/§[78]/g, '§f');
}
