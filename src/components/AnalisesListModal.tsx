import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Fish, ChevronRight, Calendar, User, X, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAnalises, saveAnalise } from '@/services/analisesService';
import type { Analise } from '@/types';

type Props = {
  indicadorId: string;
  indicadorNome: string;
  mes: number;
  ano: number;
  onClose: () => void;
};

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function fmtData(iso: string) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export function AnalisesListModal({ indicadorId, indicadorNome, mes, ano, onClose }: Props) {
  const nav = useNavigate();
  const [analises, setAnalises] = useState<Analise[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [problema, setProblema] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = () =>
    getAnalises(indicadorId, mes, ano).then(setAnalises);

  useEffect(() => { load(); }, [indicadorId, mes, ano]);

  const handleSave = async () => {
    if (!problema.trim() || !responsavel.trim()) {
      setErr('Preencha o desvio e o responsável.');
      return;
    }
    setSaving(true);
    try {
      const nova = await saveAnalise({ indicadorId, problema, responsavel, dataCriacao: new Date().toISOString().split('T')[0], mes, ano });
      onClose();
      nav(`/ishikawa/${nova.id}`);
    } catch {
      setErr('Erro ao salvar análise.');
    } finally {
      setSaving(false);
    }
  };

  const openAnalise = (id: string) => {
    onClose();
    nav(`/ishikawa/${id}`);
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center shrink-0">
              <Fish className="h-4 w-4 text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle>Análises de Ishikawa</DialogTitle>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {indicadorNome} — {MESES[mes - 1]}/{ano}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 pb-2 space-y-4">
          {/* List */}
          {analises.length === 0 && !showForm ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                <Fish className="h-6 w-6 text-gray-300" />
              </div>
              <p className="text-sm text-gray-500">Nenhuma análise registrada para este período.</p>
              <p className="text-xs text-gray-400">Clique em "Nova Análise" para começar.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {analises.map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => openAnalise(a.id)}
                    className="w-full flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left hover:border-blue-300 hover:bg-blue-50/40 transition-all group"
                  >
                    <div className="h-8 w-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center shrink-0">
                      <Fish className="h-4 w-4 text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 leading-snug truncate">
                        {a.problema}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <User className="h-3 w-3" />{a.responsavel}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Calendar className="h-3 w-3" />{fmtData(a.dataCriacao)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Inline new analysis form */}
          {showForm && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-blue-700">Nova Análise</p>
                <button
                  onClick={() => { setShowForm(false); setErr(null); }}
                  className="rounded p-0.5 text-blue-400 hover:text-blue-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Desvio / Problema *
                </label>
                <textarea
                  value={problema}
                  onChange={(e) => setProblema(e.target.value)}
                  placeholder="Ex: Gate G3 abaixo da meta (81%)"
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Responsável *
                </label>
                <Input
                  placeholder="Nome do responsável"
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value)}
                />
              </div>

              {err && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  <p className="text-xs text-red-600">{err}</p>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Button onClick={handleSave} disabled={saving} className="flex-1">
                  {saving ? 'Criando…' : 'Criar e Abrir Diagrama'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 pt-3 pb-4 border-t border-gray-100">
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          {!showForm && (
            <Button onClick={() => { setShowForm(true); setErr(null); }}>
              <Plus className="h-4 w-4" />
              Nova Análise
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
