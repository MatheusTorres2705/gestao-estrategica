import type { Analise } from '@/types';
import { mockAnalises } from '@/data/mockAnalises';

let analisesState = [...mockAnalises];

export async function getAnalises(
  indicadorId: string,
  mes?: number,
  ano?: number,
): Promise<Analise[]> {
  let result = analisesState.filter((a) => a.indicadorId === indicadorId);
  if (mes !== undefined) result = result.filter((a) => a.mes === mes);
  if (ano !== undefined) result = result.filter((a) => a.ano === ano);
  return result.sort((a, b) => b.dataCriacao.localeCompare(a.dataCriacao));
}

export async function getAnalise(id: string): Promise<Analise | undefined> {
  return analisesState.find((a) => a.id === id);
}

export async function saveAnalise(
  data: Omit<Analise, 'id'>,
): Promise<Analise> {
  const nova: Analise = { ...data, id: `a${Date.now()}` };
  analisesState = [...analisesState, nova];
  return nova;
}
