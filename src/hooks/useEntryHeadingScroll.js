import { useEffect } from 'react';
import { useNavigationType } from 'react-router-dom';

export function useEntryHeadingScroll(targetRef, scrollKey) {
  const navigationType = useNavigationType();

  useEffect(() => {
    if (typeof window === 'undefined' || navigationType === 'POP') {
      return undefined;
    }

    const target = targetRef.current;
    if (!target) {
      return undefined;
    }

    const frameId = window.requestAnimationFrame(() => {
      targetRef.current?.scrollIntoView({
        block: 'start',
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [navigationType, scrollKey, targetRef]);
}
