-- Create property_data table
CREATE TABLE IF NOT EXISTS property_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipio TEXT NOT NULL,
    inscricao_municipal TEXT,
    indicacao_fiscal TEXT,
    logradouro TEXT,
    proprietario TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE property_data ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Public Read Property Data" ON property_data;
CREATE POLICY "Public Read Property Data" ON property_data
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin All Property Data" ON property_data;
CREATE POLICY "Admin All Property Data" ON property_data
FOR ALL USING (true) WITH CHECK (true);

-- Index for faster searching
CREATE INDEX IF NOT EXISTS idx_property_data_municipio ON property_data(municipio);
CREATE INDEX IF NOT EXISTS idx_property_data_indicacao ON property_data(indicacao_fiscal);
CREATE INDEX IF NOT EXISTS idx_property_data_inscricao ON property_data(inscricao_municipal);
