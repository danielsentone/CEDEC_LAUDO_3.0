-- Adiciona coluna de data de criação para permitir ordenação por inclusão
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
