# Diagramação e formatação (CriaBook)

Implementa `REGRAS_DIAGRAMACAO_CRIABOOK.md`. Princípio mestre:
**conteúdo ≠ apresentação** — a IA gera texto/markup semântico limpo; o
**Perfil de Layout** dirige toda a apresentação.

## Camadas

| Camada | Onde | O que faz |
|---|---|---|
| Perfil de Layout | [lib/layout/profile.ts](../lib/layout/profile.ts) | `BookLayoutProfile` + presets (`romance-br-14x21`, `naoficcao-16x23`, `paperback-6x9-us`). `getLayoutProfile(id, type)` resolve com fallback por tipo. |
| Normalizador (Camada A) | [lib/text/normalizer.ts](../lib/text/normalizer.ts) | Função pura `normalize(text, profile)` sobre texto puro: aspas curvas, travessão de diálogo, meia-risca em intervalos, reticências, sem espaço duplo/antes de pontuação. Preserva compostos (`guarda-chuva`) e estrutura de parágrafos. Nunca insere letter-spacing. |
| Render semântico | [lib/render/semantic.ts](../lib/render/semantic.ts) | Deriva XHTML semântico do texto puro: `<section class="chapter" lang>`, `<h1>`, `<p class="first">`, `.dialogue`. `epubCss(profile)` monta o CSS reflowable. |
| EPUB | [lib/export/epub.ts](../lib/export/epub.ts) | EPUB 3 (`epub-gen-memory`) com render semântico + CSS do Perfil + `lang` + sumário navegável. |

## Onde encaixa no fluxo

- **Geração** ([app/api/generate/route.ts](../app/api/generate/route.ts)): o stream ao cliente é cru (efeito de digitação); ao concluir, o texto é **normalizado** antes de salvar/indexar/versão. O `done` devolve `contentText` normalizado e o editor sincroniza.
- **Humanizar** ([app/api/humanize/route.ts](../app/api/humanize/route.ts)): a saída é normalizada e devolvida no `done`; o cliente substitui o trecho cru pelo normalizado.
- **Botão "Normalizar"** ([writing-studio.tsx](../app/studio/[bookId]/write/_components/writing-studio.tsx) → `normalizeChapter` em [write/actions.ts](../app/studio/[bookId]/write/actions.ts)): cria uma **versão** do estado anterior (rollback) e salva o normalizado. Não roda em autosave.
- **Wizard** ([prompt-builder.tsx](../app/studio/[bookId]/prompt/_components/prompt-builder.tsx)): seletor de Perfil de Layout (default pelo tipo do livro); persistido em `books.layoutProfileId`.

## Conflito reconciliado — Humanizer × tipografia PT-BR

O `HUMANIZER_SYSTEM` (regra do blader, em inglês) proibia travessões e aspas
curvas. Em PT-BR o **diálogo exige travessão (—)** e citações usam **aspas
curvas**. O prompt foi reconciliado ([lib/ai/prompts.ts](../lib/ai/prompts.ts)):
desencoraja travessão como muleta de pausa na narração, mas **preserva** o
travessão de diálogo e as aspas curvas.

## Migração de banco

Rode no SQL Editor do Neon:

```sql
-- lib/db/legacy/0002_layout.sql (histórico)
ALTER TABLE books ADD COLUMN IF NOT EXISTS layout_profile_id text;
```

## Rodar os testes (normalizador)

O registry npm é bloqueado na máquina local — rode em Codespaces/CI/Vercel:

```bash
npm install
npm run test      # vitest run — cobre cada regra tipográfica
```

## Fase 2 — Publicação profissional (worker, deferida)

Não roda em função serverless da Vercel; entra com worker (Trigger.dev) ou
serviço de render dedicado:

- `lib/render/print.ts` — CSS `@page` (trim+sangria, medianiz `:left/:right`,
  fólios, running heads, capítulo em recto), Paged.js + Puppeteer; páginas par.
- PDF/X-1a (Ghostscript, fontes embutidas, CMYK/grayscale, 300 DPI).
- `lib/validate/epubcheck.ts` — EPUBCheck (Java); bloqueia export em erro crítico.
- Capa JPG 2500×3500 anexada (liga-se ao designer de capa).
