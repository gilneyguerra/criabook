# Plano de Execução por Etapas — CriaBook (Gerador de Livros por IA)

> Plano operacional derivado de `PLANO_DE_IMPLEMENTACAO_GERADOR_DE_LIVROS_IA.md`.
> Objetivo deste documento: transformar a especificação em **fases pequenas, testáveis e com critério de aceite**, prontas para alimentar o Claude Code uma de cada vez.
> Estado atual do repositório: **vazio** (sem código, sem commits). Tudo abaixo é construção do zero.

---

## 0. Decisões de ambiente (resolver ANTES de codar)

Como a máquina é corporativa (sem instalação local) e o registry npm fica bloqueado na rede, o desenvolvimento **não roda local**. Estratégia:

- **IDE/execução:** GitHub Codespaces (Node + npm liberados no container) ou build direto na Vercel.
- **Banco/Auth/Storage:** projeto Supabase na nuvem (free tier para começar).
- **Deploy:** Vercel conectado ao repositório GitHub (preview por branch).
- **Segredos:** `.env.local` no Codespaces + Environment Variables na Vercel. Nunca commitar chaves.
- **Modelos:** confirmar strings versionadas em `docs.claude.com` antes do 1º deploy (`claude-sonnet-4-6`, `claude-haiku-4-5-20251001`).

> ⚠️ Antes de qualquer push que dispare build na Vercel, registrar/consultar lições aprendidas (padrão já adotado em outros projetos).

---

## Como usar este plano

- Uma fase por vez. Só avança quando o **critério de aceite** da fase atual passar.
- Cada fase termina em commit + push + preview Vercel verde.
- Fases 0–6 entregam o **MVP vendável** (gera livro, edita, versiona, cobra créditos). 7–11 são incremento. 12 é opcional e sensível.

---

## Fase 0 — Fundação do projeto
**Objetivo:** esqueleto Next.js rodando com Supabase e Auth.
**Entregáveis:**
- Next.js 15 (App Router, TS) + Tailwind + shadcn/ui inicializados.
- Estrutura de pastas conforme §5 do spec.
- Clients Supabase (`lib/supabase/client.ts` e `server.ts`).
- Auth por e-mail/OAuth: telas de login e cadastro em pt-BR.
- Dashboard protegido (lista vazia de livros) com middleware de sessão.
**Critério de aceite:** criar conta → logar → ver dashboard vazio; rota protegida redireciona não autenticado.
**Dependências:** Fase 0 do ambiente concluída.

## Fase 1 — Modelo de dados
**Objetivo:** todo o schema da §4 versionado e seguro.
**Entregáveis:**
- Migrations SQL em `supabase/migrations/` com todas as tabelas (`profiles`, `books`, `book_meta`, `chapters`, `chapter_images`, `story_beats`, `versions`, `keywords`, `credit_ledger`, `generation_jobs`, `exports`).
- **RLS ativada** em todas as tabelas (cada usuário só vê o que é seu).
- Extensão `vector` habilitada + índice `ivfflat` em `keywords`.
- Tipos TS compartilhados gerados do schema (`supabase gen types`) em `types/`.
**Critério de aceite:** migrations aplicam sem erro; tentativa de ler livro de outro usuário é bloqueada pela RLS; CRUD básico de `books` funciona pelo client autenticado.
**Dependências:** Fase 0.

## Fase 2 — Créditos + Stripe
**Objetivo:** usuário compra créditos e o saldo controla as gerações.
**Entregáveis:**
- Stripe Checkout para pacotes de crédito.
- Webhook `api/stripe/webhook/route.ts` → grava em `credit_ledger` e atualiza `profiles.credits_balance` (idempotente por event id).
- `lib/credits.ts`: débito/crédito + fórmula configurável por env (`CREDITS_PER_1K_*`, `CREDITS_PER_IMAGE`).
- Bloqueio de operação quando saldo estimado é insuficiente.
**Critério de aceite:** compra de teste (modo test) credita saldo; webhook reprocessado não duplica; débito reduz saldo corretamente.
**Dependências:** Fase 1.

