import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Tag, Phone, User, Clock, DollarSign, Star, ChevronLeft, ChevronRight, Copy, Check, Camera, ArrowLeft, X } from 'lucide-react';
import { usePublicData } from '../context/DataContext';
import { makeTitle, useDocumentTitle } from '../hooks/useDocumentTitle';
import { useEntryHeadingScroll } from '../hooks/useEntryHeadingScroll';
import { addRecentlyViewed, useRecentlyViewed } from '../hooks/useRecentlyViewed';
import { copyToClipboard } from '../utils/copyToClipboard';

const CATEGORY_LABELS = {
  cars: 'Коли', properties: 'Имоти', services: 'Услуги',
  'looking-for': 'Търся', selling: 'Продавам', other: 'Разни',
};

const TIER_LABELS = { standard: 'Стандартна', highlighted: 'Удебелена', vip: 'VIP' };

const YAPPER_POPUP_MOBILE_BREAKPOINT = 640;
const YAPPER_POPUP_WIDTH = 360;
const YAPPER_POPUP_VIEWPORT_GUTTER = 12;
const YAPPER_POPUP_OFFSET = 8;
const YAPPER_POPUP_MIN_HEIGHT = 320;

function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    const didCopy = await copyToClipboard(text);
    if (!didCopy) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button type="button" onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border-2 border-[#1C1428] font-display font-bold text-xs uppercase tracking-wider hover:bg-gray-100 transition-colors" style={{ boxShadow: '2px 2px 0 #1C1428' }}>
      {copied ? <><Check className="w-3.5 h-3.5 text-green-600" />Копирано!</> : <><Copy className="w-3.5 h-3.5" />{label}</>}
    </button>
  );
}

