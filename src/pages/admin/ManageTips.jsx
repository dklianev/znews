import { useEffect, useMemo, useOptimistic, useState } from 'react';
import { useAdminData } from '../../context/DataContext';
import { RefreshCw, Trash2, Edit3, Image as ImageIcon, MapPin, Search } from 'lucide-react';
import { useToast } from '../../components/admin/Toast';
import { useNavigate } from 'react-router-dom';

export default function ManageTips() {
  const { tips, tipsReady, refreshTips, ensureTipsLoaded, updateTip, deleteTip } = useAdminData();
  const toast = useToast();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [busyTip, setBusyTip] = useState(null);
  const [optimisticTips, applyTipUpdate] = useOptimistic(
    tips,
    (currentTips, mutation) => {
      if (!Array.isArray(currentTips)) return [];

      if (mutation.type === 'status') {
        return currentTips.map((tip) => (
          tip.id === mutation.id ? { ...tip, status: mutation.status } : tip
        ));
      }

      if (mutation.type === 'delete') {
        return currentTips.filter((tip) => tip.id !== mutation.id);
      }

      if (mutation.type === 'reset') {
        return Array.isArray(mutation.tips) ? mutation.tips : [];
      }

      return currentTips;
    },
  );

  useEffect(() => {
    void ensureTipsLoaded();
  }, [ensureTipsLoaded]);

  const filteredTips = useMemo(() => {
    const q = query.toLowerCase();
    return optimisticTips.filter((tip) => (
      (tip.text || '').toLowerCase().includes(q) ||
      (tip.location || '').toLowerCase().includes(q)
    ));
  }, [optimisticTips, query]);

  const isTipBusy = (id) => busyTip?.id === id;

  const resetTipsView = () => {
    applyTipUpdate({ type: 'reset', tips });
  };

  const handleDelete = async (id) => {
    if (!confirm('Сигурни ли сте, че искате да изтриете този сигнал?')) return;

    setBusyTip({ id, action: 'delete' });
    applyTipUpdate({ type: 'delete', id });

    try {
      await deleteTip(id);
      toast.success('Сигналът беше изтрит');
    } catch (e) {
      resetTipsView();
      await refreshTips();
      toast.error(`Грешка: ${e.message}`);
    } finally {
      setBusyTip(null);
    }
  };

  const runOptimisticStatusUpdate = async (id, status) => {
    setBusyTip({ id, action: 'status' });
    applyTipUpdate({ type: 'status', id, status });

    try {
      await updateTip(id, status);
      toast.success('Статусът е обновен');
    } catch (e) {
      resetTipsView();
      await refreshTips();
      toast.error(`Грешка: ${e.message}`);
    } finally {
      setBusyTip(null);
    }
  };

  const handleConvertToArticle = (tip) => {
    void runOptimisticStatusUpdate(tip.id, 'processed');

    const prefill = {
      title: `Сигнал: ${tip.location || 'Без локация'}`,
      excerpt: tip.text ? `${tip.text.slice(0, 150)}...` : '',
      content: `**От читателски сигнал:**\n${tip.text}\n\n**Локация:** ${tip.location || 'Неуточнена'}\n`,
      image: tip.image || '',
      imageMeta: tip.imageMeta || null,
    };

    localStorage.setItem('znews_tip_prefill', JSON.stringify(prefill));
    navigate('/admin/articles');
  };

  return (
    <div className="p-8 min-h-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Сигнали (типлайн)</h1>
          <p className="text-sm font-sans text-gray-500 mt-1">Преглед на получените потребителски сигнали</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refreshTips}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-sm font-sans text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Обнови
          </button>
        </div>
      </div>

      <div className="mb-6 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="w-5 h-5 text-gray-400" />
        </div>
        <input
          type="text"
          className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-zn-purple/20 focus:border-zn-purple font-sans"
          placeholder="Търси сигнал по текст или локация..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="space-y-4">
        {tipsReady && filteredTips.length === 0 ? (
          <div className="p-8 text-center text-gray-500 font-sans border border-gray-200 border-dashed bg-gray-50">
            Няма намерени сигнали.
          </div>
        ) : (
          filteredTips.map((tip) => (
            <div
              key={tip.id}
              className="bg-white border border-gray-200 p-5 flex flex-col md:flex-row gap-6 shadow-sm"
              aria-busy={isTipBusy(tip.id)}
            >
              {tip.image ? (
                <div className="w-full md:w-64 h-40 bg-black flex-shrink-0 flex items-center justify-center border-4 border-zn-black" style={{ boxShadow: '4px 4px 0 #1C1428' }}>
                  <img src={tip.image} className="max-w-full max-h-full object-contain" alt="Tip evidence" loading="lazy" />
                </div>
              ) : (
                <div className="w-full md:w-64 h-40 bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300 flex-shrink-0">
                  <ImageIcon className="w-8 h-8 text-gray-300" />
                </div>
              )}

              <div className="flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    {tip.location && (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-zn-purple uppercase tracking-wider mb-2">
                        <MapPin className="w-3.5 h-3.5" />
                        {tip.location}
                      </div>
                    )}
                    <p className="text-gray-800 font-sans whitespace-pre-wrap">{tip.text || '(без текст)'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {tip.status === 'new' && <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full">Нов</span>}
                    {tip.status === 'processed' && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">Обработен</span>}
                    {tip.status === 'rejected' && <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-bold rounded-full">Отхвърлен</span>}
                  </div>
                </div>

                <div className="mt-auto pt-4 flex items-center justify-between border-t border-gray-100">
                  <div className="text-xs text-gray-400 font-sans">
                    {new Date(tip.createdAt).toLocaleString('bg-BG')}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {tip.status !== 'rejected' && (
                      <button
                        type="button"
                        onClick={() => void runOptimisticStatusUpdate(tip.id, 'rejected')}
                        disabled={isTipBusy(tip.id)}
                        className="text-gray-400 hover:text-red-500 disabled:opacity-50 font-sans text-xs px-2 py-1"
                      >
                        Отхвърли
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleConvertToArticle(tip)}
                      disabled={isTipBusy(tip.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-zn-purple/10 text-zn-purple font-bold font-sans text-xs hover:bg-zn-purple/20 disabled:opacity-50 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Превърни в статия
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(tip.id)}
                      disabled={isTipBusy(tip.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors"
                    >
                      {isTipBusy(tip.id) ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
