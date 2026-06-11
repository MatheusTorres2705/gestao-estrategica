import { useEffect, useRef, useMemo } from 'react';
import { X, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import type { PcmItem, PcmCounts } from '@/services/pcmService';

const BG     = '#0B0F17';
const PANEL  = '#121826';
const BORDER = '#1F2937';
const TEXT   = '#F3F4F6';
const MUTED  = '#9CA3AF';
const COR = {
  semPrevisao: '#FBBF24',
  atrasado:    '#F87171',
  emDia:       '#34D399',
} as const;

const MES_NOME = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

interface Props {
  mes: number;
  ano: number;
  counts: PcmCounts | null;
  itens: PcmItem[];
  totalChassis: number;
  onClose: () => void;
}

export function PcmPresentationMode({ mes, ano, counts, itens, totalChassis, onClose }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  const chassisList = useMemo(() => {
    const map = new Map<string, { chassi: string; semPrevisao: number; atrasado: number }>();
    for (const it of itens) {
      if (it.categoria === 'em-dia') continue;
      if (!map.has(it.chassi)) map.set(it.chassi, { chassi: it.chassi, semPrevisao: 0, atrasado: 0 });
      const g = map.get(it.chassi)!;
      if (it.categoria === 'sem-previsao') g.semPrevisao++;
      else g.atrasado++;
    }
    return Array.from(map.values())
      .sort((a, b) => (b.semPrevisao + b.atrasado) - (a.semPrevisao + a.atrasado));
  }, [itens]);

  const topProdutos = useMemo(() => {
    const map = new Map<string, { descrprod: string; semPrevisao: number; atrasado: number; emDia: number; chassisSet: Set<string> }>();
    for (const it of itens) {
      if (!map.has(it.descrprod)) map.set(it.descrprod, { descrprod: it.descrprod, semPrevisao: 0, atrasado: 0, emDia: 0, chassisSet: new Set() });
      const g = map.get(it.descrprod)!;
      if (it.categoria === 'sem-previsao') g.semPrevisao++;
      else if (it.categoria === 'atrasado') g.atrasado++;
      else g.emDia++;
      g.chassisSet.add(it.chassi);
    }
    return Array.from(map.values())
      .map(g => ({ ...g, chassisCount: g.chassisSet.size }))
      .sort((a, b) => (b.semPrevisao + b.atrasado) - (a.semPrevisao + a.atrasado))
      .slice(0, 10);
  }, [itens]);

  const topFornecedores = useMemo(() => {
    const map = new Map<string, { nomeparc: string; semPrevisao: number; atrasado: number; emDia: number }>();
    for (const it of itens) {
      const k = it.nomeparc || 'Sem fornecedor';
      if (!map.has(k)) map.set(k, { nomeparc: k, semPrevisao: 0, atrasado: 0, emDia: 0 });
      const g = map.get(k)!;
      if (it.categoria === 'sem-previsao') g.semPrevisao++;
      else if (it.categoria === 'atrasado') g.atrasado++;
      else g.emDia++;
    }
    return Array.from(map.values())
      .sort((a, b) => (b.semPrevisao + b.atrasado) - (a.semPrevisao + a.atrasado))
      .slice(0, 10);
  }, [itens]);

  useEffect(() => {
    const el = rootRef.current;
    el?.requestFullscreen?.().catch(() => {});
    function onFsChange() {
      if (!document.fullscreenElement) onClose();
    }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [onClose]);

  function sair() {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else onClose();
  }

  const semPrevisao = counts?.semPrevisao ?? 0;
  const atrasado    = counts?.atrasado    ?? 0;
  const emDia       = counts?.emDia       ?? 0;
  const total       = semPrevisao + atrasado + emDia;
  const pctSem      = total ? (semPrevisao / total) * 100 : 0;
  const pctAt       = total ? (atrasado    / total) * 100 : 0;
  const pctEm       = total ? (emDia       / total) * 100 : 0;
  const emRisco     = chassisList.length;
  const subtitle    = `${MES_NOME[mes - 1]} de ${ano}`;
  const maxProd     = Math.max(...topProdutos.map(p => p.chassisCount), 1);
  const maxForn     = Math.max(...topFornecedores.map(f => f.semPrevisao + f.atrasado + f.emDia), 1);

  return (
    <div ref={rootRef} className="fixed inset-0 z-[100] flex flex-col" style={{ background: BG, color: TEXT }}>

      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-6 pb-4 shrink-0">
        <div className="flex items-baseline gap-3">
          <span className="font-bold tracking-tight" style={{ fontSize: 'clamp(20px,2vw,34px)' }}>
            PCM · Faltas do Mês
          </span>
          <span style={{ fontSize: 'clamp(11px,1vw,16px)', color: MUTED }}>{subtitle}</span>
        </div>
        <button
          onClick={sair}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
          style={{ background: PANEL, border: `1px solid ${BORDER}`, fontSize: 'clamp(12px,1vw,16px)', color: TEXT }}
        >
          <X className="w-4 h-4" /> Sair
        </button>
      </div>

      {/* Hero strip */}
      <div className="px-8 pb-5 shrink-0 flex flex-col gap-4">
        <div className="flex items-baseline gap-4 flex-wrap">
          <span
            className="font-bold tracking-tight"
            style={{ fontSize: 'clamp(28px,3vw,52px)', color: emRisco > 0 ? COR.semPrevisao : COR.emDia }}
          >
            {emRisco > 0
              ? `${emRisco} ${emRisco === 1 ? 'chassi' : 'chassis'} em risco`
              : 'Nenhum chassi em risco'}
          </span>
          <span style={{ fontSize: 'clamp(16px,1.6vw,26px)', color: MUTED }}>
            de {totalChassis} em produção · {semPrevisao} itens sem previsão
          </span>
        </div>

        <div className="flex gap-4">
          {([
            { icon: <AlertTriangle className="w-[1em] h-[1em]" />, label: 'Sem previsão', value: semPrevisao, cor: COR.semPrevisao },
            { icon: <Clock        className="w-[1em] h-[1em]" />, label: 'Atrasado',     value: atrasado,    cor: COR.atrasado    },
            { icon: <CheckCircle2 className="w-[1em] h-[1em]" />, label: 'Em dia',        value: emDia,       cor: COR.emDia       },
          ]).map(({ icon, label, value, cor }) => (
            <div key={label} className="flex-1 rounded-2xl px-6 py-4 flex flex-col gap-1"
              style={{ background: PANEL, border: `1px solid ${BORDER}` }}>
              <div className="flex items-center gap-2 font-medium" style={{ color: cor, fontSize: 'clamp(13px,1.2vw,20px)' }}>
                {icon} {label}
              </div>
              <span className="font-bold leading-none tabular-nums"
                style={{ color: cor, fontSize: 'clamp(40px,6vw,90px)' }}>
                {value}
              </span>
            </div>
          ))}
        </div>

        <div className="flex h-3 rounded-full overflow-hidden gap-px" style={{ background: BORDER }}>
          {pctSem > 0 && <div style={{ width: `${pctSem}%`, background: COR.semPrevisao }} />}
          {pctAt  > 0 && <div style={{ width: `${pctAt}%`,  background: COR.atrasado    }} />}
          {pctEm  > 0 && <div style={{ width: `${pctEm}%`,  background: COR.emDia       }} />}
        </div>
      </div>

      {/* 3 panels */}
      <div className="flex-1 min-h-0 grid grid-cols-3 gap-4 px-8 pb-8">

        {/* Chassis em risco */}
        <div className="rounded-2xl flex flex-col overflow-hidden" style={{ background: PANEL, border: `1px solid ${BORDER}` }}>
          <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
            <span className="font-semibold" style={{ fontSize: 'clamp(14px,1.3vw,22px)', color: TEXT }}>Chassis em risco</span>
            <span className="font-bold tabular-nums" style={{ fontSize: 'clamp(14px,1.3vw,22px)', color: COR.semPrevisao }}>{emRisco}</span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-1.5">
            {chassisList.map(c => {
              const cor = c.semPrevisao > 0 ? COR.semPrevisao : COR.atrasado;
              return (
                <div key={c.chassi} className="rounded-xl px-3 py-2 flex items-center justify-between gap-2"
                  style={{ background: cor + '15', border: `1px solid ${BORDER}` }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cor }} />
                    <span className="font-bold truncate" style={{ fontSize: 'clamp(12px,1.1vw,18px)', color: TEXT }}>{c.chassi}</span>
                  </div>
                  <div className="shrink-0">
                    <span className="font-bold tabular-nums" style={{ fontSize: 'clamp(15px,1.4vw,24px)', color: TEXT }}>
                      {c.semPrevisao + c.atrasado}
                    </span>
                    <span style={{ fontSize: '0.6em', color: MUTED }}> faltam</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top produtos */}
        <div className="rounded-2xl flex flex-col overflow-hidden" style={{ background: PANEL, border: `1px solid ${BORDER}` }}>
          <div className="px-5 pt-4 pb-2 shrink-0">
            <span className="font-semibold" style={{ fontSize: 'clamp(14px,1.3vw,22px)', color: TEXT }}>Top 10 produtos em falta</span>
            <p style={{ fontSize: 'clamp(10px,0.9vw,14px)', color: MUTED }}>por nº de chassis impactados</p>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-3 flex flex-col gap-2.5">
            {topProdutos.map((p, i) => {
              const tot  = p.semPrevisao + p.atrasado + p.emDia;
              const pctS = tot ? (p.semPrevisao / tot) * 100 : 0;
              const pctA = tot ? (p.atrasado    / tot) * 100 : 0;
              const pctE = tot ? (p.emDia       / tot) * 100 : 0;
              const barW = (p.chassisCount / maxProd) * 100;
              return (
                <div key={p.descrprod}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="truncate" style={{ fontSize: 'clamp(11px,1vw,16px)', color: TEXT }} title={p.descrprod}>
                      <span style={{ color: MUTED }}>{i + 1}.</span> {p.descrprod}
                    </span>
                    <span className="shrink-0 tabular-nums font-bold" style={{ fontSize: 'clamp(12px,1.1vw,18px)', color: TEXT }}>
                      {p.chassisCount} <span style={{ fontSize: '0.7em', color: MUTED, fontWeight: 400 }}>chassis</span>
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: BORDER }}>
                    <div className="h-full flex" style={{ width: `${barW}%` }}>
                      {pctS > 0 && <div style={{ width: `${pctS}%`, background: COR.semPrevisao }} />}
                      {pctA > 0 && <div style={{ width: `${pctA}%`, background: COR.atrasado    }} />}
                      {pctE > 0 && <div style={{ width: `${pctE}%`, background: COR.emDia       }} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top fornecedores */}
        <div className="rounded-2xl flex flex-col overflow-hidden" style={{ background: PANEL, border: `1px solid ${BORDER}` }}>
          <div className="px-5 pt-4 pb-2 shrink-0">
            <span className="font-semibold" style={{ fontSize: 'clamp(14px,1.3vw,22px)', color: TEXT }}>Top 10 fornecedores</span>
            <p style={{ fontSize: 'clamp(10px,0.9vw,14px)', color: MUTED }}>por itens em falta (sem previsão + atraso primeiro)</p>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-3 flex flex-col gap-2.5">
            {topFornecedores.map((f, i) => {
              const tot  = f.semPrevisao + f.atrasado + f.emDia;
              const pctS = tot ? (f.semPrevisao / tot) * 100 : 0;
              const pctA = tot ? (f.atrasado    / tot) * 100 : 0;
              const pctE = tot ? (f.emDia       / tot) * 100 : 0;
              const barW = (tot / maxForn) * 100;
              return (
                <div key={f.nomeparc}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="truncate" style={{ fontSize: 'clamp(11px,1vw,16px)', color: TEXT }} title={f.nomeparc}>
                      <span style={{ color: MUTED }}>{i + 1}.</span> {f.nomeparc}
                    </span>
                    <span className="shrink-0 tabular-nums font-bold" style={{ fontSize: 'clamp(12px,1.1vw,18px)', color: TEXT }}>
                      {tot} <span style={{ fontSize: '0.7em', color: MUTED, fontWeight: 400 }}>itens</span>
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: BORDER }}>
                    <div className="h-full flex" style={{ width: `${barW}%` }}>
                      {pctS > 0 && <div style={{ width: `${pctS}%`, background: COR.semPrevisao }} />}
                      {pctA > 0 && <div style={{ width: `${pctA}%`, background: COR.atrasado    }} />}
                      {pctE > 0 && <div style={{ width: `${pctE}%`, background: COR.emDia       }} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