function ImageGallery({ images }) {
  const [current, setCurrent] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  if (!images || images.length === 0) return null;

  const prev = () => setCurrent(i => (i - 1 + images.length) % images.length);
  const next = () => setCurrent(i => (i + 1) % images.length);

  return (
    <>
      {/* Main image */}
      <div className="relative border-3 border-[#1C1428] bg-black overflow-hidden" style={{ boxShadow: '4px 4px 0 #1C1428' }}>
        <img
          src={images[current]}
          alt={`Снимка ${current + 1}`}
          className="w-full aspect-[4/3] object-cover cursor-pointer"
          loading="lazy"
          decoding="async"
          onClick={() => setLightbox(true)}
        />
        {images.length > 1 && (
          <>
            <button type="button" onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button type="button" onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs font-mono px-2 py-0.5 flex items-center gap-1">
              <Camera className="w-3 h-3" /> {current + 1}/{images.length}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 mt-3">
          {images.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrent(idx)}
              className={`w-16 h-16 border-2 overflow-hidden flex-shrink-0 transition-all ${idx === current ? 'border-zn-purple ring-2 ring-zn-purple/30' : 'border-[#1C1428] opacity-60 hover:opacity-100'}`}
            >
              <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox — portalled to body so it renders above everything */}
      {lightbox && createPortal(
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4" style={{ zIndex: 9999 }} onClick={() => setLightbox(false)}>
          <button type="button" className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => setLightbox(false)}>
            <X className="w-8 h-8" />
          </button>
          {images.length > 1 && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); prev(); }} className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors rounded-full">
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); next(); }} className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors rounded-full">
                <ChevronRight className="w-8 h-8" />
              </button>
            </>
          )}
          <img
            src={images[current]}
            alt=""
            className="max-w-full max-h-[85vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm font-mono">
            {current + 1} / {images.length}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export default function ClassifiedDetailPage() {
  const { id } = useParams();
  const { loadClassifiedDetail, loadClassifieds } = usePublicData();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [similar, setSimilar] = useState([]);
  const { items: recentItems } = useRecentlyViewed();
  const pageHeadingRef = useRef(null);

  // Yapper share
  const [yapperOpen, setYapperOpen] = useState(false);
  const [yapperCopied, setYapperCopied] = useState(false);
  const yapperRef = useRef(null);
  const yapperPopupRef = useRef(null);
  const yapperInputRef = useRef(null);
  const [yapperPopupStyle, setYapperPopupStyle] = useState(null);

  useDocumentTitle(makeTitle(item?.title || 'Обява'));
  const entryScrollKey = item
    ? `ready:${item.id}`
    : loading
      ? `pending:${id}`
      : `missing:${id}`;

  useEntryHeadingScroll(pageHeadingRef, entryScrollKey);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    loadClassifiedDetail(id)
      .then(data => {
        setItem(data);
        setError('');
        // Track in recently viewed
        addRecentlyViewed(data);
      })
      .catch(err => setError(err.message || 'Обявата не е намерена.'))
      .finally(() => setLoading(false));
  }, [id, loadClassifiedDetail]);

  // Load similar listings (same category, excluding current)
  useEffect(() => {
    if (!item?.category || !item?.id) return;
    loadClassifieds({ category: item.category, limit: 4 })
      .then(data => {
        const filtered = (data.items || []).filter(i => i.id !== item.id).slice(0, 3);
        setSimilar(filtered);
      })
      .catch(() => setSimilar([]));
  }, [item?.category, item?.id, loadClassifieds]);

  // Outside click for yapper
  useEffect(() => {
    if (!yapperOpen) return undefined;
    const handler = (e) => {
      if (yapperRef.current?.contains(e.target) || yapperPopupRef.current?.contains(e.target)) return;
      setYapperOpen(false);
    };
    const escHandler = (e) => { if (e.key === 'Escape') setYapperOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escHandler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', escHandler); };
  }, [yapperOpen]);

  useEffect(() => {
    if (!yapperOpen) return;
    const t = requestAnimationFrame(() => {
      try { yapperInputRef.current?.focus(); yapperInputRef.current?.select(); } catch {}
    });
    return () => cancelAnimationFrame(t);
  }, [yapperOpen]);

  const sharePngUrl = item ? `/api/classifieds/${item.id}/share.png` : '';
  const sharePngFullUrl = typeof window === 'undefined' ? sharePngUrl : `${window.location.origin}${sharePngUrl}`;

  const updateYapperPopupPosition = useCallback(() => {
    if (typeof window === 'undefined') return;

    if (window.innerWidth < YAPPER_POPUP_MOBILE_BREAKPOINT) {
      setYapperPopupStyle({
        position: 'fixed',
        left: '16px',
        right: '16px',
        top: 'auto',
        bottom: '16px',
        width: 'auto',
        maxWidth: 'none',
        zIndex: 80,
      });
      return;
    }

    const triggerRect = yapperRef.current?.getBoundingClientRect();
    if (!triggerRect) return;

    const width = Math.min(YAPPER_POPUP_WIDTH, window.innerWidth - (YAPPER_POPUP_VIEWPORT_GUTTER * 2));
    const maxLeft = window.innerWidth - width - YAPPER_POPUP_VIEWPORT_GUTTER;
    const left = Math.min(
      Math.max(YAPPER_POPUP_VIEWPORT_GUTTER, triggerRect.left),
      Math.max(YAPPER_POPUP_VIEWPORT_GUTTER, maxLeft),
    );
    const showAbove = window.innerHeight - triggerRect.bottom < YAPPER_POPUP_MIN_HEIGHT
      && triggerRect.top > YAPPER_POPUP_MIN_HEIGHT;

    setYapperPopupStyle({
      position: 'fixed',
      left: `${left}px`,
      right: 'auto',
      top: showAbove ? 'auto' : `${Math.max(YAPPER_POPUP_VIEWPORT_GUTTER, triggerRect.bottom + YAPPER_POPUP_OFFSET)}px`,
      bottom: showAbove ? `${Math.max(YAPPER_POPUP_VIEWPORT_GUTTER, window.innerHeight - triggerRect.top + YAPPER_POPUP_OFFSET)}px` : 'auto',
      width: `${width}px`,
      maxWidth: `calc(100vw - ${YAPPER_POPUP_VIEWPORT_GUTTER * 2}px)`,
      zIndex: 80,
    });
  }, []);

  useEffect(() => {
    if (!yapperOpen) return undefined;
    updateYapperPopupPosition();

    const handleViewportChange = () => updateYapperPopupPosition();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [yapperOpen, updateYapperPopupPosition]);

  const handleYapperCopy = async () => {
    const didCopy = await copyToClipboard(sharePngFullUrl);
    if (!didCopy) return;
    setYapperCopied(true);
    setTimeout(() => setYapperCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-8 h-8 border-3 border-zn-hot border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="comic-panel comic-dots p-10">
          <div className="comic-stamp-circle absolute -top-5 -right-3 z-20 text-[10px]">404</div>
          <h1
            ref={pageHeadingRef}
            className="font-display text-3xl font-black uppercase tracking-wider text-zn-text mb-4 relative z-[2] scroll-mt-24 md:scroll-mt-28"
          >
            Обявата не е намерена
          </h1>
          <p className="font-sans text-gray-600 mb-6 relative z-[2]">{error || 'Може да е изтекла или да не съществува.'}</p>
          <Link to="/obiavi" className="comic-button text-sm relative z-[2]">Към обявите</Link>
        </div>
      </div>
    );
  }

  const tierStyle = item.tier === 'vip' ? 'border-zn-purple' : item.tier === 'highlighted' ? 'border-amber-600' : 'border-[#1C1428]';
  const tierShadow = item.tier === 'vip' ? '#5B1A8C' : item.tier === 'highlighted' ? '#92400e' : '#1C1428';
  const yapperPopup = yapperOpen && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={yapperPopupRef}
          className="yapper-popup"
          style={yapperPopupStyle || undefined}
          role="dialog"
          aria-label="Yapper снимка"
        >
          <div className="yapper-popup-title">Yapper снимка</div>
          <img
            src={sharePngUrl}
            alt="Share card"
            className="yapper-popup-img"
            loading="lazy"
            decoding="async"
          />
          <p className="yapper-popup-desc">Копирай линка и го постни в Yapper:</p>
          <div className="yapper-popup-link-row">
            <input
              ref={yapperInputRef}
              type="text"
              readOnly
              value={sharePngFullUrl}
              className="yapper-popup-input"
              onClick={(e) => e.target.select()}
              aria-label="Линк към Share PNG"
            />
            <button type="button" onClick={handleYapperCopy} className="yapper-popup-copy-btn">
              {yapperCopied ? 'Готово' : 'Копирай'}
            </button>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link to="/obiavi" className="inline-flex items-center gap-1.5 text-sm font-display font-bold uppercase tracking-wider text-gray-500 hover:text-zn-text dark:hover:text-[#EDE4D0] mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Назад към обявите
      </Link>

      <div className={`comic-panel ${item.tier !== 'standard' ? 'comic-dots' : ''} bg-white dark:bg-[#2A2438] p-0 border-4 ${tierStyle} relative overflow-hidden`} style={{ boxShadow: `5px 5px 0 ${tierShadow}` }}>
        {/* Top badges bar */}
        <div className="flex items-center gap-2 p-4 pb-0 flex-wrap">
          <span className="px-2.5 py-1 bg-zinc-800 text-white text-[10px] font-display font-black uppercase tracking-wider">
            {CATEGORY_LABELS[item.category] || item.category}
          </span>
          {item.tier !== 'standard' && (
            <span className="px-2.5 py-1 bg-zn-purple text-white text-[10px] font-display font-black uppercase tracking-wider flex items-center gap-1">
              <Star className="w-3 h-3" /> {TIER_LABELS[item.tier]}
            </span>
          )}
          <span className="text-xs text-gray-400 font-mono ml-auto">#{item.id}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          {/* Left: Images */}
          {item.images && item.images.length > 0 && (
            <div className="p-4 relative z-[2]">
              <ImageGallery images={item.images} />
            </div>
          )}

          {/* Right: Details */}
          <div className={`p-4 ${(!item.images || item.images.length === 0) ? 'lg:col-span-2' : ''} relative z-[2]`}>
            <h1
              ref={pageHeadingRef}
              className="font-display text-2xl md:text-3xl font-black uppercase tracking-wider text-zn-text dark:text-[#EDE4D0] mb-3 text-shadow-brutal leading-tight scroll-mt-24 md:scroll-mt-28"
            >
              {item.title}
            </h1>

            {item.price && (
              <div className="flex items-center gap-2 mb-4">
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white font-mono font-black text-xl" style={{ boxShadow: '2px 2px 0 #166534' }}>
                  <DollarSign className="w-5 h-5" />
                  {item.price}
                </span>
              </div>
            )}

            <div className="font-sans text-gray-700 dark:text-gray-300 leading-relaxed mb-6 whitespace-pre-line">
              {item.description}
            </div>

            {/* Contact section */}
            <div className="border-3 border-[#1C1428] bg-gray-50 dark:bg-[#1C1828] px-4 py-3" style={{ boxShadow: '3px 3px 0 #1C1428' }}>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="font-sans font-bold text-sm text-zn-text dark:text-[#EDE4D0]">{item.contactName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="font-mono font-bold text-sm text-zn-text dark:text-[#EDE4D0]">{item.phone}</span>
                  <CopyButton text={item.phone} label="Копирай" />
                </div>
              </div>
            </div>

            {/* Meta info + countdown */}
            <div className="flex flex-wrap items-center gap-3 mt-4 text-xs font-sans text-gray-400">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Публикувана: {new Date(item.approvedAt || item.createdAt).toLocaleString('bg-BG')}</span>
              {item.expiresAt && (() => {
                const remaining = new Date(item.expiresAt).getTime() - Date.now();
                if (remaining <= 0) return <span className="flex items-center gap-1 text-zn-hot font-bold"><Clock className="w-3 h-3" /> Изтекла</span>;
                const days = Math.floor(remaining / 86400000);
                const hours = Math.floor((remaining % 86400000) / 3600000);
                const countdownText = days > 0 ? `${days} ${days === 1 ? 'ден' : 'дни'}` : `${hours} ч.`;
                const isUrgent = days <= 2;
                return (
                  <span className={`flex items-center gap-1 font-bold ${isUrgent ? 'text-zn-hot' : 'text-amber-600'}`}>
                    <Clock className="w-3 h-3" /> Остават {countdownText}
                  </span>
                );
              })()}
            </div>

            {/* Share / Yapper button */}
            <div className="flex items-center gap-2 mt-4 relative z-[3]" ref={yapperRef}>
              <button
                type="button"
                onClick={() => setYapperOpen(v => !v)}
                className="share-btn share-btn-yapper"
                title="Вземи линк за Yapper"
                aria-haspopup="dialog"
                aria-expanded={yapperOpen}
              >
                Yapper
              </button>
              {yapperPopup}
            </div>
          </div>
        </div>
      </div>

      {/* Similar listings */}
      {similar.length > 0 && (
        <div className="mt-10">
          <h2 className="font-display text-xl font-black uppercase tracking-wider text-zn-text dark:text-[#EDE4D0] mb-4 flex items-center gap-2">
            <Tag className="w-5 h-5 text-zn-hot" />
            Подобни обяви
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {similar.map(s => {
              const img = s.images?.[0];
              return (
                <Link
                  key={s.id}
                  to={`/obiavi/${s.id}`}
                  className="block border-3 border-[#1C1428] bg-white dark:bg-[#2A2438] overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg"
                  style={{ boxShadow: '3px 3px 0 #1C1428' }}
                >
                  {img && (
                    <div className="aspect-[4/3] bg-black">
                      <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    </div>
                  )}
                  <div className="p-3">
                    <h3 className="font-display font-black uppercase tracking-wide text-sm text-zn-text dark:text-[#EDE4D0] line-clamp-2 leading-tight">{s.title}</h3>
                    {s.price && (
                      <span className="inline-flex items-center gap-1 mt-1.5 text-green-700 dark:text-green-400 font-mono font-bold text-sm">
                        <DollarSign className="w-3 h-3" />{s.price}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Recently viewed */}
      {recentItems.length > 1 && (
        <div className="mt-10">
          <h2 className="font-display text-xl font-black uppercase tracking-wider text-zn-text dark:text-[#EDE4D0] mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-zn-purple" />
            Последно видяни
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {recentItems.filter(r => String(r.id) !== String(id)).slice(0, 6).map(r => (
              <Link
                key={r.id}
                to={`/obiavi/${r.id}`}
                className="block border-2 border-[#1C1428] bg-white dark:bg-[#2A2438] overflow-hidden transition-all hover:-translate-y-0.5"
                style={{ boxShadow: '2px 2px 0 #1C1428' }}
              >
                {r.image ? (
                  <div className="aspect-square bg-black">
                    <img src={r.image} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                  </div>
                ) : (
                  <div className="aspect-square bg-gray-100 dark:bg-[#1C1828] flex items-center justify-center">
                    <Tag className="w-6 h-6 text-gray-300" />
                  </div>
                )}
                <div className="p-2">
                  <p className="font-display font-bold uppercase text-[10px] tracking-wide text-zn-text dark:text-[#EDE4D0] line-clamp-2 leading-tight">{r.title}</p>
                  {r.price && <span className="text-green-700 dark:text-green-400 font-mono font-bold text-[10px]">{r.price}</span>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
