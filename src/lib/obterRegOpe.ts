import axios from 'axios';

// Conecta ao mesmo servidor usado pelo RelatorioGerencial2 (sankhya.nxboats.com.br:3200)
// via proxy Vite /ope-proxy para evitar conflito de prefixo com /api
const apiOpe = axios.create({ baseURL: '/ope-proxy' });

export async function obterRegOpe(
  consulta: string,
  opts?: { pageSize?: number; maxPages?: number },
): Promise<Record<string, unknown>[]> {
  const token = localStorage.getItem('pd_token');
  if (!token) return [];

  const { data } = await apiOpe.post<{ rows?: unknown[]; items?: unknown[] }>(
    '/api/obter-reg',
    {
      consulta,
      pageSize: opts?.pageSize ?? 10000,
      maxPages: opts?.maxPages ?? 10,
    },
    { headers: { Authorization: `Bearer ${token}` } },
  );

  return (data?.rows ?? data?.items ?? []) as Record<string, unknown>[];
}