## Fase 3 — Construtor de prompt (keywords compartilhadas)
**Objetivo:** montar o `book_brief` clicando/criando palavras-chave.
**Entregáveis:**
- UI em `studio/[bookId]/prompt/` com categorias (gênero, personagem, plot-twist, tom, ambientação, tema).
- Sugestões geradas pelo Haiku (`ANTHROPIC_MODEL_FAST`).
- Persistência em `keywords` com `embedding` (pgvector); dedupe semântico incrementa `usage_count` em vez de duplicar.
- Saída: objeto `book_brief` (JSON) salvo no livro.
**Critério de aceite:** escolher categoria → recebe N sugestões; criar keyword nova salva com embedding; keyword semanticamente igual não duplica.
**Dependências:** Fases 1 e (idealmente) 2.

## Fase 4 — Geração de capítulo com streaming
**Objetivo:** núcleo do produto — IA escreve com efeito de digitação.
**Entregáveis:**
- `api/generate/route.ts`: stream SSE com Anthropic SDK (`ANTHROPIC_MODEL_MAIN`).
- `lib/ai/claude.ts` (wrapper streaming + retries) e `lib/ai/prompts.ts` (templates: estrutura, capítulo, resumo).
- Cliente em `studio/[bookId]/write/`: insere tokens progressivamente + `scrollIntoView` (efeito digitação).
- Parada por `page_target` (~280 palavras/página) → muda `status` para `review`.
- Grava `tokens_used` em `chapters` e debita créditos.
- Progresso via Supabase Realtime.
**Critério de aceite:** gerar um capítulo → texto aparece em streaming, para na meta de páginas, status vira `review`, créditos debitados, tokens registrados.
**Dependências:** Fases 2, 3.

## Fase 5 — Editor + chat de edição contextual
**Objetivo:** localizar → substituir → rolar, via instrução em linguagem natural.
**Entregáveis:**
- Editor TipTap (ProseMirror) carregando `content_json`.
- Chat na base do editor; Claude retorna **só JSON** `{find, replace, chapter_id, reason}` (structured output).
- Front localiza range exato (API do ProseMirror), substitui, `scrollIntoView`, destaca a mudança.
- Edição maior ("reescreva cap. 3 mais sombrio") dispara regeneração com streaming (reusa Fase 4).
- Cada edição cria nova versão (gancho para Fase 6).
**Critério de aceite:** instruir substituição de trecho → app acha, troca, rola e destaca; texto inexistente retorna erro tratado.
**Dependências:** Fase 4.

## Fase 6 — Versionamento, log e rollback
**Objetivo:** histórico imutável estilo "log de deploy".
**Entregáveis:**
- `lib/versioning.ts`: snapshot + diff (`jsondiffpatch`) gravados em `versions` a cada alteração relevante.
- Tela `studio/[bookId]/versions/`: lista cronológica (rótulo, data, autor, resumo do diff).
- Rollback restaura estado e **gera novo registro** (histórico nunca destruído).
**Critério de aceite:** editar gera versão; rollback volta o conteúdo e cria entrada nova no log.
**Dependências:** Fase 5.

> ✅ **Fim do MVP vendável.** Validar com usuários reais antes de seguir.

## Fase 7 — Roadmap / Mapa da história
**Objetivo:** beats estruturados visualizáveis e editáveis.
**Entregáveis:**
- Geração de `story_beats` (JSON) pelo Claude.
- React Flow em `studio/[bookId]/roadmap/`: nós clicáveis/arrastáveis.
- Editar nó → atualiza beat, opcionalmente regenera capítulo vinculado, cria versão.
**Critério de aceite:** gerar beats → ver no grafo; editar nó persiste e (se vinculado) regenera capítulo.
**Dependências:** Fases 4, 6.

