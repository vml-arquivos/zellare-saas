import { useState } from 'react';
import {
  Sparkles,
  Loader2,
  Copy,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Package,
  ListChecks,
  Heart,
  Camera,
} from 'lucide-react';
import {
  gerarAtividade,
  type GerarAtividadeDto,
  type AtividadeGerada,
  type FaixaEtaria,
  type TipoAtividade,
  LABELS_FAIXA_ETARIA,
  LABELS_TIPO_ATIVIDADE,
} from '../../api/ia-assistiva';

interface Props {
  /** Dados fixos da Sequência Piloto — NÃO editáveis pelo professor */
  campoDeExperiencia: string;
  objetivoBNCC: string;
  objetivoCurriculo: string;
  faixaEtariaPadrao?: FaixaEtaria;
  matrizEntradaId?: string;
  onAtividadeGerada?: (atividade: AtividadeGerada) => void;
}

export function GeradorAtividadeIA({
  campoDeExperiencia,
  objetivoBNCC,
  objetivoCurriculo,
  faixaEtariaPadrao = 'EI03',
  matrizEntradaId,
  onAtividadeGerada,
}: Props) {
  const [faixaEtaria, setFaixaEtaria] = useState<FaixaEtaria>(faixaEtariaPadrao);
  const [tipoAtividade, setTipoAtividade] = useState<TipoAtividade | ''>('');
  const [numeroCriancas, setNumeroCriancas] = useState<number | ''>('');
  const [contextoAdicional, setContextoAdicional] = useState('');
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [atividade, setAtividade] = useState<AtividadeGerada | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [expandido, setExpandido] = useState(true);
  const modoAberto = !campoDeExperiencia.trim() && !objetivoBNCC.trim();

  const handleGerar = async () => {
    setGerando(true);
    setErro(null);
    setAtividade(null);
    try {
      const dto: GerarAtividadeDto = {
        campoDeExperiencia,
        objetivoBNCC,
        objetivoCurriculo,
        faixaEtaria,
        tipoAtividade: tipoAtividade || undefined,
        numeroCriancas: numeroCriancas ? Number(numeroCriancas) : undefined,
        contextoAdicional: contextoAdicional || undefined,
        matrizEntradaId,
      };
      const resultado = await gerarAtividade(dto);
      setAtividade(resultado);
      onAtividadeGerada?.(resultado);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : 'Erro ao gerar atividade. Tente novamente.';
      setErro(msg);
    } finally {
      setGerando(false);
    }
  };

  const handleCopiar = async () => {
    if (!atividade) return;
    const texto = `
# ${atividade.titulo}

**Campo de Experiência:** ${atividade.campoDeExperiencia}
**Objetivo BNCC:** ${atividade.objetivoBNCC}
**Objetivo Currículo em Movimento:** ${atividade.objetivoCurriculo}
**Faixa Etária:** ${atividade.faixaEtaria}
**Duração:** ${atividade.duracao}

## Descrição
${atividade.descricao}

## Intencionalidade
${atividade.intencionalidade}

## Materiais
${atividade.materiais.map((m) => `- ${m}`).join('\n')}

## Etapas
${atividade.etapas.join('\n')}

## Adaptações
${atividade.adaptacoes}

## Registro Sugerido
${atividade.registroSugerido}
    `.trim();
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="ds-card rounded-xl overflow-hidden">
      {/* Cabeçalho */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-[var(--surface-subtle)] transition-colors"
        onClick={() => setExpandido(!expandido)}
      >
        <div className="flex items-center gap-2">
          <div className="ds-icon-tile rounded-lg">
            <Sparkles className="h-4 w-4 text-[var(--text-brand-soft)]" />
          </div>
          <div>
            <h3 className="text-sm font-normal text-[var(--text-primary)]">
              Gerar Atividade com Inteligência Artificial
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              {modoAberto
                ? 'A IA sugere uma atividade por faixa etária e contexto'
                : 'A IA cria a atividade alinhada ao objetivo do dia'}
            </p>
          </div>
        </div>
        {expandido ? (
          <ChevronUp className="h-4 w-4 text-[var(--text-tertiary)]" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[var(--text-tertiary)]" />
        )}
      </div>

      {expandido && (
        <div className="p-4 border-t border-[var(--border-subtle)] space-y-4">
          {/* Contexto curricular: somente leitura quando existe; em modo aberto,
              a ausência da matriz fica explícita e não vira referência inventada. */}
          <div className="ds-alert ds-alert-warning rounded-lg p-3 space-y-2">
            <p className="text-xs font-normal text-[var(--warning)] uppercase tracking-wide">
              {modoAberto ? 'Planejamento aberto — sem objetivo curricular cadastrado' : 'Dados curriculares — não editáveis'}
            </p>
            <div className="space-y-1">
              {modoAberto ? (
                <p className="text-xs text-[var(--text-secondary)]">
                  A sugestão será criada apenas com base na faixa etária, no tipo de atividade e no contexto informado. A IA não atribui códigos ou referências oficiais.
                </p>
              ) : (
                <>
                  <p className="text-xs text-[var(--text-secondary)]">
                    <span className="font-normal text-[var(--text-primary)]">Campo de Experiência:</span>{' '}
                    {campoDeExperiencia}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    <span className="font-normal text-[var(--text-primary)]">Objetivo BNCC:</span>{' '}
                    {objetivoBNCC}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    <span className="font-normal text-[var(--text-primary)]">Objetivo Currículo DF:</span>{' '}
                    {objetivoCurriculo || 'Não informado pela instituição'}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Configurações da atividade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-normal text-[var(--text-primary)] mb-1">
                Faixa Etária da Turma
              </label>
              <select
                value={faixaEtaria}
                onChange={(e) => setFaixaEtaria(e.target.value as FaixaEtaria)}
                className="ds-input w-full px-3 py-2 text-sm focus:outline-none"
              >
                {(Object.entries(LABELS_FAIXA_ETARIA) as [FaixaEtaria, string][]).map(
                  ([val, label]) => (
                    <option key={val} value={val}>
                      {val} — {label}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-normal text-[var(--text-primary)] mb-1">
                Tipo de Atividade (opcional)
              </label>
              <select
                value={tipoAtividade}
                onChange={(e) =>
                  setTipoAtividade(e.target.value as TipoAtividade | '')
                }
                className="ds-input w-full px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">A IA escolhe o melhor tipo</option>
                {(
                  Object.entries(LABELS_TIPO_ATIVIDADE) as [
                    TipoAtividade,
                    string,
                  ][]
                ).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-normal text-[var(--text-primary)] mb-1">
                Número de Crianças (opcional)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={numeroCriancas}
                onChange={(e) =>
                  setNumeroCriancas(
                    e.target.value ? Number(e.target.value) : '',
                  )
                }
                placeholder="Ex: 15"
                className="ds-input w-full px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-normal text-[var(--text-primary)] mb-1">
                Contexto Adicional (opcional)
              </label>
              <input
                type="text"
                value={contextoAdicional}
                onChange={(e) => setContextoAdicional(e.target.value)}
                placeholder="Ex: crianças agitadas, poucos materiais..."
                className="ds-input w-full px-3 py-2 text-sm focus:outline-none"
              />
            </div>
          </div>

          {/* Botão de geração */}
          <button
            onClick={handleGerar}
            disabled={gerando}
            className="ds-btn-primary w-full flex items-center justify-center gap-2 px-4 py-3 text-sm disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {gerando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando atividade com IA...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Gerar Atividade com IA
              </>
            )}
          </button>

          {/* Erro */}
          {erro && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{erro}</p>
            </div>
          )}

          {/* Resultado */}
          {atividade && (
            <div className="space-y-4 border-t border-purple-100 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <h4 className="text-sm font-semibold text-gray-800">
                    {atividade.titulo}
                  </h4>
                </div>
                <button
                  onClick={handleCopiar}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {copiado ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copiar tudo
                    </>
                  )}
                </button>
              </div>

              <p className="text-sm text-gray-700">{atividade.descricao}</p>

              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-800 mb-1">
                  Intencionalidade Pedagógica
                </p>
                <p className="text-sm text-blue-900">{atividade.intencionalidade}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Materiais */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                    <Package className="h-3.5 w-3.5" />
                    Materiais
                  </p>
                  <ul className="space-y-1">
                    {atividade.materiais.map((m, i) => (
                      <li key={i} className="text-xs text-gray-700 flex items-start gap-1">
                        <span className="text-gray-400 mt-0.5">•</span>
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Duração */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Duração Estimada
                  </p>
                  <p className="text-sm text-gray-700">{atividade.duracao}</p>
                </div>
              </div>

              {/* Etapas */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                  <ListChecks className="h-3.5 w-3.5" />
                  Etapas da Atividade
                </p>
                <ol className="space-y-1.5">
                  {atividade.etapas.map((etapa, i) => (
                    <li key={i} className="text-xs text-gray-700">
                      {etapa}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Adaptações */}
              <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                <p className="text-xs font-semibold text-green-800 mb-1 flex items-center gap-1">
                  <Heart className="h-3.5 w-3.5" />
                  Adaptações para Necessidades Especiais
                </p>
                <p className="text-xs text-green-900">{atividade.adaptacoes}</p>
              </div>

              {/* Registro */}
              <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
                <p className="text-xs font-semibold text-orange-800 mb-1 flex items-center gap-1">
                  <Camera className="h-3.5 w-3.5" />
                  Registro Sugerido
                </p>
                <p className="text-xs text-orange-900">{atividade.registroSugerido}</p>
              </div>

              {/* Aviso de IA */}
              <p className="text-xs text-gray-400 text-center">
                Conteúdo gerado por Inteligência Artificial. Revise antes de aplicar.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
