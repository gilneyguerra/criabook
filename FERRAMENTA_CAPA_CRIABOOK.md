# CriaBook — Ferramenta de Capa (Designer de Capa por IA)

> **Documento:** Especificação da ferramenta de criação de capa, contracapa, lombada e orelhas
> **Produto:** CriaBook — Gerador de Livros por IA
> **Versão:** 1.0 · Junho/2026
> **Base de referência:** anatomia comercial da capa segundo Rubens Lima (capista.com.br) + especificações técnicas de impressão/ebook dos documentos anteriores.
> **Objetivo:** permitir que o usuário crie, por IA e por um construtor de prompt, todos os elementos da capa frontal, quarta capa, lombada e orelhas — imagem principal, tipografia, cores e textos comerciais.

---

## Sumário

1. [Princípios](#1-princípios)
2. [Anatomia completa da capa](#2-anatomia-completa-da-capa)
3. [Especificações técnicas](#3-especificações-técnicas)
4. [Arquitetura de geração em camadas](#4-arquitetura-de-geração-em-camadas)
5. [O construtor de prompt](#5-o-construtor-de-prompt)
6. [UI proposta (designer de capa)](#6-ui-proposta-designer-de-capa)
7. [Onde encaixa no fluxo](#7-onde-encaixa-no-fluxo)
8. [Integração com o resto do app](#8-integração-com-o-resto-do-app)
9. [Modelo de dados (Prisma)](#9-modelo-de-dados-prisma)
10. [Prompt para o Claude Code](#10-prompt-para-o-claude-code)
11. [Checklist de conformidade](#11-checklist-de-conformidade)
12. [Referências](#12-referências)

---

## 1. Princípios

**A capa é uma ferramenta comercial, não decorativa.** Segundo o capista Rubens Lima, a capa é a embalagem do "produto" livro: seus textos não devem ser meramente informativos — precisam **persuadir** e focar no benefício/transformação que a obra entrega ao leitor. A ferramenta deve gerar textos com essa mentalidade, não resumos.

**Texto em camada separada (decisão técnica nº 1).** Modelos de IA de imagem produzem tipografia ilegível. Por isso:
- A IA gera **apenas a arte** (imagem principal / fundo).
- Título, subtítulo, autor, chamadas e todos os textos entram como **camada tipográfica editável** (fontes reais), compostos por cima da arte.

Isso garante texto nítido, editável e com hierarquia tipográfica correta.

**Rascunhar cedo, refinar depois.** A arte e o título podem nascer logo no começo (o livro "começa pela capa"), mas os textos comerciais (apresentação da 4ª capa, orelhas, prova social) ficam melhores quando o livro existe. A ferramenta permite gerar um rascunho cedo e **regerar a partir do livro pronto**.

---

## 2. Anatomia completa da capa

Baseada na estrutura descrita por Rubens Lima. A ferramenta deve criar **todos** estes elementos.

### 2.1 Capa frontal

| Elemento | Diretriz | Obrigatório |
|---|---|---|
| **Elemento visual principal** | Imagem, ilustração, foto, ícone ou pictograma. É a âncora visual. | Sim |
| **Título** | Curto (1–4 palavras), impactante, memorável. Não explicar o livro no título. | Sim |
| **Subtítulo** | Dispensável em ficção; **vital** em não-ficção. 3–10 palavras. Traz o maior benefício / a transformação prometida; dá contexto ao título. | Condicional |
| **Nome do autor** | Tamanho proporcional à "plataforma" do autor (marca pessoal). Usar nome literário curto e memorável. | Sim |
| **Chamada / destaques** | Opcional. Selo/faixa com: prefácio de autoridade, premiação, conquista comercial, citação de veículo/pessoa relevante, ou material extra de valor. Usar só se houver algo realmente importante. | Não |

### 2.2 Quarta capa (contracapa)

> Atenção: a 4ª capa **não é lugar para sinopse**. É uma **apresentação comercial**.

| Elemento | Diretriz | Obrigatório |
|---|---|---|
| **Texto de apresentação** | Foco nas necessidades do leitor e nos benefícios/transformação — não em explicar o livro. Normalmente em **3ª pessoa**. 3 a 5 parágrafos curtos. Reutilizado também na página da Amazon. | Sim |
| **Prova social** | Opcional, mas comercialmente forte. 1–2 depoimentos curtos (2–3 linhas) de pessoas renomadas no tema. | Não |

### 2.3 Lombada

| Elemento | Diretriz |
|---|---|
| **Lombada (spine)** | Título + nome do autor + (opcional) logo/selo da editora. Largura calculada pela contagem de páginas (ver [seção 3](#3-especificações-técnicas)). |

### 2.4 Orelhas (brochura com orelhas)

| Orelha | Conteúdo |
|---|---|
| **Orelha da capa (1ª)** | Abordagem editorial: como a obra se organiza, assuntos/capítulos; **ou** frase de impacto extraída do livro; **ou** trecho de 2–3 parágrafos; **ou** trecho do prefácio; **ou** depoimentos extras. |
| **Orelha da contracapa (2ª)** | **Biografia resumida do autor**, em 3ª pessoa, focada na autoridade/experiência no tema. Outras publicações, prêmios. Redes sociais/site/e-mail. **Foto do autor** (em sintonia com o tom). |

### 2.5 Quando não há orelhas

Capa dura, capa flexível e a **brochura da Amazon (KDP) não têm orelhas**. Nesses casos:
- O texto de apresentação **divide a 4ª capa com a bio** do autor (com ou sem foto); **ou**
- A bio vai apenas para a página interna **"Sobre o Autor"** (que já existe na aba Páginas do app).

---

## 3. Especificações técnicas

### 3.1 Ebook
- **Só capa frontal.**
- **JPG, RGB, ~2500 × 3500 px** (compatível com o fluxo de capa da Amazon, que aceita JPG/TIFF).

### 3.2 Impressão (wrap completo)
A capa de impressão é **uma imagem contínua**: 4ª capa + lombada + capa frontal (+ orelhas, quando houver).

```
[ orelha ][   4ª capa   ][lombada][  capa frontal  ][ orelha ]
└─ só brochura c/ orelha ─┘                          └─ idem ─┘
```

- **Largura do wrap** = (2 × largura do miolo) + largura da lombada + (2 × sangria) [+ orelhas].
- **Altura** = altura do miolo + (2 × sangria).
- **Largura da lombada** = nº de páginas × espessura do papel. O coeficiente varia por papel/gráfica — usar a calculadora do provedor (KDP/IngramSpark). Aproximações comuns: papel branco ~0,0572 mm/página; creme ~0,0635 mm/página. **Sempre confirmar com o provedor escolhido.**
- **Sangria:** 3 mm (0,125 pol).
- **Resolução:** 300 DPI no tamanho real.
- **Cor:** CMYK para impressão (a arte gerada em RGB é convertida na exportação).
- **Orelhas:** somam largura extra em cada lado; **não disponíveis na brochura KDP** — a ferramenta deve desabilitar orelhas quando o destino for KDP brochura.

> A largura da lombada **só é conhecida após a paginação** (depende do total de páginas). A ferramenta deve recalcular o wrap quando a contagem de páginas mudar.

---

## 4. Arquitetura de geração em camadas

Três camadas, compostas na renderização final:

```
┌─────────────────────────────────────────────────────────┐
│ CAMADA 3 — Textos longos (gerados por IA do livro+Base)  │
│   apresentação (4ª capa) · prova social · orelhas · bio  │
├─────────────────────────────────────────────────────────┤
│ CAMADA 2 — Tipografia editável (fontes reais)            │
│   título · subtítulo · autor · chamada · lombada         │
├─────────────────────────────────────────────────────────┤
│ CAMADA 1 — Arte por IA (imagem/fundo)                    │
│   imagem principal · fundo · paleta                      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
        Composição (HTML/Canvas/SVG) → export
        ├─ Ebook: capa frontal 2500×3500 RGB JPG
        └─ Impressão: wrap completo CMYK 300 DPI
```

- **Camada 1 (arte):** reutiliza o backend de geração de imagem que o app já usa no botão **"Ilustrar"**. Gera capa frontal e, opcionalmente, a arte da 4ª capa como extensão coerente (mesma paleta/estilo).
- **Camada 2 (tipografia):** título/subtítulo/autor/chamada e a lombada renderizados como texto real, posicionáveis, com famílias e tamanhos escolhidos. Editável sem regerar a arte.
- **Camada 3 (textos longos):** a IA escreve a apresentação da 4ª capa, prova social, orelhas e bio — a partir do conteúdo do livro + Base — com a mentalidade comercial (benefício/transformação, 3ª pessoa).
- **Composição:** montada em HTML/Canvas/SVG e rasterizada para os formatos de saída. Mantém consistência com o Perfil de diagramação definido em Base & Bíblia.

---

## 5. O construtor de prompt

O usuário descreve o que quer, em texto livre **e/ou** por controles guiados. O construtor traduz isso num prompt para a Camada 1 e numa config para as Camadas 2 e 3.

**Entradas do usuário (Camada 1 — arte):**
- **Imagem principal:** sujeito/cena, atmosfera, enquadramento (ex.: "guerreiro solitário sob chuva de néon, plano americano").
- **Estilo geral:** fotográfico, ilustrado, minimalista, pictórico, 3D, etc.
- **Cores de background / paleta:** dominantes e acento.
- **Referências de gênero:** presets que pré-preenchem estilo e paleta (thriller = alto contraste; romance = tons quentes; fantasia = densidade pictórica).

**Entradas do usuário (Camada 2 — tipografia):**
- **Estilo/família de fonte:** serifada, sem serifa, display; vibe (clássica, moderna, manuscrita).
- **Hierarquia:** tamanho relativo de título × subtítulo × autor (lembrando que o tamanho do nome do autor segue a "plataforma").
- **Posição e cor** dos textos sobre a arte.

**Geração de texto (Camada 3):**
- Botões "✨ Gerar" para apresentação da 4ª capa, orelha da capa, bio (orelha da contracapa) e prova social — a partir do livro + Base, no tom comercial correto.
- A bio puxa "Sobre o autor" da aba Páginas (e vice-versa).

**Reforço de termos de domínio:** nomes de personagens/lugares vêm da Bíblia, evitando que a IA escreva o texto comercial com nomes errados.

---

## 6. UI proposta (designer de capa)

```
┌──────────────────────────────────────────────────────────────────┐
│ PASSO 2   Capa            [ Ebook | Impressão (wrap) ]  [Exportar] │
├───────────────────────────────┬──────────────────────────────────┤
│ CONSTRUTOR                     │ PRÉ-VISUALIZAÇÃO AO VIVO          │
│                                │                                   │
│ Arte (Camada 1)                │   ┌───────┬──┬───────┐            │
│  • Imagem principal [✨ Gerar] │   │ 4ª    │lo│ capa  │            │
│  • Estilo / paleta             │   │ capa  │mb│ frente│            │
│  • Preset de gênero            │   │       │ada│      │            │
│ Tipografia (Camada 2)          │   └───────┴──┴───────┘            │
│  • Título / subtítulo          │   (orelhas quando brochura)       │
│  • Nome do autor               │                                   │
│  • Chamada/destaque  [✨]       │   Alterna: Capa · 4ª · Lombada ·  │
│  • Fonte / posição / cor       │            Orelhas                │
│ Textos (Camada 3)              │                                   │
│  • Apresentação 4ª  [✨ Gerar] │                                   │
│  • Prova social     [✨ Gerar] │                                   │
│  • Orelha da capa   [✨ Gerar] │                                   │
│  • Bio + foto autor [✨ Gerar] │                                   │
├───────────────────────────────┴──────────────────────────────────┤
│ Formato: [Romance BR 14×21] (da Base)        [ Próximo: Mapa → ]  │
└──────────────────────────────────────────────────────────────────┘
```

- **Coluna esquerda:** o construtor, agrupado pelas três camadas, com "✨ Gerar" em cada item.
- **Coluna direita:** pré-visualização ao vivo, alternando entre capa frontal, 4ª capa, lombada e orelhas.
- **Alternância Ebook/Impressão:** ebook mostra só a capa frontal; impressão mostra o wrap completo (com a lombada calculada).
- **Responsivo:** colunas empilham em telas estreitas (preview acima do construtor).

---

## 7. Onde encaixa no fluxo

A capa vira uma etapa **logo após Base & Bíblia** — cedo, como âncora visual da obra, honrando o "todo livro começa pela capa". O fluxo passa a ser:

```
1 Base & Bíblia → 2 Capa → 3 Mapa → 4 Escrita → 5 Revisão → 6 Páginas → 7 Exportar
```

Por que após a Base (e não antes): a arte e o título se beneficiam do título/gênero/tom definidos na Base. Os **textos comerciais** (4ª capa, orelhas) ficam melhores com o livro pronto — por isso a etapa é **revisitável**: rascunha-se a arte + título cedo, e regeram-se os textos depois da Escrita/Revisão.

**Destaque visual:** mostrar a miniatura da capa no Dashboard / cartão do projeto faz o livro "ter rosto" desde o início.

---

## 8. Integração com o resto do app

| Puxa de | O quê |
|---|---|
| **Base & Bíblia** | título, gênero, tom, público, perfil de diagramação; nomes (personagens/locais) para os textos |
| **Escrita** | conteúdo do livro para gerar/refinar apresentação, orelha e prova social |
| **Páginas** | nome do autor, "Sobre o autor" ↔ bio da orelha (sincronizados) |
| **Ilustrar** | reusa o mesmo backend de geração de imagem |

| Entrega para | O quê |
|---|---|
| **Exportar (etapa 7)** | capa JPG 2500×3500 para o EPUB; wrap CMYK 300 DPI para o PDF de impressão |
| **Dashboard** | miniatura da capa no cartão do projeto |

---

## 9. Modelo de dados (Prisma)

```prisma
model Cover {
  id             String  @id @default(cuid())
  bookId         String  @unique

  // Camada 1 — arte
  frontArtUrl    String?
  backArtUrl     String?           // extensão coerente da arte frontal
  artPrompt      String? @db.Text
  style          String?           // fotográfico, ilustrado, minimalista...
  palette        Json?             // { background, accent, ... }

  // Camada 2 — tipografia (capa frontal + lombada)
  title          String
  subtitle       String?
  authorName     String
  highlight      String?           // chamada/destaque (opcional)
  spineText      String?
  fontDisplay    String?           // família p/ título
  fontText       String?           // família p/ textos
  layout         Json?             // posições/cores/tamanhos dos textos

  // Camada 3 — textos longos
  backText       String? @db.Text  // apresentação (4ª capa)
  socialProof    Json?             // [{ quote, author }]
  flapFront      String? @db.Text  // orelha da capa
  flapBio        String? @db.Text  // orelha da contracapa (bio)
  authorPhotoUrl String?

  // Formato / acabamento
  target         String  @default("ebook") // ebook | print
  binding        String? // brochura | brochura_orelhas | capa_dura | kdp_brochura
  hasFlaps       Boolean @default(false)
  spineWidthMm   Float?           // recalculado a partir do nº de páginas

  // Saídas
  ebookCoverUrl  String?          // 2500x3500 JPG composto
  printWrapUrl   String?          // wrap completo CMYK

  updatedAt      DateTime @updatedAt
}
```

> Regra: ao detectar `binding = "kdp_brochura"`, desabilitar orelhas (`hasFlaps = false`). Recalcular `spineWidthMm` quando a contagem de páginas mudar.

---

## 10. Prompt para o Claude Code

```
CONTEXTO
Projeto CriaBook (Next.js + Prisma). O app já gera imagens (botão "Ilustrar") e tem as
etapas Base & Bíblia, Mapa, Escrita, Revisão, Páginas, Exportar. Vou adicionar a etapa
"Capa" conforme FERRAMENTA_CAPA_CRIABOOK.md. Princípio inegociável: a IA gera só a ARTE;
todo TEXTO é camada tipográfica editável composta por cima — nunca "desenhado" pela IA.

TAREFA 1 — Modelo e etapa
Adicione o modelo Cover (1:1 com Book) e gere migration. Crie a etapa "2 Capa" na
navegação, entre "Base & Bíblia" e "Mapa", renumerando o fluxo para 1..7.

TAREFA 2 — Construtor + 3 camadas
Crie a tela do designer em duas colunas responsivas:
 - Camada 1 (arte): construtor de prompt (imagem principal, estilo, paleta, preset de
   gênero) + "✨ Gerar", reutilizando o backend de imagem do "Ilustrar". Gera capa frontal
   e, opcional, arte da 4ª capa coerente.
 - Camada 2 (tipografia): título, subtítulo, nome do autor, chamada, lombada; escolha de
   fonte, posição, cor, hierarquia. Renderizada como texto REAL sobre a arte (HTML/SVG/Canvas).
 - Camada 3 (textos): "✨ Gerar" para apresentação da 4ª capa (comercial, 3ª pessoa, foco em
   benefício — NÃO sinopse), prova social, orelha da capa e bio, a partir do livro + Base.

TAREFA 3 — Pré-visualização e formatos
Pré-visualização ao vivo alternando capa frontal / 4ª capa / lombada / orelhas. Toggle
Ebook (só frente) vs Impressão (wrap completo). Calcule a largura da lombada a partir do
nº de páginas e do coeficiente do papel; recalcule quando as páginas mudarem. Desabilite
orelhas quando binding = kdp_brochura.

TAREFA 4 — Composição e export
Componha as camadas e rasterize: ebook = JPG RGB 2500x3500; impressão = wrap CMYK 300 DPI
com sangria 3mm. Entregue a capa JPG para a etapa Exportar (EPUB) e exiba a miniatura no
cartão do projeto no Dashboard.

TAREFA 5 — Sincronizações
Bio da orelha ↔ "Sobre o autor" (aba Páginas). Nome do autor ↔ Base/Páginas. Textos da
Camada 3 puxam nomes da Bíblia para não errar personagens/lugares.

REGRAS GERAIS
- TypeScript estrito; UI responsiva (preview empilha no mobile).
- Nunca embutir texto na imagem gerada pela IA.
- Reaproveitar o backend de imagem existente; não duplicar integração.
- Documentar em docs/capa.md o fluxo e o cálculo do wrap.

Comece pela TAREFA 1, mostre o diff e aguarde meu OK antes da TAREFA 2.
```

---

## 11. Checklist de conformidade

**Capa frontal**
- [ ] Imagem principal gerada por IA (arte isolada da tipografia)
- [ ] Título (1–4 palavras) e subtítulo (quando aplicável) como texto editável
- [ ] Nome do autor com tamanho ajustável; chamada/destaque opcional

**Quarta capa**
- [ ] Texto de apresentação comercial (3ª pessoa, foco em benefício) — não sinopse
- [ ] Prova social opcional (1–2 depoimentos curtos)

**Lombada e orelhas**
- [ ] Lombada com título + autor; largura calculada por nº de páginas
- [ ] Orelha da capa (editorial/trecho) e orelha da contracapa (bio + foto)
- [ ] Orelhas desabilitadas em KDP brochura

**Técnico**
- [ ] Texto sempre em camada editável (nunca na imagem da IA)
- [ ] Ebook: JPG RGB 2500×3500
- [ ] Impressão: wrap CMYK 300 DPI, sangria 3 mm, lombada recalculável
- [ ] Capa entregue à etapa Exportar; miniatura no Dashboard

---

## 12. Referências

- Rubens Lima (O Capista) — "O que escrever em uma Capa de Livro?": https://capista.com.br/o-que-escrever-em-uma-capa-de-livro/
- Rubens Lima — "A Estrutura de uma Capa de Livro": https://capista.com.br/a-estrutura-de-uma-capa-de-livro/
- Rubens Lima — "Lombada de Livro: qual orientação é a correta?": https://capista.com.br/lombada-de-livro-qual-orientacao-e-a-correta/
- Amazon KDP — Cover/print specs (trim, bleed, spine calculator)
- Especificações de ebook/impressão dos documentos anteriores (REGRAS_DIAGRAMACAO_CRIABOOK.md)

---

*Documento de planejamento da ferramenta de capa. Ajustar coeficientes de papel, nomes de rotas/componentes e backend de imagem à estrutura real do CriaBook e ao provedor de impressão escolhido.*
