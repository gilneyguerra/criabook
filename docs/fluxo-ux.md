# Fluxo de criação e navegação (CriaBook)

Implementa `FLUXO_E_UX_CRIABOOK.md`: ordena as ferramentas como um caminho,
funde Base+Bíblia e encadeia as etapas.

## Navegação (header)

```
Dashboard │ 1 Base & Bíblia │ 2 Mapa │ 3 Escrita │ 4 Revisão │ 5 Páginas │ 6 Exportar │ Versões
└utilitário┘ └────────────────────── fluxo numerado ──────────────────────┘ └utilitário┘
```

- [studio/[bookId]/_components/studio-nav.tsx](../app/studio/[bookId]/_components/studio-nav.tsx): nav numerada, estado ativo (`usePathname`) e indicador ✓/●/○. Dashboard e Versões são utilitários (separados).
- [lib/studio/progress.ts](../lib/studio/progress.ts) `getStudioProgress`: marca "✓" quando o mínimo da etapa está satisfeito — 1: logline+gênero+perfil+≥1 personagem; 2: ≥1 beat; 3: ≥1 capítulo; 4: sem contradição hard aberta; 5: nome do autor; 6: pronto p/ exportar. Calculado no [layout.tsx](../app/studio/[bookId]/layout.tsx).

## Etapa 1 — Base & Bíblia (fusão)

Rota `/prompt` (rótulo "1 Base & Bíblia"); `/bible` **redireciona** para cá.
[foundation-studio.tsx](../app/studio/[bookId]/prompt/_components/foundation-studio.tsx)
renderiza, em grid `repeat(auto-fit,minmax(300px,1fr))` (2 colunas em telas largas,
empilha no mobile): **Base** (`PromptBuilder`, embedded) à esquerda e **Bíblia**
(`BibleManager`, embedded) à direita.

Geração por IA (grava na Bíblia → RAG, que já alimenta geração e consistência):
- **Cascata:** "✨ Gerar mundo a partir da base" → `generateWorld` → `generateBible` (Haiku) → `insertBibleEntry` + `indexBibleEntry`.
- **Por seção:** "✨ Gerar" em Personagens/Locais/Regras/Linha do tempo → `generateBibleSection`.
- **Por campo:** "✨ Sugerir" em logline/público/tom → `suggestFieldAction` (não persiste; preenche o campo).

## Encadeamento

[next-step.tsx](../app/studio/[bookId]/_components/next-step.tsx) — botão
"Próximo: <etapa> →" no rodapé de cada etapa: Base→Mapa, Mapa→Escrita,
Escrita→Revisão (link na toolbar do editor), Revisão→Páginas, Páginas→Exportar,
Exportar→Concluir. O fluxo é trilho sugerido; a navegação pelo header é livre.

## Etapa 6 — Exportar

Nova rota `/export` ([export-panel.tsx](../app/studio/[bookId]/export/_components/export-panel.tsx)):
**EPUB** funcionando (usa o Perfil de diagramação); **PDF de impressão** e
**Validar (EPUBCheck)** como "em breve" (worker — Fase 2). O botão EPUB saiu da
toolbar da Escrita.

## Ajustes finos

- **Itálico real:** [lib/tiptap.ts](../lib/tiptap.ts) `textToDoc` converte
  `*itálico*`/`**negrito**` em marks; `docToText` serializa de volta (round-trip
  ao salvar). [lib/render/semantic.ts](../lib/render/semantic.ts) converte ênfase
  em `<em>`/`<strong>` no EPUB.
- **Tooltips:** "Humanizar seleção" = estilo da prosa; "Normalizar" = caracteres
  tipográficos (aspas/travessão/reticências).

## Sem mudança de dados

Reaproveita modelos e endpoints existentes (Bíblia, `saveBrief`, `/api/export`,
ledgers do motor de consistência). Nenhuma migration nova nesta entrega.
