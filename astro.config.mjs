// @ts-check
import { defineConfig } from "astro/config";

import tailwind from "@astrojs/tailwind";

import vercel from "@astrojs/vercel/static";

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind()],
  output: "static",
  vite: {
    build: {
      // Older Android WebViews and iOS 11+: transpile ?. and ?? down.
      target: ["es2017", "chrome61", "safari11", "firefox60"],
    },
  },
  adapter: vercel({
    webAnalytics: { enabled: true },
    imageService: true,
  }),
});
