import { obterReg, api } from '@/lib/api';
import type { Analise } from '@/types';

type RawAnalise = Record<string, unknown>;

function mapAnalise(r: RawAnalise): Analise {
  return {
    id: String(r['CODISH'] ?? ''),
    indicadorId: String(r['INDICADOR'] ?? ''),
    problema: String(r['PROBLEMA'] ?? ''),
    responsavel: '',
    dataCriacao: String(r['DTINCLUSAO'] ?? '').split('T')[0],
    mes: Number(r['MES'] ?? 0),
    ano: Number(r['ANO'] ?? 0),
  };
}

const BASE_SELECT = `
  SELECT CODISH, INDICADOR, PROBLEMA,
         TO_CHAR(DTINCLUSAO, 'YYYY-MM-DD') AS DTINCLUSAO,
         MES, ANO
  FROM AD_ISHANALISE
`.trim();

export async function getAnalises(
  indicadorId: string,
  mes?: number,
  ano?: number,
): Promise<Analise[]> {
  let sql = `${BASE_SELECT} WHERE INDICADOR = '${indicadorId}'`;
  if (mes !== undefined) sql += ` AND MES = ${mes}`;
  if (ano !== undefined) sql += ` AND ANO = ${ano}`;
  sql += ` ORDER BY DTINCLUSAO DESC`;
  const rows = await obterReg<RawAnalise>(sql);
  return rows.map(mapAnalise);
}

export async function getAnalise(id: string): Promise<Analise | undefined> {
  const sql = `${BASE_SELECT} WHERE CODISH = ${Number(id)}`;
  const rows = await obterReg<RawAnalise>(sql, { pageSize: 1, maxPages: 1 });
  return rows[0] ? mapAnalise(rows[0]) : undefined;
}

export async function updateAnalise(id: string, problema: string): Promise<void> {
  await api.post('/api/sankhya/dataset/save', {
    entity: 'AD_ISHANALISE',
    pk: { CODISH: Number(id) },
    fields: ['CODISH', 'PROBLEMA'],
    values: { 0: Number(id), 1: problema },
  });
}

export async function deleteAnalise(id: string): Promise<void> {
  const codish = Number(id);

  // 1. Busca planos vinculados (direto pelo CODISH)
  const planos = await obterReg<Record<string, unknown>>(
    `SELECT CODPLANO, CODCAUSA, CODISH FROM AD_ISHPLANO WHERE CODISH = ${codish}`,
  );
  if (planos.length > 0) {
    await api.post('/api/sankhya/dataset/remove', {
      entity: 'AD_ISHPLANO',
      pks: planos.map(p => ({ CODPLANO: Number(p['CODPLANO']), CODCAUSA: Number(p['CODCAUSA']), CODISH: codish })),
    });
  }

  // 2. Busca causas vinculadas
  const causas = await obterReg<Record<string, unknown>>(
    `SELECT CODCAUSA, CODISH FROM AD_ISHCAUSA WHERE CODISH = ${codish}`,
  );
  if (causas.length > 0) {
    await api.post('/api/sankhya/dataset/remove', {
      entity: 'AD_ISHCAUSA',
      pks: causas.map(c => ({ CODCAUSA: Number(c['CODCAUSA']), CODISH: codish })),
    });
  }

  // 3. Remove a análise
  await api.post('/api/sankhya/dataset/remove', {
    entity: 'AD_ISHANALISE',
    pks: [{ CODISH: codish }],
  });
}

export async function saveAnalise(data: Omit<Analise, 'id'>): Promise<Analise> {
  const seq = await obterReg<{ NEXTCOD: number }>(
    'SELECT NVL(MAX(CODISH), 0) + 1 AS NEXTCOD FROM AD_ISHANALISE',
    { pageSize: 1, maxPages: 1 },
  );
  const nextCod = Number(seq[0]?.NEXTCOD ?? 1);

  await api.post('/api/sankhya/dataset/save', {
    entity: 'AD_ISHANALISE',
    fields: ['CODISH', 'INDICADOR', 'PROBLEMA', 'MES', 'ANO'],
    values: {
      0: nextCod,
      1: data.indicadorId,
      2: data.problema,
      3: data.mes,
      4: data.ano,
    },
  });

  return { ...data, id: String(nextCod) };
}
