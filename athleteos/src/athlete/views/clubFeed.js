export const SOCIAL_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export function validateSocialImage(file) {
  if (!file) return null;
  if (!file.type?.startsWith("image/")) return "Choisis un fichier image.";
  if (file.size > SOCIAL_IMAGE_MAX_BYTES) return "Image trop volumineuse (10 Mo maximum).";
  return null;
}

export function filterClubPosts(posts, filter, athleteId) {
  if (filter === "photos") return posts.filter(post => Boolean(post.image_url));
  if (filter === "highlights") return posts.filter(post => post.auto_type === "record" || post.auto_type === "goal");
  if (filter === "mine") return posts.filter(post => post.athlete_id === athleteId);
  return posts;
}
