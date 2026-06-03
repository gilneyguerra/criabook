# Designer de Capa (CriaBook)

Implementa `FERRAMENTA_CAPA_CRIABOOK.md`. Princípio inegociável: **a IA gera só
a ARTE; todo TEXTO é camada editável** composta por cima (modelos de imagem
produzem tipografia ilegível).

## Fluxo

A capa é a **etapa 2** (logo após Base & Bíblia), **revisitável e não
bloqueante**: rascunha-se arte+título cedo ("o livro começa pela capa") e
regeram-se os textos comerciais depois da Escrita. Fluxo: `1 Base & Bíblia ·
2 Capa · 3 Mapa · 4 Escrita · 5 Revisão · 6 Páginas · 7 Exportar`.

## As 3 camadas ([cover-designer.tsx](../app/studio/[bookId]/cover/_components/cover-designer.tsx))

| Camada | O quê | Como |
|---|---|---|
| 1 — Arte | imagem principal / fundo | `generateCoverArt` reusa `generateImage` (Kie.ai) → rehospeda no Blob. Presets de gênero pré-preenchem estilo/paleta. Prompt instrui **não desenhar texto**. |
| 2 — Tipografia | título, subtítulo, autor, chamada, lombada | texto REAL sobre a arte: fonte, posição, cor, escala, overlay. Guardado em `covers.layout` (jsonb). |
| 3 — Textos | apresentação da 4ª capa, prova social, orelha, bio | `generateCoverText`/`generateSocialProof` (Claude) — comercial, 3ª pessoa, foco em benefício (não sinopse), puxando nomes da Bíblia. |

## Composição e export (sem sharp)

A capa de **ebook** (JPG 2500×3500) é rasterizada **no cliente**
([lib/cover/compose.ts](../lib/cover/compose.ts) `composeCoverBlob`): desenha a
arte (`crossOrigin=anonymous` do Blob, evitando *tainted canvas*) + a tipografia
num `<canvas>` → `POST /api/cover/compose` → Vercel Blob → `covers.ebook_cover_url`.
O preview ao vivo usa o **mesmo** `drawCover`, então preview == export.

Integra com:
- **Exportar (etapa 7):** `buildEpub` recebe `cover.ebookCoverUrl`.
- **Dashboard:** miniatura no card (de `getUserBooks` → `ebook_cover_url`).
- **Páginas:** `authorName` e bio ↔ `matter.aboutAuthor` (sync em `saveCover`).

## Lombada / impressão

[lib/cover/spine.ts](../lib/cover/spine.ts): `spineWidthMm = páginas × coef`
(branco 0,0572 / creme 0,0635 mm/pág; páginas estimadas dos capítulos). Exibido
no modo Impressão; recalcula quando os capítulos mudam. Orelhas desabilitadas em
`kdp_brochura`. **Confirme o coeficiente com o provedor (KDP/IngramSpark).**

## Persistência

Tabela `covers` 1:1 (migration `0004_cover.sql` — rodar no Neon). Vercel Blob via
`@vercel/blob` + `BLOB_READ_WRITE_TOKEN`. Sem o token: o designer e o preview
funcionam, mas o export do JPG avisa que precisa do Blob.

## Fase 2 (worker)
Wrap completo de impressão em **CMYK 300DPI** (4ª capa + lombada + frente [+
orelhas]) com sangria 3mm, junto do PDF/X; arte coerente da 4ª capa;
`print_wrap_url`.
