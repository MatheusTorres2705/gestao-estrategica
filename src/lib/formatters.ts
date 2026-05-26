const MESES = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

const MESES_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function fmtPct(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function fmtNum(value: number, decimals = 0): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function fmtCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function fmtMesAbrev(mes: number): string {
  return MESES[(mes - 1) % 12];
}

export function fmtMesFull(mes: number): string {
  return MESES_FULL[(mes - 1) % 12];
}

export function fmtPeriodo(mes: number, ano: number): string {
  return `${MESES_FULL[(mes - 1) % 12]} / ${ano}`;
}

export function fmtVariacao(atual: number, anterior: number): string {
  if (anterior === 0) return '—';
  const pct = ((atual - anterior) / anterior) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}
