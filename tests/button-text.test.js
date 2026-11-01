// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { readableActionButton } from '../runtime/BP/scripts/button_text.js';

test('locked progression labels remain readable without altering counters', () => {
  assert.equal(readableActionButton('§7○ 首單達成\n§r0/1'), '§f○ 首單達成\n§r0/1');
});
test('unsupported progression labels retain their explicit unsupported status', () => {
  assert.equal(readableActionButton('§8— 過期包裹\n§r尚未移植'), '§f— 過期包裹\n§r尚未移植');
});
test('unlocked progression colour and neutral buttons are unchanged', () => {
  for (const label of ['§a✓ 首單達成\n§r1/1', '關閉', '返回個人進度', '§c取消訂單']) {
    assert.equal(readableActionButton(label), label);
  }
});
test('grey replacement preserves text, formatting resets and is idempotent', () => {
  const input = '§7第一行\n§8第二行§r 10/100';
  const expected = '§f第一行\n§f第二行§r 10/100';
  assert.equal(readableActionButton(input), expected);
  assert.equal(readableActionButton(expected), expected);
});
test('native RawMessage labels retain identity and localization data', () => {
  const label = { rawtext: [{ translate: 'example.label' }] };
  assert.equal(readableActionButton(label), label);
  assert.deepEqual(label, { rawtext: [{ translate: 'example.label' }] });
});
