import { useCallback, useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { Link, useLocation } from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useAuth } from "../app/AuthProvider";
import { getPerfilLabel } from "../api/auth";
import {
  JourneyDuplicatesPanel,
  JourneyOffersPanel,
  JourneyVisitsPanel,
  JourneyWaitlistPanel,
} from "./JourneyActionPanels";
import {
  changeJourneyStage,
  createJourneyProspect,
  getJourneyDashboard,
  getJourneyDuplicateReviews,
  getJourneyOffers,
  getJourneyPolicies,
  getJourneyProspects,
  getJourneyUnits,
  getJourneyVisits,
  getJourneyWaitlist,
  journeyIdempotencyKey,
} from "../api/journey";
import type {
  JourneyDashboard,
  JourneyDuplicateReview,
  JourneyOffer,
  JourneyPolicy,
  JourneyProspect,
  JourneyStage,
  JourneyUnit,
  JourneyVisit,
  JourneyWaitlistEntry,
} from "../api/journey";

const STAGE_LABELS: Record<JourneyStage, string> = {
  NOVO: "Novo",
  CONTATADO: "Contatado",
  VISITA_AGENDADA: "Visita agendada",
  VISITA_REALIZADA: "Visita realizada",
  LISTA_ESPERA: "Lista de espera",
  VAGA_OFERECIDA: "Vaga oferecida",
  ACEITO: "Aceito",
  PERDIDO: "Perdido",
  ARQUIVADO: "Arquivado",
};

const STAGES = Object.keys(STAGE_LABELS) as JourneyStage[];
const TABS = [
  { path: "/app/journey", label: "Visão geral", exact: true },
  { path: "/app/journey/interessados", label: "Interessados" },
  { path: "/app/journey/funil", label: "Funil" },
  { path: "/app/journey/visitas", label: "Visitas" },
  { path: "/app/journey/lista-espera", label: "Lista de espera" },
  { path: "/app/journey/ofertas", label: "Ofertas de vaga" },
  { path: "/app/journey/relatorios", label: "Relatórios" },
];

function formatDate(value?: string | null, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(
    "pt-BR",
    withTime
      ? { dateStyle: "short", timeStyle: "short" }
      : { dateStyle: "short" },
  ).format(date);
}

function metric(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function errorText(error: unknown) {
  if (isAxiosError(error) && error.response?.status === 403)
    return "O Journey está desligado para este tenant ou seu papel não tem acesso.";
  if (isAxiosError(error) && error.response?.status === 401)
    return "Sua sessão expirou. Entre novamente para continuar.";
  return "Não foi possível carregar os dados agora. Tente novamente.";
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={`ds-card p-4 sm:p-5 ${className}`}>{children}</article>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Users;
}) {
  return (
    <Card className="flex min-h-[7rem] flex-col justify-between gap-3">
      <div className="ds-icon-tile ds-badge-blue">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div>
        <div className="text-2xl font-normal text-[var(--text-primary)]">
          {metric(value)}
        </div>
        <div className="text-xs text-[var(--text-secondary)]">{label}</div>
      </div>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="py-10 text-center text-sm text-[var(--text-secondary)]">
      {text}
    </div>
  );
}

