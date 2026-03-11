import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Users, Award, Newspaper, Shield, CheckCircle, AlertTriangle } from 'lucide-react';
import { usePublicData } from '../context/DataContext';
import { useState } from 'react';
import { api } from '../utils/api';
import { makeTitle, useDocumentTitle } from '../hooks/useDocumentTitle';

const AVATAR_COLORS = ['bg-zn-hot', 'bg-zn-purple', 'bg-blue-700', 'bg-emerald-700', 'bg-amber-700', 'bg-violet-700', 'bg-rose-700', 'bg-teal-700'];
const DEFAULT_ABOUT = {
  heroText: 'Независим новинарски портал за града Los Santos. Доставяме ви новини, репортажи и разследвания 24 часа в денонощието, 7 дни в седмицата.',
  missionTitle: 'Нашата мисия',
  missionParagraph1: 'zNews е създаден с целта да предостави на гражданите на Los Santos честна, навременна и безпристрастна информация за случващото се в града. Ние вярваме в силата на журналистиката да информира, образова и вдъхновява промяна.',
  missionParagraph2: 'Нашият екип от опитни журналисти работи денонощно, за да покрива всички аспекти на живота в Los Santos — от криминалните хроники до обществените събития, от бизнес новините до спортните триумфи.',
  adIntro: 'Искаш да рекламираш своя бизнес в Los Santos? zNews предлага разнообразни рекламни формати:',
  adPlans: [
    { name: 'Банер (горен)', price: '$500/месец', desc: 'Хоризонтален банер в горната част' },
    { name: 'Банер (страничен)', price: '$300/месец', desc: 'Странично каре в sidebar' },
    { name: 'Банер (в статия)', price: '$400/месец', desc: 'Вграден в съдържанието' },
  ],
};

const DEFAULT_CONTACT = {
  address: 'Vinewood Blvd 42, Los Santos',
  phone: '+381 11 123 4567',
  email: 'redakciq@znews.live',
};

