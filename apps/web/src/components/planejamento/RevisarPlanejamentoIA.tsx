import { useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Lightbulb, Loader2, MessageCircleQuestion, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { revisarPlanejamento, type RevisaoPlanejamento } from '../../api/ia-assistiva';

interface RevisarPlanejamentoIAProps {
  planningId: string;
  disabled?: boolean;
}

function Lista({
  items,
  emptyLabel,
  icon,
}: {
  items: string[];
  emptyLabel: string;
  icon: ReactNode;
}) {
  if (items.length === 0) {
    return <p className="text-xs text-slate-500">{emptyLabel}</p>;
  }
  return (
    <ul className="space-y-2 text-sm text-slate-700">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex items-start gap-2">
          <span className="mt-0.5 flex-shrink-0">{icon}</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function RevisarPlanejamentoIA({ planningId, disabled = false }: RevisarPlanejamentoIAProps) {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<RevisaoPlanejamento | null>(null);

  const revisar = async () => {
    setLoading(true);
    try {
      const data = await revisarPlanejamento(planningId);
      setResultado(data);
      toast.success('Revisão pedagógica gerada para conferência humana.');
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? 'Não foi possível gerar a revisão agora.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-violet-200 bg-gradient-to-br from-violet-50 via-white to-sky-50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base text-violet-950">
              <Sparkles className="h-5 w-5 text-violet-600" />
              Revisor pedagógico Zelare
            </CardTitle>
            <p className="mt-1 text-xs text-violet-800/75">
              Analisa o planejamento salvo, a turma e a matriz autorizada. Não altera nem publica nada automaticamente.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={revisar}
            disabled={disabled || loading}
            className="border-violet-300 bg-white text-violet-800 hover:bg-violet-100"
          >
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analisando...</>
            ) : (
              <><Sparkles className="mr-2 h-4 w-4" /> Revisar com IA</>
            )}
          </Button>
        </div>
      </CardHeader>

      {resultado && (
        <CardContent className="space-y-5 pt-0">
          <div className="rounded-xl border border-violet-200 bg-white/80 p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Somente leitura</Badge>
              <Badge variant="outline">{resultado.fonte.objectivesCount} objetivos encontrados</Badge>
              <span className="text-[11px] text-slate-500">Requer revisão humana</span>
            </div>
            <p className="text-sm leading-6 text-slate-800">{resultado.revisao.resumo}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-900">
                <CheckCircle2 className="h-4 w-4" /> Pontos fortes
              </h3>
              <Lista items={resultado.revisao.pontosFortes} emptyLabel="Nenhum ponto forte identificado na revisão." icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />} />
            </section>

            <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-900">
                <Lightbulb className="h-4 w-4" /> Sugestões práticas
              </h3>
              <Lista items={resultado.revisao.sugestoes} emptyLabel="Nenhuma sugestão adicional foi retornada." icon={<Lightbulb className="h-3.5 w-3.5 text-amber-600" />} />
            </section>

            <section className="rounded-xl border border-sky-200 bg-sky-50/60 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-sky-900">
                <MessageCircleQuestion className="h-4 w-4" /> Perguntas para reflexão
              </h3>
              <Lista items={resultado.revisao.perguntasParaProfessor} emptyLabel="Nenhuma pergunta de reflexão foi retornada." icon={<MessageCircleQuestion className="h-3.5 w-3.5 text-sky-600" />} />
            </section>

            <section className="rounded-xl border border-rose-200 bg-rose-50/60 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-rose-900">
                <AlertTriangle className="h-4 w-4" /> Lacunas e alertas
              </h3>
              <Lista items={[...resultado.revisao.lacunas, ...resultado.revisao.alertas]} emptyLabel="Nenhuma lacuna ou alerta identificado na revisão." icon={<AlertTriangle className="h-3.5 w-3.5 text-rose-600" />} />
            </section>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
