import type { MarkdownInstance } from 'astro';

interface NewsFrontmatter {
  date: string | Date;
  title?: string;
}

const modules = import.meta.glob<MarkdownInstance<NewsFrontmatter>>('../data/news/*.md', {
  eager: true,
});

/** Accepts YAML dates as well as strings like "2025-1-22". */
export function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  const m = String(value).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid news date: ${value}`);
  return d;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export const news = Object.values(modules)
  .map((m) => ({ date: toDate(m.frontmatter.date), Content: m.Content }))
  .sort((a, b) => b.date.getTime() - a.date.getTime());
