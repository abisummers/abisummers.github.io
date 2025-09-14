import { defineCollection, z } from "astro:content";

const alphabet = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    letter: z.string(),
  }),
});

const guide = defineCollection({
  type: "content",
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      publishedDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
        message: "Invalid date format",
      }),
      themes: z.array(
        z.enum([
          "activity",
          "architecture",
          "arrondissement",
          "food",
          "how-to",
          "kid friendly",
          "restaurants",
          "scams",
          "stories",
          "tour",
          "tourist-attraction",
          "transport",
          "walk",
          "women",
        ]),
      ),
      image: image(),
    }),
});

export const collections = {
  alphabet,
  guide,
};
