import { obterReg, api } from '@/lib/api';
import type { Causa } from '@/types';

type RawCausa = Record<string, unknown>;

function mapCausa(r: RawCausa): Causa {
  return {
    id: String(r['CODCAUSA'] ?? ''),
    analiseId: String(r['CODISH'] ?? ''),
    indicadorId: String(r['INDICADOR'] ?? ''),
    problema: '',
    categoria: String(r['CATEGORIA'] ?? '') as Causa['categoria'],
    titulo: String(r['CAUSA'] ?? ''),
    descricao: String(r['DESCRICAO'] ?? ''),
    responsavel: String(r['RESPONSAVEL'] ?? ''),
    dataCriacao: String(r['DTINCLUSAO'] ?? '').split('T')[0],
    planosCount: Number(r['PLANOS_COUNT'] ?? 0),
  };
}

// DESCRICAO é CLOB — usa DBMS_LOB.SUBSTR para permitir GROUP BY
const BASE_SELECT = `
  SELECT C.CODISH, C.CODCAUSA, C.INDICADOR,
         C.CAUSA, C.CATEGORIA, DBMS_LOB.SUBSTR(C.DESCRICAO, 4000, 1) AS DESCRICAO, C.RESPONSAVEL,
         TO_CHAR(C.DTINCLUSAO, 'YYYY-MM-DD') AS DTINCLUSAO,
         COUNT(P.CODPLANO) AS PLANOS_COUNT
  FROM AD_ISHCAUSA C
  LEFT JOIN AD_ISHPLANO P ON P.CODCAUSA = C.CODCAUSA AND P.CODISH = C.CODISH
`.trim();

const GROUP_BY = `
  GROUP BY C.CODISH, C.CODCAUSA, C.INDICADOR,
           C.CAUSA, C.CATEGORIA, DBMS_LOB.SUBSTR(C.DESCRICAO, 4000, 1), C.RESPONSAVEL,
           TO_CHAR(C.DTINCLUSAO, 'YYYY-MM-DD')
  ORDER BY TO_CHAR(C.DTINCLUSAO, 'YYYY-MM-DD') DESC
`.trim();

export async function getCausas(indicadorId: string): Promise<Causa[]> {
  const sql = `${BASE_SELECT} WHERE C.INDICADOR = '${indicadorId}' ${GROUP_BY}`;
  const rows = await obterReg<RawCausa>(sql);
  return rows.map(mapCausa);
}

export async function getCausasByAnalise(analiseId: string): Promise<Causa[]> {
  const sql = `${BASE_SELECT} WHERE C.CODISH = ${Number(analiseId)} ${GROUP_BY}`;
  const rows = await obterReg<RawCausa>(sql);
  return rows.map(mapCausa);
}

export async function getAllCausas(): Promise<Causa[]> {
  const sql = `${BASE_SELECT} ${GROUP_BY}`;
  const rows = await obterReg<RawCausa>(sql);
  return rows.map(mapCausa);
}

export async function saveCausa(
  causa: Omit<Causa, 'id' | 'dataCriacao' | 'planosCount'>,
): Promise<Causa> {
  const seq = await obterReg<{ NEXTCOD: number }>(
    'SELECT NVL(MAX(CODCAUSA), 0) + 1 AS NEXTCOD FROM AD_ISHCAUSA',
    { pageSize: 1, maxPages: 1 },
  );
  const nextCod = Number(seq[0]?.NEXTCOD ?? 1);

  await api.post('/api/sankhya/dataset/save', {
    entity: 'AD_ISHCAUSA',
    fields: ['CODCAUSA', 'CODISH', 'INDICADOR', 'CAUSA', 'CATEGORIA', 'DESCRICAO', 'RESPONSAVEL'],
    values: {
      0: nextCod,
      1: Number(causa.analiseId),
      2: causa.indicadorId,
      3: causa.titulo,
      4: causa.categoria,
      5: causa.descricao,
      6: causa.responsavel,
    },
  });

  return {
    ...causa,
    id: String(nextCod),
    dataCriacao: new Date().toISOString().split('T')[0],
    planosCount: 0,
  };
}

export async function updateCausa(
  id: string,
  analiseId: string,
  data: Pick<Causa, 'titulo' | 'categoria' | 'descricao' | 'responsavel'>,
): Promise<void> {
  await api.post('/api/sankhya/dataset/save', {
    entity: 'AD_ISHCAUSA',
    pk: { CODCAUSA: Number(id), CODISH: Number(analiseId) },
    fields: ['CODCAUSA', 'CODISH', 'CAUSA', 'CATEGORIA', 'DESCRICAO', 'RESPONSAVEL'],
    values: {
      0: Number(id),
      1: Number(analiseId),
      2: data.titulo,
      3: data.categoria,
      4: data.descricao,
      5: data.responsavel,
    },
  });
}

export async function deleteCausa(id: string, analiseId: string): Promise<void> {
  await api.post('/api/sankhya/dataset/remove', {
    entity: 'AD_ISHCAUSA',
    pks: [{ CODCAUSA: Number(id), CODISH: Number(analiseId) }],
  });
}

// count calculado via JOIN — mantido para não quebrar chamadas existentes
export async function incrementPlanosCount(_causaId: string): Promise<void> {
  // no-op
}
