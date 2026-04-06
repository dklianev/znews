import { Link } from 'react-router-dom';
import { Flame, Megaphone, MapPin, Phone, Mail, AlertTriangle, Shield, ArrowRight } from 'lucide-react';
import { usePublicData } from '../context/DataContext';

const DEFAULT_FOOTER_PILLS = [
  { label: 'Горещо', to: '/category/breaking', hot: true, tilt: '-1.5deg' },
  { label: 'Подземен свят', to: '/category/underground', hot: true, tilt: '1deg' },
  { label: 'Общество', to: '/category/society', tilt: '-0.8deg' },
  { label: 'Криминални', to: '/category/crime', tilt: '0.8deg' },
  { label: 'Бизнес', to: '/category/business', tilt: '-1deg' },
];

const DEFAULT_FOOTER_QUICK_LINKS = [
  { label: 'Последни новини', to: '/latest' },
  { label: 'Криминални', to: '/category/crime' },
  { label: 'Подземен свят', to: '/category/underground' },
  { label: 'Полиция', to: '/category/emergency' },
  { label: 'Горещо', to: '/category/breaking' },
  { label: 'Политика', to: '/category/politics' },
  { label: 'Бизнес', to: '/category/business' },
  { label: 'Общество', to: '/category/society' },
];

const DEFAULT_FOOTER_INFO_LINKS = [
  { label: 'За нас', to: '/about' },
  { label: 'Работа', to: '/jobs' },
  { label: 'Съдебна хроника', to: '/court' },
  { label: 'Събития', to: '/events' },
  { label: 'Галерия', to: '/gallery' },
];

const DEFAULT_CONTACT = {
  address: 'Vinewood Blvd 42, Los Santos',
  phone: '+381 11 123 4567',
  email: 'redakciq@znews.live',
};

const LEGAL_BADGES = [
  'Свобода на изразяване',
  'Свобода на пресата',
  'Поверителност на източници',
  'Право на корекция',
];

