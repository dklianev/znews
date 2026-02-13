import { Siren } from 'lucide-react';
import { motion } from 'framer-motion';
import { useData } from '../context/DataContext';

const dangerColors = {
  high: 'text-zn-hot',
  medium: 'text-zn-orange',
  low: 'text-zn-text-muted',
};

export default function MostWanted() {
  const { wanted } = useData();
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="newspaper-page comic-panel-red p-5 pt-6 relative comic-dots comic-sidebar-widget overflow-visible"
      style={{ '--widget-tilt': '0.35deg' }}
    >
      {/* Tape decoration */}
      <div className="absolute -top-2 left-8 w-16 h-5 bg-yellow-200/70 border border-black/5 transform -rotate-8 z-10" style={{boxShadow:'1px 1px 2px rgba(0,0,0,0.1)'}} />
      {/* Comic stamp */}
      <div className="absolute -top-4 -right-4 comic-stamp-circle animate-wiggle z-20">
        ИЗДИРВАН!
      </div>

      <div className="flex items-center gap-2 mb-1 relative z-[2]">
        <Siren className="w-5 h-5 text-zn-hot animate-hot-pulse" />
        <h3 className="font-display font-black text-sm text-zn-black uppercase tracking-widest text-shadow-comic">Най-издирвани</h3>
      </div>
      <div className="h-1.5 bg-gradient-to-r from-zn-hot to-zn-orange mb-4 mt-2 relative z-[2]" />

      <div className="space-y-1 relative z-[2]">
        {wanted.map((person, index) => (
          <motion.div
            key={person.id}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.25 + index * 0.1 }}
            className={`comic-sidebar-row flex items-start gap-3 py-3 px-2 mb-2 last:mb-0 hover:bg-zn-hot/5 transition-all duration-200 group ${
              index === 0 ? 'bg-zn-hot/5 border-l-3 border-l-zn-hot pl-3' : ''
            }`}
          >
            <span className={`text-2xl font-display font-black shrink-0 w-7 transition-transform duration-200 group-hover:scale-110 ${
              index === 0 ? 'text-zn-hot text-comic-stroke' : 'text-zn-border'
            }`} style={index === 0 ? {textShadow:'2px 2px 0 rgba(204,10,26,0.2)'} : {}}>
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <h4 className="font-display font-black text-sm text-zn-black leading-snug uppercase tracking-wider group-hover:text-zn-hot transition-colors">
                {person.name}
              </h4>
              <p className="text-xs text-zn-text-muted mt-0.5 italic">{person.charge}</p>
              <div className="flex items-center justify-between mt-1.5">
                <span className="inline-flex items-center px-2 py-0.5 border border-zn-gold/40 bg-zn-gold/10 text-xs font-display font-black text-zn-gold uppercase tracking-wider">
                  {person.bounty}
                </span>
                <span className={`px-1.5 py-0.5 border border-current/20 text-[10px] font-display font-black uppercase tracking-widest ${dangerColors[person.danger]} ${person.danger === 'high' ? 'animate-pulse' : ''}`}>
                  {person.danger === 'high' ? 'ОПАСЕН!' : 'ВНИМАНИЕ'}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t-2 border-zn-border/50 text-center relative z-[2]">
        <p className="text-[10px] font-display text-zn-text-dim uppercase tracking-widest font-black">
          Информация: <span className="text-zn-hot text-xs">911</span>
        </p>
      </div>
    </motion.div>
  );
}
