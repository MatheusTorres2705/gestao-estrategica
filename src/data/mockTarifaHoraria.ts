// Tipo agnóstico de ano — usado tanto pelo mock quanto pelo serviço real
export type TarifaLinha = {
  linha: string;
  fyAnt: number;
  m01: number; m02: number; m03: number; m04: number;
  m05: number; m06: number; m07: number; m08: number;
  m09: number; m10: number; m11: number; m12: number;
  // breakdown mensal do ano anterior (usado no gráfico de evolução)
  m01Ant?: number; m02Ant?: number; m03Ant?: number; m04Ant?: number;
  m05Ant?: number; m06Ant?: number; m07Ant?: number; m08Ant?: number;
  m09Ant?: number; m10Ant?: number; m11Ant?: number; m12Ant?: number;
  ytdAnt: number;
  ytdAtu: number;
  pct: number | null;
  isBold?: boolean;
  trend?: 'up' | 'down' | null;
};

const Z = 0; // meses sem dado no mock ficam zerados

export const horasPorLinha: TarifaLinha[] = [
  { linha: '260-290',    fyAnt: 173027.13, m01: 16315.28, m02: 12772.93, m03: 17668.78, m04: 10368.22, m05: Z, m06: Z, m07: Z, m08: Z, m09: Z, m10: Z, m11: Z, m12: Z, ytdAnt:  58952.20, ytdAtu:  57125.21, pct:  -3 },
  { linha: '310',        fyAnt:   6560.78, m01:  9800.27, m02: 10789.20, m03: 12407.10, m04:  9191.03, m05: Z, m06: Z, m07: Z, m08: Z, m09: Z, m10: Z, m11: Z, m12: Z, ytdAnt:      0.00, ytdAtu:  42187.60, pct: null },
  { linha: '340-350',    fyAnt: 111915.55, m01: 16289.63, m02: 14332.53, m03: 16449.28, m04: 11765.05, m05: Z, m06: Z, m07: Z, m08: Z, m09: Z, m10: Z, m11: Z, m12: Z, ytdAnt:  37469.20, ytdAtu:  58836.50, pct:  57 },
  { linha: '360-370',    fyAnt:  93091.20, m01:  6131.45, m02:  6165.20, m03:  6044.82, m04:  4995.40, m05: Z, m06: Z, m07: Z, m08: Z, m09: Z, m10: Z, m11: Z, m12: Z, ytdAnt:  27273.27, ytdAtu:  23336.87, pct: -14 },
  { linha: '41',         fyAnt: 140099.70, m01: 13883.77, m02: 11563.55, m03: 11718.68, m04:  9031.72, m05: Z, m06: Z, m07: Z, m08: Z, m09: Z, m10: Z, m11: Z, m12: Z, ytdAnt:  42663.19, ytdAtu:  46197.72, pct:   8 },
  { linha: '44',         fyAnt: 119638.28, m01: 11043.32, m02:  8019.50, m03:  8789.80, m04:  6470.95, m05: Z, m06: Z, m07: Z, m08: Z, m09: Z, m10: Z, m11: Z, m12: Z, ytdAnt:  35178.13, ytdAtu:  34323.57, pct:  -2 },
  { linha: '50',         fyAnt: 181742.75, m01:  8100.47, m02:  6603.72, m03:  5843.24, m04:  4874.96, m05: Z, m06: Z, m07: Z, m08: Z, m09: Z, m10: Z, m11: Z, m12: Z, ytdAnt:  56245.73, ytdAtu:  25422.38, pct: -55 },
  { linha: 'Grand Total',fyAnt: 826075.40, m01: 81564.18, m02: 70246.64, m03: 78921.71, m04: 56697.32, m05: Z, m06: Z, m07: Z, m08: Z, m09: Z, m10: Z, m11: Z, m12: Z, ytdAnt: 257781.72, ytdAtu: 287429.84, pct:  12, isBold: true },
];

