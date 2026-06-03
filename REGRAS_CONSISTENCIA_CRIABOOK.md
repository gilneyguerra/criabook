# CriaBook — Motor de Consistência e Continuidade

> **Documento:** Regras + arquitetura do motor anti-alucinação / anti-repetição / continuidade
> **Produto:** CriaBook — Gerador de Livros por IA
> **Versão:** 1.0 · Junho/2026
> **Objetivo:** Garantir que a criação do livro seja **coerente do começo ao fim** — sem inventar fatos (alucinação), sem repetir informações, com **linha do tempo consistente** e **memória resgatável** que se atualiza de forma contínua e recorrente.
> **Stack assumida:** Next.js/Vercel + Prisma + Postgres/pgvector (ajustar ao projeto real).

---

## Sumário

1. [Os quatro modos de falha](#1-os-quatro-modos-de-falha)
2. [Princípio: dois laços contínuos](#2-princípio-dois-laços-contínuos)
3. [A memória resgatável (camada de estado)](#3-a-memória-resgatável-camada-de-estado)
4. [Laço preventivo — grounding na geração](#4-laço-preventivo--grounding-na-geração)
5. [Laço detector — verificação pós-geração](#5-laço-detector--verificação-pós-geração)
6. [Anti-repetição](#6-anti-repetição)
7. [Consistência de linha do tempo](#7-consistência-de-linha-do-tempo)
8. [Execução recorrente e contínua](#8-execução-recorrente-e-contínua)
9. [Instruções de sistema (prompt pronto)](#9-instruções-de-sistema-prompt-pronto)
10. [Ferramentas a implementar](#10-ferramentas-a-implementar)
11. [Prompt para o Claude Code](#11-prompt-para-o-claude-code)
12. [Checklist de conformidade](#12-checklist-de-conformidade)

---

## 1. Os quatro modos de falha

Geração ingênua de livro longo falha de quatro formas distintas. Cada uma exige um mecanismo próprio:

| Falha | Exemplo | Mecanismo de defesa |
|---|---|---|
| **Alucinação** | Personagem ganha um irmão que nunca existiu; regra de magia violada | Grounding: só usar fatos do cânone; marcar lacunas |
| **Repetição** | Re-descrever a aparência da protagonista no cap. 8; reusar a mesma comparação | Registro de "já descrito" + impressão digital de frases |
| **Incoerência temporal** | Personagem sabe de algo antes de descobrir; morto reaparece; viagem instantânea | Linha do tempo + estado de conhecimento por personagem |
| **Perda de memória** | No cap. 20 o modelo "esqueceu" o que prometeu no cap. 3 | Estado estruturado resgatável + RAG |

> A causa-raiz comum: a janela de contexto não comporta o livro inteiro. A solução **não** é jogar mais texto no prompt — é manter **estado estruturado e compacto** que represente o livro e seja resgatável sob demanda.

---

## 2. Princípio: dois laços contínuos

```
        ┌──────────────────── LAÇO PREVENTIVO (escrita) ─────────────────────┐
        │  Antes de gerar o cap. N:                                          │
        │   monta CONTEXTO ANCORADO = Cânone + Estado atual + Timeline +     │
        │   Conhecimento dos personagens + Descritos + Evitar-frases + Beat  │
        │   ──▶ gera capítulo com instruções de grounding                    │
        └────────────────────────────────┬──────────────────────────────────┘
                                          │  capítulo gerado
                                          ▼
        ┌──────────────────── LAÇO DETECTOR (verificação) ───────────────────┐
        │  Depois de gerar o cap. N:                                         │
        │   extrai afirmações ──▶ confronta com Cânone/Timeline/Conhecimento │
        │   ──▶ relatório de violações (severidade + provênica)              │
        │   ──▶ auto-revisão OU sinaliza ao usuário                          │
        └────────────────────────────────┬──────────────────────────────────┘
                                          │  capítulo aprovado
                                          ▼
        ┌──────────────────── ATUALIZAÇÃO DE ESTADO ─────────────────────────┐
        │  extrai NOVOS fatos/eventos/conhecimento ──▶ atualiza a memória     │
        │  ──▶ o estado do mundo avança para "fim do cap. N"                  │
        └────────────────────────────────────────────────────────────────────┘
```

**Preventivo** evita a maior parte dos erros na origem (grounding). **Detector** pega o que escapou (verificação). **Atualização de estado** mantém a memória sempre em dia. Os três rodam a cada capítulo, indefinidamente.

---

## 3. A memória resgatável (camada de estado)

Não basta guardar o texto. É preciso guardar **fatos atômicos, consultáveis e com provênica** (de onde vieram). Estruturas:

### 3.1 Registro de Fatos do Cânone (Fact Ledger)
Fatos atômicos, cada um com proveniência. É o que torna a verificação determinística.

### 3.2 Linha do Tempo / Registro de Eventos (Event Ledger)
Eventos ordenados em **tempo-da-história** (não em ordem de narração — flashbacks separam os dois).

### 3.3 Estado de Conhecimento por Personagem
Quem sabe o quê, e a partir de qual capítulo. **Essencial** para reviravoltas: um personagem não pode agir com base em algo que ainda não descobriu.

### 3.4 Snapshot de Estado do Mundo
"Foto" compacta do mundo ao fim do capítulo N (localização e estado emocional de cada personagem, itens, fios abertos). É o que se injeta ao escrever N+1 — em vez do texto bruto.

### 3.5 Registro de Descritos + Impressão Digital de Estilo
O que já foi descrito por extenso e quais frases/imagens distintivas já foram usadas (anti-repetição).

### 3.6 Fios de Trama (Plot Threads / "armas de Chekhov")
Promessas narrativas abertas e quando foram fechadas. Evita pontas soltas e permite cobrar pagamento de setups.

### 3.7 Esboço de modelos (Prisma)

```prisma
model CanonFact {
  id           String   @id @default(cuid())
  bookId       String
  subject      String   // "Lia", "Reino de Aval", "magia"
  attribute    String   // "cor_dos_olhos", "regra", "parentesco"
  value        String   // "verde"
  establishedInChapter Int     // provênica
  status       String   @default("active") // active | retconned
  createdAt    DateTime @default(now())
  @@index([bookId, subject])
}

model TimelineEvent {
  id            String  @id @default(cuid())
  bookId        String
  storyOrder    Int     // ordem no TEMPO DA HISTÓRIA
  narrativeChapter Int  // capítulo em que é NARRADO (pode diferir: flashback)
  storyTime     String? // "Dia 3, manhã" / "Primavera, ano 412"
  description   String  @db.Text
  participants  String[] // nomes de personagens envolvidos
  location      String?
  causedBy      String?  // id de evento anterior (relação causal)
  @@index([bookId, storyOrder])
}

model CharacterKnowledge {
  id            String @id @default(cuid())
  bookId        String
  character     String
  fact          String @db.Text   // o que ele sabe
  learnedInChapter Int            // quando passou a saber
  @@index([bookId, character])
}

model WorldStateSnapshot {
  id          String  @id @default(cuid())
  bookId      String
  asOfChapter Int
  payload     Json    // estado compacto: posições, estados, itens, fios
  summary     String  @db.Text   // resumo rolante até aqui
  @@unique([bookId, asOfChapter])
}

model DescribedItem {
  id            String @id @default(cuid())
  bookId        String
  subject       String // "aparência de Lia", "torre do norte"
  describedInChapter Int
  @@index([bookId, subject])
}

model StylePhrase {
  id        String @id @default(cuid())
  bookId    String
  phrase    String   // frase/imagem distintiva já usada
  embedding Unsupported("vector(1536)")?  // p/ detectar paráfrases
  usedInChapter Int
  @@index([bookId])
}

model PlotThread {
  id            String  @id @default(cuid())
  bookId        String
  description   String  @db.Text
  openedInChapter Int
  closedInChapter Int?    // null = ainda aberto
  status        String  @default("open") // open | resolved | abandoned
  @@index([bookId, status])
}

model ConsistencyIssue {
  id          String @id @default(cuid())
  bookId      String
  chapter     Int
  type        String // hallucination | repetition | timeline | knowledge | thread
  severity    String // hard | soft
  description String @db.Text
  conflictsWith String? @db.Text // fato/evento em conflito + provênica
  status      String @default("open") // open | resolved | ignored
  createdAt   DateTime @default(now())
  @@index([bookId, status])
}
```

---

## 4. Laço preventivo — grounding na geração

Antes de gerar o capítulo N, montar o **Contexto Ancorado**, com prioridade de orçamento de tokens:

1. **Sempre injetado (determinístico):** logline, beat atual, fatos do cânone dos personagens/locais **da cena**, regras do mundo relevantes, estado de conhecimento dos personagens presentes, fios de trama abertos.
2. **Recuperado por similaridade (RAG):** trechos relevantes de capítulos anteriores, fatos próximos semanticamente.
3. **Resumo rolante:** o `WorldStateSnapshot.summary` do fim do capítulo N-1.
4. **Listas de evicção:** `DescribedItem` e `StylePhrase` recentes (para o modelo evitar repetir).

> **Híbrido > RAG puro.** Fatos estruturados injetados de forma determinística previnem alucinação de modo confiável; busca vetorial sozinha é difusa e deixa passar contradições. Use os dois.

O capítulo é gerado sob as [instruções de sistema](#9-instruções-de-sistema-prompt-pronto) que impõem disciplina de grounding (só usar o que está no contexto; marcar lacunas; não reescrever fatos).

---

## 5. Laço detector — verificação pós-geração

Depois de gerar (ou editar) o capítulo, roda o **passe de QA de continuidade**:

1. **Extração de afirmações.** Um passo de IA extrai do novo texto as afirmações verificáveis (fatos sobre personagens, lugares, tempo, eventos, quem sabe o quê).
2. **Confronto com a memória.** Cada afirmação é checada contra `CanonFact`, `TimelineEvent`, `CharacterKnowledge`, regras do mundo e fios abertos. É um teste de **contradição/consequência lógica** contra a base de fatos.
3. **Relatório estruturado.** Gera `ConsistencyIssue` para cada conflito, com **tipo**, **severidade** (hard = contradição factual; soft = estilística) e **provênica do conflito** ("cap. 1 diz olhos verdes; este capítulo diz castanhos").
4. **Resolução.** `hard` → auto-revisão dirigida (regenera só o trecho conflitante com o fato correto injetado) ou bloqueio com aviso ao usuário; `soft` → sinaliza, não bloqueia.

Esse padrão — **extrair afirmações → checar contra base com provênica** — é o que reduz alucinação de forma mensurável, porque transforma "parece coerente?" em "contradiz algum fato registrado?".

---

## 6. Anti-repetição

Três detectores complementares:

- **Registro de descritos:** se a aparência de um personagem ou um ambiente já está em `DescribedItem`, o prompt instrui a **referenciar, não re-descrever**.
- **Impressão digital de frases (n-gram + embedding):** ao salvar um capítulo, extrair frases/imagens distintivas para `StylePhrase`. Em capítulos novos, comparar parágrafos por **similaridade de embedding** com os anteriores; acima de um limiar, sinalizar quase-duplicata (mesmo que parafraseada).
- **Registro de beats/aberturas:** detectar se muitos capítulos abrem do mesmo jeito ("Ela acordou com...") ou reciclam a mesma estrutura de cena. Injetar como "evite estas aberturas".

As listas de evicção entram no contexto preventivo da próxima geração — o sistema **aprende com o que já escreveu**.

---

## 7. Consistência de linha do tempo

- **Modelo de tempo-da-história separado da ordem de narração.** `storyOrder` ≠ `narrativeChapter`. Flashbacks, prolepses e narrativas paralelas exigem essa separação.
- **Restrições verificáveis automaticamente:**
  - **Ordem causal:** um evento não pode referenciar consequência de evento futuro.
  - **Conhecimento:** personagem só age sobre fatos com `learnedInChapter ≤` capítulo atual.
  - **Presença:** personagem morto/ausente não atua (exceto flashback marcado).
  - **Coerência física:** estação, hora, idade dos personagens e tempo de deslocamento consistentes entre eventos consecutivos.
- **Visualização para o autor:** uma timeline navegável (eventos em `storyOrder`, com o capítulo de narração e participantes) é a melhor ferramenta de auditoria humana — e cai bem como recurso de produto.

---

## 8. Execução recorrente e contínua

A consistência **não é um botão** — é um processo que roda sempre. Três gatilhos:

1. **Na escrita de cada capítulo (síncrono):** laço preventivo → geração → laço detector → atualização de estado. Acontece toda vez, automaticamente.
2. **Na edição (incremental):** ao editar o capítulo K, re-extrair fatos de K e **revalidar apenas o que depende de K** (rastreamento de dependências: capítulos que citam fatos originados em K). Evita reprocessar o livro inteiro.
3. **Varredura periódica (batch):** um job assíncrono revalida toda a malha de fatos/timeline conforme o livro cresce — pega contradições transversais que surgem só com o acúmulo. Roda em background (fila), não bloqueia a escrita.

**Escala / orçamento de tokens:** o estado estruturado (`WorldStateSnapshot` + ledgers) é compacto e determinístico — é ele que permite livros longos sem estourar contexto. Resumos rolantes + recuperação seletiva cobrem o resto. Nunca depender de "reler o livro todo".

---

## 9. Instruções de sistema (prompt pronto)

Bloco a injetar no **system prompt do gerador**, junto do Contexto Ancorado. São as "instruções para não alucinar e não repetir":

```
Você está escrevendo o capítulo {N} de um livro, em linha contínua com o que já foi
escrito. Os blocos abaixo são a ÚNICA fonte de verdade: CÂNONE, ESTADO_ATUAL,
TIMELINE, CONHECIMENTO, DESCRITOS, EVITAR_FRASES, FIOS_ABERTOS, BEAT_ATUAL.

GROUNDING (não alucinar):
- Use SOMENTE fatos presentes nos blocos. Não invente nomes, datas, lugares,
  parentescos, objetos, eventos ou regras que não estejam ali.
- Se um fato necessário não existir no contexto, NÃO invente. Escreva o marcador
  [LACUNA: o que falta] e contorne, ou peça o dado. Nunca apresente suposição como fato.
- NÃO altere fatos já estabelecidos (aparência, idade, relações, regras do mundo).
- Ao introduzir um fato novo e durável (nome, lugar, regra, objeto relevante),
  marque-o com [NOVO_FATO: descrição] para registro no cânone.

TIMELINE E CONHECIMENTO (coerência):
- Respeite a cronologia de TIMELINE. Não contradiga o que já aconteceu nem antecipe
  o que ainda não aconteceu. Mantenha estação, hora, idade e deslocamentos coerentes.
- Cada personagem só sabe e só age com base no que consta em CONHECIMENTO até este
  capítulo. Não faça um personagem usar informação que ainda não obteve.
- Personagem morto ou ausente não atua na cena (exceto flashback explicitamente marcado).

ANTI-REPETIÇÃO:
- NÃO re-descreva por extenso nada que esteja em DESCRITOS. Referencie em poucas palavras.
- NÃO reutilize as frases, imagens ou comparações listadas em EVITAR_FRASES.
- Varie aberturas de parágrafo e de capítulo. Não reexplique ao leitor o que já foi
  narrado ("como sabemos…"); avance a história.

ELABORAÇÃO:
- Desenvolva a partir de BEAT_ATUAL e avance pelo menos um item de FIOS_ABERTOS.
- Mantenha o POV, o tempo verbal e o tom definidos no projeto.
- Saída em markup semântico limpo, sem formatação visual (conforme regras de diagramação).
```

Os marcadores `[LACUNA: …]` e `[NOVO_FATO: …]` são o elo com o pipeline: o detector trata `[LACUNA]` como pendência ao autor, e a atualização de estado consome `[NOVO_FATO]` para alimentar o cânone com confiabilidade.

---

## 10. Ferramentas a implementar

| Módulo | Responsabilidade |
|---|---|
| `lib/memory/ledgers.ts` | CRUD dos ledgers (fatos, eventos, conhecimento, fios, descritos, frases) |
| `lib/memory/state.ts` | Monta/atualiza `WorldStateSnapshot` e o resumo rolante |
| `lib/memory/retrieve.ts` | Recuperação híbrida (estruturado determinístico + RAG vetorial) |
| `lib/generate/context.ts` | Monta o Contexto Ancorado com orçamento de tokens |
| `lib/generate/extract.ts` | Extrai `[NOVO_FATO]`, eventos, conhecimento do capítulo finalizado |
| `lib/verify/continuity.ts` | Passe detector: extrai afirmações → confronta → gera `ConsistencyIssue` |
| `lib/verify/repetition.ts` | Detector de repetição (descritos + n-gram + embedding) |
| `lib/verify/timeline.ts` | Checagens de ordem causal, conhecimento, presença, coerência física |
| `lib/jobs/sweep.ts` | Varredura periódica de consistência (fila/cron) |
| UI: painel de issues + timeline navegável | Auditoria humana das `ConsistencyIssue` e dos eventos |

---

## 11. Prompt para o Claude Code

```
CONTEXTO
Projeto CriaBook (Next.js + Prisma + Postgres/pgvector). Vou implementar o MOTOR DE
CONSISTÊNCIA E CONTINUIDADE descrito em REGRAS_CONSISTENCIA_CRIABOOK.md. A meta é:
sem alucinação, sem repetição, timeline coerente, memória resgatável, rodando de forma
contínua a cada capítulo. Arquitetura de DOIS LAÇOS (preventivo + detector) + atualização
de estado.

TAREFA 1 — Camada de memória (Prisma)
Adicione os modelos CanonFact, TimelineEvent, CharacterKnowledge, WorldStateSnapshot,
DescribedItem, StylePhrase, PlotThread, ConsistencyIssue (conforme a spec). Gere migration.
Habilite a extensão pgvector. Crie src/lib/memory/ledgers.ts com CRUD tipado.

TAREFA 2 — Contexto Ancorado (laço preventivo)
Crie src/lib/generate/context.ts que monta o contexto de geração com orçamento de tokens:
sempre injeta cânone/estado/timeline/conhecimento/fios da cena; recupera por similaridade
o resto (src/lib/memory/retrieve.ts, híbrido estruturado + vetorial); anexa resumo rolante
e listas de evicção (DescribedItem, StylePhrase). Injete o bloco de instruções de sistema
da spec (seção 9).

TAREFA 3 — Atualização de estado
Crie src/lib/generate/extract.ts: ao finalizar um capítulo, extrai [NOVO_FATO], eventos
(com storyOrder e narrativeChapter), conhecimento adquirido e frases distintivas; atualiza
os ledgers e grava um novo WorldStateSnapshot (estado + resumo rolante).

TAREFA 4 — Laço detector
Crie src/lib/verify/continuity.ts (extrai afirmações do capítulo, confronta com os ledgers,
gera ConsistencyIssue com tipo/severidade/provênica), src/lib/verify/repetition.ts
(descritos + n-gram + similaridade de embedding) e src/lib/verify/timeline.ts (ordem causal,
conhecimento, presença, coerência física). hard => auto-revisão dirigida do trecho;
soft => apenas registra.

TAREFA 5 — Execução contínua
Integre os três laços ao fluxo de escrita (síncrono por capítulo). Implemente revalidação
incremental na edição (rastreie dependências: capítulos que usam fatos de K) e um job de
varredura periódica em src/lib/jobs/sweep.ts (fila/cron, não bloqueante).

TAREFA 6 — UI de auditoria
Painel de ConsistencyIssue (filtrável por tipo/severidade, com ação resolver/ignorar) e uma
timeline navegável dos TimelineEvent (ordenada por storyOrder, mostrando capítulo de narração
e participantes).

REGRAS GERAIS
- TypeScript estrito, sem any; funções puras quando possível.
- Fatos estruturados são a fonte de verdade; RAG é complemento, não substituto.
- Tudo idempotente e incremental: nunca reprocessar o livro inteiro sem necessidade.
- Testes para extract, continuity, repetition e timeline com casos de contradição.
- Documente em docs/consistencia.md como rodar cada laço localmente.

Comece pela TAREFA 1, mostre o diff e aguarde meu OK antes da TAREFA 2.
```

---

## 12. Checklist de conformidade

**Anti-alucinação**
- [ ] Geração só usa fatos do Contexto Ancorado; lacunas marcadas com `[LACUNA]`
- [ ] Novos fatos marcados com `[NOVO_FATO]` e extraídos ao cânone
- [ ] Detector confronta afirmações contra os ledgers com provênica
- [ ] Fatos têm proveniência (capítulo de origem) e status (active/retconned)

**Anti-repetição**
- [ ] `DescribedItem` impede re-descrição por extenso
- [ ] `StylePhrase` + similaridade de embedding pegam paráfrases repetidas
- [ ] Aberturas de parágrafo/capítulo variadas

**Timeline / continuidade**
- [ ] `storyOrder` separado de `narrativeChapter`
- [ ] Conhecimento por personagem respeitado (não age sobre o que não sabe)
- [ ] Ordem causal, presença e coerência física validadas
- [ ] Fios de trama abertos cobrados antes do fim

**Memória / continuidade operacional**
- [ ] `WorldStateSnapshot` atualizado a cada capítulo (estado + resumo rolante)
- [ ] Recuperação híbrida (estruturado + vetorial)
- [ ] Revalidação incremental na edição (dependências rastreadas)
- [ ] Varredura periódica em background

---

*Documento de regras e arquitetura para planejamento e implementação. Ajustar nomes, limiares e caminhos à estrutura real do CriaBook.*
