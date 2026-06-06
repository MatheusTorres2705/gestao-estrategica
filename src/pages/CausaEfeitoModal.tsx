import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { saveCausa, updateCausa } from '@/services/causasService';
import type { Causa } from '@/types';
import { Cog, Users, Workflow, Package2, Wind, Gauge } from 'lucide-react';

type Categoria = Causa['categoria'];

const CATEGORIAS: { id: Categoria; label: string; icon: React.ElementType; cor: string }[] = [
  { id: '6M-maquina',       label: 'Máquina',       icon: Cog,      cor: 'text-blue-700 border-blue-200 bg-blue-50' },
  { id: '6M-mao-de-obra',   label: 'Mão de Obra',   icon: Users,    cor: 'text-emerald-700 border-emerald-200 bg-emerald-50' },
  { id: '6M-metodo',        label: 'Método',         icon: Workflow, cor: 'text-violet-700 border-violet-200 bg-violet-50' },
  { id: '6M-material',      label: 'Material',       icon: Package2, cor: 'text-amber-700 border-amber-200 bg-amber-50' },
  { id: '6M-meio-ambiente', label: 'Meio Ambiente',  icon: Wind,     cor: 'text-teal-700 border-teal-200 bg-teal-50' },
  { id: '6M-medicao',       label: 'Medição',        icon: Gauge,    cor: 'text-rose-700 border-rose-200 bg-rose-50' },
];

type Props = {
  indicadorId: string;
  indicadorNome: string;
  analiseId?: string;
  causa?: Causa;
  onClose: () => void;
  onSaved: (causa: Causa) => void;
};

export function CausaEfeitoModal({ indicadorId, indicadorNome, analiseId = '', causa, onClose, onSaved }: Props) {
  const editMode = Boolean(causa);

  const [titulo, setTitulo] = useState(causa?.titulo ?? '');
  const [categoria, setCategoria] = useState<Categoria | null>(causa?.categoria ?? null);
  const [descricao, setDescricao] = useState(causa?.descricao ?? '');
  const [responsavel, setResponsavel] = useState(causa?.responsavel ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSave = async () => {
    if (!titulo || !categoria || !responsavel) {
      setErr('Preencha todos os campos obrigatórios.');
      return;
    }
    setSaving(true);
    try {
      if (editMode && causa) {
        await updateCausa(causa.id, causa.analiseId, { titulo, categoria, descricao, responsavel });
        onSaved({ ...causa, titulo, categoria, descricao, responsavel });
      } else {
        const nova = await saveCausa({ analiseId, indicadorId, problema: '', titulo, categoria, descricao, responsavel });
        onSaved(nova);
      }
    } catch {
      setErr('Erro ao salvar causa.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editMode ? 'Editar Causa' : 'Nova Causa'}</DialogTitle>
          <p className="text-sm text-gray-500 mt-1">{indicadorNome}</p>
        </DialogHeader>

        <div className="px-6 space-y-5">
          {/* Título da causa */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Título da Causa *
            </label>
            <Input
              placeholder="Ex: Falta de manutenção preventiva"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>

          {/* Categoria 6M */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Categoria da Causa (6M) *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIAS.map(({ id, label, icon: Icon, cor }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCategoria(id)}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-left transition-all text-xs font-medium
                    ${categoria === id ? cor : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Detalhamento */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Detalhamento <span className="normal-case font-normal text-gray-400">(opcional)</span>
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva com mais detalhes a causa identificada..."
              rows={3}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
            />
          </div>

          {/* Responsável */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Responsável *
            </label>
            <Input
              placeholder="Nome do responsável"
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
            />
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
            {saving ? 'Salvando…' : editMode ? 'Salvar Alterações' : 'Salvar Causa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
