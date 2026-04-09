export const OSINT_BRAZUCA_REGEX = {
  // Documentos
  CPF: /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/,
  CNPJ: /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/,
  CNPJ_ALFANUMERICO: /^[A-Z0-9]{14}$/, // Válido a partir de Julho de 2026
  TITULO_ELEITOR: /^\d{12}$/,
  PIS_PASEP: /^\d{3}\.?\d{5}\.?\d{2}-?\d{1}$/,
  CARTAO_SUS: /^\d{15}$/,
  CNES: /^\d{7}$/,
  CTPS: /^\d{7}\/?\d{4}$/,
  RG: /^\d{1,2}\.?\d{3}\.?\d{3}-?[0-9X]$/,
  CNH: /^\d{11}$/,
  PASSAPORTE: /^[A-Z]{2}\d{6}$/,
  CRM: /^\d{1,6}\/?[A-Z]{2}$/,

  // Localização
  CEP: /^\d{5}-?\d{3}$/,
  CODIGO_IBGE: /^\d{7}$/,

  // Veículos
  RENAVAM: /^\d{11}$/,
  PLACA_MERCOSUL: /^[A-Z]{3}\d[A-Z]\d{2}$/i,
  PLACA_ANTIGA: /^[A-Z]{3}-?\d{4}$/i,
  CHASSI: /^[A-HJ-NPR-Z0-9]{17}$/i,

  // Financeiro
  BOLETO_BANCARIO: /^\d{47,48}$/,
  CHAVE_NFE: /^\d{44}$/,
  CHAVE_PIX_ALEATORIA: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,

  // Outros
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  TELEFONE: /^(\(?\d{2}\)?\s?)?9?\d{4}-?\d{4}$/,
  PROCESSO_CNJ: /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/,
  IP_V4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  MAC_ADDRESS: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/,
};

export type RegexType = keyof typeof OSINT_BRAZUCA_REGEX;

export function identifyPattern(input: string): RegexType | null {
  const cleanInput = input.trim();
  for (const [key, regex] of Object.entries(OSINT_BRAZUCA_REGEX)) {
    if (regex.test(cleanInput)) {
      return key as RegexType;
    }
  }
  return null;
}

export function formatPatternName(type: RegexType): string {
  return type.replace(/_/g, ' ').toUpperCase();
}
