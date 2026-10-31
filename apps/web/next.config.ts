import type { NextConfig } from "next";
import path from "node:path";

// Un único .env en la raíz del monorepo, compartido con el worker.
try {
  process.loadEnvFile(path.resolve(process.cwd(), "../../.env"));
} catch {
  /* sin .env: en producción las variables vienen del entorno */
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ["@riftlens/core", "@riftlens/db", "@riftlens/riot"],
  serverExternalPackages: ["@libsql/client", "libsql"],
  images: {
    // Data Dragon y CommunityDragon ya sirven imágenes pequeñas y cacheadas.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "ddragon.leagueoflegends.com" },
      { protocol: "https", hostname: "raw.communitydragon.org" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
