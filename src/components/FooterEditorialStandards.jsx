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
                Свобода на словото. Отговорна редакция. Защита на източниците.
              </h4>
              <p className="mt-3 text-sm md:text-[15px] text-zn-text-muted dark:text-gray-300 font-sans leading-relaxed">
                Редакционната и журналистическа дейност на <span className="font-black text-zn-text dark:text-[#EDE4D0]">ZNEWS</span> следва правото на
                свобода на изразяване, а не език на сплашване. Работим със
                силна позиция в обществен интерес, но и с уважение към човека,
                репутацията и закона.
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
                <span className="font-bold text-zn-text dark:text-[#EDE4D0]">ZNEWS</span> публикува журналистически и редакционни материали по теми от обществен
                интерес. Редакционната работа се ръководи от принципите на свободата
                на изразяване и свободата на пресата, признати в чл.&nbsp;19 от
                Всеобщата декларация за правата на човека, чл.&nbsp;19 от
                Международния пакт за граждански и политически права и Първата поправка
                към Конституцията на САЩ.
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
                Редакцията полага разумни мерки да защитава поверителността на източниците
                и редакционните комуникации в максималната степен, допустима от
                приложимото право. Сигнали за неточност, нарушение на права или
                незаконно съдържание се разглеждат за преглед, корекция и реакция
                по установения редакционен ред.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t-2 border-zn-border/60 pt-4 md:flex-row md:items-center md:justify-between">
            <p className="text-xs md:text-[13px] text-zn-text-muted dark:text-gray-300 font-sans leading-relaxed max-w-3xl">
              При спор за факти, права или публикация редакцията разглежда всяко
              обосновано искане за корекция или право на отговор.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/tipline" className="btn-hot inline-flex items-center gap-2 px-4 py-2 text-xs font-display font-black uppercase tracking-wider">
                Подай сигнал
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/about#contact"
                className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-xs font-display font-black uppercase tracking-wider"
              >
                Поискай корекция
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
