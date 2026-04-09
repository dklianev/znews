import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Search } from 'lucide-react';
import { buildAdminCommandItems } from '../../utils/adminCommandPalette';

export default function AdminCommandPalette({
  open,
  navItems,
  canAccess,
  onClose,
  onNavigate,
}) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const inputRef = useRef(null);

  const items = useMemo(
    () => buildAdminCommandItems({ navItems, canAccess, query: deferredQuery }),
    [canAccess, deferredQuery, navItems],
  );

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
      return;
    }

    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(focusTimer);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [deferredQuery]);

  useEffect(() => {
    if (!items.length) {
      setActiveIndex(0);
      return;
    }
    if (activeIndex >= items.length) {
      setActiveIndex(items.length - 1);
    }
  }, [activeIndex, items]);

  if (!open) return null;

  const handleSelect = (item) => {
    if (!item?.to) return;
    onNavigate?.(item.to);
    onClose?.();
  };

  const handleFormSubmit = (event) => {
    event.preventDefault();
    if (!items.length) return;
    handleSelect(items[activeIndex] || items[0]);
  };

  const handleInputKeyDown = (event) => {
    if (event.code === 'Escape') {
      event.preventDefault();
      onClose?.();
      return;
    }

    if (!items.length) return;

    if (event.code === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((currentIndex) => (currentIndex + 1) % items.length);
      return;
    }

    if (event.code === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((currentIndex) => (currentIndex - 1 + items.length) % items.length);
    }
  };

  let previousGroup = '';

  return (
    <div
      className="fixed inset-0 z-[90] bg-[#120e1c]/55 p-4 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Търсене в админ панела"
        className="mx-auto mt-[8vh] w-full max-w-3xl overflow-hidden border-3 border-[#1C1428] bg-[#F2EDE5] shadow-[8px_8px_0_#1C1428]"
        onClick={(event) => event.stopPropagation()}
      >
        <form onSubmit={handleFormSubmit} className="border-b-3 border-[#1C1428] bg-white/80 p-4">
          <label className="flex items-center gap-3 border-3 border-[#1C1428] bg-white px-4 py-3 shadow-[4px_4px_0_#1C1428]">
            <Search className="h-5 w-5 shrink-0 text-zn-purple" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => {
                const nextValue = event.target.value;
                startTransition(() => {
                  setQuery(nextValue);
                });
              }}
              onKeyDown={handleInputKeyDown}
              placeholder="Търси секция, команда или ID..."
              aria-label="Търси в админ панела"
              className="w-full bg-transparent text-sm font-sans text-gray-800 outline-none placeholder:text-gray-400"
            />
          </label>
          <p className="mt-2 text-xs font-sans text-gray-500">
            Използвай <span className="font-semibold text-gray-700">Ctrl+K</span> или въведи номер на запис за бързо отваряне.
          </p>
        </form>

        <div className="max-h-[60vh] overflow-y-auto bg-[#F7F3EC] p-3">
          {items.length === 0 ? (
            <div className="border-3 border-dashed border-[#1C1428]/20 bg-white/70 px-4 py-8 text-center">
              <p className="font-display text-lg font-bold uppercase tracking-wide text-[#1C1428]">Няма съвпадения</p>
              <p className="mt-2 text-sm font-sans text-gray-500">
                Пробвай с име на секция като „Статии“, „Журнал“ или с конкретен ID.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item, index) => {
                const groupLabel = item.group !== previousGroup ? item.group : '';
                previousGroup = item.group;

                return (
                  <div key={item.key}>
                    {groupLabel ? (
                      <div className="px-1 pb-1 pt-3 text-[10px] font-sans font-bold uppercase tracking-[0.18em] text-gray-500 first:pt-0">
                        {groupLabel}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={`flex w-full items-center justify-between gap-4 border-3 px-4 py-3 text-left shadow-[4px_4px_0_#1C1428] transition-transform ${
                        index === activeIndex
                          ? 'border-zn-purple bg-zn-purple/10 text-[#1C1428] -translate-y-0.5'
                          : 'border-[#1C1428] bg-white text-[#1C1428] hover:-translate-y-0.5'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-display text-sm font-bold uppercase tracking-wide">
                          {item.label}
                        </p>
                        <p className="mt-1 truncate text-xs font-sans text-gray-500">
                          {item.description}
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-sans font-bold uppercase tracking-[0.18em] text-gray-500">
                        <CornerDownLeft className="h-3.5 w-3.5" />
                        Отвори
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
