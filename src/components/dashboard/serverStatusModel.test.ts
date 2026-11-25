import { describe, expect, it } from 'vitest';
import {
  normalizeStatus,
  statusTimeline,
  type PublicServer,
  type PublicStatus,
} from './serverStatusModel';

const server = (
  name: string,
  online: boolean | null = true,
  maintenance = false,
): PublicServer => ({ name, online, maintenance, load: [] });
const payload = (servers: PublicServer[], status: PublicStatus['status'] = 'ok'): PublicStatus => ({
  ok: true,
  status,
  servers,
  load: { now: 20, series: [] },
});

describe('current infrastructure status', () => {
  it('keeps missing group details neutral without fabricating a VPN outage', () => {
    const result = normalizeStatus(payload([server('A')]), undefined, true);
    expect(result.state).toBe('unknown');
    expect(result.counts.down).toBe(0);
    expect(result.servers[0].state).toBe('up');
  });
  it('does not copy degradation of an unrelated website onto healthy VPN directions', () => {
    expect(normalizeStatus(payload([server('A'), server('B')], 'degraded')).state).toBe('up');
  });
  it('uses displayed server rows, not totals that also count websites', () => {
    const model = normalizeStatus({
      ...payload([server('A'), server('B')]),
      total: 10,
      online: 10,
    });
    expect(model.description).toBe('2 из 2 серверов доступны');
    expect(model.state).toBe('up');
  });
  it.each(['ok', 'degraded', 'down'] as const)(
    'does not call maintenance an incident even with legacy aggregate %s',
    (status) => {
      const model = normalizeStatus(payload([server('A', false, true)], status));
      expect(model.state).toBe('maintenance');
      expect(model.counts).toEqual({ up: 0, maintenance: 1, down: 0, degraded: 0, unknown: 0 });
    },
  );
  it('prioritizes confirmed failure over maintenance and unknown measurements', () => {
    const model = normalizeStatus(
      payload([server('A'), server('B', false, true), server('C', false), server('D', null)]),
    );
    expect(model.state).toBe('down');
    expect(model.headline).toBe('Обнаружены проблемы');
    expect(model.description).toBe('1 работает · 1 на обслуживании · 1 недоступен · 1 без данных');
  });
  it('does not infer maintenance from downtime or historical uptime', () => {
    expect(
      normalizeStatus(payload([{ ...server('A', false), uptime30: 100 }])).servers[0].state,
    ).toBe('down');
    expect(normalizeStatus(payload([{ ...server('A'), uptime30: 1 }])).state).toBe('up');
  });
  it('recognizes a partially working group from structured member counts', () => {
    const model = normalizeStatus(payload([server('A'), server('B', false, true)]), {
      servers: [
        {
          name: 'A',
          kind: 'server',
          online: true,
          maintenance: false,
          members: 3,
          membersOnline: 2,
        },
      ],
    });
    expect(model.state).toBe('degraded');
    expect(model.servers[0].state).toBe('degraded');
  });
  it('ignores contradictory summary generations', () => {
    const model = normalizeStatus(payload([server('A')]), {
      servers: [
        {
          name: 'A',
          kind: 'server',
          online: false,
          maintenance: false,
          members: 3,
          membersOnline: 2,
        },
      ],
    });
    expect(model.servers[0].state).toBe('up');
  });
  it('keeps an upstream monitoring outage neutral without erasing confirmed maintenance', () => {
    const model = normalizeStatus(payload([server('A'), server('B', false, true)]), {
      monitoringDown: true,
      servers: [],
    });
    expect(model.state).toBe('unknown');
    expect(model.counts.maintenance).toBe(1);
    expect(model.counts.down).toBe(0);
  });
  it('restores normal status when a refreshed snapshot ends maintenance', () => {
    expect(normalizeStatus(payload([server('A', false, true)])).state).toBe('maintenance');
    expect(normalizeStatus(payload([server('A')])).state).toBe('up');
  });
  it('does not rewrite successful mobile checks when a server is in maintenance', () => {
    const mobile = { ok: 3, total: 3, at: 1, districts: [] };
    const result = normalizeStatus(payload([{ ...server('A', false, true), mobile }]));
    expect(result.servers[0].mobile).toEqual(mobile);
    expect(mobile.ok).toBe(3);
  });
});

describe('monitoring event transitions', () => {
  it('separates maintenance start/end and actual failure/recovery without parsing titles', () => {
    const rows = statusTimeline({
      now: 500,
      feed: [{ k: 'ok', t: 'Нидерланды', from: 100, to: 200, done: true, tl: [] }],
      history: [{ k: 'down', t: 'Германия', from: 300, to: 400 }],
    });
    expect(rows.map((e) => e.label)).toEqual([
      'Работа восстановлена',
      'Нарушение доступности',
      'Обслуживание завершено',
      'Технические работы',
    ]);
  });
  it('does not invent restoration without an end timestamp or duplicate feed/history events', () => {
    const event = { k: 'warn', t: 'A', from: 100, to: 0 };
    const rows = statusTimeline({ now: 500, feed: [event], history: [event] });
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('Нарушение доступности');
  });
  it('marks future planned work as scheduled rather than already started', () => {
    expect(
      statusTimeline({ now: 100, feed: [{ k: 'plan', t: 'A', ts: 200 }], history: [] })[0].label,
    ).toBe('Запланированы работы');
  });
});
