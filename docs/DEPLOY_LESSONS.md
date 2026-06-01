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
