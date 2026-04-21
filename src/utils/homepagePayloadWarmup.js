import { api, getSession } from './api';
import { HOMEPAGE_PAYLOAD_PARAMS } from './homepagePayloadConfig';

let warmedHomepagePayloadPromise = null;

export function shouldWarmHomepagePayload() {
  if (typeof window === 'undefined') return false;
  return window.location.pathname === '/' && !getSession()?.token;
}

export function warmHomepagePayload() {
  if (!shouldWarmHomepagePayload()) return null;
  if (!warmedHomepagePayloadPromise) {
    warmedHomepagePayloadPromise = api.homepage.get(HOMEPAGE_PAYLOAD_PARAMS);
    warmedHomepagePayloadPromise.catch(() => {});
  }
  return warmedHomepagePayloadPromise;
}

export function consumeWarmedHomepagePayload() {
  const promise = warmedHomepagePayloadPromise;
  warmedHomepagePayloadPromise = null;
  return promise;
}
