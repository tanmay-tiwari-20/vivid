'use client';

import { useEffect, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import type { SiteContent } from './lib/content-types';

export function usePublicContent(initialContent: SiteContent) {
  const [content, setContent] = useState(initialContent);
  useEffect(() => { setContent(initialContent); }, [initialContent]);
  useEffect(() => {
    let controller: AbortController | undefined;
    const refresh = async () => {
      if (document.visibilityState === 'hidden') return;
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch('/api/content', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) return;
        const next = await response.json() as SiteContent;
        if (Array.isArray(next.reels) && Array.isArray(next.creators) && Array.isArray(next.brands)) setContent(current => current.revision === next.revision ? current : next);
      } catch { /* Keep the last published content available during a connection interruption. */ }
    };
    void refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const interval = window.setInterval(refresh, 30_000);
    return () => { controller?.abort(); window.clearInterval(interval); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  return content;
}

export function ContentFilters({ query, setQuery, category, setCategory, categories, label, count }: {
  query: string; setQuery: (value: string) => void; category: string; setCategory: (value: string) => void;
  categories: string[]; label: string; count: number;
}) {
  return <div className="content-filters">
    <div className="content-search-row"><label className="content-search"><Search size={18} /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={`Find your kind of ${label}…`} aria-label={`Search ${label}`} maxLength={150} /></label><span className="content-count" aria-live="polite">{count} {label}</span></div>
    <div className="category-filters" role="group" aria-label={`Filter ${label} by category`}>{['All', ...categories.filter(value => value !== 'All')].map(value => <button key={value} aria-pressed={category === value} onClick={() => setCategory(value)} className={category === value ? 'is-active' : ''}>{value === 'All' ? 'All categories' : value}</button>)}</div>
  </div>;
}

export function EmptyContent({ title, text }: { title: string; text: string }) {
  return <div className="content-empty"><span><Sparkles size={25} strokeWidth={1.5} /></span><h3>{title}</h3><p>{text}</p></div>;
}
