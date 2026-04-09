import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Optimistic list state that preserves in-flight mutations when the source
 * updates. Replaces the old useOptimistic pattern for lists where bulk
 * mutations resolve one-by-one and re-sync from the server between awaits.
 *
 * Usage:
 *   const [list, { apply, beginPending, endPending, reset }] = useOptimisticList(
 *     source,
 *     (current, mutation) => nextList,
 *     (item) => item.id,
 *   );
 */
export function useOptimisticList(source, reducer, getId = (item) => item?.id) {
  const pendingIdsRef = useRef(new Set());
  const [list, setList] = useState(() => (Array.isArray(source) ? source : []));

  useEffect(() => {
    const sourceArr = Array.isArray(source) ? source : [];
    if (pendingIdsRef.current.size === 0) {
      setList(sourceArr);
      return;
    }
    // Merge: for pending IDs preserve the current optimistic state
    // (including optimistic deletes — skip items that were removed locally).
    setList((current) => {
      const currentArr = Array.isArray(current) ? current : [];
      const currentMap = new Map(currentArr.map((item) => [getId(item), item]));
      const merged = [];
      sourceArr.forEach((item) => {
        const id = getId(item);
        if (pendingIdsRef.current.has(id)) {
          const optimisticItem = currentMap.get(id);
          if (optimisticItem) merged.push(optimisticItem);
          // else: optimistically deleted — skip
        } else {
          merged.push(item);
        }
      });
      return merged;
    });
  }, [source, getId]);

  const apply = useCallback((mutation) => {
    setList((current) => reducer(Array.isArray(current) ? current : [], mutation));
  }, [reducer]);

  const beginPending = useCallback((id) => {
    pendingIdsRef.current.add(id);
  }, []);

  const endPending = useCallback((id) => {
    pendingIdsRef.current.delete(id);
  }, []);

  const reset = useCallback((nextSource) => {
    pendingIdsRef.current.clear();
    setList(Array.isArray(nextSource) ? nextSource : (Array.isArray(source) ? source : []));
  }, [source]);

  return [list, { apply, beginPending, endPending, reset }];
}
