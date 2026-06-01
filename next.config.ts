import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Não empacotar o better-auth (e seu adapter kysely) via webpack:
  // são server-only e o bundling quebra na resolução de imports ESM.
  // O Node resolve em runtime normalmente.
  serverExternalPackages: ["better-auth", "@better-auth/kysely-adapter"],
  images: {
    remotePatterns: [
      // Vercel Blob (imagens de capítulos/capa) — usado a partir da Fase 8.
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
};

export default nextConfig;
