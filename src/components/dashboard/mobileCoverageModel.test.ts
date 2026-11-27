import { describe, expect, it } from 'vitest';
import { coverageModel, coveragePresentation, type MobileDirection } from './mobileCoverageModel';

const directions = (...states: string[]): MobileDirection[] =>
  states.map((status, i) => ({ region: 'cfo', operator: String(i), status }));
describe('mobile availability summary', () => {
  it('confirms healthy only when all required measurements are available', () => {
    const model = coverageModel({ ok: 2, total: 2, districts: directions('up', 'up', 'no_bs') });
    expect(model.tone).toBe('success');
    expect(coveragePresentation(model).headline).toBe('Мобильные сети работают штатно');
  });
  it.each(['no_modem', 'modem_unavailable', 'unknown', 'stale'])(
    'does not invent running checks for %s',
    (state) => {
      const model = coverageModel({ ok: 1, total: 1, districts: directions('up', state) });
      expect(model.tone).toBe('neutral');
      expect(coveragePresentation(model).headline).toBe('Доступность подтверждена частично');
    },
  );
  it('separates confirmed running progress from completed results', () => {
    const model = coverageModel({ ok: 15, total: 15, unknown: 5 }, { checking: true });
    expect(model.tone).toBe('neutral');
    expect(coveragePresentation(model)).toEqual({
      headline: 'Проверка мобильных сетей продолжается',
      caption: 'Завершено: 15 · Успешно: 15 · Без результата: 5',
    });
  });
  it('does not describe queued checks as already running', () => {
    expect(
      coveragePresentation(coverageModel({ ok: 0, total: 0 }, { pending: true })).headline,
    ).toBe('Ожидаются результаты проверки');
  });
  it('keeps confirmed failures visible during another check', () => {
    const model = coverageModel({ ok: 1, total: 2 }, { checking: true });
    expect(model.tone).toBe('warning');
    expect(coveragePresentation(model).headline).toBe('Обнаружены проблемы с доступностью');
  });
  it('distinguishes no required checks and no data', () => {
    expect(
      coveragePresentation(coverageModel({ ok: 0, total: 0, whitelist_off: 4 })).headline,
    ).toBe('Проверка не требуется');
    expect(coveragePresentation(coverageModel({ ok: 0, total: 0 })).headline).toBe(
      'Нет свежих данных',
    );
  });
});
