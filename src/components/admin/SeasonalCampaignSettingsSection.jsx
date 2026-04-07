const VARIANT_OPTIONS = [
  {
    value: 'classic',
    label: 'Класически (червено, лилаво, злато)',
    preview: ['egg-red', 'egg-purple', 'egg-gold'],
  },
  {
    value: 'police',
    label: 'Полицейски (синьо, червено, пукнато)',
    preview: ['egg-police', 'egg-red', 'egg-cracked'],
  },
  {
    value: 'underground',
    label: 'Подземен свят (тъмно, лилаво, пукнато)',
    preview: ['egg-underground', 'egg-purple', 'egg-cracked'],
  },
  {
    value: 'vip',
    label: 'VIP (луксозно, златно, червено)',
    preview: ['egg-vip', 'egg-gold', 'egg-red'],
  },
];

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export default function SeasonalCampaignSettingsSection({
  form,
  setForm,
  clearFeedback,
  listSectionCls,
  inputCls,
  tinyLabelCls,
}) {
  const easter = form.seasonalCampaigns?.easter || {};
  const previewSet = VARIANT_OPTIONS.find((option) => option.value === easter.variantSet) || VARIANT_OPTIONS[0];
  const canEditCampaign = Boolean(easter.enabled);
  const canEditManualWindow = canEditCampaign && !Boolean(easter.autoWindow);
  const canEditHunt = canEditCampaign && Boolean(easter.huntEnabled);

  const updateEaster = (patch) => {
    clearFeedback();
    setForm((prev) => ({
      ...prev,
      seasonalCampaigns: {
        ...prev.seasonalCampaigns,
        easter: {
          ...prev.seasonalCampaigns?.easter,
          ...patch,
        },
      },
    }));
  };

  return (
    <section className={listSectionCls}>
      <h2 className="font-sans font-semibold text-gray-900">Сезонни кампании — Великден</h2>

      <div className="space-y-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-sans">
          <input
            type="checkbox"
            checked={Boolean(easter.enabled)}
            onChange={(e) => updateEaster({ enabled: e.target.checked })}
            className="h-4 w-4 accent-zn-purple"
          />
          Включи великденски режим
        </label>

        <label className="flex cursor-pointer items-center gap-2 text-sm font-sans">
          <input
            type="checkbox"
            checked={Boolean(easter.decorationsEnabled)}
            disabled={!canEditCampaign}
            onChange={(e) => updateEaster({ decorationsEnabled: e.target.checked })}
            className="h-4 w-4 accent-zn-purple"
          />
          Покажи декорации (яйца + пастелни точки)
        </label>

        <label className="flex cursor-pointer items-center gap-2 text-sm font-sans">
          <input
            type="checkbox"
            checked={Boolean(easter.autoWindow)}
            disabled={!canEditCampaign}
            onChange={(e) => updateEaster({ autoWindow: e.target.checked })}
            className="h-4 w-4 accent-zn-purple"
          />
          Автоматичен период (14 дни преди до 2 дни след Великден)
        </label>

        {!easter.autoWindow && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={tinyLabelCls}>Начало</label>
              <input
                type="date"
                className={inputCls}
                value={easter.startAt ? String(easter.startAt).slice(0, 10) : ''}
                disabled={!canEditManualWindow}
                onChange={(e) => updateEaster({ startAt: e.target.value })}
              />
            </div>
            <div>
              <label className={tinyLabelCls}>Край</label>
              <input
                type="date"
                className={inputCls}
                value={easter.endAt ? String(easter.endAt).slice(0, 10) : ''}
                disabled={!canEditManualWindow}
                onChange={(e) => updateEaster({ endAt: e.target.value })}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={tinyLabelCls}>Комплект яйца</label>
            <select
              className={inputCls}
              value={easter.variantSet || 'classic'}
              disabled={!canEditCampaign}
              onChange={(e) => updateEaster({ variantSet: e.target.value })}
            >
              {VARIANT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={tinyLabelCls}>Макс. декоративни яйца</label>
            <input
              type="number"
              min="1"
              max="6"
              className={inputCls}
              value={easter.maxVisibleEggs ?? 2}
              disabled={!canEditCampaign}
              onChange={(e) => updateEaster({ maxVisibleEggs: clampInt(e.target.value, 2, 1, 6) })}
            />
          </div>
        </div>

        <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3">
          <p className={`${tinyLabelCls} mb-2`}>Preview</p>
          <div className="flex items-end gap-3">
            {previewSet.preview.map((variant) => (
              <div key={variant} className="rounded border border-gray-200 bg-white px-3 py-2">
                <img
                  src={`/easter/${variant}.svg`}
                  alt=""
                  aria-hidden="true"
                  className="h-12 w-9"
                />
              </div>
            ))}
          </div>
        </div>

        <hr className="border-gray-200" />

        <label className="flex cursor-pointer items-center gap-2 text-sm font-sans">
          <input
            type="checkbox"
            checked={Boolean(easter.huntEnabled)}
            disabled={!canEditCampaign}
            onChange={(e) => updateEaster({ huntEnabled: e.target.checked })}
            className="h-4 w-4 accent-zn-purple"
          />
          Включи лов на яйца
        </label>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={tinyLabelCls}>Брой активни яйца</label>
            <input
              type="number"
              min="3"
              max="12"
              className={inputCls}
              value={easter.huntEggCount ?? 6}
              disabled={!canEditHunt}
              onChange={(e) => updateEaster({ huntEggCount: clampInt(e.target.value, 6, 3, 12) })}
            />
          </div>
          <div>
            <label className={tinyLabelCls}>Версия на лова</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                className={inputCls}
                value={easter.huntVersion ?? 1}
                disabled={!canEditCampaign}
                onChange={(e) => updateEaster({ huntVersion: Math.max(1, clampInt(e.target.value, 1, 1, 9999)) })}
              />
              <button
                type="button"
                disabled={!canEditCampaign}
                onClick={() => updateEaster({ huntVersion: Math.max(1, Number(easter.huntVersion || 1) + 1) })}
                className="shrink-0 border border-[#1C1428] bg-white px-3 py-2 text-xs font-display font-black uppercase tracking-wider text-zn-text shadow-[3px_3px_0_#1C1428] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                Рестартирай лова
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className={tinyLabelCls}>Текст на наградата</label>
          <input
            type="text"
            className={inputCls}
            value={easter.huntRewardText ?? ''}
            disabled={!canEditHunt}
            onChange={(e) => updateEaster({ huntRewardText: e.target.value })}
            placeholder="Браво! Намери всички яйца!"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm font-sans">
          <input
            type="checkbox"
            checked={Boolean(easter.showProgress)}
            disabled={!canEditHunt}
            onChange={(e) => updateEaster({ showProgress: e.target.checked })}
            className="h-4 w-4 accent-zn-purple"
          />
          Показвай прогрес бадж в сайта
        </label>

        <p className="text-sm font-sans text-gray-500">
          Ловът пази прогреса само локално в браузъра и се нулира автоматично, ако вдигнеш версията на кампанията.
        </p>
      </div>
    </section>
  );
}
