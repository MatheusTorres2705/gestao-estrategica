import { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  ClipboardList, Plus, Search, CheckCircle2, Clock, TrendingUp,
  AlertCircle, Calendar, User, Filter, MoreVertical, Pencil, Trash2,
} from 'lucide-react';
import { getPlanosAcao, updatePlanoStatus, deletePlanoAcao } from '@/services/planosAcaoService';
import type { PlanoAcao, PlanoStatus } from '@/types';
import { mockIndicadores } from '@/data/mockIndicadores';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { NovoPlanModal } from '@/pages/NovoPlanModal';

type OutletCtx = { mes: number; ano: number };

// ── Column config ─────────────────────────────────────────────────────────────

const COLS: Array<{
  status: PlanoStatus;
  label: string;
  icon: React.ElementType;
  dot: string;
  header: string;
  body: string;
  ring: string;
}> = [
  { status: 'pendente',      label: 'Pendente',      icon: Clock,        dot: 'bg-gray-400',   header: 'bg-gray-100 text-gray-700',   body: 'bg-gray-50/80',   ring: 'ring-gray-300' },
  { status: 'em-andamento',  label: 'Em Andamento',  icon: TrendingUp,   dot: 'bg-amber-500',  header: 'bg-amber-100 text-amber-800', body: 'bg-amber-50/60',  ring: 'ring-amber-300' },
  { status: 'concluido',     label: 'Concluído',     icon: CheckCircle2, dot: 'bg-green-500',  header: 'bg-green-100 text-green-800', body: 'bg-green-50/60',  ring: 'ring-green-300' },
  { status: 'atrasado',      label: 'Atrasado',      icon: AlertCircle,  dot: 'bg-red-500',    header: 'bg-red-100 text-red-800',     body: 'bg-red-50/60',    ring: 'ring-red-300' },
];

const PROG_COLOR: Record<PlanoStatus, string> = {
  pendente: 'bg-gray-400', 'em-andamento': 'bg-amber-500', concluido: 'bg-green-500', atrasado: 'bg-red-500',
};

// ── Indicator badge map ───────────────────────────────────────────────────────

const IND_COLORS: Record<string, { short: string; color: string; bg: string }> = {
  'seguranca':        { short: 'SEG',  color: '#EF4444', bg: '#FEF2F2' },
  'qualidade':        { short: 'QUAL', color: '#3B82F6', bg: '#EFF6FF' },
  'tarifa-horaria':   { short: 'TAR',  color: '#F59E0B', bg: '#FFFBEB' },
  'producao':         { short: 'PROD', color: '#10B981', bg: '#ECFDF5' },
  'moldes':           { short: 'MOLD', color: '#8B5CF6', bg: '#F5F3FF' },
  'pcm':              { short: 'PCM',  color: '#06B6D4', bg: '#ECFEFF' },
  'working-capital':  { short: 'WC',   color: '#F97316', bg: '#FFF7ED' },
};

function IndBadge({ indicadorId }: { indicadorId: string }) {
  const cfg = IND_COLORS[indicadorId];
  const nome = mockIndicadores.find((i) => i.id === indicadorId)?.nome ?? indicadorId;
  if (!cfg) return <span className="text-[10px] text-gray-400 font-medium">{nome}</span>;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      {cfg.short}
    </span>
  );
}

// ── Kanban Card ───────────────────────────────────────────────────────────────

