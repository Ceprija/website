import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';

export function getPostSlug(post: CollectionEntry<'revista'>): string {
  return post.data.slug ?? post.id;
}

export async function getAllPosts() {
  const posts = await getCollection('revista');
  return posts;
}

export async function getSortedPosts() {
  const posts = await getAllPosts();

  return posts.sort(
    (a, b) =>
      new Date(b.data.date).getTime() -
      new Date(a.data.date).getTime()
  );
}

export async function getLatestPosts(limit = 3) {
  const posts = await getSortedPosts();
  return posts.slice(0, limit);
}

export async function getPostBySlug(slug: string) {
  const posts = await getAllPosts();
  return posts.find(p => getPostSlug(p) === slug);
}