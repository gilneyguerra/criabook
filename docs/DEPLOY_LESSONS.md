# Lições de Deploy — CriaBook

> Consultar e atualizar **antes de cada push que dispare build na Vercel**.
> Como o npm é bloqueado na rede local, o `npm install`/build só acontece na Vercel/Codespaces — então erros de dependência aparecem lá.

## 2026-06-01 — Conflito de peer dependency: better-auth × drizzle-kit
**Erro:** `npm install` falhou na Vercel com `ERESOLVE`:
`better-auth@1.6.13` declara `peerOptional drizzle-kit@">=0.31.4"`, mas o projeto fixava `drizzle-kit@^0.30.1` (resolvido como 0.30.6).
**Causa:** versões do ecossistema Drizzle desalinhadas com o que o Better Auth espera.
**Correção:** alinhar o par Drizzle e subir o piso do Better Auth:
- `drizzle-orm` → `^0.44.2`
- `drizzle-kit` → `^0.31.4`
- `better-auth` → `^1.6.13`
**Lição:** ao adicionar libs com peers (Better Auth, Drizzle), conferir os ranges de peer dependency entre elas antes do push. Sem lockfile commitado, o npm resolve do zero na Vercel — os ranges do `package.json` precisam ser coerentes.

## 2026-06-01 — Segundo conflito: better-auth adapter × drizzle-orm
**Erro:** `@better-auth/drizzle-adapter@1.6.13` declara `peerOptional drizzle-orm@"^0.45.2"`, mas o projeto tinha `drizzle-orm@^0.44.2` (resolvido 0.44.7).
**Correção:** `drizzle-orm` → `^0.45.2`.
**Lição:** o piso do `drizzle-orm` é ditado pelo **adapter** do Better Auth, não só pelo `drizzle-kit`. Ao subir `better-auth`, alinhar `drizzle-orm` ao peer do adapter (`@better-auth/drizzle-adapter`), não apenas ao `drizzle-kit`.

## 2026-06-01 — Webpack: 'DEFAULT_MIGRATION_TABLE' is not exported from 'kysely'
**Erro:** build do Next falhou no webpack ao empacotar
`@better-auth/kysely-adapter/dist/node-sqlite-dialect.mjs` (cadeia `lib/auth.ts` → `api/auth/[...all]`): `Attempted import error: 'DEFAULT_MIGRATION_TABLE' is not exported from 'kysely'`.
**Causa:** o `better-auth` referencia internamente um adapter Kysely (dialeto `node:sqlite`) que não usamos (usamos Drizzle/Postgres). O webpack tenta empacotar esse caminho server-only e quebra na resolução ESM.
**Correção:** em `next.config.ts`, `serverExternalPackages: ["better-auth", "@better-auth/kysely-adapter"]` — Next não empacota; o Node resolve em runtime.
**Lição:** libs server-only com cadeias de dependência opcionais (auth, db) costumam precisar entrar em `serverExternalPackages` no Next 15 em vez de serem empacotadas pelo webpack.

## 2026-06-01 — Vercel: No Output Directory named "public"
**Erro:** o build do Next concluiu (rotas compiladas), mas a Vercel falhou no final: `No Output Directory named "public" found`.
**Causa:** o **Framework Preset** do projeto na Vercel estava como "Other" (não "Next.js"), então procurava uma pasta `public` em vez do output `.next`.
**Correção:** `vercel.json` com `{"framework":"nextjs"}` + setar **Framework Preset = Next.js** em Vercel → Settings → Build & Deployment (e deixar Output Directory no padrão, não "public").
**Lição:** se o build do Next passa mas a Vercel reclama de output dir, é detecção de framework — não código. Garantir Framework Preset = Next.js.

## 2026-06-01 — Vercel: "Vulnerable version of Next.js detected"
**Erro:** a Vercel bloqueou o deploy: `Vulnerable version of Next.js detected, please update immediately`.
**Causa:** `next@15.1.3` tem CVEs conhecidos — destaque para CVE-2025-29927 (bypass de autorização no middleware, corrigido no 15.2.3). Como o app usa middleware para proteger rotas, é crítico.
**Correção:** `next` e `eslint-config-next` → `^15.5.0` (bem além dos patches).
**Lição:** fixar Next em versão patcheada desde o início; a Vercel barra versões vulneráveis. Conferir advisories antes de pinar uma versão exata.
