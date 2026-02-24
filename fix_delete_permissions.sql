-- SCRIPT PARA CORRIGIR PERMISSÃO DE EXCLUSÃO (DELETE)
-- Execute este script no "SQL Editor" do Supabase para liberar a exclusão de históricos.

BEGIN;

    -- 1. Desabilita RLS especificamente para a tabela de histórico
    ALTER TABLE laudo_history DISABLE ROW LEVEL SECURITY;

    -- 2. Concede permissão explícita de DELETE para todos os usuários (anônimos e logados)
    GRANT DELETE ON TABLE laudo_history TO anon;
    GRANT DELETE ON TABLE laudo_history TO authenticated;
    GRANT DELETE ON TABLE laudo_history TO service_role;

    -- 3. Concede permissão de SELECT e INSERT também, para garantir
    GRANT SELECT, INSERT ON TABLE laudo_history TO anon;
    GRANT SELECT, INSERT ON TABLE laudo_history TO authenticated;
    GRANT SELECT, INSERT ON TABLE laudo_history TO service_role;

COMMIT;
