# Plano de Execução por Etapas — CriaBook (stack Neon)

> Plano operacional derivado de `PLANO_DE_IMPLEMENTACAO_GERADOR_DE_LIVROS_IA.md`.
> **Atualização:** a stack de dados migrou de **Supabase** para **Neon (Postgres serverless)**.
> Cada fase tem **passo a passo**, **critério de aceite** e **dependências**, prontas para alimentar o Claude Code uma de cada vez.

---

## Mudança de stack: Supabase → Neon

O Supabase entregava 4 serviços num só. O Neon entrega **só o Postgres** (com `pgvector` e branching). Substituímos o resto:

| O que o Supabase fazia | Substituto na stack Neon | Observação |
|---|---|---|
| Postgres | **Neon** (serverless, branching, pgvector) | Driver `@neondatabase/serverless` |
| ORM / acesso a dados | **Drizzle ORM** | Schema + migrations em TypeScript, tipos compartilhados |
| Auth | **Better Auth** | Usuários no **próprio** banco Neon (adapter Drizzle); e-mail/senha + OAuth |
| Storage (imagens, exports) | **Vercel Blob** | Nativo da Vercel; URLs assinadas (a partir da Fase 8) |
| Realtime (progresso) | **SSE + polling** (TanStack Query) | Sem serviço extra; geração já usa SSE |
| **RLS** (segurança por linha) | **Autorização na aplicação** | Toda query do Drizzle é escopada pelo `userId` da sessão (ver §Segurança) |

### Segurança sem RLS (importante)
Sem o `auth.uid()` do Supabase, **não** confiamos em RLS do banco. Em vez disso:
- Toda Server Action / Route Handler obtém o usuário da sessão (Better Auth) **no servidor**.
- Todo acesso a dados do usuário passa por helpers que **forçam** `where owner_id = session.userId`.
- Nunca expor `DATABASE_URL` no cliente; queries só no servidor.
- (Opcional avançado, futuro) Neon Authorize + `pg_session_jwt` para RLS real com JWT.

---

## 0. Ambiente e contas (resolver ANTES de codar)

Máquina corporativa sem instalação local e registry npm bloqueado → desenvolvimento **não roda local**.

**Passo a passo:**
1. **GitHub:** repo `gilneyguerra/criabook` ✅ (já criado e conectado).
2. **Vercel:** importar o repo → deploy automático a cada push (Produção na `main`, Preview nas branches).
3. **Neon:** criar conta em https://neon.com → **New Project** (região mais próxima; ex.: AWS sa-east-1) → copiar as connection strings (pooled e direct).
4. **Vercel ↔ Neon (recomendado):** usar a **integração nativa Vercel + Neon** (Vercel Marketplace) — ela injeta `DATABASE_URL` automaticamente e cria um branch de banco por Preview. Alternativa: colar as strings manualmente nas env vars.
5. **Segredos:** `.env.local` no Codespaces + Environment Variables na Vercel. Nunca commitar chaves.
6. **Modelos Claude:** confirmar strings versionadas em `docs.claude.com` antes do 1º deploy.

> ⚠️ Antes de qualquer push que dispare build, registrar/consultar lições de deploy.

---

## Variáveis de ambiente (stack Neon)

```bash
# --- Banco (Neon) ---
DATABASE_URL=                 # connection string POOLED (-pooler) — uso em runtime
DATABASE_URL_UNPOOLED=        # connection string DIRECT — uso em migrations

# --- Better Auth ---
BETTER_AUTH_SECRET=           # gerar: openssl rand -base64 32
BETTER_AUTH_URL=              # URL pública do app (ex.: https://criabook.vercel.app)
# OAuth opcional (Fase 0/1+):
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# --- App ---
NEXT_PUBLIC_APP_URL=          # mesma URL pública

# --- IA (Claude) — Fase 3+ ---
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL_MAIN=claude-sonnet-4-6
ANTHROPIC_MODEL_FAST=claude-haiku-4-5-20251001

# --- IA de imagem — Fase 8 ---
REPLICATE_API_TOKEN=          # ou FAL_KEY

# --- Storage — Fase 8 ---
BLOB_READ_WRITE_TOKEN=        # Vercel Blob

# --- Pagamentos — Fase 2 ---
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# --- Jobs — Fase 11 ---
TRIGGER_SECRET_KEY=

# --- Precificação (ajustável) — Fase 2 ---
CREDITS_PER_1K_INPUT_TOKENS=1
CREDITS_PER_1K_OUTPUT_TOKENS=5
CREDITS_PER_IMAGE=20
```

