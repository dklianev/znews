import { useEffect } from 'react';
import { motion } from 'motion/react';
import { Calendar, Clock, MapPin, User } from 'lucide-react';
import { usePublicSectionsData } from '../context/DataContext';
import { makeTitle, useDocumentTitle } from '../hooks/useDocumentTitle';

const typeLabels = {
  race: 'Рали / Състезание',
  party: 'Парти / Бал',
  tournament: 'Турнир',
  meeting: 'Събрание',
  concert: 'Концерт',
  other: 'Събитие',
};

function EventCard({ event, index = 0, today }) {
  const isPast = event.date < today;
  const dateObj = new Date(event.date);
  const dayNum = dateObj.getDate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08 }}
      className={`comic-panel comic-panel-hover comic-latest-card comic-dots bg-white p-5 relative overflow-visible ${isPast ? 'opacity-60' : ''}`}
      style={{ '--latest-tilt': `${index % 2 === 0 ? -0.45 : 0.45}deg` }}
    >
      <div className={`absolute inset-x-0 top-0 h-2 bg-gradient-to-r ${isPast ? 'from-zn-text-dim to-zn-border' : 'from-zn-hot to-zn-orange'}`} />
      {!isPast && (
        <div className="absolute -top-3 -right-2 z-30">
          <span className="comic-sticker">Събитие</span>
        </div>
      )}
      {isPast && (
        <div className="absolute -top-4 -right-3 z-20">
          <div className="comic-stamp-circle text-[8px] animate-wiggle">ПРИКЛЮЧИЛО</div>
        </div>
      )}

      <div className="flex items-start gap-4 relative z-[2]">
        <div className="text-center shrink-0">
          <div className="w-16 h-16 bg-zn-purple text-white flex flex-col items-center justify-center border-2 border-[#1C1428] comic-ink-shadow-sm">
            <span className="text-2xl font-display font-black leading-none">{dayNum}</span>
            <span className="text-[9px] font-display uppercase tracking-wider font-bold">
              {dateObj.toLocaleDateString('bg-BG', { month: 'short' })}
            </span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[10px] font-display font-black uppercase tracking-wider bg-zn-purple text-white border border-black/10">
              {typeLabels[event.type] || typeLabels.other}
            </span>
          </div>
          <h2 className="font-display text-lg font-black text-zn-text mb-1 tracking-wider uppercase">{event.title}</h2>
          <p className="text-sm font-sans text-zn-text-muted leading-relaxed mb-3">{event.description}</p>
          <div className="flex flex-wrap items-center gap-4 text-xs font-sans text-zn-text-muted">
            {event.time && (
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {event.time}</span>
            )}
            {event.location && (
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {event.location}</span>
            )}
            {event.organizer && (
              <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {event.organizer}</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function EventsPage() {
  const { events, publicSectionStatus, loadEvents } = usePublicSectionsData();
  useDocumentTitle(makeTitle('Събития'));

  useEffect(() => {
    if (publicSectionStatus.events !== 'idle') return undefined;
    loadEvents().catch((error) => {
      console.error('Failed to load events page data:', error);
    });
    return undefined;
  }, [loadEvents, publicSectionStatus.events]);

  const sorted = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));
  const today = new Date().toISOString().split('T')[0];
  const upcoming = sorted.filter(e => e.date >= today);
  const past = sorted.filter(e => e.date < today);
  const isLoadingEvents = publicSectionStatus.events === 'loading' && sorted.length === 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="newspaper-page comic-panel comic-dots p-6 mb-8 relative">
        <div className="absolute -top-2 left-8 w-14 h-5 bg-yellow-200/70 border border-black/5 transform -rotate-4 z-10" style={{boxShadow:'1px 1px 2px rgba(0,0,0,0.1)'}} />
        <div className="flex items-center gap-3 relative z-[2]">
          <Calendar className="w-8 h-8 text-zn-hot" />
          <div>
            <h1 className="font-display text-4xl font-black text-zn-text tracking-wider uppercase text-shadow-brutal">Събития</h1>
            <p className="font-display text-sm text-zn-text-muted mt-1 uppercase tracking-wider font-bold">Предстоящи и минали събития в Los Santos</p>
          </div>
        </div>
        <div className="h-1.5 bg-gradient-to-r from-zn-hot to-zn-orange mt-4 relative z-[2]" />
      </div>

      {upcoming.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-1 w-8 bg-zn-hot" />
            <h2 className="font-display text-sm font-black uppercase tracking-widest text-zn-hot">Предстоящи</h2>
            <div className="h-1 flex-1 bg-gradient-to-r from-zn-hot/30 to-transparent" />
          </div>
          <div className="space-y-4">
            {upcoming.map((e, i) => <EventCard key={e.id} event={e} index={i} today={today} />)}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-1 w-8 bg-zn-text-dim" />
            <h2 className="font-display text-sm font-black uppercase tracking-widest text-zn-text-dim">Приключили</h2>
            <div className="h-1 flex-1 bg-gradient-to-r from-zn-text-dim/30 to-transparent" />
          </div>
          <div className="space-y-4">
            {past.map((e, i) => <EventCard key={e.id} event={e} index={i} today={today} />)}
          </div>
        </section>
      )}

      {!isLoadingEvents && events.length === 0 && (
        <div className="newspaper-page comic-panel comic-dots p-10 text-center relative">
          <p className="font-display font-bold uppercase tracking-wider text-zn-text-muted relative z-[2]">Няма записани събития</p>
        </div>
      )}
    </motion.div>
  );
}
