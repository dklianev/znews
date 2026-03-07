import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import {
  X,
  Crop,
  MousePointerClick,
  Check,
  Loader2,
  RefreshCw,
  MoveHorizontal,
  MoveVertical,
  ZoomIn,
  SlidersHorizontal,
  RotateCw,
} from 'lucide-react';

const DEFAULT_ASPECT_PRESETS = [
  { key: 'wide', label: '16:9 Широк', ratio: 16 / 9, css: '16 / 9' },
  { key: 'banner', label: '4:1 Банер', ratio: 4 / 1, css: '4 / 1' },
  { key: 'portrait', label: '3:4 Портрет', ratio: 3 / 4, css: '3 / 4' },
  { key: 'square', label: '1:1 Квадрат', ratio: 1, css: '1 / 1' },
];

const DEFAULT_ADJUSTMENTS = Object.freeze({
  rotation: 0,
  flipX: false,
  flipY: false,
  brightness: 100,
  contrast: 100,
  saturation: 100,
});

function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

function normalizeQuarterTurn(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const turns = ((Math.round(numeric / 90) % 4) + 4) % 4;
  return turns * 90;
}

function normalizeAspectPresets(presets) {
  const source = Array.isArray(presets) && presets.length > 0 ? presets : DEFAULT_ASPECT_PRESETS;
  return source
    .map((preset, index) => ({
      key: String(preset?.key || `preset-${index}`),
      label: String(preset?.label || `Формат ${index + 1}`),
      ratio: clamp(preset?.ratio, 0.2, 8),
      css: String(preset?.css || '').trim() || null,
    }))
    .filter((preset) => Number.isFinite(preset.ratio) && preset.ratio > 0);
}

function selectInitialAspectKey(presets, initialAspectKey) {
  const requested = String(initialAspectKey || '').trim();
  if (requested && presets.some((preset) => preset.key === requested)) return requested;
  return presets[0]?.key || DEFAULT_ASPECT_PRESETS[0].key;
}

function parseObjectPosition(value) {
  const match = String(value || '').match(/(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/);
  return {
    x: clamp(match?.[1] ?? 50, 0, 100),
    y: clamp(match?.[2] ?? 50, 0, 100),
  };
}

function formatObjectPosition(x, y) {
  return `${Math.round(clamp(x, 0, 100))}% ${Math.round(clamp(y, 0, 100))}%`;
}

function buildPreviewFilter(adjustments) {
  return `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturation}%)`;
}

function hasAdjustmentChanges(adjustments) {
  return adjustments.rotation !== DEFAULT_ADJUSTMENTS.rotation
    || adjustments.flipX !== DEFAULT_ADJUSTMENTS.flipX
    || adjustments.flipY !== DEFAULT_ADJUSTMENTS.flipY
    || adjustments.brightness !== DEFAULT_ADJUSTMENTS.brightness
    || adjustments.contrast !== DEFAULT_ADJUSTMENTS.contrast
    || adjustments.saturation !== DEFAULT_ADJUSTMENTS.saturation;
}

function createImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', reject);
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Не успях да създам редактираното изображение.'));
        return;
      }
      resolve(blob);
    }, 'image/jpeg', 0.92);
  });
}

async function getCroppedImg(imageSrc, pixelCrop) {
  if (!pixelCrop?.width || !pixelCrop?.height) {
    throw new Error('Няма избрана област за изрязване.');
  }

  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) throw new Error('Canvas не е наличен.');

  canvas.width = Math.max(1, Math.round(pixelCrop.width));
  canvas.height = Math.max(1, Math.round(pixelCrop.height));

  context.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return canvasToBlob(canvas);
}

async function getAdjustedImg(imageSrc, adjustments) {
  const image = await createImage(imageSrc);
  const rotation = normalizeQuarterTurn(adjustments.rotation);
  const swapSides = rotation === 90 || rotation === 270;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) throw new Error('Canvas не е наличен.');

  canvas.width = swapSides ? image.height : image.width;
  canvas.height = swapSides ? image.width : image.height;

  context.filter = buildPreviewFilter(adjustments);
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((rotation * Math.PI) / 180);
  context.scale(adjustments.flipX ? -1 : 1, adjustments.flipY ? -1 : 1);
  context.drawImage(image, -image.width / 2, -image.height / 2);

  return canvasToBlob(canvas);
}

