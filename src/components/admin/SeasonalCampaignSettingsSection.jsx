export default function SeasonalCampaignSettingsSection({
  form,
  setForm,
  clearFeedback,
  listSectionCls,
  inputCls,
  tinyLabelCls,
}) {
  const easter = form.seasonalCampaigns?.easter || {};

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
            disabled={!easter.enabled}
            onChange={(e) => updateEaster({ decorationsEnabled: e.target.checked })}
            className="h-4 w-4 accent-zn-purple"
          />
          Покажи декорации (яйца + пастелни точки)
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-sans">
          <input
            type="checkbox"
            checked={Boolean(easter.autoWindow)}
            disabled={!easter.enabled}
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
                disabled={!easter.enabled}
                onChange={(e) => updateEaster({ startAt: e.target.value })}
              />
            </div>
            <div>
              <label className={tinyLabelCls}>Край</label>
              <input
                type="date"
                className={inputCls}
                value={easter.endAt ? String(easter.endAt).slice(0, 10) : ''}
                disabled={!easter.enabled}
                onChange={(e) => updateEaster({ endAt: e.target.value })}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={tinyLabelCls}>Комплект яйца</label>
            <select
              className={inputCls}
              value={easter.variantSet || 'classic'}
              disabled={!easter.enabled}
              onChange={(e) => updateEaster({ variantSet: e.target.value })}
            >
              <option value="classic">Класически (червено, лилаво, злато)</option>
              <option value="police">Полиция (синьо, червено, счупено)</option>
              <option value="underground">Подземен свят (тъмно, лилаво, счупено)</option>
              <option value="vip">VIP (VIP, злато, червено)</option>
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
              disabled={!easter.enabled}
              onChange={(e) => {
                const value = Number.parseInt(e.target.value, 10);
                updateEaster({ maxVisibleEggs: Number.isNaN(value) ? 2 : value });
              }}
            />
          </div>
        </div>

        <hr className="border-gray-200" />
        <p className="text-sm font-sans text-gray-500">
          Ловът на яйца остава за отделен втори етап, след като довършим интерактивния режим и тестовото покритие.
        </p>
      </div>
    </section>
  );
}
