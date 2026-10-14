import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    // Testes com banco passam pelo proxy HTTP; o 1º de cada arquivo paga o
    // aquecimento da conexão e os arquivos rodam em paralelo no mesmo Postgres.
    testTimeout: 20_000,
  },
});
