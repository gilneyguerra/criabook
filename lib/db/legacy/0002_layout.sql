-- Migration 0002 — Perfil de Layout (diagramação)
-- Adiciona a coluna que liga cada livro a um BookLayoutProfile
-- (lib/layout/profile.ts). Idempotente: seguro rodar mais de uma vez.
-- Rode no SQL Editor do Neon.

ALTER TABLE books ADD COLUMN IF NOT EXISTS layout_profile_id text;
