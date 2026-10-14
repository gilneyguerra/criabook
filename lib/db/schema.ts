import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  jsonb,
  uuid,
  vector,
  index,
  uniqueIndex,
  bigint,
  primaryKey,
} from "drizzle-orm/pg-core";

/* ============================================================
 * Better Auth — auth por e-mail/senha + OAuth
 * ============================================================ */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Rate limit do Better Auth (rateLimit.storage = "database"): login,
// cadastro e reset de senha por IP. Formato exigido pelo better-auth 1.7.
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// Rate limit das entradas de IA por usuário (janela fixa): uma linha por
// usuário e janela ("minute" | "day"), atualizada com um único upsert.
export const aiRateLimits = pgTable(
  "ai_rate_limits",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    bucket: text("bucket").notNull(),
    windowStart: timestamp("window_start").notNull(),
    count: integer("count").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.bucket] })]
);

/* ============================================================
 * Enums de domínio
 * ============================================================ */

export const bookStatus = pgEnum("book_status", [
  "draft",
  "generating",
  "review",
  "done",
]);

export const pageNumberPosition = pgEnum("page_number_position", [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
]);

export const chapterStatus = pgEnum("chapter_status", [
  "pending",
  "generating",
  "review",
  "done",
]);

export const keywordCategory = pgEnum("keyword_category", [
  "genre",
  "character_role",
  "plot_twist",
  "tone",
  "setting",
  "theme",
]);

export const jobStatus = pgEnum("job_status", [
  "queued",
  "running",
  "done",
  "error",
]);

export const exportFormat = pgEnum("export_format", [
  "pdf_web",
  "pdf_print",
  "epub",
]);

export const bookType = pgEnum("book_type", ["fiction", "nonfiction"]);

/* ============================================================
 * Tabelas de domínio (CriaBook)
 * Autorização é feita na aplicação: toda query filtra por owner/userId.
 * ============================================================ */

