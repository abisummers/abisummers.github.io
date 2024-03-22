import { defineCollection, z } from "astro:content";

const alphabet = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    letter: z.string(),
  }),
});

export const collections = {
  alphabet,
};
