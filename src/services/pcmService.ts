import { obterReg } from '@/lib/api';

export type PcmCategoria = 'sem-previsao' | 'atrasado' | 'em-dia';

export type PcmItem = {
  descrprod: string;
  prodKit: string | null;
  chassi: string;
  dtInicioprev: string | null;
  dtEntregav: string | null;
  datafimprev: string | null;
  status: string | null;
  nomeparc: string | null;
  microsetor: string | null;
  macrosetor: string | null;
  categoria: PcmCategoria;
};

export type PcmCounts = {
  total: number;
  semPrevisao: number;
  atrasado: number;
  emDia: number;
};

const CODPROD_EXCLUIDOS = `
 21757, 1818, 19463, 2672, 5790, 2760, 4849, 18785, 16814,20966 , 1465 , 
        5642, 13357, 18784, 18731, 18210, 21118, 2555, 22308,
        10966, 21740, 1954, 328, 1414, 2680, 3038, 17775,24491,20123, 20081,
        9884, 18174, 19333, 1593, 1831, 14102, 19712 , 5775 , 21624 , 14044 , 14037 , 18211 , 4772 , 20346 , 4967
 , 9587 , 9588 , 9589 , 10190 , 10191 , 14045 ,  18209 , 21569 , 21674 , 4969 , 21756 , 13356 , 13358 , 13359 , 13360 , 
17867 , 21756 , 14038 , 9858 , 12256 , 20968 , 19533 , 19534, 20122 ,24386 , 9532
`.trim();

const WHERE_BASE = (ano: number, mes: number) => `
    F.SALDO_FINAL < 0
    AND F.ANO = ${ano}
    AND F.MES = ${mes}
    AND NVL(PRO.CODCONFKIT, 0) = 0
    AND NOT PRO.CODPROD IN (${CODPROD_EXCLUIDOS})
`.trim();

const CASE_GRUPO = `CASE
        WHEN DTP.DATA_ENTREGA IS NULL             THEN 'SEM_PREVISAO'
        WHEN DET.DTINICIOPREV < DTP.DATA_ENTREGA  THEN 'ATRASADO'
        ELSE 'EM_DIA'
    END`;

// Query rápida: apenas os JOINs necessários para a classificação e contagem
// MOT removido — não participa do CASE WHEN nem do COUNT
function buildSqlCounts(mes: number, ano: number): string {
  return `
SELECT
    ${CASE_GRUPO} AS GRUPO,
    COUNT(DISTINCT F.CODPROD) AS QTD
FROM CND_ONE_LISTA_FALTA F
    JOIN TGFPRO PRO
        ON PRO.CODPROD = F.CODPROD
    LEFT JOIN VW_NX_LISTAFALTA_DATAPREV DTP
        ON DTP.CODPROD = F.CODPROD
        AND DTP.NUNOTAFALT = F.NUNOTA
        AND F.IDIPROC = DTP.IDIPROC
    LEFT JOIN TGFCAB CAB
        ON CAB.NUNOTA = F.NUNOTA
    LEFT JOIN TGFNAT NAT
        ON NAT.CODNAT = CAB.CODNAT
    LEFT JOIN AD_DETALCRONOGRAMA DET
        ON DET.SEQ = F.SEQ
        AND DET.CODUSU = NAT.AD_SETOR
WHERE ${WHERE_BASE(ano, mes)}
GROUP BY ${CASE_GRUPO}
`.trim();
}

