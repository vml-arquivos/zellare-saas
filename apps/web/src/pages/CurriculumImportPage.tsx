/**
 * CurriculumImportPage — Importação de Matriz Curricular via CSV.
 *
 * O backend é a fonte única da verdade: o arquivo é validado e comparado
 * com a matriz real antes de qualquer gravação.
 */
import { useState } from 'react';
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  Download,
  FileSpreadsheet,
  Loader2,
  BookOpen,
  ShieldCheck,
  ScanSearch,
} from 'lucide-react';
import { PageShell } from '../components/ui/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import http from '../api/http';
import { toast } from 'sonner';

const CSV_MODELO = `data,campo_experiencia,objetivo_bncc,codigo_bncc,objetivo_curriculo,intencionalidade,exemplo_atividade
2026-02-02,O_EU_O_OUTRO_E_O_NOS,Demonstrar atitudes de cuidado e solidariedade na interação com crianças e adultos.,EI01EO01,Desenvolver a identidade pessoal e coletiva da criança.,Promover rodas de conversa sobre sentimentos e relações.,Roda de apresentação com fantoches.
2026-02-03,CORPO_GESTOS_E_MOVIMENTOS,Explorar formas de se deslocar no espaço combinando movimentos e seguindo orientações.,EI01CG01,Desenvolver a consciência corporal e a coordenação motora.,Circuito motor com obstáculos variados.,Percurso com bambolês e cones.
`;

type PreviewRow = {
  line: number;
  status: 'VALID' | 'ERROR';
  action?: 'INSERT' | 'UPDATE' | 'UNCHANGED';
  date?: string;
  campoDeExperiencia?: string;
  objetivoBNCC?: string;
  objetivoCurriculo?: string;
  errors: string[];
};

