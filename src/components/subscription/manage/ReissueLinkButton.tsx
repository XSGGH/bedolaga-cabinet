import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { subscriptionApi } from '@/api/subscription';
import { ArrowPathIcon } from '@/components/icons';
import { useHaptic } from '@/platform';
import { useDestructiveConfirm } from '@/platform/hooks/useNativeDialog';
import type { Subscription } from '@/types';
import { safeLocal } from '@/utils/safeStorage';
import { getErrorMessage } from '@/utils/subscriptionHelpers';

/** Пауза между перевыпусками, секунды. Ограничение панели, не наше. */
const REVOKE_COOLDOWN_SECONDS = 900;

/**
 * Есть ли что перевыпускать.
 *
 * Экспортируется отдельно, потому что вызывающий экран рисует вокруг кнопки
 * свою подложку: без этой проверки у пробной подписки оставалась бы пустая
 * карточка от блока, которого нет.
 */
export function canReissueLink(
  subscription: Pick<Subscription, 'is_active' | 'is_limited' | 'is_trial'>,
): boolean {
  return (subscription.is_active || subscription.is_limited) && !subscription.is_trial;
}

export interface ReissueLinkButtonProps {
  subscription: Subscription;
  subscriptionId: number | undefined;
  /** Компактная кнопка в одном ряду с «Продлить» и «Сменить тариф». */
  inline?: boolean;
}

/**
 * Перевыпуск ссылки подписки.
 *
 * Вынесен из тела страницы подписки, чтобы им мог пользоваться простой вид.
 * Действие разрушительное: панель сбрасывает привязки устройств, поэтому
 * подтверждение и пауза в 15 минут — часть компонента, а не вызывающего
 * экрана. Отсчёт паузы переживает перезагрузку: метка времени лежит в
 * хранилище, иначе человек обходил бы ограничение обновлением страницы.
 *
 * Возвращает null там, где перевыпускать нечего: у пробных и у неактивных.
 */
export function ReissueLinkButton({
  subscription,
  subscriptionId,
  inline = false,
}: ReissueLinkButtonProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const haptic = useHaptic();
  const destructiveConfirm = useDestructiveConfirm();
  const storageKey = `revoke_ts_${subscriptionId ?? 'default'}`;

  const [cooldown, setCooldown] = useState(() => {
    const last = Number(safeLocal.getItem(storageKey) || '0');
    if (!last) return 0;
    const passed = Math.floor((Date.now() - last) / 1000);
    return Math.max(0, REVOKE_COOLDOWN_SECONDS - passed);
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const revokeMutation = useMutation({
    mutationFn: () => subscriptionApi.revokeSubscription(subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['connection-link', subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      // Remnawave resets device HWIDs on revoke — make sure the cabinet
      // re-reads the now-empty device list instead of showing the stale cache.
      queryClient.invalidateQueries({ queryKey: ['devices', subscriptionId] });
      haptic.notification('success');
      safeLocal.setItem(storageKey, Date.now().toString());
      setCooldown(REVOKE_COOLDOWN_SECONDS);
    },
    onError: () => {
      haptic.notification('error');
    },
  });

  const handleRevoke = async () => {
    const confirmed = await destructiveConfirm(
      t('subscription.revoke.warning'),
      t('subscription.revoke.confirmBtn'),
      t('subscription.revoke.title'),
    );
    if (!confirmed) return;
    revokeMutation.mutate();
  };

  if (!canReissueLink(subscription)) return null;

  if (inline) {
    return (
      <>
        <button
          type="button"
          onClick={handleRevoke}
          disabled={revokeMutation.isPending || cooldown > 0}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-[14px] border border-warning-500/50 bg-gradient-to-r from-warning-500/20 to-orange-500/10 px-3 text-[14px] font-bold text-warning-300 transition-colors hover:border-warning-400 hover:from-warning-500/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {revokeMutation.isPending ? (
            <div className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-warning-400/30 border-t-warning-400" />
          ) : (
            <ArrowPathIcon className="h-[18px] w-[18px]" />
          )}
          {cooldown > 0
            ? t('subscription.revoke.cooldown', {
                minutes: Math.floor(cooldown / 60),
                seconds: cooldown % 60,
              })
            : t('subscription.revoke.button')}
        </button>
        {revokeMutation.error && (
          <p className="mt-2 text-sm text-error-400">{getErrorMessage(revokeMutation.error)}</p>
        )}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleRevoke}
        disabled={revokeMutation.isPending || cooldown > 0}
        className="w-full min-h-[72px] rounded-[20px] border border-[#7a5a12] bg-[#241a08] px-5 py-4 text-left transition-colors hover:border-warning-400 disabled:opacity-50"
      >
        <div className="flex items-center gap-3.5">
          <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-[#3a2a0a] text-warning-400">
            {revokeMutation.isPending ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-warning-400/30 border-t-warning-400" />
            ) : (
              <ArrowPathIcon className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15.5px] font-bold text-warning-400">
              {t('subscription.revoke.button')}
            </div>
            <div className="mt-0.5 text-[12.5px] leading-snug text-[#d8c58a]">
              {cooldown > 0
                ? t('subscription.revoke.cooldown', {
                    minutes: Math.floor(cooldown / 60),
                    seconds: cooldown % 60,
                  })
                : t('subscription.revoke.description')}
            </div>
          </div>
          <span className="text-[22px] leading-none text-warning-400" aria-hidden="true">
            ›
          </span>
        </div>
      </button>
      {revokeMutation.error && (
        <p className="mt-2 text-sm text-error-400">{getErrorMessage(revokeMutation.error)}</p>
      )}
    </>
  );
}

export default ReissueLinkButton;
