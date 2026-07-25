import { defineCollection, defineConfig, createDefaultImport } from "@content-collections/core";
import { z } from "zod";

const posts = defineCollection({
  name: "posts",
  directory: "content/posts",
  include: "**/*.mdx",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.string(),
    thumbnail: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
  transform: async (document) => {
    // Generate static import path for Vite MDX plugin to handle compilation,
    // thereby avoiding dynamic EvalError in Cloudflare Workers environment.
    const mdxContent = createDefaultImport(`../../content/posts/${document._meta.filePath}`);
    return {
      ...document,
      mdxContent,
      slug: document._meta.path,
    };
  },
});

export default defineConfig({
  collections: [posts],
});
