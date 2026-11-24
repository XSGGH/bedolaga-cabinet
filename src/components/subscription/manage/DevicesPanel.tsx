import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { subscriptionApi } from '@/api/subscription';
import { MonitorIcon, DevicesIcon, PencilIcon, PhoneIcon, TrashIcon } from '@/components/icons';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';
import { DEVICE_ALIAS_MAX_LENGTH } from '@/constants/devices';
import { useHaptic } from '@/platform';
import { useDestructiveConfirm } from '@/platform/hooks/useNativeDialog';
import type { Subscription } from '@/types';
import { devicePresentation, duplicateDeviceSuffix } from '@/utils/devicePresentation';
import { PiDeviceTablet } from 'react-icons/pi';

export interface DevicesPanelProps {
  subscription: Subscription;
  subscriptionId: number | undefined;
  /** Заголовок уже есть снаружи (сворачиваемая шапка) — не дублируем. */
  hideTitle?: boolean;
}

/**
 * Список подключённых устройств: переименование, удаление по одному и все сразу.
 *
 * Вынесен из тела страницы подписки, чтобы им мог пользоваться простой вид.
 * Запрос устройств живёт здесь же и делит ключ ['devices', id] с остальными
 * экранами, так что показ списка не стоит лишнего похода в сеть.
 *
 * Одновременно редактируется одно устройство: `editingDeviceHwid` служит и
 * переключателем, и признаком того, какая строка сейчас правится.
 */
