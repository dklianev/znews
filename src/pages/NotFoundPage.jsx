import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Home } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto px-4 py-16"
    >
      <div className="newspaper-page comic-panel comic-dots p-8 md:p-12 text-center relative">
        {/* Tape decorations */}
        <div className="absolute -top-2 left-10 w-16 h-5 bg-yellow-200/70 border border-black/5 transform -rotate-6 z-10" style={{boxShadow:'1px 1px 2px rgba(0,0,0,0.1)'}} />
        <div className="absolute -top-2 right-10 w-14 h-5 bg-yellow-200/70 border border-black/5 transform rotate-4 z-10" style={{boxShadow:'1px 1px 2px rgba(0,0,0,0.1)'}} />

        {/* Floating comic bubble */}
        <div className="absolute -top-6 -right-4 md:right-8 z-20 animate-wiggle">
          <div className="comic-bubble-hot text-lg md:text-xl">АЛОО?!</div>
        </div>

        {/* Starburst */}
        <div className="absolute -top-7 -left-4 md:left-8 z-20 animate-wiggle-fast">
          <div className="comic-stamp-circle text-[10px]">КЛАСИФИЦИРАНО!</div>
        </div>

        {/* Giant 404 */}
        <div className="relative z-[2] mb-4">
          <h1 className="font-display text-[120px] sm:text-[160px] md:text-[200px] font-black leading-none text-comic-stroke text-shadow-brutal text-zn-hot uppercase">
            404
          </h1>
        </div>

        {/* Red bar */}
        <div className="h-2 bg-gradient-to-r from-red-700 via-zn-hot to-red-700 mb-6 relative z-[2]" />

        <p className="font-display text-xl md:text-2xl font-black uppercase tracking-widest text-zn-black mb-3 relative z-[2] text-shadow-comic">
          Страницата не е намерена
        </p>

        <p className="font-sans text-sm text-zn-text-muted mb-8 leading-relaxed max-w-md mx-auto relative z-[2]">
          Страницата, която търсите, не съществува или е била преместена. Може би е класифицирана информация?
        </p>

        {/* Buttons */}
        <div className="flex items-center justify-center gap-4 relative z-[2]">
          <Link
            to="/"
            className="btn-hot inline-flex items-center gap-2 px-6 py-3 text-sm"
          >
            <Home className="w-4 h-4" />
            Начална страница
          </Link>
          <Link
            to="/search"
            className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm"
          >
            <Search className="w-4 h-4" />
            Търсене
          </Link>
        </div>

        {/* Bottom decoration */}
        <div className="mt-8 pt-4 border-t-2 border-zn-border/50 relative z-[2]">
          <p className="text-[10px] font-display text-zn-text-dim uppercase tracking-widest font-black">
            zNews — Секретно досие #404
          </p>
        </div>
      </div>
    </motion.div>
  );
}
