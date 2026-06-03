# CriaBook — Fluxo de Criação e Experiência do Usuário (UX)

> **Documento:** Arquitetura de informação + fluxo de elaboração do livro
> **Produto:** CriaBook — Gerador de Livros por IA
> **Versão:** 1.0 · Junho/2026
> **Base de análise:** capturas reais das abas do app (Dashboard · Escrita · Bíblia · Mapa · Revisão · Versões · Páginas · Base).
> **Objetivo:** ordenar as ferramentas que já existem numa sequência intuitiva ("primeiro isto, depois aquilo"), fundir **Base + Bíblia** numa janela única responsiva com geração por IA por item, e encadear as etapas para maximizar a eficácia da criação.

---

## Sumário

1. [Estado atual do app](#1-estado-atual-do-app)
2. [Diagnóstico: o problema é sequência, não ferramenta](#2-diagnóstico-o-problema-é-sequência-não-ferramenta)
3. [O fluxo proposto (6 etapas + utilitários)](#3-o-fluxo-proposto-6-etapas--utilitários)
4. [A janela única: Base + Bíblia](#4-a-janela-única-base--bíblia)
5. [Detalhamento por etapa (concatenando as ferramentas)](#5-detalhamento-por-etapa-concatenando-as-ferramentas)
6. [Encadeamento e indicador de progresso](#6-encadeamento-e-indicador-de-progresso)
7. [Ajustes finos observados nos prints](#7-ajustes-finos-observados-nos-prints)
8. [Lista de mudanças priorizadas](#8-lista-de-mudanças-priorizadas)
9. [Prompt para o Claude Code](#9-prompt-para-o-claude-code)
10. [Checklist de conformidade](#10-checklist-de-conformidade)

---

## 1. Estado atual do app

O app já implementa quase tudo dos documentos anteriores (PRD, diagramação, consistência). Mapa real das abas observadas:

| Aba (header) | Título interno | O que faz hoje |
|---|---|---|
| **Dashboard** | — | Início / visão geral dos projetos |
| **Escrita** | (editor) | Editor com sidebar de capítulos; toolbar: contagem, Salvo HH:MM, **Humanizar seleção**, **Normalizar**, **Salvar**, **Versão**, **Continuar capítulo**, **Próximo capítulo**, **Ilustrar**, **EPUB** |
| **Bíblia** | "Bíblia da história" | Fonte única de verdade injetada na geração. Personagens (Nome, Papel, Aparência, Traços, Arco), Locais (Nome, Descrição). Link "Ir para a escrita →" |
| **Mapa** | — | Estrutura / mapa de beats da história |
| **Revisão** | "Motor de consistência" | "Verificar consistência" + filtro Todas/Hard/Soft; confronta capítulos contra cânone, linha do tempo, conhecimento e fios de trama, com proveniência |
| **Versões** | "Versões" | Cada geração e versão manual viram ponto restaurável; histórico nunca apagado; rollback também registra |
| **Páginas** | "Front & back matter" | Nome do autor, Dedicatória, Epígrafe, Sobre o autor, Agradecimentos, CTA. Copyright, sumário e aviso de IA automáticos, com pré-visualização |
| **Base** | "A base do seu livro" | Título; Base editorial (Ficção/Não-ficção, logline, público, tom, POV, método estrutural, perfil de diagramação); Gênero (tags + "Sugerir") |

Conclusão: as **capacidades** estão prontas. Falta **organizá-las como um caminho**.

---

## 2. Diagnóstico: o problema é sequência, não ferramenta

A ordem atual do header não conta uma história de criação:

```
Dashboard · Escrita · Bíblia · Mapa · Revisão · Versões · Páginas · Base
```

Dois sintomas:

- A **Base** (onde o livro começa) está em **último**.
- A **Escrita** (produto final da geração) está em **segundo**.

Quem abre o app não sabe por onde começar. Além disso, **Base** e **Bíblia** são, do ponto de vista da IA, a mesma coisa — material de referência injetado na geração — mas estão em abas separadas, obrigando o usuário a lembrar de preencher as duas.

As três correções centrais deste documento:

1. **Reordenar e numerar** as abas na ordem do fluxo.
2. **Fundir Base + Bíblia** numa janela única responsiva.
3. **Encadear** cada etapa à seguinte com um botão "Próximo: … →".

---

## 3. O fluxo proposto (6 etapas + utilitários)

Sequência em que as abas devem aparecer no header, da esquerda para a direita:

```
Dashboard │ 1 Base & Bíblia │ 2 Mapa │ 3 Escrita │ 4 Revisão │ 5 Páginas │ 6 Exportar │ Versões
└utilitário┘ └────────────────────────── fluxo numerado ──────────────────────────┘ └utilitário┘
```

```
┌──────────────┐   ┌──────────┐   ┌──────────┐
│ 1 Base &     │──▶│ 2 Mapa   │──▶│ 3 Escrita│──┐
│   Bíblia     │   │ estrutura│   │ gerar    │  │
│ fundação+mundo│  │ e beats  │   │ capítulos│  │
└──────────────┘   └──────────┘   └──────────┘  │
                                                 ▼
┌──────────────┐   ┌──────────┐   ┌──────────┐
│ 6 Exportar   │◀──│ 5 Páginas│◀──│ 4 Revisão│
│ EPUB e PDF   │   │ front/back│  │ checar   │
│              │   │ matter   │   │ consist. │
└──────────────┘   └──────────┘   └──────────┘
```

**Utilitários (fora da linha do fluxo, sempre acessíveis):**
- **Dashboard** — início / troca de projeto.
- **Versões** — histórico e rollback (disponível em qualquer etapa).

**Regra de transição:** cada etapa só "empurra" para a seguinte quando seu mínimo está satisfeito (ver [seção 6](#6-encadeamento-e-indicador-de-progresso)), mas o usuário pode navegar livremente — o fluxo é um trilho sugerido, não uma cerca.

---

## 4. A janela única: Base + Bíblia

A etapa 1 funde as duas abas de hoje numa só, em **duas colunas responsivas**.

### 4.1 Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ PASSO 1   Base & Bíblia          [✨ Gerar mundo a partir da base]│
├───────────────────────────────┬───────────────────────────────────┤
│ BASE EDITORIAL                 │ BÍBLIA DA HISTÓRIA                 │
│                                │                                    │
│ Título ......................  │ Personagens (n)      [✨ Gerar]    │
│ ( Ficção | Não-ficção )        │  ┌ card personagem ───────────┐    │
│ Promessa central   [✨ Sugerir]│  └────────────────────────────┘    │
│ Público / Tom                  │ Locais (n)           [✨ Gerar]    │
│ POV / Método                   │  ┌ card local ────────────────┐    │
│ Perfil de diagramação          │  └────────────────────────────┘    │
│ Gênero (tags)      [✨ Sugerir]│ Regras do mundo (n)  [✨ Gerar]    │
│                                │ Linha do tempo (n)   [✨ Gerar]    │
├───────────────────────────────┴───────────────────────────────────┤
│ Em telas estreitas as colunas empilham.        [ Próximo: Mapa → ] │
└─────────────────────────────────────────────────────────────────┘
```

- **Responsividade:** grid `repeat(auto-fit, minmax(280px, 1fr))`. Em ≥ ~600px de largura, duas colunas lado a lado; abaixo disso, empilham (Base em cima, Bíblia embaixo). Mantém a responsividade exigida.
- **Coluna esquerda (Base editorial):** exatamente os campos de hoje da aba Base.
- **Coluna direita (Bíblia da história):** as seções de hoje da aba Bíblia (personagens, locais, regras, linha do tempo).

### 4.2 Geração por IA — dois níveis

A peça nova. Tudo é criável com IA, de forma sincronizada:

1. **Em cascata** — o botão **"✨ Gerar mundo a partir da base"** lê a Base preenchida (logline + gênero + tom + método estrutural) e propõe a Bíblia inteira de uma vez: elenco com papel/aparência/traços/arco, locais, regras, esqueleto de linha do tempo. É a montagem sincronizada: preencheu a Base → o mundo nasce dela, já coerente.
2. **Por item** — cada campo da Base ("✨ Sugerir" na logline, no público/tom, no gênero) e cada seção da Bíblia ("✨ Gerar" em Personagens, Locais, Regras, Linha do tempo) tem seu botão para criar/regerar isoladamente.

> O padrão de botão de IA já existe no app (o "Sugerir" do Gênero, imagem 1). A mudança é **replicá-lo em todos os campos** e adicionar o gerador em cascata no topo.

### 4.3 Por que unir faz sentido

Base e Bíblia são o **mesmo material**: o guia injetado na geração. Unidos numa janela, o usuário vê de relance tudo que a IA vai usar como verdade, preenche numa passada só, e a sincronização Base → Bíblia evita um mundo que contradiz o DNA editorial. A própria Bíblia já declara isso no app: *"tudo que você cadastrar aqui é injetado na geração para manter a consistência"*.

---

## 5. Detalhamento por etapa (concatenando as ferramentas)

Cada etapa usa ferramentas que **já existem** — só reordenadas e encadeadas.

### Etapa 1 — Base & Bíblia (fundação + mundo)
- **Usuário faz:** define o DNA (título, ficção/não-ficção, logline, público, tom, POV, método, perfil de diagramação, gênero) e constrói o mundo (personagens, locais, regras, linha do tempo).
- **Ferramentas:** janela unificada da [seção 4]; "✨ Sugerir/Gerar" por item; "✨ Gerar mundo a partir da base".
- **Alimenta:** toda a geração e o Motor de Consistência.

### Etapa 2 — Mapa (estrutura e beats)
- **Usuário faz:** gera o esqueleto de beats a partir do método estrutural definido na Base; ajusta a ordem dos capítulos.
- **Ferramentas:** aba Mapa; geração de beats a partir do método.
- **Alimenta:** a Escrita (cada capítulo sabe qual beat cumprir).

### Etapa 3 — Escrita (gerar capítulos)
- **Usuário faz:** gera capítulo a capítulo, ancorado na Base+Bíblia e no Mapa; edita; pode ditar por voz; ilustra.
- **Ferramentas (toolbar atual):** Continuar capítulo, Próximo capítulo, Humanizar seleção, Normalizar, Ilustrar, Salvar, Versão.
- **Alimenta:** a Revisão e as Páginas (sumário).

### Etapa 4 — Revisão (checar consistência)
- **Usuário faz:** roda "Verificar consistência" após gerar; resolve os apontamentos Hard/Soft.
- **Ferramentas:** Motor de Consistência (laço detector); filtro Todas/Hard/Soft; proveniência das contradições.
- **Lê de:** a memória construída na Etapa 1 + capítulos da Etapa 3.

### Etapa 5 — Páginas (front & back matter)
- **Usuário faz:** preenche nome do autor, dedicatória, epígrafe, sobre o autor, agradecimentos, CTA. Copyright, sumário e aviso de IA saem automáticos.
- **Ferramentas:** aba Páginas com pré-visualização ao vivo.

### Etapa 6 — Exportar (EPUB e PDF)
- **Usuário faz:** exporta o livro pronto, usando o Perfil de diagramação definido na Etapa 1.
- **Ferramentas:** o **EPUB** (hoje botão solto na toolbar da Escrita) vira **etapa própria**, somando PDF de impressão e validação (EPUBCheck) e o bundle pronto-para-publicar.

### Utilitários
- **Dashboard:** início / troca de projeto.
- **Versões:** restauração de qualquer ponto, a qualquer momento.

---

## 6. Encadeamento e indicador de progresso

Duas adições de UX que transformam abas soltas num caminho:

**Botão "Próximo: … →"** no rodapé de cada etapa, levando à seguinte. O app já faz isso na Bíblia ("Ir para a escrita →") — basta padronizar em todas:

```
1 Base & Bíblia  → "Próximo: Mapa →"
2 Mapa           → "Próximo: Escrita →"
3 Escrita        → "Próximo: Revisão →"
4 Revisão        → "Próximo: Páginas →"
5 Páginas        → "Próximo: Exportar →"
6 Exportar       → "Concluir / baixar"
```

**Indicador de progresso** (no header ou numa barra fina abaixo dele): marca quais etapas têm o mínimo preenchido.

```
✓ Base & Bíblia   ✓ Mapa   ● Escrita   ○ Revisão   ○ Páginas   ○ Exportar
(✓ feito · ● em andamento · ○ pendente)
```

Critérios mínimos sugeridos por etapa (para o "✓"):
- **1:** logline + gênero + perfil de diagramação preenchidos; ≥ 1 personagem.
- **2:** ao menos um esboço de beats.
- **3:** ≥ 1 capítulo gerado.
- **4:** verificação rodada, sem issue Hard aberta.
- **5:** nome do autor preenchido.
- **6:** export gerado com sucesso.

---

## 7. Ajustes finos observados nos prints

- **Itálico cru no editor (imagem 3):** os asteriscos de `*Venha ao Porto Seco*` aparecem literais. O Normalizar / render deveria converter ênfase markdown em itálico real (e, em PT-BR, decidir entre itálico ou aspas para pensamentos/cifras).
- **"Humanizar seleção" vs "Normalizar":** estão lado a lado e fazem coisas diferentes — um mexe no **estilo da prosa**, o outro nos **caracteres tipográficos** (aspas curvas, travessão, reticências). Deixar isso explícito (tooltip ou subtítulo curto) evita confusão.
- **Promover o EPUB:** tirar o EPUB da toolbar da Escrita e levá-lo à Etapa 6, junto de PDF e validação, para não misturar "escrever" com "publicar".
- **Numerar as abas:** prefixar "1…6" no header torna o fluxo auto-explicativo sem precisar de tutorial.

---

## 8. Lista de mudanças priorizadas

| # | Mudança | Impacto | Esforço |
|---|---|---|---|
| 1 | Reordenar e numerar o header na sequência do fluxo | Alto | Baixo |
| 2 | Fundir Base + Bíblia numa aba (2 colunas responsivas) | Alto | Médio |
| 3 | Botão "Próximo: … →" no rodapé de cada etapa | Alto | Baixo |
| 4 | "✨ Gerar/Sugerir" em cada campo da Base e seção da Bíblia | Médio | Médio |
| 5 | "✨ Gerar mundo a partir da base" (cascata sincronizada) | Alto | Médio |
| 6 | Indicador de progresso (✓/●/○) | Médio | Baixo |
| 7 | Promover EPUB → Etapa 6 (Exportar) + PDF + validação | Médio | Médio |
| 8 | Render de itálico no editor + tooltips Humanizar/Normalizar | Baixo | Baixo |

---

## 9. Prompt para o Claude Code

```
CONTEXTO
Projeto CriaBook (Next.js + Prisma). O app já tem as abas: Dashboard, Escrita, Bíblia,
Mapa, Revisão, Versões, Páginas, Base. As funcionalidades existem, mas a ordem não segue
o fluxo de criação e Base/Bíblia estão separadas. Vou aplicar o doc FLUXO_E_UX_CRIABOOK.md.

TAREFA 1 — Reordenar e numerar o header
Reordene a navegação para: Dashboard | 1 Base & Bíblia | 2 Mapa | 3 Escrita | 4 Revisão |
5 Páginas | 6 Exportar | Versões. Numere as 6 etapas do fluxo (1–6). Trate Dashboard e
Versões como utilitários (visualmente separados do trilho numerado, ex.: à direita).

TAREFA 2 — Fundir Base + Bíblia
Crie uma rota/aba única "Base & Bíblia" que renderiza as duas seções em grid
repeat(auto-fit, minmax(280px,1fr)) — duas colunas em telas largas, empilhadas no mobile.
Coluna esquerda = campos atuais da Base; coluna direita = seções atuais da Bíblia
(personagens, locais, regras, linha do tempo). Remova as abas Base e Bíblia isoladas (ou
redirecione-as para a nova). Preserve a persistência atual (mesmos modelos Prisma).

TAREFA 3 — Geração por IA sincronizada
a) Por item: adicione um botão "✨ Sugerir/Gerar" a cada campo da Base (logline, público,
   tom, gênero) e a cada seção da Bíblia, reaproveitando o padrão do botão "Sugerir" do
   Gênero que já existe.
b) Em cascata: adicione "✨ Gerar mundo a partir da base" no topo, que envia a Base
   (logline, gênero, tom, método) ao gerador e popula a Bíblia (personagens com papel/
   aparência/traços/arco, locais, regras, esboço de linha do tempo) numa chamada.
   Tudo deve gravar nos mesmos ledgers/modelos já usados pelo Motor de Consistência.

TAREFA 4 — Encadeamento e progresso
Adicione um botão "Próximo: <etapa> →" no rodapé de cada etapa (padroniza o "Ir para a
escrita →" que já existe). Adicione um indicador de progresso (✓ feito / ● atual /
○ pendente) baseado nos critérios mínimos: (1) logline+gênero+perfil+≥1 personagem;
(2) ≥1 beat; (3) ≥1 capítulo; (4) verificação sem Hard aberto; (5) nome do autor; (6) export ok.

TAREFA 5 — Exportar como etapa
Mova o botão EPUB da toolbar da Escrita para uma aba "6 Exportar" que reúne EPUB, PDF e a
validação (EPUBCheck), usando o Perfil de diagramação definido em Base & Bíblia.

TAREFA 6 — Ajustes finos
Renderize ênfase markdown (*texto*) como itálico real no editor. Adicione tooltips curtos
distinguindo "Humanizar seleção" (estilo da prosa) de "Normalizar" (caracteres tipográficos).

REGRAS GERAIS
- Não quebre dados existentes; reaproveite modelos e endpoints atuais.
- TypeScript estrito; componentes responsivos (mobile-first).
- Cada etapa navegável livremente; o fluxo é trilho sugerido, não bloqueio.
- Documente em docs/fluxo-ux.md a nova navegação.

Comece pela TAREFA 1, mostre o diff e aguarde meu OK antes da TAREFA 2.
```

---

## 10. Checklist de conformidade

**Navegação**
- [ ] Header reordenado: Dashboard | 1 Base & Bíblia | 2 Mapa | 3 Escrita | 4 Revisão | 5 Páginas | 6 Exportar | Versões
- [ ] Etapas 1–6 numeradas; Dashboard e Versões como utilitários
- [ ] Indicador de progresso (✓/●/○) visível

**Janela única Base + Bíblia**
- [ ] Duas colunas responsivas que empilham no mobile
- [ ] Coluna esquerda = Base; direita = Bíblia
- [ ] "✨ Sugerir/Gerar" em cada campo e seção
- [ ] "✨ Gerar mundo a partir da base" (cascata)
- [ ] Grava nos mesmos modelos do Motor de Consistência

**Encadeamento**
- [ ] Botão "Próximo: … →" em todas as etapas
- [ ] Critérios mínimos por etapa definidos

**Exportar e ajustes**
- [ ] EPUB movido para a Etapa 6, com PDF e validação
- [ ] Itálico renderizado no editor
- [ ] Tooltips Humanizar vs Normalizar

---

*Documento de planejamento de UX e arquitetura de informação. Baseado nas capturas reais do app; ajustar nomes de rotas/componentes à estrutura real do CriaBook.*
