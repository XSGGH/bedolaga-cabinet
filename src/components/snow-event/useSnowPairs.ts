import { useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { useAuthStore } from '@/store/auth';
import {
  snowApi,
  snowError,
  type MosaicState,
  type SnowAttempt,
  type SnowMove,
  type SnowState,
} from '@/api/snowEvent';

type PendingMove = { attempt_id: string; index: number; request_id: string };
const sessionInterval = 5000;

function pendingMove(key: string): PendingMove | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    return value &&
      typeof value.attempt_id === 'string' &&
      typeof value.request_id === 'string' &&
      Number.isInteger(value.index) &&
      value.index >= 0 &&
      value.index < 12
      ? value
      : null;
  } catch {
    return null;
  }
}

export function useSnowPairs(
  state: SnowState,
  data: MosaicState,
  preview: string | undefined,
  visible: boolean,
  canPlay: boolean,
  refresh: () => Promise<SnowState | undefined>,
) {
  const user = useAuthStore((auth) => auth.user?.id);
  const pendingKey = `snow-pairs:${user}:${preview ?? 'live'}:${state.preview_revision ?? ''}:${state.today}`;
  const session = useRef('');
  const owned = useRef<SnowAttempt | null>(null);
  const operation = useRef(false);
  const deferredPause = useRef(false);
  const mismatchTimer = useRef<number | undefined>(undefined);
  const [attempt, setAttempt] = useState<SnowAttempt | null>(null);
  const [move, setMove] = useState<SnowMove | null>(null);
  const [mismatch, setMismatch] = useState<Record<number, string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState<PendingMove | null>(() => pendingMove(pendingKey));
  const [elapsed, setElapsed] = useState(0);
  const remember = (pending: PendingMove | null) => {
    setRetry(pending);
    try {
      if (pending) sessionStorage.setItem(pendingKey, JSON.stringify(pending));
      else sessionStorage.removeItem(pendingKey);
    } catch {
      // The in-memory retry still works in WebViews with storage disabled.
    }
  };
  const send = useCallback(
    <T>(action: string, body: Record<string, unknown>) => {
      if (!session.current) session.current = crypto.randomUUID();
      return snowApi.mosaic<T>(
        action,
        {
          day: state.today,
          ...(preview ? { preview_revision: state.preview_revision ?? '' } : {}),
          session: session.current,
          request_id: crypto.randomUUID(),
          ...body,
        },
        preview,
      );
    },
    [state.today, state.preview_revision, preview],
  );

  const pause = useCallback(() => {
    const current = owned.current;
    window.clearTimeout(mismatchTimer.current);
    setMismatch(null);
    if (operation.current) {
      deferredPause.current = true;
      return;
    }
    if (!current) return;
    owned.current = null;
    setAttempt(null);
    if (current.status === 'active') {
      void send('pause', { attempt_id: current.id, revision: current.session_revision }).catch(
        () => {
          // If the browser cannot send this, expiration freezes the confirmed time.
        },
      );
    }
  }, [send]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) pause();
      else void refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', pause);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', pause);
      pause();
    };
  }, [pause, refresh]);

  useEffect(() => {
    if (!visible || !canPlay) pause();
  }, [visible, canPlay, pause]);

  const newerSession =
    data.attempt &&
    attempt?.id === data.attempt.id &&
    data.attempt.session_revision > attempt.session_revision;
  useEffect(() => {
    if (newerSession) pause();
  }, [newerSession, pause]);

  useEffect(() => {
    if (attempt?.status !== 'active') return;
    const started = performance.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.min(180, attempt.elapsed + (performance.now() - started) / 1000));
    }, 250);
    return () => window.clearInterval(timer);
  }, [attempt]);

  const commit = useCallback((next: SnowAttempt) => {
    owned.current = next;
    setAttempt(next);
    setElapsed(next.elapsed);
  }, []);

  const finishOperation = useCallback(() => {
    operation.current = false;
    if (deferredPause.current) {
      deferredPause.current = false;
      pause();
    }
  }, [pause]);

  const heartbeat = useCallback(async () => {
    const current = owned.current;
    if (document.hidden || operation.current || current?.status !== 'active') return;
    operation.current = true;
    try {
      const next = await send<SnowAttempt>('heartbeat', {
        attempt_id: current.id,
        revision: current.session_revision,
      });
      commit(next);
      if (next.status !== 'active') void refresh();
    } catch {
      deferredPause.current = true;
      setError('Связь с игрой прервалась. Продолжи сохранённую партию.');
      void refresh();
    } finally {
      finishOperation();
    }
  }, [send, commit, refresh, finishOperation]);
  const active = attempt?.status === 'active';
  useEffect(() => {
    if (!visible || !canPlay || !active) return;
    const interval = window.setInterval(() => void heartbeat(), sessionInterval);
    return () => window.clearInterval(interval);
  }, [visible, canPlay, active, heartbeat]);

  const playMove = async (pending: PendingMove, current?: SnowAttempt) => {
    const result = await send<SnowMove>('flip', {
      ...pending,
      revision: current?.session_revision ?? 0,
    });
    remember(null);
    commit(
      !result.attempt.finished &&
        current &&
        result.attempt.session_revision !== current.session_revision
        ? {
            ...current,
            ...result.attempt,
            elapsed: current.elapsed,
            session_revision: current.session_revision,
            status: current.status,
          }
        : result.attempt,
    );
    if (result.attempt.finished) {
      setMove(result);
    } else if (
      result.first !== undefined &&
      !result.match &&
      result.symbol &&
      result.index !== undefined
    ) {
      const first = current?.cards[result.first];
      setMismatch(first ? { [result.first]: first, [result.index]: result.symbol } : null);
      mismatchTimer.current = window.setTimeout(() => setMismatch(null), 800);
    }
    void refresh();
  };

  const recover = async (cause: unknown, pending?: PendingMove) => {
    setError(snowError(cause));
    const status = isAxiosError(cause) ? cause.response?.status : undefined;
    const code = isAxiosError(cause) ? cause.response?.data?.detail?.code : undefined;
    if (pending && (!status || status >= 500 || code === 'concurrent_change')) remember(pending);
    else remember(null);
    if (status && status < 500 && code !== 'concurrent_change') {
      deferredPause.current = true;
    }
    await refresh();
  };

  const start = async () => {
    if (operation.current || !canPlay) return;
    operation.current = true;
    setBusy(true);
    setError('');
    setMismatch(null);
    try {
      const fresh = await refresh();
      if (!fresh) {
        setError('Не удалось проверить состояние игры. Попробуй ещё раз.');
        return;
      }
      if (
        fresh.today !== state.today ||
        fresh.preview_revision !== state.preview_revision ||
        fresh.phase !== 'active' ||
        !['active', 'renewed'].includes(fresh.subscription) ||
        !fresh.mosaics?.session_version
      )
        return;
      const saved = fresh.mosaics.attempt;
      if (retry && retry.attempt_id !== saved?.id) {
        await playMove(retry);
        return;
      }
      const current = saved
        ? await send<SnowAttempt>('resume', {
            attempt_id: saved.id,
            revision: saved.session_revision,
          })
        : await send<SnowAttempt>('start', { used: fresh.mosaics.attempts_used });
      commit(current);
      setMove(null);
      if (retry?.attempt_id === current.id && !current.finished) await playMove(retry, current);
      else remember(null);
      void refresh();
    } catch (cause) {
      await recover(cause, retry ?? undefined);
    } finally {
      setBusy(false);
      finishOperation();
    }
  };

  const flip = async (index?: number) => {
    const current = owned.current;
    if (!current || current.finished || operation.current || mismatch || !canPlay) return;
    const pending =
      retry ??
      (index === undefined
        ? null
        : {
            attempt_id: current.id,
            index,
            request_id: crypto.randomUUID(),
          });
    if (!pending) return;
    remember(pending);
    operation.current = true;
    setBusy(true);
    setError('');
    try {
      await playMove(pending, current);
    } catch (cause) {
      await recover(cause, pending);
    } finally {
      setBusy(false);
      finishOperation();
    }
  };

  return {
    attempt,
    elapsed,
    mismatch,
    move,
    error,
    busy,
    retry,
    start,
    flip,
    pause,
    saved: data.attempt ?? (attempt && !attempt.finished ? attempt : null),
  };
}
