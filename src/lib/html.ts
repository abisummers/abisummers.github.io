import { unified } from "unified";
import rehypeParse from "rehype-parse";
import { toString } from "hast-util-to-string";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

export const stripHtml = async (html: string) =>
  toString(unified().use(rehypeParse, { fragment: true }).parse(html));

export const markdownToHtml = async (markdown: string) => {
  const result = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(markdown);

  return String(result);
};
