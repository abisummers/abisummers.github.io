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

const museum = defineCollection({
  type: "content",
  schema: ({ image }) =>
    z.object({
      museumName: z.string(),
      exhibitionName: z.string(),
      intro: z.string(),
      startDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
        message: "Invalid date format",
      }),
      endDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
        message: "Invalid date format",
      }),
      dateVisited: z.string().refine((date) => !isNaN(Date.parse(date)), {
        message: "Invalid date format",
      }),
      ticketCost: z.number().min(0),
      country: z.string().length(2),
      title: z.string(),
      publishedDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
        message: "Invalid date format",
      }),
      image: image(),
    }),
});

export const collections = {
  alphabet,
  guide,
  museum,
};
