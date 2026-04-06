import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const SCROLL_STORAGE_PREFIX = 'zn-scroll:';

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
      let attempts = 0;
      let timeoutId = 0;
      const restoreScroll = () => {
        if (cancelled) return;
        window.scrollTo(0, savedY);
        attempts += 1;
        if (attempts < 12 && Math.abs((window.scrollY || 0) - savedY) > 4) {
          timeoutId = window.setTimeout(restoreScroll, 80);
        }
      };

      const frameId = window.requestAnimationFrame(restoreScroll);
      return () => {
        cancelled = true;
        window.cancelAnimationFrame(frameId);
        window.clearTimeout(timeoutId);
      };
    }

    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ left: 0, top: 0 });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [currentScrollKey, navigationType]);

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
