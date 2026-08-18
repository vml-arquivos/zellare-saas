import { useEffect, useMemo, useState } from 'react';
import { FileText, ShieldCheck, Copy, CheckCircle2, RefreshCw, Plus, Info } from 'lucide-react';
import { PageShell } from '../components/ui/PageShell';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import {
  cloneRdicProfile,
  createRdicProfile,
  listRdicProfiles,
  setDefaultRdicProfile,
  type CreateRdicProfileInput,
  type RdicDocumentProfile,
  type RdicInstitutionType,
} from '../api/rdic-profiles';

const institutionLabels: Record<RdicInstitutionType, string> = {
  PUBLICA: 'Instituição pública',
  PRIVADA: 'Escola particular',
  REDE_PUBLICA: 'Rede pública',
  OUTRA: 'Outra instituição',
};

const periodicityLabels: Record<string, string> = {
  SEMESTRAL: 'Semestral',
  TRIMESTRAL: 'Trimestral',
  BIMESTRAL: 'Bimestral',
  ANUAL: 'Anual',
  CONFIGURAVEL: 'Configurável',
};

function errorMessage(error: any, fallback: string) {
  const message = error?.response?.data?.message;
  return Array.isArray(message) ? message.join(', ') : message || fallback;
}

export default function RdicProfilesPage() {
  const [profiles, setProfiles] = useState<RdicDocumentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateRdicProfileInput>({
    code: '',
    name: '',
    documentLabel: '',
    institutionType: 'PRIVADA',
    periodicity: 'SEMESTRAL',
    authorityName: '',
    authorityReference: '',
    curriculumReference: '',
    sourceUrl: '',
  });

  async function loadProfiles() {
    setLoading(true);
    try {
      const data = await listRdicProfiles();
      setProfiles(data);
      if (!selectedId && data[0]) setSelectedId(data[0].id);
    } catch (error) {
      toast.error(errorMessage(error, 'Não foi possível carregar os perfis documentais.'));
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadProfiles(); }, []);

  const curated = useMemo(() => profiles.filter((profile) => profile.isCurated), [profiles]);
  const tenantProfiles = useMemo(() => profiles.filter((profile) => !profile.isCurated), [profiles]);
  const selected = profiles.find((profile) => profile.id === selectedId);

  async function clone(profile: RdicDocumentProfile) {
    setSaving(true);
    try {
      const created = await cloneRdicProfile(profile.id);
      toast.success(`Perfil ${created.name} criado para a mantenedora.`);
      await loadProfiles();
      setSelectedId(created.id);
    } catch (error) {
      toast.error(errorMessage(error, 'Não foi possível clonar o perfil.'));
    } finally {
      setSaving(false);
    }
  }

  async function defineDefault() {
    if (!selectedId) return;
    setSaving(true);
    try {
      await setDefaultRdicProfile(selectedId);
      toast.success('Perfil padrão da mantenedora atualizado. Novos RDICs usarão este perfil.');
    } catch (error) {
      toast.error(errorMessage(error, 'Não foi possível definir o perfil padrão.'));
    } finally {
      setSaving(false);
    }
  }

  async function createProfile() {
    if (!form.code.trim() || !form.name.trim() || !form.documentLabel.trim()) {
      toast.error('Código, nome e rótulo do documento são obrigatórios.');
      return;
    }
    setSaving(true);
    try {
      const created = await createRdicProfile({
        ...form,
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        documentLabel: form.documentLabel.trim(),
        authorityName: form.authorityName?.trim() || undefined,
        authorityReference: form.authorityReference?.trim() || undefined,
        curriculumReference: form.curriculumReference?.trim() || undefined,
        sourceUrl: form.sourceUrl?.trim() || undefined,
      });
      toast.success('Perfil institucional criado.');
      setShowCreate(false);
      setForm({ code: '', name: '', documentLabel: '', institutionType: 'PRIVADA', periodicity: 'SEMESTRAL', authorityName: '', authorityReference: '', curriculumReference: '', sourceUrl: '' });
      await loadProfiles();
      setSelectedId(created.id);
    } catch (error) {
      toast.error(errorMessage(error, 'Não foi possível criar o perfil.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell title="Perfis Documentais" subtitle="Configure como cada rede ou instituição transforma evidências em documentos oficiais de desenvolvimento">
      <div className="space-y-6">
        <Card className="border-blue-100 bg-blue-50/60">
          <CardContent className="p-5 flex gap-3">
            <Info className="h-5 w-5 text-blue-700 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-950">
              <p className="font-semibold">O RDIC não é universal para todas as instituições.</p>
              <p className="mt-1 text-blue-900/80">O Zelare mantém perfis oficiais curados, como o modelo da SEEDF, e permite que cada mantenedora clone ou crie seu próprio relatório. Alterar o perfil não modifica documentos já criados: cada instância guarda a versão utilizada.</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Catálogo disponível</h2>
            <p className="text-sm text-slate-500">Perfis públicos são referências; perfis próprios podem ser definidos como padrão.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void loadProfiles()} disabled={loading || saving}><RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Atualizar</Button>
            <Button onClick={() => setShowCreate((value) => !value)}><Plus className="h-4 w-4 mr-2" />Novo perfil institucional</Button>
          </div>
        </div>

        {showCreate && (
          <Card>
            <CardContent className="p-5 space-y-4">
              <div><h3 className="font-semibold text-slate-900">Criar perfil próprio</h3><p className="text-xs text-slate-500 mt-1">Use o nome e as regras do regimento, sistema de ensino ou rede da instituição. A validade oficial deve ser conferida pela própria entidade.</p></div>
              <div className="grid md:grid-cols-3 gap-4">
                <div><Label>Código *</Label><Input className="mt-1" value={form.code} placeholder="ESCOLA_RELATORIO_2026" onChange={(event) => setForm((value) => ({ ...value, code: event.target.value }))} /></div>
                <div><Label>Nome do perfil *</Label><Input className="mt-1" value={form.name} placeholder="Relatório da Escola" onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} /></div>
                <div><Label>Rótulo do documento *</Label><Input className="mt-1" value={form.documentLabel} placeholder="Relatório Descritivo" onChange={(event) => setForm((value) => ({ ...value, documentLabel: event.target.value }))} /></div>
                <div><Label>Tipo de instituição</Label><select className="mt-1 w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.institutionType} onChange={(event) => setForm((value) => ({ ...value, institutionType: event.target.value as RdicInstitutionType }))}><option value="PRIVADA">Escola particular</option><option value="PUBLICA">Instituição pública</option><option value="REDE_PUBLICA">Rede pública</option><option value="OUTRA">Outra</option></select></div>
                <div><Label>Periodicidade</Label><select className="mt-1 w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.periodicity} onChange={(event) => setForm((value) => ({ ...value, periodicity: event.target.value }))}><option value="SEMESTRAL">Semestral</option><option value="TRIMESTRAL">Trimestral</option><option value="BIMESTRAL">Bimestral</option><option value="ANUAL">Anual</option><option value="CONFIGURAVEL">Configurável</option></select></div>
                <div><Label>Autoridade ou sistema</Label><Input className="mt-1" value={form.authorityName} placeholder="Mantenedora / Secretaria" onChange={(event) => setForm((value) => ({ ...value, authorityName: event.target.value }))} /></div>
                <div className="md:col-span-2"><Label>Referência curricular</Label><Input className="mt-1" value={form.curriculumReference} placeholder="BNCC, currículo municipal, sistema de ensino ou proposta própria" onChange={(event) => setForm((value) => ({ ...value, curriculumReference: event.target.value }))} /></div>
                <div><Label>URL da norma/modelo</Label><Input className="mt-1" value={form.sourceUrl} placeholder="https://..." onChange={(event) => setForm((value) => ({ ...value, sourceUrl: event.target.value }))} /></div>
              </div>
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button><Button onClick={() => void createProfile()} disabled={saving}>{saving ? 'Salvando...' : 'Criar perfil'}</Button></div>
            </CardContent>
          </Card>
        )}

        {loading ? <div className="py-12 text-center text-sm text-slate-500">Carregando perfis reais da mantenedora...</div> : profiles.length === 0 ? <Card><CardContent className="p-8 text-center text-sm text-slate-500">Nenhum perfil retornado pela API.</CardContent></Card> : (
          <div className="grid xl:grid-cols-2 gap-4">
            {profiles.map((profile) => (
              <Card key={profile.id} className={`transition-shadow ${selectedId === profile.id ? 'ring-2 ring-blue-500' : ''}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3"><div className={`p-2 rounded-xl ${profile.isCurated ? 'bg-emerald-50 text-emerald-700' : 'bg-violet-50 text-violet-700'}`}><FileText className="h-5 w-5" /></div><div><h3 className="font-semibold text-slate-900">{profile.name}</h3><p className="text-xs text-slate-500 font-mono mt-1">{profile.code} · v{profile.version}</p></div></div>
                    <span className={`text-[11px] rounded-full px-2 py-1 font-semibold ${profile.isCurated ? 'bg-emerald-100 text-emerald-800' : 'bg-violet-100 text-violet-800'}`}>{profile.isCurated ? 'Curado' : 'Mantenedora'}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-slate-400">Instituição</p><p className="font-medium text-slate-700">{institutionLabels[profile.institutionType]}</p></div><div><p className="text-xs text-slate-400">Periodicidade</p><p className="font-medium text-slate-700">{periodicityLabels[profile.periodicity] || profile.periodicity}</p></div><div className="col-span-2"><p className="text-xs text-slate-400">Documento</p><p className="font-medium text-slate-700">{profile.documentLabel}</p></div></div>
                  {profile.authorityName && <p className="mt-3 text-xs text-slate-500">Fonte/autoridade: <span className="font-medium text-slate-700">{profile.authorityName}</span></p>}
                  <div className="mt-4 flex flex-wrap gap-2"><Button variant={selectedId === profile.id ? 'default' : 'outline'} size="sm" onClick={() => setSelectedId(profile.id)}><CheckCircle2 className="h-4 w-4 mr-1" />Selecionar</Button>{profile.isCurated && <Button variant="outline" size="sm" onClick={() => void clone(profile)} disabled={saving}><Copy className="h-4 w-4 mr-1" />Clonar e adaptar</Button>}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="border-slate-200"><CardContent className="p-5 flex flex-wrap items-center justify-between gap-4"><div><p className="font-semibold text-slate-900">Perfil padrão para novos RDICs</p><p className="text-sm text-slate-500 mt-1">{selected ? `${selected.documentLabel} · ${institutionLabels[selected.institutionType]}` : 'Selecione um perfil acima'}</p></div><Button onClick={() => void defineDefault()} disabled={!selectedId || saving}><ShieldCheck className="h-4 w-4 mr-2" />Definir como padrão</Button></CardContent></Card>

        <div className="text-xs text-slate-500 space-y-1"><p><strong>Perfis curados:</strong> são referências documentais incorporadas pela plataforma e não substituem validação do órgão competente.</p><p><strong>Escola particular:</strong> deve configurar seu próprio nome, sistema de ensino, proposta pedagógica, regras de assinatura e arquivamento.</p><p><strong>Documentos históricos:</strong> ficam protegidos pelo snapshot da versão utilizada no momento da criação.</p></div>
      </div>
    </PageShell>
  );
}
