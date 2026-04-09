import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAdminData } from '../../context/DataContext';
import { Upload, Trash2, Copy, RefreshCw, Sparkles, Loader2 } from 'lucide-react';
import UploadWatermarkToggle from '../../components/admin/UploadWatermarkToggle';
import { useToast } from '../../components/admin/Toast';
import ImageEditorDialog from '../../components/admin/ImageEditorDialog';
import useUploadWatermarkPreference from '../../hooks/useUploadWatermarkPreference';
import { copyToClipboard } from '../../utils/copyToClipboard';
import { useConfirm } from '../../components/admin/ConfirmDialog';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminFilterBar from '../../components/admin/AdminFilterBar';
import AdminSearchField from '../../components/admin/AdminSearchField';

export default function ManageMedia() {
  const { media, mediaPipelineStatus, ensureMediaLoaded, uploadMedia, deleteMedia, refreshMedia, backfillMediaPipeline } = useAdminData();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [workingFile, setWorkingFile] = useState(null);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillForce, setBackfillForce] = useState(false);
  const [backfillLimit, setBackfillLimit] = useState('');
  const [lastBackfillSummary, setLastBackfillSummary] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [cropCandidate, setCropCandidate] = useState(null);
  const [applyWatermark, setApplyWatermark] = useUploadWatermarkPreference();
  const fileRef = useRef(null);
  const uploadLockRef = useRef(false);
  const confirm = useConfirm();

  useEffect(() => {
    void ensureMediaLoaded();
  }, [ensureMediaLoaded]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return media;
    return media.filter(item => (item.name || '').toLowerCase().includes(q));
  }, [media, query]);

  const totalSize = useMemo(() => {
    const bytes = media.reduce((acc, item) => acc + (item.size || 0), 0);
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, [media]);

  const processFiles = useCallback(async (files) => {
    if (uploadLockRef.current) return;
    if (!files || files.length === 0) return;
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      toast.warning('Моля, изберете само изображения');
      return;
    }
    uploadLockRef.current = true;
    setUploading(true);
    setUploadCount(imageFiles.length);
    let uploaded = 0;
    let failed = 0;
    try {
      for (const file of imageFiles) {
        try {
          await uploadMedia(file, { skipRefresh: true, applyWatermark });
          uploaded++;
        } catch {
          failed++;
        }
      }
      await refreshMedia();
      if (failed > 0) {
        toast.warning(`Качени: ${uploaded}, грешки: ${failed}`);
      } else if (uploaded === 1) {
        toast.success('Снимката е качена');
      } else {
        toast.success(`${uploaded} снимки качени`);
      }
    } finally {
      uploadLockRef.current = false;
      setUploading(false);
      setUploadCount(0);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [applyWatermark, uploadMedia, refreshMedia, toast]);

  const handleUpload = async (event) => {
    if (uploadLockRef.current) return;
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));

    if (imageFiles.length === 1) {
      setCropCandidate({
        file: imageFiles[0],
        url: URL.createObjectURL(imageFiles[0])
      });
    } else {
      await processFiles(files);
    }
  };

  const handleDelete = async (item) => {
    const confirmed = await confirm({
      title: 'Изтриване на файл',
      message: `Файлът "${item.name}" ще бъде изтрит безвъзвратно.`,
      confirmLabel: 'Изтрий',
      variant: 'danger',
    });
    if (!confirmed) return;
    setWorkingFile(item.name);
    try {
      await deleteMedia(item.name);
      toast.success('Файлът е изтрит');
    } catch (error) {
      toast.error(`Не може да се изтрие: ${error.message}`);
    } finally {
      setWorkingFile(null);
    }
  };

  const copyUrl = async (url) => {
    const copied = await copyToClipboard(url);
    if (copied) {
      toast.success('URL е копиран');
    } else {
      toast.error('URL не можа да бъде копиран');
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
      toast.success(`Backfill: +${summary.generated} нови, ${summary.regenerated} regen`);
    } catch (error) {
      toast.error(`Грешка при backfill: ${error.message}`);
    } finally {
      setBackfilling(false);
    }
  };

  // DnD handlers
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); };
  const handleDrop = async (e) => {
    if (uploadLockRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));

    if (imageFiles.length === 1) {
      setCropCandidate({
        file: imageFiles[0],
        url: URL.createObjectURL(imageFiles[0])
      });
    } else {
      await processFiles(files);
    }
  };

  return (
    <div
      className="p-8 min-h-full"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {cropCandidate && (
        <ImageEditorDialog
          imageUrl={cropCandidate.url}
          onClose={() => {
            URL.revokeObjectURL(cropCandidate.url);
            setCropCandidate(null);
            if (fileRef.current) fileRef.current.value = '';
          }}
          onSave={async (result) => {
            if (result.action === 'crop') {
              const finalFile = new File([result.file], cropCandidate.file.name, { type: result.file.type });
              URL.revokeObjectURL(cropCandidate.url);
              setCropCandidate(null);
              await processFiles([finalFile]);
            } else {
              // Proceed with original if they didn't really crop (e.g. they chose focal point mode)
              URL.revokeObjectURL(cropCandidate.url);
              setCropCandidate(null);
              await processFiles([cropCandidate.file]);
            }
          }}
        />
      )}

      {/* DnD overlay */}
      {dragActive && (
        <div className="fixed inset-0 z-50 bg-zn-purple/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-white border-2 border-dashed border-zn-purple px-12 py-10 flex flex-col items-center gap-3">
            <Upload className="w-12 h-12 text-zn-purple" />
            <p className="text-lg font-sans font-bold text-gray-900">Пусни снимките тук</p>
            <p className="text-sm font-sans text-gray-500">Поддържа множество файлове</p>
          </div>
        </div>
      )}

      <AdminPageHeader
        title="Медийна библиотека"
        description={`${media.length} файла · ${totalSize} общо — провлачи снимки навсякъде на страницата`}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
          <UploadWatermarkToggle checked={applyWatermark} onChange={setApplyWatermark} />
          <button
            onClick={refreshMedia}
            aria-label="Обнови медийната библиотека"
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
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? `Качване (${uploadCount})...` : 'Качи снимки'}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple
              className="hidden"
              onChange={handleUpload}
            />
          </label>
          </div>
        )}
      />

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

      <AdminFilterBar className="mb-4">
        <AdminSearchField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Търси по име на файл..."
          ariaLabel="Търси файлове в медийната библиотека"
          className="max-w-md"
        />
      </AdminFilterBar>

      {filtered.length === 0 ? (
        <div className="text-center py-14 border-2 border-dashed border-gray-300 bg-white cursor-pointer hover:border-zn-purple/40 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-sans text-gray-500 font-semibold">
            {query.trim() ? 'Няма файлове за текущото търсене' : 'Провлачи снимки тук или натисни за качване'}
          </p>
          <p className="text-xs font-sans text-gray-400 mt-1">
            {query.trim() ? 'Пробвай с друго име на файл или изчисти търсенето.' : 'JPEG, PNG, GIF, WebP'}
          </p>
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
                    aria-label={`Копирай URL за ${item.name}`}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-sans font-semibold text-gray-600 border border-gray-200 hover:text-zn-purple hover:border-zn-purple/40 transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    Копирай URL
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    disabled={workingFile === item.name}
                    aria-label={`Изтрий файла ${item.name}`}
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
