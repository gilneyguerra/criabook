// Trava do workflow migrate: só migra um banco que já é o de produção do
// CriaBook (tabelas do app + baseline registrada). Evita aplicar o schema
// inteiro num banco vazio por causa de um secret apontando para o lugar errado.
import pg from "pg";

const url = process.env.DATABASE_URL_UNPOOLED;
const client = new pg.Client({ connectionString: url });
await client.connect();
const { rows } = await client.query(`
  SELECT to_regclass('public.books') IS NOT NULL AS has_books,
         to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS has_journal
`);
const { has_books, has_journal } = rows[0];
let applied = 0;
if (has_journal) {
  const r = await client.query("SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations");
  applied = r.rows[0].n;
}
await client.end();

const host = new URL(url).hostname;
console.log(`host=${host} books=${has_books} journal=${has_journal} applied=${applied}`);
if (!has_books || !has_journal || applied < 1) {
  console.error("::error::O banco de destino não parece ser a produção do CriaBook (sem tabelas do app ou sem baseline). Confira o secret DATABASE_URL_UNPOOLED.");
  process.exit(1);
}
