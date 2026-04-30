import { getCollection } from 'astro:content';

export async function getAllPrograms() {
  const escuelas = await getCollection('programas');
  return escuelas;
}

export async function getSchoolBySlug(slug: string) {
  const escuelas = await getAllPrograms();
  return escuelas.find(e => e.id === slug);
}