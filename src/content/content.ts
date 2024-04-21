import { defineCollection, z } from "astro:content";

export const collections = {
  alphabet: defineCollection({
    type: "content",
    schema: z.object({
      title: z.string(),
      letter: z.string(),
    }),
  }),
  'paris-guide': defineCollection({
    type: "content",
    schema: z.object({
      title: z.string(),
      intro: z.string(),
    }),
  }),
};
