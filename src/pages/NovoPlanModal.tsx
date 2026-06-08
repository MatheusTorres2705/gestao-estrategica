import { useState } from 'react';
import { GitBranch } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { savePlanoAcao, updatePlanoAcao } from '@/services/planosAcaoService';
import { mockIndicadores } from '@/data/mockIndicadores';
import type { PlanoAcao } from '@/types';

type Props = {
  onClose: () => void;
  onSaved: () => void;
  indicadorId?: string;
  causaDefault?: string;
  causaId?: string;
  analiseId?: string;
  plano?: PlanoAcao;
};

export function NovoPlanModal({
  onClose,
  onSaved,
  indicadorId: indIdProp,
  causaDefault = '',
  causaId,
  analiseId,
  plano,
}: Props) {
  const editMode = Boolean(plano);

  const [acao, setAcao] = useState(plano?.acao ?? '');
  const [responsavel, setResponsavel] = useState(plano?.responsavel ?? '');
  const [area, setArea] = useState(plano?.area ?? '');
  const [causa] = useState(causaDefault);
  const [indicadorId, setIndicadorId] = useState(plano?.indicadorId ?? indIdProp ?? '');
  const [prazo, setPrazo] = useState(plano?.prazo ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // When opened from Ishikawa, indicador and causa are fixed
  const fromIshikawa = Boolean(causaId) && !editMode;
  const indicadorNome = mockIndicadores.find((i) => i.id === indicadorId)?.nome;

  const handleSave = async () => {
    if (!acao || !responsavel || !area || !prazo || !indicadorId) {
      setErr('Preencha todos os campos obrigatórios.');
      return;
    }
    setSaving(true);
    try {
      if (editMode && plano) {
        await updatePlanoAcao(plano.id, { acao, responsavel, area, prazo, indicadorId });
      } else {
        await savePlanoAcao({
          acao, responsavel, area, causa, indicadorId, prazo,
          causaId, analiseId,
          status: 'pendente', progresso: 0,
        });
      }
      onSaved();
    } catch {
      setErr('Erro ao salvar plano.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editMode ? 'Editar Plano de Ação' : 'Novo Plano de Ação'}</DialogTitle>
        </DialogHeader>

        <div className="px-6 space-y-4">
          {/* Causa de origem (read-only quando vem do Ishikawa) */}
          {fromIshikawa && causa && (
            <div className="flex items-start gap-2.5 rounded-xl border border-orange-200 bg-orange-50 px-3 py-3">
              <GitBranch className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-orange-700 uppercase tracking-wider mb-0.5">
                  Causa de origem
                </p>
                <p className="text-sm text-orange-800 leading-snug">{causa}</p>
              </div>
            </div>
          )}

          {/* Ação */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Ação *</label>
            <textarea
              value={acao}
              onChange={(e) => setAcao(e.target.value)}
              placeholder="Descreva a ação a ser executada..."
              rows={3}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Responsável *</label>
              <Input placeholder="Nome do responsável" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Área *</label>
              <Input placeholder="Ex: Qualidade, Produção..." value={area} onChange={(e) => setArea(e.target.value)} />
            </div>
          </div>

          {/* Indicador — readonly quando vem do Ishikawa */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Indicador *</label>
            {fromIshikawa ? (
              <div className="h-9 flex items-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700">
                {indicadorNome ?? indicadorId}
              </div>
            ) : (
              <select
                value={indicadorId}
                onChange={(e) => setIndicadorId(e.target.value)}
                className="w-full h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="">Selecione...</option>
                {mockIndicadores.map((i) => (
                  <option key={i.id} value={i.id}>{i.nome}</option>
                ))}
              </select>
            )}
          </div>

          {/* Prazo */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Prazo *</label>
            <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </div>

          {err && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-xs text-red-600">{err}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : editMode ? 'Salvar Alterações' : 'Criar Plano'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