type CsvPreview = {
  matrixId?: string;
  delimiter: ',' | ';';
  headers: string[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: string[];
  preview: PreviewRow[];
};

type CsvImportResult = {
  matrixId: string;
  importados: number;
  inseridos: number;
  atualizados: number;
  semAlteracao: number;
  totalLinhas: number;
  erros: string[];
};

function downloadModelo() {
  const blob = new Blob([CSV_MODELO], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'modelo_matriz_curricular.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

function errorMessage(error: unknown) {
  const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  if (message) return message;
  if (error instanceof Error) return error.message;
  return 'Não foi possível concluir a operação.';
}

export function CurriculumImportPage() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [processando, setProcessando] = useState<'preview' | 'import' | null>(null);
  const [validacao, setValidacao] = useState<CsvPreview | null>(null);
  const [resultado, setResultado] = useState<CsvImportResult | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [segmento, setSegmento] = useState('EI02');
  const [versao, setVersao] = useState('1');

  function handleArquivo(file: File) {
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setErro('Selecione um arquivo .csv ou .txt.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErro('O arquivo deve ter no máximo 5 MB.');
      return;
    }
    setArquivo(file);
    setValidacao(null);
    setResultado(null);
    setErro(null);
  }

  function makeForm() {
    if (!arquivo) throw new Error('Selecione um arquivo CSV.');
    if (!nome.trim()) throw new Error('Informe o nome da matriz.');
    const form = new FormData();
    form.append('file', arquivo);
    form.append('name', nome.trim());
    form.append('year', ano);
    form.append('segment', segmento);
    form.append('version', versao);
    return form;
  }

  async function handleValidar() {
    try {
      setProcessando('preview');
      setErro(null);
      setResultado(null);
      const response = await http.post<CsvPreview>('/curriculum-matrices/import/csv/preview', makeForm(), { headers: { 'Content-Type': 'multipart/form-data' } });
      setValidacao(response.data);
      if (response.data.invalidRows === 0) toast.success(`${response.data.validRows} linhas validadas sem erros.`);
      else toast.warning(`${response.data.validRows} linhas válidas e ${response.data.invalidRows} linhas com erro. Revise antes de importar.`);
    } catch (validationError) {
      setValidacao(null);
      setErro(errorMessage(validationError));
      toast.error('Falha na validação do CSV.');
    } finally {
      setProcessando(null);
    }
  }

  async function handleImportar() {
    if (!validacao || validacao.validRows === 0) {
      setErro('Valide o arquivo e corrija as linhas inválidas antes de importar.');
      return;
    }
    try {
      setProcessando('import');
      setErro(null);
      const response = await http.post<CsvImportResult>('/curriculum-matrices/import/csv', makeForm(), { headers: { 'Content-Type': 'multipart/form-data' } });
      setResultado(response.data);
      toast.success(`${response.data.importados} linhas processadas com segurança.`);
    } catch (importError) {
      setErro(errorMessage(importError));
      toast.error('Falha na importação. Nenhum fallback local foi executado.');
    } finally {
      setProcessando(null);
    }
  }

  return (
    <PageShell title="Importar Matriz Curricular" subtitle="Validação real, preview auditável e aplicação idempotente sobre as tabelas curriculares do Zelare.">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-900"><ShieldCheck className="mr-2 inline h-4 w-4" /> O arquivo é analisado pelo backend antes de gravar. O preview não cria matriz, não altera entries e mostra a ação prevista para cada linha.</div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Download className="h-4 w-4 text-indigo-600" />Passo 1 — Use o modelo oficial</CardTitle></CardHeader>
          <CardContent className="space-y-3"><p className="text-sm text-gray-600">Colunas obrigatórias: <code>data</code>, <code>campo_experiencia</code>, <code>objetivo_bncc</code> e <code>objetivo_curriculo</code>. O parser aceita CSV com vírgula ou ponto e vírgula, inclusive campos entre aspas.</p><Button variant="outline" size="sm" onClick={downloadModelo} className="gap-2"><FileSpreadsheet className="h-4 w-4" />Baixar modelo CSV</Button></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4 text-indigo-600" />Passo 2 — Identifique a matriz</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><Label>Nome da matriz <span className="text-red-500">*</span></Label><Input placeholder="Ex.: Matriz Curricular EI02 2026" value={nome} onChange={(event) => setNome(event.target.value)} /></div>
            <div><Label>Segmento <span className="text-red-500">*</span></Label><select className="w-full rounded-md border px-3 py-2 text-sm" value={segmento} onChange={(event) => setSegmento(event.target.value)}><option value="EI01">EI01 — Bebês</option><option value="EI02">EI02 — Crianças bem pequenas</option><option value="EI03">EI03 — Crianças pequenas</option></select></div>
            <div><Label>Ano letivo</Label><Input type="number" min={2020} max={2100} value={ano} onChange={(event) => setAno(event.target.value)} /></div>
            <div><Label>Versão</Label><Input type="number" min={1} value={versao} onChange={(event) => setVersao(event.target.value)} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Upload className="h-4 w-4 text-indigo-600" />Passo 3 — Envie e valide</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-indigo-200 hover:bg-indigo-50" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) handleArquivo(file); }}>
              <Upload className="mb-2 h-8 w-8 text-indigo-400" /><span className="text-sm text-gray-500">{arquivo ? arquivo.name : 'Arraste o CSV aqui ou clique para selecionar'}</span><input type="file" accept=".csv,.txt" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) handleArquivo(file); }} />
            </label>
            <div className="flex flex-col gap-2 sm:flex-row"><Button onClick={handleValidar} disabled={!arquivo || processando !== null} className="gap-2">{processando === 'preview' ? <><Loader2 className="h-4 w-4 animate-spin" />Validando...</> : <><ScanSearch className="h-4 w-4" />Validar e gerar preview</>}</Button><Button variant="outline" onClick={handleImportar} disabled={!validacao || validacao.validRows === 0 || processando !== null} className="gap-2">{processando === 'import' ? <><Loader2 className="h-4 w-4 animate-spin" />Importando...</> : <><CheckCircle2 className="h-4 w-4" />Importar após revisão</>}</Button></div>
          </CardContent>
        </Card>

        {validacao && <Card className={validacao.invalidRows > 0 ? 'border-amber-200 bg-amber-50/40' : 'border-emerald-200 bg-emerald-50/40'}><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ScanSearch className="h-4 w-4 text-indigo-600" />Preview do backend — separador “{validacao.delimiter}”</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-4"><div className="rounded-xl bg-white p-3"><p className="text-xs text-slate-500">Linhas</p><p className="text-xl font-semibold text-slate-900">{validacao.totalRows}</p></div><div className="rounded-xl bg-white p-3"><p className="text-xs text-slate-500">Válidas</p><p className="text-xl font-semibold text-emerald-700">{validacao.validRows}</p></div><div className="rounded-xl bg-white p-3"><p className="text-xs text-slate-500">Com erro</p><p className="text-xl font-semibold text-amber-700">{validacao.invalidRows}</p></div><div className="rounded-xl bg-white p-3"><p className="text-xs text-slate-500">Matriz existente</p><p className="truncate text-sm font-semibold text-slate-700">{validacao.matrixId ? 'Sim — será atualizada' : 'Não — será criada'}</p></div></div><div className="overflow-x-auto rounded-lg border bg-white"><table className="w-full text-xs"><thead className="bg-slate-50"><tr><th className="px-2 py-2 text-left">Linha</th><th className="px-2 py-2 text-left">Data</th><th className="px-2 py-2 text-left">Campo</th><th className="px-2 py-2 text-left">Ação</th><th className="px-2 py-2 text-left">Validação</th></tr></thead><tbody>{validacao.preview.map((row) => <tr key={row.line} className="border-t align-top"><td className="px-2 py-2">{row.line}</td><td className="px-2 py-2 whitespace-nowrap">{row.date || '—'}</td><td className="max-w-[220px] px-2 py-2">{row.campoDeExperiencia || '—'}</td><td className="px-2 py-2"><Badge variant="outline" className={row.action === 'UPDATE' ? 'border-amber-300 text-amber-700' : row.action === 'INSERT' ? 'border-emerald-300 text-emerald-700' : 'border-slate-300 text-slate-600'}>{row.action || 'ERRO'}</Badge></td><td className="px-2 py-2 text-slate-600">{row.errors.length ? row.errors.join('; ') : 'OK'}</td></tr>)}</tbody></table></div>{validacao.errors.length > 0 && <div className="space-y-1"><p className="text-xs font-semibold text-amber-800">Mensagens de validação</p>{validacao.errors.slice(0, 20).map((message, index) => <p key={`${message}-${index}`} className="text-xs text-amber-800">{message}</p>)}</div>}</CardContent></Card>}

        {resultado && <Card className="border-emerald-200 bg-emerald-50"><CardContent className="space-y-2 pt-4"><div className="flex items-center gap-2 font-semibold text-emerald-700"><CheckCircle2 className="h-5 w-5" />Importação concluída com trilha de auditoria</div><p className="text-sm text-emerald-900"><strong>{resultado.importados}</strong> linhas válidas processadas; <strong>{resultado.inseridos}</strong> inseridas, <strong>{resultado.atualizados}</strong> atualizadas e <strong>{resultado.semAlteracao}</strong> sem alteração.</p><p className="text-xs text-slate-600">ID da matriz: <code>{resultado.matrixId}</code></p>{resultado.erros.length > 0 && <div className="mt-2 space-y-1"><p className="text-xs font-semibold text-amber-700">{resultado.erros.length} linha(s) não aplicada(s):</p>{resultado.erros.slice(0, 20).map((message, index) => <p key={`${message}-${index}`} className="text-xs text-amber-700">{message}</p>)}</div>}</CardContent></Card>}
        {erro && <Card className="border-red-200 bg-red-50"><CardContent className="flex items-start gap-2 pt-4 text-red-700"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><p className="text-sm">{erro}</p></CardContent></Card>}
      </div>
    </PageShell>
  );
}
