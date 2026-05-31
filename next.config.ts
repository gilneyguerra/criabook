import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Supabase Storage (imagens de capítulos/capa) — ajustar host após criar o projeto.
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
