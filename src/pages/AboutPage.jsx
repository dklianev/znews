import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Mail, Phone, MapPin, Users, Award, Newspaper, Shield, CheckCircle, AlertTriangle } from 'lucide-react';
import { useSettingsData, useTaxonomyData } from '../context/DataContext';
import { api } from '../utils/api';
import { makeTitle, useDocumentTitle } from '../hooks/useDocumentTitle';
import EasterDecorations from '../components/seasonal/EasterDecorations';

const AVATAR_COLORS = ['bg-zn-hot', 'bg-zn-purple', 'bg-blue-700', 'bg-emerald-700', 'bg-amber-700', 'bg-violet-700', 'bg-rose-700', 'bg-teal-700'];
const STAT_COLORS = ['text-zn-hot', 'text-zn-purple', 'text-zn-orange', 'text-zn-blue'];
const STAT_BG = ['bg-zn-hot/10', 'bg-zn-purple/10', 'bg-zn-orange/10', 'bg-zn-blue/10'];
const DEFAULT_ABOUT = {
  heroText: '\u041d\u0435\u0437\u0430\u0432\u0438\u0441\u0438\u043c \u043d\u043e\u0432\u0438\u043d\u0430\u0440\u0441\u043a\u0438 \u043f\u043e\u0440\u0442\u0430\u043b \u0437\u0430 \u0433\u0440\u0430\u0434\u0430 Los Santos. \u0414\u043e\u0441\u0442\u0430\u0432\u044f\u043c\u0435 \u0432\u0438 \u043d\u043e\u0432\u0438\u043d\u0438, \u0440\u0435\u043f\u043e\u0440\u0442\u0430\u0436\u0438 \u0438 \u0440\u0430\u0437\u0441\u043b\u0435\u0434\u0432\u0430\u043d\u0438\u044f 24 \u0447\u0430\u0441\u0430 \u0432 \u0434\u0435\u043d\u043e\u043d\u043e\u0449\u0438\u0435\u0442\u043e, 7 \u0434\u043d\u0438 \u0432 \u0441\u0435\u0434\u043c\u0438\u0446\u0430\u0442\u0430.',
  missionTitle: '\u041d\u0430\u0448\u0430\u0442\u0430 \u043c\u0438\u0441\u0438\u044f',
  missionParagraph1: 'zNews \u0435 \u0441\u044a\u0437\u0434\u0430\u0434\u0435\u043d \u0441 \u0446\u0435\u043b\u0442\u0430 \u0434\u0430 \u043f\u0440\u0435\u0434\u043e\u0441\u0442\u0430\u0432\u0438 \u043d\u0430 \u0433\u0440\u0430\u0436\u0434\u0430\u043d\u0438\u0442\u0435 \u043d\u0430 Los Santos \u0447\u0435\u0441\u0442\u043d\u0430, \u043d\u0430\u0432\u0440\u0435\u043c\u0435\u043d\u043d\u0430 \u0438 \u0431\u0435\u0437\u043f\u0440\u0438\u0441\u0442\u0440\u0430\u0441\u0442\u043d\u0430 \u0438\u043d\u0444\u043e\u0440\u043c\u0430\u0446\u0438\u044f \u0437\u0430 \u0441\u043b\u0443\u0447\u0432\u0430\u0449\u043e\u0442\u043e \u0441\u0435 \u0432 \u0433\u0440\u0430\u0434\u0430. \u041d\u0438\u0435 \u0432\u044f\u0440\u0432\u0430\u043c\u0435 \u0432 \u0441\u0438\u043b\u0430\u0442\u0430 \u043d\u0430 \u0436\u0443\u0440\u043d\u0430\u043b\u0438\u0441\u0442\u0438\u043a\u0430\u0442\u0430 \u0434\u0430 \u0438\u043d\u0444\u043e\u0440\u043c\u0438\u0440\u0430, \u043e\u0431\u0440\u0430\u0437\u043e\u0432\u0430 \u0438 \u0432\u0434\u044a\u0445\u043d\u043e\u0432\u044f\u0432\u0430 \u043f\u0440\u043e\u043c\u044f\u043d\u0430.',
  missionParagraph2: '\u041d\u0430\u0448\u0438\u044f\u0442 \u0435\u043a\u0438\u043f \u043e\u0442 \u043e\u043f\u0438\u0442\u043d\u0438 \u0436\u0443\u0440\u043d\u0430\u043b\u0438\u0441\u0442\u0438 \u0440\u0430\u0431\u043e\u0442\u0438 \u0434\u0435\u043d\u043e\u043d\u043e\u0449\u043d\u043e, \u0437\u0430 \u0434\u0430 \u043f\u043e\u043a\u0440\u0438\u0432\u0430 \u0432\u0441\u0438\u0447\u043a\u0438 \u0430\u0441\u043f\u0435\u043a\u0442\u0438 \u043d\u0430 \u0436\u0438\u0432\u043e\u0442\u0430 \u0432 Los Santos - \u043e\u0442 \u043a\u0440\u0438\u043c\u0438\u043d\u0430\u043b\u043d\u0438\u0442\u0435 \u0445\u0440\u043e\u043d\u0438\u043a\u0438 \u0434\u043e \u043e\u0431\u0449\u0435\u0441\u0442\u0432\u0435\u043d\u0438\u0442\u0435 \u0441\u044a\u0431\u0438\u0442\u0438\u044f, \u043e\u0442 \u0431\u0438\u0437\u043d\u0435\u0441 \u043d\u043e\u0432\u0438\u043d\u0438\u0442\u0435 \u0434\u043e \u0441\u043f\u043e\u0440\u0442\u043d\u0438\u0442\u0435 \u0442\u0440\u0438\u0443\u043c\u0444\u0438.',
  adIntro: '\u0418\u0441\u043a\u0430\u0448 \u0434\u0430 \u0440\u0435\u043a\u043b\u0430\u043c\u0438\u0440\u0430\u0448 \u0441\u0432\u043e\u044f \u0431\u0438\u0437\u043d\u0435\u0441 \u0432 Los Santos? zNews \u043f\u0440\u0435\u0434\u043b\u0430\u0433\u0430 \u0440\u0430\u0437\u043d\u043e\u043e\u0431\u0440\u0430\u0437\u043d\u0438 \u0440\u0435\u043a\u043b\u0430\u043c\u043d\u0438 \u0444\u043e\u0440\u043c\u0430\u0442\u0438:',
  adPlans: [
    { name: '\u0411\u0430\u043d\u0435\u0440 (\u0433\u043e\u0440\u0435\u043d)', price: '$500/\u043c\u0435\u0441\u0435\u0446', desc: '\u0425\u043e\u0440\u0438\u0437\u043e\u043d\u0442\u0430\u043b\u0435\u043d \u0431\u0430\u043d\u0435\u0440 \u0432 \u0433\u043e\u0440\u043d\u0430\u0442\u0430 \u0447\u0430\u0441\u0442' },
    { name: '\u0411\u0430\u043d\u0435\u0440 (\u0441\u0442\u0440\u0430\u043d\u0438\u0447\u0435\u043d)', price: '$300/\u043c\u0435\u0441\u0435\u0446', desc: '\u0421\u0442\u0440\u0430\u043d\u0438\u0447\u043d\u043e \u043a\u0430\u0440\u0435 \u0432 sidebar' },
    { name: '\u0411\u0430\u043d\u0435\u0440 (\u0432 \u0441\u0442\u0430\u0442\u0438\u044f)', price: '$400/\u043c\u0435\u0441\u0435\u0446', desc: '\u0412\u0433\u0440\u0430\u0434\u0435\u043d \u0432 \u0441\u044a\u0434\u044a\u0440\u0436\u0430\u043d\u0438\u0435\u0442\u043e' },
  ],
};

