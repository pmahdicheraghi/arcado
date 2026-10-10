import assert from 'node:assert';
import '../src/pages/nim/nim-logic.test.ts';
import '../src/pages/tug-of-war/tug-of-war-logic.test.ts';
import '../src/pages/color-war/color-war-logic.test.ts';
import '../src/pages/reaction-duel/reaction-duel-logic.test.ts';
import '../src/pages/quoridor/quoridor-logic.test.ts';
import { resolveHeaderAction } from '../src/app/usePwaUpdate.ts';

// PWA Header Action Logic Checks
assert.strictEqual(
  resolveHeaderAction({ isInstalled: false, canInstall: true, isUpdateAvailable: false }),
  'install',
  'Uninstalled with prompt should show install button',
);
assert.strictEqual(
  resolveHeaderAction({ isInstalled: true, canInstall: true, isUpdateAvailable: false }),
  'status',
  'Installed app must never show install button',
);
assert.strictEqual(
  resolveHeaderAction({ isInstalled: true, canInstall: false, isUpdateAvailable: true }),
  'update',
  'Installed with update available should show update button',
);
assert.strictEqual(
  resolveHeaderAction({ isInstalled: true, canInstall: false, isUpdateAvailable: false }),
  'status',
  'Installed without update should show online/offline status',
);
assert.strictEqual(
  resolveHeaderAction({ isInstalled: false, canInstall: true, isUpdateAvailable: true }),
  'install',
  'Uninstalled should show install even if update is ready',
);
assert.strictEqual(
  resolveHeaderAction({ isInstalled: false, canInstall: false, isUpdateAvailable: true }),
  'status',
  'Uninstalled without prompt should fallback to status',
);

console.log('✓ All logic assertions passed successfully!');
