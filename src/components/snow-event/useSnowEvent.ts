import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { snowApi } from '@/api/snowEvent';

export function useSnowEvent(preview?: string) {
  return useQuery({
    queryKey: ['snow-event', preview || 'real'],
    queryFn: () => snowApi.state(preview),
    staleTime: 5000,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
// Anchor to server time using a monotonic timer, never the device's wall clock.
export function useServerNow(serverNow?: string, updatedAt?: number) {
  const [anchor, setAnchor] = useState({ time: 0, tick: 0 });
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!serverNow || updatedAt === undefined) return;
    setAnchor({ time: Date.parse(serverNow), tick: performance.now() });
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed(performance.now()), 1000);
    return () => window.clearInterval(timer);
  }, [serverNow, updatedAt]);
  return anchor.time
    ? anchor.time + Math.max(0, elapsed - anchor.tick)
    : serverNow
      ? Date.parse(serverNow)
      : 0;
}
export function timeUntil(end: string, now: number) {
  const seconds = Math.max(0, Math.floor((Date.parse(end) - now) / 1000));
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor(seconds / 3600) % 24,
    minutes: Math.floor(seconds / 60) % 60,
    seconds: seconds % 60,
  };
}
