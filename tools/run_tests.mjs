// SPDX-License-Identifier: GPL-3.0-only
// Select existing Node tests; production logic stays in the original suites.
import { readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const core = [
  // Order state, real payment/metadata transfers, and interrupted persistence.
  'core', 'order-clock', 'inventory', 'store', 'progression-service',
  // Shipped interaction owners, permissions, menu updates and physical handoff.
  'main', 'station-access', 'menu-runtime', 'menu-persistence', 'dine-in-takeout',
  // Native storage migration/reload, item-bearing relocation and live customers.
  'appliances', 'stove', 'smoking-recipes', 'smoking-provider', 'native-fridge', 'portable-runtime', 'entities', 'delivery-recovery',
].map(name => `tests/${name}.test.js`);
const args = process.argv.slice(2);

try {
  if (args.length === 1 && args[0] === '--help') {
    console.log('npm test                         Core gameplay\n' +
      'npm test -- tests/stove.test.js   Only the named test files\n' +
      'npm test -- --full               All existing JavaScript tests');
  } else {
    const full = args.length === 1 && args[0] === '--full';
    if (!full && args.some(arg => arg.startsWith('--'))) {
      throw new Error('Choose --full or test file paths; use --help for examples');
    }
    const selected = full
      ? readdirSync(resolve(root, 'tests')).filter(name => name.endsWith('.test.js')).sort().map(name => `tests/${name}`)
      : args.length ? args : core;
    const files = selected.map(name => resolve(root, name));
    if (!files.length || files.some(path => !path.endsWith('.test.js') || !statSync(path).isFile())) {
      throw new Error('Choose existing .test.js files');
    }
    console.log(`Running ${full ? 'full' : args.length ? 'selected' : 'core'} gameplay: ${files.length} test files`);
    const result = spawnSync(process.execPath, ['--test', ...files], { cwd: root, stdio: 'inherit' });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
