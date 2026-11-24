import type { Transaction } from '@/types';
import { transactionTypeLabelKey } from './transactionType';

/** Presentation only: retain the original transaction type, description and amounts. */
export function transactionPresentation(tx: Transaction) {
  const description = tx.description?.replace(/^Смена тарифа\s+\(массовое действие\)\s+на\s+/iu, 'Смена тарифа на ') ?? null;
  const type = tx.type?.toUpperCase?.() ?? '';
  const wheelReward = type === 'DEPOSIT' && tx.amount_kopeks > 0 && /^Выигрыш в колесе удачи:/iu.test(tx.description ?? '');
  const freeTariffChange = type === 'SUBSCRIPTION_PAYMENT' && tx.amount_kopeks === 0 && /^Смена тарифа\s+(?:\(массовое действие\)\s+)?на\s+/iu.test(tx.description ?? '');
  return {
    labelKey: wheelReward ? 'balance.wheelReward' : freeTariffChange ? 'balance.tariffChange' : transactionTypeLabelKey(tx.type),
    description,
  };
}
