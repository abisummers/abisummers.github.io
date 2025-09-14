import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import mdx from "@astrojs/mdx";
import { algolia } from "./plugins/index-to-algolia";

// set to false if you want faster local builds
const optimiseImages = true;

// https://astro.build/config
export default defineConfig({
  cacheDir: "./cache",
  trailingSlash: "always",
  site: "https://abisummers.com",
  i18n: {
    defaultLocale: "en",
    locales: ["en", "fr"],
  },
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: "en",
        locales: {
          en: "en",
          fr: "fr",
        },
      },
    }),
    mdx(),
    process.env.ALGOLIA_WRITE_KEY &&
      algolia({
        appId: "1AWHE68HXJ",
        apiKey: process.env.ALGOLIA_WRITE_KEY,
        indexName: "abisummers.com",
      }),
  ],
  ...(optimiseImages === false
    ? {
        image: {
          service: passthroughImageService(),
        },
      }
    : {}),
});
