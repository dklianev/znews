import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Tag, Car, Building, Wrench, Search, Package, ShoppingCart, Plus, Phone, User, Clock, DollarSign, Star, ChevronLeft, ChevronRight, Camera } from 'lucide-react';
import { usePublicData } from '../context/DataContext';
import { makeTitle, useDocumentTitle } from '../hooks/useDocumentTitle';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';

const CATEGORIES = [
  { value: '', label: 'Всички', icon: Tag },
  { value: 'cars', label: 'Коли', icon: Car },
  { value: 'properties', label: 'Имоти', icon: Building },
  { value: 'services', label: 'Услуги', icon: Wrench },
  { value: 'looking-for', label: 'Търся', icon: Search },
  { value: 'selling', label: 'Продавам', icon: ShoppingCart },
  { value: 'other', label: 'Разни', icon: Package },
];

const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.filter(c => c.value).map(c => [c.value, c.label]));

const TIER_STYLES = {
  standard: { border: 'border-[#1C1428]', bg: 'bg-white dark:bg-[#2A2438]', badge: null, shadow: '#1C1428' },
  highlighted: { border: 'border-amber-600', bg: 'bg-amber-50/50 dark:bg-amber-900/10', badge: 'ТОП', shadow: '#92400e' },
  vip: { border: 'border-zn-purple', bg: 'bg-purple-50/30 dark:bg-purple-900/10', badge: 'VIP', shadow: '#5B1A8C' },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'Току-що';
  if (hours < 24) return `Преди ${hours} ч.`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Преди 1 ден';
  return `Преди ${days} дни`;
}

function isHot(item) {
  const ref = item.bumpedAt || item.approvedAt || item.createdAt;
  if (!ref) return false;
  const hoursThreshold = item.tier === 'vip' ? 72 : item.tier === 'highlighted' ? 48 : 24;
  return Date.now() - new Date(ref).getTime() < hoursThreshold * 60 * 60 * 1000;
}

function CopyPhoneButton({ phone }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(phone);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = phone;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1 px-2 py-0.5 bg-green-600 text-white text-[10px] font-display font-black uppercase tracking-wider hover:bg-green-700 transition-colors"
      style={{ boxShadow: '1px 1px 0 #166534' }}
      title="Копирай телефон"
    >
      <Phone className="w-3 h-3" />
      {copied ? 'Копирано!' : 'Обади се'}
    </button>
  );
}

