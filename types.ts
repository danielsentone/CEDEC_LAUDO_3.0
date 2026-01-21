export interface Engineer {
  id: string;
  name: string;
  crea: string;
  state?: string; // For new engineers
  isCustom?: boolean;
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
  OUTROS = 'Outros',
}

export enum BuildingTypology {
  ALVENARIA = 'Casa de Alvenaria',
  MADEIRA = 'Casa de Madeira',
  MISTA = 'Casa Mista',
  LOJA = 'Loja Comercial',
  PREDIO = 'Prédio Comercial',
  PAVILHAO_COM = 'Pavilhão Comercial',
  PAVILHAO_IND = 'Pavilhão Industrial',
  PUBLICO = 'Equipamento Público',
  OUTRO = 'Outro',
}

export enum DamageClassification {
  MINIMOS = 'Danos Mínimos',
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

export interface LaudoForm {
  id_laudo?: string;
  municipio: string;
  data: string;
  engineerId: string;
  customEngineer?: Engineer; // If editing or creating new
  
  // Header Customization
  logoEsquerda?: string; // Base64 string for Left Logo (Coat of Arms)
  logoDireita?: string;  // Base64 string for Right Logo (Defesa Civil)

  // Property Data
  zona: ZoneType;
  // Urban specific
  indicacaoFiscal: string;
  inscricaoImobiliaria: string;
  matricula: string;
  // Rural specific
  nirfCib: string;
  incra: string;

  proprietario: string;
  requerente: string;
  cpfRequerente: string; // New field
  
  endereco: string;
  bairro: string;
  cep: string;
  lat: number;
  lng: number;
  tipologia: BuildingTypology;
  tipologiaOutro: string;
  danos: DamageEntry[];
  classificacao: DamageClassification;
}

export interface City {
  name: string;
  lat: number;
  lng: number;
}