import { useQuery } from '@tanstack/react-query';
import { subscriptionApi } from '@/api/subscription';
import type { Subscription } from '@/types';
import { showsAddonOptions } from '@/utils/legacySubscription';

/** Read-only discovery; the existing sheets own prices, confirmation and payment. */
export function useAddonAvailability(subscription: Subscription | null, subscriptionId?: number) {
  const eligible = !!subscription && showsAddonOptions(subscription);
  const devices = useQuery({
    queryKey: ['device-price', 1, subscriptionId],
    queryFn: () => subscriptionApi.getDevicePrice(1, subscriptionId),
    enabled: eligible,
    staleTime: 30_000,
    retry: false,
  });
  const traffic = useQuery({
    queryKey: ['traffic-packages', subscriptionId],
    queryFn: () => subscriptionApi.getTrafficPackages(subscriptionId),
    enabled: eligible && (subscription?.traffic_limit_gb ?? 0) > 0,
    staleTime: 30_000,
    retry: false,
  });
  const reduction = useQuery({
    queryKey: ['device-reduction-info', subscriptionId],
    queryFn: () => subscriptionApi.getDeviceReductionInfo(subscriptionId),
    enabled: eligible,
    staleTime: 30_000,
    retry: false,
  });
  return {
    canReduceDevices:
      eligible &&
      !reduction.isError &&
      reduction.data?.available === true &&
      reduction.data.can_reduce > 0,
    minimumDeviceLimit: reduction.data?.min_device_limit,
    canAddDevices:
      eligible &&
      !devices.isError &&
      devices.data?.available === true &&
      (devices.data.can_add == null || devices.data.can_add >= 1) &&
      (!devices.data.max_device_limit ||
        (devices.data.current_device_limit ?? subscription?.device_limit ?? 0) <
          devices.data.max_device_limit),
    canAddTraffic:
      eligible &&
      (subscription?.traffic_limit_gb ?? 0) > 0 &&
      !traffic.isError &&
      (traffic.data?.length ?? 0) > 0,
  };
}
