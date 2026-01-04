import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/providers/*.ts"],
  outDir: "dist",

  format: ["esm"],
  target: "es2022",

  dts: true,
  sourcemap: true,
  clean: true,

  // 🚨 IMPORTANT: Don't bundle SDK provider
  external: ["openai", "groq-sdk", "@google/genai"],

  // ESM friendly
  splitting: true,
  treeshake: true,
});
