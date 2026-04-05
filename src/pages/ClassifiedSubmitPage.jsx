import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Link } from 'react-router-dom';
import { Tag, Send, AlertTriangle, CheckCircle, Image as ImageIcon, X, Upload, Copy, Check, Car, Building, Wrench, Search, Package, ShoppingCart, Star, DollarSign, Camera } from 'lucide-react';
import { usePublicData } from '../context/DataContext';
import { makeTitle, useDocumentTitle } from '../hooks/useDocumentTitle';
import { api } from '../utils/api';

const CATEGORIES = [
  { value: 'cars', label: 'Коли', icon: Car },
  { value: 'properties', label: 'Имоти', icon: Building },
  { value: 'services', label: 'Услуги', icon: Wrench },
  { value: 'looking-for', label: 'Търся', icon: Search },
  { value: 'selling', label: 'Продавам', icon: ShoppingCart },
  { value: 'other', label: 'Разни', icon: Package },
];

const TIER_META = {
  standard:    { label: 'Стандартна', color: 'border-[#1C1428]', icon: Tag },
  highlighted: { label: 'Удебелена', color: 'border-amber-600', icon: DollarSign },
  vip:         { label: 'VIP', color: 'border-zn-purple', icon: Star },
};

const FALLBACK_TIERS = [
  { value: 'standard', label: 'Стандартна', price: 2000, days: 7, maxImages: 1, color: 'border-[#1C1428]', icon: Tag },
  { value: 'highlighted', label: 'Удебелена', price: 5000, days: 10, maxImages: 3, color: 'border-amber-600', icon: DollarSign },
  { value: 'vip', label: 'VIP', price: 7000, days: 14, maxImages: 5, color: 'border-zn-purple', icon: Star },
];

function buildTiers(apiData) {
  if (!apiData?.tiers) return FALLBACK_TIERS;
  return ['standard', 'highlighted', 'vip'].map(key => {
    const t = apiData.tiers[key];
    const meta = TIER_META[key];
    return { value: key, label: meta.label, price: t.price, days: t.durationDays, maxImages: t.maxImages, color: meta.color, icon: meta.icon };
  });
}

const INITIAL_STATE = Object.freeze({ status: 'idle', message: '', fieldErrors: {}, paymentInfo: null });

function SubmitButton({ disabled }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} className="comic-button flex items-center gap-2 text-lg w-full md:w-auto justify-center disabled:cursor-not-allowed disabled:opacity-60" aria-busy={pending}>
      {pending ? <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" /> : <><Send className="w-5 h-5 -ml-1" />Изпрати обявата</>}
    </button>
  );
}

function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  return (
    <button type="button" onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border-2 border-[#1C1428] font-display font-bold text-xs uppercase tracking-wider hover:bg-gray-100 transition-colors" style={{ boxShadow: '2px 2px 0 #1C1428' }}>
      {copied ? <><Check className="w-3.5 h-3.5 text-green-600" />Копирано!</> : <><Copy className="w-3.5 h-3.5" />{label}</>}
    </button>
  );
}

