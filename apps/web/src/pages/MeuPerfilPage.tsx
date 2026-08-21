import { useState, useEffect } from 'react';
import { ProfileAvatarUploader } from '../components/profile/ProfileAvatarUploader';
import { PageShell } from '../components/ui/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import http from '../api/http';
import {
  User, Mail, Phone, Lock, Eye, EyeOff, CheckCircle,
  RefreshCw, Camera, Shield, Bell, Palette, Globe,
  Key, AlertCircle, Edit3, Save, X, Building2,
  GraduationCap, Crown, Briefcase, Stethoscope,
} from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  DEVELOPER: 'Desenvolvedor do Sistema',
  MANTENEDORA_ADMIN: 'Administrador — Mantenedora',
  MANTENEDORA_FINANCEIRO: 'Financeiro — Mantenedora',
  STAFF_CENTRAL_PEDAGOGICO: 'Coordenação Pedagógica Geral',
  STAFF_CENTRAL_PSICOLOGIA: 'Psicóloga Central',
  UNIDADE_DIRETOR: 'Diretor(a) de Unidade',
  UNIDADE_COORDENADOR_PEDAGOGICO: 'Coordenação Pedagógica',
  UNIDADE_ADMINISTRATIVO: 'Secretaria / Administrativo',
  UNIDADE_NUTRICIONISTA: 'Nutricionista',
  PROFESSOR: 'Professor(a)',
  PROFESSOR_AUXILIAR: 'Professor(a) Auxiliar',
};

interface Perfil {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  cpf?: string;
  status: string;
  emailVerified: boolean;
  lastLogin?: string;
  createdAt: string;
  roles?: Array<{ roleType: string }>;
  unit?: { name: string; unitCode: string };
}

