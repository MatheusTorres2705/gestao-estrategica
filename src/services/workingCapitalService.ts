import { obterReg } from '@/lib/api';

export type Classificacao = 'NORMAL' | 'UNDER' | 'OVER' | 'SLOW MOVING' | 'OBSOLETO';

export type WorkingCapitalRow = {
  codGrupoProd: number;
  descrGrupoProd: string;
  codProd: number;
  descrProd: string;
  estTot: number;
  custoTot: number;
  giro: number | null;
  consumoMensal: number | null;
  diasSemGiro: number | null;
  importado: string;
  coberturaDias: number | null;
  classificacao: Classificacao;
};

const SQL_WC = `
WITH BASE AS (
  SELECT
      PRO.CODGRUPOPROD,
      GRU.DESCRGRUPOPROD,
      PRO.CODPROD,
      PRO.DESCRPROD,
      SUM(EST.ESTOQUE) - SUM(EST.RESERVADO) AS ESTTOT,
      SUM( SNK_GET_CUSTO('MEDIOSEMICMS',1,PRO.CODPROD,EST.CODLOCAL,' ',SYSDATE)
           * EST.ESTOQUE - EST.RESERVADO ) AS CUSTOTOT,
      GIR.GIRO,
      GIR.GIRO * 30 AS CONSUMO_MENSAL,
      SG.DIAS_SEMGIRO,
      PRO.AD_IMPORTADO AS IMPORTADO
  FROM TGFEST EST
      INNER JOIN TGFPRO PRO ON PRO.CODPROD = EST.CODPROD
      INNER JOIN TGFGRU GRU ON GRU.CODGRUPOPROD = PRO.CODGRUPOPROD
      INNER JOIN TGFGRU PAI ON PAI.CODGRUPOPROD = GRU.CODGRUPAI
      LEFT JOIN CND_TF_GIRO_DIARIO GIR ON GIR.CODPROD = PRO.CODPROD
      LEFT JOIN CND_TF_DIASSEMGIR  SG  ON SG.CODPROD  = GIR.CODPROD
  WHERE EST.CODLOCAL IN (1010101 , 1010102 , 01010104)
    AND EST.TIPO = 'P'
    AND (EST.ESTOQUE - EST.RESERVADO) > 0
  GROUP BY PRO.CODGRUPOPROD, GRU.DESCRGRUPOPROD, GIR.GIRO,
           PRO.CODPROD, PRO.DESCRPROD, SG.DIAS_SEMGIRO, PRO.AD_IMPORTADO
)
SELECT
    B.*,
    CASE WHEN NVL(GIRO,0) = 0 THEN NULL
         ELSE ROUND(ESTTOT / GIRO, 1) END AS COBERTURA_DIAS,
    CASE
        WHEN NVL(GIRO,0) = 0
          OR NVL(DIAS_SEMGIRO,0) >= 180  THEN 'OBSOLETO'
        WHEN NVL(DIAS_SEMGIRO,0) >= 120  THEN 'SLOW MOVING'
        WHEN ESTTOT / GIRO > 90          THEN 'OVER'
        WHEN ESTTOT / GIRO < 60          THEN 'UNDER'
        ELSE 'NORMAL'
    END AS CLASSIFICACAO
FROM BASE B
`.trim();

function mapRow(r: unknown): WorkingCapitalRow {
  if (Array.isArray(r)) {
    const nullableNum = (v: unknown) => (v != null ? Number(v) : null);
    return {
      codGrupoProd:   Number(r[0]  ?? 0),
      descrGrupoProd: String(r[1]  ?? ''),
      codProd:        Number(r[2]  ?? 0),
      descrProd:      String(r[3]  ?? ''),
      estTot:         Number(r[4]  ?? 0),
      custoTot:       Number(r[5]  ?? 0),
      giro:           nullableNum(r[6]),
      consumoMensal:  nullableNum(r[7]),
      diasSemGiro:    nullableNum(r[8]),
      importado:      String(r[9]  ?? ''),
      coberturaDias:  nullableNum(r[10]),
      classificacao:  String(r[11] ?? 'NORMAL') as Classificacao,
    };
  }
  const o = r as Record<string, unknown>;
  const pick = (...keys: string[]) => { for (const k of keys) if (o[k] != null) return o[k]; return null; };
  const num  = (...keys: string[]) => { const v = pick(...keys); return v != null ? Number(v) : null; };
  return {
    codGrupoProd:   Number(pick('CODGRUPOPROD',   'codgrupoprod')   ?? 0),
    descrGrupoProd: String(pick('DESCRGRUPOPROD', 'descrgrupoprod') ?? ''),
    codProd:        Number(pick('CODPROD',         'codprod')        ?? 0),
    descrProd:      String(pick('DESCRPROD',       'descrprod')      ?? ''),
    estTot:         Number(pick('ESTTOT',          'esttot')         ?? 0),
    custoTot:       Number(pick('CUSTOTOT',        'custotot')       ?? 0),
    giro:           num('GIRO',          'giro'),
    consumoMensal:  num('CONSUMO_MENSAL','consumo_mensal'),
    diasSemGiro:    num('DIAS_SEMGIRO',  'dias_semgiro'),
    importado:      String(pick('IMPORTADO',       'importado')      ?? ''),
    coberturaDias:  num('COBERTURA_DIAS','cobertura_dias'),
    classificacao:  String(pick('CLASSIFICACAO',   'classificacao')  ?? 'NORMAL') as Classificacao,
  };
}

export async function getWorkingCapitalEstoque(): Promise<WorkingCapitalRow[]> {
  const rows = await obterReg(SQL_WC);
  return rows.map(mapRow);
}