export default function AboutPage() {
  const { authors, siteSettings } = usePublicData();
  useDocumentTitle(makeTitle('За нас'));
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [contactSent, setContactSent] = useState(false);
  const [contactSending, setContactSending] = useState(false);
  const [contactError, setContactError] = useState('');
  const about = { ...DEFAULT_ABOUT, ...(siteSettings?.about || {}) };
  const contact = { ...DEFAULT_CONTACT, ...(siteSettings?.contact || {}) };
  const adPlans = Array.isArray(about.adPlans) && about.adPlans.length > 0 ? about.adPlans : DEFAULT_ABOUT.adPlans;

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.message) return;
    if (contactSending) return;

    setContactSending(true);
    setContactError('');
    try {
      await api.contactMessages.submit(contactForm);
      setContactSent(true);
      setContactForm({ name: '', email: '', message: '' });
      setTimeout(() => setContactSent(false), 5000);
    } catch (err) {
      setContactError(err?.message || 'Неуспешно изпращане. Опитай пак.');
    } finally {
      setContactSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto px-4 py-8"
    >
      {/* Hero */}
      <div className="text-center mb-12 relative">
        <div className="comic-speed-lines py-6">
          <h1 className="font-display text-5xl md:text-6xl font-black text-zn-text mb-4 tracking-wider uppercase text-shadow-brutal text-comic-stroke">
            zNews
          </h1>
        </div>
        <div className="w-24 h-1.5 bg-gradient-to-r from-zn-hot to-zn-purple mx-auto mb-4" />
        <p className="text-lg font-sans text-zn-text-muted max-w-xl mx-auto leading-relaxed">
          {about.heroText}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        {[
          { icon: Newspaper, label: 'Покритие', value: '24/7' },
          { icon: Users, label: 'Читатели', value: 'Целият Град' },
          { icon: Award, label: 'Нашата Цел', value: 'Истината' },
          { icon: Shield, label: 'Статус', value: 'Независими' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="comic-panel comic-dots bg-white p-5 text-center relative"
          >
            <stat.icon className="w-7 h-7 text-zn-hot mx-auto mb-2 relative z-[2]" />
            <div className="text-2xl font-display font-black text-zn-text relative z-[2]">{stat.value}</div>
            <div className="text-sm font-display font-bold text-zn-text-muted uppercase tracking-wider relative z-[2]">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Mission */}
      <section className="newspaper-page comic-panel comic-dots p-8 mb-12 relative">
        <div className="absolute -top-2 right-8 w-14 h-5 bg-yellow-200/70 border border-black/5 transform rotate-3 z-10" style={{ boxShadow: '1px 1px 2px rgba(0,0,0,0.1)' }} />
        <h2 className="font-display text-2xl font-black text-zn-text mb-4 tracking-wider uppercase relative z-[2]">{about.missionTitle}</h2>
        <div className="h-1.5 bg-gradient-to-r from-zn-hot to-zn-orange mb-4 relative z-[2]" />
        <p className="font-sans text-zn-text leading-relaxed mb-4 relative z-[2]">
          {about.missionParagraph1}
        </p>
        <p className="font-sans text-zn-text leading-relaxed relative z-[2]">
          {about.missionParagraph2}
        </p>
      </section>

      {/* Team */}
      <section className="mb-12">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-1.5 w-8 bg-zn-hot" />
          <h2 className="font-display text-2xl font-black text-zn-text tracking-wider uppercase">Нашият екип</h2>
          <div className="h-1.5 flex-1 bg-gradient-to-r from-zn-hot/30 to-transparent" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {authors.map((author, index) => (
            <motion.div
              key={author.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.08 }}
              className="comic-panel comic-panel-hover bg-white p-6 text-center"
            >
              <div className={`w-16 h-16 ${AVATAR_COLORS[index % AVATAR_COLORS.length]} text-white flex items-center justify-center font-display font-black text-2xl border-3 border-[#1C1428] mx-auto mb-3`} style={{ boxShadow: '3px 3px 0 #1C1428' }}>
                {author.name?.charAt(0)}
              </div>
              <h3 className="font-display font-black text-lg text-zn-text tracking-wider uppercase">{author.name}</h3>
              <p className="text-sm font-display font-bold text-zn-hot uppercase tracking-wider">{author.role}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section className="newspaper-page comic-panel comic-dots p-8 relative">
        <div className="absolute -top-2 left-8 w-16 h-5 bg-yellow-200/70 border border-black/5 transform -rotate-4 z-10" style={{ boxShadow: '1px 1px 2px rgba(0,0,0,0.1)' }} />
        <h2 className="font-display text-2xl font-black text-zn-text mb-2 tracking-wider uppercase relative z-[2]">Свържи се с нас</h2>
        <div className="h-1.5 bg-gradient-to-r from-zn-hot to-zn-orange mb-6 relative z-[2]" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-[2]">
          <div className="space-y-4">
            <div className="flex items-center gap-3 font-sans text-zn-text text-sm">
              <MapPin className="w-5 h-5 text-zn-hot shrink-0" />
              <span>{contact.address}</span>
            </div>
            <div className="flex items-center gap-3 font-sans text-zn-text text-sm">
              <Phone className="w-5 h-5 text-zn-hot shrink-0" />
              <span>{contact.phone}</span>
            </div>
            <div className="flex items-center gap-3 font-sans text-zn-text text-sm">
              <Mail className="w-5 h-5 text-zn-hot shrink-0" />
              <span>{contact.email}</span>
            </div>
          </div>

          <form className="space-y-3" onSubmit={handleContactSubmit}>
            {contactSent && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border-2 border-emerald-300 text-emerald-700 text-sm font-display font-bold uppercase tracking-wider">
                <CheckCircle className="w-4 h-4 shrink-0" />
                Съобщението е изпратено!
              </div>
            )}
            {contactError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border-2 border-red-200 text-red-800 text-sm font-display font-bold uppercase tracking-wider" role="alert">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="break-words">{contactError}</span>
              </div>
            )}
            <input
              type="text"
              placeholder="Име"
              value={contactForm.name}
              onChange={e => setContactForm({ ...contactForm, name: e.target.value })}
              required
              aria-label="Име"
              className="w-full px-4 py-2.5 bg-white border-2 border-[#1C1428]/20 text-zn-text placeholder-zn-text-dim font-sans text-sm outline-none focus:border-zn-purple transition-colors"
            />
            <input
              type="email"
              placeholder="Email"
              value={contactForm.email}
              onChange={e => setContactForm({ ...contactForm, email: e.target.value })}
              required
              aria-label="Email"
              className="w-full px-4 py-2.5 bg-white border-2 border-[#1C1428]/20 text-zn-text placeholder-zn-text-dim font-sans text-sm outline-none focus:border-zn-purple transition-colors"
            />
            <textarea
              placeholder="Съобщение..."
              rows="3"
              value={contactForm.message}
              onChange={e => setContactForm({ ...contactForm, message: e.target.value })}
              required
              aria-label="Съобщение"
              className="w-full px-4 py-2.5 bg-white border-2 border-[#1C1428]/20 text-zn-text placeholder-zn-text-dim font-sans text-sm outline-none focus:border-zn-purple resize-none transition-colors"
            />
            <button disabled={contactSending} className="btn-primary w-full disabled:opacity-60">
              {contactSending ? 'Изпращане...' : 'Изпрати'}
            </button>
          </form>
        </div>
      </section>

      {/* Advertising info */}
      <section className="comic-panel comic-dots bg-white p-8 mt-8 relative">
        <h2 className="font-display text-2xl font-black text-zn-text mb-2 tracking-wider uppercase relative z-[2]">Реклама</h2>
        <div className="h-1.5 bg-gradient-to-r from-zn-hot to-zn-orange mb-4 relative z-[2]" />
        <p className="font-sans text-zn-text leading-relaxed mb-6 relative z-[2]">
          {about.adIntro}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 relative z-[2]">
          {adPlans.map(plan => (
            <div key={plan.name} className="p-4 newspaper-page comic-panel comic-panel-hover">
              <h3 className="font-display font-black text-zn-text uppercase tracking-wider">{plan.name}</h3>
              <p className="text-zn-hot font-display font-black text-xl my-1">{plan.price}</p>
              <p className="text-xs font-sans text-zn-text-muted">{plan.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-sm font-sans text-zn-text-muted relative z-[2]">
          За повече информация, свържете се с нас на <span className="text-zn-hot font-display font-bold">{contact.email}</span>
        </p>
      </section>
    </motion.div>
  );
}
