import { strict as assert } from 'node:assert';
import { test } from 'node:test';

// Helper functions matching Worker logic
const cleanSlug = (slug: string) =>
  slug
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 180);

const generateRandomSuffix = (): string => {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

const createResourceSlugs = (title: string) => {
  const displaySlug = cleanSlug(title);
  const suffix = generateRandomSuffix();
  const slug = `${displaySlug}-${suffix}`;
  return { displaySlug, slug, suffix };
};

test('slug generation - sanitizes accents and special characters', () => {
  const title = 'Motores Eléctricos: Guía & Control (2° Edición)';
  const displaySlug = cleanSlug(title);
  assert.equal(displaySlug, 'motores-electricos-guia-control-2-edicion');
});

test('slug generation - two resources with identical title have same display_slug but unique slug', () => {
  const title = 'Motores Eléctricos';
  const resource1 = createResourceSlugs(title);
  const resource2 = createResourceSlugs(title);

  assert.equal(resource1.displaySlug, 'motores-electricos');
  assert.equal(resource2.displaySlug, 'motores-electricos');
  assert.notEqual(resource1.slug, resource2.slug);
  assert.match(resource1.slug, /^motores-electricos-[0-9a-f]{6}$/);
  assert.match(resource2.slug, /^motores-electricos-[0-9a-f]{6}$/);
});

test('slug generation - suffix is 6-character hexadecimal', () => {
  const { suffix } = createResourceSlugs('Automatización Industrial');
  assert.equal(suffix.length, 6);
  assert.match(suffix, /^[0-9a-f]{6}$/);
});

test('legacy fallback - display_slug defaults to slug if display_slug is null', () => {
  const legacyRow = {
    id: 'legacy-1',
    title: 'Manual de Instalaciones',
    slug: 'manual-de-instalaciones',
    display_slug: null,
  };

  const resolvedDisplaySlug = legacyRow.display_slug || legacyRow.slug;
  assert.equal(resolvedDisplaySlug, 'manual-de-instalaciones');
});
