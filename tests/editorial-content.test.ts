import { describe, expect, it } from "vitest";

import { editorialPosts } from "@/lib/content/editorial-posts";

describe("DawaSetu editorial posts", () => {
  it("ships reviewed pharmacy and medicine guides with usable SEO metadata", () => {
    expect(editorialPosts.length).toBeGreaterThanOrEqual(3);
    expect(new Set(editorialPosts.map((post) => post.slug)).size).toBe(
      editorialPosts.length,
    );

    for (const post of editorialPosts) {
      expect(post.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(post.title.length).toBeGreaterThan(20);
      expect(post.summary.length).toBeGreaterThan(40);
      expect(post.seo_title.length).toBeLessThanOrEqual(200);
      expect(post.seo_description.length).toBeLessThanOrEqual(320);
      expect(post.sections.length).toBeGreaterThanOrEqual(2);
      expect(post.content).not.toMatch(/<\/?[a-z][^>]*>/i);
    }
  });

  it("uses HTTPS references from trusted health authorities only", () => {
    const sourceHosts = editorialPosts.flatMap((post) =>
      post.sources.map((source) => {
        const url = new URL(source.url);
        expect(url.protocol).toBe("https:");
        return url.hostname;
      }),
    );

    expect(sourceHosts).toEqual(
      expect.arrayContaining(["www.who.int", "cdsco.mohfw.gov.in"]),
    );
  });
});
