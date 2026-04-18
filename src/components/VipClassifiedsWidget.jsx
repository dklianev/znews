import { Link } from 'react-router-dom';
import { Star, DollarSign, ArrowRight } from 'lucide-react';
import { usePublicSectionsData } from '../context/DataContext';

export default function VipClassifiedsWidget() {
  const { vipClassifieds } = usePublicSectionsData();
  const items = Array.isArray(vipClassifieds) ? vipClassifieds : [];

  if (items.length === 0) return null;

  return (
    <div className="comic-panel comic-dots p-5 relative">
      <div className="absolute -top-2 right-8 w-14 h-4 bg-yellow-200/70 border border-black/5 transform rotate-3 z-10" style={{ boxShadow: '1px 1px 2px rgba(0,0,0,0.1)' }} />
      <div className="flex items-center gap-2 mb-4 relative z-[2]">
        <Star className="w-5 h-5 text-zn-purple" />
        <h3 className="font-display font-black uppercase tracking-wider text-sm text-zn-text">VIP Обяви</h3>
      </div>

      <div className="space-y-3 relative z-[2]">
        {items.map(item => (
          <Link
            key={item.id}
            to={`/obiavi/${item.id}`}
            className="block border-2 border-zn-purple/30 bg-purple-50/30 dark:bg-purple-900/10 p-3 hover:border-zn-purple transition-all hover:-translate-y-0.5"
            style={{ boxShadow: '2px 2px 0 rgba(91,26,140,0.2)' }}
          >
            <div className="flex gap-3">
              {item.images?.[0] && (
                <div className="w-14 h-14 border-2 border-[#1C1428] bg-black overflow-hidden flex-shrink-0">
                  <img src={item.images[0]} alt="" width="56" height="56" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="px-1.5 py-0.5 bg-zn-purple text-white text-[8px] font-display font-black uppercase tracking-wider flex items-center gap-0.5">
                    <Star className="w-2.5 h-2.5" /> VIP
                  </span>
                </div>
                <h4 className="font-display font-bold text-sm uppercase tracking-wide text-zn-text dark:text-[#EDE4D0] truncate">{item.title}</h4>
                {item.price && (
                  <span className="flex items-center gap-0.5 text-xs font-mono font-bold text-green-700 dark:text-green-400">
                    <DollarSign className="w-3 h-3" />{item.price}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <Link to="/obiavi" className="flex items-center gap-1.5 justify-center mt-4 text-xs font-display font-bold uppercase tracking-wider text-zn-purple hover:text-zn-hot transition-colors relative z-[2]">
        Всички обяви <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
