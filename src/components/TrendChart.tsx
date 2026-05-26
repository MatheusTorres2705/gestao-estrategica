import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Area,
  AreaChart,
} from 'recharts';
import type { TendenciaMes } from '@/types';

type Props = {
  data: TendenciaMes[];
  height?: number;
  metaLabel?: string;
  valorLabel?: string;
  unit?: string;
  invertido?: boolean; // se menor é melhor (ex: incidentes, retrabalho)
  tipo?: 'line' | 'area';
};

const CustomTooltip = ({ active, payload, label, unit }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  unit?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-lg text-xs">
      <p className="mb-1 font-medium text-gray-700">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-semibold">{p.value}{unit ? ` ${unit}` : ''}</span>
        </p>
      ))}
    </div>
  );
};

export function TrendChart({
  data,
  height = 200,
  metaLabel = 'Meta',
  valorLabel = 'Realizado',
  unit,
  tipo = 'area',
}: Props) {
  const Chart = tipo === 'area' ? AreaChart : LineChart;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="gradValor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gradMeta" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
        <XAxis
          dataKey="mes"
          tick={{ fill: '#9CA3AF', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#9CA3AF', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => unit ? `${v}${unit === '%' ? '%' : ''}` : String(v)}
        />
        <Tooltip content={<CustomTooltip unit={unit} />} />

        {tipo === 'area' ? (
          <>
            <Area
              type="monotone"
              dataKey="meta"
              name={metaLabel}
              stroke="#10B981"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              fill="url(#gradMeta)"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="valor"
              name={valorLabel}
              stroke="#3B82F6"
              strokeWidth={2}
              fill="url(#gradValor)"
              dot={{ fill: '#3B82F6', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#3B82F6', strokeWidth: 0 }}
            />
          </>
        ) : (
          <>
            <Line
              type="monotone"
              dataKey="meta"
              name={metaLabel}
              stroke="#10B981"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="valor"
              name={valorLabel}
              stroke="#3B82F6"
              strokeWidth={2}
              dot={{ fill: '#3B82F6', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#3B82F6', strokeWidth: 0 }}
            />
          </>
        )}
        <ReferenceLine
          y={data[data.length - 1]?.meta}
          stroke="rgba(16,185,129,0.3)"
          strokeDasharray="4 4"
        />
      </Chart>
    </ResponsiveContainer>
  );
}

export function SparkLine({ data, color = '#3B82F6', height = 40 }: {
  data: TendenciaMes[];
  color?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <defs>
          <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="valor"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#spark-${color})`}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
