import { unified } from "unified";
import rehypeParse from "rehype-parse";
import { toString } from "hast-util-to-string";

export const stripHtml = async (html: string) =>
  toString(unified().use(rehypeParse, { fragment: true }).parse(html));
