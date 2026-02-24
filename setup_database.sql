-- 1. Create tables if they don't exist
CREATE TABLE IF NOT EXISTS engineers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    crea TEXT NOT NULL,
    state TEXT,
    institution TEXT,
    isCustom BOOLEAN DEFAULT false,
    password TEXT,
    active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS protocols (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data TEXT,
    municipio TEXT,
    numeroProtocolo TEXT,
    requerente TEXT,
    cpf TEXT,
    telefone TEXT,
    zona TEXT,
    indicacaoFiscal TEXT,
    indicacaoFiscalParts JSONB,
    inscricaoImobiliaria TEXT,
    matricula TEXT,
    nirfCib TEXT,
    incra TEXT,
    proprietario TEXT,
    endereco TEXT,
    bairro TEXT,
    cep TEXT,
    lat NUMERIC,
    lng NUMERIC,
    zoom NUMERIC,
    descricaoNivelDestruicao TEXT,
    percentualDestruicao TEXT,
    engineerId UUID REFERENCES engineers(id)
);

CREATE TABLE IF NOT EXISTS laudo_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol_id UUID REFERENCES protocols(id),
    engineer_id UUID REFERENCES engineers(id),
    engineer_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE engineers ENABLE ROW LEVEL SECURITY;
ALTER TABLE protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE laudo_history ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public Access Engineers" ON engineers;
DROP POLICY IF EXISTS "Public Access Protocols" ON protocols;
DROP POLICY IF EXISTS "Public Access History" ON laudo_history;

-- 4. Create permissive policies (Allow ALL operations for public/anon users)
CREATE POLICY "Public Access Engineers" ON engineers
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Public Access Protocols" ON protocols
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Public Access History" ON laudo_history
FOR ALL
USING (true)
WITH CHECK (true);

-- 5. Insert initial engineers if table is empty
INSERT INTO engineers (id, name, crea, state, institution, active)
VALUES
  ('5', 'Alessandra Santana Calegari', '154.602/D', 'PR', 'CEDEC', true),
  ('6', 'Carlos Germano Justi', '160.730/D', 'PR', 'CEDEC', true),
  ('7', 'Cristian Schwarz', '197.170/D', 'PR', 'CEDEC', true),
  ('1', 'Daniel Tourinho Sentone', '98.123/D', 'PR', 'CEDEC', true),
  ('2', 'Debora Cristina Ruginski Marochi', '187.829/D', 'PR', 'CEDEC', true),
  ('3', 'Lorena Victória Januário Wosch', '145.046/D', 'PR', 'CEDEC', true),
  ('8', 'Regina De Toni', '71.017/D', 'PR', 'CEDEC', true),
  ('9', 'Sandoval Schmitt', '154.223/D', 'PR', 'CEDEC', true),
  ('4', 'Tainara Aline da Silva Finatto', '168.608/D', 'PR', 'CEDEC', true),
  ('10', 'Tatiane Aparecida Mendes da Silva', '230.509/D', 'PR', 'CEDEC', true)
ON CONFLICT (id) DO UPDATE SET active = true;
