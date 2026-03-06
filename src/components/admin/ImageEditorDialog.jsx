import { useCallback, useMemo, useState } from 'react';
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
} from 'lucide-react';

const DEFAULT_ASPECT_PRESETS = [
  { key: 'wide', label: '16:9 Wide', ratio: 16 / 9, css: '16 / 9' },
  { key: 'banner', label: '4:1 Banner', ratio: 4 / 1, css: '4 / 1' },
  { key: 'portrait', label: '3:4 Portrait', ratio: 3 / 4, css: '3 / 4' },
  { key: 'square', label: '1:1 Square', ratio: 1, css: '1 / 1' },
];

function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

function normalizeAspectPresets(presets) {
  const source = Array.isArray(presets) && presets.length > 0 ? presets : DEFAULT_ASPECT_PRESETS;
  return source
    .map((preset, index) => ({
      key: String(preset?.key || `preset-${index}`),
      label: String(preset?.label || `Preset ${index + 1}`),
      ratio: clamp(preset?.ratio, 0.2, 6),
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

function createImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', reject);
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });
}

async function getCroppedImg(imageSrc, pixelCrop) {
  if (!pixelCrop?.width || !pixelCrop?.height) {
    throw new Error('Missing crop area');
  }

  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) throw new Error('Canvas is not available');

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

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Unable to export crop'));
        return;
      }
      resolve(blob);
    }, 'image/jpeg', 0.92);
  });
}

export default function ImageEditorDialog({
  imageUrl,
  initialFocalPoint = null,
  initialImageMeta = null,
  aspectPresets = DEFAULT_ASPECT_PRESETS,
  initialAspectKey = '',
  defaultEditorMode = 'focal',
  onClose,
  onSave,
}) {
  const normalizedAspectPresets = useMemo(
    () => normalizeAspectPresets(aspectPresets),
    [aspectPresets],
  );
  const [mode, setMode] = useState(defaultEditorMode === 'crop' ? 'crop' : 'focal');
  const [activeAspectKey, setActiveAspectKey] = useState(
    () => selectInitialAspectKey(normalizedAspectPresets, initialAspectKey),
  );

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
  const [saving, setSaving] = useState(false);

  const activeAspectPreset = normalizedAspectPresets.find((preset) => preset.key === activeAspectKey)
    || normalizedAspectPresets[0]
    || DEFAULT_ASPECT_PRESETS[0];

  const onCropComplete = useCallback((_croppedArea, nextCroppedAreaPixels) => {
    setCroppedAreaPixels(nextCroppedAreaPixels);
  }, []);

  const handleReset = useCallback(() => {
    if (mode === 'crop') {
      setCrop({ x: 0, y: 0 });
      setCropZoom(1);
      return;
    }

    setFocusX(initialFocus.x);
    setFocusY(initialFocus.y);
    setFocusScale(initialScale);
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

      const objectPosition = formatObjectPosition(focusX, focusY);
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
      alert(error?.message || 'Image edit failed.');
    } finally {
      setSaving(false);
    }
  }, [croppedAreaPixels, focusScale, focusX, focusY, imageUrl, mode, onSave, saving]);

  const focalPresets = useMemo(
    () => [
      { label: 'Left', x: 18, y: focusY },
      { label: 'Center', x: 50, y: focusY },
      { label: 'Right', x: 82, y: focusY },
      { label: 'Top', x: focusX, y: 22 },
      { label: 'Middle', x: focusX, y: 50 },
      { label: 'Bottom', x: focusX, y: 78 },
    ],
    [focusX, focusY],
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4 py-8">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#120F18] text-white shadow-[0_28px_80px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-[#17131F] px-5 py-4">
          <div>
            <h3 className="font-display text-lg font-black uppercase tracking-[0.18em] text-white">Image editor</h3>
            <p className="mt-1 text-xs font-sans text-white/65">
              Tune crop, focus and scale so the image fits the exact frame.
            </p>
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
            Focus
          </button>
          <button
            type="button"
            onClick={() => setMode('crop')}
            disabled={saving}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] transition-colors ${mode === 'crop' ? 'border-zn-hot bg-zn-hot text-white' : 'border-white/10 text-white/70 hover:border-white/30 hover:text-white'}`}
          >
            <Crop className="h-4 w-4" />
            Crop
          </button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">Aspect</span>
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
                    className="relative overflow-hidden rounded-[22px] border border-white/10 bg-black"
                    style={{ aspectRatio: activeAspectPreset.css || '16 / 9' }}
                  >
                    <img
                      src={imageUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      style={{
                        objectPosition: formatObjectPosition(focusX, focusY),
                        transform: `scale(${focusScale})`,
                        transformOrigin: formatObjectPosition(focusX, focusY),
                      }}
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,9,15,0.16),rgba(11,9,15,0.1))]" />
                    <div className="absolute inset-[9%] border border-dashed border-white/45" />
                    <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/25" />
                    <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/25" />
                    <div
                      className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white/10 shadow-[0_0_0_3px_rgba(0,0,0,0.2)]"
                      style={{ left: `${focusX}%`, top: `${focusY}%` }}
                    />
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
                      Crop zoom
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
                    Drag the image to define the exact crop for the selected banner ratio.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">
                      <MoveHorizontal className="h-4 w-4" />
                      Horizontal focus
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
                      Vertical focus
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
                      Background scale
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
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">Quick anchors</div>
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
                    Use focus and scale for full-background banners so the subject sits correctly inside the frame.
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
            Reset
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white/75 transition-colors hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-zn-hot to-zn-orange px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(204,10,26,0.28)] transition-transform hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saving ? 'Saving...' : 'Apply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
