import { api } from '@/lib/api';

export async function dataSave(
  entity: string,
  fields: Record<string, string | number | null | undefined>
) {
  const { data } = await api.post('/api/data-save', { entity, fields });
  return data;
}
