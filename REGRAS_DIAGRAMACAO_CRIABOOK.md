# CriaBook — Regras de Diagramação e Formatação de Livros

> **Documento:** Especificação de regras de diagramação (typesetting) + geração de texto formatado
> **Produto:** CriaBook — Gerador de Livros (ebook + impressão) por IA
> **Versão:** 1.0 · Junho/2026
> **Objetivo:** Garantir que o CriaBook produza livros com excelência tipográfica — tanto o **texto gerado** (já em formato padrão) quanto a **diagramação final** (PDF de impressão e EPUB).
> **Nota de contexto:** O repositório `gilneyguerra/criabook` é privado e não pôde ser inspecionado. As sugestões de implementação assumem stack Next.js/Vercel + Prisma (conforme PRD anterior). Ajustar caminhos/nomes ao projeto real.

---

## Sumário

1. [Princípio de arquitetura: conteúdo ≠ apresentação](#1-princípio-de-arquitetura-conteúdo--apresentação)
2. [Camada A — Regras de geração de texto](#2-camada-a--regras-de-geração-de-texto)
3. [Camada B — Diagramação para impressão (PDF)](#3-camada-b--diagramação-para-impressão-pdf)
4. [Camada C — Diagramação para ebook (EPUB)](#4-camada-c--diagramação-para-ebook-epub)
5. [O Perfil de Layout (design tokens do livro)](#5-o-perfil-de-layout-design-tokens-do-livro)
6. [Implementação: pipelines e módulos](#6-implementação-pipelines-e-módulos)
7. [Prompt para o Claude Code](#7-prompt-para-o-claude-code)
8. [Checklists de conformidade](#8-checklists-de-conformidade)
9. [Referências](#9-referências)

---

## 1. Princípio de arquitetura: conteúdo ≠ apresentação

A regra mestra que sustenta todo o resto:

> **A IA gera estrutura semântica. O motor de diagramação aplica a apresentação.**

O texto gerado **nunca** deve conter formatação visual embutida (tamanhos de fonte, recuos manuais, espaços duplos, quebras de linha forçadas). Ele sai como **markup semântico limpo** (capítulo, parágrafo, diálogo, citação, cena). A aparência — margens, entrelinha, recuo, fonte — é decidida por um **Perfil de Layout** ([Seção 5](#5-o-perfil-de-layout-design-tokens-do-livro)) aplicado na renderização.

Por quê: o mesmo conteúdo precisa sair em **PDF de impressão** (layout fixo, paginado) e em **EPUB** (reflowable, o leitor controla fonte e tamanho). Misturar conteúdo e estilo quebra um dos dois. Esta separação é inegociável.

```
                    ┌──────────────────────┐
   Geração IA  ──▶  │  Documento Semântico │  ──▶  Normalizador tipográfico
                    │  (XHTML/Markdown      │
                    │   semântico limpo)    │
                    └──────────┬───────────┘
                               │
              ┌────────────────┴────────────────┐
              ▼                                  ▼
   ┌────────────────────┐            ┌────────────────────┐
   │  Pipeline IMPRESSÃO │            │  Pipeline EBOOK     │
   │  Perfil + CSS @page │            │  Perfil + CSS rel.  │
   │  ──▶ PDF/X          │            │  ──▶ EPUB 3.3       │
   └────────────────────┘            └────────────────────┘
```

---

## 2. Camada A — Regras de geração de texto

Regras que o **prompt de geração** e um **normalizador pós-geração** devem garantir. O objetivo é que o texto saia "pronto" — sem gambiarras de formatação.

### 2.1 Parágrafos

- **Uma ideia por parágrafo.** Cada parágrafo desenvolve um único movimento (uma ação, um beat, um argumento).
- **Variação de comprimento.** Alternar parágrafos curtos e longos cria ritmo. Evitar blocos uniformes.
- **Marcação semântica:** cada parágrafo é um elemento `<p>`. **Nunca** usar linha em branco dupla, `<br>` ou espaços para simular parágrafo.
- **Recuo vs. espaçamento — escolher UM, nunca os dois:**
  - **Ficção / narrativa:** recuo na primeira linha (`text-indent`), **sem** espaço entre parágrafos.
  - **Não-ficção / técnico:** espaço entre parágrafos, **sem** recuo.
- **Primeiro parágrafo após título/cena:** sem recuo (convenção tipográfica). Os seguintes, recuados.
- O recuo é aplicado por **CSS**, não por tabulação ou espaços no texto.

### 2.2 Diálogo (padrão PT-BR)

- Diálogo em português brasileiro usa **travessão (—, em dash)** no início da fala, **não** aspas.
  - Correto: `— Você veio mesmo. — Ela fechou a porta.`
- O verbo de elocução (dizer, perguntar) vem após travessão também.
- Aspas duplas curvas (" ") reservadas para **citações, pensamentos ou ênfase**, não para diálogo.
- Cada fala de um novo interlocutor = novo parágrafo.

### 2.3 Pontuação e caracteres tipográficos

O normalizador **deve** converter automaticamente:

| Errado (digitação) | Correto (tipográfico) |
|---|---|
| Aspas retas `"` `'` | Aspas curvas `" "` `' '` |
| Hífen para diálogo/pausa `-` `--` | Travessão `—` (em dash) |
| Hífen para intervalos `1-10` | Meia-risca `1–10` (en dash) |
| Três pontos `...` | Reticências `…` (caractere único) |
| Espaço duplo `␣␣` | Espaço único |
| Espaço antes de pontuação | Sem espaço |

- **Letter-spacing (distanciamento entre letras): proibido no corpo de texto.** Espaçar letras em blocos de leitura prejudica a legibilidade. *Tracking* só é aceitável em **títulos, versaletes (small caps) e cabeçalhos**, e ainda assim com parcimônia.
- **Versaletes:** se usados (ex.: primeira linha de capítulo), aplicar por estilo, não digitando em maiúsculas.

### 2.4 Elaboração de ideias e contexto (coerência da prosa)

- **Frase-tópico:** em não-ficção, cada parágrafo abre com a ideia central; o restante a sustenta.
- **Transições:** capítulos e cenas terminam com gancho ou fecho; o seguinte retoma o fio. Evitar cortes secos sem ponte.
- **Estrutura cena-sequência (ficção):** cena (objetivo → conflito → virada) seguida de sequência (reação → dilema → decisão). O gerador deve alternar ação e reflexão.
- **Show, don't tell:** preferir ação e detalhe sensorial concreto a afirmações abstratas de emoção.
- **Coerência de contexto:** nomes, características e fatos vêm da Bíblia da História + capítulos anteriores (RAG). O texto **não** pode contradizer o cânone estabelecido.
- **Densidade calibrada por gênero:** thriller = frases curtas e ritmo seco; fantasia = densidade descritiva; não-ficção = clareza e exemplos.

### 2.5 Estrutura de capítulo (markup que a IA emite)

```html
<section class="chapter" id="cap-3" lang="pt-BR">
  <h1 class="chapter-title">Capítulo 3 · O limiar</h1>
  <p class="first">A manhã chegou sem pressa sobre os telhados de ardósia.</p>
  <p>— Você veio mesmo — disse ela, sem se virar.</p>
  <p>O envelope sobre a mesa não tinha remetente.</p>
</section>
```

Regras de markup:
- Um capítulo = um `<section class="chapter">` (no EPUB, **um arquivo XHTML por capítulo**).
- Títulos hierárquicos reais (`<h1>`, `<h2>`), nunca parágrafo formatado como título.
- Atributo `lang` sempre presente (essencial para hifenização correta).
- Primeiro parágrafo recebe `class="first"`.
- Diálogo, citação e epígrafe com classes semânticas (`.dialogue`, `<blockquote>`, `.epigraph`).

---

## 3. Camada B — Diagramação para impressão (PDF)

Layout fixo, paginado, pronto para POD (KDP, IngramSpark, gráficas brasileiras).

### 3.1 Formato (trim size)

| Formato | Uso típico |
|---|---|
| **14 × 21 cm** | Padrão BR para romance/ficção |
| **16 × 23 cm** | Não-ficção, técnico (BR) |
| **A5 (14,8 × 21 cm)** | Genérico |
| **6 × 9 pol (15,24 × 22,86 cm)** | Padrão EUA (KDP), o paperback mais comum |
| **5 × 8 / 5,5 × 8,5 pol** | Ficção compacta |

> O formato é escolhido **antes** das margens, pois as margens dependem dele e da contagem de páginas.

### 3.2 Margens, medianiz (gutter) e sangria

- **Medianiz (gutter / margem interna):** margem extra no lado da lombada, comida pela encadernação. **Sempre maior** que a externa. Livros com menos de ~60 páginas dispensam medianiz reforçada; acima disso, é obrigatória.
- **Valores de referência (6×9, < 400 págs):** interna/medianiz **0,75 pol**, externa **0,5 pol**, superior/inferior **0,625 pol**. Para ~300 págs, medianiz pode subir para **0,75–0,9 pol**.
- A medianiz **cresce com a contagem de páginas** (mais páginas = mais "engolimento" na lombada).
- **Sangria (bleed):** **0,125 pol (3,175 mm)** — necessária **apenas** quando há imagens/elementos que vão até a borda. A página deve ser ampliada para incluir a sangria.
- **Área de segurança:** manter texto e imagens importantes a ≥ 0,5 pol da borda aparada.

### 3.3 Tipografia do miolo

- **Fonte:** serifada para corpo de texto (legibilidade em papel). Sans-serif só para títulos/elementos, com parcimônia.
- **Corpo:** **10–12 pt** (impressão).
- **Entrelinha (leading):** ~**120–145%** do corpo. Regra clássica: ~2 pt acima do corpo (11 pt → ~13 pt). A distância entre baselines = corpo + leading.
- **Comprimento de linha (medida):** **45–75 caracteres por linha**, alvo ideal **~66**. Medir em CPL, não em cm (o corpo afeta caracteres por cm). Linhas muito longas cansam; muito curtas, fragmentam.
- **Alinhamento:** **justificado** é o padrão de livros longos — **com hifenização ativada** para evitar "rios" de espaço.
- **Viúvas e órfãs:** controlar. Evitar última linha de parágrafo sozinha no topo da página (viúva) e primeira linha sozinha no rodapé (órfã). Não corrigir com linhas em branco manuais (quebram a repaginação).
- **Sem letter-spacing no corpo.** Ajustes de *tracking* só para encaixar viúvas, e mínimos.
- **Alinhamento de baseline:** linhas de páginas frente-a-frente devem se alinhar na mesma grade.

### 3.4 Páginas, fólios e cabeçalhos

- **Recto/verso:** página ímpar = recto (direita); par = verso (esquerda).
- **Capítulos começam em página recto (ímpar)** por convenção; inserir página em branco quando necessário.
- **Fólios (números de página)** e **cabeçalhos correntes** (título do livro / capítulo) configuráveis; suprimidos na primeira página de capítulo e em páginas em branco.
- **Contagem total de páginas par** (exigência de POD); adicionar página em branco no fim se necessário.

### 3.5 Ordem do front matter (impressão)

```
Falsa folha de rosto (half-title)
  → Folha de rosto (title page)
    → Página de créditos / copyright (+ ficha catalográfica/CIP e ISBN no BR)
      → Dedicatória
        → Epígrafe
          → Sumário
            → [corpo do livro]
```

Back matter: sobre o autor → agradecimentos → CTA → **disclosure de IA**.

### 3.6 Especificação do PDF de saída

- **Padrão:** **PDF/X-1a:2001** ou **PDF/X-3** (não "salvar como PDF" genérico).
- **Fontes:** 100% **embutidas**.
- **Imagens:** **300 DPI** no tamanho impresso real.
- **Espaço de cor:** **CMYK** para miolo colorido; **grayscale** para P&B.
- **Páginas individuais** (não spreads/páginas duplas).
- **Sem marcas de corte** (o POD adiciona).
- **Sem senha/proteção** no PDF.

---

## 4. Camada C — Diagramação para ebook (EPUB)

Reflowable: o **leitor** controla fonte, tamanho e tema. O CSS define **relações**, não medidas absolutas. Alvo: **EPUB 3.3** (recomendação W3C atual).

### 4.1 Regra de ouro do EPUB

> **Use unidades relativas. Nunca trave o tamanho de fonte em pixels.**

- **Corpo:** **não** definir `font-size` fixo no `body` — ou usar `1em` / `100%` para respeitar a preferência do leitor. Travar em `px` quebra a acessibilidade (WCAG 1.4.4 exige redimensionar a 200%).
- **Títulos e hierarquia:** dimensionar com **`em` ou `rem`** relativos ao corpo (ex.: `h1 { font-size: 1.8em }`).
- **Entrelinha:** `line-height` **sem unidade** (ex.: `1.5`) — escala com a fonte do leitor. Faixa de conforto **1,4–1,6**.
- **Recuo de parágrafo:** `text-indent: 1.2em` (relativo). Não combinar recuo + margem entre parágrafos.

### 4.2 CSS base do EPUB (exemplo)

```css
/* Respeita a preferência do leitor: não travar o corpo */
body {
  font-family: serif;          /* fallback; leitor pode sobrescrever */
  line-height: 1.5;
  margin: 0;
  widows: 2;                   /* suporte limitado entre leitores */
  orphans: 2;
}

p {
  margin: 0;
  text-indent: 1.2em;          /* ficção: recuo, sem espaço */
  text-align: justify;
  hyphens: auto;               /* requer lang no XHTML */
}

p.first { text-indent: 0; }    /* 1º parágrafo sem recuo */

h1, h2 { font-size: 1.6em; line-height: 1.2; text-indent: 0; margin: 1em 0; }

blockquote { margin: 1em 1.5em; font-style: italic; }

img { max-width: 100%; height: auto; }   /* nunca dimensão fixa em px */
```

### 4.3 Estrutura e empacotamento

- **Um capítulo por arquivo XHTML.**
- **Sumário navegável (NAV doc)** obrigatório — sem ele, lojas rejeitam.
- **Atributo `lang`** em cada documento (hifenização e leitores de tela).
- **Imagens em RGB** (não CMYK).
- **Fontes embutidas** opcionais; sempre com *fallback stack*. Lembrar que o leitor pode sobrescrever.
- **Evitar:** posicionamento absoluto, `letter-spacing` no corpo, larguras fixas em `px`, layouts de duas colunas.
- **Acessibilidade:** texto alternativo em imagens, hierarquia de cabeçalhos correta, contraste.
- **Capa:** JPG, ~**2500 × 3500 px** (compatível com o fluxo de capa da Amazon, que aceita JPG/TIFF).

### 4.4 Validação

- **EPUBCheck** no pipeline — é o verificador de conformidade padrão de fato da indústria. Build falha se houver erro crítico.

---

## 5. O Perfil de Layout (design tokens do livro)

O objeto de configuração que parametriza **toda** a diagramação. Um por livro (ou um preset por gênero). É o que liga conteúdo semântico à apresentação.

```typescript
// src/lib/layout/profile.ts
export interface BookLayoutProfile {
  // Identidade
  id: string;
  name: string;            // "Romance BR 14x21", "Não-ficção 16x23"
  bookType: 'fiction' | 'nonfiction';

  // Impressão
  print: {
    trim: { widthMm: number; heightMm: number };   // ex.: 140 x 210
    margins: { topMm: number; bottomMm: number; outerMm: number; gutterMm: number };
    bleedMm: number;                                // 0 ou 3.175
    bodyFont: string;                               // serifada
    bodySizePt: number;                             // 10–12
    leadingPct: number;                             // 120–145
    align: 'justify';
    hyphenation: true;
    paragraph: 'indent' | 'spaced';
    chapterStartsRecto: boolean;
    runningHeads: boolean;
    folios: boolean;
    pdfStandard: 'PDF/X-1a' | 'PDF/X-3';
    colorSpace: 'cmyk' | 'grayscale';
  };

  // Ebook
  epub: {
    version: '3.3';
    baseFontFamily: string;       // fallback stack
    lineHeight: number;           // 1.4–1.6 (sem unidade)
    paragraphIndentEm: number;    // 1.2
    paragraph: 'indent' | 'spaced';
    justify: boolean;
    hyphensAuto: boolean;
    embedFonts: boolean;
  };

  // Texto (passado ao prompt + normalizador)
  text: {
    locale: 'pt-BR';
    dialogueStyle: 'travessao';   // travessão, não aspas
    quoteStyle: 'curly';          // " "
    enforceTypographicChars: true;
    forbidLetterSpacingInBody: true;
  };
}
```

**Presets iniciais:** "Romance BR 14×21" (indent, justificado, serifada), "Não-ficção 16×23" (spaced, justificado), "Paperback 6×9 US". O wizard de criação seleciona o preset; o usuário pode ajustar.

---

## 6. Implementação: pipelines e módulos

### 6.1 Módulos a criar

| Módulo | Responsabilidade |
|---|---|
| `lib/layout/profile.ts` | Tipos + presets do Perfil de Layout |
| `lib/text/normalizer.ts` | Aplica regras da Camada A (aspas curvas, travessão, reticências, sem espaço duplo, sem letter-spacing) |
| `lib/render/semantic.ts` | Converte conteúdo do livro em XHTML semântico limpo |
| `lib/render/print.ts` | Gera HTML + CSS `@page` e renderiza PDF (Paged.js + Chromium headless) |
| `lib/render/epub.ts` | Monta XHTML por capítulo + OPF + NAV + `container.xml`, empacota `.epub` |
| `lib/validate/epubcheck.ts` | Roda EPUBCheck e reporta erros |

### 6.2 Pipeline de impressão (PDF)

1. Documento semântico → aplicar Perfil de Layout.
2. Gerar CSS com regras **`@page`** (tamanho do trim + sangria, margens com medianiz alternando recto/verso via `@page :left`/`:right`, fólios e cabeçalhos via `@top`/`@bottom`).
3. Renderizar com **Paged.js** sobre **Chromium headless (Puppeteer)** — Paged.js resolve paginação, viúvas/órfãs, recto/verso, cabeçalhos correntes e quebra de capítulo em página ímpar.
4. Pós-processar para **PDF/X** (perfil de cor, fontes embutidas) — ex.: Ghostscript.
5. Garantir contagem **par** de páginas.

> Alternativas ao Paged.js: **WeasyPrint** (Python) ou **PrinceXML** (pago, melhor qualidade). Para stack Node/Vercel, Paged.js + Puppeteer é o caminho natural (rodar em função serverless com Chromium ou serviço dedicado).

### 6.3 Pipeline de ebook (EPUB)

1. Documento semântico → **um XHTML por capítulo** + atributo `lang`.
2. Aplicar CSS reflowable (Camada C) derivado do Perfil.
3. Montar `content.opf` (metadados, manifest, spine), **NAV** (sumário navegável), `container.xml`, `mimetype` (armazenado **sem compressão e primeiro** no zip).
4. Empacotar `.epub`.
5. Rodar **EPUBCheck**; bloquear export se houver erro crítico.
6. Anexar capa JPG 2500×3500.

### 6.4 Onde encaixa no fluxo atual

- O **normalizador** roda logo após a geração em streaming, antes de salvar o capítulo (assim o texto persiste já "limpo").
- O **Perfil de Layout** é selecionado no **wizard de criação** (preset por gênero) e fica no modelo `Book`.
- Os **renderizadores** entram na etapa de **export** (já existente no CriaBook), substituindo/estendendo o export atual de PDF/EPUB.

---

## 7. Prompt para o Claude Code

> Cole o bloco abaixo no Claude Code, dentro do repositório do CriaBook. Ajuste caminhos conforme a estrutura real.

```
CONTEXTO
Estou no projeto CriaBook (Next.js + Prisma). Vou implementar a camada de
diagramação e formatação de livros, separando CONTEÚDO SEMÂNTICO de APRESENTAÇÃO.
A IA gera markup semântico limpo; um Perfil de Layout dirige a renderização em
PDF de impressão e EPUB. Siga o documento REGRAS_DIAGRAMACAO_CRIABOOK.md.

TAREFA 1 — Perfil de Layout
Crie src/lib/layout/profile.ts com a interface BookLayoutProfile (campos print,
epub e text conforme a spec) e três presets exportados:
"romance-br-14x21", "naoficcao-16x23", "paperback-6x9-us".
Adicione um campo layoutProfileId ao modelo Book no schema Prisma e gere a migration.

TAREFA 2 — Normalizador tipográfico
Crie src/lib/text/normalizer.ts com uma função normalize(text, profile) que:
- converte aspas retas em curvas (pt-BR), hífen de fala em travessão (—),
  intervalos em meia-risca (–), "..." em reticências (…);
- remove espaços duplos e espaços antes de pontuação;
- nunca insere letter-spacing;
- preserva markup semântico (não altera tags).
Inclua testes unitários (Vitest/Jest) cobrindo cada regra.

TAREFA 3 — Renderizador semântico
Crie src/lib/render/semantic.ts que converte o conteúdo de um Book em XHTML
semântico: <section class="chapter"> por capítulo, <h1> para título,
<p class="first"> no primeiro parágrafo, atributo lang="pt-BR". Sem estilo inline.

TAREFA 4 — Pipeline de impressão (PDF)
Crie src/lib/render/print.ts que:
- gera CSS com regras @page (trim + bleed, margens com medianiz alternando
  @page :left/:right, fólios e running heads, quebra de capítulo em página ímpar);
- renderiza via Paged.js + Puppeteer (Chromium headless);
- garante contagem de páginas par;
- exporta PDF e, num passo final, converte para PDF/X-1a com fontes embutidas
  (Ghostscript) e espaço de cor do perfil.

TAREFA 5 — Pipeline de EPUB
Crie src/lib/render/epub.ts que monta um EPUB 3.3 válido:
- um XHTML por capítulo (lang), CSS reflowable com unidades relativas (sem px no
  font-size do body; line-height sem unidade; text-indent em em; hyphens:auto);
- content.opf, NAV navegável, container.xml, mimetype armazenado primeiro e sem
  compressão; capa JPG 2500x3500.
Depois crie src/lib/validate/epubcheck.ts que roda o EPUBCheck e falha o build
em erro crítico.

REGRAS GERAIS
- TypeScript estrito, funções puras quando possível, sem any.
- Toda dimensão da apresentação vem do Perfil de Layout — nada hardcoded.
- O texto/markup gerado nunca contém estilo visual embutido.
- Escreva testes para normalizador e para a validade do EPUB.
- Ao final, atualize o fluxo de export existente para usar estes módulos e
  documente em docs/diagramacao.md como rodar cada pipeline localmente.

Comece pela TAREFA 1, me mostre o diff, e aguarde meu OK antes de seguir para a 2.
```

---

## 8. Checklists de conformidade

### 8.1 Texto gerado (Camada A)
- [ ] Aspas curvas, travessão para diálogo, reticências como caractere único
- [ ] Sem espaços duplos / sem espaço antes de pontuação
- [ ] Sem letter-spacing no corpo
- [ ] Recuo **ou** espaçamento (nunca os dois)
- [ ] Markup semântico (h1/p/section), `lang` presente, 1º parágrafo `.first`
- [ ] Coerência com a Bíblia da História (RAG)

### 8.2 PDF de impressão (Camada B)
- [ ] Trim escolhido antes das margens; medianiz > externa
- [ ] Sangria 0,125 pol só se houver elemento até a borda
- [ ] Corpo serifado 10–12 pt; entrelinha 120–145%; 45–75 CPL (alvo ~66)
- [ ] Justificado + hifenização; viúvas/órfãs controladas
- [ ] Capítulos iniciando em recto; fólios/cabeçalhos corretos
- [ ] Front matter na ordem; total de páginas par
- [ ] PDF/X-1a ou X-3; fontes embutidas; 300 DPI; CMYK/grayscale; páginas individuais; sem marcas de corte

### 8.3 EPUB (Camada C)
- [ ] EPUB 3.3 passa no EPUBCheck sem erro
- [ ] Sem `font-size` fixo no body; unidades relativas; line-height sem unidade
- [ ] `text-indent` em em; hyphens:auto + `lang`
- [ ] Um XHTML por capítulo; NAV navegável
- [ ] Imagens RGB, `max-width:100%`; capa JPG 2500×3500
- [ ] Fontes com fallback; sem posicionamento absoluto

---

## 9. Referências

**Impressão / formatação**
- Amazon KDP — Trim Size, Bleed, and Margins: https://kdp.amazon.com/en_US/help/topic/GVBQ3CMEQW3W2VL6
- Books.by — How to Format a Book for Print (2026): https://www.books.by/guides/how-to-format-a-book-for-print
- Lulu — Interior Formatting Basics: https://help.lulu.com/en/support/solutions/articles/64000255590-interior-formatting-the-basics
- The Book Designer — Book Layouts and Page Margins: https://www.thebookdesigner.com/book-layouts-page-margins/
- Foglio — Interior design / margens e medianiz (2025): https://www.foglioprint.com/blog/cover-meet-content-harmonizing-your-books-interior-design-with-its-cover-guide-for-2025

**Tipografia**
- Butterick's Practical Typography — Line length / Summary of key rules: https://practicaltypography.com/line-length.html
- UXPin — Optimal Line Length for Readability (2026): https://www.uxpin.com/studio/blog/optimal-line-length-for-readability/
- Wikipedia — Widows and orphans: https://en.wikipedia.org/wiki/Widows_and_orphans
- Alliance of Independent Authors — 10 Typesetting Rules: https://selfpublishingadvice.org/10-typesetting-rules-for-indie-authors/

**EPUB / ebook**
- W3C — EPUB 3.3: https://www.w3.org/TR/epub-33/
- W3C — EPUB Accessibility / Fixed Layout: https://www.w3.org/TR/epub-fxl-a11y/
- EPUBCheck (validador): integrado às specs EPUB 3.x
- Boas práticas de unidades relativas (em/rem) para acessibilidade

---

*Documento de regras para planejamento e implementação. Ajustar valores, presets e caminhos de arquivos à estrutura e à equipe reais do CriaBook.*
