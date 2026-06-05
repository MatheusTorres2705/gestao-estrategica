export type Status = 'atingido' | 'em-risco' | 'nao-atingido';
export type StatusBsc = 'no-prazo' | 'atencao' | 'critico';
export type Polaridade = 'maior' | 'menor'; // maior = ↑ melhor; menor = ↓ melhor

export type TendenciaMes = {
  mes: string;
  valor: number;
  meta: number;
};

export type Metrica = {
  id: string;
  label: string;
  valor: number | string;
  meta: number | string;
  unidade?: string;
  status: Status;
  variacao?: number;
  polaridade?: Polaridade;
  responsavel?: string;
};

export type SubIndicador = {
  label: string;
  valor: number | string;
  unidade?: string;
  cor?: string;
};

export type Analise = {
  id: string;
  indicadorId: string;
  problema: string;
  responsavel: string;
  dataCriacao: string;
  mes: number;
  ano: number;
};

export type Causa = {
  id: string;
  analiseId: string;
  indicadorId: string;
  problema: string;
  categoria: '6M-maquina' | '6M-mao-de-obra' | '6M-metodo' | '6M-material' | '6M-meio-ambiente' | '6M-medicao';
  titulo: string;
  descricao: string;
  responsavel: string;
  dataCriacao: string;
  planosCount: number;
};

export type PlanoStatus = 'pendente' | 'em-andamento' | 'concluido' | 'atrasado';

export type PlanoAcao = {
  id: string;
  acao: string;
  responsavel: string;
  area: string;
  causa: string;
  causaId?: string;
  analiseId?: string;
  indicadorId: string;
  prazo: string;
  status: PlanoStatus;
  progresso: number;
  descricao?: string;
  dataCriacao: string;
};

export type Indicador = {
  id: string;
  nome: string;
  icone: string;
  status: Status;
  resumo: string;
  metricas: Metrica[];
  tendencia: TendenciaMes[];
  subIndicadores?: SubIndicador[];
  detalheExtra?: Record<string, unknown>;
};

export function calcPctAtingimento(
  valor: number,
  meta: number,
  polaridade: Polaridade = 'maior'
): number {
  if (meta === 0) return valor === 0 ? 100 : 0;
  if (polaridade === 'maior') return (valor / meta) * 100;
  return (meta / valor) * 100;
}

export function statusBscFromPct(pct: number): StatusBsc {
  if (pct >= 95) return 'no-prazo';
  if (pct >= 80) return 'atencao';
  return 'critico';
}