export default function JourneyPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [units, setUnits] = useState<JourneyUnit[]>([]);
  const [unitId, setUnitId] = useState("");
  const [dashboard, setDashboard] = useState<JourneyDashboard | null>(null);
  const [prospects, setProspects] = useState<JourneyProspect[]>([]);
  const [visits, setVisits] = useState<JourneyVisit[]>([]);
  const [waitlist, setWaitlist] = useState<JourneyWaitlistEntry[]>([]);
  const [offers, setOffers] = useState<JourneyOffer[]>([]);
  const [policies, setPolicies] = useState<JourneyPolicy[]>([]);
  const [duplicates, setDuplicates] = useState<JourneyDuplicateReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdMessage, setCreatedMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    responsibleName: "",
    childName: "",
    email: "",
    phone: "",
    source: "Site",
    ageGroupMinMonths: "0",
    ageGroupMaxMonths: "48",
    period: "Integral",
    desiredDate: "",
    consentCapture: false,
    consentContact: false,
  });

  const mode = useMemo(() => {
    if (location.pathname.endsWith("/interessados")) return "prospects";
    if (location.pathname.endsWith("/funil")) return "pipeline";
    if (location.pathname.endsWith("/visitas")) return "visits";
    if (location.pathname.endsWith("/lista-espera")) return "waitlist";
    if (location.pathname.endsWith("/ofertas")) return "offers";
    if (location.pathname.endsWith("/relatorios")) return "reports";
    return "overview";
  }, [location.pathname]);

  const load = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [
          unitsData,
          dashboardData,
          prospectsData,
          visitsData,
          waitlistData,
          offersData,
          policiesData,
          duplicatesData,
        ] = await Promise.all([
          getJourneyUnits(),
          getJourneyDashboard(unitId || undefined),
          getJourneyProspects({ unitId: unitId || undefined, limit: 100 }),
          getJourneyVisits(unitId || undefined),
          getJourneyWaitlist(unitId || undefined),
          getJourneyOffers(unitId || undefined),
          getJourneyPolicies(unitId || undefined),
          getJourneyDuplicateReviews(),
        ]);
        setUnits(unitsData);
        setDashboard(dashboardData);
        setProspects(prospectsData);
        setVisits(visitsData);
        setWaitlist(waitlistData);
        setOffers(offersData);
        setPolicies(policiesData);
        setDuplicates(duplicatesData);
        if (
          !unitId &&
          user?.unitId &&
          unitsData.some((unit) => unit.id === user.unitId)
        )
          setUnitId(user.unitId);
      } catch (cause) {
        setError(errorText(cause));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [unitId, user?.unitId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function submitProspect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatedMessage(null);
    setError(null);
    if (!unitId) {
      setError("Selecione uma unidade antes de cadastrar.");
      return;
    }
    try {
      const result = await createJourneyProspect({
        ...form,
        unitId,
        ageGroupMinMonths: Number(form.ageGroupMinMonths),
        ageGroupMaxMonths: Number(form.ageGroupMaxMonths),
        desiredDate: form.desiredDate
          ? `${form.desiredDate}T12:00:00.000Z`
          : undefined,
        idempotencyKey: journeyIdempotencyKey("prospect"),
      });
      setCreatedMessage(
        result.possibleDuplicates.length > 0
          ? `Interessado cadastrado. ${result.possibleDuplicates.length} possível(is) duplicidade(s) aguardam revisão.`
          : "Interessado cadastrado.",
      );
      setForm((current) => ({
        ...current,
        responsibleName: "",
        childName: "",
        email: "",
        phone: "",
        desiredDate: "",
      }));
      await load(true);
    } catch (cause) {
      setError(errorText(cause));
    }
  }

  const selectedUnitLabel = unitId
    ? (units.find((unit) => unit.id === unitId)?.name ?? "Unidade selecionada")
    : "Todas as unidades autorizadas";
  const title =
    TABS.find((tab) => tab.path === location.pathname)?.label ??
    (mode === "overview" ? "Visão geral" : "Jornada");

  return (
    <main className="mx-auto w-full max-w-[var(--content-max-w)] px-4 py-5 sm:px-6 lg:px-8">
      <header className="zelare-page-header mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-1 text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
            Jornada e Admissões
          </p>
          <h1 className="zelare-page-title text-2xl font-normal text-[var(--text-primary)] sm:text-3xl">
            {title}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {selectedUnitLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="journey-unit" className="sr-only">
            Unidade
          </label>
          <select
            id="journey-unit"
            className="ds-input min-w-[13rem]"
            value={unitId}
            onChange={(event) => setUnitId(event.target.value)}
          >
            <option value="">Todas as unidades autorizadas</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="ds-btn ds-btn-secondary mobile-touch-target"
            onClick={() => void load(true)}
            disabled={loading || refreshing}
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />{" "}
            Atualizar
          </button>
        </div>
      </header>

      <nav
        aria-label="Jornada e Admissões"
        className="mb-6 flex gap-1 overflow-x-auto border-b border-[var(--border-subtle)] pb-1"
      >
        {TABS.map((tab) => {
          const active = tab.exact
            ? location.pathname === tab.path
            : location.pathname.startsWith(tab.path);
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`whitespace-nowrap rounded-t-lg px-3 py-2 text-xs transition-colors ${active ? "border-b-2 border-[var(--brand-500)] text-[var(--text-brand)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-inset)] hover:text-[var(--text-primary)]"}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {error && (
        <div className="ds-alert ds-alert-warning mb-5" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {createdMessage && (
        <div className="ds-alert ds-alert-success mb-5" role="status">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{createdMessage}</span>
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : (
        <>
          <section
            className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
            aria-label="Indicadores Journey"
          >
            <StatCard
              label="Interessados"
              value={dashboard?.totals.prospects ?? 0}
              icon={Users}
            />
            <StatCard
              label="Visitas futuras"
              value={dashboard?.totals.upcomingVisits ?? 0}
              icon={CalendarDays}
            />
            <StatCard
              label="Na lista de espera"
              value={dashboard?.totals.waiting ?? 0}
              icon={ClipboardList}
            />
            <StatCard
              label="Ofertas ativas"
              value={dashboard?.totals.activeOffers ?? 0}
              icon={UserPlus}
            />
          </section>
          {mode === "overview" && <Overview dashboard={dashboard} />}
          {mode === "prospects" && (
            <Prospects
              prospects={prospects}
              form={form}
              setForm={setForm}
              submit={submitProspect}
              onChanged={() => load(true)}
            />
          )}
          {mode === "pipeline" && (
            <Pipeline dashboard={dashboard} prospects={prospects} />
          )}
          {mode === "visits" && <JourneyVisitsPanel visits={visits} prospects={prospects} unitId={unitId} units={units} onChanged={() => load(true)} />}
          {mode === "waitlist" && <JourneyWaitlistPanel entries={waitlist} policies={policies} prospects={prospects} units={units} unitId={unitId} onChanged={() => load(true)} />}
          {mode === "offers" && <JourneyOffersPanel offers={offers} prospects={prospects} capacity={dashboard?.capacity ?? []} waitlist={waitlist} units={units} unitId={unitId} onChanged={() => load(true)} />}
          {mode === "reports" && <Reports dashboard={dashboard} />}
          {mode === "prospects" && <JourneyDuplicatesPanel reviews={duplicates} onChanged={() => load(true)} />}
        </>
      )}

      <footer className="mt-6 flex flex-col gap-2 border-t border-[var(--border-subtle)] pt-4 text-xs text-[var(--text-tertiary)] sm:flex-row sm:items-center sm:justify-between">
        <span>
          {getPerfilLabel(user)} · tenant e unidade filtrados no servidor
        </span>
        <span>
          Inferência diagnóstica desligada · revisão humana obrigatória
        </span>
      </footer>
    </main>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4" aria-label="Carregando Journey">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="ds-loading h-28 rounded-[var(--r-lg)]" />
        ))}
      </div>
      <div className="ds-loading h-72 rounded-[var(--r-lg)]" />
    </div>
  );
}

function Overview({ dashboard }: { dashboard: JourneyDashboard | null }) {
  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)]">
      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-normal text-[var(--text-primary)]">
              Funil atual
            </h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Contagem real por estágio.
            </p>
          </div>
          <span className="ds-badge ds-badge-neutral">
            Atualizado {formatDate(dashboard?.freshnessAt, true)}
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {STAGES.map((stage) => (
            <div
              key={stage}
              className="rounded-[var(--r-lg)] border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-3"
            >
              <div className="text-xl font-normal text-[var(--text-primary)]">
                {metric(dashboard?.stages[stage] ?? 0)}
              </div>
              <div className="mt-1 text-xs text-[var(--text-secondary)]">
                {STAGE_LABELS[stage]}
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <div className="mb-4 flex items-center gap-3">
          <span className="ds-icon-tile ds-badge-green">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-normal text-[var(--text-primary)]">
              Governança
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Proteções aplicadas.
            </p>
          </div>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-[var(--text-secondary)]">
              Inferência diagnóstica
            </span>
            <span className="ds-badge ds-badge-green">Desligada</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-[var(--text-secondary)]">Revisão humana</span>
            <span className="ds-badge ds-badge-green">Obrigatória</span>
          </div>
        </div>
      </Card>
    </section>
  );
}

function Prospects({
  prospects,
  form,
  setForm,
  submit,
  onChanged,
}: {
  prospects: JourneyProspect[];
  form: {
    responsibleName: string;
    childName: string;
    email: string;
    phone: string;
    source: string;
    ageGroupMinMonths: string;
    ageGroupMaxMonths: string;
    period: string;
    desiredDate: string;
    consentCapture: boolean;
    consentContact: boolean;
  };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
  submit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onChanged: () => Promise<void>;
}) {
  const [selectedStages, setSelectedStages] = useState<Record<string, JourneyStage>>({});
  const [stageBusy, setStageBusy] = useState<string | null>(null);
  const [stageMessage, setStageMessage] = useState<string | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);
  const update = (field: keyof typeof form, value: string | boolean) =>
    setForm((current) => ({ ...current, [field]: value }));
  const saveStage = async (prospect: JourneyProspect) => {
    const toStage = selectedStages[prospect.id] ?? prospect.stage;
    setStageBusy(prospect.id); setStageMessage(null); setStageError(null);
    try {
      await changeJourneyStage(prospect.id, { toStage, idempotencyKey: journeyIdempotencyKey("prospect-stage") });
      await onChanged(); setStageMessage("Estágio atualizado.");
    } catch {
      setStageError("Não foi possível atualizar o estágio.");
    } finally { setStageBusy(null); }
  };
  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.6fr)]">
      <Card>
        <div className="mb-4">
          <h2 className="text-base font-normal text-[var(--text-primary)]">
            Novo interessado
          </h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Somente dados de captação permitidos.
          </p>
        </div>
        <form className="space-y-3" onSubmit={submit}>
          <label className="block text-xs text-[var(--text-secondary)]">
            Responsável
            <input
              required
              minLength={2}
              className="ds-input mt-1 w-full"
              value={form.responsibleName}
              onChange={(event) =>
                update("responsibleName", event.target.value)
              }
            />
          </label>
          <label className="block text-xs text-[var(--text-secondary)]">
            Criança prospectiva
            <input
              required
              minLength={2}
              className="ds-input mt-1 w-full"
              value={form.childName}
              onChange={(event) => update("childName", event.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-[var(--text-secondary)]">
              E-mail
              <input
                type="email"
                className="ds-input mt-1 w-full"
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
              />
            </label>
            <label className="block text-xs text-[var(--text-secondary)]">
              Telefone
              <input
                className="ds-input mt-1 w-full"
                value={form.phone}
                onChange={(event) => update("phone", event.target.value)}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-[var(--text-secondary)]">
              Faixa inicial
              <input
                required
                type="number"
                min="0"
                max="240"
                className="ds-input mt-1 w-full"
                value={form.ageGroupMinMonths}
                onChange={(event) =>
                  update("ageGroupMinMonths", event.target.value)
                }
              />
            </label>
            <label className="block text-xs text-[var(--text-secondary)]">
              Faixa final
              <input
                required
                type="number"
                min="0"
                max="240"
                className="ds-input mt-1 w-full"
                value={form.ageGroupMaxMonths}
                onChange={(event) =>
                  update("ageGroupMaxMonths", event.target.value)
                }
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-[var(--text-secondary)]">
              Período
              <input
                required
                className="ds-input mt-1 w-full"
                value={form.period}
                onChange={(event) => update("period", event.target.value)}
              />
            </label>
            <label className="block text-xs text-[var(--text-secondary)]">
              Data desejada
              <input
                type="date"
                className="ds-input mt-1 w-full"
                value={form.desiredDate}
                onChange={(event) => update("desiredDate", event.target.value)}
              />
            </label>
          </div>
          <label className="block text-xs text-[var(--text-secondary)]">
            Origem
            <input
              required
              className="ds-input mt-1 w-full"
              value={form.source}
              onChange={(event) => update("source", event.target.value)}
            />
          </label>
          <label className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
            <input
              required
              type="checkbox"
              checked={form.consentCapture}
              onChange={(event) =>
                update("consentCapture", event.target.checked)
              }
            />
            Consentimento para registro da captação.
          </label>
          <label className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={form.consentContact}
              onChange={(event) =>
                update("consentContact", event.target.checked)
              }
            />
            Consentimento para contato.
          </label>
          <button className="ds-btn ds-btn-primary w-full" type="submit">
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Cadastrar interessado
          </button>
        </form>
      </Card>
      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-normal text-[var(--text-primary)]">
              Interessados
            </h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Possíveis duplicidades ficam para revisão humana.
            </p>
          </div>
          <span className="ds-badge ds-badge-neutral">
            {metric(prospects.length)} registros
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-[var(--border-default)] text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
              <tr>
                <th className="px-2 py-3 font-medium">Responsável</th>
                <th className="px-2 py-3 font-medium">Criança</th>
                <th className="px-2 py-3 font-medium">Unidade</th>
                <th className="px-2 py-3 font-medium">Estágio</th>
                <th className="px-2 py-3 font-medium">Atualizado</th>
                <th className="px-2 py-3 font-medium">Ação</th>
              </tr>
            </thead>
            <tbody>
              {prospects.length ? (
                prospects.map((prospect) => (
                  <tr
                    key={prospect.id}
                    className="border-b border-[var(--border-subtle)]"
                  >
                    <td className="px-2 py-3 text-[var(--text-primary)]">
                      {prospect.responsibleName}
                    </td>
                    <td className="px-2 py-3 text-[var(--text-secondary)]">
                      {prospect.childName}
                    </td>
                    <td className="px-2 py-3 text-[var(--text-secondary)]">
                      {prospect.unitId}
                    </td>
                    <td className="px-2 py-3">
                      <span className="ds-badge ds-badge-blue">
                        {STAGE_LABELS[prospect.stage]}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-[var(--text-tertiary)]">
                      {formatDate(prospect.updatedAt, true)}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex min-w-[14rem] gap-2">
                        <label className="sr-only" htmlFor={`stage-${prospect.id}`}>Novo estágio</label>
                        <select id={`stage-${prospect.id}`} className="ds-input" value={selectedStages[prospect.id] ?? prospect.stage} onChange={(event) => setSelectedStages((current) => ({ ...current, [prospect.id]: event.target.value as JourneyStage }))}>
                          {STAGES.map((stage) => <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>)}
                        </select>
                        <button type="button" className="ds-btn ds-btn-secondary mobile-touch-target" disabled={stageBusy !== null} onClick={() => void saveStage(prospect)}>Salvar</button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <Empty text="Nenhum interessado no escopo selecionado." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {stageMessage && <p className="mt-3 text-xs text-[var(--text-brand)]" role="status">{stageMessage}</p>}
        {stageError && <p className="mt-3 text-xs text-[var(--danger-600)]" role="alert">{stageError}</p>}
      </Card>
    </section>
  );
}

function Pipeline({
  dashboard,
  prospects,
}: {
  dashboard: JourneyDashboard | null;
  prospects: JourneyProspect[];
}) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {STAGES.map((stage) => (
        <Card key={stage}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-normal text-[var(--text-primary)]">
              {STAGE_LABELS[stage]}
            </h2>
            <span className="ds-badge ds-badge-neutral">
              {metric(dashboard?.stages[stage] ?? 0)}
            </span>
          </div>
          <div className="space-y-2">
            {prospects
              .filter((prospect) => prospect.stage === stage)
              .slice(0, 5)
              .map((prospect) => (
                <div
                  key={prospect.id}
                  className="rounded-lg border border-[var(--border-subtle)] p-3"
                >
                  <div className="text-sm text-[var(--text-primary)]">
                    {prospect.responsibleName}
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-secondary)]">
                    {prospect.childName} · {prospect.period}
                  </div>
                </div>
              ))}
            {prospects.every((prospect) => prospect.stage !== stage) && (
              <p className="text-xs text-[var(--text-tertiary)]">
                Sem registros.
              </p>
            )}
          </div>
        </Card>
      ))}
    </section>
  );
}

function Reports({ dashboard }: { dashboard: JourneyDashboard | null }) {
  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)]">
      <Card>
        <h2 className="text-base font-normal text-[var(--text-primary)]">
          Indicadores Journey
        </h2>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          Fonte: {dashboard?.source ?? "API Journey"}
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="border-b border-[var(--border-default)] text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
              <tr>
                <th className="px-2 py-3 font-medium">Indicador</th>
                <th className="px-2 py-3 font-medium">Valor</th>
                <th className="px-2 py-3 font-medium">Atualização</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Interessados", dashboard?.totals.prospects ?? 0],
                ["Visitas futuras", dashboard?.totals.upcomingVisits ?? 0],
                ["Lista de espera", dashboard?.totals.waiting ?? 0],
                ["Ofertas ativas", dashboard?.totals.activeOffers ?? 0],
              ].map(([label, value]) => (
                <tr
                  key={String(label)}
                  className="border-b border-[var(--border-subtle)]"
                >
                  <td className="px-2 py-3 text-[var(--text-secondary)]">
                    {label}
                  </td>
                  <td className="px-2 py-3 text-[var(--text-primary)]">
                    {metric(Number(value))}
                  </td>
                  <td className="px-2 py-3 text-xs text-[var(--text-tertiary)]">
                    {formatDate(dashboard?.freshnessAt, true)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card>
        <h2 className="text-base font-normal text-[var(--text-primary)]">
          Capacidade real
        </h2>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          Classroom e matrículas ativas.
        </p>
        <div className="mt-4 space-y-2">
          {dashboard?.capacity.length ? (
            dashboard.capacity.map((row) => (
              <div
                key={row.classroomId}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] p-3"
              >
                <div>
                  <div className="text-sm text-[var(--text-primary)]">
                    {row.name}
                  </div>
                  <div className="text-xs text-[var(--text-tertiary)]">
                    {row.code}
                  </div>
                </div>
                <div className="text-right text-xs text-[var(--text-secondary)]">
                  <div>{metric(row.activeEnrollments)} ativos</div>
                  <div>
                    {metric(row.availableBeforeJourneyReservations)} livres
                    antes de reservas
                  </div>
                </div>
              </div>
            ))
          ) : (
            <Empty text="Nenhuma turma ativa no escopo." />
          )}
        </div>
      </Card>
    </section>
  );
}
