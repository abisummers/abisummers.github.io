import { test, describe, before } from "node:test";
import { readdir, readFile } from "node:fs/promises";
import { strict as assert } from "node:assert/strict";

describe("links", () => {
  let files;
  before(async () => {
    files = (await readdir("./dist", { recursive: true })).filter((file) =>
      file.endsWith(".html"),
    );
  });

  test("local links have trailing slash", async (t) => {
    const tests = files.map((file) =>
      t.test(`dist/${file}`, async () => {
        const links = await getLinks(file);
        links.forEach((link) => {
          assert.ok(
            isLinkValid(link),
            `link ${link} must end with trailing slash`,
          );
        });
      }),
    );

    await Promise.all(tests);
  });
});

function isLinkValid(link) {
  if (link === "/favicon.ico" || link === "/sitemap-index.xml") {
    return true;
  }

  if (
    link.endsWith(".css") ||
    link.endsWith(".js") ||
    link.endsWith(".webp") ||
    link.endsWith(".jpeg")
  ) {
    return true;
  }

  if (link.startsWith("/") || link.startsWith(".")) {
    // local link
    return link.endsWith("/");
  }

  return true;
}

async function getLinks(file) {
  const contents = await readFile(`./dist/${file}`);

  const regex = /href=\"([^"]*)\"/g;

  const links = [];
  let m;
  while ((m = regex.exec(contents)) !== null) {
    // This is necessary to avoid infinite loops with zero-width matches
    if (m.index === regex.lastIndex) {
      regex.lastIndex++;
    }

    links.push(m[1]);
  }

  return links;
}
