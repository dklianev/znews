import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, MapPin, DollarSign, Shield, Heart, Wrench, Scale, Car, Building } from 'lucide-react';
import { usePublicData } from '../context/DataContext';
import { makeTitle, useDocumentTitle } from '../hooks/useDocumentTitle';

const typeConfig = {
  police: { label: 'Полиция', icon: Shield, color: 'bg-blue-700 text-white' },
  ems: { label: 'EMS', icon: Heart, color: 'bg-red-700 text-white' },
  mechanic: { label: 'Механик', icon: Wrench, color: 'bg-amber-700 text-white' },
  lawyer: { label: 'Адвокат', icon: Scale, color: 'bg-blue-500 text-white' },
  driver: { label: 'Шофьор', icon: Car, color: 'bg-emerald-700 text-white' },
  government: { label: 'Държавна', icon: Building, color: 'bg-zn-hot text-white' },
  other: { label: 'Друго', icon: Briefcase, color: 'bg-gray-600 text-white' },
};

export default function JobsPage() {
  const { jobs, publicSectionStatus, loadJobs } = usePublicData();
  useDocumentTitle(makeTitle('Работа'));

  useEffect(() => {
    if (publicSectionStatus.jobs !== 'idle') return undefined;
    loadJobs().catch((error) => {
      console.error('Failed to load jobs page data:', error);
    });
    return undefined;
  }, [loadJobs, publicSectionStatus.jobs]);

  const activeJobs = jobs.filter(j => j.active);
  const isLoadingJobs = publicSectionStatus.jobs === 'loading' && activeJobs.length === 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="newspaper-page comic-panel comic-dots p-6 mb-8 relative">
        <div className="absolute -top-2 left-10 w-16 h-5 bg-yellow-200/70 border border-black/5 transform -rotate-6 z-10" style={{boxShadow:'1px 1px 2px rgba(0,0,0,0.1)'}} />
        <div className="flex items-center gap-3 relative z-[2]">
          <Briefcase className="w-8 h-8 text-zn-hot" />
          <div>
            <h1 className="font-display text-4xl font-black text-zn-text tracking-wider uppercase text-shadow-brutal">Обяви за работа</h1>
            <p className="font-display text-sm text-zn-text-muted mt-1 uppercase tracking-wider font-bold">Открити позиции в Los Santos</p>
          </div>
        </div>
        <div className="h-1.5 bg-gradient-to-r from-zn-hot to-zn-orange mt-4 relative z-[2]" />
      </div>

      {isLoadingJobs ? null : activeJobs.length === 0 ? (
        <div className="newspaper-page comic-panel comic-dots p-10 text-center relative">
          <div className="comic-stamp-circle absolute -top-5 -right-3 z-20 animate-wiggle text-[10px]">ПРАЗНО!</div>
          <p className="font-display font-bold uppercase tracking-wider text-zn-text-muted relative z-[2]">Няма активни обяви в момента</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeJobs.map((job, index) => {
            const cfg = typeConfig[job.type] || typeConfig.other;
            const Icon = cfg.icon;
            return (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.08 }}
                className="comic-panel comic-panel-hover comic-latest-card comic-dots bg-white p-6 relative overflow-visible"
                style={{ '--latest-tilt': `${index % 2 === 0 ? -0.45 : 0.45}deg` }}
              >
                <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-zn-purple to-zn-blue" />
                <div className="absolute -top-3 -right-2 z-30">
                  <span className="comic-sticker">Обява</span>
                </div>
                <div className="flex items-start gap-4 relative z-[2]">
                  <div className={`w-12 h-12 ${cfg.color} flex items-center justify-center shrink-0 border-2 border-[#1C1428]`} style={{boxShadow:'2px 2px 0 #1C1428'}}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-[10px] font-display font-black uppercase tracking-wider ${cfg.color} border border-black/10`}>
                        {cfg.label}
                      </span>
                      <span className="text-xs font-sans text-zn-text-muted">{job.date}</span>
                    </div>
                    <h2 className="font-display text-xl font-black text-zn-text mb-1 tracking-wider uppercase">{job.title}</h2>
                    <p className="text-sm font-display font-bold text-zn-hot mb-2 uppercase tracking-wider">{job.org}</p>
                    <p className="text-sm font-sans text-zn-text leading-relaxed mb-3">{job.description}</p>

                    {job.requirements && (
                      <p className="text-xs font-sans text-zn-text-muted mb-2">
                        <span className="font-display font-black uppercase tracking-wider">Изисквания:</span> {job.requirements}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t-2 border-zn-border/50">
                      {job.salary && (
                        <span className="flex items-center gap-1.5 text-sm font-display font-black text-emerald-700 uppercase tracking-wider">
                          <DollarSign className="w-4 h-4" /> {job.salary}
                        </span>
                      )}
                      {job.contact && (
                        <span className="flex items-center gap-1.5 text-sm font-sans text-zn-text-muted">
                          <MapPin className="w-4 h-4" /> {job.contact}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
