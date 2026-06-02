# CriaBook — Gerador de Livros por IA

App web onde o usuário paga em créditos e gera um livro completo por IA: escrita capítulo a capítulo com efeito de digitação em streaming, imagens, capa/contracapa/dedicatória, edição por chat contextual, mapa da história, versionamento com rollback e exportação (PDF web, PDF impressão, EPUB).

## Stack
- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** + **framer-motion**
- **Neon** (Postgres serverless + pgvector) via **Drizzle ORM**
- **Better Auth** (auth no próprio banco) · **Vercel Blob** (storage)
- **Claude API** (texto) · **Replicate/fal** (imagens) · **Stripe** (créditos) · **Trigger.dev** (jobs)
- Deploy: **Vercel** · Progresso de geração via **SSE + polling**

> Autorização sem RLS: toda query de dados do usuário é escopada por `userId` da sessão na camada de aplicação.

## Documentos de planejamento
- [`PLANO_DE_IMPLEMENTACAO_GERADOR_DE_LIVROS_IA.md`](./PLANO_DE_IMPLEMENTACAO_GERADOR_DE_LIVROS_IA.md) — especificação técnica completa.
- [`PLANO_DE_EXECUCAO_POR_ETAPAS.md`](./PLANO_DE_EXECUCAO_POR_ETAPAS.md) — fases de implementação com critério de aceite.

## Desenvolvimento
> A instalação de dependências roda em **GitHub Codespaces** ou no build da **Vercel** (o registry npm é bloqueado na rede local).

```bash
npm install
cp .env.example .env.local   # preencher as chaves
npm run dev
```

## Progresso por fase
- [x] **Fase 0** — Fundação: Next.js + Tailwind + shadcn + Neon/Drizzle + Better Auth + dashboard
- [x] **Fase 1** — Modelo de dados: schema Drizzle completo + pgvector + autorização por `userId` *(falta rodar a migration no Neon)*
- [x] **Fase 2** — Créditos + Stripe: checkout, webhook idempotente, saldo e débito *(falta configurar a conta/keys Stripe)*
- [ ] Fase 3 — Construtor de prompt
- [ ] Fase 4 — Geração de capítulo com streaming
- [ ] Fase 5 — Editor + chat de edição
- [ ] Fase 6 — Versionamento + rollback
- [ ] Fase 7 — Roadmap (React Flow)
- [ ] Fase 8 — Imagens
- [ ] Fase 9 — Designer de capa
- [ ] Fase 10 — Exportação
- [ ] Fase 11 — Jobs longos (Trigger.dev)
- [ ] Fase 12 — Módulo 18+ (opcional, sensível)
