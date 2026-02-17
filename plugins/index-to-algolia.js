import { compile } from "html-to-text";
import { readFile } from "node:fs/promises";
import algoliasearch from "algoliasearch";

/**
 * Algolia Astro Plugin
 * For now, it uses a simple HTML to text conversion (not the AST)
 *
 * @param {object} options
 * @param {string} options.appId - Algolia App ID
 * @param {string} options.apiKey - Algolia Write API Key
 * @param {string} options.indexName - Algolia Index Name
 *
 * @returns {import("astro").AstroIntegration}
 */
export function algolia({ appId, apiKey, indexName }) {
  const convert = compile({
    baseElements: {
      selectors: ["main"],
    },
    selectors: [
      {
        selector: "h1",
        format: "skip",
      },
      {
        selector: "a",
        format: "inline",
      },
      {
        selector: "a.back",
        format: "skip",
      },
      ...["h2", "h3", "h4", "h5", "h6"].map((selector) => ({
        selector,
        format: "paragraph",
      })),
      {
        selector: "hr",
        format: "skip",
      },
      {
        selector: "img",
        format: "skip",
      },
    ],
  });

  const index = algoliasearch(appId, apiKey).initIndex(indexName);

  return {
    name: "algolia",
    hooks: {
      "astro:build:done": async ({ dir, pages, logger }) => {
        const files = pages
          .map((page) => ({
            objectID: page.pathname,
            pathname: page.pathname,
            location: new URL(
              page.pathname.replace(/\/$/, "") + "/index.html",
              dir,
            ),
          }))
          .filter(
            (page) =>
              page.pathname !== "404/" &&
              page.pathname !== "" &&
              page.pathname !== "/" &&
              page.pathname !== "search/",
          );

        const objects = await Promise.all(
          files.map(async (file) => {
            const content = await readFile(file.location, "utf-8");
            const text = convert(content);

            const image = content.match(
              /<meta property="og:image" content="([^"]+)">/,
            )?.[1];
            const title = content
              .match(/<title>(.+)<\/title>/)?.[1]
              ?.replace(" | Abi Summers", "");

            return {
              objectID: file.objectID,
              pathname: file.pathname,
              image,
              title,
              content: text,
            };
          }),
        );

        logger.info("Indexing to Algolia...");
        await index.saveObjects(objects);
        logger.info("Done indexing to Algolia!");
      },
    },
  };
}
