import { useState, useCallback, useMemo, memo } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { newsApi } from '../../api/news';
import { useHapticFeedback } from '../../platform/hooks/useHaptic';
import { cn } from '../../lib/utils';
import { ArrowIcon, ChevronDownIcon, NewsIcon } from '@/components/icons';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from '@/components/primitives/DropdownMenu';
import type { NewsListItem } from '../../types/news';

// Editorial categories share a restrained palette; server colors do not
// turn ordinary information into success/warning messages.
function categoryTone(category: string): string {
  if (/инцидент|incident/iu.test(category)) return 'bg-warning-500/10 text-warning-300';
  if (/локаци|location/iu.test(category)) return 'bg-dark-700 text-info';
  if (/обновлен|update/iu.test(category)) return 'bg-accent-500/10 text-accent-300';
  if (/новост|news|тариф|tariff/iu.test(category)) return 'bg-accent-500/10 text-accent-400';
  return 'bg-dark-700 text-dark-300';
}

interface FilterTabsProps {
  categories: string[];
  active: string;
  onChange: (category: string) => void;
}

const FilterTabs = memo(function FilterTabs({ categories, active, onChange }: FilterTabsProps) {
  const { t } = useTranslation();
  const haptic = useHapticFeedback();
  const primary = [/новост|news/iu, /обновлен|update/iu, /локаци|location/iu]
    .map((pattern) => categories.find((category) => pattern.test(category)))
    .filter((category): category is string => category !== undefined);
  const remaining = categories.filter((category) => !primary.includes(category));
  const moreActive = remaining.includes(active);
  const choose = (category: string) => {
    haptic.selectionChanged();
    onChange(category);
  };
  const tabClass = (selected: boolean) => cn(
    'flex min-h-10 min-w-0 items-center justify-center rounded-lg px-1.5 py-2 text-[11px] font-medium transition-colors sm:px-3 sm:text-xs',
    selected
      ? 'bg-selected text-accent-300 ring-1 ring-inset ring-accent-500/30'
      : 'text-dark-300 hover:bg-elevated hover:text-dark-50 active:bg-surface-hover',
  );

  return (
    <div className="flex items-center gap-1 rounded-xl bg-inset p-1" role="group" aria-label={t('news.title')}>
      <button type="button" aria-pressed={active === ''} onClick={() => choose('')} className={cn(tabClass(active === ''), 'flex-auto')}>
        {t('news.filterAll')}
      </button>
      {primary.map((category) => (
        <button key={category} type="button" aria-pressed={active === category} onClick={() => choose(category)} className={cn(tabClass(active === category), 'flex-auto')} title={category}>
          <span className="truncate">{category}</span>
        </button>
      ))}
      {remaining.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={cn(tabClass(moreActive), 'max-w-[6rem] gap-1')} title={moreActive ? active : undefined}>
              <span className="truncate">{moreActive ? active : t('news.moreCategories', 'Ещё')}</span>
              <ChevronDownIcon className="h-3 w-3 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40">
            <DropdownMenuRadioGroup value={active} onValueChange={choose}>
              {remaining.map((category) => (
                <DropdownMenuRadioItem key={category} value={category}>{category}</DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
});

interface NewsCardProps {
  item: NewsListItem;
  onClick: () => void;
  featured?: boolean;
}

const NewsCard = memo(function NewsCard({ item, onClick, featured = false }: NewsCardProps) {
  const { t, i18n } = useTranslation();
  return (
    <article
      role="link"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'group flex h-full min-w-0 cursor-pointer flex-col rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-elevated active:bg-surface-hover sm:p-[18px]',
        featured && 'border-l-2 border-l-accent-500/60',
      )}
    >
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className={cn('rounded-md px-2 py-1 text-[11px] font-medium leading-tight', categoryTone(item.category))}>
          {item.category}
        </span>
        {item.tag && <span className="text-xs text-dark-400">{item.tag}</span>}
      </div>
      <h3 className="break-words text-[17px] font-semibold leading-snug text-dark-50 transition-colors group-hover:text-accent-300 [overflow-wrap:anywhere]">
        {item.title}
      </h3>
      {item.excerpt && <p className="mt-2 break-words text-sm leading-relaxed text-dark-400 [overflow-wrap:anywhere]">{item.excerpt}</p>}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-4 text-xs leading-relaxed text-dark-400">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {item.published_at && <time dateTime={item.published_at}>{new Date(item.published_at).toLocaleDateString(i18n.language)}</time>}
          <span>{item.read_time_minutes} {t('news.readTime')}</span>
        </div>
        <span className="inline-flex items-center gap-1.5 font-medium text-accent-400">
          {t('news.readMore')}<ArrowIcon />
        </span>
      </div>
    </article>
  );
});

const NewsCardWrapper = memo(function NewsCardWrapper({ item, onCardClick, featured = false }: {
  item: NewsListItem;
  onCardClick: (slug: string) => void;
  featured?: boolean;
}) {
  const handleClick = useCallback(() => onCardClick(item.slug), [item.slug, onCardClick]);
  return <NewsCard item={item} onClick={handleClick} featured={featured} />;
});

const NEWS_LIMIT = 6;

export default function NewsSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const haptic = useHapticFeedback();
  const [filter, setFilter] = useState<string>('');
  const [limit, setLimit] = useState(NEWS_LIMIT);
  const categoryParam = filter || undefined;
  const { data, isLoading } = useQuery({
    queryKey: ['news', 'list', categoryParam, limit],
    queryFn: () => newsApi.getNews({ category: categoryParam, limit, offset: 0 }),
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
  });
  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const total = data?.total ?? 0;
  const categories = data?.categories ?? [];
  const { featured, regular } = useMemo(() => ({
    featured: items.find((item) => item.is_featured),
    regular: items.filter((item) => !item.is_featured),
  }), [items]);
  const handleCardClick = useCallback((slug: string) => {
    haptic.buttonPress();
    navigate(`/news/${slug}`);
  }, [haptic, navigate]);
  const handleLoadMore = useCallback(() => {
    haptic.buttonPress();
    setLimit((previous) => previous + NEWS_LIMIT);
  }, [haptic]);
  const handleFilterChange = useCallback((category: string) => {
    setFilter(category);
    setLimit(NEWS_LIMIT);
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="space-y-4" aria-label={t('news.title')}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-selected text-accent-400"><NewsIcon className="h-[18px] w-[18px]" /></span>
        <h2 className="text-base font-semibold text-dark-100">{t('news.title')}</h2>
      </div>
      {categories.length > 0 && <FilterTabs categories={categories} active={filter} onChange={handleFilterChange} />}
      <div className="space-y-3">
        {featured && <NewsCardWrapper item={featured} onCardClick={handleCardClick} featured />}
        {regular.length > 0 && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:[&>*:last-child:nth-child(odd)]:col-span-2">
          {regular.map((item) => <NewsCardWrapper key={item.id} item={item} onCardClick={handleCardClick} />)}
        </div>}
      </div>
      {!isLoading && items.length < total && <button type="button" onClick={handleLoadMore} className="btn-secondary w-full sm:w-auto">
        {t('news.loadMore')}<ChevronDownIcon className="h-4 w-4" />
      </button>}
    </section>
  );
}
