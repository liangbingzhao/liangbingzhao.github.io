import { parse } from '@retorquere/bibtex-parser';
import type { ImageMetadata } from 'astro';
import bibSource from '../data/papers.bib?raw';
import { site } from '../site.config';

export interface Author {
  name: string;
  isSelf: boolean;
  /** Marked with `*` in the bib file (equal contribution). */
  equal: boolean;
}

export interface PaperLink {
  label: string;
  href: string;
}

export interface Paper {
  key: string;
  title: string;
  authors: Author[];
  /** Full venue name (booktitle or journal). */
  venue: string;
  /** Short badge, e.g. "ICCV 2025". */
  badge: string;
  year: number;
  links: PaperLink[];
  preview?: ImageMetadata;
  selected: boolean;
  abstract?: string;
}

const previews = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/publication_preview/*.{jpg,jpeg,png,webp,gif,avif}',
  { eager: true },
);

function findPreview(file?: string): ImageMetadata | undefined {
  if (!file) return undefined;
  const hit = Object.entries(previews).find(([path]) => path.endsWith(`/${file}`));
  return hit?.[1].default;
}

const VENUES: [RegExp, string][] = [
  [/international conference on computer vision|\bICCV\b/i, 'ICCV'],
  [/computer vision and pattern recognition|\bCVPR\b/i, 'CVPR'],
  [/european conference on computer vision|\bECCV\b/i, 'ECCV'],
  [/international conference on learning representations|\bICLR\b/i, 'ICLR'],
  [/international conference on machine learning|\bICML\b/i, 'ICML'],
  [/neural information processing systems|\bNeurIPS\b/i, 'NeurIPS'],
  [/\bAAAI\b/i, 'AAAI'],
  [/nature communications/i, 'Nat. Commun.'],
];

function shortVenue(venue: string, abbr?: string): string {
  if (abbr) return abbr;
  for (const [re, short] of VENUES) if (re.test(venue)) return short;
  return venue;
}

// Link fields supported in the bib file (same names as al-folio).
const LINK_FIELDS: [string, string][] = [
  ['html', 'Paper'],
  ['arxiv', 'arXiv'],
  ['pdf', 'PDF'],
  ['code', 'Code'],
  ['website', 'Project'],
  ['supp', 'Supp'],
  ['poster', 'Poster'],
  ['slides', 'Slides'],
  ['video', 'Video'],
  ['blog', 'Blog'],
];

function linkHref(field: string, value: string): string {
  if (field === 'arxiv' && !/^https?:/.test(value)) return `https://arxiv.org/abs/${value}`;
  if (/^https?:|^\//.test(value)) return value;
  return `/assets/pdf/${value}`;
}

function toAuthor(creator: { firstName?: string; lastName?: string; name?: string }): Author {
  const raw = creator.name ?? [creator.firstName, creator.lastName].filter(Boolean).join(' ');
  const equal = raw.includes('*');
  const first = (creator.firstName ?? '').replace(/\*/g, '').trim();
  const last = (creator.lastName ?? '').replace(/\*/g, '').trim();
  const name = raw.replace(/\*/g, '').trim();
  const isSelf = first === site.self.first && last === site.self.last;
  return { name, isSelf, equal };
}

function loadPapers(): Paper[] {
  const lib = parse(bibSource, { sentenceCase: false, caseProtection: false });
  if (lib.errors.length) {
    throw new Error(`papers.bib: ${lib.errors.map((e) => e.error).join('; ')}`);
  }
  const papers = lib.entries.map((entry, index) => {
    const f = entry.fields as Record<string, any>;
    const venue: string = f.booktitle ?? f.journal ?? f.publisher ?? '';
    const year = Number(f.year) || 0;
    const links = LINK_FIELDS.filter(([field]) => typeof f[field] === 'string' && f[field]).map(
      ([field, label]) => ({ label, href: linkHref(field, f[field]) }),
    );
    return {
      index,
      paper: {
        key: entry.key,
        title: f.title ?? '',
        authors: (f.author ?? []).map(toAuthor),
        venue,
        badge: `${shortVenue(venue, f.abbr)} ${year || ''}`.trim(),
        year,
        links,
        preview: findPreview(f.preview),
        selected: String(f.selected).toLowerCase() === 'true',
        abstract: f.abstract,
      } satisfies Paper,
    };
  });
  // Newest first; keep the file order within a year.
  papers.sort((a, b) => b.paper.year - a.paper.year || a.index - b.index);
  return papers.map((p) => p.paper);
}

export const papers = loadPapers();
export const selectedPapers = papers.filter((p) => p.selected);

export function papersByYear(): [number, Paper[]][] {
  const groups = new Map<number, Paper[]>();
  for (const p of papers) groups.set(p.year, [...(groups.get(p.year) ?? []), p]);
  return [...groups.entries()];
}
