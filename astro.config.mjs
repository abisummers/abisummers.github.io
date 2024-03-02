import { defineConfig } from "astro/config";

export default defineConfig({
  site: 'https://abisummers.com',
  i18n: {
    defaultLocale: "en",
    locales: ["en", "fr"],
    fallback: {
      fr: "en",
    },
  },
});
