import { useState } from 'react';
import { MICROGESTO_CATALOGO, MICROGESTO_POR_CATEGORIA, CATEGORIA_LABELS } from '../../constants/microgestos.constants';

interface Props {
  criancas: Array<{ id: string; firstName: string; lastName: string }>;
  classroomId: string;
  data: string;
  onRegistrar: (registro: {
    childIds: string[];
    categoria: string;
    microgestoId: string;
    nivel: string;
    descricao?: string;
    campoExperiencia?: string;
    context?: string;
    opportunity?: string;
    support?: string;
    response?: string;
    teacherConcern?: boolean;
    abc?: {
      antecedent?: string;
      behavior: string;
      consequence?: string;
      intensity?: number;
      frequency?: number;
    };
  }) => void;
}

export function QuickMicrogestoPanel({ criancas, classroomId, data, onRegistrar }: Props) {
  const [categoriaSel, setCategoriaSel] = useState<string>('');
  const [microgestoSel, setMicrogestoSel] = useState<string>('');
  const [nivelSel, setNivelSel] = useState<string>('');
  const [criancasSel, setCriancasSel] = useState<string[]>([]);
  const [descricao, setDescricao] = useState('');
  const [contexto, setContexto] = useState('LIVRE');
  const [oportunidade, setOportunidade] = useState('OBSERVADA');
  const [suporte, setSuporte] = useState('NENHUM');
  const [resposta, setResposta] = useState('NAO_CONCLUSIVO');
  const [preocupacao, setPreocupacao] = useState(false);
  const [usarAbc, setUsarAbc] = useState(false);
  const [abcAntecedente, setAbcAntecedente] = useState('');
  const [abcComportamento, setAbcComportamento] = useState('');
  const [abcConsequencia, setAbcConsequencia] = useState('');
  const [abcIntensidade, setAbcIntensidade] = useState('');

  const microgestosCategoria = categoriaSel
    ? (MICROGESTO_POR_CATEGORIA[categoriaSel] ?? [])
    : [];
  const microgestoAtual = MICROGESTO_CATALOGO.find(m => m.id === microgestoSel);

  function toggleCrianca(id: string) {
    setCriancasSel(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  }

  function handleRegistrar() {
    if (!microgestoSel || !nivelSel || criancasSel.length === 0) return;
    onRegistrar({
      childIds: criancasSel,
      categoria: categoriaSel,
      microgestoId: microgestoSel,
      nivel: nivelSel,
      descricao: descricao.trim() || undefined,
      context: contexto,
      opportunity: oportunidade,
      support: suporte,
      response: resposta,
      teacherConcern: preocupacao,
      ...(usarAbc && abcComportamento.trim() ? {
        abc: {
          antecedent: abcAntecedente.trim() || undefined,
          behavior: abcComportamento.trim(),
          consequence: abcConsequencia.trim() || undefined,
          intensity: abcIntensidade ? Number(abcIntensidade) : undefined,
        },
      } : {}),
    });
    setMicrogestoSel('');
    setNivelSel('');
    setCriancasSel([]);
    setDescricao('');
    setContexto('LIVRE');
    setOportunidade('OBSERVADA');
    setSuporte('NENHUM');
    setResposta('NAO_CONCLUSIVO');
    setPreocupacao(false);
    setUsarAbc(false);
    setAbcAntecedente('');
    setAbcComportamento('');
    setAbcConsequencia('');
    setAbcIntensidade('');
  }

  return (
    <div className="space-y-4">
      {/* PASSO 1: Categoria */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
          1. Área de Desenvolvimento
        </p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(CATEGORIA_LABELS).map(([key, val]) => (
            <button
              key={key}
              type="button"
              onClick={() => { setCategoriaSel(key); setMicrogestoSel(''); setNivelSel(''); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                categoriaSel === key
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300'
              }`}
            >
              {val.emoji} {val.label}
            </button>
          ))}
        </div>
      </div>

      {/* PASSO 2: Microgesto específico */}
      {categoriaSel && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
            2. Habilidade Observada
          </p>
          <div className="flex flex-wrap gap-2">
            {microgestosCategoria.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => { setMicrogestoSel(m.id); setNivelSel(''); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                  microgestoSel === m.id
                    ? 'bg-purple-600 border-purple-600 text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-purple-300'
                }`}
                title={m.desc}
              >
                {m.emoji} {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* PASSO 3: Nível */}
      {microgestoAtual && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
            3. Nível
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(microgestoAtual.niveis).map(([nivel, desc]) => {
              const cores: Record<string, string> = {
                ALCANCADO:         'bg-emerald-600 border-emerald-600 text-white',
                EM_DESENVOLVIMENTO: 'bg-amber-500 border-amber-500 text-white',
                REQUER_ATENCAO:    'bg-rose-500 border-rose-500 text-white',
              };
              const coresIdle: Record<string, string> = {
                ALCANCADO:         'border-emerald-200 text-emerald-700 hover:bg-emerald-50',
                EM_DESENVOLVIMENTO: 'border-amber-200 text-amber-700 hover:bg-amber-50',
                REQUER_ATENCAO:    'border-rose-200 text-rose-700 hover:bg-rose-50',
              };
              return (
                <button
                  key={nivel}
                  type="button"
                  onClick={() => setNivelSel(nivel)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                    nivelSel === nivel ? cores[nivel] : `bg-white ${coresIdle[nivel]}`
                  }`}
                  title={desc as string}
                >
                  {nivel === 'ALCANCADO' ? '✅' : nivel === 'EM_DESENVOLVIMENTO' ? '🟡' : '🔴'}{' '}
                  {desc as string}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* PASSO 4: Crianças */}
      {nivelSel && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
            4. Criança(s)
          </p>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
            {criancas.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCrianca(c.id)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                  criancasSel.includes(c.id)
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
                }`}
              >
                {c.firstName} {c.lastName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* PASSO 5: Contexto e resposta, em seleção rápida */}
      {criancasSel.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
            5. Contexto e suporte (rápido)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="text-xs text-gray-600">
              Contexto
              <select value={contexto} onChange={e => setContexto(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-2 text-sm bg-white">
                <option value="LIVRE">Atividade livre</option>
                <option value="RODA">Roda</option>
                <option value="TRANSICAO">Transição</option>
                <option value="BRINCADEIRA">Brincadeira</option>
                <option value="ATIVIDADE_DIRIGIDA">Atividade dirigida</option>
                <option value="REFEICAO">Refeição</option>
                <option value="HIGIENE">Higiene</option>
                <option value="REPOUSO">Repouso</option>
              </select>
            </label>
            <label className="text-xs text-gray-600">
              Oportunidade
              <select value={oportunidade} onChange={e => setOportunidade(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-2 text-sm bg-white">
                <option value="OBSERVADA">Foi observada</option>
                <option value="NAO_HOUVE_OPORTUNIDADE">Não houve oportunidade</option>
                <option value="RECUSA">Recusou a atividade</option>
                <option value="NAO_CONCLUSIVA">Não conclusiva</option>
              </select>
            </label>
            <label className="text-xs text-gray-600">
              Suporte oferecido
              <select value={suporte} onChange={e => setSuporte(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-2 text-sm bg-white">
                <option value="NENHUM">Nenhum</option>
                <option value="AVISO_VISUAL">Aviso visual</option>
                <option value="MODELAGEM">Modelagem</option>
                <option value="MEDIACAO_ADULTO">Mediação do adulto</option>
                <option value="PAUSA">Pausa</option>
                <option value="OUTRO">Outro</option>
              </select>
            </label>
            <label className="text-xs text-gray-600">
              Resposta da criança
              <select value={resposta} onChange={e => setResposta(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-2 text-sm bg-white">
                <option value="NAO_CONCLUSIVO">Não conclusiva</option>
                <option value="RESPONDEU_BEM">Respondeu bem</option>
                <option value="RESPONDEU_PARCIALMENTE">Respondeu parcialmente</option>
                <option value="NAO_RESPONDEU">Não respondeu</option>
              </select>
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={preocupacao} onChange={e => setPreocupacao(e.target.checked)} />
            Marcar para revisão da coordenação
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={usarAbc} onChange={e => setUsarAbc(e.target.checked)} />
            Registrar evento ABC detalhado
          </label>
          {usarAbc && (
            <div className="grid grid-cols-1 gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
              <input value={abcAntecedente} onChange={e => setAbcAntecedente(e.target.value)} maxLength={300} placeholder="O que aconteceu antes? (opcional)" className="rounded-lg border border-amber-200 px-2 py-2 text-sm" />
              <input value={abcComportamento} onChange={e => setAbcComportamento(e.target.value)} maxLength={500} placeholder="O que foi observado? (obrigatório)" className="rounded-lg border border-amber-200 px-2 py-2 text-sm" />
              <input value={abcConsequencia} onChange={e => setAbcConsequencia(e.target.value)} maxLength={300} placeholder="O que aconteceu depois? (opcional)" className="rounded-lg border border-amber-200 px-2 py-2 text-sm" />
              <label className="text-xs text-gray-600">
                Intensidade
                <select value={abcIntensidade} onChange={e => setAbcIntensidade(e.target.value)} className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-2 py-2 text-sm">
                  <option value="">Não informar</option>
                  <option value="1">1 — leve</option>
                  <option value="2">2</option>
                  <option value="3">3 — moderada</option>
                  <option value="4">4</option>
                  <option value="5">5 — intensa</option>
                </select>
              </label>
            </div>
          )}
        </div>
      )}

      {/* PASSO 6: Observação livre (opcional) */}
      {criancasSel.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
            6. Observação complementar (opcional)
          </p>
          <textarea
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            placeholder="Detalhe específico sobre o momento observado..."
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none h-16 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            maxLength={300}
          />
        </div>
      )}

      {/* Botão Registrar */}
      {criancasSel.length > 0 && nivelSel && (
        <button
          type="button"
          onClick={handleRegistrar}
          disabled={usarAbc && !abcComportamento.trim()}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
        >
          ✦ Registrar Microgesto ({criancasSel.length} criança{criancasSel.length > 1 ? 's' : ''})
        </button>
      )}
    </div>
  );
}
