import type { BlockRendererProps } from './types';

/** Предложение про режим TUN выносим из текста последнего шага в отдельную подсказку. */
function splitTip(text: string): { body: string; tip: string } {
  const parts = text.split(/(?<=[.!?])\s+/);
  const tipIdx = parts.findIndex((p) => /\bTUN\b/.test(p));
  if (tipIdx === -1) return { body: text, tip: '' };
  const tip = parts[tipIdx];
  const body = parts.filter((_, i) => i !== tipIdx).join(' ');
  return { body, tip };
}

export function TimelineBlock({
  blocks,
  getLocalizedText,
  getSvgHtml,
  renderBlockButtons,
}: BlockRendererProps) {
  const visibleBlocks = blocks.filter(
    (b) =>
      getLocalizedText(b.title) ||
      getLocalizedText(b.description) ||
      b.buttons?.length ||
      b.customNode,
  );

  if (!visibleBlocks.length) return null;

  return (
    <div className="rounded-[26px] border border-accent-500/20 bg-accent-500/[0.05] p-4 pb-1 sm:p-6 sm:pb-2">
      {visibleBlocks.map((block, index) => {
        const isLast = index === visibleBlocks.length - 1;
        const svgHtml = getSvgHtml(block.svgIconKey);
        const description = getLocalizedText(block.description);
        const { body, tip } = isLast ? splitTip(description) : { body: description, tip: '' };

        return (
          <div key={index} className="relative flex gap-3.5 pb-5 sm:gap-4 sm:pb-6">
            {!isLast && (
              <span
                aria-hidden="true"
                className="absolute bottom-[-18px] left-[21px] top-12 w-0.5"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(var(--color-accent-500), 0.55), rgba(var(--color-accent-500), 0.08))',
                }}
              />
            )}
            <span
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-accent-300/50 text-white"
              style={{
                background:
                  'linear-gradient(135deg, rgba(var(--color-accent-500), 0.45), rgba(var(--color-accent-600), 0.25))',
              }}
            >
              {svgHtml ? (
                <span
                  className="h-5 w-5 [&>svg]:h-full [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: svgHtml }}
                />
              ) : (
                <span className="text-base font-extrabold">{index + 1}</span>
              )}
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-accent-500/40 bg-dark-950 text-[11px] font-extrabold text-accent-300">
                {index + 1}
              </span>
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <h3 className="text-[17px] font-extrabold tracking-tight text-dark-50">
                {getLocalizedText(block.title)}
              </h3>
              {body && (
                <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-dark-300">
                  {body}
                </p>
              )}
              {renderBlockButtons(block.buttons, 'step')}
              {block.customNode}
              {tip && (
                <div className="mt-3.5 rounded-[14px] border border-warning-400/30 bg-warning-400/10 px-3.5 py-3 text-[13px] leading-snug text-warning-300">
                  {tip}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