function GuideOverlay({ guideMode = '' }) {
  if (guideMode === 'ad-side') {
    return (
      <>
        <div className="pointer-events-none absolute inset-x-[15%] top-[16%] bottom-[22%] rounded-[24px] border border-dashed border-white/40" />
        <div className="pointer-events-none absolute inset-x-[28%] bottom-[12%] h-8 rounded-full border border-dashed border-white/35" />
      </>
    );
  }

  if (guideMode === 'ad-inline') {
    return (
      <>
        <div className="pointer-events-none absolute left-[5%] top-[20%] bottom-[20%] w-[58%] rounded-[18px] border border-dashed border-white/40" />
        <div className="pointer-events-none absolute right-[5%] top-1/2 h-7 w-[18%] -translate-y-1/2 rounded-full border border-dashed border-white/35" />
      </>
    );
  }

  if (guideMode === 'ad-horizontal') {
    return (
      <>
        <div className="pointer-events-none absolute left-[6%] top-[18%] bottom-[18%] w-[56%] rounded-[22px] border border-dashed border-white/40" />
        <div className="pointer-events-none absolute right-[5%] top-1/2 h-8 w-[16%] -translate-y-1/2 rounded-full border border-dashed border-white/35" />
      </>
    );
  }

  return null;
}

export default function ImageEditorDialog({
  imageUrl,
  initialFocalPoint = null,
  initialImageMeta = null,
  aspectPresets = DEFAULT_ASPECT_PRESETS,
  initialAspectKey = '',
  defaultEditorMode = 'focal',
  guideMode = '',
  onClose,
  onSave,
}) {
  const frameRef = useRef(null);
  const [imageInfo, setImageInfo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [draggingFocus, setDraggingFocus] = useState(false);

  useEffect(() => {
    let cancelled = false;
    createImage(imageUrl)
      .then((image) => {
        if (cancelled) return;
        setImageInfo({ width: image.naturalWidth || image.width, height: image.naturalHeight || image.height });
      })
      .catch(() => {
        if (cancelled) return;
        setImageInfo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  const normalizedAspectPresets = useMemo(() => {
    const normalized = normalizeAspectPresets(aspectPresets);
    if (!imageInfo?.width || !imageInfo?.height) return normalized;
    const originalPreset = {
      key: 'original',
      label: 'Оригинал',
      ratio: imageInfo.width / imageInfo.height,
      css: `${imageInfo.width} / ${imageInfo.height}`,
    };
    return normalized.some((preset) => preset.key === 'original')
      ? normalized
      : [originalPreset, ...normalized];
  }, [aspectPresets, imageInfo]);

  const [mode, setMode] = useState(
    defaultEditorMode === 'crop' ? 'crop' : (defaultEditorMode === 'adjust' ? 'adjust' : 'focal'),
  );
  const [activeAspectKey, setActiveAspectKey] = useState(
    () => selectInitialAspectKey(normalizedAspectPresets, initialAspectKey),
  );

  useEffect(() => {
    if (!normalizedAspectPresets.some((preset) => preset.key === activeAspectKey)) {
      setActiveAspectKey(selectInitialAspectKey(normalizedAspectPresets, initialAspectKey));
    }
  }, [activeAspectKey, initialAspectKey, normalizedAspectPresets]);

  const initialFocus = useMemo(
    () => parseObjectPosition(initialImageMeta?.objectPosition || initialFocalPoint),
    [initialFocalPoint, initialImageMeta?.objectPosition],
  );
  const initialScale = useMemo(
    () => clamp(initialImageMeta?.objectScale ?? 1, 1, 2.4),
    [initialImageMeta?.objectScale],
  );

  const [focusX, setFocusX] = useState(initialFocus.x);
  const [focusY, setFocusY] = useState(initialFocus.y);
  const [focusScale, setFocusScale] = useState(initialScale);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [adjustments, setAdjustments] = useState(() => ({ ...DEFAULT_ADJUSTMENTS }));

  const activeAspectPreset = normalizedAspectPresets.find((preset) => preset.key === activeAspectKey)
    || normalizedAspectPresets[0]
    || DEFAULT_ASPECT_PRESETS[0];
  const adjustmentFilter = useMemo(() => buildPreviewFilter(adjustments), [adjustments]);
  const adjustmentChanged = useMemo(() => hasAdjustmentChanges(adjustments), [adjustments]);

  const onCropComplete = useCallback((_croppedArea, nextCroppedAreaPixels) => {
    setCroppedAreaPixels(nextCroppedAreaPixels);
  }, []);

  const updateFocusFromPointer = useCallback((clientX, clientY) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nextX = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
    const nextY = clamp(((clientY - rect.top) / rect.height) * 100, 0, 100);
    setFocusX(nextX);
    setFocusY(nextY);
  }, []);

  const handleFocalPointerDown = useCallback((event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDraggingFocus(true);
    updateFocusFromPointer(event.clientX, event.clientY);
  }, [updateFocusFromPointer]);

  const handleFocalPointerMove = useCallback((event) => {
    if (!draggingFocus) return;
    updateFocusFromPointer(event.clientX, event.clientY);
  }, [draggingFocus, updateFocusFromPointer]);

  const handleFocalPointerUp = useCallback((event) => {
    if (!draggingFocus) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setDraggingFocus(false);
  }, [draggingFocus]);

  const handleReset = useCallback(() => {
    if (mode === 'crop') {
      setCrop({ x: 0, y: 0 });
      setCropZoom(1);
      return;
    }

    if (mode === 'adjust') {
      setAdjustments({ ...DEFAULT_ADJUSTMENTS });
      return;
    }

    setFocusX(initialFocus.x);
    setFocusY(initialFocus.y);
    setFocusScale(initialScale);
    setAdjustments({ ...DEFAULT_ADJUSTMENTS });
  }, [initialFocus.x, initialFocus.y, initialScale, mode]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);

    try {
      if (mode === 'crop') {
        const croppedBlob = await getCroppedImg(imageUrl, croppedAreaPixels);
        await onSave({
          action: 'crop',
          file: croppedBlob,
          imageMeta: {
            objectPosition: '50% 50%',
            objectScale: 1,
          },
        });
        return;
      }

      if (mode === 'adjust') {
        const adjustedBlob = await getAdjustedImg(imageUrl, adjustments);
        await onSave({
          action: 'adjust',
          file: adjustedBlob,
          imageMeta: {
            objectPosition: formatObjectPosition(initialFocus.x, initialFocus.y),
            objectScale: Number(initialScale.toFixed(2)),
          },
        });
        return;
      }

      const objectPosition = formatObjectPosition(focusX, focusY);
      if (adjustmentChanged) {
        const adjustedBlob = await getAdjustedImg(imageUrl, adjustments);
        await onSave({
          action: 'focal',
          file: adjustedBlob,
          objectPosition,
          imageMeta: {
            objectPosition,
            objectScale: Number(focusScale.toFixed(2)),
          },
        });
        return;
      }

      await onSave({
        action: 'focal',
        objectPosition,
        imageMeta: {
          objectPosition,
          objectScale: Number(focusScale.toFixed(2)),
        },
      });
    } catch (error) {
      console.error(error);
      alert(error?.message || 'Не успях да запазя редакцията.');
    } finally {
      setSaving(false);
    }
  }, [adjustmentChanged, adjustments, croppedAreaPixels, focusScale, focusX, focusY, imageUrl, initialFocus.x, initialFocus.y, initialScale, mode, onSave, saving]);

  const focalPresets = useMemo(
    () => [
      { label: 'Ляво', x: 18, y: focusY },
      { label: 'Център', x: 50, y: focusY },
      { label: 'Дясно', x: 82, y: focusY },
      { label: 'Горе', x: focusX, y: 22 },
      { label: 'Среда', x: focusX, y: 50 },
      { label: 'Долу', x: focusX, y: 78 },
    ],
    [focusX, focusY],
  );

  const focalPreviewStyle = useMemo(() => ({
    objectPosition: formatObjectPosition(focusX, focusY),
    transform: `rotate(${adjustments.rotation}deg) scale(${focusScale * (adjustments.flipX ? -1 : 1)}, ${focusScale * (adjustments.flipY ? -1 : 1)})`,
    transformOrigin: formatObjectPosition(focusX, focusY),
    filter: adjustmentFilter,
  }), [adjustmentFilter, adjustments.flipX, adjustments.flipY, adjustments.rotation, focusScale, focusX, focusY]);

  const adjustPreviewStyle = useMemo(() => ({
    transform: `rotate(${adjustments.rotation}deg) scale(${adjustments.flipX ? -1 : 1}, ${adjustments.flipY ? -1 : 1})`,
    filter: adjustmentFilter,
  }), [adjustmentFilter, adjustments.flipX, adjustments.flipY, adjustments.rotation]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4 py-8">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#120F18] text-white shadow-[0_28px_80px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-[#17131F] px-5 py-4">
          <div>
            <h3 className="font-display text-lg font-black uppercase tracking-[0.18em] text-white">Редактор на изображение</h3>
            <p className="mt-1 text-xs font-sans text-white/65">
              Премествай фокуса директно в preview-то, изрязвай и прави корекции преди запазване.
            </p>
            {imageInfo && (
              <p className="mt-2 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/70">
                {`${imageInfo.width} × ${imageInfo.height}px`}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full border border-white/10 p-2 text-white/60 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-[#120F18] px-5 py-3">
          <button
            type="button"
            onClick={() => setMode('focal')}
            disabled={saving}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] transition-colors ${mode === 'focal' ? 'border-zn-hot bg-zn-hot text-white' : 'border-white/10 text-white/70 hover:border-white/30 hover:text-white'}`}
          >
            <MousePointerClick className="h-4 w-4" />
            Фокус
          </button>
          <button
            type="button"
            onClick={() => setMode('crop')}
            disabled={saving}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] transition-colors ${mode === 'crop' ? 'border-zn-hot bg-zn-hot text-white' : 'border-white/10 text-white/70 hover:border-white/30 hover:text-white'}`}
          >
            <Crop className="h-4 w-4" />
            Изрязване
          </button>
          <button
            type="button"
            onClick={() => setMode('adjust')}
            disabled={saving}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] transition-colors ${mode === 'adjust' ? 'border-zn-hot bg-zn-hot text-white' : 'border-white/10 text-white/70 hover:border-white/30 hover:text-white'}`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Корекции
          </button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">Формат</span>
            {normalizedAspectPresets.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => setActiveAspectKey(preset.key)}
                disabled={saving}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${activeAspectKey === preset.key ? 'border-white bg-white text-[#120F18]' : 'border-white/10 text-white/70 hover:border-white/30 hover:text-white'}`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="relative min-h-[360px] bg-[#09070D]">
            {mode === 'crop' ? (
              <Cropper
                image={imageUrl}
                crop={crop}
                zoom={cropZoom}
                aspect={activeAspectPreset.ratio}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setCropZoom}
                showGrid
                restrictPosition
              />
            ) : (
              <div className="flex h-full items-center justify-center p-6">
                <div className="w-full max-w-3xl rounded-[28px] border border-white/10 bg-[#15111A] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.35)]">
                  <div
                    ref={frameRef}
                    className={`relative overflow-hidden rounded-[22px] border border-white/10 bg-black ${mode === 'focal' ? 'cursor-grab active:cursor-grabbing' : ''}`}
                    style={{ aspectRatio: activeAspectPreset.css || '16 / 9' }}
                    onPointerDown={mode === 'focal' ? handleFocalPointerDown : undefined}
                    onPointerMove={mode === 'focal' ? handleFocalPointerMove : undefined}
                    onPointerUp={mode === 'focal' ? handleFocalPointerUp : undefined}
                    onPointerCancel={mode === 'focal' ? handleFocalPointerUp : undefined}
                    onDoubleClick={mode === 'focal' ? handleReset : undefined}
                  >
                    {mode === 'adjust' ? (
                      <img
                        src={imageUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-contain"
                        style={adjustPreviewStyle}
                      />
                    ) : (
                      <img
                        src={imageUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                        style={focalPreviewStyle}
                      />
                    )}
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,9,15,0.16),rgba(11,9,15,0.1))]" />
                    <div className="absolute inset-[9%] border border-dashed border-white/45" />
                    <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/25" />
                    <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/25" />
                    <GuideOverlay guideMode={guideMode} />
                    {mode === 'focal' && (
                      <div
                        className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white/10 shadow-[0_0_0_3px_rgba(0,0,0,0.2)]"
                        style={{ left: `${focusX}%`, top: `${focusY}%` }}
                      />
                    )}
                    {mode === 'focal' && (
                      <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/45 px-3 py-1 text-[11px] font-semibold text-white/80">
                        Дръпни изображението за нов фокус
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-white/10 bg-[#120F18] px-5 py-5 lg:border-l lg:border-t-0">
            <div className="space-y-5">
              {mode === 'crop' ? (
                <div className="space-y-5">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">
                      <ZoomIn className="h-4 w-4" />
                      Увеличение за изрязване
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="4"
                      step="0.05"
                      value={cropZoom}
                      onChange={(event) => setCropZoom(clamp(event.target.value, 1, 4))}
                      disabled={saving}
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-zn-hot"
                    />
                    <div className="mt-2 text-xs text-white/55">{Math.round(cropZoom * 100)}%</div>
                  </div>
                  <p className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs leading-5 text-white/60">
                    Използвай този режим, когато искаш да смениш самото изображение и да го качиш вече изрязано.
                  </p>
                </div>
              ) : mode === 'adjust' ? (
                <div className="space-y-5">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">
                      <RotateCw className="h-4 w-4" />
                      Ориентация
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setAdjustments((prev) => ({ ...prev, rotation: normalizeQuarterTurn(prev.rotation - 90) }))}
                        disabled={saving}
                        className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/75 transition-colors hover:border-white/30 hover:text-white"
                      >
                        Завърти наляво
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdjustments((prev) => ({ ...prev, rotation: normalizeQuarterTurn(prev.rotation + 90) }))}
                        disabled={saving}
                        className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/75 transition-colors hover:border-white/30 hover:text-white"
                      >
                        Завърти надясно
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdjustments((prev) => ({ ...prev, flipX: !prev.flipX }))}
                        disabled={saving}
                        className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${adjustments.flipX ? 'border-white bg-white text-[#120F18]' : 'border-white/10 text-white/75 hover:border-white/30 hover:text-white'}`}
                      >
                        Огледай хоризонтално
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdjustments((prev) => ({ ...prev, flipY: !prev.flipY }))}
                        disabled={saving}
                        className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${adjustments.flipY ? 'border-white bg-white text-[#120F18]' : 'border-white/10 text-white/75 hover:border-white/30 hover:text-white'}`}
                      >
                        Огледай вертикално
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">Яркост</div>
                    <input
                      type="range"
                      min="60"
                      max="140"
                      step="1"
                      value={adjustments.brightness}
                      onChange={(event) => setAdjustments((prev) => ({ ...prev, brightness: clamp(event.target.value, 60, 140) }))}
                      disabled={saving}
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-zn-hot"
                    />
                    <div className="mt-2 text-xs text-white/55">{Math.round(adjustments.brightness)}%</div>
                  </div>

                  <div>
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">Контраст</div>
                    <input
                      type="range"
                      min="60"
                      max="160"
                      step="1"
                      value={adjustments.contrast}
                      onChange={(event) => setAdjustments((prev) => ({ ...prev, contrast: clamp(event.target.value, 60, 160) }))}
                      disabled={saving}
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-zn-hot"
                    />
                    <div className="mt-2 text-xs text-white/55">{Math.round(adjustments.contrast)}%</div>
                  </div>

                  <div>
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">Наситеност</div>
                    <input
                      type="range"
                      min="0"
                      max="180"
                      step="1"
                      value={adjustments.saturation}
                      onChange={(event) => setAdjustments((prev) => ({ ...prev, saturation: clamp(event.target.value, 0, 180) }))}
                      disabled={saving}
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-zn-hot"
                    />
                    <div className="mt-2 text-xs text-white/55">{Math.round(adjustments.saturation)}%</div>
                  </div>

                  <p className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs leading-5 text-white/60">
                    Корекциите запазват нов файл. Ако след това искаш и нов crop, просто отвори редактора още веднъж.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">
                      <MoveHorizontal className="h-4 w-4" />
                      Хоризонтален фокус
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={focusX}
                      onChange={(event) => setFocusX(clamp(event.target.value, 0, 100))}
                      disabled={saving}
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-zn-hot"
                    />
                    <div className="mt-2 text-xs text-white/55">{Math.round(focusX)}%</div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">
                      <MoveVertical className="h-4 w-4" />
                      Вертикален фокус
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={focusY}
                      onChange={(event) => setFocusY(clamp(event.target.value, 0, 100))}
                      disabled={saving}
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-zn-hot"
                    />
                    <div className="mt-2 text-xs text-white/55">{Math.round(focusY)}%</div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">
                      <ZoomIn className="h-4 w-4" />
                      Мащаб на кадъра
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="2.4"
                      step="0.05"
                      value={focusScale}
                      onChange={(event) => setFocusScale(clamp(event.target.value, 1, 2.4))}
                      disabled={saving}
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-zn-hot"
                    />
                    <div className="mt-2 text-xs text-white/55">{Math.round(focusScale * 100)}%</div>
                  </div>
                  <div>
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">Бързи позиции</div>
                    <div className="flex flex-wrap gap-2">
                      {focalPresets.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setFocusX(preset.x);
                            setFocusY(preset.y);
                          }}
                          disabled={saving}
                          className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/75 transition-colors hover:border-white/30 hover:text-white"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs leading-5 text-white/60">
                    Дръпни изображението директно в preview-то. Двоен клик връща фокуса и zoom-а към началното състояние.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-[#17131F] px-5 py-4">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white/75 transition-colors hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            Нулирай
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white/75 transition-colors hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Отказ
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-zn-hot to-zn-orange px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(204,10,26,0.28)] transition-transform hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saving ? 'Запазване...' : 'Приложи'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
