import { BLOCK_BUST_THEMES } from '../../../utils/blockBust';

function FieldLabel({ title, body }) {
  return (
    <div className="mb-3">
      <p className="font-display text-sm font-black uppercase tracking-[0.2em] text-[#1c1428] dark:text-white">{title}</p>
      {body ? <p className="mt-1 text-sm text-[#5c5666] dark:text-zinc-400">{body}</p> : null}
    </div>
  );
}

function SelectChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border-[3px] px-3 py-2 font-display text-xs font-black uppercase tracking-[0.18em] transition-transform ${
        active
          ? 'border-[#1c1428] bg-zn-hot text-white shadow-[3px_3px_0_#1c1428]'
          : 'border-[#1c1428] bg-white text-[#1c1428] shadow-[3px_3px_0_rgba(28,20,40,0.14)]'
      }`}
    >
      {children}
    </button>
  );
}

export default function BlockBustSettings({ settings, onChange, onClose }) {
  const activeSettings = settings || {};

  function updateSetting(key, value) {
    onChange?.({ ...activeSettings, [key]: value });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-4 pb-4 pt-10 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border-[4px] border-[#1c1428] bg-[#f8f3ea] shadow-[8px_8px_0_#1c1428] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-none">
        <div className="border-b-[3px] border-[#1c1428] bg-gradient-to-r from-zn-hot via-zn-orange to-zn-gold px-6 py-5 text-white dark:border-zinc-700">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-display text-xs uppercase tracking-[0.32em] text-white/80">Настройки</p>
              <h2 className="mt-2 font-display text-3xl font-black uppercase tracking-wide">Контрол на ръна</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border-[3px] border-white/80 bg-white/10 px-4 py-2 font-display text-xs font-black uppercase tracking-[0.24em] text-white"
            >
              Затвори
            </button>
          </div>
        </div>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-2">
          <section className="rounded-[1.6rem] border-[3px] border-[#1c1428] bg-white px-4 py-4 shadow-[4px_4px_0_rgba(28,20,40,0.12)] dark:border-zinc-700 dark:bg-zinc-950 dark:shadow-none">
            <FieldLabel title="Управление" body="Избери дали фигурите да се местят с влачене или само с докосване." />
            <div className="flex flex-wrap gap-2">
              <SelectChip active={activeSettings.controlMode === 'drag-tap'} onClick={() => updateSetting('controlMode', 'drag-tap')}>Влачи + докосни</SelectChip>
              <SelectChip active={activeSettings.controlMode === 'tap'} onClick={() => updateSetting('controlMode', 'tap')}>Само докосни</SelectChip>
            </div>

            <div className="mt-5">
              <FieldLabel title="Подсветка за поставяне" body="Показва ghost preview върху валидните клетки, преди да пуснеш фигурата." />
              <div className="flex flex-wrap gap-2">
                <SelectChip active={activeSettings.showPlacementPreview} onClick={() => updateSetting('showPlacementPreview', true)}>Включена</SelectChip>
                <SelectChip active={!activeSettings.showPlacementPreview} onClick={() => updateSetting('showPlacementPreview', false)}>Скрита</SelectChip>
              </div>
            </div>

            <div className="mt-5">
              <FieldLabel title="Левичарски режим" body="Разменя страничните панели около полето, за да е по-удобно на телефон и таблет." />
              <div className="flex flex-wrap gap-2">
                <SelectChip active={activeSettings.leftHanded} onClick={() => updateSetting('leftHanded', true)}>Лява ръка</SelectChip>
                <SelectChip active={!activeSettings.leftHanded} onClick={() => updateSetting('leftHanded', false)}>Стандартно</SelectChip>
              </div>
            </div>
          </section>

          <section className="rounded-[1.6rem] border-[3px] border-[#1c1428] bg-white px-4 py-4 shadow-[4px_4px_0_rgba(28,20,40,0.12)] dark:border-zinc-700 dark:bg-zinc-950 dark:shadow-none">
            <FieldLabel title="Анимации" body="По-лекият режим пази feedback-а стегнат, без резки движения и излишен шум." />
            <div className="flex flex-wrap gap-2">
              <SelectChip active={activeSettings.animationLevel === 'normal'} onClick={() => updateSetting('animationLevel', 'normal')}>Нормални</SelectChip>
              <SelectChip active={activeSettings.animationLevel === 'reduced'} onClick={() => updateSetting('animationLevel', 'reduced')}>Намалени</SelectChip>
            </div>

            <div className="mt-5">
              <FieldLabel title="Контраст на grid-а" body="Подсилва линиите, фокуса и ghost preview-то вътре в самото поле." />
              <div className="flex flex-wrap gap-2">
                <SelectChip active={activeSettings.gridContrast === 'normal'} onClick={() => updateSetting('gridContrast', 'normal')}>Нормален</SelectChip>
                <SelectChip active={activeSettings.gridContrast === 'high'} onClick={() => updateSetting('gridContrast', 'high')}>Висок</SelectChip>
              </div>
            </div>
          </section>

          <section className="rounded-[1.6rem] border-[3px] border-[#1c1428] bg-white px-4 py-4 shadow-[4px_4px_0_rgba(28,20,40,0.12)] dark:border-zinc-700 dark:bg-zinc-950 dark:shadow-none">
            <FieldLabel title="Звук" body="Пуска кратки synth сигнали при избор, поставяне, изчистване и пълно зануляване." />
            <div className="flex flex-wrap gap-2">
              <SelectChip active={activeSettings.soundEnabled} onClick={() => updateSetting('soundEnabled', true)}>Включен</SelectChip>
              <SelectChip active={!activeSettings.soundEnabled} onClick={() => updateSetting('soundEnabled', false)}>Изключен</SelectChip>
            </div>

            <div className="mt-5">
              <FieldLabel title="Шарка за контраст" body="Добавя фина текстура върху фигурите за по-ясно разделяне на theme-ите." />
              <div className="flex flex-wrap gap-2">
                <SelectChip active={activeSettings.patternAssist} onClick={() => updateSetting('patternAssist', true)}>Показвай</SelectChip>
                <SelectChip active={!activeSettings.patternAssist} onClick={() => updateSetting('patternAssist', false)}>Скрий</SelectChip>
              </div>
            </div>

            <div className="mt-5">
              <FieldLabel title="Потвърждение при рестарт" body="Спира случайното зануляване на силен рън, ако натиснеш бутона твърде бързо." />
              <div className="flex flex-wrap gap-2">
                <SelectChip active={activeSettings.confirmRestart} onClick={() => updateSetting('confirmRestart', true)}>Да</SelectChip>
                <SelectChip active={!activeSettings.confirmRestart} onClick={() => updateSetting('confirmRestart', false)}>Не</SelectChip>
              </div>
            </div>
          </section>

          <section className="rounded-[1.6rem] border-[3px] border-[#1c1428] bg-white px-4 py-4 shadow-[4px_4px_0_rgba(28,20,40,0.12)] dark:border-zinc-700 dark:bg-zinc-950 dark:shadow-none">
            <FieldLabel title="Смяна на тема" body="Избери дали темата да се сменя автоматично при пълно изчистване, или да я заключиш ръчно." />
            <div className="flex flex-wrap gap-2">
              <SelectChip active={activeSettings.themeMode === 'auto'} onClick={() => updateSetting('themeMode', 'auto')}>Автоматична</SelectChip>
              <SelectChip active={activeSettings.themeMode === 'manual'} onClick={() => updateSetting('themeMode', 'manual')}>Ръчна</SelectChip>
            </div>
            {activeSettings.themeMode === 'manual' && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {BLOCK_BUST_THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => updateSetting('manualThemeId', t.id)}
                    className={`rounded-[0.8rem] border-[3px] px-3 py-2 text-left font-display text-xs font-black uppercase tracking-[0.18em] transition-transform ${
                      activeSettings.manualThemeId === t.id
                        ? 'translate-y-[-2px] text-white'
                        : 'border-[#1c1428] bg-white text-[#1c1428] shadow-[3px_3px_0_rgba(28,20,40,0.14)]'
                    }`}
                    style={activeSettings.manualThemeId === t.id ? {
                      borderColor: t.accent,
                      background: `linear-gradient(135deg, ${t.ribbonFrom} 0%, ${t.ribbonTo} 100%)`,
                      boxShadow: `3px 3px 0 ${t.accent}`,
                    } : undefined}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