function PaymentInfoPanel({ info }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 md:py-20 animate-fade-in">
      <div className="comic-panel comic-dots bg-white dark:bg-[#2A2438] p-8 md:p-12 text-center">
        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-zn-black dark:border-[#524A62] comic-ink-shadow">
          <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-3xl md:text-4xl font-heading text-zn-black dark:text-[#EDE4D0] uppercase italic mb-2">Обявата е записана!</h1>
        <p className="text-lg font-sans text-gray-700 dark:text-gray-300 mb-8 max-w-xl mx-auto">
          Направете превод с данните по-долу. След потвърждение на плащането, обявата ви ще бъде публикувана.
        </p>

        <div className="bg-gray-50 dark:bg-[#1C1828] border-3 border-[#1C1428] p-6 text-left space-y-4 max-w-md mx-auto" style={{ boxShadow: '4px 4px 0 #1C1428' }}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-display font-bold uppercase tracking-widest text-gray-400">IBAN</div>
              <div className="font-mono text-lg font-bold text-zn-text dark:text-[#EDE4D0]">{info.iban}</div>
            </div>
            <CopyButton text={info.iban} label="Копирай" />
          </div>

          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-display font-bold uppercase tracking-widest text-gray-400">Получател</div>
              <div className="font-sans font-bold text-zn-text dark:text-[#EDE4D0]">{info.beneficiary}</div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-display font-bold uppercase tracking-widest text-gray-400">Сума</div>
              <div className="font-mono text-2xl font-black text-green-700 dark:text-green-400">{info.currency}{info.amountDue.toLocaleString('bg-BG')}</div>
            </div>
            <CopyButton text={String(info.amountDue)} label="Копирай" />
          </div>

          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-display font-bold uppercase tracking-widest text-gray-400">Основание</div>
              <div className="font-mono text-xl font-black text-zn-purple">{info.paymentRef}</div>
            </div>
            <CopyButton text={info.paymentRef} label="Копирай" />
          </div>
        </div>

        <p className="text-sm font-sans text-gray-500 dark:text-gray-400 mt-6 max-w-md mx-auto">
          Задължително посочете основанието <strong className="text-zn-purple">{info.paymentRef}</strong> при превода.
          Обявата ще бъде активирана след потвърждение на плащането от наш администратор.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
          <Link to="/obiavi" className="comic-button px-8 py-3 text-lg">Към обявите</Link>
          <Link to={`/obiavi/status/${info.paymentRef}`} className="px-8 py-3 text-lg font-display font-bold uppercase tracking-wider border-2 border-[#1C1428] hover:bg-gray-100 dark:hover:bg-[#352F45] transition-colors" style={{ boxShadow: '2px 2px 0 #1C1428' }}>
            Провери статус
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ClassifiedSubmitPage() {
  useDocumentTitle(makeTitle('Подай обява'));
  const { submitClassified } = usePublicData();

  const [tiers, setTiers] = useState(FALLBACK_TIERS);
  const [currency, setCurrency] = useState('$');
  const [tiersLoading, setTiersLoading] = useState(true);
  const [pricesLoaded, setPricesLoaded] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [phone, setPhone] = useState('');
  const [contactName, setContactName] = useState('');
  const [tier, setTier] = useState('standard');
  const [images, setImages] = useState([]); // Array of { file, preview }
  const [clientError, setClientError] = useState('');
  const [dismissError, setDismissError] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const fileInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api.classifieds.getPrices()
      .then(data => {
        if (cancelled) return;
        setTiers(buildTiers(data));
        if (data?.currency) setCurrency(data.currency);
        setPricesLoaded(true);
      })
      .catch(() => { /* keep fallback, pricesLoaded stays false */ })
      .finally(() => { if (!cancelled) setTiersLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const selectedTier = tiers.find(t => t.value === tier) || tiers[0];
  const maxImages = selectedTier.maxImages;

  const [formState, submitAction, isPending] = useActionState(
    async (_prev, formData) => {
      const fTitle = String(formData.get('title') || '').trim();
      const fDesc = String(formData.get('description') || '').trim();
      const fCat = String(formData.get('category') || '').trim();
      const fPhone = String(formData.get('phone') || '').trim();
      const fName = String(formData.get('contactName') || '').trim();

      const errs = {};
      if (!fTitle) errs.title = 'Заглавието е задължително.';
      if (!fDesc) errs.description = 'Описанието е задължително.';
      if (!fCat) errs.category = 'Изберете категория.';
      if (!fPhone) errs.phone = 'Телефонът е задължителен.';
      if (!fName) errs.contactName = 'Името е задължително.';

      if (Object.keys(errs).length > 0) {
        return { status: 'error', message: 'Моля попълнете всички задължителни полета.', fieldErrors: errs, paymentInfo: null };
      }

      try {
        const payload = new FormData();
        payload.set('title', fTitle);
        payload.set('description', fDesc);
        payload.set('category', fCat);
        payload.set('price', String(formData.get('price') || '').trim());
        payload.set('phone', fPhone);
        payload.set('contactName', fName);
        payload.set('tier', tier);
        // Append all images
        for (const img of images) {
          if (img.file instanceof File && img.file.size > 0) {
            payload.append('images', img.file);
          }
        }

        const result = await submitClassified(payload, tier);
        return { status: 'success', message: '', fieldErrors: {}, paymentInfo: result };
      } catch (error) {
        const serverFieldErrors = error?.payload?.fieldErrors && typeof error.payload.fieldErrors === 'object' ? error.payload.fieldErrors : {};
        return { status: 'error', message: error?.message || 'Грешка при изпращане. Опитайте отново.', fieldErrors: serverFieldErrors, paymentInfo: null };
      }
    },
    INITIAL_STATE,
  );

  // Cleanup image previews on unmount
  useEffect(() => {
    return () => { images.forEach(img => { if (img.preview) URL.revokeObjectURL(img.preview); }); };
  }, [images]);

  useEffect(() => { setFieldErrors(formState.fieldErrors || {}); }, [formState.fieldErrors]);
  useEffect(() => { if (formState.status !== 'error') setDismissError(false); }, [formState.status]);

  const clearFieldError = (f) => setFieldErrors(prev => prev?.[f] ? { ...prev, [f]: '' } : prev);

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remaining = maxImages - images.length;
    const toAdd = files.slice(0, remaining);
    const newImages = [];

    for (const file of toAdd) {
      if (!file.type.startsWith('image/')) { setClientError('Само изображения (JPG, PNG, WEBP).'); continue; }
      if (file.size > 10 * 1024 * 1024) { setClientError('Максимум 10 MB на снимка.'); continue; }
      newImages.push({ file, preview: URL.createObjectURL(file) });
    }

    if (newImages.length > 0) {
      setImages(prev => [...prev, ...newImages]);
      setClientError('');
      setDismissError(true);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index) => {
    setImages(prev => {
      const next = [...prev];
      if (next[index]?.preview) URL.revokeObjectURL(next[index].preview);
      next.splice(index, 1);
      return next;
    });
  };

  // When tier changes, trim excess images
  useEffect(() => {
    setImages(prev => {
      if (prev.length <= maxImages) return prev;
      const removed = prev.slice(maxImages);
      removed.forEach(img => { if (img.preview) URL.revokeObjectURL(img.preview); });
      return prev.slice(0, maxImages);
    });
  }, [maxImages]);

  // Show payment info after successful submission
  if (formState.status === 'success' && formState.paymentInfo) {
    return <PaymentInfoPanel info={formState.paymentInfo} />;
  }

  const formError = clientError || (formState.status === 'error' && !dismissError ? formState.message : '');

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-16 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="relative">
        <div className="absolute -inset-1 bg-zn-purple transform rotate-1 rounded border-2 border-zn-black dark:border-[#524A62] pb-2 hidden md:block" />
        <div className="comic-panel comic-dots relative bg-white dark:bg-[#2A2438] p-6 md:p-10 border-4 border-zn-black dark:border-[#524A62] z-10">
          <div className="flex flex-col md:flex-row gap-6 md:items-center">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-zn-hot shrink-0 border-4 border-zn-black dark:border-[#524A62] flex items-center justify-center -rotate-3 comic-ink-shadow">
              <Tag className="w-8 h-8 md:w-10 md:h-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-heading text-zn-black dark:text-[#EDE4D0] uppercase italic tracking-wide mb-2">Подай обява</h1>
              <p className="font-sans text-gray-700 dark:text-gray-300 text-lg">
                Попълнете данните и изберете пакет. След подаване ще получите данни за плащане.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Prices loading error */}
      {!tiersLoading && !pricesLoaded && (
        <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 p-4 border-2 border-amber-300 dark:border-amber-700 font-sans flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>Не успяхме да заредим актуалните цени. Моля презаредете страницата или опитайте по-късно.</p>
        </div>
      )}

      {/* Tier selection */}
      <div className="comic-panel bg-white dark:bg-[#2A2438] p-6 md:p-8 border-4 border-zn-black dark:border-[#524A62]">
        <h2 className="text-xl font-heading text-zn-black dark:text-[#EDE4D0] uppercase italic tracking-wide mb-4">Избери пакет</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tiers.map((t) => {
            const Icon = t.icon;
            const isSelected = tier === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTier(t.value)}
                className={`relative p-4 border-3 ${t.color} text-left transition-all ${isSelected ? 'ring-4 ring-zn-purple/30 scale-[1.02]' : 'opacity-70 hover:opacity-100'}`}
                style={{ boxShadow: isSelected ? '4px 4px 0 #5B1A8C' : '3px 3px 0 #1C1428' }}
              >
                {isSelected && <div className="absolute -top-2 -right-2 w-6 h-6 bg-zn-purple rounded-full flex items-center justify-center"><Check className="w-4 h-4 text-white" /></div>}
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-5 h-5 text-zn-purple" />
                  <span className="font-display font-black uppercase tracking-wider">{t.label}</span>
                </div>
                <div className="font-mono text-2xl font-black text-green-700 dark:text-green-400 mb-1">{currency}{t.price.toLocaleString('bg-BG')}</div>
                <p className="text-xs font-sans text-gray-500 mb-2">{t.description}</p>
                <div className="flex items-center gap-1 text-[10px] font-display font-bold uppercase tracking-wider text-zn-purple">
                  <Camera className="w-3 h-3" /> До {t.maxImages} {t.maxImages === 1 ? 'снимка' : 'снимки'} &bull; {t.days} дни
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Form */}
      <div className="comic-panel bg-white dark:bg-[#2A2438] p-6 md:p-10 border-4 border-zn-black dark:border-[#524A62]">
        <form action={submitAction} aria-busy={isPending} className="space-y-6">
          {formError && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-4 border-2 border-red-200 dark:border-red-800/50 font-sans flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{formError}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Title */}
            <div className="space-y-2 md:col-span-2">
              <label className="block text-lg font-heading text-zn-black dark:text-[#EDE4D0] uppercase italic tracking-wide">Заглавие *</label>
              <input type="text" name="title" value={title} onChange={(e) => { setTitle(e.target.value); setDismissError(true); clearFieldError('title'); }} disabled={isPending} maxLength={120} className="w-full px-4 py-3 font-sans text-lg bg-gray-50 dark:bg-[#1C1828] dark:text-gray-200 border-2 border-zn-black dark:border-[#524A62] focus:outline-none focus:ring-4 focus:ring-zn-purple/20 focus:border-zn-purple transition-all comic-ink-shadow-sm" placeholder='напр. "Продавам Sultan RS, пълен тунинг"' />
              {fieldErrors.title && <p className="text-sm font-sans text-red-700 dark:text-red-300" role="alert">{fieldErrors.title}</p>}
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="block text-lg font-heading text-zn-black dark:text-[#EDE4D0] uppercase italic tracking-wide">Категория *</label>
              <select name="category" value={category} onChange={(e) => { setCategory(e.target.value); setDismissError(true); clearFieldError('category'); }} disabled={isPending} className="w-full px-4 py-3 font-sans text-lg bg-gray-50 dark:bg-[#1C1828] dark:text-gray-200 border-2 border-zn-black dark:border-[#524A62] focus:outline-none focus:ring-4 focus:ring-zn-purple/20 focus:border-zn-purple transition-all comic-ink-shadow-sm">
                <option value="">Избери...</option>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              {fieldErrors.category && <p className="text-sm font-sans text-red-700 dark:text-red-300" role="alert">{fieldErrors.category}</p>}
            </div>

            {/* Price */}
            <div className="space-y-2">
              <label className="block text-lg font-heading text-zn-black dark:text-[#EDE4D0] uppercase italic tracking-wide">Цена (по желание)</label>
              <input type="text" name="price" value={price} onChange={(e) => setPrice(e.target.value)} disabled={isPending} maxLength={60} className="w-full px-4 py-3 font-sans text-lg bg-gray-50 dark:bg-[#1C1828] dark:text-gray-200 border-2 border-zn-black dark:border-[#524A62] focus:outline-none focus:ring-4 focus:ring-zn-purple/20 focus:border-zn-purple transition-all comic-ink-shadow-sm" placeholder='напр. "45,000$"' />
            </div>

            {/* Description */}
            <div className="space-y-2 md:col-span-2">
              <label className="block text-lg font-heading text-zn-black dark:text-[#EDE4D0] uppercase italic tracking-wide">Описание *</label>
              <textarea name="description" value={description} onChange={(e) => { setDescription(e.target.value); setDismissError(true); clearFieldError('description'); }} disabled={isPending} maxLength={1000} rows={4} className="w-full px-4 py-3 font-sans text-lg bg-gray-50 dark:bg-[#1C1828] dark:text-gray-200 border-2 border-zn-black dark:border-[#524A62] focus:outline-none focus:ring-4 focus:ring-zn-purple/20 focus:border-zn-purple transition-all resize-none comic-ink-shadow-sm" placeholder="Опишете подробно какво предлагате или търсите..." />
              {fieldErrors.description && <p className="text-sm font-sans text-red-700 dark:text-red-300" role="alert">{fieldErrors.description}</p>}
            </div>

            {/* Contact name */}
            <div className="space-y-2">
              <label className="block text-lg font-heading text-zn-black dark:text-[#EDE4D0] uppercase italic tracking-wide">Име за контакт *</label>
              <input type="text" name="contactName" value={contactName} onChange={(e) => { setContactName(e.target.value); setDismissError(true); clearFieldError('contactName'); }} disabled={isPending} maxLength={80} className="w-full px-4 py-3 font-sans text-lg bg-gray-50 dark:bg-[#1C1828] dark:text-gray-200 border-2 border-zn-black dark:border-[#524A62] focus:outline-none focus:ring-4 focus:ring-zn-purple/20 focus:border-zn-purple transition-all comic-ink-shadow-sm" placeholder="Иван Иванов" />
              {fieldErrors.contactName && <p className="text-sm font-sans text-red-700 dark:text-red-300" role="alert">{fieldErrors.contactName}</p>}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <label className="block text-lg font-heading text-zn-black dark:text-[#EDE4D0] uppercase italic tracking-wide">Телефон *</label>
              <input type="text" name="phone" value={phone} onChange={(e) => { setPhone(e.target.value); setDismissError(true); clearFieldError('phone'); }} disabled={isPending} maxLength={30} className="w-full px-4 py-3 font-sans text-lg bg-gray-50 dark:bg-[#1C1828] dark:text-gray-200 border-2 border-zn-black dark:border-[#524A62] focus:outline-none focus:ring-4 focus:ring-zn-purple/20 focus:border-zn-purple transition-all comic-ink-shadow-sm" placeholder="555-1234" />
              {fieldErrors.phone && <p className="text-sm font-sans text-red-700 dark:text-red-300" role="alert">{fieldErrors.phone}</p>}
            </div>

            {/* Multi-image upload */}
            <div className="space-y-2 md:col-span-2">
              <label className="block text-lg font-heading text-zn-black dark:text-[#EDE4D0] uppercase italic tracking-wide">
                Снимки <span className="text-sm font-sans font-normal text-gray-500">(до {maxImages})</span>
              </label>

              {/* Image previews */}
              {images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-3">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative border-3 border-[#1C1428] bg-black overflow-hidden aspect-square group">
                      <img src={img.preview} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 w-6 h-6 bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      {idx === 0 && (
                        <div className="absolute bottom-0 left-0 right-0 bg-zn-purple/80 text-white text-[9px] font-display font-bold uppercase tracking-wider text-center py-0.5">
                          Основна
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {images.length < maxImages && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isPending}
                  className="w-full h-[54px] flex items-center justify-center gap-2 font-sans text-lg font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-[#1C1828] border-2 border-dashed border-gray-400 dark:border-[#524A62] hover:bg-gray-200 dark:hover:bg-[#2A2438] hover:border-zn-black dark:hover:border-gray-400 transition-colors"
                >
                  <Upload className="w-5 h-5" />
                  {images.length === 0 ? 'Качи снимка' : `Добави снимка (${images.length}/${maxImages})`}
                </button>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageChange}
                accept="image/*"
                multiple
                className="hidden"
                disabled={isPending}
              />
            </div>
          </div>

          {/* Summary + submit */}
          <div className="pt-6 border-t-2 border-black/10 dark:border-white/10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-sm font-sans text-gray-500 dark:text-gray-400">
              Пакет: <strong className="text-zn-purple">{selectedTier.label}</strong> &mdash; <strong className="text-green-700">{currency}{selectedTier.price.toLocaleString('bg-BG')}</strong> за {selectedTier.days} дни, до {selectedTier.maxImages} снимки
            </div>
            <SubmitButton disabled={!pricesLoaded || !title.trim() || !description.trim() || !category || !phone.trim() || !contactName.trim()} />
          </div>
        </form>
      </div>

      {/* Status check link */}
      <div className="text-center text-sm font-sans text-gray-500 dark:text-gray-400">
        Вече подадохте обява? <Link to="/obiavi/status" className="text-zn-purple font-bold hover:underline">Проверете статуса</Link>
      </div>
    </div>
  );
}
