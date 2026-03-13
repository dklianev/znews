export function createRuntimeBootstrapHelpers({
  dns,
  fs,
  path,
  webpush,
  logInfo = () => {},
  logWarning = () => {},
}) {
  function resolveDnsServers(value) {
    return String(value || '')
      .split(',')
      .map((server) => server.trim())
      .filter(Boolean);
  }

  function logBundledAssetPresence(message, assetPath, exists) {
    if (exists) {
      logInfo(`${message}${assetPath}`);
      return true;
    }

    return false;
  }

  function resolveBundledAssetPath(baseDir, fileName) {
    return path.join(baseDir, 'fonts', fileName);
  }

  function applyMongoDnsServers({ nodeEnv, mongoDnsServersEnv }) {
    const normalizedNodeEnv = String(nodeEnv || '').toLowerCase();
    const dnsServersInput = String(mongoDnsServersEnv || '').trim();

    if (dnsServersInput) {
      try {
        const servers = resolveDnsServers(dnsServersInput);
        if (servers.length) dns.setServers(servers);
      } catch (error) {
        logWarning('\u26a0 Failed to apply MONGODB_DNS_SERVERS: ' + (error?.message || error));
      }
      return normalizedNodeEnv;
    }

    if (normalizedNodeEnv !== 'production') {
      dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
    }

    return normalizedNodeEnv;
  }

  function configureWebPush({
    contactEmail = 'mailto:admin@znews.live',
    vapidPrivateKey,
    vapidPublicKey,
  }) {
    if (vapidPublicKey && vapidPrivateKey) {
      webpush.setVapidDetails(contactEmail, vapidPublicKey, vapidPrivateKey);
      logInfo('\u2713 Web Push Configured');
      return true;
    }

    logWarning('\u26a0 Web Push VAPID keys missing in .env');
    return false;
  }

  function loadBundledFontFile(baseDir) {
    const fontPath = resolveBundledAssetPath(baseDir, 'NotoSans.ttf');
    if (logBundledAssetPresence('\u2713 Bundled font: ', fontPath, fs.existsSync(fontPath))) {
      return fontPath;
    }
    logWarning('\u26a0 server/fonts/NotoSans.ttf not found \u2014 share card Cyrillic text may break.');
    return null;
  }

  function loadBrandLogoPng(baseDir) {
    const logoPath = resolveBundledAssetPath(baseDir, 'brand-logo.png');
    if (logBundledAssetPresence('\u2713 Brand logo: ', logoPath, fs.existsSync(logoPath))) {
      return fs.readFileSync(logoPath);
    }
    logWarning('\u26a0 server/fonts/brand-logo.png not found \u2014 share card brand will be missing.');
    return null;
  }

  return {
    applyMongoDnsServers,
    configureWebPush,
    loadBrandLogoPng,
    loadBundledFontFile,
  };
}