export const custosPorCategoria: TarifaLinha[] = [
  { linha: 'Payroll',     fyAnt:  41251216.81, m01:  4241464.17, m02:  4710066.21, m03:  4699034.70, m04:  5223712.48, m05: Z, m06: Z, m07: Z, m08: Z, m09: Z, m10: Z, m11: Z, m12: Z, ytdAnt: 12385360.02, ytdAtu: 18874277.56, pct: 52, trend: 'up' },
  { linha: 'Overhead',    fyAnt:  42080346.98, m01:  3171364.97, m02:  3946440.17, m03:  3310806.22, m04:  3913090.19, m05: Z, m06: Z, m07: Z, m08: Z, m09: Z, m10: Z, m11: Z, m12: Z, ytdAnt: 13025045.67, ytdAtu: 14341701.55, pct: 10, trend: 'up' },
  { linha: 'Kanban (BOM)',fyAnt:  12858448.44, m01:   934852.55, m02:   781550.05, m03:  1209161.32, m04:   919929.43, m05: Z, m06: Z, m07: Z, m08: Z, m09: Z, m10: Z, m11: Z, m12: Z, ytdAnt:  3780681.15, ytdAtu:  3845493.34, pct:  2, trend: null },
  { linha: 'Resin',       fyAnt:  11538747.74, m01:  1103048.87, m02:   858981.48, m03:  1014871.69, m04:   937649.33, m05: Z, m06: Z, m07: Z, m08: Z, m09: Z, m10: Z, m11: Z, m12: Z, ytdAnt:  3616992.58, ytdAtu:  3914551.37, pct:  8, trend: null },
  { linha: 'SG&A',        fyAnt:  19460995.16, m01:  1296845.56, m02:  1117373.93, m03:  1820723.40, m04:  2852467.85, m05: Z, m06: Z, m07: Z, m08: Z, m09: Z, m10: Z, m11: Z, m12: Z, ytdAnt:  4085522.43, ytdAtu:  7087410.74, pct: 73, trend: 'up' },
  { linha: 'Total',       fyAnt: 127189755.13, m01: 10747576.12, m02: 11414411.84, m03: 12054597.33, m04: 13846849.28, m05: Z, m06: Z, m07: Z, m08: Z, m09: Z, m10: Z, m11: Z, m12: Z, ytdAnt: 36893601.85, ytdAtu: 48063434.57, pct: 30, isBold: true },
];

export const tarifaHoraria: TarifaLinha[] = [
  { linha: 'Payroll',  fyAnt:  49.94, m01:  52.00, m02:  67.05, m03:  59.54, m04:  92.13, m05: Z, m06: Z, m07: Z, m08: Z, m09: Z, m10: Z, m11: Z, m12: Z, ytdAnt:  48.05, ytdAtu:  65.67, pct: 37 },
  { linha: 'Overhead', fyAnt:  50.94, m01:  38.88, m02:  56.18, m03:  41.95, m04:  69.02, m05: Z, m06: Z, m07: Z, m08: Z, m09: Z, m10: Z, m11: Z, m12: Z, ytdAnt:  50.53, ytdAtu:  49.90, pct: -1 },
  { linha: 'SG&A',     fyAnt:  23.56, m01:  15.90, m02:  15.91, m03:  23.07, m04:  50.31, m05: Z, m06: Z, m07: Z, m08: Z, m09: Z, m10: Z, m11: Z, m12: Z, ytdAnt:  15.85, ytdAtu:  24.66, pct: 56 },
  { linha: 'Total',    fyAnt: 153.97, m01: 131.77, m02: 162.49, m03: 152.74, m04: 244.22, m05: Z, m06: Z, m07: Z, m08: Z, m09: Z, m10: Z, m11: Z, m12: Z, ytdAnt: 143.12, ytdAtu: 167.22, pct: 17, isBold: true },
];

export const tendenciaBarras = [
  { label: '2025 FY', valor: 153.97 },
  { label: "Jan'26",  valor: 131.77 },
  { label: "Fev'26",  valor: 162.49 },
  { label: "Mar'26",  valor: 152.74 },
  { label: "Abr'26",  valor: 244.22 },
];

export const comentarios = [
  'Queda de 28% nas Horas de Avanço em Abril devido a desconsideração de atividades relacionadas a itens opcionais.',
  '(Ajuste dos períodos anteriores em andamento).',
];
