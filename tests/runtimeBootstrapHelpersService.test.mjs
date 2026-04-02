import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { createRuntimeBootstrapHelpers } from '../server/services/runtimeBootstrapHelpersService.js';

function createHelpers(overrides = {}) {
  const dnsCalls = [];
  const webpushCalls = [];
  const infoLogs = [];
  const warningLogs = [];
  const existingPaths = new Set(overrides.existingPaths || []);
  const fileContents = new Map(Object.entries(overrides.fileContents || {}));

  const helpers = createRuntimeBootstrapHelpers({
    dns: overrides.dns || {
      setServers(servers) {
        dnsCalls.push(servers);
      },
    },
    fs: overrides.fs || {
      existsSync(targetPath) {
        return existingPaths.has(targetPath);
      },
      readFileSync(targetPath) {
        return Buffer.from(fileContents.get(targetPath) || '');
      },
    },
    path: overrides.path || {
      join(...parts) {
        return parts.join('/');
      },
    },
    webpush: overrides.webpush || {
      setVapidDetails(...args) {
        webpushCalls.push(args);
      },
    },
    logInfo(message) {
      infoLogs.push(message);
    },
    logWarning(message) {
      warningLogs.push(message);
    },
  });

  return {
    dnsCalls,
    helpers,
    infoLogs,
    warningLogs,
    webpushCalls,
  };
}

describe('runtimeBootstrapHelpersService', () => {
  it('keeps runtimeBootstrapHelpersService legacy coverage green', async () => {
      {
        const harness = createHelpers();
        const env = harness.helpers.applyMongoDnsServers({ nodeEnv: 'development', mongoDnsServersEnv: '' });
        assert.equal(env, 'development');
        assert.deepEqual(harness.dnsCalls, [['8.8.8.8', '8.8.4.4', '1.1.1.1']]);
      }
    
      {
        const harness = createHelpers();
        const env = harness.helpers.applyMongoDnsServers({
          nodeEnv: 'production',
          mongoDnsServersEnv: '1.1.1.1, 8.8.8.8',
        });
        assert.equal(env, 'production');
        assert.deepEqual(harness.dnsCalls, [['1.1.1.1', '8.8.8.8']]);
      }
    
      {
        const harness = createHelpers();
        harness.helpers.applyMongoDnsServers({ nodeEnv: 'production', mongoDnsServersEnv: '' });
        assert.deepEqual(harness.dnsCalls, []);
      }
    
      {
        const harness = createHelpers({
          dns: {
            setServers() {
              throw new Error('bad dns');
            },
          },
        });
        harness.helpers.applyMongoDnsServers({ nodeEnv: 'development', mongoDnsServersEnv: '9.9.9.9' });
        assert.equal(harness.warningLogs.some((line) => line.includes('Failed to apply MONGODB_DNS_SERVERS: bad dns')), true);
      }
    
      {
        const harness = createHelpers();
        const configured = harness.helpers.configureWebPush({
          vapidPublicKey: 'public-key',
          vapidPrivateKey: 'private-key',
        });
        assert.equal(configured, true);
        assert.deepEqual(harness.webpushCalls, [['mailto:admin@znews.live', 'public-key', 'private-key']]);
        assert.equal(harness.infoLogs.includes('\u2713 Web Push Configured'), true);
      }
    
      {
        const harness = createHelpers();
        const configured = harness.helpers.configureWebPush({ vapidPublicKey: 'public-key' });
        assert.equal(configured, false);
        assert.deepEqual(harness.webpushCalls, []);
        assert.equal(harness.warningLogs.includes('\u26a0 Web Push VAPID keys missing in .env'), true);
      }
    
      {
        const fontPath = 'server/fonts/NotoSans.ttf';
        const harness = createHelpers({ existingPaths: [fontPath] });
        assert.equal(harness.helpers.loadBundledFontFile('server'), fontPath);
        assert.equal(harness.infoLogs.includes('\u2713 Bundled font: server/fonts/NotoSans.ttf'), true);
      }
    
      {
        const harness = createHelpers();
        assert.equal(harness.helpers.loadBundledFontFile('server'), null);
        assert.equal(
          harness.warningLogs.includes('\u26a0 server/fonts/NotoSans.ttf not found \u2014 share card Cyrillic text may break.'),
          true,
        );
      }
    
      {
        const logoPath = 'server/fonts/brand-logo.png';
        const harness = createHelpers({
          existingPaths: [logoPath],
          fileContents: { [logoPath]: 'logo-bytes' },
        });
        assert.deepEqual(harness.helpers.loadBrandLogoPng('server'), Buffer.from('logo-bytes'));
        assert.equal(harness.infoLogs.includes('\u2713 Brand logo: server/fonts/brand-logo.png'), true);
      }
    
      {
        const harness = createHelpers();
        assert.equal(harness.helpers.loadBrandLogoPng('server'), null);
        assert.equal(
          harness.warningLogs.includes('\u26a0 server/fonts/brand-logo.png not found \u2014 share card brand will be missing.'),
          true,
        );
      }
  });
});
