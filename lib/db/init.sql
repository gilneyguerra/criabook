-- ============================================================
-- CriaBook — criação inicial do schema no Neon
-- Cole TUDO no Neon → SQL Editor e clique em "Run".
-- (Equivale ao `npm run db:push` — use este caminho se não puder rodar npm.)
-- ============================================================

-- Extensão para embeddings (busca semântica de keywords)
CREATE EXTENSION IF NOT EXISTS vector;

-- ---------- Enums ----------
DO $$ BEGIN
  CREATE TYPE book_status AS ENUM ('draft','generating','review','done');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE page_number_position AS ENUM
    ('top-left','top-center','top-right','bottom-left','bottom-center','bottom-right');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE chapter_status AS ENUM ('pending','generating','review','done');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE keyword_category AS ENUM
    ('genre','character_role','plot_twist','tone','setting','theme');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE job_status AS ENUM ('queued','running','done','error');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE export_format AS ENUM ('pdf_web','pdf_print','epub');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE book_type AS ENUM ('fiction','nonfiction');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE rag_source_type AS ENUM
    ('chapter','character','location','world_rule','glossary');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---------- Better Auth ----------
CREATE TABLE IF NOT EXISTS "user" (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  email_verified boolean NOT NULL DEFAULT false,
  image text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS session (
  id text PRIMARY KEY,
  expires_at timestamp NOT NULL,
  token text NOT NULL UNIQUE,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS account (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamp,
  refresh_token_expires_at timestamp,
  scope text,
  password text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verification (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamp NOT NULL,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- ---------- Domínio (CriaBook) ----------
CREATE TABLE IF NOT EXISTS profiles (
  id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  display_name text,
  birth_date timestamp,
  is_adult_verified boolean NOT NULL DEFAULT false,
  credits_balance integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  title text,
  genre text,
  type book_type NOT NULL DEFAULT 'fiction',
  logline text,
  audience text,
  pov text,
  tone text,
  structure_method text,
  layout_profile_id text,
  language text NOT NULL DEFAULT 'pt-BR',
  is_adult boolean NOT NULL DEFAULT false,
  status book_status NOT NULL DEFAULT 'draft',
  page_target integer,
  page_number_position page_number_position NOT NULL DEFAULT 'bottom-center',
  brief jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS book_meta (
  book_id uuid PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
  dedication text,
  back_cover_text text,
  author_name text,
  cover_design jsonb,
  matter jsonb
);

CREATE TABLE IF NOT EXISTS chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  index integer NOT NULL,
  title text,
  subtitle text,
  content_json jsonb,
  content_text text,
  summary text,
  status chapter_status NOT NULL DEFAULT 'pending',
  tokens_used integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chapter_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  prompt text,
  model text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS story_beats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  "order" integer NOT NULL,
  title text,
  summary text,
  beat_type text,
  linked_chapter_id uuid REFERENCES chapters(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES chapters(id) ON DELETE SET NULL,
  label text,
  snapshot jsonb NOT NULL,
  diff jsonb,
  created_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category keyword_category NOT NULL,
  value text NOT NULL,
  embedding vector(1024),
  usage_count integer NOT NULL DEFAULT 1,
  created_by text REFERENCES "user"(id) ON DELETE SET NULL,
  is_global boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS keywords_embedding_idx
  ON keywords USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text NOT NULL,
  ref_id text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  type text NOT NULL,
  status job_status NOT NULL DEFAULT 'queued',
  progress integer NOT NULL DEFAULT 0,
  tokens_in integer NOT NULL DEFAULT 0,
  tokens_out integer NOT NULL DEFAULT 0,
  cost_estimate numeric,
  error text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  format export_format NOT NULL,
  storage_path text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

-- ---------- Bíblia da História (Fase A) ----------
CREATE TABLE IF NOT EXISTS characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  appearance text,
  traits text,
  arc text,
  notes text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS world_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  category text,
  rule text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  "order" integer NOT NULL DEFAULT 0,
  description text NOT NULL,
  chapter_ref integer,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS glossary_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  term text NOT NULL,
  definition text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

-- ---------- RAG (Fase A) ----------
CREATE TABLE IF NOT EXISTS rag_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  source_type rag_source_type NOT NULL,
  source_id text NOT NULL,
  chunk_text text NOT NULL,
  embedding vector(1024),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rag_chunks_book_source_idx
  ON rag_chunks (book_id, source_type);
CREATE INDEX IF NOT EXISTS rag_chunks_embedding_idx
  ON rag_chunks USING hnsw (embedding vector_cosine_ops);
