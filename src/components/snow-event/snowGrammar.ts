export function nounFor(value: number, one: string, few: string, many: string) {
  const normalized = Math.abs(value) % 100;
  const last = normalized % 10;
  return normalized >= 11 && normalized <= 14 ? many : last === 1 ? one : last >= 2 && last <= 4 ? few : many;
}

export function gameDays(value: number) {
  return `${value} ${nounFor(value, 'игровой день', 'игровых дня', 'игровых дней')}`;
}

export function participantDecorations(value: number) {
  return `${value} ${nounFor(value, 'украшение', 'украшения', 'украшений')} от участников`;
}
