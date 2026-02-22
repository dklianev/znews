import { useState, useRef, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useDocumentTitle, makeTitle } from '../hooks/useDocumentTitle';
import { Upload, MapPin, Send, AlertTriangle, CheckCircle, Image as ImageIcon, X } from 'lucide-react';

export default function TipLine() {
    useDocumentTitle(makeTitle('Гореща линия'));
    const { createTip } = useData();

    const [text, setText] = useState('');
    const [location, setLocation] = useState('');
    const [image, setImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);

    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const fileInputRef = useRef(null);

    // Revoke objectURL on unmount to prevent memory leaks
    useEffect(() => {
        return () => {
            if (imagePreview) URL.revokeObjectURL(imagePreview);
        };
    }, [imagePreview]);

    const handleImageChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                setError('Моля, качете валидна снимка (JPG, PNG).');
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                setError('Снимката е твърде голяма. Максимум 10MB.');
                return;
            }
            setImage(file);
            setImagePreview(URL.createObjectURL(file));
            setError('');
        }
    };

    const removeImage = () => {
        setImage(null);
        if (imagePreview) URL.revokeObjectURL(imagePreview);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!text.trim() && !image) {
            setError('Моля, добавете текст или снимка към сигнала.');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('text', text);
            formData.append('location', location);
            if (image) {
                formData.append('image', image);
            }

            await createTip(formData);
            setSubmitting(false);
            setSuccess(true);
        } catch (err) {
            setError(err.message || 'Възникна грешка при изпращането. Моля, опитайте отново.');
            setSubmitting(false);
        }
    };

    if (success) {
        return (
            <div className="max-w-3xl mx-auto px-4 py-12 md:py-20 animate-fade-in">
                <div className="comic-panel comic-dots bg-white p-8 md:p-12 text-center">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-zn-black" style={{ boxShadow: '4px 4px 0 #1C1428' }}>
                        <CheckCircle className="w-10 h-10 text-green-600" />
                    </div>
                    <h1 className="text-3xl md:text-5xl font-heading text-zn-black uppercase italic mb-4">Сигналът предава!</h1>
                    <p className="text-lg font-sans text-gray-700 mb-8 max-w-xl mx-auto">
                        Благодарим ви за подадената информация. Нашият екип от репортери ще разгледа сигнала ви веднага.
                    </p>
                    <button
                        onClick={() => {
                            setSuccess(false);
                            setSubmitting(false);
                            setError('');
                            setText('');
                            setLocation('');
                            removeImage();
                        }}
                        className="comic-button px-8 py-3 text-lg"
                    >
                        Подай нов сигнал
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 md:py-16 space-y-8 animate-fade-in">

            {/* Header section */}
            <div className="relative">
                <div className="absolute -inset-1 bg-zn-purple transform rotate-1 rounded border-2 border-zn-black pb-2 hidden md:block" />
                <div className="comic-panel comic-dots relative bg-white p-6 md:p-10 border-4 border-zn-black z-10">
                    <div className="flex flex-col md:flex-row gap-6 md:items-center">
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-zn-red shrink-0 border-4 border-zn-black flex items-center justify-center -rotate-3" style={{ boxShadow: '3px 3px 0 #1C1428' }}>
                            <AlertTriangle className="w-8 h-8 md:w-10 md:h-10 text-white" />
                        </div>
                        <div>
                            <h1 className="text-4xl md:text-5xl font-heading text-zn-black uppercase italic tracking-wide mb-2">
                                Гореща линия
                            </h1>
                            <p className="font-sans text-gray-700 text-lg">
                                Имате информация за престъпление? Били сте свидетел на корупция или ексклузивно събитие?
                                <span className="font-bold text-zn-red"> Анонимността ви е гарантирана.</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Form section */}
            <div className="comic-panel bg-white p-6 md:p-10 border-4 border-zn-black">
                <form onSubmit={handleSubmit} className="space-y-6">

                    {error && (
                        <div className="bg-red-50 text-red-700 p-4 border-2 border-red-200 font-sans flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                            <p>{error}</p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="block text-xl font-heading text-zn-black uppercase italic tracking-wide">
                            Какво се случи? *
                        </label>
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            className="w-full h-40 px-4 py-3 font-sans text-lg bg-gray-50 border-2 border-zn-black focus:outline-none focus:ring-4 focus:ring-zn-purple/20 focus:border-zn-purple transition-all resize-none shadow-[2px_2px_0_#1C1428]"
                            placeholder="Опишете събитието детайлно. Кой, какво, кога..."
                            aria-required="true"
                            aria-label="Описание на сигнала"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="block text-xl font-heading text-zn-black uppercase italic tracking-wide">
                                Къде се случи?
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <MapPin className="w-5 h-5 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 font-sans text-lg bg-gray-50 border-2 border-zn-black focus:outline-none focus:ring-4 focus:ring-zn-purple/20 focus:border-zn-purple transition-all shadow-[2px_2px_0_#1C1428]"
                                    placeholder="Улица, квартал или координати..."
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xl font-heading text-zn-black uppercase italic tracking-wide">
                                Снимков материал
                            </label>

                            {imagePreview ? (
                                <div className="relative border-4 border-zn-black shadow-[2px_2px_0_#1C1428] bg-black h-[54px] overflow-hidden flex items-center">
                                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover opacity-50" />
                                    <div className="absolute inset-0 flex items-center justify-between px-4">
                                        <div className="flex items-center gap-2 text-white font-sans text-sm truncate">
                                            <ImageIcon className="w-4 h-4" />
                                            <span className="truncate max-w-[150px] font-bold">{image?.name}</span>
                                        </div>
                                        <button type="button" onClick={removeImage} className="text-white hover:text-zn-red bg-black/50 p-1 rounded">
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full h-[54px] flex items-center justify-center gap-2 font-sans text-lg font-bold text-gray-600 bg-gray-100 border-2 border-dashed border-gray-400 hover:bg-gray-200 hover:border-zn-black transition-colors"
                                >
                                    <Upload className="w-5 h-5" />
                                    Качи доказателство
                                </button>
                            )}
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleImageChange}
                                accept="image/*"
                                className="hidden"
                            />
                        </div>
                    </div>

                    <div className="pt-6 border-t-2 border-black/10 flex flex-col md:flex-row items-center justify-between gap-6">
                        <p className="text-sm font-sans text-gray-500 md:max-w-xs">
                            IP адресът ви се обработва криптографски единствено с цел предотвратяване на спам.
                        </p>
                        <button
                            type="submit"
                            disabled={submitting || (!text.trim() && !image)}
                            className="comic-button flex items-center gap-2 text-xl w-full md:w-auto justify-center"
                        >
                            {submitting ? (
                                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Send className="w-6 h-6 -ml-1" />
                                    Изпрати сигнал
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