export function DevicesPanel({
  subscription,
  subscriptionId,
  hideTitle = false,
}: DevicesPanelProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const haptic = useHaptic();
  const destructiveConfirm = useDestructiveConfirm();

  const {
    data: devicesData,
    isLoading: devicesLoading,
    isError: devicesError,
  } = useQuery({
    queryKey: ['devices', subscriptionId],
    queryFn: () => subscriptionApi.getDevices(subscriptionId),
    enabled: Boolean(subscription),
  });

  const deleteDeviceMutation = useMutation({
    mutationFn: (hwid: string) => subscriptionApi.deleteDevice(hwid, subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices', subscriptionId] });
    },
  });

  const deleteAllDevicesMutation = useMutation({
    mutationFn: () => subscriptionApi.deleteAllDevices(subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices', subscriptionId] });
    },
  });

  const [editingDeviceHwid, setEditingDeviceHwid] = useState<string | null>(null);
  const [editingDeviceName, setEditingDeviceName] = useState('');

  const renameDeviceMutation = useMutation({
    mutationFn: ({ hwid, name }: { hwid: string; name: string | null }) =>
      subscriptionApi.renameDevice(hwid, name, subscriptionId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['devices', subscriptionId] });
      // Soft success-tap, like other mutations on this page.
      haptic.notification('success');
      // Не сбрасываем edit-state, если пользователь уже перешёл на другой
      // девайс пока шёл запрос — иначе теряем его новый input. Имя не чистим
      // безусловно: оно либо принадлежит уже другому девайсу (нужно сохранить),
      // либо инпут уже закрылся (значение не отображается).
      setEditingDeviceHwid((current) => (current === variables.hwid ? null : current));
    },
    onError: () => {
      haptic.notification('error');
    },
  });

  const busy =
    deleteDeviceMutation.isPending ||
    deleteAllDevicesMutation.isPending ||
    renameDeviceMutation.isPending;
  const actionClass =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-dark-300 hover:bg-dark-700/40 hover:text-dark-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 disabled:opacity-50';
  return (
    <div>
      {!hideTitle && (
        <h2 className="mb-2 text-base font-semibold text-dark-100">
          {t('subscription.myDevices')}
        </h2>
      )}
      {devicesLoading ? (
        <SkeletonGroup className="space-y-3">
          <Skeleton variant="card" count={3} className="h-16" />
        </SkeletonGroup>
      ) : devicesError ? (
        <p role="status" className="py-3 text-sm text-warning-400">
          {t(
            'subscription.devicesUi.loadError',
            'Не удалось загрузить устройства. Попробуйте позже.',
          )}
        </p>
      ) : devicesData?.devices.length ? (
        <>
          {!hideTitle && (
            <p className="mb-2 text-xs text-dark-300">
              {devicesData.device_limit === 0
                ? t('dashboard.devicesConnectedUnlimited', { used: devicesData.total })
                : t('dashboard.ui.connectedDevices', {
                    defaultValue: 'Подключено {{used}} из {{max}} устройств',
                    used: devicesData.total,
                    max: devicesData.device_limit,
                  })}
            </p>
          )}
          <div className="divide-y divide-[var(--xsg-line)]">
            {devicesData.devices.map((device) => {
              const info = devicePresentation(device);
              const suffix = duplicateDeviceSuffix(device, devicesData.devices);
              const managementName = suffix ? `${info.name} (${suffix})` : info.name;
              const Icon =
                info.kind === 'computer'
                  ? MonitorIcon
                  : info.kind === 'tablet'
                    ? PiDeviceTablet
                    : info.kind === 'phone'
                      ? PhoneIcon
                      : DevicesIcon;
              const editing = editingDeviceHwid === device.hwid;
              const save = () => {
                if (!renameDeviceMutation.isPending)
                  renameDeviceMutation.mutate({
                    hwid: device.hwid,
                    name: editingDeviceName.trim() || null,
                  });
              };
              return (
                <div key={device.hwid} className="py-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-500/10 text-accent-300">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold leading-snug text-dark-100 [overflow-wrap:anywhere]">
                        {info.name}
                      </p>
                      {(suffix ||
                        (info.platform &&
                          info.platform.toLowerCase() !== info.name.toLowerCase())) && (
                        <p className="mt-1 text-xs text-dark-300">
                          {info.platform && info.platform.toLowerCase() !== info.name.toLowerCase()
                            ? info.platform
                            : ''}
                          {suffix
                            ? `${info.platform && info.platform.toLowerCase() !== info.name.toLowerCase() ? ' · ' : ''}ID ${suffix}`
                            : ''}
                        </p>
                      )}
                    </div>
                    {!editing && (
                      <div className="flex shrink-0">
                        <button
                          type="button"
                          disabled={busy}
                          className={actionClass}
                          aria-label={t('subscription.devicesUi.renameNamed', {
                            defaultValue: 'Переименовать: {{name}}',
                            name: managementName,
                          })}
                          title={t('subscription.renameDevice', 'Переименовать')}
                          onClick={() => {
                            renameDeviceMutation.reset();
                            setEditingDeviceHwid(device.hwid);
                            setEditingDeviceName(device.local_name || '');
                          }}
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className={actionClass}
                          aria-label={t('subscription.devicesUi.deleteNamed', {
                            defaultValue: 'Удалить: {{name}}',
                            name: managementName,
                          })}
                          title={t('subscription.deleteDevice')}
                          onClick={async () => {
                            const confirmed = await destructiveConfirm(
                              t('subscription.devicesUi.confirmOne', {
                                defaultValue: 'Удалить «{{name}}» из списка устройств подписки?',
                                name: managementName,
                              }),
                              t('subscription.deleteDevice'),
                              t('subscription.deleteDevice'),
                            );
                            if (confirmed) deleteDeviceMutation.mutate(device.hwid);
                          }}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  {editing && (
                    <form
                      className="mt-3 space-y-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        save();
                      }}
                    >
                      <label className="sr-only" htmlFor={`alias-${device.hwid}`}>
                        {t('subscription.renameDevice', 'Переименовать')}
                      </label>
                      <input
                        id={`alias-${device.hwid}`}
                        type="text"
                        autoFocus
                        value={editingDeviceName}
                        maxLength={DEVICE_ALIAS_MAX_LENGTH}
                        placeholder={info.system}
                        onChange={(e) => setEditingDeviceName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            setEditingDeviceHwid(null);
                          }
                        }}
                        className="min-h-11 w-full rounded-xl border border-[var(--xsg-line-strong)] bg-dark-900 px-3 text-sm text-dark-100 focus:outline-none focus:ring-2 focus:ring-accent-400"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          // Keep the keyboard/nav layout stable until the click submits the form.
                          onPointerDown={(event) => event.preventDefault()}
                          disabled={busy}
                          className="min-h-11 flex-1 rounded-xl bg-accent-500/15 px-3 text-sm font-medium text-accent-200 disabled:opacity-50"
                        >
                          {t('subscription.renameDeviceSave', 'Сохранить')}
                        </button>
                        <button
                          type="button"
                          onPointerDown={(event) => event.preventDefault()}
                          disabled={busy}
                          onClick={() => {
                            setEditingDeviceHwid(null);
                            setEditingDeviceName('');
                          }}
                          className="min-h-11 flex-1 rounded-xl px-3 text-sm text-dark-300 hover:bg-dark-700/30"
                        >
                          {t('subscription.renameDeviceCancel', 'Отмена')}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-2 border-t border-[var(--xsg-line)] pt-2">
            <button
              type="button"
              disabled={busy}
              className="min-h-11 rounded-xl px-2 text-xs font-medium text-critical-500 hover:bg-critical-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-critical-500 disabled:opacity-50"
              onClick={async () => {
                const confirmed = await destructiveConfirm(
                  t('subscription.devicesUi.confirmAll', {
                    defaultValue:
                      'Удалить все устройства ({{count}})? Список подключённых устройств подписки будет очищен.',
                    count: devicesData.total,
                  }),
                  t('subscription.deleteAllDevices'),
                  t('subscription.deleteAllDevices'),
                );
                if (confirmed) deleteAllDevicesMutation.mutate();
              }}
            >
              {t('subscriptionCommand.deleteAllDevices')}
            </button>
          </div>
        </>
      ) : (
        <p className="py-5 text-center text-sm text-dark-300">{t('subscription.noDevices')}</p>
      )}
      {(deleteDeviceMutation.isError ||
        deleteAllDevicesMutation.isError ||
        renameDeviceMutation.isError) && (
        <p role="alert" className="mt-2 text-xs leading-relaxed text-warning-400">
          {t(
            'subscription.devicesUi.actionError',
            'Не удалось сохранить изменение. Попробуйте ещё раз.',
          )}
        </p>
      )}
    </div>
  );
}
export default DevicesPanel;
