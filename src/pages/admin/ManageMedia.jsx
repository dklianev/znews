import { useMemo, useRef, useState } from 'react';
import { useData } from '../../context/DataContext';
import { Upload, Trash2, Copy, RefreshCw, Search, Image as ImageIcon, Sparkles, Loader2 } from 'lucide-react';

export default function ManageMedia() {
  const { media, mediaPipelineStatus, uploadMedia, deleteMedia, refreshMedia, backfillMediaPipeline } = useData();
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [workingFile, setWorkingFile] = useState(null);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillForce, setBackfillForce] = useState(false);
  const [backfillLimit, setBackfillLimit] = useState('');
  const [lastBackfillSummary, setLastBackfillSummary] = useState(null);
  const fileRef = useRef(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return media;
    return media.filter(item => (item.name || '').toLowerCase().includes(q));
  }, [media, query]);

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadMedia(file);
    } catch (error) {
      alert(`Грешка при качване: ${error.message}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (item) => {
    if (!confirm(`Изтрий ${item.name}?`)) return;
    setWorkingFile(item.name);
    try {
      await deleteMedia(item.name);
    } catch (error) {
      alert(`Не може да се изтрие: ${error.message}`);
    } finally {
      setWorkingFile(null);
    }
  };

  const copyUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore clipboard errors in unsupported environments
    }
  };

  const handleBackfill = async () => {
    setBackfilling(true);
    try {
      const limitNumber = Number.parseInt(backfillLimit, 10);
      const summary = await backfillMediaPipeline({
        force: backfillForce,
        limit: Number.isInteger(limitNumber) && limitNumber > 0 ? limitNumber : 0,
      });
      setLastBackfillSummary(summary);
    } catch (error) {
      alert(`Грешка при backfill: ${error.message}`);
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Media Library</h1>
          <p className="text-sm font-sans text-gray-500 mt-1">Качване и управление на снимки за статии, реклами и галерия</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={refreshMedia}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-sm font-sans text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Обнови
          </button>
          <button
            onClick={handleBackfill}
            disabled={backfilling || mediaPipelineStatus?.engine === 'disabled'}
            className="flex items-center gap-2 px-3 py-2 border border-zn-purple/30 text-sm font-sans text-zn-purple hover:bg-zn-purple/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {backfilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {backfilling ? 'Backfill...' : 'Pipeline backfill'}
          </button>
          <label className={`flex items-center gap-2 px-3 py-2 bg-zn-purple text-white text-sm font-sans font-semibold cursor-pointer hover:bg-zn-purple-dark transition-colors ${uploading ? 'opacity-70 pointer-events-none' : ''}`}>
            <Upload className="w-4 h-4" />
            {uploading ? 'Качване...' : 'Качи снимка'}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={handleUpload}
            />
          </label>
        </div>
      </div>

      <div className="mb-5 border border-gray-200 bg-white p-3.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-sans text-gray-600">
          <span className="font-semibold text-gray-800">
            Engine: {mediaPipelineStatus?.engine === 'sharp' ? 'sharp' : 'disabled'}
          </span>
          <span>Общо: {mediaPipelineStatus?.total ?? media.length}</span>
          <span>Готови: {mediaPipelineStatus?.ready ?? media.filter(item => item.pipelineReady).length}</span>
          <span>Чакащи: {mediaPipelineStatus?.pending ?? Math.max(media.length - media.filter(item => item.pipelineReady).length, 0)}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs font-sans text-gray-600">
            <input
              type="checkbox"
              checked={backfillForce}
              onChange={(event) => setBackfillForce(event.target.checked)}
              className="w-4 h-4 accent-zn-purple"
            />
            Force regenerate
          </label>
          <label className="inline-flex items-center gap-2 text-xs font-sans text-gray-600">
            Limit
            <input
              value={backfillLimit}
              onChange={(event) => setBackfillLimit(event.target.value)}
              placeholder="0 = всички"
              className="w-28 px-2 py-1 border border-gray-200 bg-white text-xs text-gray-700 outline-none focus:border-zn-purple"
            />
          </label>
          {mediaPipelineStatus?.engine === 'disabled' && (
            <span className="text-[11px] font-sans text-red-600">
              Инсталирай `sharp`, за да се генерират WebP/AVIF варианти.
            </span>
          )}
        </div>
        {lastBackfillSummary && (
          <p className="mt-2 text-[11px] font-sans text-gray-500">
            Последен backfill: +{lastBackfillSummary.generated} нови, {lastBackfillSummary.regenerated} regen, {lastBackfillSummary.skipped} skip, {lastBackfillSummary.failed} fail.
          </p>
        )}
      </div>

      <div className="mb-4 relative max-w-md">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Търси по име на файл..."
          className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-14 border border-dashed border-gray-300 bg-white">
          <ImageIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-sans text-gray-400">Няма качени снимки</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((item) => (
            <div key={item.id} className="bg-white border border-gray-200 overflow-hidden group">
              <div className="aspect-[4/3] bg-gray-100 overflow-hidden">
                <img
                  src={item.url}
                  alt={item.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="p-2.5">
                <p className="text-[11px] font-sans font-semibold text-gray-700 truncate" title={item.name}>
                  {item.name}
                </p>
                <p className="text-[10px] font-sans text-gray-400 mt-0.5">
                  {(item.size / 1024).toFixed(1)} KB
                </p>
                <p className={`text-[10px] font-sans mt-0.5 ${item.pipelineReady ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {item.pipelineReady ? 'Pipeline: ready' : 'Pipeline: pending'}
                </p>
                <div className="mt-2 flex items-center gap-1">
                  <button
                    onClick={() => copyUrl(item.url)}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-sans font-semibold text-gray-600 border border-gray-200 hover:text-zn-purple hover:border-zn-purple/40 transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    Копирай URL
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    disabled={workingFile === item.name}
                    className="p-1.5 text-gray-400 border border-gray-200 hover:text-red-600 hover:border-red-300 transition-colors disabled:opacity-40"
                    title="Изтрий"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
