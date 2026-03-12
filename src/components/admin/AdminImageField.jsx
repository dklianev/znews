import { useEffect, useMemo, useRef, useState } from 'react';
import { Image as ImageIcon, Search, Upload, X, RefreshCw, Crop } from 'lucide-react';
import ImageEditorDialog from './ImageEditorDialog';
import UploadWatermarkToggle from './UploadWatermarkToggle';
import { useAdminData } from '../../context/DataContext';
import useUploadWatermarkPreference from '../../hooks/useUploadWatermarkPreference';
import { api } from '../../utils/api';
import { getUploadFilenameFromMediaUrl } from '../../utils/editableMediaUrl';

function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

function normalizeObjectPosition(value) {
  const match = String(value || '').match(/(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/);
  const x = clamp(match?.[1] ?? 50, 0, 100);
  const y = clamp(match?.[2] ?? 50, 0, 100);
  return `${Math.round(x)}% ${Math.round(y)}%`;
}

function normalizeObjectScale(value) {
  return Number(clamp(value ?? 1, 1, 2.4).toFixed(2));
}

function normalizeImageMeta(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    ...source,
    objectPosition: normalizeObjectPosition(source.objectPosition),
    objectScale: normalizeObjectScale(source.objectScale),
  };
}

function getPreviewImageStyle(imageMeta) {
  const normalized = normalizeImageMeta(imageMeta);
  return {
    objectPosition: normalized.objectPosition,
    transform: normalized.objectScale !== 1 ? `scale(${normalized.objectScale})` : undefined,
    transformOrigin: normalized.objectPosition,
  };
}

function getImageRequirementStatus(details, requirements) {
  if (!details || !requirements || typeof requirements !== 'object') return null;

  const recommended = requirements.recommended && typeof requirements.recommended === 'object'
    ? requirements.recommended
    : null;
  const minimum = requirements.minimum && typeof requirements.minimum === 'object'
    ? requirements.minimum
    : null;
  const label = String(requirements.label || 'изображението');

  if (minimum && (details.width < minimum.width || details.height < minimum.height)) {
    return {
      tone: 'warning',
      message: `Размерът е под минимума за ${label}: нужно е поне ${minimum.width} x ${minimum.height}px.`,
    };
  }

  if (recommended && (details.width < recommended.width || details.height < recommended.height)) {
    return {
      tone: 'notice',
      message: `Размерът е под препоръчителния за ${label}: добре е да качиш ${recommended.width} x ${recommended.height}px или повече.`,
    };
  }

  if (recommended) {
    return {
      tone: 'ok',
      message: `Размерът покрива препоръчителния профил за ${label}.`,
    };
  }

  return null;
}

