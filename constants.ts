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
  { id: '1', name: 'Daniel', crea: '98.123/D', state: 'PR' },
  { id: '2', name: 'Débora', crea: '548.654/D', state: 'PR' },
  { id: '3', name: 'Lorena', crea: '985.125/D', state: 'PR' },
  { id: '4', name: 'Tainara', crea: '624.125/D', state: 'PR' },
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