-- ============================================================
-- Fase A (qualidade editorial): wizard + Bíblia + RAG
-- Rode UMA VEZ no Neon → SQL Editor. Idempotente (IF NOT EXISTS / IF EXISTS).
-- ============================================================

-- Enums novos
DO $$ BEGIN
  CREATE TYPE book_type AS ENUM ('fiction','nonfiction');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE rag_source_type AS ENUM
    ('chapter','character','location','world_rule','glossary');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- books: camada de ofício
ALTER TABLE books ADD COLUMN IF NOT EXISTS type book_type NOT NULL DEFAULT 'fiction';
ALTER TABLE books ADD COLUMN IF NOT EXISTS logline text;
ALTER TABLE books ADD COLUMN IF NOT EXISTS audience text;
ALTER TABLE books ADD COLUMN IF NOT EXISTS pov text;
ALTER TABLE books ADD COLUMN IF NOT EXISTS tone text;
ALTER TABLE books ADD COLUMN IF NOT EXISTS structure_method text;

-- chapters: resumo p/ RAG
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS summary text;

-- Bíblia da História
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

-- RAG: chunks indexados (Voyage 1024)
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
