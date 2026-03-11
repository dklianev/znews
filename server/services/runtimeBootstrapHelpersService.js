export function createRuntimeBootstrapHelpers({
  dns,
  fs,
  path,
  webpush,
  logInfo = () => {},
  logWarning = () => {},
}) {
  function applyMongoDnsServers({ nodeEnv, mongoDnsServersEnv }) {
    const normalizedNodeEnv = String(nodeEnv || '').toLowerCase();
    const dnsServersInput = String(mongoDnsServersEnv || '').trim();

    if (dnsServersInput) {
      try {
        const servers = dnsServersInput
          .split(',')
          .map((server) => server.trim())
          .filter(Boolean);
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
    const fontPath = path.join(baseDir, 'fonts', 'NotoSans.ttf');
    if (fs.existsSync(fontPath)) {
      logInfo('\u2713 Bundled font: ' + fontPath);
      return fontPath;
    }
    logWarning('\u26a0 server/fonts/NotoSans.ttf not found \u2014 share card Cyrillic text may break.');
    return null;
  }

  function loadBrandLogoPng(baseDir) {
    const logoPath = path.join(baseDir, 'fonts', 'brand-logo.png');
    if (fs.existsSync(logoPath)) {
      logInfo('\u2713 Brand logo: ' + logoPath);
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
