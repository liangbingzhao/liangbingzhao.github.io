import { parse } from 'yaml';
import cvSource from '../data/cv.yml?raw';

// Same structure as al-folio's _data/cv.yml.
export type CvDescription = string | { title: string; contents: string[] };

export interface CvTimeEntry {
  title?: string;
  institution?: string;
  year?: string | number;
  description?: CvDescription[];
  items?: string[];
}

export type CvSection =
  | { title: string; type: 'map'; contents: { name: string; value: string }[] }
  | { title: string; type: 'time_table'; contents: CvTimeEntry[] }
  | { title: string; type: 'nested_list'; contents: { title: string; items: string[] }[] }
  | { title: string; type: 'list'; contents: string[] };

export const cv = parse(cvSource) as CvSection[];

export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
