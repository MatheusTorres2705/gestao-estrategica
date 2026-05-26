import type { Causa } from '@/types';
import { mockCausas } from '@/data/mockCausas';

let causasState = [...mockCausas];

export async function getCausas(indicadorId: string): Promise<Causa[]> {
  return causasState.filter((c) => c.indicadorId === indicadorId);
}

export async function getCausasByAnalise(analiseId: string): Promise<Causa[]> {
  return causasState.filter((c) => c.analiseId === analiseId);
}

export async function getAllCausas(): Promise<Causa[]> {
  return causasState;
}

export async function saveCausa(causa: Omit<Causa, 'id' | 'dataCriacao' | 'planosCount'>): Promise<Causa> {
  // TODO: integrar com dataSave() para persistir no Sankhya
  const nova: Causa = {
    ...causa,
    id: `c${Date.now()}`,
    dataCriacao: new Date().toISOString().split('T')[0],
    planosCount: 0,
  };
  causasState = [...causasState, nova];
  return nova;
}

export async function incrementPlanosCount(causaId: string): Promise<void> {
  causasState = causasState.map((c) =>
    c.id === causaId ? { ...c, planosCount: c.planosCount + 1 } : c
  );
}

export async function deleteCausa(id: string): Promise<void> {
  causasState = causasState.filter((c) => c.id !== id);
}