const DEFAULT_CONTACT = {
  address: 'Vinewood Blvd 42, Los Santos',
  phone: '+381 11 123 4567',
  email: 'redakciq@znews.live',
};

const INITIAL_CONTACT_STATE = Object.freeze({
  status: 'idle',
  message: '',
  fieldErrors: {},
});

function ContactSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className="btn-primary w-full disabled:opacity-60" aria-busy={pending}>
      {pending ? '\u0418\u0437\u043f\u0440\u0430\u0449\u0430\u043d\u0435...' : '\u0418\u0437\u043f\u0440\u0430\u0442\u0438'}
    </button>
  );
}

export default function AboutPage() {
  const { authors } = useTaxonomyData();
  const { siteSettings } = useSettingsData();
  useDocumentTitle(makeTitle('\u0417\u0430 \u043d\u0430\u0441'));

  const [contactForm, setContactForm] = useState({ name: '', phone: '', message: '' });
  const [contactSent, setContactSent] = useState(false);
  const [dismissContactError, setDismissContactError] = useState(false);
  const [contactFieldErrors, setContactFieldErrors] = useState({});
  const about = { ...DEFAULT_ABOUT, ...(siteSettings?.about || {}) };
  const contact = { ...DEFAULT_CONTACT, ...(siteSettings?.contact || {}) };
  const adPlans = Array.isArray(about.adPlans) && about.adPlans.length > 0 ? about.adPlans : DEFAULT_ABOUT.adPlans;
  const [contactState, submitContactAction, isContactPending] = useActionState(
    async (_previousState, formData) => {
      const nextForm = {
        name: String(formData.get('name') || '').trim(),
        phone: String(formData.get('phone') || '').trim(),
        message: String(formData.get('message') || '').trim(),
      };
      const fieldErrors = {};

      if (!nextForm.name) fieldErrors.name = '\u0418\u043c\u0435\u0442\u043e \u0435 \u0437\u0430\u0434\u044a\u043b\u0436\u0438\u0442\u0435\u043b\u043d\u043e.';
      if (!nextForm.phone) fieldErrors.phone = '\u0422\u0435\u043b\u0435\u0444\u043e\u043d\u044a\u0442 \u0435 \u0437\u0430\u0434\u044a\u043b\u0436\u0438\u0442\u0435\u043b\u0435\u043d.';
      if (!nextForm.message) fieldErrors.message = '\u0421\u044a\u043e\u0431\u0449\u0435\u043d\u0438\u0435\u0442\u043e \u0435 \u0437\u0430\u0434\u044a\u043b\u0436\u0438\u0442\u0435\u043b\u043d\u043e.';

      if (nextForm.phone && nextForm.phone.replace(/\D/g, '').length < 5) {
        fieldErrors.phone = '\u0412\u044a\u0432\u0435\u0434\u0438 \u0432\u0430\u043b\u0438\u0434\u0435\u043d \u0442\u0435\u043b\u0435\u0444\u043e\u043d.';
      }

      if (Object.keys(fieldErrors).length > 0) {
        return {
          status: 'error',
          message: '\u041f\u043e\u043f\u044a\u043b\u043d\u0438 \u043f\u0440\u0430\u0432\u0438\u043b\u043d\u043e \u043f\u043e\u043b\u0435\u0442\u0430\u0442\u0430 \u0432\u044a\u0432 \u0444\u043e\u0440\u043c\u0430\u0442\u0430.',
          fieldErrors,
        };
      }

      try {
        await api.contactMessages.submit(nextForm);
        return {
          status: 'success',
          message: '',
          fieldErrors: {},
        };
      } catch (error) {
        const payloadFieldErrors = error?.payload?.fieldErrors && typeof error.payload.fieldErrors === 'object'
          ? error.payload.fieldErrors
          : {};

        return {
          status: 'error',
          message: error?.message || '\u0421\u044a\u043e\u0431\u0449\u0435\u043d\u0438\u0435\u0442\u043e \u043d\u0435 \u0431\u0435\u0448\u0435 \u0438\u0437\u043f\u0440\u0430\u0442\u0435\u043d\u043e. \u041e\u043f\u0438\u0442\u0430\u0439 \u043f\u0430\u043a.',
          fieldErrors: payloadFieldErrors,
        };
      }
    },
    INITIAL_CONTACT_STATE,
  );

  useEffect(() => {
    if (contactState.status !== 'success') return undefined;

    setContactSent(true);
    setContactForm({ name: '', phone: '', message: '' });
    const timeoutId = window.setTimeout(() => setContactSent(false), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [contactState.status]);

  useEffect(() => {
    if (contactState.status === 'error') setContactSent(false);
  }, [contactState.status]);

  useEffect(() => {
    setContactFieldErrors(contactState.fieldErrors || {});
  }, [contactState.fieldErrors]);

  useEffect(() => {
    if (contactState.status !== 'error') {
      setDismissContactError(false);
    }
  }, [contactState.status]);

  const clearContactFieldError = (field) => {
    setContactFieldErrors((prev) => {
      if (!prev?.[field]) return prev;
      return {
        ...prev,
        [field]: '',
      };
    });
  };

  const contactError = contactState.status === 'error' && !dismissContactError ? contactState.message : '';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto px-4 py-8"
    >
      <div className="text-center mb-12 relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="relative inline-block mb-6"
        >
          <div className="comic-panel px-10 py-6 md:px-14 md:py-8 relative overflow-hidden bg-gradient-to-br from-amber-400 via-orange-500 to-red-600">
            <div className="absolute inset-0 comic-dots opacity-30 pointer-events-none" />
            <h1 className="font-comic text-6xl md:text-8xl tracking-tight uppercase leading-none relative z-[2]" style={{ letterSpacing: '-0.01em' }}>
              <span className="text-white logo-z-letter">z</span>
              <span className="inline-block pr-[0.14em] text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 via-white to-yellow-200 logo-news-letters">
                News
              </span>
            </h1>
            <p className="font-display text-[0.6rem] md:text-xs font-bold uppercase tracking-[0.35em] text-white/70 mt-2 relative z-[2]">
              Los Santos Edition
            </p>
          </div>
          <motion.div
            initial={{ opacity: 0, rotate: -12, scale: 0 }}
            animate={{ opacity: 1, rotate: -12, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.4, type: 'spring', stiffness: 200 }}
            className="absolute -top-2 -right-3 md:-top-3 md:-right-4 z-10"
          >
            <span className="comic-stamp-circle text-[0.5rem] md:text-[0.6rem]" style={{ width: '2.5rem', height: '2.5rem' }}>HOT</span>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="w-32 h-1.5 bg-gradient-to-r from-zn-hot via-zn-purple to-zn-hot mx-auto mb-5 origin-center"
        />
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="text-lg font-sans text-zn-text-muted max-w-xl mx-auto leading-relaxed"
        >
          {about.heroText}
        </motion.p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        {[
          { icon: Newspaper, label: '\u041f\u043e\u043a\u0440\u0438\u0442\u0438\u0435', value: '24/7' },
          { icon: Users, label: '\u0427\u0438\u0442\u0430\u0442\u0435\u043b\u0438', value: '\u0426\u0435\u043b\u0438\u044f\u0442 \u0433\u0440\u0430\u0434' },
          { icon: Award, label: '\u041d\u0430\u0448\u0430\u0442\u0430 \u0446\u0435\u043b', value: '\u0418\u0441\u0442\u0438\u043d\u0430\u0442\u0430' },
          { icon: Shield, label: '\u0421\u0442\u0430\u0442\u0443\u0441', value: '\u041d\u0435\u0437\u0430\u0432\u0438\u0441\u0438\u043c\u0438' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="comic-panel comic-dots bg-white p-5 text-center relative cursor-default group"
          >
            <div className={`w-12 h-12 ${STAT_BG[index]} rounded-full flex items-center justify-center mx-auto mb-3 relative z-[2] group-hover:scale-110 transition-transform`}>
              <stat.icon className={`w-6 h-6 ${STAT_COLORS[index]}`} />
            </div>
            <div className="text-2xl font-display font-black text-zn-text relative z-[2]">{stat.value}</div>
            <div className="text-xs font-display font-bold text-zn-text-muted uppercase tracking-wider relative z-[2]">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="newspaper-page comic-panel comic-dots p-8 mb-12 relative"
      >
        <EasterDecorations pageId="about" />
        <div className="absolute -top-2 right-8 w-14 h-5 bg-yellow-200/70 border border-black/5 transform rotate-3 z-10" style={{ boxShadow: '1px 1px 2px rgba(0,0,0,0.1)' }} />
        <h2 className="font-display text-2xl font-black text-zn-text mb-4 tracking-wider uppercase relative z-[2]">{about.missionTitle}</h2>
        <div className="h-1.5 bg-gradient-to-r from-zn-hot to-zn-orange mb-5 relative z-[2]" />
        <div className="border-l-[6px] border-zn-hot pl-5 mb-5 relative z-[2]">
          <p className="font-sans text-zn-text leading-[1.8] italic text-[1.05rem]">
            {about.missionParagraph1}
          </p>
        </div>
        <p className="font-sans text-zn-text leading-relaxed relative z-[2]">
          {about.missionParagraph2}
        </p>
      </motion.section>

      <motion.div
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="h-0.5 bg-gradient-to-r from-transparent via-zn-hot/30 to-transparent my-2 origin-center"
      />

      <section className="mb-12">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-1.5 w-8 bg-zn-hot" />
          <h2 className="font-display text-2xl font-black text-zn-text tracking-wider uppercase">{'\u041d\u0430\u0448\u0438\u044f\u0442 \u0435\u043a\u0438\u043f'}</h2>
          <div className="h-1.5 flex-1 bg-gradient-to-r from-zn-hot/30 to-transparent" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {authors.map((author, index) => (
            <motion.div
              key={author.id}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: index * 0.08 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
            >
              <Link
                to={`/author/${author.id}`}
                className="comic-panel comic-dots bg-white p-6 text-center relative group block hover:shadow-lg transition-shadow"
              >
                <div className="relative inline-block mb-3">
                  {author.avatarImage ? (
                    <div className="w-18 h-18 rounded-full overflow-hidden border-3 border-[#1C1428] mx-auto group-hover:scale-105 transition-transform relative z-[2]" style={{ boxShadow: '3px 3px 0 #1C1428' }}>
                      <img src={author.avatarImage} alt={author.name} width="72" height="72" loading="lazy" decoding="async" className="w-full h-full object-cover" style={{ objectPosition: author.avatarImageMeta?.objectPosition || '50% 50%' }} />
                    </div>
                  ) : (
                    <div className={`w-18 h-18 ${AVATAR_COLORS[index % AVATAR_COLORS.length]} text-white flex items-center justify-center font-comic text-3xl border-3 border-[#1C1428] rounded-full mx-auto group-hover:scale-105 transition-transform relative z-[2]`} style={{ boxShadow: '3px 3px 0 #1C1428' }}>
                      {author.name?.charAt(0)}
                    </div>
                  )}
                </div>
                <h3 className="font-display font-black text-lg text-zn-text tracking-wider uppercase relative z-[2]">{author.name}</h3>
                <p className="text-sm font-display font-bold text-zn-hot uppercase tracking-wider relative z-[2]">{author.role}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      <motion.div
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="h-0.5 bg-gradient-to-r from-transparent via-zn-purple/30 to-transparent mb-8 origin-center"
      />

      <motion.section
        id="contact"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="newspaper-page comic-panel comic-dots p-8 relative scroll-mt-28 md:scroll-mt-32"
      >
        <div className="absolute -top-2 left-8 w-16 h-5 bg-yellow-200/70 border border-black/5 transform -rotate-4 z-10" style={{ boxShadow: '1px 1px 2px rgba(0,0,0,0.1)' }} />
        <h2 className="font-display text-2xl font-black text-zn-text mb-2 tracking-wider uppercase relative z-[2]">{'\u0421\u0432\u044a\u0440\u0436\u0438 \u0441\u0435 \u0441 \u043d\u0430\u0441'}</h2>
        <div className="h-1.5 bg-gradient-to-r from-zn-hot to-zn-orange mb-6 relative z-[2]" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-[2]">
          <div className="space-y-5">
            {[
              { icon: MapPin, value: contact.address, color: 'bg-zn-hot/10 text-zn-hot' },
              { icon: Phone, value: contact.phone, color: 'bg-zn-purple/10 text-zn-purple' },
              { icon: Mail, value: contact.email, color: 'bg-zn-orange/10 text-zn-orange' },
            ].map((item) => (
              <div key={item.value} className="flex items-center gap-4 font-sans text-zn-text text-sm group/contact cursor-default">
                <div className={`w-10 h-10 ${item.color} rounded-full flex items-center justify-center shrink-0 transition-transform duration-200 group-hover/contact:scale-110`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <span className="font-medium">{item.value}</span>
              </div>
            ))}
          </div>

          <form className="space-y-3" action={submitContactAction} aria-busy={isContactPending}>
            {contactSent && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border-2 border-emerald-300 text-emerald-700 text-sm font-display font-bold uppercase tracking-wider">
                <CheckCircle className="w-4 h-4 shrink-0" />
                {'\u0421\u044a\u043e\u0431\u0449\u0435\u043d\u0438\u0435\u0442\u043e \u0435 \u0438\u0437\u043f\u0440\u0430\u0442\u0435\u043d\u043e!'}
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
              name="name"
              placeholder={'\u0418\u043c\u0435'}
              value={contactForm.name}
              onChange={(event) => {
                setContactForm({ ...contactForm, name: event.target.value });
                setDismissContactError(true);
                clearContactFieldError('name');
              }}
              required
              disabled={isContactPending}
              aria-label={'\u0418\u043c\u0435'}
              aria-invalid={Boolean(contactFieldErrors.name)}
              aria-describedby={contactFieldErrors.name ? 'about-contact-name-error' : undefined}
              className={`w-full px-4 py-2.5 bg-white border-2 text-zn-text placeholder-zn-text-dim font-sans text-sm outline-none transition-colors ${contactFieldErrors.name ? 'border-red-400 focus:border-red-500' : 'border-[#1C1428]/20 focus:border-zn-purple'}`}
            />
            {contactFieldErrors.name && (
              <p id="about-contact-name-error" className="text-xs font-sans text-red-700" role="alert">{contactFieldErrors.name}</p>
            )}
            <input
              type="tel"
              name="phone"
              placeholder={'\u0422\u0435\u043b\u0435\u0444\u043e\u043d'}
              value={contactForm.phone}
              onChange={(event) => {
                setContactForm({ ...contactForm, phone: event.target.value });
                setDismissContactError(true);
                clearContactFieldError('phone');
              }}
              required
              disabled={isContactPending}
              aria-label={'\u0422\u0435\u043b\u0435\u0444\u043e\u043d'}
              aria-invalid={Boolean(contactFieldErrors.phone)}
              aria-describedby={contactFieldErrors.phone ? 'about-contact-phone-error' : undefined}
              className={`w-full px-4 py-2.5 bg-white border-2 text-zn-text placeholder-zn-text-dim font-sans text-sm outline-none transition-colors ${contactFieldErrors.phone ? 'border-red-400 focus:border-red-500' : 'border-[#1C1428]/20 focus:border-zn-purple'}`}
            />
            {contactFieldErrors.phone && (
              <p id="about-contact-phone-error" className="text-xs font-sans text-red-700" role="alert">{contactFieldErrors.phone}</p>
            )}
            <textarea
              name="message"
              placeholder={'\u0421\u044a\u043e\u0431\u0449\u0435\u043d\u0438\u0435...'}
              rows="3"
              value={contactForm.message}
              onChange={(event) => {
                setContactForm({ ...contactForm, message: event.target.value });
                setDismissContactError(true);
                clearContactFieldError('message');
              }}
              required
              disabled={isContactPending}
              aria-label={'\u0421\u044a\u043e\u0431\u0449\u0435\u043d\u0438\u0435'}
              aria-invalid={Boolean(contactFieldErrors.message)}
              aria-describedby={contactFieldErrors.message ? 'about-contact-message-error' : undefined}
              className={`w-full px-4 py-2.5 bg-white border-2 text-zn-text placeholder-zn-text-dim font-sans text-sm outline-none resize-none transition-colors ${contactFieldErrors.message ? 'border-red-400 focus:border-red-500' : 'border-[#1C1428]/20 focus:border-zn-purple'}`}
            />
            {contactFieldErrors.message && (
              <p id="about-contact-message-error" className="text-xs font-sans text-red-700" role="alert">{contactFieldErrors.message}</p>
            )}
            <ContactSubmitButton />
          </form>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="comic-panel comic-dots bg-white p-8 mt-8 relative"
      >
        <h2 className="font-display text-2xl font-black text-zn-text mb-2 tracking-wider uppercase relative z-[2]">{'\u0420\u0435\u043a\u043b\u0430\u043c\u0430'}</h2>
        <div className="h-1.5 bg-gradient-to-r from-zn-hot to-zn-orange mb-4 relative z-[2]" />
        <p className="font-sans text-zn-text leading-relaxed mb-6 relative z-[2]">
          {about.adIntro}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 relative z-[2]">
          {adPlans.map((plan, index) => {
            const planColors = ['border-t-zn-hot', 'border-t-zn-purple', 'border-t-zn-orange'];
            const priceColors = ['text-zn-hot', 'text-zn-purple', 'text-zn-orange'];
            return (
              <motion.div
                key={plan.name}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className={`p-5 newspaper-page comic-panel border-t-4 ${planColors[index % 3]} cursor-default`}
              >
                <h3 className="font-display font-black text-zn-text uppercase tracking-wider text-sm">{plan.name}</h3>
                <p className={`${priceColors[index % 3]} font-display font-black text-2xl my-2`}>{plan.price}</p>
                <p className="text-xs font-sans text-zn-text-muted">{plan.desc}</p>
              </motion.div>
            );
          })}
        </div>
        <p className="text-sm font-sans text-zn-text-muted relative z-[2]">
          {'\u0417\u0430 \u043f\u043e\u0432\u0435\u0447\u0435 \u0438\u043d\u0444\u043e\u0440\u043c\u0430\u0446\u0438\u044f, \u0441\u0432\u044a\u0440\u0436\u0435\u0442\u0435 \u0441\u0435 \u0441 \u043d\u0430\u0441 \u043d\u0430'} <span className="text-zn-hot font-display font-bold">{contact.email}</span>
        </p>
      </motion.section>
    </motion.div>
  );
}
