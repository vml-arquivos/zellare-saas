import { useEffect, useState } from 'react';
import { X, User, Heart, AlertTriangle, Phone, FileText, Baby } from 'lucide-react';
import http from '../../api/http';
import { resolveChildPhotoUrl } from './ChildAvatar';

interface ChildInfoModalProps {
  childId: string;
  onClose: () => void;
}

function calcularIdade(dob: string): string {
  if (!dob) return '—';
  const hoje = new Date();
  const nasc = new Date(dob);
  const meses = (hoje.getFullYear() - nasc.getFullYear()) * 12 + (hoje.getMonth() - nasc.getMonth());
  if (meses < 12) return `${meses} meses`;
  const anos = Math.floor(meses / 12);
  const m = meses % 12;
  return m > 0 ? `${anos} anos e ${m} meses` : `${anos} anos`;
}

function Campo({ label, valor }: { label: string; valor?: string | null }) {
  if (!valor) return null;
  return (
    <div>
      <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-[var(--text-primary)]">{valor}</p>
    </div>
  );
}

export function ChildInfoModal({ childId, onClose }: ChildInfoModalProps) {
  const [child, setChild] = useState<any>(null);
  const [restricoes, setRestricoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [childRes, restricoesRes] = await Promise.all([
          http.get(`/children/${childId}`),
          http.get(`/children/${childId}/dietary-restrictions`),
        ]);
        setChild(childRes.data);
        setRestricoes(Array.isArray(restricoesRes.data) ? restricoesRes.data : []);
      } catch { /* silencioso */ }
      finally { setLoading(false); }
    }
    load();
  }, [childId]);

  const nomeSexo = child?.gender === 'MASCULINO' ? 'Masculino' : child?.gender === 'FEMININO' ? 'Feminino' : 'Não informado';
  const fotoUrl = resolveChildPhotoUrl(child);
  const nome = `${child?.firstName ?? ''} ${child?.lastName ?? ''}`.trim();

  return (
    <>
      <div className="ds-modal-backdrop" onClick={onClose} aria-hidden="true" />

      <div className="fixed inset-x-0 bottom-0 z-50 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="child-info-title"
          className="ds-modal rounded-t-2xl sm:rounded-2xl max-w-md w-full max-h-[90vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          <div className="bg-[var(--brand-600)] rounded-t-2xl px-6 pt-8 pb-6 flex flex-col items-center gap-3 relative flex-shrink-0">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white/80 hover:text-white w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 transition"
              aria-label="Fechar ficha da criança"
            >
              <X className="h-5 w-5" />
            </button>

            {loading ? (
              <div className="w-20 h-20 rounded-full bg-white/20 ring-4 ring-white/40 flex items-center justify-center">
                <span className="text-white/70 text-xs">Carregando</span>
              </div>
            ) : fotoUrl ? (
              <img
                src={fotoUrl}
                alt={nome || 'Criança'}
                className="w-20 h-20 rounded-full object-cover ring-4 ring-white/80 shadow-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-white text-2xl font-bold ring-4 ring-white/40">
                {child?.firstName?.[0]}{child?.lastName?.[0]}
              </div>
            )}

            <p id="child-info-title" className="font-display text-xl font-semibold text-white text-center leading-tight">
              {loading ? 'Carregando...' : nome}
            </p>

            {child?.codigoAluno && (
              <p className="text-sm text-white/80 text-center">
                Cód. {child.codigoAluno} · Insc. {child.inscricao ?? '—'}
              </p>
            )}
          </div>

          {loading ? (
            <div className="p-8 text-center text-[var(--text-tertiary)] text-sm flex-1">Carregando ficha...</div>
          ) : (
            <div className="ds-modal-body px-5 py-4 max-h-[60vh] space-y-5 flex-1">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Baby className="h-4 w-4 text-[var(--brand-600)]" />
                  <p className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wide">Identificação</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Campo
                    label="Data de Nascimento"
                    valor={child?.dateOfBirth
                      ? `${new Date(child.dateOfBirth).toLocaleDateString('pt-BR')} (${calcularIdade(child.dateOfBirth)})`
                      : null}
                  />
                  <Campo label="Sexo" valor={nomeSexo} />
                  <Campo label="Tipagem Sanguínea" valor={child?.bloodType} />
                  <Campo label="Raça/Cor" valor={child?.raca} />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-4 w-4 text-[var(--text-brand-soft)]" />
                  <p className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wide">Família e Contatos</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Nome da Mãe" valor={child?.nomeMae} />
                  <Campo label="Nome do Pai" valor={child?.nomePai} />
                  <Campo label="Contato de Emergência" valor={child?.emergencyContactName} />
                  {child?.celPai && <Campo label="Telefone do Pai" valor={child.celPai} />}
                </div>
                {child?.emergencyContactPhone && (
                  <div className="mt-3 flex items-center gap-2 bg-[var(--success-bg)] border border-[var(--success-border)] text-[var(--success)] rounded-xl px-3 py-2 text-sm font-semibold">
                    <Phone className="h-4 w-4 flex-shrink-0" />
                    {child.emergencyContactPhone}
                  </div>
                )}
              </div>

              {(child?.laudado || child?.tipoLaudo || child?.descricaoLaudo || child?.medicamentos || child?.cid) && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4 text-[var(--warning)]" />
                    <p className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wide">Laudos e Necessidades Especiais</p>
                    {child?.laudado && (
                      <span className="ml-auto text-xs bg-[var(--warning-bg)] text-[var(--warning)] border border-[var(--warning-border)] px-2 py-0.5 rounded-full font-medium">
                        Laudado
                      </span>
                    )}
                  </div>
                  <div className="bg-[var(--warning-bg)] border border-[var(--warning-border)] rounded-xl p-3 space-y-1">
                    {child?.cid && (
                      <span className="inline-block bg-[var(--surface-card)] text-[var(--warning)] border border-[var(--warning-border)] text-xs rounded-full px-2 py-0.5 font-medium">
                        CID: {child.cid}
                      </span>
                    )}
                    {child?.tipoLaudo && <p className="text-sm text-[var(--warning)]">{child.tipoLaudo}</p>}
                    {child?.descricaoLaudo && <p className="text-sm text-[var(--warning)]">{child.descricaoLaudo}</p>}
                    {child?.medicamentos && <p className="text-xs text-[var(--warning)]">Medicamentos: {child.medicamentos}</p>}
                  </div>
                </div>
              )}

              {(child?.allergies || restricoes.filter(r => r.isActive).length > 0) && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-[var(--error)]" />
                    <p className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wide">Alergias e Restrições Alimentares</p>
                  </div>
                  <div className="space-y-2">
                    {child?.allergies && (
                      <div className="bg-[var(--error-bg)] border border-[var(--error-border)] rounded-xl p-3">
                        <p className="text-sm text-[var(--error)] font-medium">{child.allergies}</p>
                      </div>
                    )}
                    {restricoes.filter(r => r.isActive).map((r: any) => (
                      <div key={r.id} className="bg-[var(--error-bg)] border border-[var(--error-border)] rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm text-[var(--error)] font-medium">{r.name}</p>
                          {r.severity && (
                            <span className={`text-xs rounded-full px-2 py-0.5 font-medium border ${
                              r.severity === 'severa' ? 'bg-[var(--error-bg)] text-[var(--error)] border-[var(--error-border)]' :
                              r.severity === 'moderada' ? 'bg-[var(--warning-bg)] text-[var(--warning)] border-[var(--warning-border)]' :
                              'bg-[var(--surface-inset)] text-[var(--text-secondary)] border-[var(--border-default)]'
                            }`}>{r.severity}</span>
                          )}
                        </div>
                        {r.description && <p className="text-xs text-[var(--error)] mt-0.5">{r.description}</p>}
                        {r.forbiddenFoods && <p className="text-xs text-[var(--error)] mt-1">Alimentos restritos: {r.forbiddenFoods}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {child?.medicalConditions && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Heart className="h-4 w-4 text-[var(--info)]" />
                    <p className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wide">Condições Médicas</p>
                  </div>
                  <div className="bg-[var(--info-bg)] border border-[var(--info-border)] rounded-xl p-3">
                    <p className="text-sm text-[var(--info)]">{child.medicalConditions}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="ds-modal-footer px-5 pb-5 pt-2 flex-shrink-0">
            <button
              onClick={onClose}
              className="w-full h-11 bg-[var(--surface-inset)] text-[var(--text-secondary)] border border-[var(--border-default)] rounded-xl font-medium hover:bg-[var(--surface-muted)] transition"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
