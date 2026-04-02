import { describe, expect, it } from 'vitest';

import { createRuntimeBootstrapHelpers } from '../../server/services/runtimeBootstrapHelpersService.js';

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

describe('runtime bootstrap helpers', () => {
  it('applies dns servers for dev and explicit production overrides', () => {
    const devHarness = createHelpers();
    expect(devHarness.helpers.applyMongoDnsServers({ nodeEnv: 'development', mongoDnsServersEnv: '' })).toBe('development');
    expect(devHarness.dnsCalls).toEqual([['8.8.8.8', '8.8.4.4', '1.1.1.1']]);

    const prodHarness = createHelpers();
    expect(prodHarness.helpers.applyMongoDnsServers({
      nodeEnv: 'production',
      mongoDnsServersEnv: '1.1.1.1, 8.8.8.8',
    })).toBe('production');
    expect(prodHarness.dnsCalls).toEqual([['1.1.1.1', '8.8.8.8']]);

    const quietProdHarness = createHelpers();
    quietProdHarness.helpers.applyMongoDnsServers({ nodeEnv: 'production', mongoDnsServersEnv: '' });
    expect(quietProdHarness.dnsCalls).toEqual([]);
  });

  it('logs warnings when dns setup fails and configures web push only with both vapid keys', () => {
    const badDnsHarness = createHelpers({
      dns: {
        setServers() {
          throw new Error('bad dns');
        },
      },
    });
    badDnsHarness.helpers.applyMongoDnsServers({ nodeEnv: 'development', mongoDnsServersEnv: '9.9.9.9' });
    expect(badDnsHarness.warningLogs.some((line) => line.includes('Failed to apply MONGODB_DNS_SERVERS: bad dns'))).toBe(true);

    const pushHarness = createHelpers();
    expect(pushHarness.helpers.configureWebPush({
      vapidPublicKey: 'public-key',
      vapidPrivateKey: 'private-key',
    })).toBe(true);
    expect(pushHarness.webpushCalls).toEqual([['mailto:admin@znews.live', 'public-key', 'private-key']]);
    expect(pushHarness.infoLogs).toContain('✓ Web Push Configured');

    const missingKeyHarness = createHelpers();
    expect(missingKeyHarness.helpers.configureWebPush({ vapidPublicKey: 'public-key' })).toBe(false);
    expect(missingKeyHarness.webpushCalls).toEqual([]);
    expect(missingKeyHarness.warningLogs).toContain('⚠ Web Push VAPID keys missing in .env');
  });

  it('loads the bundled font and brand logo when present, otherwise warns', () => {
    const fontPath = 'server/fonts/NotoSans.ttf';
    const fontHarness = createHelpers({ existingPaths: [fontPath] });
    expect(fontHarness.helpers.loadBundledFontFile('server')).toBe(fontPath);
    expect(fontHarness.infoLogs).toContain('✓ Bundled font: server/fonts/NotoSans.ttf');

    const missingFontHarness = createHelpers();
    expect(missingFontHarness.helpers.loadBundledFontFile('server')).toBeNull();
    expect(missingFontHarness.warningLogs).toContain('⚠ server/fonts/NotoSans.ttf not found — share card Cyrillic text may break.');

    const logoPath = 'server/fonts/brand-logo.png';
    const logoHarness = createHelpers({
      existingPaths: [logoPath],
      fileContents: { [logoPath]: 'logo-bytes' },
    });
    expect(logoHarness.helpers.loadBrandLogoPng('server')).toEqual(Buffer.from('logo-bytes'));
    expect(logoHarness.infoLogs).toContain('✓ Brand logo: server/fonts/brand-logo.png');

    const missingLogoHarness = createHelpers();
    expect(missingLogoHarness.helpers.loadBrandLogoPng('server')).toBeNull();
    expect(missingLogoHarness.warningLogs).toContain('⚠ server/fonts/brand-logo.png not found — share card brand will be missing.');
  });
});
