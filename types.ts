export interface Engineer {
  id: string;
  name: string;
  crea: string;
  state?: string; // For new engineers
  institution?: string; // 'CEDEC' or 'Voluntário'
  isCustom?: boolean;
  active?: boolean;
}

export enum DamageType {
  COBERTURA = 'Cobertura',
  CAPTACAO = 'Captação',
  INSTALACAO_ELETRICA = 'Instalação Elétrica',
  INSTALACAO_HIDRAULICA = 'Instalação Hidráulica',
  PAREDE = 'Parede',
  MURO = 'Muro',
  REVESTIMENTO = 'Revestimento',
  POSTE = 'Poste',
  ARVORES = 'Árvores',
  FORRO = 'Forro',
  FUNDACAO = 'Fundação',
  PILAR = 'Pilar',
  VIGA = 'Viga',
  LAJE = 'Laje',
  ESQUADRIAS = 'Esquadrias',
  OUTROS = 'Outros',
}

export enum BuildingTypology {
  CONCRETO_ALVENARIA = 'Concreto Armado / Alvenaria',
  MADEIRA = 'Madeira',
  MISTA = 'Mista',
  ALVENARIA_ESTRUTURAL = 'Alvenaria Estrutural',
  PAREDES_CONCRETO = 'Paredes de Concreto',
  OUTRO = 'Outros',
}

export enum DamageClassification {
  SEM_DANOS = 'Sem Danos',
  PARCIAIS = 'Danos Parciais',
  SEVEROS = 'Danos Severos',
  RUINA = 'Ruína',
}

export enum ZoneType {
  URBANO = 'Urbano',
  RURAL = 'Rural',
}

export interface DamageEntry {
  type: DamageType;
  description: string;
  photos: string[]; // Base64 strings
}

export interface IndicacaoFiscalParts {
  setor: string;
  quadra: string;
  lote: string;
  sublote: string;
  unidade: string;
  digito: string;
}

// Interface para o Cadastro Inicial (Protocolo)
export interface Protocolo {
  id: string;
  data: string;
  municipio: string;
  numeroProtocolo: string; // SID
  requerente: string;
  cpf: string;
  telefone: string;
  
  // Dados do Imóvel
  zona: ZoneType;
  indicacaoFiscal: string;
  indicacaoFiscalParts?: IndicacaoFiscalParts;
  inscricaoImobiliaria: string;
  matricula: string;
  nirfCib: string;
  incra: string;
  proprietario: string;
  endereco: string;
  bairro: string;
  cep: string;
  lat: number;
  lng: number;
  zoom?: number; // Added: Armazena o nível de zoom do mapa

  // Avaliação Preliminar
  descricaoNivelDestruicao: string;
  percentualDestruicao: '0%' | '40%' | '70%' | '100%';
  
  engineerId: string; // Quem cadastrou
  distributedToId?: string; // NOVO: Para quem foi distribuído
}

export interface LaudoHistory {
  id: string;
  protocol_id: string;
  engineer_id: string;
  engineer_name: string;
  created_at: string;
  pdf_url?: string;
}

export interface LaudoForm {
  id_laudo?: string;
  municipio: string;
  data: string;
  protocolo: string; // SID
  engineerId: string;
  customEngineer?: Engineer; // If editing or creating new
  
  // Header Customization
  logoEsquerda?: string; // Base64 string for Left Logo (Coat of Arms)
  logoDireita?: string;  // Base64 string for Right Logo (Defesa Civil)

  // Property Data
  zona: ZoneType;
  // Urban specific
  indicacaoFiscal: string;
  indicacaoFiscalParts?: IndicacaoFiscalParts; // Parsed parts for system use
  inscricaoImobiliaria: string; // Label renamed to Inscrição Municipal in UI
  matricula: string;
  // Rural specific
  nirfCib: string;
  incra: string;

  proprietario: string;
  requerente: string;
  cpfRequerente: string; 
  telefoneRequerente?: string; 

  endereco: string;
  bairro: string;
  cep: string;
  lat: number;
  lng: number;
  tipologia: BuildingTypology;
  tipologiaOutro: string;
  finalidade: string[]; // ['Residencial', 'Comercial']
  danos: DamageEntry[];
  classificacao: DamageClassification;
  
  // New Field
  parecerFinal: string;
  
  // Reference Field (Not for PDF)
  descricaoNivelDestruicao?: string; 
}

export interface City {
  name: string;
  lat: number;
  lng: number;
}

export interface PropertyData {
  id?: string;
  municipio: string;
  inscricao_municipal: string;
  indicacao_fiscal: string;
  logradouro: string;
  proprietario: string;
}
