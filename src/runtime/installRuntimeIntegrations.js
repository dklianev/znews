import { registerSW } from 'virtual:pwa-register';
import { installClientAssetMonitoring } from '../utils/clientMonitoring';
import { showPwaOfflineToast, showPwaUpdateToast } from '../utils/systemToasts';

export function installRuntimeIntegrations() {
  if (typeof window === 'undefined') return;
  if (window.__znRuntimeIntegrationsInstalled) return;

  window.__znRuntimeIntegrationsInstalled = true;

  const updateSW = registerSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration || window.__znSwUpdatePollingInstalled) return;

      window.__znSwUpdatePollingInstalled = true;

      const triggerUpdateCheck = () => {
        if (document.visibilityState === 'hidden') return;
        registration.update().catch(() => {});
      };

      window.setInterval(triggerUpdateCheck, 60 * 60 * 1000);
      document.addEventListener('visibilitychange', triggerUpdateCheck);
    },
    onNeedRefresh() {
      showPwaUpdateToast(() => updateSW(true));
    },
    onOfflineReady() {
      showPwaOfflineToast();
    },
  });

  installClientAssetMonitoring();
}
