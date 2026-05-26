import type { PlanoAcao, PlanoStatus } from '@/types';
import { mockPlanosAcao } from '@/data/mockPlanosAcao';

let planosState = [...mockPlanosAcao];

export type PlanosFiltros = {
  indicadorId?: string;
  status?: PlanoStatus;
  responsavel?: string;
  area?: string;
};

export async function getPlanosAcao(filtros?: PlanosFiltros): Promise<PlanoAcao[]> {
  let planos = planosState;
  if (filtros?.indicadorId) planos = planos.filter((p) => p.indicadorId === filtros.indicadorId);
  if (filtros?.status) planos = planos.filter((p) => p.status === filtros.status);
  if (filtros?.responsavel) planos = planos.filter((p) => p.responsavel === filtros.responsavel);
  if (filtros?.area) planos = planos.filter((p) => p.area === filtros.area);
  return planos;
}

export async function getPlanoResumo() {
  const total = planosState.length;
  const concluidos = planosState.filter((p) => p.status === 'concluido').length;
  const emAndamento = planosState.filter((p) => p.status === 'em-andamento').length;
  const pendentes = planosState.filter((p) => p.status === 'pendente').length;
  const atrasados = planosState.filter((p) => p.status === 'atrasado').length;
  const pctConcluido = total > 0 ? Math.round((concluidos / total) * 100) : 0;
  return { total, concluidos, emAndamento, pendentes, atrasados, pctConcluido };
}

export async function savePlanoAcao(plano: Omit<PlanoAcao, 'id' | 'dataCriacao'>): Promise<PlanoAcao> {
  // TODO: integrar com dataSave() para persistir no Sankhya
  const novo: PlanoAcao = {
    ...plano,
    id: `p${Date.now()}`,
    dataCriacao: new Date().toISOString().split('T')[0],
  };
  planosState = [...planosState, novo];
  return novo;
}

export async function updatePlanoStatus(id: string, status: PlanoStatus, progresso?: number): Promise<void> {
  planosState = planosState.map((p) =>
    p.id === id ? { ...p, status, progresso: progresso ?? p.progresso } : p
  );
}
