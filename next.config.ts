import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "pdf-parse"],
  // pdf-parse (and its pdfjs-dist + @napi-rs/canvas deps) use an `exports` map
  // that Next's file tracer prunes incorrectly. Force-include their runtime files
  // so the standalone/Docker bundle can load them. @napi-rs ships the native
  // binding in a platform package (e.g. @napi-rs/canvas-linux-x64-gnu), so trace
  // the whole @napi-rs scope — otherwise the .node binary is missing at runtime.
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/pdf-parse/**/*",
      "./node_modules/pdfjs-dist/**/*",
      "./node_modules/@napi-rs/**/*",
    ],
  },
};

export default withNextIntl(nextConfig);
