import { City, DamageClassification, Engineer } from "./types";

// A subset of PR municipalities for the demo. In production, this would be the full 399 list.
export const PARANA_CITIES: City[] = [
  { name: 'Curitiba', lat: -25.4284, lng: -49.2733 },
  { name: 'Londrina', lat: -23.3045, lng: -51.1696 },
  { name: 'Maringá', lat: -23.4210, lng: -51.9331 },
  { name: 'Ponta Grossa', lat: -25.0945, lng: -50.1633 },
  { name: 'Cascavel', lat: -24.9578, lng: -53.4595 },
  { name: 'São José dos Pinhais', lat: -25.5327, lng: -49.2054 },
  { name: 'Foz do Iguaçu', lat: -25.5163, lng: -54.5854 },
  { name: 'Colombo', lat: -25.2917, lng: -49.2242 },
  { name: 'Guarapuava', lat: -25.3935, lng: -51.4562 },
  { name: 'Paranaguá', lat: -25.5205, lng: -48.5095 },
  { name: 'Rio Bonito do Iguaçu', lat: -25.4897, lng: -52.5283 }, // From PDF example
];

export const INITIAL_ENGINEERS: Engineer[] = [
  { id: '1', name: 'Daniel Tourinho Sentone', crea: '98.123/D', state: 'PR', institution: 'CEDEC' },
  { id: '2', name: 'Débora Cristina Ruginski Marochi', crea: '187.829/D', state: 'PR', institution: 'CEDEC' },
  { id: '3', name: 'Lorena Victória Januário Wosch', crea: '145.046/D', state: 'PR', institution: 'CEDEC' },
  { id: '4', name: 'Tainara Aline da Silva Finatto', crea: '168.608/D', state: 'PR', institution: 'CEDEC' },
];

export const BRAZIL_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export const DAMAGE_LOGIC = {
  [DamageClassification.MINIMOS]: {
    level: 'Sem Destruição',
    percent: '10%'
  },
  [DamageClassification.PARCIAIS]: {
    level: 'Destruição Parcial Leve',
    percent: '40%'
  },
  [DamageClassification.SEVEROS]: {
    level: 'Destruição Parcial Grave',
    percent: '70%'
  },
  [DamageClassification.RUINA]: {
    level: 'Destruição Total',
    percent: '100%'
  }
};

export const PARECER_TEXTS = {
  [DamageClassification.MINIMOS]: "Verifica-se que o imóvel avaliado não apresenta destruição significativa, caracterizada por mínimos, que não demandam reparos emergenciais. Portanto, não classificado segundo Art. 4º, da Lei Estadual nº 22.787/2025.",
  [DamageClassification.PARCIAIS]: "Verifica-se destruição parcial leve (40%), caracterizada por danos que não comprometem a estrutura, mas demandam reparos em acabamentos, telhado, esquadrias ou instalações. A classificação corresponde ao Art. 4º, inciso III, da Lei Estadual nº 22.787/2025, que define o percentual de 40% para este tipo de dano.",
  [DamageClassification.SEVEROS]: "Verifica-se destruição parcial grave (70%), caracterizada por danos que comprometam a estrutura ou a habitabilidade, exigindo grandes reparos para seu reestabelecimento. A classificação corresponde ao Art. 4º, inciso II, da Lei Estadual nº 22.787/2025, que define o percentual de 70% para este tipo de dano.",
  [DamageClassification.RUINA]: "Verifica-se destruição total (100%), caracterizada como integralmente destruída ou com perda estrutural irreversível. A classificação corresponde ao Art. 4º, inciso I, da Lei Estadual nº 22.787/2025, que define o percentual de 100% para este tipo de dano."
};