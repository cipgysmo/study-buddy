import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "pdf-parse"],
  // pdf-parse (and its pdfjs-dist + @napi-rs/canvas deps) use an `exports` map
  // that Next's file tracer prunes incorrectly. Force-include their runtime files
  // so the standalone/Docker bundle can load them.
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/pdf-parse/**/*",
      "./node_modules/pdfjs-dist/**/*",
      "./node_modules/@napi-rs/canvas/**/*",
    ],
  },
};

export default withNextIntl(nextConfig);
