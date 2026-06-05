import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Target, Calendar, User, GitBranch, Fish, ClipboardList, ChevronRight, MoreVertical, Pencil, Trash2, Info } from 'lucide-react';
import { mockIndicadores } from '@/data/mockIndicadores';
import { getAnalise } from '@/services/analisesService';
import { getCausasByAnalise, incrementPlanosCount, deleteCausa } from '@/services/causasService';
import type { Analise, Causa } from '@/types';
import { Button } from '@/components/ui/button';
import { CausaEfeitoModal } from '@/pages/CausaEfeitoModal';
import { NovoPlanModal } from '@/pages/NovoPlanModal';

type CatKey = Causa['categoria'];

const CAT_CFG: Record<CatKey, { label: string; color: string; tw: string; bg: string; border: string }> = {
  '6M-metodo':        { label: 'Método',        color: '#3B82F6', tw: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  '6M-maquina':       { label: 'Máquina',        color: '#10B981', tw: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  '6M-material':      { label: 'Material',       color: '#F59E0B', tw: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  '6M-mao-de-obra':   { label: 'Mão de Obra',    color: '#EF4444', tw: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200' },
  '6M-meio-ambiente': { label: 'Meio Ambiente',  color: '#8B5CF6', tw: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-200' },
  '6M-medicao':       { label: 'Medição',        color: '#06B6D4', tw: 'text-cyan-600',    bg: 'bg-cyan-50',    border: 'border-cyan-200' },
};

// ── SVG layout ─────────────────────────────────────────────────────────────────

const VW = 1000;
const VH = 420;
const SY = 210;
const SPINE_X1 = 40;
const SPINE_X2 = 862;
const J: number[] = [240, 455, 670];
const TOP_POS: [number, number][] = [[165, 72], [390, 72], [618, 72]];
const BOT_POS: [number, number][] = [[165, 348], [390, 348], [618, 348]];
const TOP_CATS: CatKey[] = ['6M-metodo', '6M-maquina', '6M-material'];
const BOT_CATS: CatKey[] = ['6M-mao-de-obra', '6M-meio-ambiente', '6M-medicao'];

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function trunc(s: string, n = 22) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

function CategoryPill({ cx, cy, label, color }: { cx: number; cy: number; label: string; color: string }) {
  const pw = Math.max(68, label.length * 6.8 + 24);
  return (
    <g>
      <rect x={cx - pw / 2} y={cy - 13} width={pw} height={26} rx={13} fill={color} />
      <text x={cx} y={cy + 4.5} textAnchor="middle" fontSize={11} fontWeight="600" fill="white" fontFamily="system-ui,sans-serif">
        {label}
      </text>
    </g>
  );
}

function Bone({ lx, ly, jx, color, causes }: {
  lx: number; ly: number; jx: number; color: string; causes: Causa[];
}) {
  const isTop = ly < SY;
  return (
    <g>
      <line x1={lx} y1={ly} x2={jx} y2={SY} stroke={color} strokeWidth={2.5} strokeOpacity={0.8} />
      {[0.28, 0.60].map((t, i) => {
        const causa = causes[i];
        if (!causa) return null;
        const px = lerp(lx, jx, t);
        const py = lerp(ly, SY, t);
        return (
          <g key={causa.id}>
            <line x1={px} y1={py} x2={px - 22} y2={py} stroke={color} strokeWidth={1} strokeOpacity={0.4} />
            <text
              x={px - 25} y={isTop ? py - 4 : py + 11}
              textAnchor="end" fontSize={10} fill="#4B5563" fontFamily="system-ui,sans-serif"
            >
              {trunc(causa.titulo || causa.descricao)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function ProblemBox({ problema }: { problema: string }) {
  const x0 = 868, y0 = 165, bw = 90, bh = 90;
  const pts = `${x0},${y0} ${x0 + bw},${y0} ${x0 + bw + 28},${y0 + bh / 2} ${x0 + bw},${y0 + bh} ${x0},${y0 + bh}`;
  const cx = x0 + bw / 2;

  const words = problema.split(' ');
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && (last + ' ' + w).length <= 15) lines[lines.length - 1] += ' ' + w;
    else lines.push(w);
  }

  return (
    <g>
      <polygon points={pts} fill="#FEF2F2" stroke="#FCA5A5" strokeWidth={1.5} />
      <text x={cx} y={y0 + 17} textAnchor="middle" fontSize={8.5} fontWeight="700" fill="#DC2626" fontFamily="system-ui,sans-serif" letterSpacing={0.5}>
        PROBLEMA
      </text>
      {lines.slice(0, 3).map((line, i) => (
        <text key={i} x={cx} y={y0 + 33 + i * 16} textAnchor="middle" fontSize={10} fill="#374151" fontFamily="system-ui,sans-serif">
          {line}
        </text>
      ))}
    </g>
  );
}

function FishboneSvg({ byCategory, problema }: {
  byCategory: Record<CatKey, Causa[]>;
  problema: string;
}) {
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" style={{ maxHeight: 340 }}>
      <line x1={SPINE_X1} y1={SY} x2={SPINE_X2} y2={SY} stroke="#374151" strokeWidth={3} />
      <polygon points={`${SPINE_X2},${SY - 9} ${SPINE_X2 + 20},${SY} ${SPINE_X2},${SY + 9}`} fill="#374151" />
      {J.map((jx) => (
        <circle key={jx} cx={jx} cy={SY} r={5} fill="white" stroke="#374151" strokeWidth={2.5} />
      ))}
      {TOP_CATS.map((cat, i) => (
        <Bone key={cat} lx={TOP_POS[i][0]} ly={TOP_POS[i][1]} jx={J[i]} color={CAT_CFG[cat].color} causes={byCategory[cat]} />
      ))}
      {BOT_CATS.map((cat, i) => (
        <Bone key={cat} lx={BOT_POS[i][0]} ly={BOT_POS[i][1]} jx={J[i]} color={CAT_CFG[cat].color} causes={byCategory[cat]} />
      ))}
      {TOP_CATS.map((cat, i) => (
        <CategoryPill key={cat} cx={TOP_POS[i][0]} cy={TOP_POS[i][1]} label={CAT_CFG[cat].label} color={CAT_CFG[cat].color} />
      ))}
      {BOT_CATS.map((cat, i) => (
        <CategoryPill key={cat} cx={BOT_POS[i][0]} cy={BOT_POS[i][1]} label={CAT_CFG[cat].label} color={CAT_CFG[cat].color} />
      ))}
      <ProblemBox problema={problema} />
    </svg>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function IshikawaPage() {
  const { id: analiseId } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [causas, setCausas] = useState<Causa[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [planTarget, setPlanTarget] = useState<Causa | null>(null);
  const [editTarget, setEditTarget] = useState<Causa | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Causa | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!analiseId) return;
    const a = await getAnalise(analiseId);
    if (!a) { setNotFound(true); return; }
    setAnalise(a);
    setCausas(await getCausasByAnalise(analiseId));
  };

  useEffect(() => { load(); }, [analiseId]);

  if (notFound) {
    return (
      <div className="p-8 text-center text-gray-500">
        Análise não encontrada.
      </div>
    );
  }
  if (!analise) return null;

  const indicador = mockIndicadores.find((i) => i.id === analise.indicadorId);

  const byCategory = (Object.keys(CAT_CFG) as CatKey[]).reduce((acc, k) => {
    acc[k] = causas.filter((c) => c.categoria === k);
    return acc;
  }, {} as Record<CatKey, Causa[]>);

  const dataFmt = new Date(analise.dataCriacao + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => nav(-1)}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="h-10 w-10 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center shrink-0">
          <Fish className="h-5 w-5 text-orange-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900">Diagrama de Ishikawa</h1>
          <p className="text-sm text-gray-500 truncate">{analise.problema}</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" />
          Nova Causa
        </Button>
      </div>

      {/* Fishbone SVG */}
      <div className="rounded-xl border border-gray-200 bg-white px-4 pt-4 pb-2 shadow-sm overflow-x-auto">
        <FishboneSvg byCategory={byCategory} problema={analise.problema} />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {(Object.entries(CAT_CFG) as [CatKey, typeof CAT_CFG[CatKey]][]).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: cfg.color }} />
            <span className="text-sm text-gray-600">{cfg.label}</span>
          </div>
        ))}
      </div>

      {/* Metadata bar */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 py-3 border-t border-b border-gray-100 text-sm">
        {indicador && (
          <span className="flex items-center gap-1.5 text-gray-600">
            <Target className="h-4 w-4 text-gray-400" />
            <span className="font-medium text-gray-500">Indicador:</span>
            {indicador.nome}
          </span>
        )}
        <span className="flex items-center gap-1.5 text-gray-600">
          <GitBranch className="h-4 w-4 text-gray-400" />
          <span className="font-medium text-gray-500">Desvio:</span>
          <span className="truncate max-w-xs">{analise.problema}</span>
        </span>
        <span className="flex items-center gap-1.5 text-gray-600">
          <User className="h-4 w-4 text-gray-400" />
          <span className="font-medium text-gray-500">Criado por:</span>
          {analise.responsavel}
        </span>
        <span className="flex items-center gap-1.5 text-gray-600">
          <Calendar className="h-4 w-4 text-gray-400" />
          <span className="font-medium text-gray-500">Data:</span>
          {dataFmt}
        </span>
        <span className="flex items-center gap-1.5 text-gray-600">
          <Fish className="h-4 w-4 text-gray-400" />
          <span className="font-medium text-gray-500">Causas:</span>
          <span className="font-bold text-gray-900">{causas.length}</span>
        </span>
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(Object.entries(CAT_CFG) as [CatKey, typeof CAT_CFG[CatKey]][]).map(([key, cfg]) => {
          const list = byCategory[key] ?? [];
          return (
            <div key={key} className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4`}>
              {/* Category header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ background: cfg.color }} />
                  <span className={`font-semibold text-sm ${cfg.tw}`}>{cfg.label}</span>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.tw} ${cfg.bg} ${cfg.border}`}>
                  {list.length}
                </span>
              </div>

              {list.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Nenhuma causa registrada.</p>
              ) : (
                <ul className="space-y-2">
                  {list.map((c) => (
                    <li key={c.id} className="rounded-lg border border-white bg-white/70 p-3 space-y-2.5">
                      {/* Título + tooltip de detalhamento + menu */}
                      <div className="flex items-start gap-2">
                        <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: cfg.color }} />
                        <span className="text-sm font-medium text-gray-800 leading-snug flex-1">{c.titulo}</span>

                        {/* Ícone de detalhamento */}
                        {c.descricao && (
                          <div className="relative group shrink-0 mt-0.5">
                            <Info className="h-3.5 w-3.5 text-gray-400 cursor-help hover:text-gray-600 transition-colors" />
                            <div className="pointer-events-none absolute right-0 top-5 z-30 hidden group-hover:block w-56 rounded-lg border border-gray-200 bg-white shadow-lg p-2.5 text-xs text-gray-600 leading-relaxed">
                              {c.descricao}
                            </div>
                          </div>
                        )}

                        {/* Botão de opções */}
                        <div className="relative shrink-0" ref={menuOpen === c.id ? menuRef : undefined}>
                          <button
                            onClick={() => setMenuOpen(menuOpen === c.id ? null : c.id)}
                            className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>

                          {menuOpen === c.id && (
                            <div className="absolute right-0 top-6 z-20 w-32 rounded-lg border border-gray-200 bg-white shadow-md py-1">
                              <button
                                onClick={() => { setEditTarget(c); setMenuOpen(null); }}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                              >
                                <Pencil className="h-3 w-3 text-gray-400" />
                                Editar
                              </button>
                              <button
                                onClick={() => { setDeleteTarget(c); setMenuOpen(null); }}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="h-3 w-3" />
                                Excluir
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Footer: planos count + CTA */}
                      <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                        {c.planosCount > 0 ? (
                          <button
                            onClick={() => nav('/planos-acao')}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            <ClipboardList className="h-3 w-3" />
                            {c.planosCount} plano{c.planosCount !== 1 ? 's' : ''}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">Sem planos</span>
                        )}
                        <button
                          onClick={() => setPlanTarget(c)}
                          className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-white transition-colors hover:opacity-90"
                          style={{ background: cfg.color }}
                        >
                          <Plus className="h-3 w-3" />
                          Plano de Ação
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* Modais */}
      {showAdd && analise && (
        <CausaEfeitoModal
          indicadorId={analise.indicadorId}
          indicadorNome={indicador?.nome ?? analise.indicadorId}
          analiseId={analise.id}
          onClose={() => setShowAdd(false)}
          onSaved={() => { load(); setShowAdd(false); }}
        />
      )}

      {editTarget && analise && (
        <CausaEfeitoModal
          indicadorId={analise.indicadorId}
          indicadorNome={indicador?.nome ?? analise.indicadorId}
          causa={editTarget}
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
                <p className="text-sm font-semibold text-gray-900">Excluir causa</p>
                <p className="text-xs text-gray-500 mt-0.5">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 leading-snug">
              {deleteTarget.descricao}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await deleteCausa(deleteTarget.id, deleteTarget.analiseId);
                    await load();
                    setDeleteTarget(null);
                  } finally {
                    setDeleting(false);
                  }
                }}
              >
                {deleting ? 'Excluindo…' : 'Excluir'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {planTarget && analise && (
        <NovoPlanModal
          indicadorId={analise.indicadorId}
          causaDefault={planTarget.titulo || planTarget.descricao}
          causaId={planTarget.id}
          analiseId={analise.id}
          onClose={() => setPlanTarget(null)}
          onSaved={async () => {
            await incrementPlanosCount(planTarget.id);
            await load();
            setPlanTarget(null);
          }}
        />
      )}

      {/* Fecha menu ao clicar fora */}
      {menuOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
      )}
    </div>
  );
}