## Fase 8 — Geração de imagens
**Objetivo:** ilustrações de capa/capítulos com consistência visual.
**Entregáveis:**
- `lib/ai/images.ts`: roteador por tipo (Flux 2 Pro / GPT Image 2 / Imagen 4) via Replicate ou fal.
- `api/images/route.ts`; salvar no Supabase Storage; metadados em `chapter_images`.
- "Style token" do livro reinjetado em todos os prompts.
- Débito de crédito por imagem.
**Critério de aceite:** gerar imagem → aparece no capítulo, salva no Storage, crédito debitado, estilo consistente entre imagens.
**Dependências:** Fases 2, 4.

## Fase 9 — Designer de capa
**Objetivo:** editor gráfico de capa com camadas.
**Entregáveis:**
- Canvas Konva (react-konva) em `studio/[bookId]/cover/`: texto, fontes, cores, imagens, camadas.
- Estado salvo em `book_meta.cover_design` (jsonb).
- Dedicatória e contracapa editáveis (texto) em `book_meta`.
**Critério de aceite:** montar capa → salvar → reabrir mantém o layout; dedicatória/contracapa persistem.
**Dependências:** Fase 8 (usa imagens geradas).

## Fase 10 — Exportação final
**Objetivo:** "Finalizar produção" gera os 3 formatos.
**Entregáveis:**
- `lib/export/pdf.ts` (Paged.js + Playwright/Chromium), `print.ts` (Typst, print-ready com sangria), `epub.ts` (epub-gen-memory).
- `api/export/route.ts`: gera em paralelo, salva em `exports`, devolve URLs assinadas.
- Aplica capa, contracapa, dedicatória, sumário e número de página na posição escolhida (`page_number_position`); miolo numerado.
**Critério de aceite:** exportar → 3 arquivos baixáveis com paginação correta e capa/dedicatória nos lugares certos.
**Dependências:** Fases 6, 9.

## Fase 11 — Jobs longos (Trigger.dev)
**Objetivo:** tirar geração pesada do limite de função serverless.
**Entregáveis:**
- Jobs em `trigger/` para geração de livro inteiro (retry + progresso).
- Progresso publicado via Realtime; UI mostra "capítulo X de Y".
- `generation_jobs` atualizado (status, progress, tokens, custo).
**Critério de aceite:** disparar geração longa → roda fora do request, progresso atualiza em tempo real, retry em falha.
**Dependências:** Fases 4, 8, 10.

## Fase 12 (opcional, sensível) — Módulo 18+
**Objetivo:** conteúdo adulto **com compliance**, em fluxo segregado.
**Pré-requisitos legais/técnicos (não improvisar — ver §13 do spec):**
- Verificação de idade real (não só checkbox); LGPD: minimizar/criptografar/reter dados.
- Flag `is_adult`, bloqueio para não verificados, consentimento explícito.
- Roteamento de IA para provedor que permita o conteúdo (a política da Anthropic pode restringir).
- Processador de pagamento especializado (CCBill/Verotel) — Stripe restringe.
- **Bloqueio absoluto:** jamais conteúdo sexual com menores.
**Critério de aceite:** acesso negado sem verificação; billing segregado; auditoria de idade.
**Dependências:** produto geral validado (Fases 0–11).

---

## Riscos a monitorar continuamente
- **Custo de IA** (texto + imagem): medir tokens por livro e calibrar precificação antes de divulgar preço.
- **Tempo de função Vercel:** mitigado por geração em blocos (Fase 4) e Trigger.dev (Fase 11).
- **Consistência narrativa:** usar resumos comprimidos dos capítulos anteriores no contexto.
- **Direitos autorais / LGPD:** orientar usuário a conteúdo original; política de privacidade desde a Fase 0.
- **Nomes de modelo mudam:** sempre strings versionadas + checar docs antes de deploy.

## Ordem recomendada de entrega
`0 → 1 → 2 → 3 → 4 → 5 → 6` (MVP) → validar → `7 → 8 → 9 → 10 → 11` → (se fizer sentido) `12`.
