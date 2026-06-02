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
  order: integer("order").notNull().default(0),
  description: text("description").notNull(),
  chapterRef: integer("chapter_ref"),
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

export const creditLedger = pgTable("credit_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  delta: integer("delta").notNull(), // + compra, - consumo
  reason: text("reason").notNull(),
  refId: text("ref_id"), // id da operação relacionada (job, checkout...)
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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