function KanbanCard({
  plano,
  onDragStart,
  isDragging,
  onEdit,
  onDelete,
}: {
  plano: PlanoAcao;
  onDragStart: () => void;
  isDragging: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = plano.prazo < today && plano.status !== 'concluido';

  useEffect(() => {
    if (!menuOpen) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`
        rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm cursor-grab active:cursor-grabbing
        hover:shadow-md hover:border-gray-300 transition-all space-y-2.5
        ${isDragging ? 'opacity-40 scale-95' : 'opacity-100'}
      `}
    >
      {/* Top: indicator badge + menu */}
      <div className="flex items-center justify-between gap-2">
        <IndBadge indicadorId={plano.indicadorId} />
        <div className="flex items-center gap-1">
          {plano.status === 'concluido' && (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
          )}
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-6 z-20 w-32 rounded-lg border border-gray-200 bg-white shadow-md py-1">
                <button
                  onClick={() => { setMenuOpen(false); onEdit(); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Pencil className="h-3 w-3 text-gray-400" />
                  Editar
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onDelete(); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  Excluir
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action text */}
      <p className={`text-sm leading-snug font-medium ${plano.status === 'concluido' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
        {plano.acao}
      </p>

      {/* Meta */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <User className="h-3 w-3 shrink-0" />
          <span className="truncate">{plano.responsavel}</span>
          <span className="text-gray-300">·</span>
          <span className="truncate">{plano.area}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <Calendar className="h-3 w-3 shrink-0 text-gray-400" />
          <span className={isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}>
            {plano.prazo}
            {isOverdue && ' — atrasado'}
          </span>
        </div>
      </div>

      {/* Progress */}
      {plano.progresso > 0 && (
        <div className="flex items-center gap-2">
          <Progress
            value={plano.progresso}
            indicatorClassName={PROG_COLOR[plano.status]}
            className="flex-1 h-1.5"
          />
          <span className="text-[10px] text-gray-400 shrink-0 w-7 text-right">{plano.progresso}%</span>
        </div>
      )}
    </div>
  );
}

// ── Kanban Column ─────────────────────────────────────────────────────────────

function KanbanColumn({
  col,
  cards,
  draggingId,
  onCardDragStart,
  onDrop,
  onAddClick,
  onEditCard,
  onDeleteCard,
}: {
  col: typeof COLS[number];
  cards: PlanoAcao[];
  draggingId: string | null;
  onCardDragStart: (id: string) => void;
  onDrop: (status: PlanoStatus) => void;
  onAddClick: () => void;
  onEditCard: (plano: PlanoAcao) => void;
  onDeleteCard: (plano: PlanoAcao) => void;
}) {
  const [isOver, setIsOver] = useState(false);
  const Icon = col.icon;

  return (
    <div
      className="flex flex-col min-w-[272px] w-[272px]"
      onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
      onDragLeave={() => setIsOver(false)}
      onDrop={() => { setIsOver(false); onDrop(col.status); }}
    >
      {/* Column header */}
      <div className={`flex items-center justify-between rounded-xl px-3 py-2.5 mb-3 ${col.header}`}>
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
          <Icon className="h-3.5 w-3.5" />
          <span className="text-sm font-semibold">{col.label}</span>
        </div>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/60">
          {cards.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        className={`
          flex-1 rounded-xl border-2 border-dashed transition-all p-2 space-y-2.5 min-h-[200px]
          ${isOver
            ? `border-blue-400 bg-blue-50/40 ring-2 ${col.ring}`
            : 'border-transparent bg-transparent'}
        `}
      >
        {cards.length === 0 && !isOver && (
          <div className="flex flex-col items-center gap-1.5 py-8 text-center">
            <ClipboardList className="h-6 w-6 text-gray-200" />
            <p className="text-xs text-gray-400">Nenhum plano</p>
          </div>
        )}
        {cards.map((p) => (
          <KanbanCard
            key={p.id}
            plano={p}
            isDragging={draggingId === p.id}
            onDragStart={() => onCardDragStart(p.id)}
            onEdit={() => onEditCard(p)}
            onDelete={() => onDeleteCard(p)}
          />
        ))}
      </div>

      {/* Add button */}
      <button
        onClick={onAddClick}
        className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 py-2 text-xs text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all"
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar plano
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlanosAcaoPage() {
  useOutletContext<OutletCtx>();
  const [planos, setPlanos] = useState<PlanoAcao[]>([]);
  const [search, setSearch] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<PlanoAcao | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlanoAcao | null>(null);
  const [deleting, setDeleting] = useState(false);
  const dragRef = useRef<string | null>(null);

  const load = () => getPlanosAcao().then(setPlanos);
  useEffect(() => { load(); }, []);

  const filtered = search.trim()
    ? planos.filter((p) => {
        const s = search.toLowerCase();
        return p.acao.toLowerCase().includes(s)
          || p.responsavel.toLowerCase().includes(s)
          || p.area.toLowerCase().includes(s);
      })
    : planos;

  const byStatus = (status: PlanoStatus) => filtered.filter((p) => p.status === status);

  const handleDrop = async (targetStatus: PlanoStatus) => {
    const id = dragRef.current;
    if (!id) return;
    const plano = planos.find((p) => p.id === id);
    if (!plano || plano.status === targetStatus) { setDraggingId(null); return; }
    const newProgress = targetStatus === 'concluido' ? 100 : plano.progresso;
    await updatePlanoStatus(id, targetStatus, newProgress);
    setDraggingId(null);
    dragRef.current = null;
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePlanoAcao(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } finally {
      setDeleting(false);
    }
  };

  const total = planos.length;
  const concluidos = planos.filter((p) => p.status === 'concluido').length;
  const pct = total > 0 ? Math.round((concluidos / total) * 100) : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Planos de Ação</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} planos · {pct}% concluídos
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4" />
          Novo Plano
        </Button>
      </div>

      {/* Search + summary */}
      <div className="px-6 pb-4 flex items-center gap-3 shrink-0">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar ação, responsável, área..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {search && (
          <Button variant="ghost" size="sm" onClick={() => setSearch('')}>
            <Filter className="h-3.5 w-3.5" />
            Limpar
          </Button>
        )}

        {/* Mini summary pills */}
        <div className="ml-auto flex items-center gap-2">
          {COLS.map((col) => (
            <div key={col.status} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${col.header}`}>
              <span className={`h-2 w-2 rounded-full ${col.dot}`} />
              {byStatus(col.status).length}
            </div>
          ))}
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto px-6 pb-6">
        <div className="flex gap-4 min-w-max">
          {COLS.map((col) => (
            <KanbanColumn
              key={col.status}
              col={col}
              cards={byStatus(col.status)}
              draggingId={draggingId}
              onCardDragStart={(id) => { dragRef.current = id; setDraggingId(id); }}
              onDrop={handleDrop}
              onAddClick={() => setShowModal(true)}
              onEditCard={setEditTarget}
              onDeleteCard={setDeleteTarget}
            />
          ))}
        </div>
      </div>

      {showModal && (
        <NovoPlanModal
          onClose={() => setShowModal(false)}
          onSaved={() => { load(); setShowModal(false); }}
        />
      )}

      {editTarget && (
        <NovoPlanModal
          plano={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { load(); setEditTarget(null); }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 border border-red-200">
                <Trash2 className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Excluir plano de ação</p>
                <p className="text-xs text-gray-500 mt-0.5">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 bg-gray-50 rounded-xl px-3 py-2 leading-snug">
              {deleteTarget.acao}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {deleting ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
