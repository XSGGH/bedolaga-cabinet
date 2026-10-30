import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { UseMutationResult } from '@tanstack/react-query';
import type { TrialInfo } from '../../types';
import { useCurrency } from '../../hooks/useCurrency';
import { useTheme } from '../../hooks/useTheme';
import { getGlassColors } from '../../utils/glassTheme';
import { Fragment } from 'react';
import { BoltIcon, CheckIcon, GiftIcon } from '@/components/icons';

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
  const metaText = [
    t('subscription.trial.days', { count: trialInfo.duration_days }),
    trialInfo.device_limit === 0
      ? t('dashboard.trialOffer.unlimitedDevices')
      : t('subscription.trial.devices', { count: trialInfo.device_limit }),
  ].join(' · ');

  return (
    <div
      className="relative overflow-hidden rounded-3xl text-left"
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
        padding: '22px 18px 18px',
      }}
    >
      <div className="mb-3.5 flex items-center justify-between gap-3">
        {isFree ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-400/30 bg-accent-500/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-accent-300">
            <GiftIcon className="h-3 w-3" />
            {t('dashboard.trialOffer.badge')}
          </span>
        ) : (
          <span />
        )}
        <span className="text-xs font-bold text-dark-300">{metaText}</span>
      </div>

      {/* Icon (платный триал) */}
      {!isFree && (
        <div
          className="relative mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{
            background: 'rgba(255,184,0,0.12)',
            border: '1px solid rgba(255,184,0,0.25)',
          }}
        >
          <span
            className="flex"
            style={{ color: 'rgb(var(--color-urgent-400))' }}
            aria-hidden="true"
          >
            <BoltIcon className="h-[26px] w-[26px]" />
          </span>
        </div>
      )}

      {/* Title */}
      <h2 className="mb-1.5 text-[22px] font-extrabold leading-tight tracking-tight text-dark-50">
        {isFree ? t('dashboard.trialOffer.freeTitle') : t('dashboard.trialOffer.paidTitle')}
      </h2>
      <p className="mb-5 text-[13px] leading-snug text-dark-400">
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

      {/* Что входит: лимит на белые списки и безлимит на остальное */}
      {(() => {
        const limited = trialInfo.traffic_limit_gb > 0;
        const cells = [
          limited && {
            key: 'limit',
            value: String(trialInfo.traffic_limit_gb),
            unit: t('common.units.gb'),
            title: t('dashboard.trialOffer.whitelistTitle'),
            hint: t('dashboard.trialOffer.whitelistHint'),
          },
          {
            key: 'unlimited',
            value: '∞',
            unit: '',
            title: t('dashboard.trialOffer.unlimitedTitle'),
            hint: t('dashboard.trialOffer.unlimitedHint'),
          },
        ].filter(Boolean) as {
          key: string;
          value: string;
          unit: string;
          title: string;
          hint: string;
        }[];
        return (
          <div
            className="mb-3.5 grid rounded-[20px] border border-accent-400/25 px-2 py-[18px]"
            style={{
              gridTemplateColumns: cells.length > 1 ? '1fr 1px 1fr' : '1fr',
              background:
                'linear-gradient(135deg, rgba(var(--color-accent-500), 0.18), rgba(236,72,153,0.08))',
            }}
          >
            {cells.map((cell, i) => (
              <Fragment key={cell.key}>
                {i > 0 && (
                  <div
                    aria-hidden="true"
                    style={{
                      background:
                        'linear-gradient(180deg, transparent, rgba(var(--color-accent-400), 0.4), transparent)',
                    }}
                  />
                )}
                <div className="px-1.5 text-center">
                  <div
                    className="text-[44px] font-extrabold leading-none tracking-tight"
                    style={{
                      background: 'linear-gradient(180deg, #fff, rgb(var(--color-accent-400)))',
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      color: 'transparent',
                    }}
                  >
                    {cell.value}
                    {cell.unit && (
                      <span
                        className="ml-1 text-base font-extrabold"
                        style={{ WebkitTextFillColor: 'rgb(var(--color-accent-400))' }}
                      >
                        {cell.unit}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-dark-50">
                    {cell.title}
                  </div>
                  <div className="mt-0.5 text-xs text-dark-400">{cell.hint}</div>
                </div>
              </Fragment>
            ))}
          </div>
        );
      })()}

      {/* Условия */}
      <div className="mb-4 flex justify-center gap-4 text-xs font-semibold text-dark-300">
        {[t('dashboard.trialOffer.checkNoCard'), t('dashboard.trialOffer.checkNoCommitment')].map(
          (text) => (
            <span key={text} className="inline-flex items-center gap-1.5">
              <CheckIcon className="h-3.5 w-3.5 text-accent-400" />
              {text}
            </span>
          ),
        )}
      </div>

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
