import { useEffect } from 'react';
import {
  evaluatePwaEligibility,
  initializeInstallPromptCapture,
  readPwaEnvironment,
  recoverLegacyDesktopPwa,
  registerMobileServiceWorker,
} from '../lib/pwaEligibility';
import { BUILD_ID } from '../lib/pwaUpdate';

export default function PwaRuntime() {
  useEffect(() => {
    const eligibility = evaluatePwaEligibility(readPwaEnvironment());
    if (!eligibility.eligible) return undefined;

    const cleanup = initializeInstallPromptCapture(true);
    void registerMobileServiceWorker();
    return cleanup;
  }, []);

  useEffect(() => {
    const environment = readPwaEnvironment();
    if (evaluatePwaEligibility(environment).eligible) return undefined;

    let cancelled = false;
    void recoverLegacyDesktopPwa(BUILD_ID).then((changed) => {
      if (changed && !cancelled) {
        window.location.reload();
      }
    });
    return () => { cancelled = true; };
  }, []);

  return null;
}
