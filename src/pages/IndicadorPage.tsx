import { useEffect, useMemo, useState } from 'react';
import { useParams, useOutletContext, useNavigate, Link } from 'react-router-dom';
import {
  ChevronLeft, Plus, TrendingUp, TrendingDown, Minus,
  Target, ShieldCheck, Award, DollarSign, Factory, Layers, Package, BarChart3,
  Fish, ChevronRight, Calendar, User, X, AlertCircle, MoreHorizontal, Pencil, Trash2,
} from 'lucide-react';
import { TrendChart } from '@/components/TrendChart';
import { getIndicadorDetalhe } from '@/services/indicadoresService';
import { getAnalises, saveAnalise, updateAnalise, deleteAnalise } from '@/services/analisesService';
import type { Indicador, Analise } from '@/types';
import { calcPctAtingimento, statusBscFromPct } from '@/types';
import { fmtPeriodo } from '@/lib/formatters';
import { OpeDetalhamentoModal } from '@/pages/OpeDetalhamentoModal';
import { Button } from '@/components/ui/button';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, ReferenceLine,
} from 'recharts';
import { obterReg } from '@/lib/obterReg';
import { TarifaHorariaView } from '@/components/TarifaHorariaView';
import { getWorkingCapitalEstoque } from '@/services/workingCapitalService';
import type { WorkingCapitalRow, Classificacao } from '@/services/workingCapitalService';
import { cn } from '@/lib/utils';

type OutletCtx = { mes: number; ano: number };

const ICONS: Record<string, React.ElementType> = {
  ShieldCheck, Award, DollarSign, Factory, Layers, Package, BarChart3,
};


