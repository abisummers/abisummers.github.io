import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const alphabet = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: "./src/content/alphabet-ile-de-france",
  }),
  schema: z.object({
    title: z.string(),
    letter: z.string(),
    date: z.date(),
    image: z.string().optional(),
    transportLinks: z.array(z.string()).optional(),
    knownFor: z.array(z.string()).optional(),
    notablePeople: z.array(z.string()).optional(),
    whenToVisit: z.array(z.string()).optional(),
    coordinates: z.object({
      lat: z.number(),
      lng: z.number(),
    }),
  }),
});

const articles = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/articles" }),
  schema: () =>
    z.object({
      title: z.string(),
      intro: z.string().optional(),
      description: z.string().optional(),
      languages: z.array(z.string()).optional(),
      language: z.string().optional(),
      draft: z.boolean().optional(),
      image: z.string().optional(),
      publishedDate: z.date().optional(),
    }),
});

const guide = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/guide" }),
  schema: () =>
    z.object({
      title: z.string(),
      description: z.string(),
      publishedDate: z.date(),
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
      image: z.string(),
      draft: z.boolean().optional(),
      locations: z
        .array(
          z.object({
            latitude: z.number(),
            longitude: z.number(),
            title: z.string(),
            location: z.string().optional(),
            subtle: z.boolean().optional(),
          }),
        )
        .optional(),
      mapConfig: z
        .object({
          latitude: z.number().optional(),
          longitude: z.number().optional(),
          zoom: z.number().optional(),
        })
        .optional(),
      tour: z.string().optional(),
    }),
});

const museums = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/museums" }),
  schema: () =>
    z.object({
      museumName: z.string(),
      exhibitionName: z.string(),
      intro: z.string(),
      startDate: z.date(),
      endDate: z.date(),
      dateVisited: z.date(),
      ticketCost: z.number().min(0),
      country: z.string().length(2),
      title: z.string(),
      publishedDate: z.date().optional(),
      image: z.string().optional(),
      draft: z.boolean().optional(),
    }),
});

const monthlyReview = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/monthly-review" }),
  schema: z.object({
    title: z.string(),
    draft: z.boolean().optional(),
    publishedDate: z.date(),
    image: z.string().optional(),
  }),
});

const travel = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/travel" }),
  schema: z.object({
    title: z.string(),
    intro: z.string().optional(),
    type: z.string().optional(),
    tags: z.array(z.string()).optional(),
    publishedDate: z.date().optional(),
    draft: z.boolean().optional(),
    image: z.string().optional(),
  }),
});

const images = defineCollection({
  loader: glob({
    pattern: "**/*.{jpg,jpeg,png,gif,webp}",
    base: "./src/content/images",
  }),
});

const tours = defineCollection({
  type: "data",
  schema: z.object({
    name: z.string(),
    description: z.string(),
    images: z.array(z.object({ src: z.string(), alt: z.string() })),
    sections: z.array(
      z.object({
        title: z.string(),
        content: z.string(),
      }),
    ),
    price: z.object({
      base: z.number(),
      currency: z.string().default("EUR"),
      options: z.array(
        z.object({
          title: z.string(),
          name: z.string(),
          description: z.string(),
          price: z.number(),
          included: z.number(),
          unit: z.string().default(""),
          max: z.number().optional(),
        }),
      ),
    }),
  }),
});

export const collections = {
  "alphabet-ile-de-france": alphabet,
  articles,
  guide,
  museums,
  "monthly-review": monthlyReview,
  travel,
  images,
  tours,
};
