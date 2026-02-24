-- SCRIPT DE CORREÇÃO DEFINITIVA DE PERMISSÕES
-- Execute este script no Editor SQL do Supabase para DESABILITAR o bloqueio de segurança (RLS).
-- Isso garantirá que o aplicativo consiga ler e gravar dados sem erros de permissão "42501".

BEGIN;

    -- 1. Desabilitar RLS nas tabelas (Permite acesso total para a chave API do projeto)
    ALTER TABLE engineers DISABLE ROW LEVEL SECURITY;
    ALTER TABLE protocols DISABLE ROW LEVEL SECURITY;
    ALTER TABLE laudo_history DISABLE ROW LEVEL SECURITY;

    -- 2. Garantir que as tabelas estão no schema public e acessíveis
    GRANT ALL ON TABLE engineers TO anon;
    GRANT ALL ON TABLE engineers TO authenticated;
    GRANT ALL ON TABLE engineers TO service_role;

    GRANT ALL ON TABLE protocols TO anon;
    GRANT ALL ON TABLE protocols TO authenticated;
    GRANT ALL ON TABLE protocols TO service_role;

    GRANT ALL ON TABLE laudo_history TO anon;
    GRANT ALL ON TABLE laudo_history TO authenticated;
    GRANT ALL ON TABLE laudo_history TO service_role;

COMMIT;
