# CriaBook — Plano de Implementação de Recursos

> **Documento:** PRD + Roadmap técnico
> **Produto:** CriaBook — Gerador de Livros (ebook) por IA
> **Versão:** 1.0
> **Data:** Junho/2026
> **Contexto:** Next.js / Vercel · Prisma · mercado brasileiro (Mercado Pago/PIX, LGPD)

---

## Sumário

1. [Resumo executivo](#1-resumo-executivo)
2. [Princípio norteador](#2-princípio-norteador)
3. [Camada de ofício — as informações de entrada](#3-camada-de-ofício--as-informações-de-entrada)
4. [Camada técnica — os recursos indispensáveis](#4-camada-técnica--os-recursos-indispensáveis)
5. [Arquitetura do motor de consistência (RAG)](#5-arquitetura-do-motor-de-consistência-rag)
6. [Modelo de dados (Prisma)](#6-modelo-de-dados-prisma)
7. [Roadmap por fases](#7-roadmap-por-fases)
8. [Stack recomendada](#8-stack-recomendada)
9. [Checklist de publicação](#9-checklist-de-publicação)
10. [Referências](#10-referências)

---

## 1. Resumo executivo

O CriaBook já possui um esqueleto forte: geração em streaming capítulo a capítulo, edição por chat, mapa da história, geração de imagens/capa, versionamento com rollback e exportação em PDF/EPUB.

O risco do produto **não é técnico, é editorial**. É trivial gerar 50 mil palavras de IA; é difícil gerar 50 mil palavras *que alguém termine de ler*. O que separa um app que produz livros de verdade de um que produz "texto que parece livro" são duas capacidades que o esqueleto atual ainda não torna explícitas:

1. **Captura correta das informações de entrada** — as decisões editoriais tomadas *antes* da primeira frase.
2. **Motor de consistência** — a garantia de que o capítulo 8 lembra do que aconteceu no capítulo 2.

Este documento detalha ambas e propõe um roadmap em 4 fases para implementá-las.

---

## 2. Princípio norteador

> **Priorize conclusão, não brilho.**

A evidência de mercado é clara: ferramentas com fluxo estruturado e recursos de consistência ajudam autores a **terminar** livros; ferramentas com features chamativas mas sem sistema de conclusão levam a projetos abandonados. Coerência é ~80% da percepção de qualidade de um livro. Toda a Fase 1 existe para combater o abandono e a incoerência.

A qualidade da prosa linha a linha importa menos do que parece — porque edição sempre será necessária. O que importa é **integração** (do conceito ao arquivo publicável, sem handoffs) e **continuidade**.

---

## 3. Camada de ofício — as informações de entrada

Todo livro que presta nasce de um punhado de decisões. Um bestseller não é "escrita boa" frase a frase — é estrutura e coerência sustentadas por centenas de páginas. O app precisa **extrair essas decisões do usuário num wizard inicial**, senão a IA improvisa e desanda.

### 3.1 Ficção — mínimo inegociável

| Informação | O que é | Por que é indispensável |
|---|---|---|
| **Promessa central (logline)** | Uma frase: que pergunta o livro faz e por que virar a página | É o fio condutor. Sem ela, não há direção. |
| **Estrutura narrativa** | Método escolhido (3 atos, Jornada do Herói, Save the Cat!, Story Circle) | Gera os *beats* do mapa da história a partir de um esqueleto comprovado, não genérico. |
| **Bíblia da História** | Personagens, locais, regras do mundo, linha do tempo, tom | Fonte única de verdade. É o coração do motor de consistência. |
| **POV e voz** | 1ª ou 3ª pessoa; passado/presente; tom (sombrio, leve, lírico) | Precisa ser fixado e respeitado em todo capítulo. |
| **Conflito e stakes** | O que o protagonista quer, o que o impede, o que perde se falhar | Tensão escalando a cada ato é o que prende o leitor. |

### 3.2 Não-ficção — mínimo inegociável

(Metade do mercado de ebook no Brasil: emagrecimento, finanças, desenvolvimento pessoal, negócios.)

| Informação | O que é |
|---|---|
| **Transformação prometida** | "Quem lê sai de X e chega em Y." O equivalente da logline. |
| **Leitor-alvo e nível** | Define vocabulário, profundidade e exemplos. |
| **Espinha argumentativa** | Tese central → argumentos de apoio → evidências/exemplos → ação prática por capítulo. |

### 3.3 Front matter e back matter (para ambos)

O que quase todo gerador de IA esquece — e o que faz o livro parecer amador. Deve ser **gerado automaticamente** a partir dos metadados do projeto:

- **Front matter:** folha de rosto, página de copyright, dedicatória, epígrafe, sumário navegável.
- **Back matter:** sobre o autor, agradecimentos, CTA final (newsletter, próximo livro), disclosure de IA.

---

## 4. Camada técnica — os recursos indispensáveis

Cada recurso mapeado ao problema de ofício que resolve.

### 4.1 Motor de consistência — RAG *(maior lacuna e maior diferencial)*

Os apps líderes (Novelcrafter/"Codex", Sudowrite/"Story Bible") convergiram na mesma ideia: uma fonte única de verdade para personagens, lore e locais, injetada automaticamente no prompt ao gerar/editar cada cena. Tecnicamente, isto é RAG. Detalhado na [Seção 5](#5-arquitetura-do-motor-de-consistência-rag).

### 4.2 Wizard de criação

Porta de entrada que captura tudo da [Seção 3](#3-camada-de-ofício--as-informações-de-entrada). Alimenta a Bíblia, os metadados e os presets. **É o primeiro passo de toda obra.**

### 4.3 Templates de estrutura narrativa

O usuário escolhe um método e o app popula o mapa da história com beats reais (não genéricos). Métodos a suportar:

- **3 atos** (universal, default)
- **Jornada do Herói** (fantasia, aventura)
- **Save the Cat!** (15 beats, ritmo comercial)
- **Story Circle / Dan Harmon** (8 etapas, jornada de personagem)
- **Não-ficção:** Problema → Solução → Aplicação (por capítulo)

### 4.4 Presets de geração por gênero

Parâmetros distintos por tipo de livro:

| Gênero | Temperatura | System prompt enfatiza |
|---|---|---|
| Thriller / Suspense | Mais baixa | Ritmo seco, frases curtas, ganchos de capítulo |
| Fantasia / Ficção científica | Média-alta | Densidade descritiva, worldbuilding, coerência de regras |
| Romance | Média | Emoção, tensão relacional, diálogo |
| Não-ficção | Baixa | Clareza, estrutura, exemplos acionáveis |

### 4.5 Verificador de consistência / continuidade

Passe de QA que varre o manuscrito procurando contradições: nome que muda de grafia, característica física alterada, personagem morto que reaparece, furo na timeline. Barato com IA e gera confiança imediata no produto.

### 4.6 Exportação validada

Exportar EPUB não basta — tem que **passar no EPUBCheck**, o verificador de conformidade usado como padrão de fato pela indústria editorial. Alvo: **EPUB 3.3** (recomendação atual do W3C; 3.4 prevista para ~2027).

Requisitos concretos exigidos pelas lojas:

- Sumário **navegável** (NAV doc) para pular entre capítulos
- **Fontes embutidas**
- Imagens em espaço de cor **RGB**
- Capa em **JPG, idealmente 2500×3500** (a Amazon só aceita JPG ou TIFF no fluxo de capa)
- **PDF de impressão:** fontes 100% embutidas, sangria e margens corretas

Diferencial: bundle "pronto para KDP" (EPUB validado + capa JPG) num clique.

### 4.7 Disclosure de IA, direitos e LGPD

Ponto de confiança crítico:

- A **Amazon KDP permite** conteúdo gerado/assistido por IA **desde que divulgado** na publicação — e isso **não afeta** a elegibilidade ao royalty de 70%. O app deve **gerar o texto de disclosure pronto**.
- Deixar explícito que **o usuário detém os direitos comerciais** da obra.
- Deixar explícito que **o conteúdo do usuário não é usado para treinar modelo** (alinhado à LGPD).

---

## 5. Arquitetura do motor de consistência (RAG)

O componente que define a qualidade do app inteiro. A pergunta a responder arquiteturalmente: *o capítulo 8 lembra do capítulo 2?*

### 5.1 Fluxo

```
┌─────────────────────────────────────────────────────────────┐
│  INDEXAÇÃO (escrita)                                         │
│                                                              │
│  Salvar capítulo  ──▶ gerar resumo (1 parágrafo)            │
│                   ──▶ chunking + embeddings ──▶ pgvector    │
│                                                              │
│  Salvar entry da Bíblia ──▶ embedding ──▶ pgvector          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  GERAÇÃO do capítulo N                                       │
│                                                              │
│  CONTEXTO FIXO (sempre injetado):                            │
│    • logline + tom + POV                                     │
│    • beat atual do mapa da história                          │
│    • personagens/locais ativos na cena (Bíblia)              │
│    • resumo rolante dos capítulos anteriores                 │
│                                                              │
│  CONTEXTO RECUPERADO (por similaridade):                     │
│    • top-k chunks relevantes de capítulos anteriores         │
│    • entries da Bíblia mais próximas semanticamente          │
│                                                              │
│  ──▶ monta system prompt + janela de contexto ──▶ LLM        │
│  ──▶ streaming pro editor                                    │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Decisões de projeto

- **Resumos rolantes (rolling summaries):** para livros longos, não cabe tudo na janela. Mantenha um resumo acumulado dos capítulos anteriores + recuperação seletiva dos trechos relevantes.
- **Contexto fixo vs. recuperado:** personagens da cena atual e regras do mundo são *sempre* injetados (contexto fixo); o resto é recuperado por similaridade (contexto dinâmico).
- **Budget de tokens:** definir teto por chamada e priorizar — Bíblia core > beat atual > resumo rolante > chunks recuperados.
- **Reindexação:** ao editar um capítulo via chat, reindexar apenas aquele capítulo (não o livro todo).

### 5.3 Stack de RAG sugerida

- **Vector store:** `pgvector` no Postgres (Neon/Supabase) — integra direto com Prisma, sem infra extra.
- **Embeddings:** modelo de embedding multilíngue (bom suporte a PT-BR).
- **Recuperação:** busca por cosseno, `top-k` configurável (começar com k=5).

---

## 6. Modelo de dados (Prisma)

Esboço dos modelos centrais. Ajustar nomes/relações ao schema existente.

```prisma
// ---------- Projeto ----------
model Book {
  id              String       @id @default(cuid())
  userId          String
  title           String
  type            BookType     // FICTION | NONFICTION
  logline         String       // promessa central / transformação prometida
  genre           String
  audience        String
  pov             String?      // "first_past", "third_present", etc.
  tone            String?
  structureMethod String       // "three_act" | "hero_journey" | "save_the_cat" | "story_circle"
  status          BookStatus   @default(DRAFT)
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  chapters     Chapter[]
  beats        Beat[]
  characters   Character[]
  locations    Location[]
  worldRules   WorldRule[]
  timeline     TimelineEvent[]
  glossary     GlossaryTerm[]
  snapshots    Snapshot[]
  embeddings   Embedding[]
}

enum BookType   { FICTION NONFICTION }
enum BookStatus { DRAFT WRITING REVIEW DONE PUBLISHED }

// ---------- Conteúdo ----------
model Chapter {
  id        String   @id @default(cuid())
  bookId    String
  order     Int
  title     String
  content   String   @db.Text
  summary   String?  @db.Text   // 1 parágrafo, usado no RAG
  status    String   @default("draft")
  book      Book     @relation(fields: [bookId], references: [id], onDelete: Cascade)

  @@unique([bookId, order])
}

model Beat {
  id          String  @id @default(cuid())
  bookId      String
  act         Int
  order       Int
  beatType    String  // "opening_image", "catalyst", "midpoint", etc.
  description String  @db.Text
  status      String  @default("planned")
  book        Book    @relation(fields: [bookId], references: [id], onDelete: Cascade)
}

// ---------- Bíblia da História ----------
model Character {
  id          String  @id @default(cuid())
  bookId      String
  name        String
  role        String? // protagonista, antagonista, secundário
  appearance  String? @db.Text
  traits      String? @db.Text
  arc         String? @db.Text
  notes       String? @db.Text
  book        Book    @relation(fields: [bookId], references: [id], onDelete: Cascade)
}

model Location {
  id          String  @id @default(cuid())
  bookId      String
  name        String
  description String? @db.Text
  book        Book    @relation(fields: [bookId], references: [id], onDelete: Cascade)
}

model WorldRule {
  id       String @id @default(cuid())
  bookId   String
  category String // magia, tecnologia, política, etc.
  rule     String @db.Text
  book     Book   @relation(fields: [bookId], references: [id], onDelete: Cascade)
}

model TimelineEvent {
  id          String @id @default(cuid())
  bookId      String
  order       Int
  description String @db.Text
  chapterRef  Int?
  book        Book   @relation(fields: [bookId], references: [id], onDelete: Cascade)
}

model GlossaryTerm {
  id         String @id @default(cuid())
  bookId     String
  term       String
  definition String @db.Text
  book       Book   @relation(fields: [bookId], references: [id], onDelete: Cascade)
}

// ---------- Versionamento ----------
model Snapshot {
  id        String   @id @default(cuid())
  bookId    String
  label     String?
  payload   Json     // estado serializado para rollback
  createdAt DateTime @default(now())
  book      Book     @relation(fields: [bookId], references: [id], onDelete: Cascade)
}

// ---------- RAG ----------
model Embedding {
  id         String  @id @default(cuid())
  bookId     String
  sourceType String  // "chapter" | "character" | "location" | "worldrule"
  sourceId   String
  chunkText  String  @db.Text
  // vector via pgvector — declarar com Unsupported / extensão pgvector
  // embedding  Unsupported("vector(1536)")?
  book       Book    @relation(fields: [bookId], references: [id], onDelete: Cascade)

  @@index([bookId, sourceType])
}
```

---

## 7. Roadmap por fases

Ondas priorizadas pelo que destrava qualidade percebida primeiro.

### Fase 0 — Consolidar o que já existe
Streaming, edição por chat, mapa da história, imagens/capa, versionamento, export PDF/EPUB. Não mexer; apenas amarrar ao restante.

### Fase 1 — Fundação de qualidade *(prioridade máxima — ~4–6 semanas)*
- [ ] **Wizard de criação** (logline, gênero, público, POV/tom, método estrutural)
- [ ] **Bíblia da História** — modelo de dados + CRUD + edição por chat
- [ ] **Motor de consistência (RAG)** — indexação + recuperação + injeção de contexto
- [ ] **Front/back matter automático** ligado aos metadados

> Sem o item de RAG, os demais não importam. Este é *o* trabalho da fase.

### Fase 2 — Diferenciação *(~6–8 semanas)*
- [ ] **Templates de estrutura** populando o mapa da história com beats reais
- [ ] **Presets de geração por gênero**
- [ ] **Verificador de consistência/continuidade** (passe de QA)
- [ ] **Consistência visual** entre ilustrações internas e capa

### Fase 3 — Publicação e monetização *(~4–6 semanas)*
- [ ] **Export validado**: EPUBCheck no pipeline, EPUB 3.3, NAV navegável, fontes embutidas, capa JPG 2500×3500, bundle pronto-para-KDP
- [ ] **Disclosure de IA + página de direitos/LGPD** automáticos
- [ ] **Pagamentos**: Mercado Pago/PIX por modelo de créditos (por geração)

### Fase 4 — Expansão *(futuro)*
- [ ] **Áudio-livro** com narração TTS (spec ACX: 44.1 kHz, 192 kbps, loudness-compliant)
- [ ] **Modo série/multi-livro** com cânone compartilhado
- [ ] **Marketplace de templates** de estrutura e estilo

---

## 8. Stack recomendada

| Camada | Escolha | Justificativa |
|---|---|---|
| Frontend/SSR | Next.js (já em uso) | Vercel-native, streaming de UI |
| Banco | Postgres (Neon/Supabase) | Maduro, suporta `pgvector` |
| ORM | Prisma | Já no seu ecossistema |
| Vector store | `pgvector` | Sem infra extra; integra com Prisma |
| Geração de texto | LLM via streaming | Capítulo a capítulo, presets por gênero |
| Embeddings | Modelo multilíngue (PT-BR) | RAG da Bíblia + capítulos |
| Export EPUB/PDF | Pipeline com validação EPUBCheck | Conformidade EPUB 3.3 |
| Pagamentos | Mercado Pago/PIX | Mercado brasileiro |

---

## 9. Checklist de publicação

Antes de liberar o export "pronto para publicar":

- [ ] EPUB passa no **EPUBCheck** sem erros
- [ ] **Sumário navegável** (NAV) presente e funcional
- [ ] **Fontes embutidas** no EPUB e no PDF de impressão
- [ ] Imagens internas em **RGB**
- [ ] **Capa JPG** ~2500×3500
- [ ] **Front matter** completo (rosto, copyright, sumário)
- [ ] **Back matter** completo (sobre o autor, disclosure de IA)
- [ ] **Texto de disclosure de IA** gerado (para KDP e similares)
- [ ] Metadados (título, autor, ISBN opcional, idioma, descrição)
- [ ] PDF de impressão com **sangria/margens** corretas

---

## 10. Referências

- W3C — *EPUB 3.3 Recommendation*: https://www.w3.org/TR/epub-33/
- W3C — *EPUB 3.4 Authoring (em desenvolvimento)*: https://w3c.github.io/epub-specs/epub34/authoring/
- W3C — *EPUB 3 Overview / Accessibility*: https://www.w3.org/TR/epub-overview-33/
- EPUBCheck (validador de conformidade): referenciado na spec EPUB 3.4
- Barnes & Noble Press — requisitos de EPUB/print (2026): https://cambric.pub/guides/barnes-noble-requirements/
- Comparativos de geradores de livro por IA (2026) — Sudowrite "Story Bible", Novelcrafter "Codex", continuidade de capítulos, disclosure KDP: skywork.ai, eesel.ai, inkfluenceai.com
- KDP — política de conteúdo gerado por IA (disclosure não afeta royalty de 70%)

---

*Documento gerado como base de planejamento. Ajustar prazos e nomes de modelos ao schema e à equipe reais do CriaBook.*
