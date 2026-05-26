import type { Status } from '@/types';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

const config: Record<Status, { label: string; icon: React.ElementType; className: string }> = {
  atingido: {
    label: 'Atingido',
    icon: CheckCircle2,
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  },
  'em-risco': {
    label: 'Em Risco',
    icon: AlertTriangle,
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  },
  'nao-atingido': {
    label: 'Não Atingido',
    icon: XCircle,
    className: 'bg-red-500/10 text-red-400 border-red-500/25',
  },
};

type Props = {
  status: Status;
  className?: string;
  size?: 'sm' | 'md';
};

export function StatusBadge({ status, className, size = 'md' }: Props) {
  const { label, icon: Icon, className: statusClass } = config[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        statusClass,
        className
      )}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {label}
    </span>
  );
}

export function statusColor(status: Status) {
  return {
    atingido: '#10B981',
    'em-risco': '#F59E0B',
    'nao-atingido': '#EF4444',
  }[status];
}

export function statusGlow(status: Status) {
  return {
    atingido: 'hover:shadow-[0_0_24px_rgba(16,185,129,0.15)]',
    'em-risco': 'hover:shadow-[0_0_24px_rgba(245,158,11,0.15)]',
    'nao-atingido': 'hover:shadow-[0_0_24px_rgba(239,68,68,0.15)]',
  }[status];
}
