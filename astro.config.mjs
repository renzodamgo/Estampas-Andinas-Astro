// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import vercel from "@astrojs/vercel";

// https://astro.build/config
export default defineConfig({
  output: "static",
  vite: {
    plugins: [tailwindcss()],
    build: {
      // Older Android WebViews and iOS 11+: transpile ?. and ?? down.
      target: ["chrome61", "safari11", "firefox60"],
    },
  },
  adapter: vercel({
    webAnalytics: { enabled: true },
    imageService: true,
  }),
});
