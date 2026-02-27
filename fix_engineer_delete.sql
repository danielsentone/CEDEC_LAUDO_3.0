-- SCRIPT PARA CORRIGIR EXCLUSÃO DE ENGENHEIROS
-- Este script altera as chaves estrangeiras para permitir a exclusão de engenheiros,
-- definindo como NULL as referências em protocolos e históricos.

BEGIN;

    -- 1. Atualiza a tabela 'protocols' (coluna engineerId)
    ALTER TABLE protocols 
    DROP CONSTRAINT IF EXISTS protocols_engineerId_fkey;
    
    ALTER TABLE protocols 
    ADD CONSTRAINT protocols_engineerId_fkey 
    FOREIGN KEY ("engineerId") REFERENCES engineers(id) ON DELETE SET NULL;

    -- 2. Atualiza a tabela 'protocols' (coluna distributedToId)
    ALTER TABLE protocols 
    DROP CONSTRAINT IF EXISTS protocols_distributedToId_fkey;
    
    ALTER TABLE protocols 
    ADD CONSTRAINT protocols_distributedToId_fkey 
    FOREIGN KEY ("distributedToId") REFERENCES engineers(id) ON DELETE SET NULL;

    -- 3. Atualiza a tabela 'laudo_history'
    ALTER TABLE laudo_history 
    DROP CONSTRAINT IF EXISTS laudo_history_engineer_id_fkey;
    
    ALTER TABLE laudo_history 
    ADD CONSTRAINT laudo_history_engineer_id_fkey 
    FOREIGN KEY (engineer_id) REFERENCES engineers(id) ON DELETE SET NULL;

    -- 4. Garante permissões de DELETE na tabela engineers
    GRANT DELETE ON TABLE engineers TO anon;
    GRANT DELETE ON TABLE engineers TO authenticated;
    GRANT DELETE ON TABLE engineers TO service_role;

COMMIT;
