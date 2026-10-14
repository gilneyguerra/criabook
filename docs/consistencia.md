# Motor de Consistência e Continuidade (CriaBook)

Implementa `REGRAS_CONSISTENCIA_CRIABOOK.md`. Combate os 4 modos de falha
(alucinação, repetição, incoerência temporal, perda de memória) com **memória
estruturada resgatável** + **dois laços** + **atualização de estado**.

## Arquitetura (Fase 1)

```
Antes de gerar o cap. N  ──▶  LAÇO PREVENTIVO (Contexto Ancorado + grounding)
                                   │ capítulo gerado (stream)
                                   ▼
strip [NOVO_FATO]/[LACUNA] ──▶ normaliza ──▶ salva ──▶ ATUALIZA ESTADO
                                                          (extração Haiku → ledgers + snapshot)

Sob comando (/check)     ──▶  LAÇO DETECTOR (confronta resumos × ledgers → issues)
```

## Camada de memória (ledgers)

| Tabela | Papel |
|---|---|
| `canon_facts` | Fatos atômicos com proveniência (`established_in_chapter`, `status active/retconned`). |
| `character_knowledge` | Quem sabe o quê, desde qual capítulo. |
| `plot_threads` | Promessas narrativas abertas/fechadas. |
| `described_items` | O que já foi descrito por extenso (anti-redescrição). |
| `world_state_snapshots` | "Foto" do mundo ao fim do cap. N + resumo rolante cumulativo. |
| `consistency_issues` | Violações detectadas (tipo/severidade/proveniência/status). |
| `timeline_events` (estendida) | Event Ledger: `order`=storyOrder, `chapter_ref`=narrativeChapter, +participants/location/story_time. |

Código: [lib/memory/ledgers.ts](../lib/memory/ledgers.ts) (CRUD) · [lib/memory/state.ts](../lib/memory/state.ts) (snapshot + resumo rolante).

## Laço preventivo — [lib/generate/context.ts](../lib/generate/context.ts)
`buildAnchoredContext` monta o **Contexto Ancorado** (híbrido): determinístico
(cânone, regras, conhecimento, fios, BEAT_ATUAL, descritos, evitar-aberturas,
timeline, estado) + RAG ([lib/ai/rag.ts](../lib/ai/rag.ts)). O bloco de
disciplina `GROUNDING_SYSTEM` ([lib/ai/prompts.ts](../lib/ai/prompts.ts)) entra
no system prompt e impõe: só usar fatos do contexto, marcar `[LACUNA:…]`,
registrar `[NOVO_FATO:…]`, respeitar timeline/conhecimento, não repetir.

## Atualização de estado — [lib/generate/extract.ts](../lib/generate/extract.ts)
Após gerar (rota [app/api/generate/route.ts](../app/api/generate/route.ts)):
`stripMarkers` captura/remove os marcadores; `extractChapterState` (Haiku,
síncrono — cabe nos 60s) extrai fatos/eventos/conhecimento/descritos/fios;
`persistExtraction` grava os ledgers + `world_state_snapshots`. `[LACUNA]` vira
issue soft (pendência ao autor).

## Laço detector — [lib/verify/continuity.ts](../lib/verify/continuity.ts) + `/check`
`runContinuityCheck` monta o contexto a partir dos **ledgers** (fonte de
verdade) + Bíblia + resumos e confronta via Claude
([lib/ai/claude.ts](../lib/ai/claude.ts) `checkConsistency`), gerando issues com
`type` (hallucination/repetition/timeline/knowledge/thread), `severity`
(hard/soft) e `conflictsWith` (proveniência). A página
[/check](../app/studio/[bookId]/check) **persiste** as issues e oferece
**resolver/ignorar** e, em issues hard com capítulo, **"corrigir trecho"**
(auto-revisão dirigida via `reviseChapterForIssue`, criando uma versão antes).
Mostra também os fios de trama e uma linha do tempo navegável.

## Migração de banco

Rode no SQL Editor do Neon (idempotente):

```sql
-- lib/db/legacy/0003_consistency.sql (histórico)
-- cria enums + canon_facts, character_knowledge, plot_threads,
-- world_state_snapshots, described_items, consistency_issues
-- e estende timeline_events (participants, location, story_time, caused_by)
```

## Decisões (Fase 1)
- **Extração síncrona** (Haiku) na geração; **verificação sob comando** (botão Revisar, persistindo).
- **Issues hard**: sinalizar + **"corrigir trecho"** (auto-revisão dirigida sob comando).

## Fase 2 (worker + embedding, deferida)
- Anti-repetição por embedding (`style_phrases` vector 1024) + `lib/verify/repetition.ts`.
- Checks de timeline automáticos (`lib/verify/timeline.ts`: ordem causal, conhecimento, presença, física).
- Revalidação incremental na edição (rastreio de dependências).
- Varredura batch (`lib/jobs/sweep.ts`, Trigger.dev).
