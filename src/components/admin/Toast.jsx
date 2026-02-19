import { createContext, useCallback, useContext, useState, useRef, useEffect } from 'react';
import { CheckCircle, AlertTriangle, Info, X as XIcon, XCircle } from 'lucide-react';

const ToastContext = createContext(() => { });

const ICONS = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
};

const COLORS = {
    success: 'bg-emerald-50 border-emerald-300 text-emerald-800',
    error: 'bg-red-50 border-red-300 text-red-800',
    warning: 'bg-amber-50 border-amber-300 text-amber-800',
    info: 'bg-blue-50 border-blue-300 text-blue-800',
};

const ICON_COLORS = {
    success: 'text-emerald-500',
    error: 'text-red-500',
    warning: 'text-amber-500',
    info: 'text-blue-500',
};

let toastCounter = 0;

function ToastItem({ toast, onDismiss }) {
    const Icon = ICONS[toast.type] || Info;
    const [exiting, setExiting] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setExiting(true);
            setTimeout(() => onDismiss(toast.id), 300);
        }, toast.duration || 3500);
        return () => clearTimeout(timer);
    }, [toast, onDismiss]);

    return (
        <div
            className={`flex items-start gap-3 px-4 py-3 border shadow-lg max-w-sm w-full font-sans text-sm transition-all duration-300 ${COLORS[toast.type] || COLORS.info} ${exiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}`}
            role="alert"
        >
            <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${ICON_COLORS[toast.type] || ICON_COLORS.info}`} />
            <div className="flex-1 min-w-0">
                {toast.title && <p className="font-semibold text-sm">{toast.title}</p>}
                <p className="text-sm opacity-90">{toast.message}</p>
            </div>
            <button
                onClick={() => { setExiting(true); setTimeout(() => onDismiss(toast.id), 300); }}
                className="p-0.5 opacity-50 hover:opacity-100 transition-opacity shrink-0"
            >
                <XIcon className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const toastsRef = useRef(toasts);
    toastsRef.current = toasts;

    const addToast = useCallback((message, type = 'success', options = {}) => {
        const id = ++toastCounter;
        const toast = { id, message, type, ...options };
        setToasts(prev => [...prev, toast]);
        return id;
    }, []);

    const dismiss = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const toast = useCallback((msg, opts) => addToast(msg, 'success', opts), [addToast]);
    toast.success = (msg, opts) => addToast(msg, 'success', opts);
    toast.error = (msg, opts) => addToast(msg, 'error', opts);
    toast.warning = (msg, opts) => addToast(msg, 'warning', opts);
    toast.info = (msg, opts) => addToast(msg, 'info', opts);

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-auto">
                {toasts.map(t => (
                    <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    return useContext(ToastContext);
}

export default ToastProvider;