export default function MeuPerfilPage() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [editandoDados, setEditandoDados] = useState(false);
  const [editandoSenha, setEditandoSenha] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [fotoUrl, setFotoUrl] = useState<string | undefined>(undefined);

  const [formDados, setFormDados] = useState({ firstName: '', lastName: '', phone: '' });
  const [formEmail, setFormEmail] = useState({ email: '', senha: '' });
  const [formSenha, setFormSenha] = useState({ senhaAtual: '', novaSenha: '', confirmar: '' });

  useEffect(() => { loadPerfil(); }, []);

  async function loadPerfil() {
    setLoading(true);
    try {
      const res = await http.get('/auth/me');
      // FIX: GET /auth/me retorna { user: {...} } — desempacotar antes de usar
      const d = res.data?.user ?? res.data;
      setPerfil(d);
      setFotoUrl(d.photoUrl || d.photo || undefined);
      setFormDados({ firstName: d.firstName, lastName: d.lastName, phone: d.phone || '' });
      setFormEmail({ email: d.email, senha: '' });
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        toast.error('Sessão expirada. Faça login novamente.');
        setTimeout(() => { window.location.replace('/login'); }, 1500);
      } else {
        toast.error('Não foi possível carregar seu perfil. Verifique sua conexão.');
      }
    } finally { setLoading(false); }
  }

  async function salvarDados() {
    if (!formDados.firstName.trim() || !formDados.lastName.trim()) { toast.error('Nome e sobrenome são obrigatórios'); return; }
    setSalvando(true);
    try {
      await http.put('/auth/me', { firstName: formDados.firstName.trim(), lastName: formDados.lastName.trim(), phone: formDados.phone });
      setPerfil(prev => prev ? { ...prev, ...formDados } : prev);
      toast.success('Dados atualizados com sucesso!');
      setEditandoDados(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao atualizar dados');
    } finally { setSalvando(false); }
  }

  async function salvarEmail() {
    if (!formEmail.email.trim()) { toast.error('E-mail é obrigatório'); return; }
    if (!formEmail.senha) { toast.error('Confirme sua senha atual para alterar o e-mail'); return; }
    setSalvando(true);
    try {
      await http.put('/auth/me/email', { email: formEmail.email.trim().toLowerCase(), currentPassword: formEmail.senha });
      setPerfil(prev => prev ? { ...prev, email: formEmail.email, emailVerified: false } : prev);
      toast.success('E-mail atualizado! Verifique sua caixa de entrada.');
      setFormEmail(f => ({ ...f, senha: '' }));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao atualizar e-mail');
    } finally { setSalvando(false); }
  }

  async function salvarSenha() {
    if (!formSenha.senhaAtual) { toast.error('Informe a senha atual'); return; }
    if (!formSenha.novaSenha) { toast.error('Informe a nova senha'); return; }
    if (formSenha.novaSenha.length < 6) { toast.error('Nova senha deve ter pelo menos 6 caracteres'); return; }
    if (formSenha.novaSenha !== formSenha.confirmar) { toast.error('As senhas não coincidem'); return; }
    setSalvando(true);
    try {
      await http.put('/auth/me/password', { currentPassword: formSenha.senhaAtual, newPassword: formSenha.novaSenha });
      toast.success('Senha alterada com sucesso!');
      setFormSenha({ senhaAtual: '', novaSenha: '', confirmar: '' });
      setEditandoSenha(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Senha atual incorreta');
    } finally { setSalvando(false); }
  }

  if (loading) return (
    <PageShell title="Meu Perfil">
      <div className="flex items-center justify-center py-20"><RefreshCw className="h-8 w-8 text-blue-500 animate-spin" /></div>
    </PageShell>
  );

  if (!perfil) return null;

  // FIX: backend retorna roles[0].type (não roleType) — tolerar ambos os formatos
  const roleAtual = (perfil.roles?.[0] as any)?.type || (perfil.roles?.[0] as any)?.roleType || '';
  const nomeCompleto = `${perfil.firstName ?? ''} ${perfil.lastName ?? ''}`.trim();

  return (
    <PageShell title="Meu Perfil" subtitle="Gerencie suas informações pessoais e configurações de acesso">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Card de identidade */}
        <Card className="ds-card overflow-hidden">
          <div className="h-24 bg-[var(--surface-topbar)] border-b border-[var(--border-subtle)]" />
          <CardContent className="pt-0 pb-5">
            <div className="flex items-end gap-4 -mt-10 mb-4">
              <div>
                <ProfileAvatarUploader
                  name={nomeCompleto}
                  photoUrl={fotoUrl}
                  size="md"
                  editable={false}
                />
              </div>
              <div className="flex-1 pb-1">
                <h2 className="text-xl font-normal text-[var(--text-primary)]">{nomeCompleto}</h2>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  {roleAtual && (
                    <span className="ds-badge-brand inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs">
                      <GraduationCap className="h-3 w-3" /> {ROLE_LABELS[roleAtual] || roleAtual}
                    </span>
                  )}
                  {perfil.unit && (
                    <span className="ds-badge-green inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs">
                      <Building2 className="h-3 w-3" /> {perfil.unit.name}
                    </span>
                  )}
                  {perfil.emailVerified && (
                    <span className="ds-badge-green inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs">
                      <CheckCircle className="h-3 w-3" /> E-mail verificado
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-[var(--text-secondary)]"><Mail className="h-4 w-4" /> {perfil.email}</div>
              {perfil.phone && <div className="flex items-center gap-2 text-[var(--text-secondary)]"><Phone className="h-4 w-4" /> {perfil.phone}</div>}
              {perfil.lastLogin && <div className="flex items-center gap-2 text-[var(--text-secondary)]"><Shield className="h-4 w-4" /> Último acesso: {new Date(perfil.lastLogin).toLocaleDateString('pt-BR')}</div>}
              <div className="flex items-center gap-2 text-[var(--text-secondary)]"><User className="h-4 w-4" /> Membro desde {new Date(perfil.createdAt).toLocaleDateString('pt-BR')}</div>
            </div>
          </CardContent>
        </Card>

        {/* Dados Pessoais */}
        <Card className="ds-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-normal flex items-center gap-2"><User className="h-4 w-4 text-[var(--text-brand-soft)]" /> Dados Pessoais</CardTitle>
              {!editandoDados && (
                <Button size="sm" variant="outline" onClick={() => setEditandoDados(true)} className="h-8 text-xs">
                  <Edit3 className="h-3 w-3 mr-1" /> Editar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {editandoDados ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-normal text-[var(--text-primary)]">Nome</Label>
                    <Input className="mt-1" value={formDados.firstName} onChange={e => setFormDados(f => ({ ...f, firstName: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-sm font-normal text-[var(--text-primary)]">Sobrenome</Label>
                    <Input className="mt-1" value={formDados.lastName} onChange={e => setFormDados(f => ({ ...f, lastName: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-normal text-[var(--text-primary)]">Telefone</Label>
                  <div className="relative mt-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)]" />
                    <Input className="pl-9" placeholder="(00) 00000-0000" value={formDados.phone} onChange={e => setFormDados(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditandoDados(false)} className="flex items-center gap-1"><X className="h-3 w-3" /> Cancelar</Button>
                  <Button size="sm" onClick={salvarDados} disabled={salvando} className="ds-btn-primary flex items-center gap-1">
                    {salvando ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Salvar
                  </Button>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-[var(--text-tertiary)] text-xs">Nome</p><p className="font-normal text-[var(--text-primary)]">{perfil.firstName}</p></div>
                <div><p className="text-[var(--text-tertiary)] text-xs">Sobrenome</p><p className="font-normal text-[var(--text-primary)]">{perfil.lastName}</p></div>
                <div><p className="text-[var(--text-tertiary)] text-xs">Telefone</p><p className="font-normal text-[var(--text-primary)]">{perfil.phone || '—'}</p></div>
                <div><p className="text-[var(--text-tertiary)] text-xs">CPF</p><p className="font-normal text-[var(--text-primary)]">{perfil.cpf || '—'}</p></div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* E-mail */}
        <Card className="ds-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-normal flex items-center gap-2"><Mail className="h-4 w-4 text-[var(--text-brand-soft)]" /> Endereço de E-mail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-normal text-[var(--text-primary)]">E-mail atual</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)]" />
                <Input className="pl-9" type="email" value={formEmail.email} onChange={e => setFormEmail(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            {formEmail.email !== perfil.email && (
              <div>
                <Label className="text-sm font-normal text-[var(--text-primary)]">Confirme sua senha para alterar o e-mail</Label>
                <div className="relative mt-1">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)]" />
                  <Input className="pl-9" type="password" placeholder="Sua senha atual" value={formEmail.senha} onChange={e => setFormEmail(f => ({ ...f, senha: e.target.value }))} />
                </div>
                <Button size="sm" onClick={salvarEmail} disabled={salvando} className="mt-2 ds-btn-primary">
                  {salvando ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />} Salvar Novo E-mail
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Senha */}
        <Card className="ds-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-normal flex items-center gap-2"><Lock className="h-4 w-4 text-[var(--text-brand-soft)]" /> Segurança — Senha</CardTitle>
              {!editandoSenha && (
                <Button size="sm" variant="outline" onClick={() => setEditandoSenha(true)} className="h-8 text-xs">
                  <Key className="h-3 w-3 mr-1" /> Alterar Senha
                </Button>
              )}
            </div>
          </CardHeader>
          {editandoSenha && (
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-normal text-[var(--text-primary)]">Senha Atual</Label>
                <div className="relative mt-1">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)]" />
                  <Input className="pl-9 pr-9" type={mostrarSenha ? 'text' : 'password'} placeholder="Sua senha atual" value={formSenha.senhaAtual} onChange={e => setFormSenha(f => ({ ...f, senhaAtual: e.target.value }))} />
                  <button onClick={() => setMostrarSenha(!mostrarSenha)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
                    {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-normal text-[var(--text-primary)]">Nova Senha</Label>
                  <Input className="mt-1" type="password" placeholder="Mínimo 6 caracteres" value={formSenha.novaSenha} onChange={e => setFormSenha(f => ({ ...f, novaSenha: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-sm font-normal text-[var(--text-primary)]">Confirmar Nova Senha</Label>
                  <Input className="mt-1" type="password" placeholder="Repita a nova senha" value={formSenha.confirmar} onChange={e => setFormSenha(f => ({ ...f, confirmar: e.target.value }))} />
                  {formSenha.novaSenha && formSenha.confirmar && formSenha.novaSenha !== formSenha.confirmar && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Senhas não coincidem</p>
                  )}
                </div>
              </div>

              {/* Indicador de força */}
              {formSenha.novaSenha && (
                <div>
                  <div className="flex gap-1 mt-1">
                    {[1, 2, 3, 4].map(n => (
                      <div key={n} className={`h-1.5 flex-1 rounded-full transition-all ${
                        formSenha.novaSenha.length >= n * 3
                          ? n <= 1 ? 'bg-[var(--error)]' : n <= 2 ? 'bg-[var(--warning)]' : n <= 3 ? 'bg-[var(--accent-cyan)]' : 'bg-[var(--success)]'
                          : 'bg-[var(--surface-muted)]'
                      }`} />
                    ))}
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">
                    {formSenha.novaSenha.length < 6 ? 'Muito curta' : formSenha.novaSenha.length < 9 ? 'Fraca' : formSenha.novaSenha.length < 12 ? 'Média' : 'Forte'}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setEditandoSenha(false); setFormSenha({ senhaAtual: '', novaSenha: '', confirmar: '' }); }}>
                  <X className="h-3 w-3 mr-1" /> Cancelar
                </Button>
                <Button size="sm" onClick={salvarSenha} disabled={salvando} className="ds-btn-primary">
                  {salvando ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />} Salvar Nova Senha
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Informações do sistema */}
        <Card className="ds-card">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-normal text-[var(--text-tertiary)] uppercase tracking-wide mb-3">Informações do Sistema</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-[var(--text-tertiary)]">ID do usuário</p><p className="font-mono text-xs text-[var(--text-secondary)]">{perfil.id}</p></div>
              <div><p className="text-xs text-[var(--text-tertiary)]">Status</p><p className="text-[var(--success)] font-normal text-xs">{perfil.status}</p></div>
              <div><p className="text-xs text-[var(--text-tertiary)]">Perfil de acesso</p><p className="text-[var(--text-secondary)] text-xs">{ROLE_LABELS[roleAtual] || roleAtual}</p></div>
              <div><p className="text-xs text-[var(--text-tertiary)]">Unidade</p><p className="text-[var(--text-secondary)] text-xs">{perfil.unit?.name || 'Acesso global'}</p></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