---

## Como usar este plano
- Uma fase por vez; só avança quando o **critério de aceite** passa.
- Cada fase termina em commit + push + preview Vercel verde.
- Fases 0–6 entregam o **MVP vendável**. 7–11 são incremento. 12 é opcional e sensível.

---

## Fase 0 — Fundação (Next.js + Drizzle + Neon + Better Auth)
**Objetivo:** esqueleto rodando com banco Neon conectado e Auth funcional.

**Passo a passo:**
1. Next.js 15 (App Router, TS) + Tailwind v4 + shadcn/ui. *(já feito)*
2. Instalar libs de dados/auth: `drizzle-orm @neondatabase/serverless`, `drizzle-kit` (dev), `better-auth`.
3. Configurar Drizzle:
   - `lib/db/index.ts` → cria o client Neon (`drizzle(neon(process.env.DATABASE_URL))`).
   - `lib/db/schema.ts` → schema (começa com as tabelas do Better Auth).
   - `drizzle.config.ts` → aponta para o schema e usa `DATABASE_URL_UNPOOLED` nas migrations.
4. Configurar Better Auth:
   - `lib/auth.ts` → `betterAuth({ database: drizzleAdapter(db,{provider:'pg'}), emailAndPassword:{enabled:true} })`.
   - `lib/auth-client.ts` → client para o front.
   - `app/api/auth/[...all]/route.ts` → handler do Better Auth.
   - Gerar/!mesclar as tabelas de auth no schema (`npx @better-auth/cli generate`) e migrar.
5. Telas pt-BR de **login** e **cadastro** usando o auth-client.
6. **Middleware** protegendo `/dashboard` e `/studio` via checagem de sessão do Better Auth (tolerante à ausência de `DATABASE_URL` no 1º deploy).
7. **Dashboard** protegido listando livros (tolerante à tabela ainda inexistente).
8. Rodar a 1ª migration contra o Neon.

**Critério de aceite:** criar conta → logar → ver dashboard; rota protegida redireciona não autenticado; usuário persiste no Neon (tabela `user`).
**Dependências:** ambiente + Neon criado.

> 🔁 **Refactor desta fase:** o código atual usa Supabase. Será substituído por Neon/Drizzle/Better Auth nesta mesma fase.

## Fase 1 — Modelo de dados (Drizzle + pgvector)
**Objetivo:** todo o schema da §4 do spec em Drizzle, migrado no Neon.

**Passo a passo:**
1. Habilitar extensão vetorial: migration com `CREATE EXTENSION IF NOT EXISTS vector;`.
2. Definir em `lib/db/schema.ts` as tabelas: `profiles` (FK → `user.id` do Better Auth, com `credits_balance`, `birth_date`, `is_adult_verified`), `books`, `book_meta`, `chapters`, `chapter_images`, `story_beats`, `versions`, `keywords` (coluna `embedding vector(1536)`), `credit_ledger`, `generation_jobs`, `exports`.
3. Índice `ivfflat`/`hnsw` em `keywords.embedding` para busca por similaridade.
4. `drizzle-kit generate` → revisar SQL → `drizzle-kit migrate` (ou `push`) no Neon.
5. Helpers de autorização em `lib/db/queries.ts`: toda leitura/escrita recebe `userId` e filtra por `owner_id` (substitui a RLS).
6. Hook pós-cadastro: ao criar usuário no Better Auth, criar a linha em `profiles` (`databaseHooks`).