export default function AdminImageField({
  label = 'Изображение',
  value,
  onChange,
  placeholder = 'https://...',
  helperText = '',
  required = false,
  previewClassName = 'h-32',
  showManualInput = true,
  imageMeta = null,
  onChangeMeta = null,
  editorAspectPresets = null,
  defaultEditorMode = 'focal',
  guideMode = '',
  imageRequirements = null,
}) {
  const { media, ensureMediaLoaded, uploadMedia, refreshMedia } = useAdminData();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [editorUrl, setEditorUrl] = useState(null);
  const [editorFile, setEditorFile] = useState(null);
  const [applyWatermark, setApplyWatermark] = useUploadWatermarkPreference();
  const [imageDetails, setImageDetails] = useState(null);
  const [editableImageUrl, setEditableImageUrl] = useState('');
  const fileRef = useRef(null);
  const uploadLockRef = useRef(false);

  const filteredMedia = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return media;
    return media.filter((item) => (item.name || '').toLowerCase().includes(q));
  }, [media, query]);

  useEffect(() => {
    if (!pickerOpen) return;
    void ensureMediaLoaded();
  }, [ensureMediaLoaded, pickerOpen]);

  const previewImageStyle = useMemo(() => getPreviewImageStyle(imageMeta), [imageMeta]);
  const uploadFileName = useMemo(() => getUploadFilenameFromMediaUrl(value), [value]);
  const imageRequirementStatus = useMemo(
    () => getImageRequirementStatus(imageDetails, imageRequirements),
    [imageDetails, imageRequirements],
  );

  useEffect(() => {
    if (!value) {
      setEditableImageUrl('');
      return undefined;
    }

    if (!uploadFileName) {
      setEditableImageUrl(value);
      return undefined;
    }

    let cancelled = false;
    let objectUrl = '';

    api.media.getSourceBlob(uploadFileName)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setEditableImageUrl(objectUrl);
      })
      .catch(() => {
        if (cancelled) return;
        setEditableImageUrl(value);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [uploadFileName, value]);

  useEffect(() => {
    if (!value) {
      setImageDetails(null);
      return undefined;
    }

    let cancelled = false;
    const image = new window.Image();
    image.onload = () => {
      if (cancelled) return;
      setImageDetails({ width: image.naturalWidth || image.width, height: image.naturalHeight || image.height });
    };
    image.onerror = () => {
      if (cancelled) return;
      setImageDetails(null);
    };
    image.src = editableImageUrl || value;

    return () => {
      cancelled = true;
    };
  }, [editableImageUrl, value]);

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setEditorFile(file);
      setEditorUrl(url);
      return;
    }

    await processFile(file);
  };

  const processFile = async (file, { resetMeta = true } = {}) => {
    if (uploadLockRef.current) return;
    if (!file.type.startsWith('image/')) return;

    uploadLockRef.current = true;
    setUploading(true);

    try {
      const uploaded = await uploadMedia(file, { applyWatermark });
      if (uploaded?.url) {
        onChange(uploaded.url);
        if (resetMeta && onChangeMeta) {
          onChangeMeta({
            ...(imageMeta && typeof imageMeta === 'object' ? imageMeta : {}),
            objectPosition: '50% 50%',
            objectScale: 1,
          });
        }
      }
    } catch (error) {
      alert(`Грешка при качване: ${error.message}`);
    } finally {
      uploadLockRef.current = false;
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setEditorFile(file);
      setEditorUrl(url);
      return;
    }

    void processFile(file);
  };

  const handleEditSave = async (result) => {
    const normalizedMeta = normalizeImageMeta({
      ...(imageMeta && typeof imageMeta === 'object' ? imageMeta : {}),
      ...(result?.imageMeta && typeof result.imageMeta === 'object' ? result.imageMeta : {}),
      objectPosition: result?.objectPosition || result?.imageMeta?.objectPosition || imageMeta?.objectPosition,
      objectScale: result?.imageMeta?.objectScale ?? imageMeta?.objectScale ?? 1,
    });

    const editedFile = result?.file
      ? new File([result.file], result.action === 'crop' ? 'cropped-image.jpg' : 'edited-image.jpg', {
        type: result.file.type || 'image/jpeg',
      })
      : null;

    if (editedFile) {
      await processFile(editedFile, { resetMeta: false });
    } else if (result.action === 'focal' && editorFile) {
      await processFile(editorFile, { resetMeta: false });
    }

    if (onChangeMeta) {
      if (result.action === 'crop') {
        onChangeMeta({
          ...normalizedMeta,
          objectPosition: '50% 50%',
          objectScale: 1,
        });
      } else {
        onChangeMeta(normalizedMeta);
      }
    }

    setEditorUrl(null);
    setEditorFile(null);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => setDragActive(false);

  const labelCls = 'block text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500 mb-1';
  const inputCls = 'w-full px-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple';

  return (
    <div>
      <label className={labelCls}>
        {label}
        {required ? ' *' : ''}
      </label>

      {showManualInput && (
        <input
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={inputCls}
        />
      )}

      <div className={`${showManualInput ? 'mt-2' : ''} flex flex-wrap items-center gap-2`}>
        <UploadWatermarkToggle checked={applyWatermark} onChange={setApplyWatermark} />

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-xs font-sans font-semibold text-gray-600 hover:text-zn-purple hover:border-zn-purple/40 transition-colors"
        >
          <ImageIcon className="w-3.5 h-3.5" />
          Медийна библиотека
        </button>

        <label className={`inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-xs font-sans font-semibold cursor-pointer hover:text-zn-purple hover:border-zn-purple/40 transition-colors ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
          <Upload className="w-3.5 h-3.5" />
          {uploading ? 'Качване...' : 'Качи файл'}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={handleUpload}
          />
        </label>

        {value && (
          <>
            <button
              type="button"
              onClick={() => {
                setEditorFile(null);
                setEditorUrl(editableImageUrl || value);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-blue-200 text-xs font-sans font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Crop className="w-3.5 h-3.5" />
              Редакция
            </button>
            <button
              type="button"
              onClick={() => {
                onChange('');
                if (onChangeMeta) {
                  onChangeMeta({
                    ...(imageMeta && typeof imageMeta === 'object' ? imageMeta : {}),
                    objectPosition: '50% 50%',
                    objectScale: 1,
                  });
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-red-200 text-xs font-sans font-semibold text-red-600 hover:bg-red-50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Изчисти
            </button>
          </>
        )}
      </div>

      {helperText && (
        <p className="mt-1.5 text-xs font-sans text-gray-400">{helperText}</p>
      )}

      {(imageDetails || imageRequirementStatus) && (
        <div className="mt-2 space-y-1.5">
          {imageDetails && (
            <p className="text-[11px] font-sans font-semibold text-gray-500">{`${imageDetails.width} x ${imageDetails.height}px`}</p>
          )}
          {imageRequirementStatus && (
            <p className={`rounded-lg border px-3 py-2 text-[11px] font-sans ${imageRequirementStatus.tone === "warning"
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : imageRequirementStatus.tone === "ok"
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-sky-200 bg-sky-50 text-sky-800'}`}>
              {imageRequirementStatus.message}
            </p>
          )}
        </div>
      )}

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`mt-2 border-2 border-dashed transition-colors overflow-hidden ${previewClassName} ${dragActive
          ? 'border-zn-purple bg-zn-purple/5'
          : value
            ? 'border-gray-200 bg-gray-50'
            : 'border-gray-300 bg-gray-50'
          }`}
      >
        {uploading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs font-sans text-gray-500 animate-pulse">Качване...</p>
          </div>
        ) : value ? (
          <img
            src={value}
            alt=""
            className="w-full h-full object-cover"
            style={previewImageStyle}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Upload className="w-6 h-6 mb-1" />
            <p className="text-xs font-sans">Пусни изображение тук</p>
          </div>
        )}
      </div>

      {pickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4" onClick={() => setPickerOpen(false)}>
          <div className="bg-white max-w-5xl w-full max-h-[80vh] overflow-hidden border border-gray-200 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 p-4 border-b border-gray-200">
              <h3 className="font-display text-lg font-black text-gray-900 uppercase tracking-wider">Медийна библиотека</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={refreshMedia}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 text-xs font-sans text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Обнови
                </button>
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 border-b border-gray-200">
              <div className="relative max-w-md">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Търси по име на файл..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple"
                />
              </div>
            </div>

            <div className="p-4 overflow-y-auto max-h-[58vh]">
              {filteredMedia.length === 0 ? (
                <div className="text-center py-14 border border-dashed border-gray-300 bg-gray-50">
                  <ImageIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm font-sans text-gray-400">Няма резултати в библиотеката</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {filteredMedia.map((item) => {
                    const isSelected = value === item.url;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onChange(item.url);
                          if (onChangeMeta) {
                            onChangeMeta({
                              ...(imageMeta && typeof imageMeta === 'object' ? imageMeta : {}),
                              objectPosition: '50% 50%',
                              objectScale: 1,
                            });
                          }
                          setPickerOpen(false);
                        }}
                        className={`text-left border transition-colors overflow-hidden ${isSelected ? 'border-zn-purple ring-1 ring-zn-purple/30' : 'border-gray-200 hover:border-zn-purple/50'}`}
                      >
                        <div className="aspect-[4/3] bg-gray-100 overflow-hidden">
                          <img
                            src={item.url}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                        <div className="px-2.5 py-2">
                          <p className="text-[11px] font-sans font-semibold text-gray-700 truncate" title={item.name}>
                            {item.name}
                          </p>
                          <p className="text-[10px] font-sans text-gray-400 mt-0.5">
                            {(item.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {editorUrl && (
        <ImageEditorDialog
          imageUrl={editorUrl}
          initialFocalPoint={imageMeta?.objectPosition}
          initialImageMeta={imageMeta}
          aspectPresets={editorAspectPresets}
          defaultEditorMode={defaultEditorMode}
          guideMode={guideMode}
          onClose={() => {
            setEditorUrl(null);
            setEditorFile(null);
          }}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
}