// Query de detalhe: apenas colunas e JOINs usados na tela
// ONE_COMPRAPENDENTE removido (função row-by-row, maior gargalo)
// VEN, C, I removidos (campos não exibidos)
function buildSqlItens(mes: number, ano: number): string {
  return `
SELECT DISTINCT
    F.CODPROD,
    F.NROLOTE,
    F.DATAFIMPREV,
    DET.DTINICIOPREV,
    DTP.DATA_ENTREGA AS DTENTREGAV,
    CASE
        WHEN MOT.STATUS = '1'  THEN 'Em Transito'
        WHEN MOT.STATUS = '2'  THEN 'Em Conferencia'
        WHEN MOT.STATUS = '3'  THEN 'Sob Gabarito'
        WHEN MOT.STATUS = '4'  THEN 'Planejado'
        WHEN MOT.STATUS = '5'  THEN 'Motor'
        WHEN MOT.STATUS = '6'  THEN 'Faturamento Pendente'
        WHEN MOT.STATUS = '7'  THEN 'Ajuste Necessario'
        WHEN MOT.STATUS = '8'  THEN 'Ruptura'
        WHEN MOT.STATUS = '9'  THEN 'Acionar Engenharia'
        WHEN MOT.STATUS = '10' THEN 'Pedido Pendente'
    END AS STATUS,
    PAR.NOMEPARC,
    PRO.DESCRPROD,
    A.DESCRPROD AS PROD_KIT,
    USU.NOMEUSU AS MICROSETOR,
    GRU.NOMEGRUPO AS MACROSETOR,
    ${CASE_GRUPO} AS GRUPO
FROM CND_ONE_LISTA_FALTA F
    JOIN TGFPRO PRO
        ON PRO.CODPROD = F.CODPROD
    LEFT JOIN AD_LISTADEFALTAMOT MOT
        ON MOT.CODPROD = F.CODPROD
        AND MOT.MES = F.MES
        AND MOT.CHASSI = F.NROLOTE
    LEFT JOIN VW_NX_LISTAFALTA_DATAPREV DTP
        ON DTP.CODPROD = F.CODPROD
        AND DTP.NUNOTAFALT = F.NUNOTA
        AND F.IDIPROC = DTP.IDIPROC
    LEFT JOIN TGFPAR PAR
        ON PAR.CODPARC = PRO.CODPARCFORN
    LEFT JOIN TGFCAB CAB
        ON CAB.NUNOTA = F.NUNOTA
    LEFT JOIN TGFNAT NAT
        ON NAT.CODNAT = CAB.CODNAT
    LEFT JOIN AD_DETALCRONOGRAMA DET
        ON DET.SEQ = F.SEQ
        AND DET.CODUSU = NAT.AD_SETOR
    LEFT JOIN TSIUSU USU
        ON USU.CODUSU = DET.CODUSU
    LEFT JOIN TSIGRU GRU
        ON GRU.CODGRUPO = USU.CODGRUPO
    LEFT JOIN TGFPRO A
        ON A.CODPROD = F.KIT
WHERE ${WHERE_BASE(ano, mes)}
ORDER BY F.DATAFIMPREV, F.NROLOTE
`.trim();
}

function parseRawDate(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s === 'null' || s === 'undefined') return null;
  return s;
}

function mapItemRow(r: unknown): PcmItem {
  const o = r as Record<string, unknown>;
  const grupoRaw = String(o['GRUPO'] ?? o['grupo'] ?? '');
  let categoria: PcmCategoria;
  if (grupoRaw === 'SEM_PREVISAO')     categoria = 'sem-previsao';
  else if (grupoRaw === 'ATRASADO')    categoria = 'atrasado';
  else                                 categoria = 'em-dia';

  return {
    descrprod:  String(o['DESCRPROD']  ?? o['descrprod']  ?? ''),
    prodKit:    o['PROD_KIT']   != null ? String(o['PROD_KIT']   ?? '') || null : null,
    chassi:       String(o['NROLOTE']      ?? o['nrolote']      ?? ''),
    dtInicioprev: parseRawDate(o['DTINICIOPREV']  ?? o['dtinicioprev']),
    dtEntregav:   parseRawDate(o['DTENTREGAV']    ?? o['dtentregav']),
    datafimprev:  parseRawDate(o['DATAFIMPREV']   ?? o['datafimprev']),
    status:     o['STATUS']     != null ? String(o['STATUS']     ?? '') || null : null,
    nomeparc:   o['NOMEPARC']   != null ? String(o['NOMEPARC']   ?? '') || null : null,
    microsetor: o['MICROSETOR'] != null ? String(o['MICROSETOR'] ?? '') || null : null,
    macrosetor: o['MACROSETOR'] != null ? String(o['MACROSETOR'] ?? '') || null : null,
    categoria,
  };
}

// Retorna apenas os contadores — query leve, carrega rápido
export async function getPcmCounts(mes: number, ano: number): Promise<PcmCounts> {
  const rows = await obterReg(buildSqlCounts(mes, ano));
  let semPrevisao = 0, atrasado = 0, emDia = 0;
  for (const r of rows) {
    const o = r as Record<string, unknown>;
    const grupo = String(o['GRUPO'] ?? o['grupo'] ?? '');
    const qty   = Number(o['QTD']   ?? o['qty']   ?? 0);
    if (grupo === 'SEM_PREVISAO')     semPrevisao = qty;
    else if (grupo === 'ATRASADO')    atrasado    = qty;
    else if (grupo === 'EM_DIA')      emDia       = qty;
  }
  return { total: semPrevisao + atrasado + emDia, semPrevisao, atrasado, emDia };
}

// Retorna os itens para as 3 colunas — carrega após os cards
export async function getPcmItens(mes: number, ano: number): Promise<PcmItem[]> {
  const rows = await obterReg(buildSqlItens(mes, ano));
  return rows.map(mapItemRow);
}