**Critério de aceite:** migrations aplicam no Neon; criar/listar `books` só retorna os do usuário logado; inserir `keyword` com embedding funciona; query por similaridade retorna vizinhos.
**Dependências:** Fase 0.

## Fase 2 — Créditos + Stripe
**Objetivo:** usuário compra créditos; saldo controla gerações.

**Passo a passo:**
1. Pacotes de crédito + Stripe Checkout (`app/api/stripe/checkout/route.ts`).
2. Webhook `app/api/stripe/webhook/route.ts` (idempotente por `event.id`) → grava `credit_ledger` e atualiza `profiles.credits_balance`.
3. `lib/credits.ts`: débito/crédito + fórmula por env (`CREDITS_PER_1K_*`, `CREDITS_PER_IMAGE`); tudo em transação Drizzle.
4. Guard `assertEnoughCredits(userId, estimate)` antes de qualquer operação de IA.

**Critério de aceite:** compra em modo test credita saldo; webhook reprocessado não duplica; débito reduz saldo em transação.
**Dependências:** Fase 1.

## Fase 3 — Construtor de prompt (keywords compartilhadas)
**Objetivo:** montar o `book_brief` clicando/criando palavras-chave.

**Passo a passo:**
1. UI `studio/[bookId]/prompt/` com categorias (gênero, personagem, plot-twist, tom, ambientação, tema).
2. Sugestões via Haiku (`ANTHROPIC_MODEL_FAST`) em `app/api/keywords/suggest/route.ts`.
3. Embeddings: gerar `embedding` da nova keyword; **dedupe semântico** (busca pgvector por similaridade > limiar → incrementa `usage_count` em vez de duplicar).
4. Persistir `book_brief` (JSON) no `books`/`book_meta`.

**Critério de aceite:** categoria → N sugestões; keyword nova salva com embedding; keyword semanticamente igual não duplica (incrementa contador).
**Dependências:** Fase 1 (e idealmente 2).

## Fase 4 — Geração de capítulo com streaming
**Objetivo:** núcleo do produto — IA escreve com efeito de digitação.

**Passo a passo:**
1. `lib/ai/claude.ts` (Anthropic SDK, streaming + retries) e `lib/ai/prompts.ts` (estrutura/capítulo/resumo).
2. `app/api/generate/route.ts`: stream SSE (`ANTHROPIC_MODEL_MAIN`).
3. `studio/[bookId]/write/`: insere tokens no editor com efeito de digitação + `scrollIntoView`.
4. Parada por `page_target` (~280 palavras/página) → `status = review`.
5. Gravar `tokens_used` em `chapters` e debitar créditos.
6. **Progresso:** polling com TanStack Query em `generation_jobs` (substitui Realtime).

**Critério de aceite:** gerar capítulo → texto em streaming, para na meta, status `review`, créditos debitados, progresso atualiza.
**Dependências:** Fases 2, 3.

## Fase 5 — Editor + chat de edição contextual
**Objetivo:** localizar → substituir → rolar via linguagem natural.

**Passo a passo:**
1. Editor TipTap carregando `content_json`.
2. Chat na base; Claude retorna **só JSON** `{find, replace, chapter_id, reason}` (structured output) via `app/api/edit/route.ts`.
3. Front acha o range exato (API ProseMirror), substitui, `scrollIntoView`, destaca.
4. Edição grande dispara regeneração com streaming (reusa Fase 4).
5. Cada edição cria uma versão (gancho Fase 6).

**Critério de aceite:** instrução de substituição → acha, troca, rola e destaca; trecho inexistente trata erro.
**Dependências:** Fase 4.

## Fase 6 — Versionamento, log e rollback
**Objetivo:** histórico imutável estilo "log de deploy".

**Passo a passo:**
1. `lib/versioning.ts`: snapshot + diff (`jsondiffpatch`) → `versions` a cada alteração relevante.
2. Tela `studio/[bookId]/versions/`: lista cronológica (rótulo, data, autor, resumo do diff).
3. Rollback restaura estado e **gera novo registro** (histórico nunca destruído).

