import { getCollection } from 'astro:content';
import { filterPublishedPrograms } from "@lib/programPublished";

export async function getAllPrograms() {
  return filterPublishedPrograms(await getCollection("programas"));
}

export async function getSchoolBySlug(slug: string) {
  const escuelas = await getAllPrograms();
  return escuelas.find(e => e.id === slug);
}