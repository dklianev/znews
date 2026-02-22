import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, Crop, MousePointerClick, Check, Loader2 } from 'lucide-react';

// Helper to create a cropped image
const createImage = (url) =>
    new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener('load', () => resolve(image));
        image.addEventListener('error', (error) => reject(error));
        image.setAttribute('crossOrigin', 'anonymous');
        image.src = url;
    });

async function getCroppedImg(imageSrc, pixelCrop) {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
    );

    return new Promise((resolve) => {
        canvas.toBlob((file) => {
            resolve(file);
        }, 'image/jpeg');
    });
}

export default function ImageEditorDialog({
    imageUrl,
    initialFocalPoint = null,
    onClose,
    onSave
}) {
    const [mode, setMode] = useState('focal'); // 'focal' | 'crop'
    const [saving, setSaving] = useState(false);

    // Crop state
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    // Focal point state
    // Focal point in react-easy-crop coordinates is a bit different, but we can simulate it
    // by letting them drag the image around and taking the center point.
    // Actually, for focal point, it's easier to just use the crop's center relative to the image size.
    const [mediaSize, setMediaSize] = useState({ width: 0, height: 0 });

    const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const onMediaLoaded = (mediaSize) => setMediaSize(mediaSize);

    const handleSave = async () => {
        if (saving) return;
        setSaving(true);
        if (mode === 'crop') {
            try {
                const croppedBlob = await getCroppedImg(imageUrl, croppedAreaPixels);
                await onSave({ action: 'crop', file: croppedBlob, objectPosition: null });
            } catch (e) {
                console.error(e);
                alert('Грешка при изрязването');
            } finally {
                setSaving(false);
            }
        } else {
            // Calculate focal point based on current transform
            // If the image is at x:0, y:0 and zoom:1, the focal point is 50% 50%
            // We can calculate the absolute center of the viewport relative to the image
            try {
                if (mediaSize.width && croppedAreaPixels) {
                    const centerX = croppedAreaPixels.x + (croppedAreaPixels.width / 2);
                    const centerY = croppedAreaPixels.y + (croppedAreaPixels.height / 2);
                    const percentageX = (centerX / mediaSize.width) * 100;
                    const percentageY = (centerY / mediaSize.height) * 100;

                    await onSave({
                        action: 'focal',
                        objectPosition: `${percentageX.toFixed(0)}% ${percentageY.toFixed(0)}%`
                    });
                }
            } catch (e) {
                console.error(e);
                alert('Грешка при записа');
            } finally {
                setSaving(false);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col pt-10 pb-20 px-4 items-center justify-center animate-in fade-in duration-200">
            <div className="bg-white rounded max-w-4xl w-full mx-auto flex flex-col shadow-2xl overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                    <div>
                        <h3 className="font-display font-black text-gray-900 uppercase tracking-wider">
                            Редактор на снимката
                        </h3>
                        <p className="text-xs text-gray-500 font-sans mt-0.5">
                            {mode === 'focal' ? 'Задай център на тежестта (Фокусна точка)' : 'Изрежи конкретна част'}
                        </p>
                    </div>
                    <button onClick={onClose} disabled={saving} className="p-2 text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 bg-white">
                    <button
                        onClick={() => setMode('focal')}
                        disabled={saving}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-sans font-bold transition-colors ${mode === 'focal' ? 'text-zn-purple border-b-2 border-zn-purple' : 'text-gray-500 hover:bg-gray-50'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        <MousePointerClick className="w-4 h-4" /> Фокусна точка
                    </button>
                    <button
                        onClick={() => setMode('crop')}
                        disabled={saving}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-sans font-bold transition-colors ${mode === 'crop' ? 'text-zn-purple border-b-2 border-zn-purple' : 'text-gray-500 hover:bg-gray-50'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        <Crop className="w-4 h-4" /> Изрязване (16:9)
                    </button>
                </div>

                {/* Cropper Area */}
                <div className="relative w-full h-[50vh] min-h-[400px] bg-black">
                    <Cropper
                        image={imageUrl}
                        crop={crop}
                        zoom={zoom}
                        aspect={mode === 'crop' ? 16 / 9 : undefined} // focal point can be free aspect, but we show 16:9 as preview usually. Let's force 16:9 for focal too as it represents the hero header
                        onCropChange={setCrop}
                        onCropComplete={onCropComplete}
                        onZoomChange={setZoom}
                        onMediaLoaded={onMediaLoaded}
                        showGrid={mode === 'crop'}
                        restrictPosition={true}
                    />
                </div>

                {/* Controls */}
                <div className="p-4 bg-white border-t border-gray-200">
                    <div className="flex items-center justify-between gap-6 max-w-xl mx-auto">
                        <div className="flex-1 flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Мащабиране (Zoom)</label>
                            <input
                                type="range"
                                value={zoom}
                                min={1}
                                max={3}
                                step={0.1}
                                aria-labelledby="Zoom"
                                onChange={(e) => setZoom(Number(e.target.value))}
                                disabled={saving}
                                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-zn-purple"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 border border-gray-300 text-sm font-sans font-bold text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Отказ
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-6 py-2 bg-zn-purple text-white text-sm font-sans font-bold hover:bg-zn-purple/90 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        {saving ? 'Запис...' : 'Запази промените'}
                    </button>
                </div>

            </div>
        </div>
    );
}
