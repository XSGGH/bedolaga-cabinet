import { useState, type CSSProperties } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { LuArrowLeft, LuArrowRight, LuCheck, LuGift, LuHistory, LuHouse, LuLightbulb, LuMapPin, LuSnowflake, LuSparkles, LuStar, LuVote } from 'react-icons/lu';
import type { SnowState, StationStage } from '@/api/snowEvent';
import { hasSubscription } from './snowPresentation';
import { momentFor } from './snowMoments';
import { participantDecorations } from './snowGrammar';
import StationDetails from './StationDetails';

// Kept for the older game illustrations outside the station.
export function StationSprite({ index, className = '', style }: { index: number; className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" className={`sw-sprite ${className}`} style={{ ...style, backgroundPosition: `${(index % 4) * 100 / 3}% ${Math.floor(index / 4) * 100 / 3}%` }} />;
}

const zones = [
  { id: 'plaza', name: 'Площадь', text: 'Главное место встречи. Здесь появляются первые огни, ёлка и праздничные украшения.' },
  { id: 'data', name: 'Дата-центр', text: 'Окна и фасад постепенно наполняются тёплым светом.' },
  { id: 'workshop', name: 'Мастерская', text: 'Тихий уголок, где кот собирает сюрпризы для всех участников.' },
  { id: 'orbit', name: 'Снежный парк', text: 'Заснеженные дорожки, зимние огни и место для маленьких чудес.' },
] as const;
const ornaments = [
  { id: 'lantern', name: 'Фонарик', Icon: LuLightbulb },
  { id: 'bauble', name: 'Игрушка', Icon: LuSnowflake },
  { id: 'star', name: 'Звезда', Icon: LuStar },
  { id: 'gift', name: 'Подарок', Icon: LuGift },
  { id: 'crystal', name: 'Кристалл', Icon: LuSparkles },
] as const;
type Mode = 'history' | 'vote' | 'place';
type ZoneId = typeof zones[number]['id'];
const image = '/xsg-snow-assets/station-v3-base.webp';
const focusAreas: Record<ZoneId, { left: string; top: string; width: string; height: string }> = {
  plaza: { left: '26%', top: '50%', width: '60%', height: '36%' },
  data: { left: '2%', top: '23%', width: '54%', height: '38%' },
  workshop: { left: '68%', top: '31%', width: '30%', height: '27%' },
  orbit: { left: '2%', top: '61%', width: '42%', height: '33%' },
};

// A permanent base plus 25 independent additions, with no image blending.
function StationIllustration({ stages, revealed, description, focusZone }: {
  stages: StationStage[];
  revealed: StationStage[];
  description: string;
  focusZone?: ZoneId | null;
}) {
  return <figure className="sv4-scene">
    <img className="sv4-scene-base" src={image} width="1536" height="1024" alt={description} loading="lazy" draggable={false} />
    <StationDetails count={revealed.length} />
    {revealed.length >= 7 && <img className="sv4-station-tree" src="/xsg-snow-assets/station-tree-cutout.png" width="1130" height="1392" alt="" aria-hidden="true" draggable={false} />}
    {focusZone && <div className="sv4-zone-focus" style={focusAreas[focusZone]} aria-hidden="true"><span>{zones.find(item => item.id === focusZone)?.name}</span></div>}
    <figcaption><LuMapPin aria-hidden="true" /> Преображение станции · {revealed.length}/{stages.length} этапов</figcaption>
  </figure>;
}

export default function SnowWorldScene({ state, onSeen, onPlay, busy = false, act }: {
  state: SnowState;
  onSeen: () => void;
  onPlay?: () => void;
  busy?: boolean;
  act?: (action: string, body?: Record<string, unknown>) => Promise<boolean | void>;
}) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [zone, setZone] = useState<ZoneId>('plaza');
  const [focusZone, setFocusZone] = useState<ZoneId | null>(null);
  const [placeZone, setPlaceZone] = useState<ZoneId>('plaza');
  const [kind, setKind] = useState<string>('lantern');
  const [threshold, setThreshold] = useState(100);
  const [consent, setConsent] = useState(false);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [historyView, setHistoryView] = useState<'beginning' | 'current'>('current');
  const [voteChoice, setVoteChoice] = useState<ZoneId>('plaza');
  const [notice, setNotice] = useState('');

  const world = state.world;
  const stages = world?.stages ?? [];
  const total = world?.total ?? 0;
  const reached = stages.filter(stage => stage.threshold <= total);
  const current = reached[reached.length - 1];
  const next = stages.find(stage => stage.threshold > total);
  const earlier = current?.threshold ?? 0;
  const goal = Math.max(1, (next?.threshold ?? earlier) - earlier);
  const progress = next ? Math.min(goal, Math.max(0, total - earlier)) : goal;
  const vote = world?.vote;
  const decorations = world?.decorations ?? [];
  const used = decorations.filter(item => item.own).map(item => item.threshold);
  const rights = [100, 300, 500].filter(value => state.progress.earned >= value && !used.includes(value));
  const picked = rights.includes(threshold) ? threshold : rights[0];
  const access = state.phase === 'active' && hasSubscription(state);
  const selectedZone = zones.find(item => item.id === zone)!;
  const selectedStages = stages.filter(stage => stage.zone === zone);
  const zoneDecorations = decorations.filter(item => Math.floor(item.slot / 16) === zones.findIndex(item => item.id === zone));
  const placeZoneIndex = zones.findIndex(item => item.id === placeZone);
  const freeSlot = Array.from({ length: 16 }, (_, i) => placeZoneIndex * 16 + i)
    .find(slot => !decorations.some(item => item.slot === slot));
  const currentMoment = momentFor(state);
  const open = (target: Mode) => {
    setMode(target);
    setNotice('');
    if (target === 'history') {
      setHistoryIndex(null);
      setHistoryView('current');
      onSeen();
    }
    if (target === 'vote') setVoteChoice(vote?.own && zones.some(item => item.id === vote.own) ? vote.own as ZoneId : 'plaza');
    if (target === 'place') setPlaceZone(zone);
  };

  const historyCount = historyView === 'beginning' ? 0 : historyIndex === null ? reached.length : Math.min(reached.length, historyIndex + 1);
  const historyStages = reached.slice(0, historyCount);
  const showHistoryCount = (count: number) => { setHistoryView(count === 0 ? 'beginning' : 'current'); setHistoryIndex(count === reached.length ? null : count - 1); };

  const zonePicker = (value: ZoneId, onChange: (value: ZoneId) => void, ids: ZoneId[] = zones.map(item => item.id)) =>
    <div className="sv4-zone-grid" role="group" aria-label="Зоны зимней станции">
      {zones.filter(item => ids.includes(item.id)).map(item =>
        <button type="button" key={item.id} aria-pressed={value === item.id} onClick={() => onChange(item.id)}>
          <LuMapPin aria-hidden="true" />{item.name}
        </button>,
      )}
    </div>;

  const present = (value: number) => value.toLocaleString('ru-RU');
  return <section className="sv3-station sv4-station" aria-label="Зимняя станция XSG">
    <div className="sv3-station-heading">
      <div><span>{reached.length ? `Вместе открыли ${reached.length} из ${stages.length} этапов` : 'Наш праздник только начинается'}</span><h2>Зимняя станция XSG</h2></div>
      {onPlay && <button className="sv3-play-short" type="button" onClick={onPlay}>{state.phase === 'active' ? 'Играть' : 'О событии'} <LuArrowRight aria-hidden="true" /></button>}
    </div>
    <div className="sv4-zone-shortcuts" role="group" aria-label="Посмотреть участок станции">
      {zones.map(item => <button key={item.id} type="button" aria-pressed={focusZone === item.id} onClick={() => { setZone(item.id); setFocusZone(focusZone === item.id ? null : item.id); }}>{item.name}</button>)}
    </div>
    <StationIllustration stages={stages} revealed={reached} focusZone={focusZone} description="Зимняя станция с постепенно появляющимися огнями и украшениями" />
    <div className="sv4-station-caption">
      <LuHouse aria-hidden="true" />
      <div><strong>{current?.name ?? 'Всё начинается с первого огонька'}</strong><span>{current ? `Этап ${reached.length} из ${stages.length} · наша общая история` : 'Новые детали появятся по мере общего прогресса'}</span></div>
      <button type="button" onClick={() => open('history')}>История <LuArrowRight aria-hidden="true" /></button>
    </div>
    <div className="sv3-world-progress">
      <div><strong>{present(total)} ❄</strong><span>{next ? `Ещё ${present(next.threshold - total)} до следующего этапа` : 'Все этапы открыты'}</span></div>
      <progress max={goal} value={progress} aria-label="Прогресс до следующего этапа" />
      <p>{next ? <>Следом: <strong>{next.name}</strong></> : 'Спасибо всем, кто помог построить эту историю 💜'}</p>
    </div>
    <div className="sv4-zone-explore">
      <h3>Что происходит на станции?</h3>
      <p>Выбери район над иллюстрацией — он подсветится. Здесь показано, что уже открыто.</p>
      <div className="sv4-zone-story">
        <strong>{selectedZone.name}</strong><p>{selectedZone.text}</p>
        <span>{selectedStages.filter(item => item.threshold <= total).length} из {selectedStages.length} изменений открыто · {participantDecorations(zoneDecorations.length)}</span>
        {selectedStages.length > 0 && <small>{selectedStages.filter(item => item.threshold <= total).slice(-1)[0] ? `Уже открыто: ${selectedStages.filter(item => item.threshold <= total).slice(-1)[0].name}` : `Впереди: ${selectedStages[0].name}`}</small>}
      </div>
    </div>
    <div className="sv4-station-links">
      <button type="button" onClick={() => open('history')}><LuHistory /> <span><strong>Как менялась станция</strong><small>Все этапы и было / стало</small></span><LuArrowRight /></button>
      <button type="button" onClick={() => open('vote')}><LuVote /> <span><strong>Общий выбор</strong><small>{vote?.own ? 'Твой голос сохранён' : 'Куда направим огоньки?'}</small></span><LuArrowRight /></button>
      <button type="button" onClick={() => open('place')}><LuSparkles /> <span><strong>Моё украшение</strong><small>{rights.length ? `Доступно: ${rights.length}` : used.length ? `Поставлено: ${used.length}` : 'Право открывается за участие'}</small></span><LuArrowRight /></button>
    </div>
    {currentMoment && <div className="sv4-daily-story"><LuSnowflake /><span><small>Момент дня · {currentMoment.day} декабря</small><strong>{currentMoment.name}</strong></span></div>}
    <Dialog.Root open={!!mode} onOpenChange={value => { if (!value) setMode(null); }}>
      <Dialog.Portal><Dialog.Overlay className="snow-event-overlay" /><Dialog.Content className={`sv3-map-dialog sv4-dialog sv4-dialog--${mode ?? 'closed'}`}>
        <header>
          <div><Dialog.Title>{mode === 'history' ? 'Как менялась станция' : mode === 'vote' ? 'Куда отправим огоньки?' : 'Твоё украшение на станции'}</Dialog.Title>
            <Dialog.Description>{mode === 'history' ? 'Посмотри, как менялся один и тот же пейзаж' : mode === 'vote' ? 'Выбираем место для следующего общего украшения' : 'Выбери украшение и уголок — свободное место подберём сами'}</Dialog.Description>
          </div>
          <Dialog.Close className="sv3-close" aria-label="Закрыть">×</Dialog.Close>
        </header>
        {mode === 'history' && <>
          <div className="sv4-history-preview">
            <div className="sv4-compare" role="group" aria-label="Сравнить облик станции">
              <button type="button" aria-pressed={historyCount === 0} onClick={() => showHistoryCount(0)}>Было</button>
              <button type="button" aria-pressed={historyCount === reached.length} onClick={() => showHistoryCount(reached.length)}>Сейчас · {reached.length}/{stages.length}</button>
            </div>
            <StationIllustration stages={stages} revealed={historyStages} description="Облик зимней станции на выбранном этапе" />
            <div className="sv4-history-nav">
              <button type="button" disabled={historyCount === 0} onClick={() => showHistoryCount(historyCount - 1)} aria-label="Предыдущий этап"><LuArrowLeft/></button>
              <span><strong>{historyCount ? stages[historyCount - 1]?.name : 'Первый снег'}</strong><small>{historyCount} / {stages.length} · {historyCount ? `${present(stages[historyCount - 1]?.threshold || 0)} ❄` : 'Начало истории'}</small></span>
              <button type="button" disabled={historyCount === reached.length} onClick={() => showHistoryCount(historyCount + 1)} aria-label="Следующий этап"><LuArrowRight/></button>
            </div>
          </div>
          <p className="sv4-hint">Нажми номер открытого этапа. Картинка останется на экране.</p>
          <div className="sv4-stage-grid" role="group" aria-label="Этапы преображения">
            {stages.map((stage, index) => <button key={stage.id} type="button" title={`${stage.name} · ${present(stage.threshold)} ❄`} aria-label={`Этап ${index + 1}: ${stage.name}`} disabled={stage.threshold > total} aria-pressed={historyCount === index + 1} onClick={() => showHistoryCount(index + 1)}>{index + 1}</button>)}
          </div>
        </>}
        {mode === 'vote' && <div className="sv4-dialog-body">
          <p>Один голос на раунд. Результат будет известен после его завершения.</p>
          {zonePicker(voteChoice, setVoteChoice, ['plaza', 'data', 'orbit'])}
          <div className="sv4-zone-story"><strong>{zones.find(item => item.id === voteChoice)?.name}</strong><p>{zones.find(item => item.id === voteChoice)?.text}</p><span>Сейчас {vote?.counts[voteChoice] ?? 0} голосов</span></div>
          {vote?.own ? <p className="sv4-success"><LuCheck /> Твой голос за «{zones.find(item => item.id === vote.own)?.name}» сохранён.</p>
            : <button className="se-button" type="button" disabled={!access || busy} onClick={async () => { if (await act?.('vote', { choice: voteChoice })) setNotice('Голос принят! Спасибо, что создаёшь праздник вместе с нами.'); }}>Проголосовать за {zones.find(item => item.id === voteChoice)?.name}</button>}
          {notice && <p className="sv4-success" role="status">{notice}</p>}
          {!access && <p className="sv4-hint">Голосование открывается во время события с активной подпиской.</p>}
          {!!vote?.results.length && <details><summary>Предыдущие результаты</summary>{vote.results.map(result => <p key={result.week}>Раунд {result.week + 1}: {zones.find(item => item.id === result.choice)?.name}</p>)}</details>}
        </div>}
        {mode === 'place' && <div className="sv4-dialog-body">
          <p>Украшения становятся частью общей истории. Выбираешь зону и предмет — никаких 64 точек на маленькой карте.</p>
          {zonePicker(placeZone, setPlaceZone)}
          <div className="sv4-zone-story"><strong>{zones.find(item => item.id === placeZone)?.name}</strong><p>{freeSlot === undefined ? 'Все места в этой зоне заняты. Выбери соседнюю.' : 'Место готово — кот аккуратно разместит твой подарок в этой зоне.'}</p></div>
          {access && rights.length > 0 ? <>
            <h3>Что поставим?</h3>
            <div className="sv4-ornament-list" role="group" aria-label="Вид украшения">{ornaments.map(item => <button key={item.id} type="button" aria-pressed={kind === item.id} onClick={() => setKind(item.id)}><item.Icon aria-hidden="true" />{item.name}</button>)}</div>
            {rights.length > 1 && <label className="sv4-field">Право за участие<select value={picked} onChange={event => setThreshold(Number(event.target.value))}>{rights.map(value => <option key={value} value={value}>За {value} ❄</option>)}</select></label>}
            <label className="sv3-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /> Разрешаю показать моё имя у украшения</label>
            <button type="button" className="se-button" disabled={freeSlot === undefined || busy} onClick={async () => {
              if (freeSlot === undefined) return;
              if (await act?.('place', { threshold: picked, decoration: kind, slot: String(freeSlot), consent })) {
                setNotice('Готово! Кот добавил твоё украшение на станцию.');
              }
            }}>Поставить украшение</button>
          </> : <p className="sv4-hint">{!access ? 'Размещение доступно во время события с активной подпиской.' : used.length === 3 ? 'Все три украшения уже добавлены. Спасибо!' : `Следующее право откроется за ${[100, 300, 500].find(value => value > state.progress.earned) ?? 500} заработанных снежинок.`}</p>}
          {notice && <p className="sv4-success" role="status"><LuCheck />{notice}</p>}
          {!!decorations.filter(item => item.own).length && <div className="sv4-own-decorations"><h3>Уже на станции</h3>{decorations.filter(item => item.own).map(item => <p key={item.id}><LuCheck /> {ornaments.find(ornament => ornament.id === item.kind)?.name ?? 'Украшение'} · {zones[Math.min(3, Math.floor(item.slot / 16))]?.name}</p>)}</div>}
        </div>}
      </Dialog.Content></Dialog.Portal>
    </Dialog.Root>
  </section>;
}
