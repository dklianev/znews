import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const [visible, setVisible] = useState(false);
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    if (prevPathRef.current === pathname) {
      return undefined;
    }

    prevPathRef.current = pathname;

    if (navigationType === 'POP') {
      return undefined;
    }

    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ left: 0, top: 0 });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [navigationType, pathname]);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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
