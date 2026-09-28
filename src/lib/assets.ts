import type { ImageMetadata } from 'astro';

const images = import.meta.glob<{ default: ImageMetadata }>('../assets/*.{jpg,jpeg,png,webp,avif,gif}', {
  eager: true,
});

/** Resolves an image in src/assets/ by file name, e.g. "prof_pic.jpg". */
export function asset(file: string): ImageMetadata {
  const hit = Object.entries(images).find(([path]) => path.endsWith(`/${file}`));
  if (!hit) throw new Error(`Image not found in src/assets/: ${file}`);
  return hit[1].default;
}
