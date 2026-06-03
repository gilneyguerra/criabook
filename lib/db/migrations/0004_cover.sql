-- Migration 0004 — Designer de Capa (FERRAMENTA_CAPA)
-- Tabela 1:1 com books. A IA gera só a arte; texto é camada editável.
-- Idempotente. Rode no SQL Editor do Neon.

CREATE TABLE IF NOT EXISTS covers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL UNIQUE REFERENCES books(id) ON DELETE CASCADE,
  -- Camada 1 — arte
  front_art_url text,
  back_art_url text,
  art_prompt text,
  style text,
  palette jsonb,
  -- Camada 2 — tipografia
  title text,
  subtitle text,
  author_name text,
  highlight text,
  spine_text text,
  font_display text,
  font_text text,
  layout jsonb,
  -- Camada 3 — textos longos
  back_text text,
  social_proof jsonb,
  flap_front text,
  flap_bio text,
  author_photo_url text,
  -- Formato / acabamento
  target text NOT NULL DEFAULT 'ebook',
  binding text,
  has_flaps boolean NOT NULL DEFAULT false,
  spine_width_mm numeric,
  -- Saídas
  ebook_cover_url text,
  print_wrap_url text,
  updated_at timestamp NOT NULL DEFAULT now()
);
