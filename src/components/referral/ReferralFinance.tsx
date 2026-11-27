import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsDesktop } from '@/hooks/useIsDesktop';

/** The same interactive nodes keep the original mobile order and one desktop ledger. */
export default function ReferralFinance({
  withdrawalVisible,
  partnerVisible,
  balance,
  history,
  application,
}: {
  withdrawalVisible: boolean;
  partnerVisible: boolean;
  balance: ReactNode;
  history: ReactNode;
  application: ReactNode;
}) {
  const desktop = useIsDesktop();
  const { t } = useTranslation();
  if (!desktop) {
    return (
      <div className="xsg-referral-finance-mobile contents">
        {withdrawalVisible && (
          <div id="withdrawal-section" className="order-8 space-y-6">
            {balance}
            {history}
          </div>
        )}
        {application}
      </div>
    );
  }
  if (!withdrawalVisible && !partnerVisible) return null;
  return (
    <section className="xsg-referral-finance" aria-labelledby="referral-finance-heading">
      <h2 id="referral-finance-heading" className="xsg-referral-finance-heading">
        {t('referral.financialSection')}
      </h2>
      <div id={withdrawalVisible ? 'withdrawal-section' : undefined}>
        <div className="xsg-referral-finance-overview">
          {withdrawalVisible && balance}
          {partnerVisible && (
            <div className="xsg-referral-application">
              <p className="xsg-referral-application-label">
                {t('referral.financialPartnerLabel')}
              </p>
              {application}
            </div>
          )}
        </div>
        {withdrawalVisible && history}
      </div>
    </section>
  );
}