**Critério de aceite:** editar gera versão; rollback volta o conteúdo e cria nova entrada no log.
**Dependências:** Fase 5.

> ✅ **Fim do MVP vendável.** Validar com usuários reais antes de seguir.

## Fase 7 — Roadmap / Mapa da história
**Passo a passo:** gerar `story_beats` (JSON) com Claude → React Flow em `studio/[bookId]/roadmap/` (nós clicáveis) → editar nó atualiza beat, opcionalmente regenera capítulo vinculado, cria versão.
**Critério de aceite:** beats no grafo; editar nó persiste e (se vinculado) regenera capítulo.
**Dependências:** Fases 4, 6.

## Fase 8 — Geração de imagens (+ Vercel Blob)
**Passo a passo:**
1. `lib/ai/images.ts`: roteador por tipo (Flux 2 Pro / GPT Image 2 / Imagen 4) via Replicate/fal.
2. `app/api/images/route.ts`; upload no **Vercel Blob** (`@vercel/blob`); metadados em `chapter_images`.
3. "Style token" do livro reinjetado em todos os prompts; débito por imagem.
**Critério de aceite:** gerar imagem → aparece, salva no Blob, crédito debitado, estilo consistente.
**Dependências:** Fases 2, 4.

## Fase 9 — Designer de capa
**Passo a passo:** Konva (react-konva) em `studio/[bookId]/cover/` (texto, fontes, cores, imagens, camadas) → estado em `book_meta.cover_design` (jsonb) → dedicatória/contracapa editáveis.
**Critério de aceite:** montar capa → salvar → reabrir mantém layout; dedicatória/contracapa persistem.
**Dependências:** Fase 8.

## Fase 10 — Exportação final
**Passo a passo:**
1. `lib/export/pdf.ts` (Paged.js + Playwright), `print.ts` (Typst), `epub.ts` (epub-gen-memory).
2. `app/api/export/route.ts`: gera em paralelo, salva no **Vercel Blob**, devolve URLs.
3. Aplica capa, contracapa, dedicatória, sumário e número de página (`page_number_position`); miolo numerado.
**Critério de aceite:** exportar → 3 arquivos baixáveis com paginação e capa corretas.
**Dependências:** Fases 6, 9.

## Fase 11 — Jobs longos (Trigger.dev)
**Passo a passo:** mover geração pesada para `trigger/` (retry + progresso) → atualizar `generation_jobs` → UI faz polling do progresso ("capítulo X de Y").
**Critério de aceite:** geração longa roda fora do request, progresso atualiza, retry em falha.
**Dependências:** Fases 4, 8, 10.

## Fase 12 (opcional, sensível) — Módulo 18+
Conteúdo adulto **com compliance**, fluxo segregado (ver §13 do spec): verificação de idade real (LGPD), flag `is_adult`, bloqueio para não verificados, roteamento de IA para provedor permitido, processador de pagamento especializado (Stripe restringe), **nunca** conteúdo com menores.
**Dependências:** produto geral validado (0–11).

---

## Riscos a monitorar
- **Cold start / conexões serverless:** usar a connection string **pooled** do Neon em runtime e a **direct** só em migrations.
- **Custo de IA:** medir tokens por livro; calibrar precificação antes de divulgar preço.
- **Autorização sem RLS:** todo acesso a dados deve passar pelos helpers escopados por `userId` (revisar em code review).
- **Tempo de função Vercel:** geração em blocos (Fase 4) + Trigger.dev (Fase 11).
- **Consistência narrativa:** resumos comprimidos dos capítulos anteriores no contexto.
- **Nomes de modelo mudam:** strings versionadas + checar docs antes do deploy.

## Ordem recomendada
`0 → 1 → 2 → 3 → 4 → 5 → 6` (MVP) → validar → `7 → 8 → 9 → 10 → 11` → (se fizer sentido) `12`.
