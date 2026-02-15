import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, Filter } from 'lucide-react';
import { useData } from '../context/DataContext';
import ResponsiveImage from '../components/ResponsiveImage';
import { makeTitle, useDocumentTitle } from '../hooks/useDocumentTitle';

export default function GalleryPage() {
  const { gallery } = useData();
  useDocumentTitle(makeTitle('Галерия'));
  const [selected, setSelected] = useState(null);
  const [filterCat, setFilterCat] = useState('all');

  const categories = [...new Set(gallery.map(g => g.category))];
  const filtered = filterCat === 'all' ? gallery : gallery.filter(g => g.category === filterCat);
  const sorted = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));

  // ESC key handler for lightbox
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') setSelected(null);
  }, []);

  useEffect(() => {
    if (selected) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [selected, handleKeyDown]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto px-4 py-8"
    >
      {/* Header */}
      <div className="newspaper-page comic-panel comic-dots p-6 mb-6 relative">
        <div className="absolute -top-2 right-8 w-14 h-5 bg-yellow-200/70 border border-black/5 transform rotate-4 z-10" style={{boxShadow:'1px 1px 2px rgba(0,0,0,0.1)'}} />
        <div className="flex items-center gap-3 relative z-[2]">
          <Camera className="w-8 h-8 text-zn-hot" />
          <div>
            <h1 className="font-display text-3xl font-black text-zn-text tracking-wider uppercase text-shadow-brutal">Галерия</h1>
            <p className="font-display text-sm text-zn-text-muted mt-1 uppercase tracking-wider font-bold">Фотографии и медия от Los Santos</p>
          </div>
        </div>
        <div className="h-1.5 bg-gradient-to-r from-zn-hot to-zn-orange mt-4 relative z-[2]" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-8">
        <Filter className="w-4 h-4 text-zn-text-muted" />
        <button
          onClick={() => setFilterCat('all')}
          className={`px-3 py-1.5 text-xs font-display font-black uppercase tracking-wider border-2 transition-all duration-200 ${
            filterCat === 'all'
              ? 'bg-zn-hot text-white border-[#1C1428]'
              : 'bg-white text-gray-500 border-[#1C1428]/20 hover:text-zn-hot hover:border-[#1C1428]/40'
          }`}
          style={{boxShadow: filterCat === 'all' ? '3px 3px 0 #1C1428' : '2px 2px 0 rgba(0,0,0,0.1)'}}
        >
          Всички ({gallery.length})
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCat(cat)}
            className={`px-3 py-1.5 text-xs font-display font-black uppercase tracking-wider border-2 transition-all duration-200 ${
              filterCat === cat
                ? 'bg-zn-hot text-white border-[#1C1428]'
                : 'bg-white text-gray-500 border-[#1C1428]/20 hover:text-zn-hot hover:border-[#1C1428]/40'
            }`}
            style={{boxShadow: filterCat === cat ? '3px 3px 0 #1C1428' : '2px 2px 0 rgba(0,0,0,0.1)'}}
          >
            {cat} ({gallery.filter(g => g.category === cat).length})
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => setSelected(item)}
            className={`group cursor-pointer relative overflow-hidden comic-panel comic-panel-hover bg-white p-1 ${
              item.featured ? 'sm:col-span-2 sm:row-span-2' : ''
            }`}
          >
            <ResponsiveImage
              src={item.image}
              fallbackSrc="https://placehold.co/600x400/FFF1E5/33302E?text=LS+News"
              alt={item.title}
              className={`w-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                item.featured ? 'h-80 sm:h-full' : 'h-56'
              }`}
              pictureClassName="block"
              sizes={item.featured ? '(max-width: 1024px) 100vw, 66vw' : '(max-width: 1024px) 50vw, 33vw'}
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-2 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all z-[3]">
              <span className="inline-block px-2 py-0.5 text-[10px] font-display font-black uppercase tracking-wider bg-zn-purple text-white mb-1.5 border border-white/30">{item.category}</span>
              <h3 className="font-display font-black text-white text-lg leading-tight tracking-wider uppercase">{item.title}</h3>
              {item.description && <p className="text-xs text-white/70 font-sans mt-1 line-clamp-2">{item.description}</p>}
            </div>
            {item.featured && (
              <span className="absolute top-3 right-3 px-2 py-0.5 text-[9px] font-display font-black uppercase tracking-wider bg-amber-500 text-white border-2 border-white/30 z-[3]" style={{boxShadow:'2px 2px 0 rgba(0,0,0,0.3)'}}>Избрано</span>
            )}
          </motion.div>
        ))}
      </div>

      {sorted.length === 0 && (
        <div className="newspaper-page comic-panel comic-dots p-10 text-center relative">
          <p className="font-display font-bold uppercase tracking-wider text-zn-text-muted relative z-[2]">Няма снимки в тази категория</p>
        </div>
      )}

      {/* Fullscreen preview */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setSelected(null)}
          >
            <button
              onClick={() => setSelected(null)}
              className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors z-10"
            >
              <X className="w-8 h-8" />
            </button>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-5xl w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="comic-panel-white">
                <ResponsiveImage
                  src={selected.image}
                  fallbackSrc="https://placehold.co/800x600/FFF1E5/33302E?text=LS+News"
                  alt={selected.title}
                  className="w-full max-h-[75vh] object-contain"
                  pictureClassName="block"
                  loading="eager"
                  fetchPriority="high"
                />
              </div>
              <div className="mt-4 text-center">
                <h3 className="font-display text-xl font-black text-white tracking-wider uppercase">{selected.title}</h3>
                {selected.description && <p className="text-sm text-white/60 font-sans mt-1">{selected.description}</p>}
                <div className="flex items-center justify-center gap-3 mt-2 text-xs text-white/40 font-display uppercase tracking-wider">
                  <span>{selected.category}</span>
                  <span>★</span>
                  <span>{selected.date}</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
