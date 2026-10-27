import { useTranslation } from 'react-i18next';
import { PiLightning, PiMonitor } from 'react-icons/pi';
import { GiftIcon, ShieldIcon } from '@/components/icons';

/**
 * Левая половина страницы входа на широких экранах: приветствие, преимущества
 * и локации. На телефоне и планшете не показывается — там вход идёт сразу.
 */

const FEATURES = [
  { key: 'whitelist', Icon: ShieldIcon },
  { key: 'quick', Icon: PiLightning },
  { key: 'devices', Icon: PiMonitor },
  { key: 'bonus', Icon: GiftIcon },
] as const;

export function LoginHero({ appName }: { appName: string }) {
  const { t } = useTranslation();
  const countries = t('auth.hero.countries').split('|').filter(Boolean);

  return (
    <div className="relative hidden flex-col justify-between overflow-hidden py-14 pl-16 xl:pl-24 lg:flex">
      <div className="text-xl font-extrabold tracking-wide text-dark-50">{appName}</div>

      <div className="relative z-10 max-w-[560px]">
        <h1 className="text-[52px] font-extrabold leading-[1.05] tracking-tight text-dark-50">
          {t('auth.hero.welcome')}
          <br />
          <span className="bg-gradient-to-r from-accent-300 to-pink-500 bg-clip-text text-transparent">
            {appName}
          </span>
        </h1>
        <p className="mt-5 max-w-[470px] text-lg leading-relaxed text-dark-300">
          {t('auth.hero.subtitle')}
        </p>

        <ul className="mt-9 max-w-[430px] space-y-5">
          {FEATURES.map(({ key, Icon }) => (
            <li key={key} className="flex items-start gap-4">
              <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl border border-accent-500/30 bg-accent-500/10 text-accent-300">
                <Icon className="h-[22px] w-[22px]" />
              </span>
              <div>
                <div className="text-[17px] font-bold text-dark-50">
                  {t(`auth.hero.features.${key}.title`)}
                </div>
                <div className="mt-0.5 text-sm leading-relaxed text-dark-400">
                  {t(`auth.hero.features.${key}.text`)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <ul className="relative z-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-dark-300">
        {countries.map((country) => (
          <li key={country}>{country}</li>
        ))}
      </ul>

      <img
        src="/login-cat.webp"
        alt=""
        aria-hidden="true"
        width={320}
        height={320}
        className="pointer-events-none absolute bottom-14 right-0 w-[320px] max-w-[38%] select-none [mask-image:linear-gradient(to_bottom,#000_78%,transparent_100%)]"
      />
    </div>
  );
}
