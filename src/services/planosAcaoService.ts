import { obterReg, api } from '@/lib/api';
import type { PlanoAcao, PlanoStatus } from '@/types';

type RawPlano = Record<string, unknown>;

// Converte 'YYYY-MM-DD' → 'DD/MM/YY' para campos tipo D no Sankhya
function toSankhyaDate(iso: string): string | null {
  if (!iso) return null;
  const [yyyy, mm, dd] = iso.split('-');
  if (!yyyy || !mm || !dd) return null;
  return `${dd}/${mm}/${yyyy.slice(-2)}`;
}

function mapPlano(r: RawPlano): PlanoAcao {
  return {
    id: String(r['CODPLANO'] ?? ''),
    acao: String(r['ACAO'] ?? ''),
    responsavel: String(r['RESPONSAVEL'] ?? ''),
    area: String(r['AREA'] ?? ''),
    causa: String(r['CAUSA'] ?? ''),
    causaId: r['CODCAUSA'] != null ? String(r['CODCAUSA']) : undefined,
    analiseId: r['CODISH'] != null ? String(r['CODISH']) : undefined,
    indicadorId: String(r['INDICADOR'] ?? ''),
    prazo: String(r['DTPRAZO'] ?? '').split('T')[0],
    status: String(r['STATUS'] ?? 'pendente') as PlanoStatus,
    progresso: Number(r['PROGRESSO'] ?? 0),
    descricao: r['DESCRICAO'] ? String(r['DESCRICAO']) : undefined,
    dataCriacao: String(r['DTINCLUSAO'] ?? '').split('T')[0],
  };
}

// JOIN com AD_ISHANALISE para obter INDICADOR (não armazenado em AD_ISHPLANO)
const BASE_SELECT = `
  SELECT P.CODPLANO, P.CODCAUSA, P.CODISH, P.ACAO, P.RESPONSAVEL, P.AREA, P.CAUSA,
         TO_CHAR(P.DTPRAZO, 'YYYY-MM-DD') AS DTPRAZO,
         P.STATUS, P.PROGRESSO, DBMS_LOB.SUBSTR(P.DESCRICAO, 4000, 1) AS DESCRICAO,
         TO_CHAR(P.DTINCLUSAO, 'YYYY-MM-DD') AS DTINCLUSAO,
         A.INDICADOR
  FROM AD_ISHPLANO P
  LEFT JOIN AD_ISHANALISE A ON A.CODISH = P.CODISH
`.trim();

export type PlanosFiltros = {
  indicadorId?: string;
  status?: PlanoStatus;
  responsavel?: string;
  area?: string;
};

export async function getPlanosAcao(filtros?: PlanosFiltros): Promise<PlanoAcao[]> {
  const clauses: string[] = [];
  if (filtros?.indicadorId) clauses.push(`A.INDICADOR = '${filtros.indicadorId}'`);
  if (filtros?.status)      clauses.push(`P.STATUS = '${filtros.status}'`);
  if (filtros?.responsavel) clauses.push(`P.RESPONSAVEL = '${filtros.responsavel}'`);
  if (filtros?.area)        clauses.push(`P.AREA = '${filtros.area}'`);

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const sql = `${BASE_SELECT} ${where} ORDER BY P.DTINCLUSAO DESC`;
  const rows = await obterReg<RawPlano>(sql);
  return rows.map(mapPlano);
}

export async function getPlanoResumo() {
  const sql = `
    SELECT
      COUNT(*) AS TOTAL,
      SUM(CASE WHEN STATUS = 'concluido'    THEN 1 ELSE 0 END) AS CONCLUIDOS,
      SUM(CASE WHEN STATUS = 'em-andamento' THEN 1 ELSE 0 END) AS EM_ANDAMENTO,
      SUM(CASE WHEN STATUS = 'pendente'     THEN 1 ELSE 0 END) AS PENDENTES,
      SUM(CASE WHEN STATUS = 'atrasado'     THEN 1 ELSE 0 END) AS ATRASADOS
    FROM AD_ISHPLANO
  `.trim();
  const rows = await obterReg<RawPlano>(sql, { pageSize: 1, maxPages: 1 });
  const r = rows[0] ?? {};
  const total = Number(r['TOTAL'] ?? 0);
  const concluidos = Number(r['CONCLUIDOS'] ?? 0);
  return {
    total,
    concluidos,
    emAndamento: Number(r['EM_ANDAMENTO'] ?? 0),
    pendentes:   Number(r['PENDENTES'] ?? 0),
    atrasados:   Number(r['ATRASADOS'] ?? 0),
    pctConcluido: total > 0 ? Math.round((concluidos / total) * 100) : 0,
  };
}

export async function savePlanoAcao(
  plano: Omit<PlanoAcao, 'id' | 'dataCriacao'>,
): Promise<PlanoAcao> {
  const seq = await obterReg<{ NEXTCOD: number }>(
    'SELECT NVL(MAX(CODPLANO), 0) + 1 AS NEXTCOD FROM AD_ISHPLANO',
    { pageSize: 1, maxPages: 1 },
  );
  const nextCod = Number(seq[0]?.NEXTCOD ?? 1);

  await api.post('/api/sankhya/dataset/save', {
    entity: 'AD_ISHPLANO',
    fields: ['CODPLANO', 'CODCAUSA', 'CODISH', 'ACAO', 'RESPONSAVEL', 'AREA', 'CAUSA', 'DTPRAZO', 'STATUS', 'PROGRESSO', 'DESCRICAO'],
    values: {
      0: nextCod,
      1: plano.causaId != null ? Number(plano.causaId) : null,
      2: plano.analiseId != null ? Number(plano.analiseId) : null,
      3: plano.acao,
      4: plano.responsavel,
      5: plano.area,
      6: plano.causa,
      7: toSankhyaDate(plano.prazo),
      8: plano.status,
      9: plano.progresso,
      10: plano.descricao ?? null,
    },
  });

  return {
    ...plano,
    id: String(nextCod),
    dataCriacao: new Date().toISOString().split('T')[0],
  };
}

export async function updatePlanoStatus(
  id: string,
  status: PlanoStatus,
  progresso?: number,
): Promise<void> {
  const rows = await obterReg<RawPlano>(
    `SELECT CODPLANO, CODCAUSA, CODISH FROM AD_ISHPLANO WHERE CODPLANO = ${Number(id)}`,
    { pageSize: 1, maxPages: 1 },
  );
  if (!rows[0]) return;

  await api.post('/api/sankhya/dataset/save', {
    entity: 'AD_ISHPLANO',
    pk: {
      CODPLANO: Number(rows[0]['CODPLANO']),
      CODCAUSA: Number(rows[0]['CODCAUSA']),
      CODISH:   Number(rows[0]['CODISH']),
    },
    fields: ['CODPLANO', 'CODCAUSA', 'CODISH', 'STATUS', 'PROGRESSO'],
    values: {
      0: Number(rows[0]['CODPLANO']),
      1: Number(rows[0]['CODCAUSA']),
      2: Number(rows[0]['CODISH']),
      3: status,
      4: progresso ?? 0,
    },
  });
}
