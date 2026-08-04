#!/usr/bin/env node
// Install dependencies if needed, then run an npm script.
// Cross-platform: the only entry point that run.sh and run.ps1 delegate to.
//
//   node scripts/start.mjs [dev|build|test|preview] [-- extra args]

import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const TASKS = ['dev', 'build', 'test', 'preview'];
const [task = 'dev', ...rest] = process.argv.slice(2);

if (!TASKS.includes(task)) {
  console.error(`Unknown task "${task}". Expected one of: ${TASKS.join(', ')}`);
  process.exit(1);
}

// Vite 7 needs Node ^20.19 || >=22.12. Fail loudly rather than on a cryptic
// syntax error deep inside a dependency.
const [major, minor] = process.versions.node.split('.').map(Number);
const nodeOk = (major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major > 22;
if (!nodeOk) {
  console.error(`Node ${process.versions.node} is too old — Vite 7 needs ^20.19.0 or >=22.12.0.`);
  process.exit(1);
}

function run(cmd, args) {
  // Node >=20.12 refuses to spawn a .cmd (npm on Windows) without a shell,
  // so opt in there and quote anything the shell might resplit.
  const win = process.platform === 'win32';
  const argv = win ? args.map((a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)) : args;
  const res = spawnSync(cmd, argv, { cwd: root, stdio: 'inherit', shell: win });
  if (res.error) {
    console.error(`Failed to run ${cmd}: ${res.error.message}`);
    process.exit(1);
  }
  return res.status ?? 1;
}

// Reinstall when node_modules is missing, or when package-lock.json has been
// touched since the last install (a rebase or branch switch usually means it has).
function installStale() {
  const stamp = join(root, 'node_modules', '.package-lock.json');
  const lock = join(root, 'package-lock.json');
  if (!existsSync(join(root, 'node_modules')) || !existsSync(stamp)) return true;
  if (!existsSync(lock)) return false;
  return statSync(lock).mtimeMs > statSync(stamp).mtimeMs;
}

if (installStale()) {
  // npm ci is reproducible but wipes node_modules, so only use it for a cold start.
  const cold = !existsSync(join(root, 'node_modules'));
  const useCi = cold && existsSync(join(root, 'package-lock.json'));
  console.log(`\n> installing dependencies (npm ${useCi ? 'ci' : 'install'})\n`);
  const status = run(npm, useCi ? ['ci'] : ['install']);
  if (status !== 0) process.exit(status);
} else {
  console.log('> dependencies up to date');
}

if (task === 'dev') {
  console.log('\n> starting dev server — http://localhost:5173 (ctrl+c to stop)\n');
}

process.exit(run(npm, ['run', task, ...(rest.length ? ['--', ...rest] : [])]));
