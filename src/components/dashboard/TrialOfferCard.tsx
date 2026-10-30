import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { UseMutationResult } from '@tanstack/react-query';
import type { TrialInfo } from '../../types';
import { useCurrency } from '../../hooks/useCurrency';
import { useTheme } from '../../hooks/useTheme';
import { getGlassColors } from '../../utils/glassTheme';
import { BoltIcon, CheckIcon, GiftIcon, SparklesIcon } from '@/components/icons';

interface TrialOfferCardProps {
  trialInfo: TrialInfo;
  balanceKopeks: number;
  balanceRubles: number;
  activateTrialMutation: UseMutationResult<unknown, unknown, void, unknown>;
  trialError: string | null;
}

export default function TrialOfferCard({
  trialInfo,
  balanceKopeks,
  balanceRubles,
  activateTrialMutation,
  trialError,
}: TrialOfferCardProps) {
  const { t } = useTranslation();
  const { formatAmount, currencySymbol } = useCurrency();
  const { isDark } = useTheme();
  const g = getGlassColors(isDark);
  const isFree = !trialInfo.requires_payment;
  const canAfford = balanceKopeks >= trialInfo.price_kopeks;

  return (
    <div
      className="relative overflow-hidden rounded-3xl text-center"
      style={{
        background: isFree
          ? `radial-gradient(120% 70% at 50% 0%, rgba(var(--color-accent-500), 0.22), transparent 62%), linear-gradient(180deg, rgba(var(--color-accent-500), 0.07), transparent 55%), ${g.cardBg}`
          : g.cardBg,
        border: isDark
          ? isFree
            ? '1px solid rgba(var(--color-accent-400), 0.32)'
            : `1px solid ${g.cardBorder}`
          : isFree
            ? '1px solid rgba(var(--color-accent-400), 0.2)'
            : '1px solid rgba(255,184,0,0.2)',
        boxShadow: isDark
          ? g.shadow
          : isFree
            ? '0 2px 16px rgba(var(--color-accent-400), 0.12), 0 0 0 1px rgba(var(--color-accent-400), 0.06)'
            : '0 2px 16px rgba(255,184,0,0.12), 0 0 0 1px rgba(255,184,0,0.06)',
        padding: '32px 28px 28px',
      }}
    >
      {isFree && (
        <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-accent-400/30 bg-accent-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-accent-300">
          <GiftIcon className="h-3.5 w-3.5" />
          {t('dashboard.trialOffer.badge')}
        </span>
      )}

      {/* Icon */}
      <div
        className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{
          background: isFree ? 'rgba(var(--color-accent-500), 0.14)' : 'rgba(255,184,0,0.12)',
          border: isFree
            ? '1px solid rgba(var(--color-accent-400), 0.25)'
            : '1px solid rgba(255,184,0,0.25)',
          transition: 'all 0.5s ease',
        }}
      >
        {isFree ? (
          <span
            className="flex"
            style={{ color: 'rgb(var(--color-accent-400))' }}
            aria-hidden="true"
          >
            <SparklesIcon className="h-[26px] w-[26px]" />
          </span>
        ) : (
          <span
            className="flex"
            style={{ color: 'rgb(var(--color-urgent-400))' }}
            aria-hidden="true"
          >
            <BoltIcon className="h-[26px] w-[26px]" />
          </span>
        )}
      </div>

      {/* Title */}
      <h2 className="mb-1.5 text-[22px] font-bold tracking-tight text-dark-50">
        {isFree ? t('dashboard.trialOffer.freeTitle') : t('dashboard.trialOffer.paidTitle')}
      </h2>
      <p className="mb-5 text-sm text-dark-400">
        {isFree ? t('dashboard.trialOffer.freeDesc') : t('dashboard.trialOffer.paidDesc')}
      </p>

      {/* Price tag for paid trial */}
      {!isFree && trialInfo.price_rubles > 0 && (
        <div
          className="mb-5 inline-flex items-baseline gap-1 rounded-xl px-5 py-2"
          style={{
            background: 'rgba(255,184,0,0.08)',
            border: '1px solid rgba(255,184,0,0.15)',
          }}
        >
          <span
            className="text-[32px] font-extrabold leading-none tracking-tight"
            style={{ color: 'rgb(var(--color-urgent-400))' }}
          >
            {trialInfo.price_rubles.toFixed(0)}
          </span>
          <span
            className="text-base font-semibold opacity-70"
            style={{ color: 'rgb(var(--color-urgent-400))' }}
          >
            {currencySymbol}
          </span>
        </div>
      )}

      {/* Trial stats */}
      <div className="mb-5 grid grid-cols-3 divide-x divide-accent-500/15 rounded-2xl border border-accent-500/15 bg-black/10 py-3.5">
        {[
          { value: String(trialInfo.duration_days), label: t('subscription.trial.days') },
          {
            value: trialInfo.traffic_limit_gb === 0 ? '∞' : String(trialInfo.traffic_limit_gb),
            label: t('common.units.gb'),
          },
          {
            value: trialInfo.device_limit === 0 ? '∞' : String(trialInfo.device_limit),
            label: t('subscription.trial.devices'),
          },
        ].map((stat, i) => (
          <div key={i} className="text-center">
            <div className="text-3xl font-extrabold leading-none tracking-tight text-dark-50">
              {stat.value}
            </div>
            <div className="mt-1.5 text-xs font-medium text-dark-400">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Benefits */}
      <ul className="mb-6 space-y-2.5 text-left">
        {[
          t('dashboard.trialOffer.benefitWifi'),
          t('dashboard.trialOffer.benefitWhitelist'),
          t('dashboard.trialOffer.benefitNoCard'),
          t('dashboard.trialOffer.benefitPlatforms'),
        ].map((text) => (
          <li key={text} className="flex items-center gap-3 text-sm text-dark-200">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-accent-400/30 bg-accent-500/15 text-accent-300">
              <CheckIcon className="h-3 w-3" />
            </span>
            {text}
          </li>
        ))}
      </ul>

      {/* Balance info for paid trial */}
      {!isFree && trialInfo.price_rubles > 0 && (
        <div
          className="mb-4 space-y-2 rounded-xl p-4 text-left"
          style={{ background: g.innerBg, border: `1px solid ${g.innerBorder}` }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-dark-400">{t('balance.currentBalance')}</span>
            <span
              className={`font-display text-sm font-semibold ${canAfford ? 'text-success-400' : 'text-warning-400'}`}
            >
              {formatAmount(balanceRubles)}
              {'\u00A0'}
              {currencySymbol}
            </span>
          </div>
          {!canAfford && (
            <div className="text-xs text-warning-400">
              {t('subscription.trial.insufficientBalance')}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {trialError && (
        <div className="mb-4 rounded-xl border border-error-500/30 bg-error-500/10 p-3 text-center text-sm text-error-400">
          {trialError}
        </div>
      )}

      {/* CTA Button */}
      {!isFree && trialInfo.price_kopeks > 0 ? (
        canAfford ? (
          <button
            onClick={() => !activateTrialMutation.isPending && activateTrialMutation.mutate()}
            disabled={activateTrialMutation.isPending}
            className="trial-cta w-full rounded-[14px] py-4 text-base font-bold tracking-tight text-white disabled:opacity-50"
          >
            {activateTrialMutation.isPending
              ? t('common.loading')
              : t('subscription.trial.payAndActivate')}
          </button>
        ) : (
          <Link
            to="/balance"
            className="trial-cta block w-full rounded-[14px] py-4 text-center text-base font-bold tracking-tight text-white"
          >
            {t('subscription.trial.topUpToActivate')}
          </Link>
        )
      ) : (
        <button
          onClick={() => !activateTrialMutation.isPending && activateTrialMutation.mutate()}
          disabled={activateTrialMutation.isPending}
          className="trial-cta w-full rounded-[14px] py-4 text-base font-bold tracking-tight text-white disabled:opacity-50"
        >
          {activateTrialMutation.isPending ? t('common.loading') : t('subscription.trial.activate')}
        </button>
      )}
    </div>
  );
}
