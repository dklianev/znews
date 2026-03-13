import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Upload, MapPin, Send, AlertTriangle, CheckCircle, Image as ImageIcon, X } from 'lucide-react';
import { usePublicData } from '../context/DataContext';
import { useDocumentTitle, makeTitle } from '../hooks/useDocumentTitle';

const INITIAL_TIP_STATE = Object.freeze({
  status: 'idle',
  message: '',
  fieldErrors: {},
});

function TipLineSubmitButton({ disabled }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="comic-button flex items-center gap-2 text-xl w-full md:w-auto justify-center disabled:cursor-not-allowed disabled:opacity-60"
      aria-busy={pending}
    >
      {pending ? (
        <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          <Send className="w-6 h-6 -ml-1" />
          {'\u0418\u0437\u043f\u0440\u0430\u0442\u0438 \u0441\u0438\u0433\u043d\u0430\u043b\u0430'}
        </>
      )}
    </button>
  );
}

export default function TipLine() {
  useDocumentTitle(makeTitle('\u0413\u043e\u0440\u0435\u0449\u0430 \u043b\u0438\u043d\u0438\u044f'));
  const { createTip } = usePublicData();

  const [text, setText] = useState('');
  const [location, setLocation] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [success, setSuccess] = useState(false);
  const [clientError, setClientError] = useState('');
  const [dismissTipError, setDismissTipError] = useState(false);
  const [tipFieldErrors, setTipFieldErrors] = useState({});
  const fileInputRef = useRef(null);
  const [tipState, submitTipAction, isTipPending] = useActionState(
    async (_previousState, formData) => {
      const nextText = String(formData.get('text') || '').trim();
      const nextLocation = String(formData.get('location') || '').trim();
      const nextImage = formData.get('image');
      const hasImage = nextImage instanceof File && nextImage.size > 0;

      if (!nextText && !hasImage) {
        return {
          status: 'error',
          message: '\u0414\u043e\u0431\u0430\u0432\u0438 \u0442\u0435\u043a\u0441\u0442 \u0438\u043b\u0438 \u0441\u043d\u0438\u043c\u043a\u0430, \u0437\u0430 \u0434\u0430 \u0438\u0437\u043f\u0440\u0430\u0442\u0438\u0448 \u0441\u0438\u0433\u043d\u0430\u043b\u0430.',
          fieldErrors: {
            text: '\u0414\u043e\u0431\u0430\u0432\u0438 \u0442\u0435\u043a\u0441\u0442 \u043a\u044a\u043c \u0441\u0438\u0433\u043d\u0430\u043b\u0430 \u0438\u043b\u0438 \u043a\u0430\u0447\u0438 \u0441\u043d\u0438\u043c\u043a\u0430.',
            image: '\u041a\u0430\u0447\u0438 \u0441\u043d\u0438\u043c\u043a\u0430, \u0430\u043a\u043e \u043d\u0435 \u0438\u0437\u043f\u0440\u0430\u0449\u0430\u0448 \u0442\u0435\u043a\u0441\u0442.',
          },
        };
      }

      try {
        const payload = new FormData();
        payload.set('text', nextText);
        payload.set('location', nextLocation);
        if (hasImage) payload.set('image', nextImage);

        await createTip(payload);
        return {
          status: 'success',
          message: '',
          fieldErrors: {},
        };
      } catch (error) {
        const payloadFieldErrors = error?.payload?.fieldErrors && typeof error.payload.fieldErrors === 'object'
          ? error.payload.fieldErrors
          : {};

        return {
          status: 'error',
          message: error?.message || '\u0421\u0438\u0433\u043d\u0430\u043b\u044a\u0442 \u043d\u0435 \u043c\u043e\u0436\u0430 \u0434\u0430 \u0431\u044a\u0434\u0435 \u0438\u0437\u043f\u0440\u0430\u0442\u0435\u043d. \u041e\u043f\u0438\u0442\u0430\u0439 \u043f\u0430\u043a.',
          fieldErrors: payloadFieldErrors,
        };
      }
    },
    INITIAL_TIP_STATE,
  );

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  useEffect(() => {
    if (tipState.status !== 'success') return;
    setSuccess(true);
    setText('');
    setLocation('');
    setClientError('');
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [imagePreview, tipState.status]);

  useEffect(() => {
    setTipFieldErrors(tipState.fieldErrors || {});
  }, [tipState.fieldErrors]);

  useEffect(() => {
    if (tipState.status !== 'error') {
      setDismissTipError(false);
    }
  }, [tipState.status]);

  const clearTipFieldError = (field) => {
    setTipFieldErrors((prev) => {
      if (!prev?.[field]) return prev;
      return {
        ...prev,
        [field]: '',
      };
    });
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setClientError('\u041c\u043e\u0436\u0435 \u0434\u0430 \u043a\u0430\u0447\u0432\u0430\u0448 \u0441\u0430\u043c\u043e \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f (JPG, PNG, WEBP).');
      event.target.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setClientError('\u0421\u043d\u0438\u043c\u043a\u0430\u0442\u0430 \u0435 \u043f\u0440\u0435\u043a\u0430\u043b\u0435\u043d\u043e \u0433\u043e\u043b\u044f\u043c\u0430. \u041c\u0430\u043a\u0441\u0438\u043c\u0443\u043c\u044a\u0442 \u0435 10 MB.');
      event.target.value = '';
      return;
    }

    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
    setClientError('');
    setDismissTipError(true);
    clearTipFieldError('image');
    clearTipFieldError('text');
  };

  const removeImage = () => {
    setImage(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setClientError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    setDismissTipError(true);
    clearTipFieldError('image');
  };

  const tipError = clientError || (tipState.status === 'error' && !dismissTipError ? tipState.message : '');

  if (success) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 md:py-20 animate-fade-in">
        <div className="comic-panel comic-dots bg-white dark:bg-[#2A2438] p-8 md:p-12 text-center">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-zn-black dark:border-[#524A62] comic-ink-shadow">
            <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-3xl md:text-5xl font-heading text-zn-black dark:text-[#EDE4D0] uppercase italic mb-4">{'\u0421\u0438\u0433\u043d\u0430\u043b\u044a\u0442 \u0435 \u043f\u0440\u0435\u0434\u0430\u0434\u0435\u043d!'}</h1>
          <p className="text-lg font-sans text-gray-700 dark:text-gray-300 mb-8 max-w-xl mx-auto">
            {'\u0411\u043b\u0430\u0433\u043e\u0434\u0430\u0440\u0438\u043c \u0432\u0438 \u0437\u0430 \u043f\u043e\u0434\u0430\u0434\u0435\u043d\u0430\u0442\u0430 \u0438\u043d\u0444\u043e\u0440\u043c\u0430\u0446\u0438\u044f. \u041d\u0430\u0448\u0438\u044f\u0442 \u0435\u043a\u0438\u043f \u043e\u0442 \u0440\u0435\u043f\u043e\u0440\u0442\u0435\u0440\u0438 \u0449\u0435 \u0440\u0430\u0437\u0433\u043b\u0435\u0434\u0430 \u0441\u0438\u0433\u043d\u0430\u043b\u0430 \u0432\u0438 \u0432\u0435\u0434\u043d\u0430\u0433\u0430.'}
          </p>
          <button
            onClick={() => {
              setSuccess(false);
              setClientError('');
              setText('');
              setLocation('');
              removeImage();
            }}
            className="comic-button px-8 py-3 text-lg"
          >
            {'\u041f\u043e\u0434\u0430\u0439 \u043d\u043e\u0432 \u0441\u0438\u0433\u043d\u0430\u043b'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-16 space-y-8 animate-fade-in">
      <div className="relative">
        <div className="absolute -inset-1 bg-zn-purple transform rotate-1 rounded border-2 border-zn-black dark:border-[#524A62] pb-2 hidden md:block" />
        <div className="comic-panel comic-dots relative bg-white dark:bg-[#2A2438] p-6 md:p-10 border-4 border-zn-black dark:border-[#524A62] z-10">
          <div className="flex flex-col md:flex-row gap-6 md:items-center">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-zn-red shrink-0 border-4 border-zn-black dark:border-[#524A62] flex items-center justify-center -rotate-3 comic-ink-shadow">
              <AlertTriangle className="w-8 h-8 md:w-10 md:h-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-heading text-zn-black dark:text-[#EDE4D0] uppercase italic tracking-wide mb-2">
                {'\u0413\u043e\u0440\u0435\u0449\u0430 \u043b\u0438\u043d\u0438\u044f'}
              </h1>
              <p className="font-sans text-gray-700 dark:text-gray-300 text-lg">
                {'\u0418\u043c\u0430\u0442\u0435 \u0438\u043d\u0444\u043e\u0440\u043c\u0430\u0446\u0438\u044f \u0437\u0430 \u043f\u0440\u0435\u0441\u0442\u044a\u043f\u043b\u0435\u043d\u0438\u0435? \u0411\u0438\u043b\u0438 \u0441\u0442\u0435 \u0441\u0432\u0438\u0434\u0435\u0442\u0435\u043b \u043d\u0430 \u043a\u043e\u0440\u0443\u043f\u0446\u0438\u044f \u0438\u043b\u0438 \u0435\u043a\u0441\u043a\u043b\u0443\u0437\u0438\u0432\u043d\u043e \u0441\u044a\u0431\u0438\u0442\u0438\u0435?'}
                <span className="font-bold text-zn-red"> {'\u0410\u043d\u043e\u043d\u0438\u043c\u043d\u043e\u0441\u0442\u0442\u0430 \u0432\u0438 \u0435 \u0433\u0430\u0440\u0430\u043d\u0442\u0438\u0440\u0430\u043d\u0430.'}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="comic-panel bg-white dark:bg-[#2A2438] p-6 md:p-10 border-4 border-zn-black dark:border-[#524A62]">
        <form action={submitTipAction} aria-busy={isTipPending} className="space-y-6">
          {tipError && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-4 border-2 border-red-200 dark:border-red-800/50 font-sans flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{tipError}</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xl font-heading text-zn-black dark:text-[#EDE4D0] uppercase italic tracking-wide">
              {'\u041a\u0430\u043a\u0432\u043e \u0441\u0435 \u0441\u043b\u0443\u0447\u0438? *'}
            </label>
            <textarea
              name="text"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setDismissTipError(true);
                clearTipFieldError('text');
              }}
              disabled={isTipPending}
              aria-invalid={Boolean(tipFieldErrors.text)}
              aria-describedby={tipFieldErrors.text ? 'tipline-text-error' : undefined}
              className="w-full h-40 px-4 py-3 font-sans text-lg bg-gray-50 dark:bg-[#1C1828] dark:text-gray-200 border-2 border-zn-black dark:border-[#524A62] focus:outline-none focus:ring-4 focus:ring-zn-purple/20 focus:border-zn-purple transition-all resize-none comic-ink-shadow-sm dark:placeholder-gray-500"
              placeholder={'\u041e\u043f\u0438\u0448\u0435\u0442\u0435 \u0441\u044a\u0431\u0438\u0442\u0438\u0435\u0442\u043e \u0434\u0435\u0442\u0430\u0439\u043b\u043d\u043e. \u041a\u043e\u0439, \u043a\u0430\u043a\u0432\u043e, \u043a\u043e\u0433\u0430...'}
              aria-required="true"
              aria-label={'\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u043d\u0430 \u0441\u0438\u0433\u043d\u0430\u043b\u0430'}
            />
            {tipFieldErrors.text && (
              <p id="tipline-text-error" className="text-sm font-sans text-red-700 dark:text-red-300" role="alert">{tipFieldErrors.text}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xl font-heading text-zn-black dark:text-[#EDE4D0] uppercase italic tracking-wide">
                {'\u041a\u044a\u0434\u0435 \u0441\u0435 \u0441\u043b\u0443\u0447\u0438?'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MapPin className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="location"
                  value={location}
                  onChange={(event) => {
                    setLocation(event.target.value);
                    setDismissTipError(true);
                  }}
                  disabled={isTipPending}
                  className="w-full pl-10 pr-4 py-3 font-sans text-lg bg-gray-50 dark:bg-[#1C1828] dark:text-gray-200 border-2 border-zn-black dark:border-[#524A62] focus:outline-none focus:ring-4 focus:ring-zn-purple/20 focus:border-zn-purple transition-all comic-ink-shadow-sm dark:placeholder-gray-500"
                  placeholder={'\u0423\u043b\u0438\u0446\u0430, \u043a\u0432\u0430\u0440\u0442\u0430\u043b \u0438\u043b\u0438 \u043a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442\u0438...'}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xl font-heading text-zn-black dark:text-[#EDE4D0] uppercase italic tracking-wide">
                {'\u0421\u043d\u0438\u043c\u043a\u043e\u0432 \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b'}
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
                  disabled={isTipPending}
                  className="w-full h-[54px] flex items-center justify-center gap-2 font-sans text-lg font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-[#1C1828] border-2 border-dashed border-gray-400 dark:border-[#524A62] hover:bg-gray-200 dark:hover:bg-[#2A2438] hover:border-zn-black dark:hover:border-gray-400 transition-colors"
                >
                  <Upload className="w-5 h-5" />
                  {'\u041a\u0430\u0447\u0438 \u0434\u043e\u043a\u0430\u0437\u0430\u0442\u0435\u043b\u0441\u0442\u0432\u043e'}
                </button>
              )}
              <input
                type="file"
                name="image"
                ref={fileInputRef}
                onChange={handleImageChange}
                accept="image/*"
                className="hidden"
                disabled={isTipPending}
                aria-describedby={tipFieldErrors.image ? 'tipline-image-error' : undefined}
              />
              {tipFieldErrors.image && (
                <p id="tipline-image-error" className="text-sm font-sans text-red-700 dark:text-red-300" role="alert">{tipFieldErrors.image}</p>
              )}
            </div>
          </div>

          <div className="pt-6 border-t-2 border-black/10 dark:border-white/10 flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-sm font-sans text-gray-500 dark:text-gray-400 md:max-w-xs">
              {'IP \u0430\u0434\u0440\u0435\u0441\u044a\u0442 \u0432\u0438 \u0441\u0435 \u043e\u0431\u0440\u0430\u0431\u043e\u0442\u0432\u0430 \u043a\u0440\u0438\u043f\u0442\u043e\u0433\u0440\u0430\u0444\u0441\u043a\u0438 \u0435\u0434\u0438\u043d\u0441\u0442\u0432\u0435\u043d\u043e \u0441 \u0446\u0435\u043b \u043f\u0440\u0435\u0434\u043e\u0442\u0432\u0440\u0430\u0442\u044f\u0432\u0430\u043d\u0435 \u043d\u0430 \u0441\u043f\u0430\u043c.'}
            </p>
            <TipLineSubmitButton disabled={!text.trim() && !image} />
          </div>
        </form>
      </div>
    </div>
  );
}
