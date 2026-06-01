import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

import * as schema from "./schema";

// Fallback bem-formado para o build/preview não quebrar caso DATABASE_URL
// ainda não esteja definida. Qualquer query só funciona com a URL real do Neon.
const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://placeholder:placeholder@localhost/placeholder";

const sql = neon(connectionString);

export const db = drizzle(sql, { schema });
