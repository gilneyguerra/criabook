import { drizzle } from "drizzle-orm/neon-http";
import { neon, neonConfig } from "@neondatabase/serverless";

import * as schema from "./schema";

// Testes/CI: `db.localtest.me` resolve para 127.0.0.1 e aponta para o proxy
// local-neon-http-proxy (Postgres em container). Em produção o host é sempre
// do Neon, então o endpoint padrão (HTTPS) segue intacto.
neonConfig.fetchEndpoint = (host) =>
  host === "db.localtest.me"
    ? `http://${host}:4444/sql`
    : `https://${host}/sql`;

// Fallback bem-formado para o build/preview não quebrar caso DATABASE_URL
// ainda não esteja definida. Qualquer query só funciona com a URL real do Neon.
const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://placeholder:placeholder@localhost/placeholder";

const sql = neon(connectionString);

export const db = drizzle(sql, { schema });
