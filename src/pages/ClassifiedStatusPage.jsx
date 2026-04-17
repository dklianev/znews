import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Search, CheckCircle, Clock, XCircle, AlertTriangle, Tag, ArrowLeft } from 'lucide-react';
import { usePublicSectionsData } from '../context/DataContext';
import { makeTitle, useDocumentTitle } from '../hooks/useDocumentTitle';

const STATUS_CONFIG = {
  awaiting_payment: { label: 'Чака плащане', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30', border: 'border-amber-300 dark:border-amber-700' },
  active: { label: 'Активна', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', border: 'border-green-300 dark:border-green-700' },
  rejected: { label: 'Отхвърлена', icon: XCircle, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30', border: 'border-red-300 dark:border-red-700' },
};

const TIER_LABELS = { standard: 'Стандартна', highlighted: 'Удебелена', vip: 'VIP' };

export default function ClassifiedStatusPage() {
  useDocumentTitle(makeTitle('Статус на обява'));
  const { ref: urlRef } = useParams();
  const { loadClassifiedStatus } = usePublicSectionsData();

  const [inputRef, setInputRef] = useState(urlRef || '');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const doSearch = async (ref, signal) => {
    if (!ref.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await loadClassifiedStatus(ref.trim());
      if (signal?.aborted) return;
      setResult(data);
    } catch (err) {
      if (signal?.aborted) return;
      setError(err.message || 'Не е намерена обява с този код.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const ac = new AbortController();
    if (urlRef) {
      setInputRef(urlRef);
      doSearch(urlRef, ac.signal);
    } else {
      setInputRef('');
      setResult(null);
      setError('');
      setLoading(false);
    }
    return () => ac.abort();
  }, [urlRef]);

  const handleSubmit = (e) => {
    e.preventDefault();
    doSearch(inputRef);
  };

  const stCfg = result ? (STATUS_CONFIG[result.status] || STATUS_CONFIG.awaiting_payment) : null;
  const StIcon = stCfg?.icon || Clock;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto px-4 py-8 md:py-16">
      <Link to="/obiavi" className="inline-flex items-center gap-1.5 text-sm font-display font-bold uppercase tracking-wider text-gray-500 hover:text-zn-text dark:hover:text-[#EDE4D0] mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Към обявите
      </Link>

      <div className="comic-panel comic-dots bg-white dark:bg-[#2A2438] p-6 md:p-10 border-4 border-zn-black dark:border-[#524A62] relative">
        <div className="flex items-center gap-3 mb-6 relative z-[2]">
          <div className="w-12 h-12 bg-zn-purple flex items-center justify-center border-3 border-[#1C1428] -rotate-3">
            <Search className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-black uppercase tracking-wider text-zn-text dark:text-[#EDE4D0]">Статус на обява</h1>
            <p className="font-sans text-sm text-gray-500">Въведете кода за плащане, който получихте при подаване на обявата.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2 mb-6 relative z-[2]">
          <input
            type="text"
            value={inputRef}
            onChange={(e) => setInputRef(e.target.value.toUpperCase())}
            placeholder="ZN-XXXXXXXX"
            className="flex-1 px-4 py-3 font-mono text-lg font-bold bg-gray-50 dark:bg-[#1C1828] dark:text-[#EDE4D0] border-2 border-[#1C1428] dark:border-[#524A62] focus:outline-none focus:ring-4 focus:ring-zn-purple/20 focus:border-zn-purple uppercase"
            style={{ boxShadow: '2px 2px 0 #1C1428' }}
          />
          <button type="submit" disabled={loading || !inputRef.trim()} className="comic-button px-6 disabled:opacity-50">
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Провери'}
          </button>
        </form>

        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 font-sans mb-4 relative z-[2]">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {result && stCfg && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative z-[2]">
            <div className={`border-3 ${stCfg.border} ${stCfg.bg} p-6 space-y-4`} style={{ boxShadow: '3px 3px 0 #1C1428' }}>
              <div className="flex items-center gap-3">
                <StIcon className={`w-8 h-8 ${stCfg.color}`} />
                <div>
                  <div className="text-[10px] font-display font-bold uppercase tracking-widest text-gray-400">Статус</div>
                  <div className={`font-display font-black text-xl uppercase tracking-wider ${stCfg.color}`}>{stCfg.label}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] font-display font-bold uppercase tracking-widest text-gray-400">Обява</div>
                  <div className="font-display font-bold text-zn-text dark:text-[#EDE4D0]">{result.title}</div>
                </div>
                <div>
                  <div className="text-[10px] font-display font-bold uppercase tracking-widest text-gray-400">Пакет</div>
                  <div className="font-display font-bold text-zn-purple">{TIER_LABELS[result.tier] || result.tier}</div>
                </div>
                <div>
                  <div className="text-[10px] font-display font-bold uppercase tracking-widest text-gray-400">Код за плащане</div>
                  <div className="font-mono font-black text-zn-purple text-lg">{result.paymentRef}</div>
                </div>
                <div>
                  <div className="text-[10px] font-display font-bold uppercase tracking-widest text-gray-400">Сума</div>
                  <div className="font-mono font-black text-green-700 dark:text-green-400 text-lg">{result.currency || '$'}{result.amountDue?.toLocaleString('bg-BG')}</div>
                </div>
                <div>
                  <div className="text-[10px] font-display font-bold uppercase tracking-widest text-gray-400">Подадена</div>
                  <div className="font-sans text-sm text-gray-600 dark:text-gray-400">{new Date(result.createdAt).toLocaleString('bg-BG')}</div>
                </div>
                {result.approvedAt && (
                  <div>
                    <div className="text-[10px] font-display font-bold uppercase tracking-widest text-gray-400">Одобрена</div>
                    <div className="font-sans text-sm text-green-700 dark:text-green-400">{new Date(result.approvedAt).toLocaleString('bg-BG')}</div>
                  </div>
                )}
                {result.expiresAt && (
                  <div>
                    <div className="text-[10px] font-display font-bold uppercase tracking-widest text-gray-400">Изтича</div>
                    <div className="font-sans text-sm text-gray-600 dark:text-gray-400">{new Date(result.expiresAt).toLocaleString('bg-BG')}</div>
                  </div>
                )}
              </div>

              {result.status === 'active' && result.id && (
                <Link to={`/obiavi/${result.id}`} className="inline-flex items-center gap-2 comic-button text-sm mt-2">
                  <Tag className="w-4 h-4" /> Виж обявата
                </Link>
              )}

              {result.status === 'awaiting_payment' && (
                <p className="font-sans text-sm text-amber-700 dark:text-amber-300">
                  Плащането все още не е потвърдено. Ако сте превели сумата, моля изчакайте — администратор ще потвърди в рамките на няколко часа.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
