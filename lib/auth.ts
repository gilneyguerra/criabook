import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { profiles } from "@/lib/db/schema";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  // Rate limit por IP em banco (serverless não compartilha memória entre
  // instâncias). Janela em segundos.
  rateLimit: {
    enabled: true,
    storage: "database",
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 3600, max: 3 },
      "/request-password-reset": { window: 3600, max: 3 },
      "/send-verification-email": { window: 3600, max: 3 },
    },
  },
  advanced: {
    // A Vercel sobrescreve estes cabeçalhos com o IP real do cliente (não
    // falsificáveis). Sem IP resolvido, o better-auth junta TODOS num único
    // contador por rota — o limite de login valeria para o site inteiro.
    ipAddress: {
      ipAddressHeaders: ["x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"],
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Ao criar o usuário, cria o profile de produto (saldo de créditos etc.).
        after: async (newUser) => {
          await db
            .insert(profiles)
            .values({ id: newUser.id, displayName: newUser.name })
            .onConflictDoNothing();
        },
      },
    },
  },
  // OAuth (opcional) — habilitar quando as chaves estiverem definidas:
  // socialProviders: {
  //   github: {
  //     clientId: process.env.GITHUB_CLIENT_ID!,
  //     clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  //   },
  // },
});
