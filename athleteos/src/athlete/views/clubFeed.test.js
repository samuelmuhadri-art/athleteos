import { describe, expect, it } from "vitest";
import { filterClubPosts, SOCIAL_IMAGE_MAX_BYTES, validateSocialImage } from "./clubFeed";

const posts = [
  { id: 1, athlete_id: 7, image_url: "photo.jpg", auto_type: null },
  { id: 2, athlete_id: 3, image_url: null, auto_type: "record" },
  { id: 3, athlete_id: 7, image_url: null, auto_type: "goal" },
];

describe("filterClubPosts", () => {
  it("filtre les photos, exploits et publications personnelles", () => {
    expect(filterClubPosts(posts, "photos", 7).map(post => post.id)).toEqual([1]);
    expect(filterClubPosts(posts, "highlights", 7).map(post => post.id)).toEqual([2, 3]);
    expect(filterClubPosts(posts, "mine", 7).map(post => post.id)).toEqual([1, 3]);
  });
});

describe("validateSocialImage", () => {
  it("accepte une image raisonnable et refuse les fichiers invalides", () => {
    expect(validateSocialImage({ type: "image/jpeg", size: 2_000_000 })).toBeNull();
    expect(validateSocialImage({ type: "application/pdf", size: 2_000 })).toMatch(/image/i);
    expect(validateSocialImage({ type: "image/png", size: SOCIAL_IMAGE_MAX_BYTES + 1 })).toMatch(/10 Mo/i);
  });
});
