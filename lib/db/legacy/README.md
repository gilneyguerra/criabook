# SQL legado (somente histórico)

Estes arquivos criaram o schema de produção antes das migrations do Drizzle
(rodados à mão no SQL Editor do Neon). **Não rode mais nenhum deles.**

A partir da Fase 0 do plano de correções, a fonte da verdade é
`lib/db/schema.ts`, e toda mudança de banco vira migration gerada com
`npm run db:generate` em `lib/db/migrations/` (a `0000_baseline` reproduz o
estado atual). Produção recebe as migrations via `npm run db:migrate`.
