import type { Indicador, Metrica, Status } from '@/types';
import { mockIndicadores } from '@/data/mockIndicadores';
import { getProducaoKpis } from './producaoService';

function calcStatus(valor: number, meta: number, polaridade: 'maior' | 'menor'): Status {
  const pct = polaridade === 'maior'
    ? (meta > 0 ? valor / meta * 100 : valor === 0 ? 100 : 0)
    : (valor > 0 ? meta / valor * 100 : valor === 0 ? 100 : 0);
  if (pct >= 95) return 'atingido';
  if (pct >= 80) return 'em-risco';
  return 'nao-atingido';
}

export async function getIndicadores(mes: number, ano: number): Promise<Indicador[]> {
  const base: Indicador[] = mockIndicadores.map(ind => ({
    ...ind,
    metricas: ind.metricas.map(m => ({ ...m })),
  }));

  try {
    const { ope, aderencia } = await getProducaoKpis(mes, ano);
    const producao = base.find(i => i.id === 'producao');
    if (producao) {
      producao.metricas = producao.metricas.map((m): Metrica => {
        if (m.id === 'ope' && ope !== null) {
          const valor = parseFloat(ope.toFixed(1));
          return { ...m, valor, status: calcStatus(valor, 85, 'maior') };
        }
        if (m.id === 'aderencia' && aderencia !== null) {
          const valor = parseFloat(aderencia.toFixed(1));
          return { ...m, valor, status: calcStatus(valor, 95, 'maior') };
        }
        return m;
      });
    }
  } catch {
    // mantém dados mock em caso de falha na API
  }

  return base;
}

export async function getIndicadorDetalhe(id: string, mes: number, ano: number): Promise<Indicador | undefined> {
  const indicadores = await getIndicadores(mes, ano);
  return indicadores.find((i) => i.id === id);
}
