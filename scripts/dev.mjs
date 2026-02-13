import { spawn } from 'node:child_process';

let shuttingDown = false;

function runTask(name, args) {
  const child = spawn(`npm run ${args.join(' ')}`, {
    shell: true,
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.error(`[dev] ${name} exited (${signal || code})`);
    process.exit(typeof code === 'number' ? code : 1);
  });

  return child;
}

const children = [
  runTask('server', ['start']),
  runTask('client', ['dev:client']),
];

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(0), 200);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
