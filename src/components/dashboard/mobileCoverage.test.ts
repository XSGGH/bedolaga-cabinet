import { describe, expect, it } from 'vitest';
import {
  checkTime,
  coverageModel,
  type MobileDirection,
  type MobileStatus,
  DIRECTION_STATES,
} from './mobileCoverageModel';

function status(districts: MobileDirection[], rest: Partial<MobileStatus> = {}): MobileStatus {
  return { ok: 999, total: 999, districts, ...rest };
}

describe('mobile coverage semantics', () => {
  it('separates 15 successes, four normal skipped checks and one unknown without reporting a failure', () => {
    const rows = Array.from({ length: 20 }, (_, index) => ({
      region: `r${index}`,
      operator: 'mts',
      status: index < 15 ? 'up' : index < 19 ? 'no_bs' : 'no_modem',
    }));
    expect(coverageModel(status(rows))).toMatchObject({
      up: 15,
      total: 15,
      notRequired: 4,
      noResult: 1,
      down: 0,
      tone: 'success',
    });
    expect(DIRECTION_STATES.no_bs.symbol).toBe('—');
    expect(DIRECTION_STATES.no_modem.symbol).toBe('?');
    expect(
      new Set(['up', 'no_bs', 'unknown', 'down'].map((key) => DIRECTION_STATES[key].symbol)).size,
    ).toBe(4);
  });
  it('counts tested district/operator pairs, not operators or untested directions', () => {
    const districts = ['cfo', 'pfo', 'sfo', 'urfo', 'yufo'].flatMap((region) =>
      ['mts', 'megafon', 'beeline', 't2'].map((operator) => ({ region, operator, status: 'up' })),
    );
    districts[0].status = 'no_bs';
    districts[8].status = 'no_modem';
    districts[19].status = 'no_bs';
    const model = coverageModel(status(districts));
    expect(model).toMatchObject({ up: 17, total: 17, down: 0, untested: 3, tone: 'success' });
    expect(model.regions).toHaveLength(5);
    expect(model.operators).toHaveLength(4);
  });

  it('does not mark 95% availability as all successful', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      region: `region${i}`,
      operator: 'mts',
      status: i === 19 ? 'down' : 'up',
    }));
    expect(coverageModel(status(rows))).toMatchObject({
      up: 19,
      total: 20,
      down: 1,
      tone: 'warning',
    });
  });

  it.each(['no_bs', 'no_modem', 'modem_unavailable', 'unknown', 'stale', 'new_status'])(
    '%s is neither success nor outage',
    (result) => {
      const model = coverageModel(status([{ region: 'cfo', operator: 'mts', status: result }]));
      expect(model).toMatchObject({ up: 0, total: 0, down: 0, tone: 'neutral' });
    },
  );

  it('uses the latest result of a pair and handles optional mobileNodes fields', () => {
    const model = coverageModel(
      { ok: 0, total: 0 },
      {
        pending: true,
        districts: [
          { region: 'cfo', operator: 'mts', status: 'up', at: 10 },
          { region: 'cfo', operator: 'mts', status: 'stale', at: 20 },
        ],
      },
    );
    expect(model).toMatchObject({ total: 0, stale: 1, pending: true, tone: 'neutral' });
    expect(model.directions).toHaveLength(1);
  });

  it('does not double-count the no-modem breakdown in legacy totals', () => {
    const model = coverageModel({
      ok: 17,
      total: 17,
      unknown: 2,
      no_modem: 1,
      modem_unavailable: 1,
      whitelist_off: 1,
      stale: 3,
    });
    expect(model).toMatchObject({
      up: 17,
      total: 17,
      untested: 3,
      stale: 3,
      notRequired: 1,
      noResult: 2,
    });
    expect(model.regions).toHaveLength(0);
  });

  it('prefers completed-round time and displays seconds in Moscow time', () => {
    const at = Date.parse('2026-11-12T14:10:00Z') / 1000;
    const model = coverageModel({ ok: 1, total: 1, at: at + 60, last_completed: at });
    expect(checkTime(model.at)).toContain('17:10');
    expect(checkTime(0)).toBeNull();
  });
});