// Estende o usuário do Better Auth com dados de produto.
export const profiles = pgTable("profiles", {
  id: text("id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  displayName: text("display_name"),
  birthDate: timestamp("birth_date"),
  isAdultVerified: boolean("is_adult_verified").notNull().default(false),
  creditsBalance: integer("credits_balance").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const books = pgTable("books", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text("title"),
  genre: text("genre"),
  // Camada de ofício (Fase A — wizard editorial)
  type: bookType("type").notNull().default("fiction"),
  logline: text("logline"), // promessa central / transformação prometida
  audience: text("audience"), // leitor-alvo e nível
  pov: text("pov"), // ex.: "first_past", "third_present"
  tone: text("tone"),
  structureMethod: text("structure_method"), // three_act | hero_journey | save_the_cat | story_circle | nonfiction
  layoutProfileId: text("layout_profile_id"), // Perfil de Layout (diagramação) — lib/layout/profile.ts
  language: text("language").notNull().default("pt-BR"),
  isAdult: boolean("is_adult").notNull().default(false),
  status: bookStatus("status").notNull().default("draft"),
  pageTarget: integer("page_target"),
  pageNumberPosition: pageNumberPosition("page_number_position")
    .notNull()
    .default("bottom-center"),
  brief: jsonb("brief"), // book_brief montado no construtor de prompt (Fase 3)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const bookMeta = pgTable("book_meta", {
  bookId: uuid("book_id")
    .primaryKey()
    .references(() => books.id, { onDelete: "cascade" }),
  dedication: text("dedication"),
  backCoverText: text("back_cover_text"),
  authorName: text("author_name"),
  coverDesign: jsonb("cover_design"), // estado do canvas da capa (Fase 9)
  matter: jsonb("matter"), // front/back matter editável (Fase A5)
});

export const chapters = pgTable("chapters", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookId: uuid("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  index: integer("index").notNull(),
  title: text("title"),
  subtitle: text("subtitle"),
  contentJson: jsonb("content_json"), // documento TipTap/ProseMirror
  contentText: text("content_text"), // texto puro p/ busca/contagem
  summary: text("summary"), // resumo de 1 parágrafo (RAG)
  status: chapterStatus("status").notNull().default("pending"),
  tokensUsed: integer("tokens_used").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const chapterImages = pgTable("chapter_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  chapterId: uuid("chapter_id")
    .notNull()
    .references(() => chapters.id, { onDelete: "cascade" }),
  storagePath: text("storage_path").notNull(), // Vercel Blob URL/key
  prompt: text("prompt"),
  model: text("model"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const storyBeats = pgTable("story_beats", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookId: uuid("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  order: integer("order").notNull(),
  title: text("title"),
  summary: text("summary"),
  beatType: text("beat_type"),
  linkedChapterId: uuid("linked_chapter_id").references(() => chapters.id, {
    onDelete: "set null",
  }),
});

/* ============================================================
 * Bíblia da História (Fase A) — fonte única de verdade
 * ============================================================ */

export const characters = pgTable("characters", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookId: uuid("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role"), // protagonista, antagonista, secundário
  appearance: text("appearance"),
  traits: text("traits"),
  arc: text("arc"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const locations = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookId: uuid("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const worldRules = pgTable("world_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookId: uuid("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  category: text("category"), // magia, tecnologia, política...
  rule: text("rule").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const timelineEvents = pgTable("timeline_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookId: uuid("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  order: integer("order").notNull().default(0), // storyOrder (tempo da história)
  description: text("description").notNull(),
  chapterRef: integer("chapter_ref"), // narrativeChapter (onde é narrado)
  // Motor de consistência (REGRAS_CONSISTENCIA) — Event Ledger.
  participants: jsonb("participants"), // string[] de nomes de personagens
  location: text("location"),
  storyTime: text("story_time"), // "Dia 3, manhã" / "Primavera, ano 412"
  causedBy: uuid("caused_by"), // id de evento anterior (relação causal)
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const glossaryTerms = pgTable("glossary_terms", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookId: uuid("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  term: text("term").notNull(),
  definition: text("definition").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ============================================================
 * Motor de Consistência e Continuidade (REGRAS_CONSISTENCIA)
 * Memória resgatável: fatos atômicos com proveniência + estado.
 * ============================================================ */

export const factStatus = pgEnum("fact_status", ["active", "retconned"]);
export const threadStatus = pgEnum("thread_status", [
  "open",
  "resolved",
  "abandoned",
]);
export const issueType = pgEnum("consistency_issue_type", [
  "hallucination",
  "repetition",
  "timeline",
  "knowledge",
  "thread",
]);
export const issueSeverity = pgEnum("consistency_issue_severity", [
  "hard",
  "soft",
]);
export const issueStatus = pgEnum("consistency_issue_status", [
  "open",
  "resolved",
  "ignored",
]);

// Fatos atômicos do cânone, cada um com proveniência (capítulo de origem).
export const canonFacts = pgTable(
  "canon_facts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(), // "Lia", "Reino de Aval", "magia"
    attribute: text("attribute").notNull(), // "cor_dos_olhos", "regra"
    value: text("value").notNull(),
    establishedInChapter: integer("established_in_chapter").notNull(),
    status: factStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("canon_facts_book_subject_idx").on(t.bookId, t.subject)]
);

// Quem sabe o quê, e a partir de qual capítulo.
export const characterKnowledge = pgTable(
  "character_knowledge",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    character: text("character").notNull(),
    fact: text("fact").notNull(),
    learnedInChapter: integer("learned_in_chapter").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("character_knowledge_book_char_idx").on(t.bookId, t.character)]
);

// Promessas narrativas (armas de Chekhov) abertas e quando fecham.
export const plotThreads = pgTable(
  "plot_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    openedInChapter: integer("opened_in_chapter").notNull(),
    closedInChapter: integer("closed_in_chapter"),
    status: threadStatus("status").notNull().default("open"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("plot_threads_book_status_idx").on(t.bookId, t.status)]
);

// "Foto" compacta do mundo ao fim do capítulo N + resumo rolante.
export const worldStateSnapshots = pgTable(
  "world_state_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    asOfChapter: integer("as_of_chapter").notNull(),
    payload: jsonb("payload"), // posições, estados, itens, fios
    summary: text("summary"), // resumo rolante cumulativo até aqui
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("world_state_book_chapter_idx").on(t.bookId, t.asOfChapter)]
);

// O que já foi descrito por extenso (anti-redescrição).
export const describedItems = pgTable(
  "described_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(), // "aparência de Lia", "torre do norte"
    describedInChapter: integer("described_in_chapter").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("described_items_book_subject_idx").on(t.bookId, t.subject)]
);

// Relatório de violações de continuidade (laço detector).
export const consistencyIssues = pgTable(
  "consistency_issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    chapter: integer("chapter"),
    type: issueType("type").notNull(),
    severity: issueSeverity("severity").notNull(),
    description: text("description").notNull(),
    conflictsWith: text("conflicts_with"), // fato/evento em conflito + proveniência
    status: issueStatus("status").notNull().default("open"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("consistency_issues_book_status_idx").on(t.bookId, t.status)]
);

/* ============================================================
 * Capa (FERRAMENTA_CAPA) — designer em 3 camadas, 1:1 com o livro.
 * A IA gera só a ARTE; todo texto é camada editável.
 * ============================================================ */

export const covers = pgTable("covers", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookId: uuid("book_id")
    .notNull()
    .unique()
    .references(() => books.id, { onDelete: "cascade" }),
  // Camada 1 — arte
  frontArtUrl: text("front_art_url"),
  backArtUrl: text("back_art_url"),
  artPrompt: text("art_prompt"),
  style: text("style"),
  palette: jsonb("palette"), // { background, accent, ... }
  // Camada 2 — tipografia (capa frontal + lombada)
  title: text("title"),
  subtitle: text("subtitle"),
  authorName: text("author_name"),
  highlight: text("highlight"),
  spineText: text("spine_text"),
  fontDisplay: text("font_display"),
  fontText: text("font_text"),
  layout: jsonb("layout"), // posições/cores/tamanhos dos textos
  // Camada 3 — textos longos
  backText: text("back_text"),
  socialProof: jsonb("social_proof"), // [{ quote, author }]
  flapFront: text("flap_front"),
  flapBio: text("flap_bio"),
  authorPhotoUrl: text("author_photo_url"),
  // Formato / acabamento
  target: text("target").notNull().default("ebook"), // ebook | print
  binding: text("binding"), // brochura | brochura_orelhas | capa_dura | kdp_brochura
  hasFlaps: boolean("has_flaps").notNull().default(false),
  spineWidthMm: numeric("spine_width_mm"),
  // Saídas
  ebookCoverUrl: text("ebook_cover_url"), // 2500x3500 JPG composto
  printWrapUrl: text("print_wrap_url"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ============================================================
 * RAG — chunks indexados (capítulos + Bíblia) p/ recuperação
 * ============================================================ */

export const ragSourceType = pgEnum("rag_source_type", [
  "chapter",
  "character",
  "location",
  "world_rule",
  "glossary",
]);

export const ragChunks = pgTable(
  "rag_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    sourceType: ragSourceType("source_type").notNull(),
    sourceId: text("source_id").notNull(), // id da fonte (chapter/character/...)
    chunkText: text("chunk_text").notNull(),
    embedding: vector("embedding", { dimensions: 1024 }), // Voyage voyage-3.5
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("rag_chunks_book_source_idx").on(table.bookId, table.sourceType),
    index("rag_chunks_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops")
    ),
  ]
);

export const versions = pgTable("versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookId: uuid("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  chapterId: uuid("chapter_id").references(() => chapters.id, {
    onDelete: "set null",
  }),
  label: text("label"),
  snapshot: jsonb("snapshot").notNull(), // estado completo no momento
  diff: jsonb("diff"), // diff em relação à versão anterior
  createdBy: text("created_by").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const keywords = pgTable(
  "keywords",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: keywordCategory("category").notNull(),
    value: text("value").notNull(),
    embedding: vector("embedding", { dimensions: 1024 }), // Voyage voyage-3.5
    usageCount: integer("usage_count").notNull().default(1),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    isGlobal: boolean("is_global").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    // Busca por similaridade semântica (cosine). Requer extensão `vector`.
    index("keywords_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops")
    ),
  ]
);

export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(), // + compra, - consumo
    reason: text("reason").notNull(),
    refId: text("ref_id"), // id da operação relacionada (job, checkout...)
    // Operação de IA (chapter, humanize, image...) nos lançamentos de
    // reserva/acerto/estorno; base para recalibrar as estimativas.
    op: text("op"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    // Uma sessão de checkout do Stripe credita no máximo uma vez.
    uniqueIndex("credit_ledger_purchase_ref_uniq")
      .on(table.refId)
      .where(sql`${table.reason} = 'compra'`),
    // Cada reserva é fechada uma única vez: ou por acerto, ou por estorno.
    uniqueIndex("credit_ledger_settle_ref_uniq")
      .on(table.refId)
      .where(sql`${table.reason} in ('acerto', 'estorno')`),
  ]
);

export const generationJobs = pgTable("generation_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookId: uuid("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'structure' | 'chapter' | 'image' | ...
  status: jobStatus("status").notNull().default("queued"),
  progress: integer("progress").notNull().default(0),
  tokensIn: integer("tokens_in").notNull().default(0),
  tokensOut: integer("tokens_out").notNull().default(0),
  costEstimate: numeric("cost_estimate"),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const exports = pgTable("exports", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookId: uuid("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  format: exportFormat("format").notNull(),
  storagePath: text("storage_path").notNull(), // Vercel Blob URL/key
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
