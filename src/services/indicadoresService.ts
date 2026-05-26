import type { Indicador } from '@/types';
import { mockIndicadores } from '@/data/mockIndicadores';

// Stub pronto para integração com Sankhya via obterReg
// Quando a integração estiver pronta, substituir o retorno mock pela query real

export async function getIndicadores(_mes: number, _ano: number): Promise<Indicador[]> {
  // TODO: integrar com Sankhya
  // const sql = `SELECT ... FROM ... WHERE MES = ${_mes} AND ANO = ${_ano}`;
  // const rows = await obterReg(sql);
  // return rows.map(mapRowToIndicador);
  return mockIndicadores;
}

export async function getIndicadorDetalhe(id: string, _mes: number, _ano: number): Promise<Indicador | undefined> {
  const indicadores = await getIndicadores(_mes, _ano);
  return indicadores.find((i) => i.id === id);
}
