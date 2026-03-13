import { spawn } from 'node:child_process';
import { access, cp, mkdir, readFile, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const runtimeRoot = path.join(repoRoot, '.smoke-safe-runtime');
const serverPort = 3001;
const baseUrl = `http://127.0.0.1:${serverPort}`;
const smokeSession = 'zemun-safe-smoke';

function getBin(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

function createPrefixedLogger(prefix) {
  return (chunk) => {
    const text = String(chunk || '');
    text
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter(Boolean)
      .forEach((line) => {
        console.log(`${prefix} ${line}`);
      });
  };
}

function quoteForCmd(value) {
  const normalized = String(value ?? '');
  if (!normalized) return '""';
  if (!/[\s"&<>|^()]/.test(normalized)) return normalized;
  return `"${normalized.replace(/"/g, '""')}"`;
}

function spawnTask(command, args, options = {}) {
  const shouldUseShell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(command);
  const spawnCommand = shouldUseShell ? (process.env.ComSpec || 'cmd.exe') : command;
  const spawnArgs = shouldUseShell
    ? ['/d', '/s', '/c', [quoteForCmd(command), ...args.map(quoteForCmd)].join(' ')]
    : args;

  const child = spawn(spawnCommand, spawnArgs, {
    cwd: options.cwd || repoRoot,
    env: { ...process.env, ...(options.env || {}) },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  const stdoutChunks = [];
  const stderrChunks = [];
  const logStdout = createPrefixedLogger(options.stdoutPrefix || '[task]');
  const logStderr = createPrefixedLogger(options.stderrPrefix || '[task:err]');

  child.stdout.on('data', (chunk) => {
    stdoutChunks.push(Buffer.from(chunk));
    logStdout(chunk);
  });

  child.stderr.on('data', (chunk) => {
    stderrChunks.push(Buffer.from(chunk));
    logStderr(chunk);
  });

  return {
    child,
    getStdout() {
      return Buffer.concat(stdoutChunks).toString('utf8');
    },
    getStderr() {
      return Buffer.concat(stderrChunks).toString('utf8');
    },
  };
}

async function runCommand(command, args, options = {}) {
  const task = spawnTask(command, args, options);
  return await new Promise((resolve, reject) => {
    task.child.on('error', reject);
    task.child.on('exit', (code) => {
      if (code === 0) {
        resolve({
          stdout: task.getStdout(),
          stderr: task.getStderr(),
        });
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}\n${task.getStderr() || task.getStdout()}`));
    });
  });
}

async function sleep(ms) {
  return await new Promise((resolve) => setTimeout(resolve, ms));
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function prepareRuntime() {
  await rm(runtimeRoot, { recursive: true, force: true });
  await mkdir(runtimeRoot, { recursive: true });

  const copies = [
    ['server', 'server'],
    ['shared', 'shared'],
    ['dist', 'dist'],
    ['src/data', 'src/data'],
    ['package.json', 'package.json'],
  ];

  if (await exists(path.join(repoRoot, '.env'))) {
    copies.push(['.env', '.env']);
  }

  for (const [sourceRelative, targetRelative] of copies) {
    const sourcePath = path.join(repoRoot, sourceRelative);
    const targetPath = path.join(runtimeRoot, targetRelative);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await cp(sourcePath, targetPath, { recursive: true, force: true });
  }

  await rm(path.join(runtimeRoot, 'server', '.env'), { force: true });

  const runtimeNodeModules = path.join(runtimeRoot, 'node_modules');
  await symlink(path.join(repoRoot, 'node_modules'), runtimeNodeModules, 'junction');
}

async function waitFor(check, { timeoutMs = 30000, intervalMs = 500, label = 'condition' } = {}) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await check();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await sleep(intervalMs);
  }

  const details = lastError ? ` Last error: ${lastError.message}` : '';
  throw new Error(`Timed out waiting for ${label}.${details}`);
}

async function waitForServerHealth() {
  return await waitFor(async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    if (!res.ok) return false;
    const payload = await res.json();
    return payload?.ok ? payload : false;
  }, { label: 'safe smoke backend health' });
}

async function stopChildProcess(task) {
  if (!task?.child || task.child.exitCode !== null) return;

  if (process.platform === 'win32') {
    try {
      await runCommand('taskkill', ['/PID', String(task.child.pid), '/T', '/F'], {
        cwd: repoRoot,
        stdoutPrefix: '[smoke:cleanup]',
        stderrPrefix: '[smoke:cleanup]',
      });
      return;
    } catch {
      // Fall through to generic kill path.
    }
  }

  task.child.kill('SIGTERM');
  await sleep(1000);
  if (task.child.exitCode === null) {
    task.child.kill('SIGKILL');
  }
}

async function removeRuntimeDir() {
  const attempts = 6;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await rm(runtimeRoot, { recursive: true, force: true });
      return;
    } catch (error) {
      if (error?.code !== 'EBUSY' || attempt === attempts - 1) throw error;
      await sleep(500 * (attempt + 1));
    }
  }
}

async function ensureBuildArtifacts() {
  const distIndexPath = path.join(repoRoot, 'dist', 'index.html');
  if (await exists(distIndexPath)) return;
  throw new Error('Missing dist/index.html. Run "npm run build" before "npm run smoke:safe".');
}

async function runBrowserSmoke() {
  const npxBin = getBin('npx');
  const cliArgs = ['--yes', '--package', '@playwright/cli', 'playwright-cli', '--session', smokeSession];
  const checks = [
    {
      path: '/',
      assert(snapshot) {
        if (!snapshot.title.includes('zNews')) {
          throw new Error(`Expected homepage title to include "zNews", received "${snapshot.title}"`);
        }
        if (!snapshot.text.includes('zNews')) {
          throw new Error('Expected homepage snapshot to include the app shell.');
        }
      },
    },
    {
      path: '/article/1',
      assert(snapshot) {
        if (!snapshot.text.includes('Мащабна полицейска операция')) {
          throw new Error('Expected article snapshot to include seeded article content.');
        }
      },
    },
    {
      path: '/category/crime',
      assert(snapshot) {
        if (!snapshot.text.includes('Криминални')) {
          throw new Error('Expected category snapshot to include the crime category label.');
        }
      },
    },
    {
      path: '/search?q=test',
      assert(snapshot) {
        if (!snapshot.text.includes('Търсене')) {
          throw new Error('Expected search snapshot to include the search interface.');
        }
      },
    },
    {
      path: '/admin/login',
      assert(snapshot) {
        if (!snapshot.text.includes('Вход')) {
          throw new Error('Expected admin login snapshot to include the login form.');
        }
      },
    },
    {
      path: '/admin/articles',
      assert(snapshot) {
        if (snapshot.url !== '/admin/login') {
          throw new Error(`Expected /admin/articles to redirect to /admin/login, received "${snapshot.url}"`);
        }
        if (!snapshot.text.includes('Вход')) {
          throw new Error('Expected redirected admin route to land on the login screen.');
        }
      },
    },
    {
      path: '/games/hangman',
      assert(snapshot) {
        if (snapshot.url !== '/games/hangman') {
          throw new Error(`Expected /games/hangman to stay on the same route, received "${snapshot.url}"`);
        }
        const text = snapshot.text.toLowerCase();
        const hasExpectedState = text.includes('няма активна игра') || text.includes('няма бесеница');
        if (!hasExpectedState) {
          throw new Error('Expected hangman page to render a valid game or empty-state message.');
        }
      },
    },
    {
      path: '/does-not-exist',
      assert(snapshot) {
        if (!snapshot.title.includes('404')) {
          throw new Error(`Expected 404 title, received "${snapshot.title}"`);
        }
        if (!snapshot.text.includes('404')) {
          throw new Error('Expected not-found snapshot to include the 404 marker.');
        }
      },
    },
  ];

  async function captureCliSnapshot(routePath) {
    const gotoResult = await runCommand(npxBin, [...cliArgs, 'goto', new URL(routePath, baseUrl).toString()], {
      cwd: repoRoot,
      stdoutPrefix: '[smoke:browser]',
      stderrPrefix: '[smoke:browser]',
    });
    const warmupSnapshotResult = await runCommand(npxBin, [...cliArgs, 'snapshot'], {
      cwd: repoRoot,
      stdoutPrefix: '[smoke:browser]',
      stderrPrefix: '[smoke:browser]',
    });
    const snapshotResult = await runCommand(npxBin, [...cliArgs, 'snapshot'], {
      cwd: repoRoot,
      stdoutPrefix: '[smoke:browser]',
      stderrPrefix: '[smoke:browser]',
    });

    const pageInfoText = `${gotoResult.stdout}\n${warmupSnapshotResult.stdout}\n${snapshotResult.stdout}`;
    const titleMatches = [...pageInfoText.matchAll(/Page Title:\s*(.+)/g)];
    const urlMatches = [...pageInfoText.matchAll(/Page URL:\s*(.+)/g)];
    const snapshotPathMatch = snapshotResult.stdout.match(/\[Snapshot\]\((.+?)\)/);
    const snapshotPath = snapshotPathMatch
      ? path.resolve(repoRoot, snapshotPathMatch[1].replaceAll('\\', path.sep))
      : null;
    const snapshotText = snapshotPath ? await readFile(snapshotPath, 'utf8') : '';

    return {
      title: titleMatches.length > 0 ? titleMatches.at(-1)[1].trim() : '',
      url: urlMatches.length > 0 ? new URL(urlMatches.at(-1)[1].trim()).pathname : '',
      text: snapshotText,
    };
  }

  await runCommand(npxBin, [...cliArgs, 'open', baseUrl], {
    cwd: repoRoot,
    stdoutPrefix: '[smoke:browser]',
    stderrPrefix: '[smoke:browser]',
  });

  try {
    for (const check of checks) {
      const snapshot = await captureCliSnapshot(check.path);
      if (!snapshot.title || !snapshot.url) {
        throw new Error(`Could not parse browser navigation snapshot for ${check.path}`);
      }

      check.assert(snapshot);
      console.log(`[smoke:safe] PASS ${check.path} -> ${snapshot.title}`);
    }

    const hangmanRes = await fetch(`${baseUrl}/api/games/hangman/today`);
    if (![200, 404].includes(hangmanRes.status)) {
      throw new Error(`Expected hangman API to return 200 or 404, received ${hangmanRes.status}`);
    }

    await runCommand(npxBin, [...cliArgs, 'console', 'error'], {
      cwd: repoRoot,
      stdoutPrefix: '[smoke:browser]',
      stderrPrefix: '[smoke:browser]',
    });
  } finally {
    await runCommand(npxBin, [...cliArgs, 'close'], {
      cwd: repoRoot,
      stdoutPrefix: '[smoke:browser]',
      stderrPrefix: '[smoke:browser]',
    }).catch(() => {});
  }
}

async function main() {
  await ensureBuildArtifacts();
  await prepareRuntime();

  const serverTask = spawnTask(
    process.execPath,
    ['server/index.js'],
    {
      cwd: runtimeRoot,
      env: {
        PORT: String(serverPort),
        DISABLE_BACKGROUND_JOBS: 'true',
        IMAGE_PIPELINE_BACKFILL_ON_BOOT: 'false',
        DEV_MONGODB_FALLBACK_URI: 'mongodb://127.0.0.1:65530/zemun-news',
      },
      stdoutPrefix: '[smoke:server]',
      stderrPrefix: '[smoke:server]',
    },
  );

  let shuttingDown = false;
  const cleanup = async () => {
    if (shuttingDown) return;
    shuttingDown = true;

    await stopChildProcess(serverTask);
    await removeRuntimeDir();
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  try {
    await waitForServerHealth();

    const manifestRes = await fetch(`${baseUrl}/manifest.webmanifest`);
    if (!manifestRes.ok) {
      throw new Error(`Expected manifest.webmanifest to be available, received HTTP ${manifestRes.status}`);
    }

    await runBrowserSmoke();

    console.log('[smoke:safe] PASS backend-backed smoke completed successfully.');
  } finally {
    try {
      await cleanup();
    } catch (cleanupError) {
      console.warn(`[smoke:safe] Cleanup warning: ${cleanupError.message}`);
    }
  }
}

main().catch((error) => {
  console.error(`[smoke:safe] FAIL ${error.message}`);
  process.exitCode = 1;
});
