import { useState } from 'react';
import { motion } from 'framer-motion';
import { Scale, Gavel, CalendarClock, CheckCircle2, Clock } from 'lucide-react';
import { useData } from '../context/DataContext';
import { makeTitle, useDocumentTitle } from '../hooks/useDocumentTitle';

const severityConfig = {
  heavy: { label: 'Тежко', color: 'bg-red-700 text-white' },
  medium: { label: 'Средно', color: 'bg-amber-600 text-white' },
  light: { label: 'Леко', color: 'bg-zn-hot text-white' },
};

const statusConfig = {
  completed: { label: 'Приключено', icon: CheckCircle2, color: 'text-green-600' },
  scheduled: { label: 'Насрочено', icon: CalendarClock, color: 'text-blue-600' },
  ongoing: { label: 'В ход', icon: Clock, color: 'text-amber-600' },
};

export default function CourtPage() {
  const { court } = useData();
  useDocumentTitle(makeTitle('Съд'));
  const [tab, setTab] = useState('all');

  const completed = court.filter(c => c.status === 'completed');
  const scheduled = court.filter(c => c.status === 'scheduled' || c.status === 'ongoing');

  const displayed = tab === 'completed' ? completed : tab === 'scheduled' ? scheduled : court;
  const sorted = [...displayed].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="newspaper-page comic-panel comic-dots p-6 mb-8 relative">
        <div className="absolute -top-2 right-10 w-14 h-5 bg-yellow-200/70 border border-black/5 transform rotate-3 z-10" style={{ boxShadow: '1px 1px 2px rgba(0,0,0,0.1)' }} />
        <div className="flex items-center gap-3 relative z-[2]">
          <Scale className="w-8 h-8 text-zn-hot" />
          <div>
            <h1 className="font-display text-4xl font-black text-zn-text tracking-wider uppercase text-shadow-brutal">Съдебна хроника</h1>
            <p className="font-display text-sm text-zn-text-muted mt-1 uppercase tracking-wider font-bold">Дела, присъди и правораздаване в Los Santos</p>
          </div>
        </div>
        <div className="h-1.5 bg-gradient-to-r from-zn-hot to-zn-orange mt-4 relative z-[2]" />
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-6 border-b-2 border-zn-border/50 overflow-x-auto scrollbar-hide">
        {[
          { id: 'all', label: 'Всички', count: court.length },
          { id: 'completed', label: 'Приключени', count: completed.length },
          { id: 'scheduled', label: 'Насрочени / В ход', count: scheduled.length },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-3 text-sm font-display font-black uppercase tracking-wider border-b-2 transition-colors ${tab === t.id ? 'border-zn-hot text-zn-hot' : 'border-transparent text-zn-text-muted hover:text-zn-text'
              }`}
          >
            {t.label} <span className="text-[10px] ml-1 opacity-60">({t.count})</span>
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <div className="newspaper-page comic-panel comic-dots p-10 text-center relative">
          <p className="font-display font-bold uppercase tracking-wider text-zn-text-muted relative z-[2]">Няма записи в тази категория</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sorted.map((item, index) => {
            const sev = severityConfig[item.severity] || severityConfig.medium;
            const st = statusConfig[item.status] || statusConfig.completed;
            const StatusIcon = st.icon;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.08 }}
                className={`comic-panel comic-panel-hover comic-latest-card comic-dots bg-white p-5 relative border-l-4 overflow-visible ${item.severity === 'heavy' ? 'border-l-red-700' : item.severity === 'medium' ? 'border-l-amber-500' : 'border-l-zn-hot'
                  }`}
                style={{ '--latest-tilt': `${index % 2 === 0 ? -0.4 : 0.4}deg` }}
              >
                <div className={`absolute inset-x-0 top-0 h-2 bg-gradient-to-r ${item.status === 'completed' ? 'from-emerald-700 to-emerald-500' : 'from-blue-600 to-zn-purple'}`} />
                <div className="absolute -top-3 -right-2 z-30">
                  <span className="comic-sticker">{item.status === 'completed' ? 'Присъда' : 'Заседание'}</span>
                </div>
                <div className="relative z-[2]">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`px-2 py-0.5 text-[10px] font-display font-black uppercase tracking-wider ${sev.color} border border-black/10 ${item.severity === 'heavy' ? 'animate-pulse' : ''}`}>
                      {sev.label}
                    </span>
                    <span className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-display font-black uppercase tracking-wider bg-gray-100 ${st.color}`}>
                      <StatusIcon className="w-3 h-3" /> {st.label}
                    </span>
                    <span className="text-xs font-sans text-zn-text-muted">{item.date}</span>
                    {item.judge && (
                      <span className="text-xs font-display text-zn-text-muted uppercase tracking-wider">
                        <Gavel className="w-3 h-3 inline mr-0.5" /> {item.judge}
                      </span>
                    )}
                  </div>
                  <h2 className="font-display text-lg font-black text-zn-text mb-2 tracking-wider uppercase">{item.title}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    <div>
                      <p className="text-[10px] font-display font-black uppercase tracking-widest text-zn-text-muted">Подсъдим</p>
                      <p className="text-sm font-sans font-medium text-zn-text">{item.defendant}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-display font-black uppercase tracking-widest text-zn-text-muted">Обвинение</p>
                      <p className="text-sm font-sans text-zn-text">{item.charge}</p>
                    </div>
                    <div>
                      {item.status === 'completed' ? (
                        <>
                          <p className="text-[10px] font-display font-black uppercase tracking-widest text-zn-text-muted">Присъда</p>
                          <p className="text-sm font-display font-black text-zn-hot uppercase tracking-wider text-shadow-comic">{item.verdict}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-[10px] font-display font-black uppercase tracking-widest text-blue-600">Следващо заседание</p>
                          <p className="text-sm font-display font-black text-blue-700 uppercase tracking-wider">{item.nextHearing || 'Предстои'}</p>
                        </>
                      )}
                    </div>
                  </div>
                  {item.details && (
                    <p className="text-sm font-sans text-zn-text-muted leading-relaxed border-t-2 border-zn-border/50 pt-3">
                      {item.details}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
