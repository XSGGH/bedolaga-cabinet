import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TariffCardInfo } from '@/components/subscription/purchase/TariffCardInfo';
import {
  KNOWN_COUNTRIES,
  displayServerName,
  isMeteredServer,
  parseCardForm,
  serializeCardForm,
  setMetered,
  type TariffCardForm,
} from '@/components/subscription/purchase/tariffCardModel';
import type { Tariff } from '@/types';

interface TariffCardEditorProps {
  /** Описание тарифа — единственный источник правды: форма читает его и пишет обратно. */
  description: string;
  onChange: (description: string) => void;
  /** Остальные поля тарифа — нужны только для предпросмотра. */
  preview: {
    name: string;
    trafficLimitGb: number;
    deviceLimit: number;
    trafficResetMode: string | null;
  };
}

const STARTS_WITH_FLAG = /^\p{Regional_Indicator}{2}/u;

export function TariffCardEditor({ description, onChange, preview }: TariffCardEditorProps) {
  const { t } = useTranslation();
  // Локальная копия формы: пустые строки (только что добавленные) не живут в
  // описании, но должны оставаться на экране, пока их заполняют.
  const [form, setForm] = useState<TariffCardForm>(() => parseCardForm(description));

  // Описание изменили снаружи (тариф загрузился, правка в «Основном») — перечитываем.
  useEffect(() => {
    setForm((current) =>
      serializeCardForm(current) === description ? current : parseCardForm(description),
    );
  }, [description]);

  const update = (patch: Partial<TariffCardForm>) => {
    const next = { ...form, ...patch };
    setForm(next);
    onChange(serializeCardForm(next));
  };

  const setFeature = (index: number, patch: Partial<TariffCardForm['features'][number]>) =>
    update({
      features: form.features.map((feature, i) =>
        i === index ? { ...feature, ...patch } : feature,
      ),
    });

  const setLocation = (index: number, value: string) =>
    update({ locations: form.locations.map((line, i) => (i === index ? value : line)) });

  const hasLimit = preview.trafficLimitGb > 0;
  const hasMetered = form.locations.some(isMeteredServer);
  const withoutFlag = form.locations
    .filter((line) => !isMeteredServer(line))
    .filter((line) => !STARTS_WITH_FLAG.test(displayServerName(line)));

  const previewTariff = {
    name: preview.name || '…',
    description,
    traffic_limit_gb: preview.trafficLimitGb,
    traffic_limit_label:
      preview.trafficLimitGb > 0
        ? `${preview.trafficLimitGb} ${t('common.units.gb', 'ГБ')}`
        : t('subscription.unlimited', 'Безлимит'),
    is_unlimited_traffic: preview.trafficLimitGb === 0,
    device_limit: preview.deviceLimit,
    traffic_reset_mode: preview.trafficResetMode,
    servers: [],
  } as unknown as Tariff;

  const countriesLeft = KNOWN_COUNTRIES.filter(
    (country) => !form.locations.some((line) => line.includes(country.name)),
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <p className="text-sm text-dark-400">{t('admin.tariffs.cardEditor.intro')}</p>

        {/* Суть */}
        <div className="card space-y-2">
          <label htmlFor="tariff-card-tagline" className="block text-sm font-medium text-dark-300">
            {t('admin.tariffs.cardEditor.tagline')}
          </label>
          <input
            id="tariff-card-tagline"
            type="text"
            value={form.tagline}
            onChange={(e) => update({ tagline: e.target.value })}
            className="input"
            placeholder={t('admin.tariffs.cardEditor.taglinePlaceholder')}
          />
        </div>

        {/* Преимущества */}
        <div className="card space-y-3">
          <div className="text-sm font-medium text-dark-300">
            {t('admin.tariffs.cardEditor.features')}
          </div>
          {form.features.map((feature, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: строки без стабильного id, порядок меняется только удалением
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={feature.warn ? '⚠️' : feature.icon}
                disabled={feature.warn}
                onChange={(e) => setFeature(index, { icon: e.target.value })}
                aria-label={t('admin.tariffs.cardEditor.featureIcon')}
                className="input w-14 shrink-0 px-2 text-center"
              />
              <input
                type="text"
                value={feature.text}
                onChange={(e) => setFeature(index, { text: e.target.value })}
                aria-label={t('admin.tariffs.cardEditor.featureText')}
                placeholder={t('admin.tariffs.cardEditor.featureText')}
                className="input min-w-0 flex-1"
              />
              <button
                type="button"
                onClick={() => setFeature(index, { warn: !feature.warn })}
                aria-pressed={feature.warn}
                title={t('admin.tariffs.cardEditor.featureWarn')}
                className={`h-10 shrink-0 rounded-lg border px-3 text-sm transition-colors ${
                  feature.warn
                    ? 'border-warning-500/50 bg-warning-500/15 text-warning-400'
                    : 'border-dark-700 text-dark-400 hover:bg-dark-800'
                }`}
              >
                !
              </button>
              <button
                type="button"
                onClick={() => update({ features: form.features.filter((_, i) => i !== index) })}
                aria-label={t('admin.tariffs.cardEditor.remove')}
                className="h-10 shrink-0 rounded-lg px-3 text-dark-400 transition-colors hover:bg-dark-800 hover:text-error-400"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              update({ features: [...form.features, { icon: '', text: '', warn: false }] })
            }
            className="btn-secondary text-sm"
          >
            + {t('admin.tariffs.cardEditor.addFeature')}
          </button>
          <p className="text-xs text-dark-500">{t('admin.tariffs.cardEditor.featuresHint')}</p>
        </div>

        {/* Локации */}
        <div className="card space-y-3">
          <div className="text-sm font-medium text-dark-300">
            {t('admin.tariffs.cardEditor.locations')}
          </div>
          <p className="text-xs text-dark-500">{t('admin.tariffs.cardEditor.locationsHint')}</p>
          {form.locations.map((line, index) => {
            const metered = isMeteredServer(line);
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: строки без стабильного id, порядок меняется только удалением
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={line}
                  onChange={(e) => setLocation(index, e.target.value)}
                  className="input min-w-0 flex-1"
                />
                <button
                  type="button"
                  onClick={() => setLocation(index, setMetered(line, !metered))}
                  aria-pressed={metered}
                  title={t('admin.tariffs.cardEditor.metered')}
                  className={`h-10 shrink-0 rounded-lg border px-3 text-sm transition-colors ${
                    metered
                      ? 'border-accent-500/50 bg-accent-500/15 text-accent-300'
                      : 'border-dark-700 text-dark-500 hover:bg-dark-800'
                  }`}
                >
                  📡
                </button>
                <button
                  type="button"
                  onClick={() =>
                    update({ locations: form.locations.filter((_, i) => i !== index) })
                  }
                  aria-label={t('admin.tariffs.cardEditor.remove')}
                  className="h-10 shrink-0 rounded-lg px-3 text-dark-400 transition-colors hover:bg-dark-800 hover:text-error-400"
                >
                  ×
                </button>
              </div>
            );
          })}
          <div className="flex flex-wrap gap-2">
            <select
              value=""
              onChange={(e) => {
                const country = KNOWN_COUNTRIES.find((c) => c.name === e.target.value);
                if (country) {
                  update({ locations: [...form.locations, `${country.flag} ${country.name}`] });
                }
              }}
              aria-label={t('admin.tariffs.cardEditor.addCountry')}
              className="input w-auto text-sm"
            >
              <option value="">{t('admin.tariffs.cardEditor.addCountry')}</option>
              {countriesLeft.map((country) => (
                <option key={country.name} value={country.name}>
                  {country.flag} {country.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() =>
                update({
                  locations: [
                    ...form.locations,
                    `📡 ${t('admin.tariffs.cardEditor.meteredDefault')}`,
                  ],
                })
              }
              className="btn-secondary text-sm"
            >
              + {t('admin.tariffs.cardEditor.addMetered')}
            </button>
            <button
              type="button"
              onClick={() => update({ locations: [...form.locations, ''] })}
              className="btn-secondary text-sm"
            >
              + {t('admin.tariffs.cardEditor.addCustom')}
            </button>
          </div>
        </div>
      </div>

      {/* Предпросмотр и подсказки */}
      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <div className="text-sm font-medium text-dark-300">
          {t('admin.tariffs.cardEditor.preview')}
        </div>
        <div className="bento-card flex flex-col gap-5 p-5 sm:p-7">
          <TariffCardInfo tariff={previewTariff} isCurrent={false} hasMeteredElsewhere={false} />
        </div>

        <ul className="space-y-2 text-xs">
          {form.locations.length === 0 && (
            <li className="text-warning-400">{t('admin.tariffs.cardEditor.warnNoLocations')}</li>
          )}
          {hasLimit && !hasMetered && form.locations.length > 0 && (
            <li className="text-warning-400">{t('admin.tariffs.cardEditor.warnNoMetered')}</li>
          )}
          {withoutFlag.length > 0 && (
            <li className="text-warning-400">
              {t('admin.tariffs.cardEditor.warnNoFlag', { names: withoutFlag.join(', ') })}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
