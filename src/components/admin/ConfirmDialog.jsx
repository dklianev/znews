import { useCallback, useEffect, useRef, useState, createContext, useContext } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

const ConfirmContext = createContext(null);

export function useConfirm() {
  return useContext(ConfirmContext);
}

function ConfirmModal({ config, onResolve }) {
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
    function onKey(e) {
      if (e.key === 'Escape') onResolve(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onResolve]);

  const Icon = config.variant === 'danger' ? Trash2 : AlertTriangle;
  const confirmBtnCls = config.variant === 'danger'
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : 'bg-zn-purple hover:bg-zn-purple-dark text-white';

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={() => onResolve(false)} />
      <div className="relative bg-white border border-gray-200 shadow-xl max-w-sm w-full mx-4 p-6">
        <button
          type="button"
          onClick={() => onResolve(false)}
          className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Затвори"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3 mb-4">
          <div className={`p-2 rounded-full shrink-0 ${config.variant === 'danger' ? 'bg-red-100' : 'bg-amber-100'}`}>
            <Icon className={`w-5 h-5 ${config.variant === 'danger' ? 'text-red-600' : 'text-amber-600'}`} />
          </div>
          <div>
            <h3 className="font-sans font-semibold text-gray-900 text-sm">{config.title}</h3>
            <p className="text-sm font-sans text-gray-500 mt-1">{config.message}</p>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onResolve(false)}
            className="px-4 py-2 text-sm font-sans font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            {config.cancelLabel || 'Отказ'}
          </button>
          <button
            type="button"
            onClick={() => onResolve(true)}
            className={`px-4 py-2 text-sm font-sans font-semibold transition-colors ${confirmBtnCls}`}
          >
            {config.confirmLabel || 'Потвърди'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmProvider({ children }) {
  const [config, setConfig] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback((options) => {
    const opts = typeof options === 'string' ? { message: options } : options;
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setConfig({
        title: opts.title || 'Потвърждение',
        message: opts.message || 'Сигурни ли сте?',
        confirmLabel: opts.confirmLabel || 'Потвърди',
        cancelLabel: opts.cancelLabel || 'Отказ',
        variant: opts.variant || 'warning', // 'danger' | 'warning'
      });
    });
  }, []);

  const handleResolve = useCallback((result) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setConfig(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {config && <ConfirmModal config={config} onResolve={handleResolve} />}
    </ConfirmContext.Provider>
  );
}
