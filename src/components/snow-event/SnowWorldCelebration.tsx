import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { SnowState } from '@/api/snowEvent';
import { StationSprite } from './SnowWorldScene';

export default function SnowWorldCelebration({ state }: { state: SnowState }) {
  const [open, setOpen] = useState<'station' | 'personal' | null>(null);
  const total = state.world?.total || 0;
  const complete = state.completed_days || 0;
  if (total < 1500 && complete < 31) return null;
  return (
    <section className="se-panel sw-celebration-entry">
      <StationSprite index={14} />
      <div>
        <p className="se-kicker">Этот праздник — наша общая история</p>
        <h2>{complete === 31 ? 'Весь декабрь вместе' : 'Мы зажгли зимнюю станцию'}</h2>
        <p>
          {complete === 31
            ? '31 приключение с котом. Спасибо, что был рядом каждый день.'
            : 'Первый большой рубеж достигнут. Впереди ещё много звёздных огней.'}
        </p>
        <div className="sw-inline-actions">
          {total >= 1500 && (
            <button type="button" className="se-secondary" onClick={() => setOpen('station')}>
              Большое включение огней
            </button>
          )}
          {complete === 31 && (
            <button type="button" className="se-secondary" onClick={() => setOpen('personal')}>
              Моя зимняя история
            </button>
          )}
        </div>
      </div>
      <Dialog.Root
        open={!!open}
        onOpenChange={(value) => {
          if (!value) setOpen(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="snow-event-overlay" />
          <Dialog.Content className="snow-purchase-dialog sw-ceremony">
            <Dialog.Close className="sw-close" aria-label="Закрыть церемонию">
              ×
            </Dialog.Close>
            <StationSprite index={open === 'station' ? 1 : 15} />
            <Dialog.Title>
              {open === 'station' ? 'Станция, которую построили мы' : 'Спасибо за весь декабрь 💜'}
            </Dialog.Title>
            <Dialog.Description>
              {open === 'station'
                ? 'По одному маленькому делу — и вот уже светятся окна, стоит большая ёлка, а кот встречает гостей. Каждый огонёк здесь — часть вашего общего тепла.'
                : 'От первых снежинок до новогодней ночи ты помогал коту создавать праздник. Все 31 задания выполнены. Твой подарок +5 дней ждёт в лавке кота, раздел «За приключения».'}
            </Dialog.Description>
            <dl className="sw-ceremony-stats">
              <div>
                <dt>Приключения</dt>
                <dd>{complete} / 31</dd>
              </div>
              <div>
                <dt>Личный вклад</dt>
                <dd>{state.progress.earned} ❄</dd>
              </div>
              <div>
                <dt>Мои украшения</dt>
                <dd>{state.world?.decorations.filter((d) => d.own).length || 0}</dd>
              </div>
              <div>
                <dt>Получено подарков</dt>
                <dd>{state.progress.receipts.length}</dd>
              </div>
            </dl>
            <p>
              {state.quazar?.earned
                ? 'Право на Квазар уже закреплено за аккаунтом навсегда. Текущая подписка сохранена.'
                : 'Даже маленький вклад делает нашу станцию теплее. Спасибо, что ты с нами.'}
            </p>
            <button type="button" className="se-button" onClick={() => setOpen(null)}>
              Вернуться на станцию
            </button>
            <p className="sw-fine-print">
              Церемонию можно закрыть и посмотреть снова. Награды повторно не начисляются.
            </p>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
