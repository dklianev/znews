import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const SCROLL_STORAGE_PREFIX = 'zn-scroll:';
const SCROLL_RESTORE_MAX_WAIT_MS = 3200;
const SCROLL_RESTORE_RETRY_MS = 120;

function getLocationScrollKey(location) {
  return `${SCROLL_STORAGE_PREFIX}${location.key || `${location.pathname}${location.search || ''}${location.hash || ''}`}`;
}

function readStoredScroll(scrollKey) {
  try {
    const rawValue = window.sessionStorage.getItem(scrollKey);
    if (rawValue == null) return null;
    const parsed = Number.parseInt(rawValue, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredScroll(scrollKey, value) {
  try {
    window.sessionStorage.setItem(scrollKey, String(Math.max(0, Math.round(value))));
  } catch {
    // ignore storage failures
  }
}

function getHashTarget(hash) {
  const rawId = typeof hash === 'string' ? hash.replace(/^#/, '').trim() : '';
  if (!rawId) return null;

  let decodedId = rawId;
  try {
    decodedId = decodeURIComponent(rawId);
  } catch {
    decodedId = rawId;
  }

  return document.getElementById(decodedId);
}

function getMaxReachableScrollY() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return 0;
  }

  const doc = document.documentElement;
  const body = document.body;
  const scrollHeight = Math.max(
    doc?.scrollHeight || 0,
    body?.scrollHeight || 0,
    doc?.offsetHeight || 0,
    body?.offsetHeight || 0,
  );

  return Math.max(0, scrollHeight - window.innerHeight);
}

export default function ScrollToTop() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const [visible, setVisible] = useState(false);
  const currentScrollKey = getLocationScrollKey(location);
  const currentScrollKeyRef = useRef(currentScrollKey);
  const prevScrollKeyRef = useRef(currentScrollKey);

  useEffect(() => {
    currentScrollKeyRef.current = currentScrollKey;
  }, [currentScrollKey]);

  useEffect(() => {
    if (prevScrollKeyRef.current === currentScrollKey) {
      return undefined;
    }

    writeStoredScroll(prevScrollKeyRef.current, window.scrollY || 0);
    prevScrollKeyRef.current = currentScrollKey;

    if (navigationType === 'POP') {
      const savedY = readStoredScroll(currentScrollKey);
      if (savedY == null) {
        return undefined;
      }

      let cancelled = false;
      let timeoutId = 0;
      const startTime = Date.now();
      const restoreScroll = () => {
        if (cancelled) return;
        window.scrollTo(0, savedY);

        const currentY = window.scrollY || 0;
        const reachedTarget = Math.abs(currentY - savedY) <= 4;
        const canReachTarget = getMaxReachableScrollY() + 4 >= savedY;
        const timedOut = Date.now() - startTime >= SCROLL_RESTORE_MAX_WAIT_MS;

        if (!timedOut && (!reachedTarget || !canReachTarget)) {
          timeoutId = window.setTimeout(restoreScroll, SCROLL_RESTORE_RETRY_MS);
        }
      };

      const frameId = window.requestAnimationFrame(restoreScroll);
      return () => {
        cancelled = true;
        window.cancelAnimationFrame(frameId);
        window.clearTimeout(timeoutId);
      };
    }

    let cancelled = false;
    let attempts = 0;
    let timeoutId = 0;

    const alignNavigationScroll = () => {
      if (cancelled) return;

      const hashTarget = getHashTarget(location.hash);
      if (hashTarget) {
        hashTarget.scrollIntoView({ block: 'start' });
        return;
      }

      attempts += 1;
      if (location.hash && attempts < 10) {
        timeoutId = window.setTimeout(alignNavigationScroll, 80);
        return;
      }

      window.scrollTo({ left: 0, top: 0 });
    };

    const frameId = window.requestAnimationFrame(alignNavigationScroll);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [currentScrollKey, location.hash, navigationType]);

  useEffect(() => {
    let frameId = 0;
    const updateScrollState = () => {
      frameId = 0;
      const currentY = window.scrollY || 0;
      setVisible(currentY > 400);
      writeStoredScroll(currentScrollKeyRef.current, currentY);
    };

    const onScroll = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(updateScrollState);
    };

    updateScrollState();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      writeStoredScroll(currentScrollKeyRef.current, window.scrollY || 0);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 flex items-center justify-center border-3 border-[#1C1428] bg-gradient-to-r from-zn-hot to-zn-orange text-white hover:from-zn-orange hover:to-zn-hot transition-all"
          style={{ boxShadow: '3px 3px 0 #1C1428' }}
          aria-label="Нагоре"
          whileHover={{ y: -3, boxShadow: '4px 5px 0 #1C1428' }}
          whileTap={{ scale: 0.9 }}
        >
          <ArrowUp className="w-5 h-5" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
