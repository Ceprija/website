import { getCollection, type CollectionEntry } from 'astro:content';

export type FacultyEntry = CollectionEntry<'docentes'>;

/**
 * Returns published faculty members sorted by their explicit `order` field.
 * Drafts are filtered out so they never appear in listings or detail routes.
 */
export async function getFacultyMembers(): Promise<FacultyEntry[]> {
  const all = await getCollection('docentes');
  return all
    .filter((m) => !m.data.draft)
    .sort((a, b) => a.data.order - b.data.order);
}

export async function getFacultyMemberBySlug(
  slug: string
): Promise<FacultyEntry | undefined> {
  const members = await getFacultyMembers();
  return members.find((m) => m.slug === slug);
}
