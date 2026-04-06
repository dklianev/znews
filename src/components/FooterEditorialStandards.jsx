import { Link } from 'react-router-dom';
import { ArrowRight, Megaphone, Shield } from 'lucide-react';

const LEGAL_BADGES = [
  'Свобода на изразяване',
  'Свобода на пресата',
  'Поверителност на източници',
  'Право на корекция',
];

export default function FooterEditorialStandards() {
  return (
    <div className="mt-8 newspaper-page comic-panel comic-dots relative overflow-visible">
      <div className="tape tape-tl" />
      <div className="tape tape-tr" />
      <div className="tape tape-bl" />
      <div className="tape tape-br" />

      <div className="p-5 md:p-6">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="headline-banner-navy inline-flex items-center gap-2 px-3 py-1 text-[10px]">
                <Shield className="h-3.5 w-3.5" />
                Редакционен стандарт
              </div>

              <h4 className="mt-3 font-display text-xl font-black uppercase leading-tight tracking-[0.12em] text-zn-text text-shadow-brutal md:text-2xl">
                Свобода на изразяване, отговорна редакция.
                <br />
                Защита на източници.
              </h4>

              <p className="mt-3 font-sans text-sm leading-relaxed text-zn-text-muted dark:text-gray-300 md:text-[15px]">
                Юридическият и редакционният стандарт на{' '}
                <span className="font-black text-zn-text dark:text-[#EDE4D0]">ZNEWS</span>{' '}
                стъпва върху реални принципи, а не върху кухи предупреждения.
                Затова тук заявяваме едновременно правата, на които се
                позоваваме, и отговорността, с която работим.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {LEGAL_BADGES.map((badge) => (
                <span
                  key={badge}
                  className="comic-chip whitespace-nowrap bg-white/90 text-zn-text dark:bg-[#2A2438] dark:text-[#EDE4D0]"
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.9fr]">
            <div className="comic-panel-white bg-white/80 p-4 dark:bg-[#201B2C] md:p-5">
              <div className="mb-3 flex items-center gap-2">
                <Megaphone className="h-4 w-4 shrink-0 text-zn-hot" />
                <h5 className="font-display text-sm font-black uppercase tracking-[0.14em] text-zn-text">
                  Редакционни принципи
                </h5>
              </div>

              <p className="font-sans text-[13px] leading-relaxed text-zn-text-muted dark:text-gray-300 md:text-sm">
                <span className="font-bold text-zn-text dark:text-[#EDE4D0]">ZNEWS</span>{' '}
                публикува журналистически и редакционни материали по теми от
                обществен интерес. Редакционната дейност се ръководи от
                принципите на свободата на изразяване и свободата на пресата,
                признати в чл. 19 от Всеобщата декларация за правата на човека,
                чл. 19 от Международния пакт за граждански и политически права и
                Първата поправка към Конституцията на САЩ.
              </p>
            </div>

            <div className="comic-panel-white bg-white/80 p-4 dark:bg-[#201B2C] md:p-5">
              <div className="mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4 shrink-0 text-zn-purple" />
                <h5 className="font-display text-sm font-black uppercase tracking-[0.14em] text-zn-text">
                  Поверителност и право на отговор
                </h5>
              </div>

              <p className="font-sans text-[13px] leading-relaxed text-zn-text-muted dark:text-gray-300 md:text-sm">
                Редакцията полага разумни мерки да защитава поверителността на
                източниците и редакционните комуникации в максималната степен,
                допустима от приложимото право. Сигнали за неточност, нарушение
                на права или незаконно съдържание се приемат за преглед,
                корекция и отговор по установения редакционен ред.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t-2 border-zn-border/60 pt-4 md:flex-row md:items-center md:justify-between">
            <p className="max-w-3xl font-sans text-xs leading-relaxed text-zn-text-muted dark:text-gray-300 md:text-[13px]">
              Ако искаш да подадеш сигнал, да уведомиш редакцията за неточност
              или да поискаш корекция, използвай официалните ни канали за
              контакт.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/tipline"
                className="btn-hot inline-flex items-center gap-2 px-4 py-2 text-xs font-display font-black uppercase tracking-wider"
              >
                Подай сигнал
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                to="/about#contact"
                className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-xs font-display font-black uppercase tracking-wider"
              >
                Поискай корекция
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