function ClassifiedCard({ item }) {
  const tier = TIER_STYLES[item.tier] || TIER_STYLES.standard;
  const hot = isHot(item);
  const mainImage = item.images?.[0] || null;
  const imageCount = item.images?.length || 0;
  const isVip = item.tier === 'vip';
  const isHighlighted = item.tier === 'highlighted';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Link
        to={`/obiavi/${item.id}`}
        className={`block relative ${tier.bg} border-3 ${tier.border} transition-all hover:-translate-y-0.5 hover:shadow-lg overflow-hidden ${isVip ? 'p-0' : 'p-4'}`}
        style={{ boxShadow: `4px 4px 0 ${tier.shadow}` }}
      >
        {/* VIP: hero layout with large image */}
        {isVip ? (
          <>
            {/* VIP accent strip */}
            <div className="h-1.5 bg-gradient-to-r from-zn-purple via-zn-hot to-zn-purple" />

            <div className="flex flex-col sm:flex-row">
              {/* VIP large image */}
              {mainImage && (
                <div className="sm:w-48 md:w-56 flex-shrink-0 bg-black relative">
                  <img src={mainImage} alt="" className="w-full aspect-[4/3] sm:aspect-auto sm:h-full object-cover" loading="lazy" decoding="async" />
                  {imageCount > 1 && (
                    <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-mono px-1.5 py-0.5 flex items-center gap-0.5 rounded-sm">
                      <Camera className="w-2.5 h-2.5" />{imageCount}
                    </div>
                  )}
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-zn-purple text-white text-[10px] font-display font-black uppercase tracking-wider flex items-center gap-1" style={{ boxShadow: '1px 1px 0 rgba(0,0,0,0.4)' }}>
                    <Star className="w-3 h-3" /> VIP
                  </div>
                </div>
              )}

              <div className="flex-1 min-w-0 p-4">
                {/* Badges */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="px-2 py-0.5 bg-zinc-800 text-white text-[10px] font-display font-black uppercase tracking-wider">
                    {CATEGORY_LABELS[item.category] || item.category}
                  </span>
                  {!mainImage && (
                    <span className="px-2 py-0.5 bg-zn-purple text-white text-[10px] font-display font-black uppercase tracking-wider flex items-center gap-1">
                      <Star className="w-3 h-3" /> VIP
                    </span>
                  )}
                  {hot && (
                    <span className="px-2 py-0.5 bg-zn-hot text-white text-[10px] font-display font-black uppercase tracking-wider animate-pulse">
                      ГОРЕЩО!
                    </span>
                  )}
                </div>

                <h3 className="font-display font-black uppercase tracking-wide text-zn-text dark:text-[#EDE4D0] text-xl leading-tight mb-2">
                  {item.title}
                </h3>
                <p className="font-sans text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                  {item.description}
                </p>

                {/* Footer inline */}
                <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-purple-200/30 dark:border-purple-500/20">
                  <div className="flex items-center gap-3 text-xs font-sans text-gray-500 dark:text-gray-400">
                    {item.price && (
                      <span className="flex items-center gap-1 font-bold text-green-700 dark:text-green-400 text-base">
                        <DollarSign className="w-4 h-4" />
                        {item.price}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {item.contactName}
                    </span>
                    <CopyPhoneButton phone={item.phone} />
                  </div>
                  <span className="flex items-center gap-1 text-[10px] text-gray-400">
                    <Clock className="w-3 h-3" />
                    {timeAgo(item.bumpedAt || item.approvedAt || item.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Standard + Highlighted: original compact layout */
          <>
            {/* Badges */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="px-2 py-0.5 bg-zinc-800 text-white text-[10px] font-display font-black uppercase tracking-wider">
                {CATEGORY_LABELS[item.category] || item.category}
              </span>
              {tier.badge && (
                <span className="px-2 py-0.5 bg-zn-purple text-white text-[10px] font-display font-black uppercase tracking-wider flex items-center gap-1">
                  <Star className="w-3 h-3" /> {tier.badge}
                </span>
              )}
              {hot && (
                <span className="px-2 py-0.5 bg-zn-hot text-white text-[10px] font-display font-black uppercase tracking-wider animate-pulse">
                  ГОРЕЩО!
                </span>
              )}
            </div>

            <div className="flex gap-3">
              {/* Image thumbnail */}
              {mainImage && (
                <div className={`${isHighlighted ? 'w-28 h-28' : 'w-24 h-24'} flex-shrink-0 border-2 border-[#1C1428] bg-black overflow-hidden relative`}>
                  <img src={mainImage} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                  {imageCount > 1 && (
                    <div className="absolute bottom-0 right-0 bg-black/70 text-white text-[9px] font-mono px-1 py-0.5 flex items-center gap-0.5">
                      <Camera className="w-2.5 h-2.5" />{imageCount}
                    </div>
                  )}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <h3 className={`font-display font-black uppercase tracking-wide text-zn-text dark:text-[#EDE4D0] mb-1 leading-tight ${isHighlighted ? 'text-lg' : 'text-base'}`}>
                  {item.title}
                </h3>
                <p className="font-sans text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                  {item.description}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-2 mt-2 border-t border-black/10 dark:border-white/10">
              <div className="flex items-center gap-3 text-xs font-sans text-gray-500 dark:text-gray-400">
                {item.price && (
                  <span className="flex items-center gap-1 font-bold text-green-700 dark:text-green-400 text-sm">
                    <DollarSign className="w-3.5 h-3.5" />
                    {item.price}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {item.contactName}
                </span>
                <CopyPhoneButton phone={item.phone} />
              </div>
              <span className="flex items-center gap-1 text-[10px] text-gray-400">
                <Clock className="w-3 h-3" />
                {timeAgo(item.bumpedAt || item.approvedAt || item.createdAt)}
              </span>
            </div>
          </>
        )}
      </Link>
    </motion.div>
  );
}

export default function ClassifiedsPage() {
  useDocumentTitle(makeTitle('Малки обяви'));
  const { loadClassifieds, publicSectionStatus } = usePublicData();
  const { items: recentItems } = useRecentlyViewed();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const fetchData = useCallback(async (params) => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await loadClassifieds(params);
      setItems(data.items || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (err) {
      console.error('Failed to load classifieds:', err);
      setLoadError('Грешка при зареждане на обявите. Опитайте отново.');
    } finally {
      setLoading(false);
    }
  }, [loadClassifieds]);

  useEffect(() => {
    const params = { page, limit: 20 };
    if (category) params.category = category;
    if (search) params.search = search;
    fetchData(params);
  }, [fetchData, page, category, search]);

  const handleCategoryChange = (val) => {
    setCategory(val);
    setPage(1);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="newspaper-page comic-panel comic-dots p-6 mb-6 relative">
        <div className="absolute -top-2 left-10 w-16 h-5 bg-yellow-200/70 border border-black/5 transform -rotate-6 z-10" style={{ boxShadow: '1px 1px 2px rgba(0,0,0,0.1)' }} />
        <div className="flex items-center justify-between gap-3 relative z-[2] flex-wrap">
          <div className="flex items-center gap-3">
            <Tag className="w-8 h-8 text-zn-hot" />
            <div>
              <h1 className="font-display text-4xl font-black text-zn-text tracking-wider uppercase text-shadow-brutal">Малки обяви</h1>
              <p className="font-display text-sm text-zn-text-muted mt-1 uppercase tracking-wider font-bold">Купи, продай, намери</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              to="/obiavi/status"
              className="flex items-center gap-2 px-3 py-2 text-xs font-display font-bold uppercase tracking-wider border-2 border-[#1C1428] bg-white dark:bg-[#2A2438] hover:bg-gray-100 dark:hover:bg-[#352F45] transition-colors"
              style={{ boxShadow: '2px 2px 0 #1C1428' }}
            >
              <Search className="w-3.5 h-3.5" />
              Статус
            </Link>
            <Link
              to="/obiavi/submit"
              className="flex items-center gap-2 text-sm font-display font-black uppercase tracking-wider whitespace-nowrap px-5 py-2.5 bg-gradient-to-r from-zn-purple to-zn-hot text-white border-3 border-[#1C1428] hover:scale-105 hover:brightness-110 transition-all duration-200"
              style={{ boxShadow: '4px 4px 0 #1C1428' }}
            >
              <Plus className="w-4 h-4" strokeWidth={3} />
              Пусни обява
            </Link>
          </div>
        </div>
        <div className="h-1.5 bg-gradient-to-r from-zn-hot to-zn-orange mt-4 relative z-[2]" />
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = category === cat.value;
          return (
            <button
              key={cat.value}
              type="button"
              onClick={() => handleCategoryChange(cat.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 border-2 font-display font-bold text-xs uppercase tracking-wider transition-all ${
                isActive
                  ? 'border-zn-hot bg-zn-hot text-white'
                  : 'border-[#1C1428] bg-white dark:bg-[#2A2438] text-zn-text dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#352F45]'
              }`}
              style={{ boxShadow: isActive ? '2px 2px 0 #8B0614' : '2px 2px 0 #1C1428' }}
            >
              <Icon className="w-3.5 h-3.5" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Търси в обявите..."
            className="w-full pl-10 pr-4 py-2.5 font-sans bg-white dark:bg-[#1C1828] dark:text-gray-200 border-3 border-[#1C1428] dark:border-[#524A62] focus:outline-none focus:ring-4 focus:ring-zn-purple/20 focus:border-zn-purple transition-all"
            style={{ boxShadow: '3px 3px 0 #1C1428' }}
          />
        </div>
        <button
          type="submit"
          className="flex items-center gap-2 px-5 py-2.5 bg-zn-purple text-white font-display font-black text-sm uppercase tracking-wider border-3 border-[#1C1428] hover:bg-zn-purple/90 hover:-translate-y-0.5 active:translate-y-0 transition-all"
          style={{ boxShadow: '3px 3px 0 #1C1428' }}
        >
          <Search className="w-4 h-4" />
          Търси
        </button>
      </form>

      {/* Results count */}
      {!loading && total > 0 && (
        <p className="font-sans text-sm text-gray-500 mb-4">
          {total} {total === 1 ? 'обява' : 'обяви'}
          {category ? ` в "${CATEGORY_LABELS[category]}"` : ''}
          {search ? ` за "${search}"` : ''}
        </p>
      )}

      {/* Listings */}
      {loadError ? (
        <div className="newspaper-page comic-panel comic-dots p-10 text-center relative">
          <div className="comic-stamp-circle absolute -top-5 -right-3 z-20 text-[10px]">ГРЕШКА!</div>
          <p className="font-display font-bold uppercase tracking-wider text-zn-hot relative z-[2]">{loadError}</p>
          <button type="button" onClick={() => fetchData({ page, limit: 20, ...(category && { category }), ...(search && { search }) })} className="inline-block mt-4 comic-button text-sm relative z-[2]">
            Опитай пак
          </button>
        </div>
      ) : loading && items.length === 0 ? (
        <div className="newspaper-page comic-panel p-10 text-center">
          <div className="w-8 h-8 border-3 border-zn-hot border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : items.length === 0 ? (
        <div className="newspaper-page comic-panel comic-dots p-10 text-center relative">
          <div className="comic-stamp-circle absolute -top-5 -right-3 z-20 animate-wiggle text-[10px]">ПРАЗНО!</div>
          <p className="font-display font-bold uppercase tracking-wider text-zn-text-muted relative z-[2]">
            Няма обяви{category ? ` в тази категория` : ''}{search ? ` за "${search}"` : ''}
          </p>
          <Link to="/obiavi/submit" className="inline-block mt-4 comic-button text-sm relative z-[2]">
            Подай първата обява
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <ClassifiedCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <button
            type="button"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex items-center gap-1 px-3 py-2 border-2 border-[#1C1428] bg-white dark:bg-[#2A2438] font-display font-bold text-xs uppercase disabled:opacity-40 hover:bg-gray-100 transition-colors"
            style={{ boxShadow: '2px 2px 0 #1C1428' }}
          >
            <ChevronLeft className="w-4 h-4" /> Назад
          </button>
          <span className="font-mono text-sm text-gray-500">
            {page} / {pages}
          </span>
          <button
            type="button"
            onClick={() => setPage(p => Math.min(pages, p + 1))}
            disabled={page >= pages}
            className="flex items-center gap-1 px-3 py-2 border-2 border-[#1C1428] bg-white dark:bg-[#2A2438] font-display font-bold text-xs uppercase disabled:opacity-40 hover:bg-gray-100 transition-colors"
            style={{ boxShadow: '2px 2px 0 #1C1428' }}
          >
            Напред <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Recently viewed */}
      {recentItems.length > 0 && (
        <div className="mt-10">
          <h2 className="font-display text-lg font-black uppercase tracking-wider text-zn-text dark:text-[#EDE4D0] mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-zn-purple" />
            Последно видяни
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {recentItems.map(r => (
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