const STATUS_BSC_CFG = {
  'no-prazo': { label: 'No Prazo', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  'atencao':  { label: 'Atenção',  cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  'critico':  { label: 'Crítico',  cls: 'bg-red-50 text-red-700 border border-red-200' },
};

export default function IndicadorPage() {
  const { id } = useParams<{ id: string }>();
  const { mes, ano } = useOutletContext<OutletCtx>();
  const nav = useNavigate();
  const [indicador, setIndicador] = useState<Indicador | undefined>();
  const [analises, setAnalises] = useState<Analise[]>([]);
  const [showNovaAnalise, setShowNovaAnalise] = useState(false);
  const [novoProblema, setNovoProblema] = useState('');
  const [novoResponsavel, setNovoResponsavel] = useState('');
  const [savingAnalise, setSavingAnalise] = useState(false);
  const [erroAnalise, setErroAnalise] = useState<string | null>(null);

  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editProblema, setEditProblema] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmandoDelete, setConfirmandoDelete] = useState<string | null>(null);
  const [deletando, setDeletando] = useState(false);

  useEffect(() => {
    if (!id) return;
    getIndicadorDetalhe(id, mes, ano).then(setIndicador);
    getAnalises(id).then(setAnalises);
  }, [id, mes, ano]);

  async function handleSaveAnalise() {
    if (!novoProblema.trim() || !novoResponsavel.trim()) {
      setErroAnalise('Preencha o desvio e o responsável.');
      return;
    }
    setSavingAnalise(true);
    setErroAnalise(null);
    try {
      const nova = await saveAnalise({
        indicadorId: indicador!.id,
        problema: novoProblema,
        responsavel: novoResponsavel,
        dataCriacao: new Date().toISOString().split('T')[0],
        mes,
        ano,
      });
      nav(`/ishikawa/${nova.id}`);
    } catch {
      setErroAnalise('Erro ao salvar análise.');
    } finally {
      setSavingAnalise(false);
    }
  }

  function abrirEdicao(a: Analise) {
    setMenuAberto(null);
    setEditandoId(a.id);
    setEditProblema(a.problema);
  }

  async function handleSaveEdit(id: string) {
    if (!editProblema.trim()) return;
    setSavingEdit(true);
    try {
      await updateAnalise(id, editProblema.trim());
      setAnalises(prev => prev.map(a => a.id === id ? { ...a, problema: editProblema.trim() } : a));
      setEditandoId(null);
    } catch {
      // mantém o form aberto em caso de erro
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteAnalise(id: string) {
    setDeletando(true);
    try {
      await deleteAnalise(id);
      setAnalises(prev => prev.filter(a => a.id !== id));
      setConfirmandoDelete(null);
    } catch {
      // mantém confirmação aberta em caso de erro
    } finally {
      setDeletando(false);
    }
  }

  if (!indicador) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const Icon = ICONS[indicador.icone] ?? BarChart3;

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link to="/dashboard" className="hover:text-gray-600 transition-colors">Metas e Indicadores</Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">{indicador.nome}</span>
      </div>

      {/* Hero Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => nav('/dashboard')}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
          <Icon className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{indicador.nome}</h1>
          <p className="text-sm text-gray-500">{fmtPeriodo(mes, ano)}</p>
        </div>
      </div>

      {/* Métricas — ocultas em Produção (substituídas pelos KPI cards do OPE) */}
      {indicador.id !== 'producao' && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {indicador.metricas.map((m) => {
          const isNum = typeof m.valor === 'number' && typeof m.meta === 'number';
          const pct = isNum
            ? calcPctAtingimento(m.valor as number, m.meta as number, m.polaridade ?? 'maior')
            : null;
          const statusKey = pct !== null ? statusBscFromPct(pct) : null;
          const statusCfg = statusKey ? STATUS_BSC_CFG[statusKey] : null;

          const diff = isNum ? (m.valor as number) - (m.meta as number) : null;
          return (
            <div key={m.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500 font-medium leading-tight">{m.label}</p>
                {statusCfg && (
                  <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium border', statusCfg.cls)}>
                    {statusCfg.label}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {typeof m.valor === 'number' ? m.valor.toLocaleString('pt-BR') : m.valor}
                {m.unidade === '%' && <span className="text-base text-gray-400">%</span>}
              </p>
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-xs text-gray-400">
                  <Target className="inline h-3 w-3 mr-1 text-gray-300" />
                  Meta: {typeof m.meta === 'number' ? m.meta.toLocaleString('pt-BR') : m.meta}
                  {m.unidade === '%' ? '%' : m.unidade ? ` ${m.unidade}` : ''}
                </p>
                {diff !== null && (
                  <span className={cn('flex items-center gap-0.5 text-xs font-medium',
                    diff === 0 ? 'text-gray-400' : statusKey === 'no-prazo' ? 'text-emerald-600' : statusKey === 'atencao' ? 'text-amber-600' : 'text-red-600'
                  )}>
                    {diff === 0 ? <Minus className="h-3 w-3" /> : diff > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {Math.abs(diff).toLocaleString('pt-BR')}{m.unidade === '%' ? 'p.p.' : m.unidade ? ` ${m.unidade}` : ''}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>}

      {/* Gráfico de tendência — substituído pelo OPE diário em Produção */}
      {indicador.id !== 'producao' && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Evolução — Últimos 6 Meses</h3>
          <TrendChart
            data={indicador.tendencia}
            height={220}
            unit={indicador.metricas[0]?.unidade === '%' ? '%' : ''}
          />
        </div>
      )}

      {/* Conteúdo específico por indicador */}
      {indicador.id === 'qualidade' && indicador.detalheExtra && <QualidadeDetalhe detalhe={indicador.detalheExtra} />}
      {indicador.id === 'tarifa-horaria' && <TarifaHorariaView mes={mes} ano={ano} />}
      {indicador.id === 'working-capital' && <WorkingCapitalDetalhe />}
      {indicador.id === 'seguranca' && indicador.detalheExtra && <SegurancaDetalhe detalhe={indicador.detalheExtra} />}
      {indicador.id === 'moldes' && indicador.detalheExtra && <MoldesDetalhe detalhe={indicador.detalheExtra} />}
      {indicador.id === 'pcm' && indicador.detalheExtra && <PcmDetalhe detalhe={indicador.detalheExtra} />}
      {indicador.id === 'producao' && <ProducaoDetalhe mes={mes} ano={ano} />}

      {/* Análises de Ishikawa */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Análise de Causa e Efeito</h3>
            <p className="text-xs text-gray-500 mt-0.5">{analises.length} análise(s)</p>
          </div>
          {!showNovaAnalise && (
            <Button size="sm" onClick={() => { setShowNovaAnalise(true); setErroAnalise(null); }}>
              <Plus className="h-3.5 w-3.5" /> Nova Análise
            </Button>
          )}
        </div>

        {/* Form inline de nova análise */}
        {showNovaAnalise && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3 mb-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-blue-700">Nova Análise</p>
              <button
                onClick={() => { setShowNovaAnalise(false); setErroAnalise(null); setNovoProblema(''); setNovoResponsavel(''); }}
                className="rounded p-0.5 text-blue-400 hover:text-blue-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wider">Desvio / Problema *</label>
              <textarea
                value={novoProblema}
                onChange={e => setNovoProblema(e.target.value)}
                placeholder="Ex: Gate G3 abaixo da meta (81%)"
                rows={2}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wider">Responsável *</label>
              <input
                value={novoResponsavel}
                onChange={e => setNovoResponsavel(e.target.value)}
                placeholder="Nome do responsável"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            {erroAnalise && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                <p className="text-xs text-red-600">{erroAnalise}</p>
              </div>
            )}
            <Button onClick={handleSaveAnalise} disabled={savingAnalise} className="w-full">
              {savingAnalise ? 'Criando…' : 'Criar e Abrir Diagrama'}
            </Button>
          </div>
        )}

        {/* Lista de análises */}
        {analises.length === 0 && !showNovaAnalise ? (
          <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center">
            <div className="flex justify-center mb-3">
              <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                <Fish className="h-6 w-6 text-gray-300" />
              </div>
            </div>
            <p className="text-gray-400 text-sm">Nenhuma análise registrada ainda.</p>
            <button onClick={() => { setShowNovaAnalise(true); setErroAnalise(null); }} className="mt-2 text-sm text-blue-600 hover:underline">
              Criar primeira análise
            </button>
          </div>
        ) : (
          <>
          {/* overlay para fechar menu ao clicar fora */}
          {menuAberto && (
            <div className="fixed inset-0 z-10" onClick={() => setMenuAberto(null)} />
          )}

          <ul className="space-y-2">
            {analises.map((a) => {
              if (editandoId === a.id) {
                return (
                  <li key={a.id}>
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-blue-700">Editar Análise</p>
                        <button
                          onClick={() => setEditandoId(null)}
                          className="rounded p-0.5 text-blue-400 hover:text-blue-600 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <textarea
                        value={editProblema}
                        onChange={e => setEditProblema(e.target.value)}
                        rows={2}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSaveEdit(a.id)} disabled={savingEdit || !editProblema.trim()}>
                          {savingEdit ? 'Salvando…' : 'Salvar'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditandoId(null)}>Cancelar</Button>
                      </div>
                    </div>
                  </li>
                );
              }

              if (confirmandoDelete === a.id) {
                return (
                  <li key={a.id}>
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                      <p className="text-sm font-semibold text-red-700">Excluir análise?</p>
                      <p className="text-xs text-red-600 leading-relaxed">
                        Isso removerá permanentemente a análise, todas as causas e planos de ação vinculados.
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="destructive" onClick={() => handleDeleteAnalise(a.id)} disabled={deletando}>
                          {deletando ? 'Excluindo…' : 'Confirmar exclusão'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmandoDelete(null)}>Cancelar</Button>
                      </div>
                    </div>
                  </li>
                );
              }

              return (
                <li key={a.id} className="relative">
                  <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40 transition-all group">
                    <button
                      onClick={() => nav(`/ishikawa/${a.id}`)}
                      className="flex items-center gap-3 flex-1 min-w-0 p-4 text-left"
                    >
                      <div className="h-8 w-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center shrink-0">
                        <Fish className="h-4 w-4 text-orange-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 leading-snug truncate">{a.problema}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <User className="h-3 w-3" />{a.responsavel}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Calendar className="h-3 w-3" />{a.dataCriacao}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors shrink-0" />
                    </button>

                    {/* Botão de opções */}
                    <div className="relative pr-3 z-20">
                      <button
                        onClick={e => { e.stopPropagation(); setMenuAberto(menuAberto === a.id ? null : a.id); }}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {menuAberto === a.id && (
                        <div className="absolute right-0 top-full mt-1 w-36 rounded-xl border border-gray-200 bg-white shadow-lg z-30 overflow-hidden">
                          <button
                            onClick={() => abrirEdicao(a)}
                            className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5 text-gray-400" /> Editar
                          </button>
                          <button
                            onClick={() => { setMenuAberto(null); setConfirmandoDelete(a.id); }}
                            className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Excluir
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          </>
        )}
      </div>
    </div>
  );
}

// Sub-componentes de detalhe (adaptados para tema light)

function QualidadeDetalhe({ detalhe }: { detalhe: Record<string, unknown> }) {
  const gates = detalhe.gates as Array<{ gate: string; resultado: number; meta: number }> ?? [];
  const defeitosPorArea = detalhe.defeitosPorArea as Array<{ area: string; quantidade: number; percentual: number }> ?? [];
  const topProblemas = detalhe.topProblemasCampo as Array<{ rank: number; problema: string; ocorrencias: number; acao: string }> ?? [];
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Evolução dos Gates</h3>
        <div className="space-y-3">
          {gates.map((g) => (
            <div key={g.gate}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600">{g.gate}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">Meta: {g.meta}%</span>
                  <span className={`text-xs font-semibold ${g.resultado >= g.meta ? 'text-emerald-600' : 'text-red-600'}`}>{g.resultado}%</span>
                </div>
              </div>
              <div className="relative h-2 rounded-full bg-gray-100">
                <div className={`h-full rounded-full ${g.resultado >= g.meta ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${g.resultado}%` }} />
                <div className="absolute top-0 h-full w-0.5 bg-gray-400/50" style={{ left: `${g.meta}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Defeitos por Área</h3>
        <div className="space-y-2">
          {defeitosPorArea.map((d) => (
            <div key={d.area} className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-24 shrink-0">{d.area}</span>
              <div className="flex-1 h-2 rounded-full bg-gray-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${d.percentual}%` }} /></div>
              <span className="text-xs font-medium text-gray-700 w-8 text-right">{d.quantidade}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">TOP 5 — Problemas Pós-Venda</h3>
        <div className="space-y-3">
          {topProblemas.map((p) => (
            <div key={p.rank} className="flex gap-4 rounded-lg border border-gray-100 p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">{p.rank}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-800">{p.problema}</p>
                  <span className="text-xs text-gray-500">{p.ocorrencias} oc.</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Ação: {p.acao}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TarifaDetalhe({ detalhe }: { detalhe: Record<string, unknown> }) {
  const melhorias = detalhe.topMelhorias as Array<{ setor: string; variacao: number; motivo: string }> ?? [];
  const pioras = detalhe.topPioras as Array<{ setor: string; variacao: number; motivo: string }> ?? [];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <h3 className="text-sm font-semibold text-emerald-700 mb-4">Top 3 Melhorias vs Março</h3>
        <div className="space-y-3">
          {melhorias.map((m, i) => (
            <div key={i} className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-600">{i + 1}</span>
              <div>
                <div className="flex items-center gap-2"><p className="text-sm font-medium text-gray-800">{m.setor}</p><span className="text-xs font-semibold text-emerald-600">{m.variacao.toFixed(1)}%</span></div>
                <p className="text-xs text-gray-500">{m.motivo}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-red-200 bg-red-50 p-5">
        <h3 className="text-sm font-semibold text-red-700 mb-4">Top 3 Pioras vs Março</h3>
        <div className="space-y-3">
          {pioras.map((p, i) => (
            <div key={i} className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600">{i + 1}</span>
              <div>
                <div className="flex items-center gap-2"><p className="text-sm font-medium text-gray-800">{p.setor}</p><span className="text-xs font-semibold text-red-600">+{p.variacao.toFixed(1)}%</span></div>
                <p className="text-xs text-gray-500">{p.motivo}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const WC_CFG: Record<Classificacao, { label: string; cor: string; bg: string; text: string; border: string }> = {
  'NORMAL':      { label: 'Normal',      cor: '#16A34A', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'UNDER':       { label: 'Under',       cor: '#2563EB', bg: 'bg-blue-50',    text: 'text-blue-700',   border: 'border-blue-200'    },
  'OVER':        { label: 'Over',        cor: '#D97706', bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200'   },
  'SLOW MOVING': { label: 'Slow Moving', cor: '#7C3AED', bg: 'bg-violet-50',  text: 'text-violet-700', border: 'border-violet-200'  },
  'OBSOLETO':    { label: 'Obsoleto',    cor: '#DC2626', bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-200'     },
};

const WC_ORDER: Classificacao[] = ['NORMAL', 'UNDER', 'OVER', 'SLOW MOVING', 'OBSOLETO'];

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function fmtQtd(v: number) {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

function WorkingCapitalDetalhe() {
  const [rows, setRows] = useState<WorkingCapitalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Classificacao | null>(null);
  const [pagina, setPagina] = useState(50);

  useEffect(() => {
    setLoading(true);
    setErro(null);
    getWorkingCapitalEstoque()
      .then(setRows)
      .catch((e: Error) => setErro(`Falha ao carregar estoque: ${e?.message ?? 'erro desconhecido'}`))
      .finally(() => setLoading(false));
  }, []);

  const sumario = useMemo(() => {
    const totalCusto = rows.reduce((s, r) => s + r.custoTot, 0);
    return WC_ORDER.map((cl) => {
      const grupo = rows.filter((r) => r.classificacao === cl);
      const custo = grupo.reduce((s, r) => s + r.custoTot, 0);
      return {
        classificacao: cl,
        label: WC_CFG[cl].label,
        cor: WC_CFG[cl].cor,
        qtd: grupo.length,
        custo,
        pct: totalCusto > 0 ? (custo / totalCusto) * 100 : 0,
      };
    });
  }, [rows]);

  const pieData = useMemo(
    () => sumario.map((s) => ({ name: s.label, value: parseFloat(s.pct.toFixed(1)), color: s.cor })),
    [sumario],
  );

  const rowsFiltrados = useMemo(() => {
    const base = filtro ? rows.filter((r) => r.classificacao === filtro) : rows;
    return [...base].sort((a, b) => b.custoTot - a.custoTot);
  }, [rows, filtro]);

  const rowsVisiveis = rowsFiltrados.slice(0, pagina);

  const btnFiltro = (cl: Classificacao | null) => {
    const ativo = filtro === cl;
    if (cl === null) {
      return cn('px-3 py-1 rounded-full text-xs font-medium transition-colors', ativo ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200');
    }
    const cfg = WC_CFG[cl];
    return cn('px-3 py-1 rounded-full text-xs font-medium transition-colors border', ativo ? `${cfg.bg} ${cfg.text} ${cfg.border}` : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200');
  };

  if (erro) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5">
        <p className="text-sm text-red-600">{erro}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cards de sumário */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {sumario.map((s) => {
          const cfg = WC_CFG[s.classificacao];
          return (
            <button
              key={s.classificacao}
              onClick={() => { setFiltro(prev => prev === s.classificacao ? null : s.classificacao); setPagina(50); }}
              className={cn('rounded-xl border p-4 text-left transition-all shadow-sm hover:shadow-md', cfg.bg, cfg.border, filtro === s.classificacao ? 'ring-2 ring-offset-1' : '')}
              style={filtro === s.classificacao ? { ringColor: cfg.cor } : {}}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: cfg.cor }} />
                <span className={cn('text-xs font-semibold', cfg.text)}>{s.label}</span>
              </div>
              {loading ? (
                <div className="h-5 rounded bg-gray-200 animate-pulse w-3/4 mb-1" />
              ) : (
                <>
                  <p className="text-xl font-bold text-gray-900 leading-tight">{s.pct.toFixed(1)}%</p>
                  <p className="text-[11px] text-gray-500 mt-1">{s.qtd} itens · {fmtBRL(s.custo)}</p>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Gráfico + legenda */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Distribuição do Estoque por Custo</h3>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="h-52 w-52 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v}%`]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 w-full space-y-2">
              {sumario.map((s) => {
                const cfg = WC_CFG[s.classificacao];
                const totalCusto = rows.reduce((acc, r) => acc + r.custoTot, 0);
                const barW = totalCusto > 0 ? (s.custo / totalCusto) * 100 : 0;
                return (
                  <div key={s.classificacao} className="flex items-center gap-3">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: cfg.cor }} />
                    <span className="text-xs text-gray-600 w-24 shrink-0">{s.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${barW}%`, background: cfg.cor }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 w-10 text-right">{s.pct.toFixed(1)}%</span>
                    <span className="text-xs text-gray-400 w-24 text-right hidden sm:block">{fmtBRL(s.custo)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Tabela de itens */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 p-4 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-700 mr-2">Itens de Estoque</span>
          <button onClick={() => { setFiltro(null); setPagina(50); }} className={btnFiltro(null)}>Todos</button>
          {WC_ORDER.map((cl) => (
            <button key={cl} onClick={() => { setFiltro(f => f === cl ? null : cl); setPagina(50); }} className={btnFiltro(cl)}>
              {WC_CFG[cl].label}
            </button>
          ))}
          {!loading && (
            <span className="ml-auto text-xs text-gray-400">
              {rowsFiltrados.length} {rowsFiltrados.length === 1 ? 'item' : 'itens'}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : rowsFiltrados.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">Nenhum item encontrado.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-gray-500">
                    <th className="px-4 py-2 text-left font-medium">Grupo</th>
                    <th className="px-4 py-2 text-left font-medium">Cód.</th>
                    <th className="px-4 py-2 text-left font-medium">Produto</th>
                    <th className="px-4 py-2 text-right font-medium">Estoque</th>
                    <th className="px-4 py-2 text-right font-medium">Custo Total</th>
                    <th className="px-4 py-2 text-right font-medium">Cobertura</th>
                    <th className="px-4 py-2 text-right font-medium">Dias s/ Giro</th>
                    <th className="px-4 py-2 text-center font-medium">Classif.</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsVisiveis.map((r) => {
                    const cfg = WC_CFG[r.classificacao];
                    return (
                      <tr key={r.codProd} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2 text-gray-500 max-w-[120px] truncate">{r.descrGrupoProd}</td>
                        <td className="px-4 py-2 font-mono text-gray-600">{r.codProd}</td>
                        <td className="px-4 py-2 text-gray-800 max-w-[240px]">
                          <span className="line-clamp-1" title={r.descrProd}>{r.descrProd}</span>
                        </td>
                        <td className="px-4 py-2 text-right text-gray-700">{fmtQtd(r.estTot)}</td>
                        <td className="px-4 py-2 text-right font-medium text-gray-800">{fmtBRL(r.custoTot)}</td>
                        <td className="px-4 py-2 text-right text-gray-600">{r.coberturaDias != null ? `${fmtQtd(r.coberturaDias)} d` : '—'}</td>
                        <td className="px-4 py-2 text-right text-gray-600">{r.diasSemGiro != null ? `${fmtQtd(r.diasSemGiro)} d` : '—'}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold border', cfg.bg, cfg.text, cfg.border)}>
                            {cfg.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {rowsFiltrados.length > pagina && (
              <div className="flex justify-center p-4 border-t border-gray-100">
                <button
                  onClick={() => setPagina(p => p + 50)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Mostrar mais ({rowsFiltrados.length - pagina} restantes)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SegurancaDetalhe({ detalhe }: { detalhe: Record<string, unknown> }) {
  const acidentes = detalhe.acidentes as Array<{ data: string; descricao: string; gravidade: string; afastamento: string }> ?? [];
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Detalhamento de Acidentes/Incidentes</h3>
      <div className="space-y-3">
        {acidentes.map((a, i) => (
          <div key={i} className="flex gap-4 rounded-lg border border-gray-100 p-3.5">
            <p className="text-xs font-bold text-gray-500 shrink-0">{a.data}</p>
            <div className="flex-1">
              <p className="text-sm text-gray-800">{a.descricao}</p>
              <div className="flex gap-3 mt-1">
                <span className="text-xs text-gray-500">Gravidade: <span className="text-amber-600">{a.gravidade}</span></span>
                <span className="text-xs text-gray-500">Afastamento: <span className={a.afastamento !== 'Não' ? 'text-red-600' : 'text-emerald-600'}>{a.afastamento}</span></span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MoldesDetalhe({ detalhe }: { detalhe: Record<string, unknown> }) {
  const atividades = detalhe.atividadesRealizadas as string[] ?? [];
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Atividades Realizadas</h3>
      <ul className="space-y-2">
        {atividades.map((a, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />{a}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PcmDetalhe({ detalhe }: { detalhe: Record<string, unknown> }) {
  const faltantes = detalhe.faltantesCriticos as Array<{ codigo: string; descricao: string; quantidade: number; prevEntrega: string; acao: string }> ?? [];
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Itens Críticos Faltantes — Maio</h3>
      <div className="space-y-3">
        {faltantes.map((f) => (
          <div key={f.codigo} className="rounded-lg border border-red-100 bg-red-50 p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-mono text-red-600">{f.codigo}</p>
                <p className="text-sm font-medium text-gray-800 mt-0.5">{f.descricao}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-500">Qtd: <span className="text-gray-800 font-medium">{f.quantidade}</span></p>
                <p className="text-xs text-gray-500 mt-0.5">Prev: <span className="text-amber-600">{f.prevEntrega}</span></p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Ação: {f.acao}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Produção: OPE por Galpão ─────────────────────────────── */

const _LINHAS_MAIORES = new Set(['NX260','NX270','NX280','NX290','NX310','NX340','NX350','NX360','NX370']);
const _LINHAS_GALP2   = new Set(['NX410','NX440']);
const _LINHAS_GALP3   = new Set(['NX500','NX620']);
const _LINHAS_MAIORES_ARR = ['NX260','NX270','NX280','NX290','NX310','NX340','NX350','NX360','NX370'];
const _LINHAS_MENORES_ARR = ['NX410','NX440','NX500','NX620','NX62'];
const _SETORES_SQL = ['ACAB','MONT','MARC','ELET','LAM','REB'];
const _OPE_META_PCT = 85;

type _RawAtivRow    = { linha: string; data: string; setorMacro: string; horas: number; qtdAtiv: number };
type _RawPontoRow   = { linha: string; data: string; setorMacro: string; qtdPonto: number; horasPonto: number };
type _AggRow        = { label: string; horas: number; horasReg: number; qtdAtiv: number; qtdPonto: number };
type _KpiStatus     = 'ok' | 'atencao' | 'critico';
type _RawBarcoRow   = { chassi: string; linha: string; mes: number; ano: number; pctConclu: number };

function _buildSqlBarcosEntregues(mes: number, ano: number): string {
  return `
WITH
TAB_APO AS (
  SELECT APO.*
  FROM AD_CRONOGRAMA CRO
    LEFT JOIN AD_DETALCRONOGRAMA DET ON DET.SEQ = CRO.SEQ
    LEFT JOIN AD_APOAVANCO APO ON (APO.SEQ = DET.SEQ AND APO.CODUSU = DET.CODUSU)
    LEFT JOIN TGFPRO PRO ON APO.CODPRODSP = PRO.CODPROD
    INNER JOIN TCSPRJ PRJ ON PRJ.CODPROJ = CRO.CODPROJ
    INNER JOIN TSIUSU USU ON USU.CODUSU = APO.CODUSU
  WHERE APO.DATA > TO_DATE('01/01/${ano - 1}', 'DD/MM/YYYY')
    AND SUBSTR(PRJ.IDENTIFICACAO, 1, 5) IN (
      'NX260','NX270','NX280','NX290','NX310',
      'NX340','NX350','NX360','NX370','NX410','NX440','NX500','NX620','NX62'
    )
),
TAB_ATIVIDADES AS (
  SELECT
    COMP.SEQ          AS COD_SEQUENCIAL,
    CRO.MES,
    CRO.ANO,
    SUBSTR(PRJ.IDENTIFICACAO, 1, 5) AS LINHA,
    PRJ.IDENTIFICACAO AS CHASSI,
    COMP.QTD          AS DURACAO,
    COMP.FEITO        AS STATUS
  FROM AD_COMPONENTECRONO COMP
    LEFT JOIN TAB_APO APO
      ON APO.SEQ = COMP.SEQ AND APO.CODUSU = COMP.CODUSU AND APO.CODPRODSP = COMP.CODPRODSP
    LEFT JOIN AD_CRONOGRAMA CRO ON CRO.SEQ      = COMP.SEQ
    LEFT JOIN TCSPRJ PRJ        ON PRJ.CODPROJ  = CRO.CODPROJ
  WHERE COMP.RETRABALHO IS NULL
    AND CRO.ANO * 100 + CRO.MES >= ${ano * 100 + mes}
),
DETAVANCO AS (
  SELECT
    COD_SEQUENCIAL, CHASSI, LINHA, MES, ANO,
    SUM(CASE WHEN STATUS = 'S' THEN DURACAO ELSE 0 END) AS DURACAO_CONCLU,
    SUM(DURACAO) AS DURACAO_TOT
  FROM TAB_ATIVIDADES
  GROUP BY COD_SEQUENCIAL, CHASSI, LINHA, MES, ANO
)
SELECT
  COD_SEQUENCIAL,
  CHASSI,
  LINHA,
  MES,
  ANO,
  CASE WHEN SUM(DURACAO_TOT) > 0
    THEN ROUND(SUM(DURACAO_CONCLU) / SUM(DURACAO_TOT) * 100, 2)
    ELSE 0
  END AS PCT_CONCLU
FROM DETAVANCO
GROUP BY COD_SEQUENCIAL, CHASSI, LINHA, MES, ANO
ORDER BY LINHA, CHASSI
`.trim();
}

function _oracleInicio(s: string) { return `TO_DATE('${s} 00:00:00', 'DD/MM/YYYY HH24:MI:SS')`; }
function _oracleFim(s: string)    { return `TO_DATE('${s} 23:59:59', 'DD/MM/YYYY HH24:MI:SS')`; }
function _oracleData(s: string)   { return `TO_DATE('${s}', 'DD/MM/YYYY')`; }

function _buildSqlAtividades(ini: string, fim: string, linhasArr: string[], setor: string): string {
  const linhasIn = linhasArr.map(l => `'${l}'`).join(',');
  return `
WITH
TAB_APO AS (
  SELECT APO.*
  FROM AD_CRONOGRAMA CRO
    LEFT JOIN AD_DETALCRONOGRAMA DET ON DET.SEQ = CRO.SEQ
    LEFT JOIN AD_APOAVANCO APO ON (APO.SEQ = DET.SEQ AND APO.CODUSU = DET.CODUSU)
    LEFT JOIN TGFPRO PRO ON APO.CODPRODSP = PRO.CODPROD
    INNER JOIN TCSPRJ PRJ ON PRJ.CODPROJ = CRO.CODPROJ
    INNER JOIN TSIUSU USU ON USU.CODUSU = APO.CODUSU
  WHERE APO.DATA BETWEEN ${_oracleInicio(ini)} AND ${_oracleFim(fim)}
    AND SUBSTR(PRJ.IDENTIFICACAO, 1, 5) IN (${linhasIn})
),
TAB_DEP AS (
  SELECT DISTINCT
    DEP.AD_CODUSU, DEP.CODDEP, DEP.DESCRDEP, DEPL.CODPROJPAI
  FROM TFPDEP DEP
    LEFT JOIN AD_DEPLINHA DEPL ON DEPL.CODDEP = DEP.CODDEP
  WHERE DEP.AD_CODUSU IS NOT NULL
),
TAB_BASE AS (
  SELECT
    COMP.SEQ                        AS COD_SEQUENCIAL,
    PRJ.CODPROJPAI,
    TAB_DEP.CODDEP,
    TAB_DEP.DESCRDEP,
    SUBSTR(PRJ.IDENTIFICACAO, 1, 5) AS LINHA,
    PRJ.IDENTIFICACAO               AS CHASSI,
    COMP.CODUSU                     AS COD_SETOR,
    USU.NOMEUSU                     AS SETOR,
    COMP.CODPRODSP                  AS COD_ATIVIDADE,
    PRO.DESCRPROD                   AS ATIVIDADE,
    COMP.QTD                        AS DURACAO,
    COMP.FEITO                      AS STATUS,
    APO.DATA                        AS DATA_EXECUCAO,
    ROW_NUMBER() OVER (
      PARTITION BY
        COMP.SEQ, PRJ.CODPROJPAI, SUBSTR(PRJ.IDENTIFICACAO, 1, 5), PRJ.IDENTIFICACAO,
        COMP.CODUSU, USU.NOMEUSU, COMP.CODPRODSP, PRO.DESCRPROD, COMP.QTD, COMP.FEITO, APO.DATA
      ORDER BY
        (SELECT COUNT(*) FROM AD_DEPLINHA X WHERE X.CODDEP = TAB_DEP.CODDEP) ASC,
        TAB_DEP.CODDEP ASC
    ) AS RN
  FROM AD_COMPONENTECRONO COMP
    LEFT JOIN TAB_APO APO
      ON APO.SEQ = COMP.SEQ AND APO.CODUSU = COMP.CODUSU AND APO.CODPRODSP = COMP.CODPRODSP
    LEFT JOIN TGFPRO PRO        ON PRO.CODPROD  = COMP.CODPRODSP
    LEFT JOIN TSIUSU USU        ON USU.CODUSU   = COMP.CODUSU
    LEFT JOIN AD_CRONOGRAMA CRO ON CRO.SEQ      = COMP.SEQ
    LEFT JOIN TCSPRJ PRJ        ON PRJ.CODPROJ  = CRO.CODPROJ
    LEFT JOIN TAB_DEP
      ON TAB_DEP.AD_CODUSU  = COMP.CODUSU
     AND TAB_DEP.CODPROJPAI = PRJ.CODPROJPAI
  WHERE COMP.RETRABALHO IS NULL
    AND APO.DATA IS NOT NULL
),
SETOR_MACRO AS (
  SELECT DISTINCT DEP.AD_CODUSU, DEPL.SETORMACRO
  FROM TFPDEP DEP
    JOIN AD_DEPLINHA DEPL ON DEPL.CODDEP = DEP.CODDEP
  WHERE DEP.AD_CODUSU IS NOT NULL
    AND DEPL.SETORMACRO IS NOT NULL
)
SELECT
  TB.LINHA,
  TO_CHAR(TB.DATA_EXECUCAO, 'DD/MM/YYYY') AS DATA,
  SM.SETORMACRO,
  COUNT(*)                        AS QTD_REGISTROS,
  ROUND(SUM(TB.DURACAO) / 60, 2) AS HORAS
FROM TAB_BASE TB
  JOIN SETOR_MACRO SM ON SM.AD_CODUSU = TB.COD_SETOR
WHERE TB.RN = 1
  AND SM.SETORMACRO = '${setor}'
GROUP BY TB.LINHA, TB.DATA_EXECUCAO, SM.SETORMACRO
ORDER BY TB.LINHA, TB.DATA_EXECUCAO, SM.SETORMACRO
`.trim();
}

function _buildSqlPonto(ini: string, fim: string, linhasArr: string[], setor: string): string {
  const linhasIn = linhasArr.map(l => `'${l}'`).join(',');
  return `
SELECT LINHA, DATA, SETORMACRO,
  COUNT(*)      AS QTD_REGISTROS,
  COUNT(*) * 8  AS HORAS_PONTO
FROM (
  SELECT DISTINCT
    PON.CODFUNC,
    TO_CHAR(PON.DTPONTO, 'DD/MM/YYYY') AS DATA,
    'NX' || CASE SUBSTR(DEPL.CODPROJPAI, 3, 3)
                 WHEN '480' THEN '500'
                 ELSE SUBSTR(DEPL.CODPROJPAI, 3, 3)
            END  AS LINHA,
    DEPL.SETORMACRO
  FROM AD_BATPONTO PON
    JOIN TFPEQP EQ        ON EQ.CODEQP   = PON.CODEQP
    JOIN TFPFUN FUN       ON FUN.CODFUNC = PON.CODFUNC
    JOIN AD_DEPLINHA DEPL ON DEPL.CODDEP = FUN.CODDEP
  WHERE PON.DTPONTO BETWEEN ${_oracleData(ini)} AND ${_oracleData(fim)}
    AND EQ.AD_USADO     = '1'
    AND DEPL.SETORMACRO = '${setor}'
    AND DEPL.CODPROJPAI IS NOT NULL
)
WHERE LINHA IN (${linhasIn})
GROUP BY LINHA, DATA, SETORMACRO
ORDER BY LINHA, DATA, SETORMACRO
`.trim();
}

// Sankhya pode retornar array [LINHA, DATA, SETORMACRO, QTD_REGISTROS, HORAS]
// ou objeto com chaves nomeadas — ambos são suportados
function _mapAtiv(r: unknown): _RawAtivRow {
  if (Array.isArray(r)) {
    return { linha: String(r[0] ?? ''), data: String(r[1] ?? ''), setorMacro: String(r[2] ?? ''), qtdAtiv: Number(r[3] ?? 0), horas: Number(r[4] ?? 0) };
  }
  const o = r as Record<string, unknown>;
  return {
    linha:      String(o['LINHA']         ?? o['linha']         ?? ''),
    data:       String(o['DATA']          ?? o['data']          ?? ''),
    setorMacro: String(o['SETORMACRO']    ?? o['setormacro']    ?? ''),
    horas:      Number(o['HORAS']         ?? o['horas']         ?? 0),
    qtdAtiv:    Number(o['QTD_REGISTROS'] ?? o['qtd_registros'] ?? 0),
  };
}

// Sankhya pode retornar array [LINHA, DATA, SETORMACRO, QTD_REGISTROS, HORAS_PONTO]
// ou objeto com chaves nomeadas — ambos são suportados
function _mapPonto(r: unknown): _RawPontoRow {
  if (Array.isArray(r)) {
    return { linha: String(r[0] ?? ''), data: String(r[1] ?? ''), setorMacro: String(r[2] ?? ''), qtdPonto: Number(r[3] ?? 0), horasPonto: Number(r[4] ?? 0) };
  }
  const o = r as Record<string, unknown>;
  return {
    linha:      String(o['LINHA']         ?? o['linha']         ?? ''),
    data:       String(o['DATA']          ?? o['data']          ?? ''),
    setorMacro: String(o['SETORMACRO']    ?? o['setormacro']    ?? ''),
    qtdPonto:   Number(o['QTD_REGISTROS'] ?? o['qtd_registros'] ?? 0),
    horasPonto: Number(o['HORAS_PONTO']   ?? o['horas_ponto']   ?? 0),
  };
}

function _agregarOpe(ativos: _RawAtivRow[], pontos: _RawPontoRow[]): _AggRow[] {
  const grupos = [
    { label: 'Geral',    fn: (_: string) => true },
    { label: 'Galpão 1', fn: (l: string) => _LINHAS_MAIORES.has(l) },
    { label: 'Galpão 2', fn: (l: string) => _LINHAS_GALP2.has(l) },
    { label: 'Galpão 3', fn: (l: string) => _LINHAS_GALP3.has(l) },
  ];
  return grupos.map(({ label, fn }) => ({
    label,
    horas:    ativos.filter(r => fn(r.linha)).reduce((s, r) => s + r.horas,      0),
    horasReg: pontos.filter(r => fn(r.linha)).reduce((s, r) => s + r.horasPonto, 0),
    qtdAtiv:  ativos.filter(r => fn(r.linha)).reduce((s, r) => s + r.qtdAtiv,    0),
    qtdPonto: pontos.filter(r => fn(r.linha)).reduce((s, r) => s + r.qtdPonto,   0),
  }));
}

/* ── Série diária de OPE ───────────────────────────────────── */
type _DailyPoint = { data: string; ope: number | null };

function _gerarDiasMes(mes: number, ano: number): string[] {
  const ultimo = new Date(ano, mes, 0).getDate();
  return Array.from({ length: ultimo }, (_, i) =>
    `${String(i + 1).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`
  );
}

function _buildDailySeries(
  ativos: _RawAtivRow[],
  pontos: _RawPontoRow[],
  filtroAtiv:  (r: _RawAtivRow)  => boolean,
  filtroPonto: (r: _RawPontoRow) => boolean,
  mes: number,
  ano: number,
): _DailyPoint[] {
  return _gerarDiasMes(mes, ano).map(data => {
    const ha = ativos.filter(r => filtroAtiv(r)  && r.data === data).reduce((s, r) => s + r.horas,      0);
    const hp = pontos.filter(r => filtroPonto(r) && r.data === data).reduce((s, r) => s + r.horasPonto, 0);
    const hasData = ha > 0 || hp > 0;
    return { data, ope: hasData ? (hp > 0 ? parseFloat((ha / hp * 100).toFixed(1)) : 0) : null };
  });
}

const _GALP_OPCOES = [
  { label: 'Galpão 1', fn: (l: string) => _LINHAS_MAIORES.has(l) },
  { label: 'Galpão 2', fn: (l: string) => _LINHAS_GALP2.has(l)   },
  { label: 'Galpão 3', fn: (l: string) => _LINHAS_GALP3.has(l)   },
];

const _SETOR_OPCOES = [
  { label: 'Acab.',  sm: 'ACAB' },
  { label: 'Mont.',  sm: 'MONT' },
  { label: 'Marc.',  sm: 'MARC' },
  { label: 'Elét.',  sm: 'ELET' },
  { label: 'Lam.',   sm: 'LAM'  },
  { label: 'Reb.',   sm: 'REB'  },
];

function _OpeChart({ series }: { series: _DailyPoint[] }) {
  if (series.length === 0) {
    return <div className="flex items-center justify-center h-full text-[10px] text-slate-300">Sem dados</div>;
  }
  const tickFormatter = (v: string) => v.slice(0, 2);
  const opValues = series.map(s => s.ope).filter((v): v is number => v !== null);
  const max = Math.max(...opValues, 100);
  const yTicks = [0, 25, 50, 75, 100, ...(max > 100 ? [parseFloat(max.toFixed(1))] : [])];

  const data = series.map((pt, i) => {
    const janela = series.slice(Math.max(0, i - 4), i + 1).filter(p => p.ope !== null);
    const mm5 = janela.length > 0
      ? parseFloat((janela.reduce((s, p) => s + p.ope!, 0) / janela.length).toFixed(1))
      : null;
    return { ...pt, mm5 };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 4 }}>
        <XAxis
          dataKey="data"
          tickFormatter={tickFormatter}
          tick={{ fontSize: 9, fill: '#94a3b8' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, max]}
          ticks={yTicks}
          tick={{ fontSize: 9, fill: '#94a3b8' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}%`}
          width={40}
        />
        <Tooltip
          formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name === 'mm5' ? 'MM 5d' : 'OPE']}
          labelFormatter={(l) => `Data: ${l}`}
          contentStyle={{ fontSize: 11, padding: '4px 8px' }}
        />
        {[25, 50, 75, 100].map(v => (
          <ReferenceLine key={v} y={v} stroke="#cbd5e1" strokeDasharray="3 3" />
        ))}
        {max > 100 && <ReferenceLine y={max} stroke="#cbd5e1" strokeDasharray="3 3" />}
        <Line type="monotone" dataKey="ope" stroke="#6366f1" strokeWidth={1.5} dot={{ r: 2, fill: '#6366f1' }} activeDot={{ r: 4 }} />
        <Line type="monotone" dataKey="mm5" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="4 2" />
      </LineChart>
    </ResponsiveContainer>
  );
}

const _BADGE_CFG: Record<_KpiStatus, { label: string; cls: string }> = {
  ok:      { label: 'No Prazo', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  atencao: { label: 'Atenção',  cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  critico: { label: 'Crítico',  cls: 'bg-rose-50 text-rose-600 border border-rose-200' },
};

function _KpiCard({ titulo, valor, meta, status, delta, deltaUp, loading = false }: {
  titulo: string; valor: string | null; meta: string;
  status: _KpiStatus; delta: string; deltaUp: boolean; loading?: boolean;
}) {
  const { label, cls } = _BADGE_CFG[status];
  const deltaColor = status === 'ok' ? 'text-emerald-600' : status === 'atencao' ? 'text-amber-600' : 'text-rose-500';
  return (
    <div className="flex-1 min-w-[160px] rounded-2xl border border-slate-100 bg-white shadow-sm p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-slate-500 leading-snug font-medium">{titulo}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{label}</span>
      </div>
      <p className="text-[2rem] font-bold leading-none text-slate-900 tracking-tight">
        {loading ? <span className="text-slate-300 text-xl">…</span> : (valor ?? '—')}
      </p>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-[11px] text-slate-400">
          <span className="opacity-40">◎</span> Meta: {meta}
        </span>
        {delta && (
          <span className={`text-[11px] font-semibold ${deltaColor}`}>
            {deltaUp ? '↗' : '↘'}{delta}
          </span>
        )}
      </div>
    </div>
  );
}

function _OpeGalpaoCard({ rows, loading = false }: { rows: _AggRow[]; loading?: boolean }) {
  const barColor = (s: _KpiStatus) =>
    s === 'ok' ? 'bg-emerald-500' : s === 'atencao' ? 'bg-amber-400' : 'bg-rose-500';
  const textColor = (s: _KpiStatus) =>
    s === 'ok' ? 'text-emerald-600' : s === 'atencao' ? 'text-amber-600' : 'text-rose-500';
  const statusOpe = (pct: number): _KpiStatus =>
    pct >= _OPE_META_PCT ? 'ok' : pct >= _OPE_META_PCT - 10 ? 'atencao' : 'critico';

  return (
    <div className="w-full rounded-2xl border border-slate-100 bg-white shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">OPE por Galpão</span>
        <span className="text-[11px] text-slate-400 flex items-center gap-1">
          <span className="opacity-40">◎</span> Meta: {_OPE_META_PCT}%
        </span>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-20 h-3 rounded bg-slate-100 animate-pulse" />
              <div className="flex-1 h-5 rounded-full bg-slate-100 animate-pulse" />
              <span className="w-12 h-3 rounded bg-slate-100 animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map(row => {
            const pct    = row.horasReg > 0 ? row.horas / row.horasReg * 100 : null;
            const filled = pct !== null ? Math.min(pct, 100) : 0;
            const status = pct !== null ? statusOpe(pct) : 'atencao';
            const valStr = pct !== null ? `${pct.toFixed(1).replace('.', ',')}%` : '—';
            const isGeral = row.label === 'Geral';

            return (
              <div key={row.label} className="flex items-center gap-3">
                <span className={`w-20 shrink-0 text-[11px] text-right ${isGeral ? 'font-bold text-slate-700' : 'font-medium text-slate-500'}`}>
                  {row.label}
                </span>
                <div className="relative flex-1 h-5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barColor(status)}`}
                    style={{ width: `${filled}%` }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-px bg-slate-400/60"
                    style={{ left: `${_OPE_META_PCT}%` }}
                  />
                  <span
                    className={`absolute inset-y-0 flex items-center text-[11px] font-bold tabular-nums transition-all duration-500 ${
                      filled > 15 ? 'text-white right-auto' : `${textColor(status)} left-auto`
                    }`}
                    style={filled > 15 ? { left: `${filled - 2}%`, transform: 'translateX(-100%)' } : { left: `${filled + 2}%` }}
                  >
                    {valStr}
                  </span>
                </div>
                <span className="shrink-0 text-[10px] text-slate-400 w-8 text-right">100%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProducaoDetalhe({ mes, ano }: { mes: number; ano: number }) {
  const now = new Date();
  const [showDetalhamento, setShowDetalhamento] = useState(false);

  const periodoIni = useMemo(() =>
    `01/${String(mes).padStart(2, '0')}/${ano}`
  , [mes, ano]);

  const periodoFim = useMemo(() => {
    const diasNoMes = new Date(ano, mes, 0).getDate();
    const isMesAtual = mes === now.getMonth() + 1 && ano === now.getFullYear();
    const ultimoDia  = isMesAtual ? now.getDate() : diasNoMes;
    return `${String(ultimoDia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
  }, [mes, ano]);

  const [dadosAtiv,  setDadosAtiv]  = useState<_RawAtivRow[]>([]);
  const [dadosPonto, setDadosPonto] = useState<_RawPontoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [dadosBarcos, setDadosBarcos]     = useState<_RawBarcoRow[]>([]);
  const [loadingBarcos, setLoadingBarcos] = useState(false);

  const [galpoesSel, setGalpoesSel] = useState<string[]>([]);
  const [setoresSel, setSetoresSel] = useState<string[]>([]);

  const toggleGalpao = (label: string) =>
    setGalpoesSel(prev => prev.includes(label) ? prev.filter(x => x !== label) : [...prev, label]);
  const toggleSetor = (sm: string) =>
    setSetoresSel(prev => prev.includes(sm) ? prev.filter(x => x !== sm) : [...prev, sm]);

  useEffect(() => {
    setLoading(true);
    setErro(null);
    const queries = [_LINHAS_MAIORES_ARR, _LINHAS_MENORES_ARR].flatMap(linhas =>
      _SETORES_SQL.flatMap(setor => [
        obterReg(_buildSqlAtividades(periodoIni, periodoFim, linhas, setor)),
        obterReg(_buildSqlPonto(periodoIni, periodoFim, linhas, setor)),
      ])
    );
    Promise.all(queries)
      .then(results => {
        const ativos: _RawAtivRow[]  = [];
        const pontos: _RawPontoRow[] = [];
        for (let i = 0; i < results.length; i += 2) {
          results[i].forEach(r => ativos.push(_mapAtiv(r)));
          results[i + 1].forEach(r => pontos.push(_mapPonto(r)));
        }
        setDadosAtiv(ativos);
        setDadosPonto(pontos);
      })
      .catch((e) => setErro(`Falha ao carregar dados de OPE: ${e?.message ?? 'erro desconhecido'}`))
      .finally(() => setLoading(false));
  }, [periodoIni, periodoFim]);

  useEffect(() => {
    setLoadingBarcos(true);
    obterReg<Record<string, any>>(_buildSqlBarcosEntregues(mes, ano))
      .then(rows => setDadosBarcos(rows.map(r => ({
        chassi:    String(r['CHASSI']     ?? r['chassi']     ?? ''),
        linha:     String(r['LINHA']      ?? r['linha']      ?? ''),
        mes:       Number(r['MES']        ?? r['mes']        ?? 0),
        ano:       Number(r['ANO']        ?? r['ano']        ?? 0),
        pctConclu: Number(r['PCT_CONCLU'] ?? r['pct_conclu'] ?? 0),
      }))))
      .finally(() => setLoadingBarcos(false));
  }, [mes, ano]);

  const aderenciaKpi = useMemo(() => {
    const totBarcos    = dadosBarcos.filter(r => r.mes === mes && r.ano === ano).length;
    const totEntregues = dadosBarcos.reduce((s, r) => s + r.pctConclu / 100, 0);
    if (totBarcos === 0) return null;
    const pct  = totEntregues / totBarcos * 100;
    const meta = 95;
    const diff = pct - meta;
    const status: _KpiStatus =
      pct >= meta      ? 'ok' :
      pct >= meta - 10 ? 'atencao' : 'critico';
    return {
      valor:   `${pct.toFixed(1).replace('.', ',')}%`,
      status,
      delta:   `${Math.abs(diff).toFixed(1).replace('.', ',')}p.p.`,
      deltaUp: diff > 0,
    };
  }, [dadosBarcos, mes, ano]);

  const ope = useMemo(() => _agregarOpe(dadosAtiv, dadosPonto), [dadosAtiv, dadosPonto]);

  const opeKpi = useMemo(() => {
    const row = ope.find(o => o.label === 'Geral');
    if (!row || row.horasReg === 0) return null;
    const pct  = row.horas / row.horasReg * 100;
    const diff = pct - _OPE_META_PCT;
    const status: _KpiStatus =
      pct >= _OPE_META_PCT      ? 'ok' :
      pct >= _OPE_META_PCT - 10 ? 'atencao' : 'critico';
    return {
      valor:   `${pct.toFixed(1).replace('.', ',')}%`,
      status,
      delta:   `${Math.abs(diff).toFixed(1).replace('.', ',')}p.p.`,
      deltaUp: diff > 0,
    };
  }, [ope]);

  const seriesUnificada = useMemo(() => {
    const filtroLinha = (l: string) => {
      if (galpoesSel.length === 0) return true;
      return _GALP_OPCOES.filter(o => galpoesSel.includes(o.label)).some(o => o.fn(l));
    };
    const filtroSetor = (sm: string) => setoresSel.length === 0 || setoresSel.includes(sm);
    return _buildDailySeries(
      dadosAtiv, dadosPonto,
      r => filtroLinha(r.linha) && filtroSetor(r.setorMacro),
      r => filtroLinha(r.linha) && filtroSetor(r.setorMacro),
      mes, ano,
    );
  }, [dadosAtiv, dadosPonto, galpoesSel, setoresSel, mes, ano]);

  const btnCls = (active: boolean) =>
    `px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
      active ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
    }`;

  if (erro) {
    return (
      <div className="w-full rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">OPE por Galpão</span>
        <p className="mt-3 text-xs text-rose-500">{erro}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3 flex-wrap">
        <_KpiCard
          titulo="OPE Geral da Fábrica"
          valor={opeKpi?.valor ?? null}
          meta={`${_OPE_META_PCT}%`}
          status={opeKpi?.status ?? 'atencao'}
          delta={opeKpi?.delta ?? ''}
          deltaUp={opeKpi?.deltaUp ?? false}
          loading={loading}
        />
        <_KpiCard titulo="Aderência de Entrega de Embarcações" valor={aderenciaKpi?.valor ?? null} meta="95%" status={aderenciaKpi?.status ?? 'atencao'} delta={aderenciaKpi?.delta ?? ''} deltaUp={aderenciaKpi?.deltaUp ?? false} loading={loadingBarcos} />
        <_KpiCard titulo="Absenteísmo"                         valor={null} meta="3%"     status="atencao" delta="" deltaUp={false} />
        <_KpiCard titulo="Horas Extras"                        valor={null} meta="300 h"  status="atencao" delta="" deltaUp={false} />
      </div>
      <_OpeGalpaoCard rows={ope} loading={loading} />

      {showDetalhamento && <OpeDetalhamentoModal onClose={() => setShowDetalhamento(false)} />}

      {/* OPE diário */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col p-4 gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">OPE diário</span>
          <button
            onClick={() => setShowDetalhamento(true)}
            className="rounded-lg px-2.5 py-1 text-[10px] font-semibold text-indigo-500 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 transition-colors"
          >
            Detalhamento
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] font-semibold text-slate-400 mr-1">Galpão:</span>
            <button onClick={() => setGalpoesSel([])} className={btnCls(galpoesSel.length === 0)}>Geral</button>
            {_GALP_OPCOES.map(o => (
              <button key={o.label} onClick={() => toggleGalpao(o.label)} className={btnCls(galpoesSel.includes(o.label))}>
                {o.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] font-semibold text-slate-400 mr-1">Setor:</span>
            <button onClick={() => setSetoresSel([])} className={btnCls(setoresSel.length === 0)}>Todos</button>
            {_SETOR_OPCOES.map(o => (
              <button key={o.sm} onClick={() => toggleSetor(o.sm)} className={btnCls(setoresSel.includes(o.sm))}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[220px]">
          {loading ? (
            <div className="flex items-center justify-center h-full text-[10px] text-slate-300">Carregando...</div>
          ) : (
            <_OpeChart series={seriesUnificada} />
          )}
        </div>
      </div>
    </div>
  );
}