export default function Footer() {
  const { siteSettings, categories } = usePublicData();
  const footerPills = Array.isArray(siteSettings?.footerPills) && siteSettings.footerPills.length > 0
    ? siteSettings.footerPills
    : DEFAULT_FOOTER_PILLS;
  const infoLinksRaw = Array.isArray(siteSettings?.footerInfoLinks) && siteSettings.footerInfoLinks.length > 0
    ? siteSettings.footerInfoLinks
    : DEFAULT_FOOTER_INFO_LINKS;
  const quickLinksRaw = Array.isArray(siteSettings?.footerQuickLinks) && siteSettings.footerQuickLinks.length > 0
    ? siteSettings.footerQuickLinks
    : DEFAULT_FOOTER_QUICK_LINKS;
  const latestQuickLink = quickLinksRaw.find((item) => item?.to === '/latest')
    || infoLinksRaw.find((item) => item?.to === '/latest')
    || { label: 'Последни новини', to: '/latest' };
  const quickLinksBase = quickLinksRaw.filter((item) => item?.to !== '/category/sports' && item?.to !== '/latest');
  const hasBreakingCategory = Array.isArray(categories) && categories.some((item) => item?.id === 'breaking');
  const hasBreakingLink = quickLinksBase.some((item) => item?.to === '/category/breaking');
  const quickLinks = hasBreakingCategory && !hasBreakingLink
    ? [latestQuickLink, ...quickLinksBase, { label: 'Горещо', to: '/category/breaking' }]
    : [latestQuickLink, ...quickLinksBase];
  const infoLinks = infoLinksRaw.filter((item) => item?.to !== '/latest');
  const contact = {
    ...DEFAULT_CONTACT,
    ...(siteSettings?.contact || {}),
  };
  const tipLinePromo = siteSettings?.tipLinePromo || {
    enabled: true,
    title: 'Имаш ли новина за нас?',
    description: 'Стана ли свидетел на нещо скандално, незаконно или просто интересно? Прати ни ексклузивен сигнал и снимки напълно анонимно!',
    buttonLabel: 'ПОДАЙ СИГНАЛ',
    buttonLink: '/tipline',
  };

  return (
    <footer className="mt-0">
      {/* ── TIP LINE PROMO ── */}
      {tipLinePromo.enabled && (
        <div className="bg-zn-hot comic-dots border-t-8 border-b-8 border-zn-black relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-shimmer" />
          <div className="max-w-6xl mx-auto px-4 py-8 md:py-12 relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-3xl md:text-5xl font-comic text-white text-shadow-comic mb-4 flex flex-col md:flex-row items-center justify-center md:justify-start gap-4">
                <AlertTriangle className="w-12 h-12 md:w-16 md:h-16 text-black drop-shadow-md animate-pulse" />
                <span className="-skew-y-2 inline-block transform">{tipLinePromo.title}</span>
              </h3>
              <p className="text-white text-lg md:text-xl font-sans font-black max-w-3xl leading-snug drop-shadow-md border-l-4 border-black pl-4 py-1 mx-auto md:mx-0">
                {tipLinePromo.description}
              </p>
            </div>
            <div className="shrink-0 mt-4 md:mt-0 relative group/btn">
              <Link
                to={tipLinePromo.buttonLink}
                className="inline-flex items-center justify-center bg-white dark:bg-[#EDE4D0] border-4 border-black px-8 py-4 text-2xl font-comic uppercase text-zn-hot transition-transform active:scale-95 shadow-[8px_8px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-2 hover:translate-y-2"
              >
                <Flame className="w-6 h-6 mr-2 animate-bounce" />
                {tipLinePromo.buttonLabel}
              </Link>
            </div>
          </div>
        </div>
      )}



      {/* ── TABLOID CATEGORY BAR ── */}
      <div className="bg-gradient-to-r from-zn-hot via-zn-purple to-zn-navy py-4 px-4 border-b-4 border-black/20">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-3 md:gap-5">
          {footerPills.map(pill => (
            <Link
              key={pill.label}
              to={pill.to}
              className={`comic-chip whitespace-nowrap ${pill.hot ? 'comic-chip-hot' : ''}`}
              style={{ '--chip-tilt': pill.tilt }}
            >
              {pill.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="comic-grid-backdrop comic-dots relative border-0 shadow-none rounded-none">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="md:col-span-1">
              <Link to="/" className="inline-block mb-3">
                <h3 className="font-comic text-4xl uppercase text-shadow-comic" style={{ letterSpacing: '-0.01em' }}>
                  <span className="text-zn-black">z</span>
                  <span className="text-zn-hot">News</span>
                </h3>
                <p className="font-display text-[10px] text-zn-text-dim tracking-[0.4em] uppercase font-black">★ Горещи Новини ★</p>
              </Link>
              <p className="text-sm text-zn-text-muted leading-relaxed font-sans">
                Горещи новини, скандали и ексклузивни разкрития от града.
              </p>
              <div className="flex items-center gap-2 mt-3 px-3 py-1.5 bg-zn-hot/10 border-2 border-zn-hot/20 inline-flex" style={{ borderRadius: '50px' }}>
                <Flame className="w-4 h-4 text-zn-hot" />
                <span className="text-xs text-zn-hot font-display font-black uppercase tracking-wider">Градско Издание</span>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-display text-sm font-black uppercase tracking-widest text-zn-black mb-4 flex items-center gap-2 pb-2 border-b-2 border-zn-hot">
                <Megaphone className="w-4 h-4 text-zn-hot" />
                Рубрики
              </h4>
              <ul className="space-y-2">
                {quickLinks.map(item => (
                  <li key={item.label}>
                    <Link to={item.to} className="text-sm text-zn-text-muted hover:text-zn-hot transition-colors font-display uppercase tracking-wide font-bold red-dot inline-block py-1">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Info */}
            <div>
              <h4 className="font-display text-sm font-black uppercase tracking-widest text-zn-black mb-4 pb-2 border-b-2 border-zn-purple">Информация</h4>
              <ul className="space-y-2">
                {infoLinks.map(item => (
                  <li key={item.label}>
                    <Link to={item.to} className="text-sm text-zn-text-muted hover:text-zn-hot transition-colors font-display uppercase tracking-wide font-bold red-dot inline-block py-1">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-display text-sm font-black uppercase tracking-widest text-zn-black mb-4 pb-2 border-b-2 border-zn-orange">Контакт</h4>
              <ul className="space-y-3">
                <li className="flex items-center gap-2 text-sm text-zn-text-muted font-sans">
                  <MapPin className="w-4 h-4 shrink-0 text-zn-hot" />
                  {contact.address}
                </li>
                <li className="flex items-center gap-2 text-sm text-zn-text-muted font-sans">
                  <Phone className="w-4 h-4 shrink-0 text-zn-hot" />
                  {contact.phone}
                </li>
                <li className="flex items-center gap-2 text-sm text-zn-text-muted font-sans">
                  <Mail className="w-4 h-4 shrink-0 text-zn-hot" />
                  <span className="text-zn-hot font-bold">{contact.email}</span>
                </li>
              </ul>
            </div>

          </div>

          {/* Legal disclaimer */}
          <div className="mt-8 newspaper-page comic-panel comic-dots relative overflow-hidden">
            <div className="absolute -top-4 right-4 comic-stamp-circle z-20 text-[10px]">ПРАВО</div>
            <div className="p-5 md:p-6">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="headline-banner-navy inline-flex items-center gap-2 px-3 py-1 text-[10px]">
                      <Shield className="w-3.5 h-3.5" />
                      Редакционен стандарт
                    </div>
                    <h4 className="mt-3 font-display text-xl md:text-2xl font-black uppercase tracking-[0.12em] text-zn-text text-shadow-brutal leading-tight">
                      Свобода на изразяване. Отговорна редакция. Защита на източници.
                    </h4>
                    <p className="mt-3 text-sm md:text-[15px] text-zn-text-muted dark:text-gray-300 font-sans leading-relaxed">
                      Юридическият и редакционният стандарт на <span className="font-black text-zn-text dark:text-[#EDE4D0]">ZNEWS</span> стъпва върху реални принципи,
                      а не върху кухи предупреждения. Затова тук заявяваме едновременно правата, на които се позоваваме, и отговорността, с която работим.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {LEGAL_BADGES.map((badge) => (
                      <span
                        key={badge}
                        className="comic-chip whitespace-nowrap bg-white/90 dark:bg-[#2A2438] text-zn-text dark:text-[#EDE4D0]"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.2fr_0.9fr]">
                  <div className="comic-panel-white bg-white/80 dark:bg-[#201B2C] p-4 md:p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Megaphone className="w-4 h-4 text-zn-hot shrink-0" />
                      <h5 className="font-display text-sm font-black uppercase tracking-[0.14em] text-zn-text">
                        Редакционни принципи
                      </h5>
                    </div>
                    <p className="text-[13px] md:text-sm text-zn-text-muted dark:text-gray-300 font-sans leading-relaxed">
                      <span className="font-bold text-zn-text dark:text-[#EDE4D0]">ZNEWS</span> публикува журналистически и редакционни материали по теми от обществен интерес.
                      Редакционната дейност се ръководи от принципите на свободата на изразяване и свободата на пресата, признати в чл.&nbsp;19 от Всеобщата декларация за правата на човека,
                      чл.&nbsp;19 от Международния пакт за граждански и политически права и Първата поправка към Конституцията на САЩ.
                    </p>
                  </div>

                  <div className="comic-panel-white bg-white/80 dark:bg-[#201B2C] p-4 md:p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="w-4 h-4 text-zn-purple shrink-0" />
                      <h5 className="font-display text-sm font-black uppercase tracking-[0.14em] text-zn-text">
                        Поверителност и реакция
                      </h5>
                    </div>
                    <p className="text-[13px] md:text-sm text-zn-text-muted dark:text-gray-300 font-sans leading-relaxed">
                      Редакцията полага разумни мерки да защитава поверителността на източниците и редакционните комуникации в максималната степен, допустима от приложимото право.
                      Сигнали за неточност, нарушение на права или незаконно съдържание се приемат за преглед, корекция и реакция по установения редакционен ред.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t-2 border-zn-border/60 pt-4 md:flex-row md:items-center md:justify-between">
                  <p className="text-xs md:text-[13px] text-zn-text-muted dark:text-gray-300 font-sans leading-relaxed max-w-3xl">
                    Ако искаш да подадеш сигнал, да уведомиш редакцията за неточност или да поискаш корекция, използвай официалните ни канали за контакт.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Link to="/tipline" className="btn-hot inline-flex items-center gap-2 px-4 py-2 text-xs font-display font-black uppercase tracking-wider">
                      Подай сигнал
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                    <a
                      href={`mailto:${contact.email}?subject=${encodeURIComponent('Искане за корекция')}`}
                      className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-xs font-display font-black uppercase tracking-wider"
                    >
                      Поискай корекция
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-6 pt-6 border-t border-zn-border/60 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-xs text-zn-text-dim font-display uppercase tracking-wider font-bold">
              &copy; {new Date().getFullYear()} zNews — Горещи градски новини
            </p>
            <p className="text-[10px] text-zn-text-dim font-display uppercase tracking-[0.4em] font-black">
              ★ Всички съвпадения с реални лица са случайни ★
            </p>
          </div>
        </div>
      </div>


    </footer>
  );
}
