import { useMemo, useState } from "react";
import type {
  JourneyDashboard,
  JourneyDuplicateReview,
  JourneyOffer,
  JourneyPolicy,
  JourneyProspect,
  JourneyUnit,
  JourneyVisit,
  JourneyWaitlistEntry,
} from "../api/journey";
import {
  cancelJourneyVisit,
  confirmJourneyVisit,
  createJourneyOffer,
  createJourneyPolicy,
  createJourneyVisit,
  decideJourneyOffer,
  joinJourneyWaitlist,
  journeyIdempotencyKey,
  markJourneyVisitAbsence,
  publishJourneyPolicy,
  registerJourneyVisitFollowUp,
  rescheduleJourneyVisit,
  reviewJourneyDuplicate,
  reviewJourneyPolicy,
  undoJourneyDuplicate,
} from "../api/journey";

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

function toLocalInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIso(value: string) {
  return new Date(value).toISOString();
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={`ds-card min-w-0 p-4 sm:p-5 ${className}`}>
      {children}
    </article>
  );
}

function Notice({
  text,
  error = false,
}: {
  text: string | null;
  error?: boolean;
}) {
  if (!text) return null;
  return (
    <p
      className={`mt-3 text-xs ${error ? "text-[var(--danger-600)]" : "text-[var(--text-brand)]"}`}
      role={error ? "alert" : "status"}
    >
      {text}
    </p>
  );
}

function ActionButton({
  children,
  onClick,
  disabled = false,
  tone = "secondary",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "primary" | "secondary" | "danger";
}) {
  const className =
    tone === "primary"
      ? "ds-btn ds-btn-primary"
      : tone === "danger"
        ? "ds-btn ds-btn-secondary text-[var(--danger-600)]"
        : "ds-btn ds-btn-secondary";
  return (
    <button
      type="button"
      className={`${className} mobile-touch-target`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function JourneyVisitsPanel({
  visits,
  prospects,
  unitId,
  units,
  assignedTo,
  assignedToLabel = "Usuário autenticado",
  onChanged,
}: {
  visits: JourneyVisit[];
  prospects: JourneyProspect[];
  unitId: string;
  units: JourneyUnit[];
  assignedTo?: string;
  assignedToLabel?: string;
  onChanged: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    prospectId: "",
    unitId,
    startsAt: "",
    endsAt: "",
    notes: "",
  });
  const [reschedules, setReschedules] = useState<
    Record<string, { startsAt: string; endsAt: string }>
  >({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (
    key: string,
    operation: () => Promise<unknown>,
    success: string,
  ) => {
    setBusy(key);
    setMessage(null);
    setError(null);
    try {
      await operation();
      await onChanged();
      setMessage(success);
    } catch {
      setError(
        "Não foi possível salvar a visita. Confira o horário e tente novamente.",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-6">
      <Panel>
        <div className="mb-4">
          <h2 className="text-base font-normal text-[var(--text-primary)]">
            Agendar visita
          </h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            A agenda é validada no servidor contra conflitos do interessado.
          </p>
        </div>
        <form
          className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!form.prospectId || !form.startsAt || !form.endsAt) return;
            void run(
              "create",
              () =>
                createJourneyVisit({
                  prospectId: form.prospectId,
                  unitId: form.unitId || unitId,
                  startsAt: toIso(form.startsAt),
                  endsAt: toIso(form.endsAt),
                  assignedTo: assignedTo || undefined,
                  notes: form.notes || undefined,
                  idempotencyKey: journeyIdempotencyKey("visit"),
                }),
              "Visita agendada.",
            );
          }}
        >
          <label className="min-w-0 text-xs text-[var(--text-secondary)]">
            Interessado
            <select
              required
              className="ds-input mt-1 w-full"
              value={form.prospectId}
              onChange={(event) =>
                setForm({ ...form, prospectId: event.target.value })
              }
            >
              <option value="">Selecione</option>
              {prospects.map((prospect) => (
                <option key={prospect.id} value={prospect.id}>
                  {prospect.responsibleName} · {prospect.childName}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 text-xs text-[var(--text-secondary)]">
            Unidade
            <select
              required
              className="ds-input mt-1 w-full"
              value={form.unitId || unitId}
              onChange={(event) =>
                setForm({ ...form, unitId: event.target.value })
              }
            >
              <option value="">Selecione</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 text-xs text-[var(--text-secondary)]">
            Início
            <input
              required
              type="datetime-local"
              className="ds-input mt-1 w-full"
              value={form.startsAt}
              onChange={(event) =>
                setForm({ ...form, startsAt: event.target.value })
              }
            />
          </label>
          <label className="min-w-0 text-xs text-[var(--text-secondary)]">
            Fim
            <input
              required
              type="datetime-local"
              className="ds-input mt-1 w-full"
              value={form.endsAt}
              onChange={(event) =>
                setForm({ ...form, endsAt: event.target.value })
              }
            />
          </label>
          <label className="min-w-0 text-xs text-[var(--text-secondary)]">
            Responsável pela visita
            <input
              className="ds-input mt-1 w-full"
              value={assignedToLabel}
              readOnly
              aria-readonly="true"
            />
          </label>
          <label className="min-w-0 text-xs text-[var(--text-secondary)]">
            Observação
            <input
              className="ds-input mt-1 w-full"
              value={form.notes}
              onChange={(event) =>
                setForm({ ...form, notes: event.target.value })
              }
            />
          </label>
          <div className="md:col-span-2 xl:col-span-3">
            <button
              className="ds-btn ds-btn-primary mobile-touch-target"
              type="submit"
              disabled={busy !== null}
            >
              Agendar visita
            </button>
          </div>
        </form>
        <Notice text={message} />
        <Notice text={error} error />
      </Panel>
      <Panel>
        <div className="mb-3">
          <h2 className="text-base font-normal text-[var(--text-primary)]">
            Visitas
          </h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Cada alteração gera evento persistido e pode ser relida após a
            operação.
          </p>
        </div>
        {visits.length ? (
          <div className="space-y-3">
            {visits.map((visit) => {
              const value = reschedules[visit.id] ?? {
                startsAt: toLocalInput(visit.startsAt),
                endsAt: toLocalInput(visit.endsAt),
              };
              const active =
                visit.status === "AGENDADA" || visit.status === "REAGENDADA";
              return (
                <div
                  key={visit.id}
                  className="rounded-lg border border-[var(--border-subtle)] p-3"
                >
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-sm text-[var(--text-primary)]">
                        {visit.prospect?.responsibleName ?? "Responsável"}
                      </div>
                      <div className="min-w-0 text-xs text-[var(--text-secondary)]">
                        {visit.prospect?.childName ?? "Criança prospectiva"} ·{" "}
                        {formatDate(visit.startsAt, true)} até{" "}
                        {formatDate(visit.endsAt, true)}
                      </div>
                    </div>
                    <span className="ds-badge ds-badge-blue">
                      {visit.status}
                    </span>
                  </div>
                  {active && (
                    <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto] md:items-end">
                      <label className="min-w-0 text-xs text-[var(--text-secondary)]">
                        Novo início
                        <input
                          type="datetime-local"
                          className="ds-input mt-1 w-full"
                          value={value.startsAt}
                          onChange={(event) =>
                            setReschedules((current) => ({
                              ...current,
                              [visit.id]: {
                                ...value,
                                startsAt: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <label className="min-w-0 text-xs text-[var(--text-secondary)]">
                        Novo fim
                        <input
                          type="datetime-local"
                          className="ds-input mt-1 w-full"
                          value={value.endsAt}
                          onChange={(event) =>
                            setReschedules((current) => ({
                              ...current,
                              [visit.id]: {
                                ...value,
                                endsAt: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <ActionButton
                        disabled={busy !== null}
                        onClick={() =>
                          void run(
                            `reschedule-${visit.id}`,
                            () =>
                              rescheduleJourneyVisit(visit.id, {
                                startsAt: toIso(value.startsAt),
                                endsAt: toIso(value.endsAt),
                                note: note || undefined,
                                idempotencyKey:
                                  journeyIdempotencyKey("visit-reschedule"),
                              }),
                            "Visita reagendada.",
                          )
                        }
                      >
                        Reagendar
                      </ActionButton>
                    </div>
                  )}
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <label
                      className="sr-only"
                      htmlFor={`visit-note-${visit.id}`}
                    >
                      Nota da visita
                    </label>
                    <input
                      id={`visit-note-${visit.id}`}
                      className="ds-input w-full min-w-0 flex-1 sm:w-auto"
                      placeholder="Nota da ação (opcional)"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                    />
                    {active && (
                      <>
                        <ActionButton
                          disabled={busy !== null}
                          onClick={() =>
                            void run(
                              `confirm-${visit.id}`,
                              () =>
                                confirmJourneyVisit(visit.id, {
                                  note: note || undefined,
                                  idempotencyKey:
                                    journeyIdempotencyKey("visit-confirm"),
                                }),
                              "Presença confirmada.",
                            )
                          }
                        >
                          Confirmar presença
                        </ActionButton>
                        <ActionButton
                          disabled={busy !== null}
                          onClick={() =>
                            void run(
                              `absence-${visit.id}`,
                              () =>
                                markJourneyVisitAbsence(visit.id, {
                                  note: note || undefined,
                                  idempotencyKey:
                                    journeyIdempotencyKey("visit-absence"),
                                }),
                              "Ausência registrada.",
                            )
                          }
                        >
                          Registrar falta
                        </ActionButton>
                        <ActionButton
                          disabled={busy !== null}
                          onClick={() =>
                            void run(
                              `follow-${visit.id}`,
                              () =>
                                registerJourneyVisitFollowUp(visit.id, {
                                  note: note || undefined,
                                  idempotencyKey:
                                    journeyIdempotencyKey("visit-follow-up"),
                                }),
                              "Follow-up registrado.",
                            )
                          }
                        >
                          Registrar follow-up
                        </ActionButton>
                        <ActionButton
                          tone="danger"
                          disabled={busy !== null}
                          onClick={() =>
                            void run(
                              `cancel-${visit.id}`,
                              () =>
                                cancelJourneyVisit(visit.id, {
                                  note: note || undefined,
                                  idempotencyKey:
                                    journeyIdempotencyKey("visit-cancel"),
                                }),
                              "Visita cancelada.",
                            )
                          }
                        >
                          Cancelar
                        </ActionButton>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-[var(--text-secondary)]">
            Nenhuma visita no escopo selecionado.
          </p>
        )}
      </Panel>
    </section>
  );
}

export function JourneyWaitlistPanel({
  entries,
  policies,
  prospects,
  units,
  unitId,
  onChanged,
}: {
  entries: JourneyWaitlistEntry[];
  policies: JourneyPolicy[];
  prospects: JourneyProspect[];
  units: JourneyUnit[];
  unitId: string;
  onChanged: () => Promise<void>;
}) {
  const [policyForm, setPolicyForm] = useState({
    unitId,
    programKey: "default",
    min: "0",
    max: "48",
    period: "Integral",
    version: "1",
    effectiveFrom: "",
  });
  const [join, setJoin] = useState({ prospectId: "", policyId: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activePolicies = useMemo(
    () => policies.filter((policy) => policy.status === "PUBLICADA"),
    [policies],
  );
  const run = async (operation: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await operation();
      await onChanged();
      setMessage(success);
    } catch {
      setError("Não foi possível concluir a ação da lista de espera.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-6">
      <Panel>
        <div className="mb-4">
          <h2 className="text-base font-normal text-[var(--text-primary)]">
            Política de espera
          </h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Crie, revise e publique versões explicáveis.
          </p>
        </div>
        <form
          className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              () =>
                createJourneyPolicy({
                  unitId: policyForm.unitId || unitId,
                  programKey: policyForm.programKey,
                  ageGroupMinMonths: Number(policyForm.min),
                  ageGroupMaxMonths: Number(policyForm.max),
                  period: policyForm.period,
                  version: Number(policyForm.version),
                  effectiveFrom: toIso(policyForm.effectiveFrom),
                  priorityDefinition: {
                    criteria: [
                      {
                        key: "desiredDate",
                        label: "Data desejada",
                        points: 10,
                      },
                      {
                        key: "createdAt",
                        label: "Ordem de entrada",
                        points: 1,
                      },
                    ],
                  },
                  idempotencyKey: journeyIdempotencyKey("waitlist-policy"),
                }),
              "Política criada como rascunho.",
            );
          }}
        >
          <label className="min-w-0 text-xs text-[var(--text-secondary)]">
            Unidade
            <select
              required
              className="ds-input mt-1 w-full"
              value={policyForm.unitId || unitId}
              onChange={(event) =>
                setPolicyForm({ ...policyForm, unitId: event.target.value })
              }
            >
              <option value="">Selecione</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 text-xs text-[var(--text-secondary)]">
            Programa
            <input
              required
              className="ds-input mt-1 w-full"
              value={policyForm.programKey}
              onChange={(event) =>
                setPolicyForm({ ...policyForm, programKey: event.target.value })
              }
            />
          </label>
          <label className="min-w-0 text-xs text-[var(--text-secondary)]">
            Faixa (meses)
            <span className="mt-1 flex gap-2">
              <input
                required
                type="number"
                min="0"
                className="ds-input w-full"
                value={policyForm.min}
                onChange={(event) =>
                  setPolicyForm({ ...policyForm, min: event.target.value })
                }
              />
              <input
                required
                type="number"
                min="0"
                className="ds-input w-full"
                value={policyForm.max}
                onChange={(event) =>
                  setPolicyForm({ ...policyForm, max: event.target.value })
                }
              />
            </span>
          </label>
          <label className="min-w-0 text-xs text-[var(--text-secondary)]">
            Período
            <input
              required
              className="ds-input mt-1 w-full"
              value={policyForm.period}
              onChange={(event) =>
                setPolicyForm({ ...policyForm, period: event.target.value })
              }
            />
          </label>
          <label className="min-w-0 text-xs text-[var(--text-secondary)]">
            Versão
            <input
              required
              type="number"
              min="1"
              className="ds-input mt-1 w-full"
              value={policyForm.version}
              onChange={(event) =>
                setPolicyForm({ ...policyForm, version: event.target.value })
              }
            />
          </label>
          <label className="min-w-0 text-xs text-[var(--text-secondary)]">
            Início de vigência
            <input
              required
              type="datetime-local"
              className="ds-input mt-1 w-full"
              value={policyForm.effectiveFrom}
              onChange={(event) =>
                setPolicyForm({
                  ...policyForm,
                  effectiveFrom: event.target.value,
                })
              }
            />
          </label>
          <div className="md:col-span-2 xl:col-span-4">
            <button
              className="ds-btn ds-btn-primary"
              type="submit"
              disabled={busy}
            >
              Criar política
            </button>
          </div>
        </form>
        <Notice text={message} />
        <Notice text={error} error />
      </Panel>
      <Panel>
        <div className="mb-4">
          <h2 className="text-base font-normal text-[var(--text-primary)]">
            Entrar na lista
          </h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            A API calcula e grava a explicação da prioridade.
          </p>
        </div>
        <form
          className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const prospect = prospects.find(
              (item) => item.id === join.prospectId,
            );
            const policy = policies.find((item) => item.id === join.policyId);
            if (!prospect || !policy) return;
            void run(
              () =>
                joinJourneyWaitlist({
                  unitId: prospect.unitId,
                  prospectId: prospect.id,
                  policyId: policy.id,
                  idempotencyKey: journeyIdempotencyKey("waitlist-entry"),
                }),
              "Interessado incluído na lista.",
            );
          }}
        >
          <label className="min-w-0 text-xs text-[var(--text-secondary)]">
            Interessado
            <select
              required
              className="ds-input mt-1 w-full"
              value={join.prospectId}
              onChange={(event) =>
                setJoin({ ...join, prospectId: event.target.value })
              }
            >
              <option value="">Selecione</option>
              {prospects.map((prospect) => (
                <option key={prospect.id} value={prospect.id}>
                  {prospect.responsibleName} · {prospect.childName}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 text-xs text-[var(--text-secondary)]">
            Política publicada
            <select
              required
              className="ds-input mt-1 w-full"
              value={join.policyId}
              onChange={(event) =>
                setJoin({ ...join, policyId: event.target.value })
              }
            >
              <option value="">Selecione</option>
              {activePolicies.map((policy) => (
                <option key={policy.id} value={policy.id}>
                  v{policy.version} · {policy.period} · {policy.unitId}
                </option>
              ))}
            </select>
          </label>
          <ActionButton
            tone="primary"
            disabled={busy}
            onClick={() => {
              const prospect = prospects.find(
                (item) => item.id === join.prospectId,
              );
              const policy = policies.find((item) => item.id === join.policyId);
              if (prospect && policy)
                void run(
                  () =>
                    joinJourneyWaitlist({
                      unitId: prospect.unitId,
                      prospectId: prospect.id,
                      policyId: policy.id,
                      idempotencyKey: journeyIdempotencyKey("waitlist-entry"),
                    }),
                  "Interessado incluído na lista.",
                );
            }}
          >
            Entrar na lista
          </ActionButton>
        </form>
      </Panel>
      <Panel>
        <div className="mb-3">
          <h2 className="text-base font-normal text-[var(--text-primary)]">
            Revisão e publicação
          </h2>
        </div>
        {policies.length ? (
          <div className="space-y-2">
            {policies.map((policy) => (
              <div
                key={policy.id}
                className="flex flex-col gap-3 rounded-lg border border-[var(--border-subtle)] p-3 lg:flex-row lg:items-center lg:justify-between"
              >
                <div>
                  <div className="text-sm text-[var(--text-primary)]">
                    v{policy.version} · {policy.programKey} · {policy.period}
                  </div>
                  <div className="min-w-0 text-xs text-[var(--text-secondary)]">
                    {policy.status} · vigência{" "}
                    {formatDate(policy.effectiveFrom)} · unidade {policy.unitId}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {policy.status === "RASCUNHO" && (
                    <ActionButton
                      disabled={busy !== false}
                      onClick={() =>
                        void run(
                          () => reviewJourneyPolicy(policy.id),
                          "Política revisada.",
                        )
                      }
                    >
                      Revisar
                    </ActionButton>
                  )}
                  {policy.status === "RASCUNHO" && policy.reviewedBy && (
                    <ActionButton
                      tone="primary"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () =>
                            publishJourneyPolicy(
                              policy.id,
                              journeyIdempotencyKey("waitlist-publish"),
                            ),
                          "Política publicada.",
                        )
                      }
                    >
                      Publicar
                    </ActionButton>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-[var(--text-secondary)]">
            Nenhuma política no escopo selecionado.
          </p>
        )}
      </Panel>
      <Panel>
        <div className="mb-3">
          <h2 className="text-base font-normal text-[var(--text-primary)]">
            Lista de espera
          </h2>
        </div>
        {entries.length ? (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="grid gap-2 rounded-lg border border-[var(--border-subtle)] p-3 sm:grid-cols-[minmax(0,1.4fr)_7rem_9rem_minmax(0,1fr)] sm:items-center"
              >
                <div>
                  <div className="text-sm text-[var(--text-primary)]">
                    {entry.prospect.responsibleName}
                  </div>
                  <div className="min-w-0 text-xs text-[var(--text-secondary)]">
                    {entry.prospect.childName} · {entry.prospect.period}
                  </div>
                </div>
                <div className="text-sm text-[var(--text-primary)]">
                  {entry.priorityScore} pts
                </div>
                <div className="min-w-0 text-xs text-[var(--text-secondary)]">
                  Política v{entry.policy.version} · {entry.status}
                </div>
                <div className="text-xs text-[var(--text-tertiary)]">
                  {Array.isArray(entry.explanation.criteria)
                    ? (
                        entry.explanation.criteria as Array<{
                          explanation?: string;
                        }>
                      )
                        .map((item) => item.explanation)
                        .filter(Boolean)
                        .join(" · ")
                    : "Explicação registrada"}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-[var(--text-secondary)]">
            Nenhuma entrada aguardando vaga.
          </p>
        )}
      </Panel>
    </section>
  );
}

export function JourneyOffersPanel({
  offers,
  prospects,
  capacity,
  waitlist,
  units,
  unitId,
  onChanged,
}: {
  offers: JourneyOffer[];
  prospects: JourneyProspect[];
  capacity: JourneyDashboard["capacity"];
  waitlist: JourneyWaitlistEntry[];
  units: JourneyUnit[];
  unitId: string;
  onChanged: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    unitId,
    prospectId: "",
    classroomId: "",
    waitlistEntryId: "",
    reservationExpiresAt: "",
    overrideReason: "",
  });
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (operation: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await operation();
      await onChanged();
      setMessage(success);
    } catch {
      setError(
        "Não foi possível concluir a oferta. A capacidade pode ter mudado ou a oferta expirou.",
      );
    } finally {
      setBusy(false);
    }
  };
  const rows = capacity.filter(
    (row) => !form.unitId || row.unitId === form.unitId,
  );
  return (
    <section className="space-y-6">
      <Panel>
        <div className="mb-4">
          <h2 className="text-base font-normal text-[var(--text-primary)]">
            Oferecer vaga
          </h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            A turma vem da capacidade real. Override só é aceito com
            justificativa e permissão central.
          </p>
        </div>
        <form
          className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (
              !form.prospectId ||
              !form.classroomId ||
              !form.reservationExpiresAt
            )
              return;
            void run(
              () =>
                createJourneyOffer({
                  unitId: form.unitId || unitId,
                  prospectId: form.prospectId,
                  classroomId: form.classroomId,
                  waitlistEntryId: form.waitlistEntryId || undefined,
                  reservationExpiresAt: toIso(form.reservationExpiresAt),
                  overrideReason: form.overrideReason || undefined,
                  idempotencyKey: journeyIdempotencyKey("offer"),
                }),
              "Oferta criada.",
            );
          }}
        >
          <label className="min-w-0 text-xs text-[var(--text-secondary)]">
            Unidade
            <select
              required
              className="ds-input mt-1 w-full"
              value={form.unitId || unitId}
              onChange={(event) =>
                setForm({
                  ...form,
                  unitId: event.target.value,
                  classroomId: "",
                })
              }
            >
              <option value="">Selecione</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 text-xs text-[var(--text-secondary)]">
            Interessado
            <select
              required
              className="ds-input mt-1 w-full"
              value={form.prospectId}
              onChange={(event) =>
                setForm({ ...form, prospectId: event.target.value })
              }
            >
              <option value="">Selecione</option>
              {prospects
                .filter(
                  (prospect) => !form.unitId || prospect.unitId === form.unitId,
                )
                .map((prospect) => (
                  <option key={prospect.id} value={prospect.id}>
                    {prospect.responsibleName} · {prospect.childName}
                  </option>
                ))}
            </select>
          </label>
          <label className="min-w-0 text-xs text-[var(--text-secondary)]">
            Turma real
            <select
              required
              className="ds-input mt-1 w-full"
              value={form.classroomId}
              onChange={(event) =>
                setForm({ ...form, classroomId: event.target.value })
              }
            >
              <option value="">Selecione</option>
              {rows.map((row) => (
                <option key={row.classroomId} value={row.classroomId}>
                  {row.name} · {row.availableBeforeJourneyReservations} livres
                  antes de reservas
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 text-xs text-[var(--text-secondary)]">
            Entrada da espera
            <select
              className="ds-input mt-1 w-full"
              value={form.waitlistEntryId}
              onChange={(event) =>
                setForm({ ...form, waitlistEntryId: event.target.value })
              }
            >
              <option value="">Sem vínculo</option>
              {waitlist
                .filter(
                  (entry) =>
                    entry.prospect.id === form.prospectId &&
                    entry.status === "AGUARDANDO",
                )
                .map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    Prioridade {entry.priorityScore} · v{entry.policy.version}
                  </option>
                ))}
            </select>
          </label>
          <label className="min-w-0 text-xs text-[var(--text-secondary)]">
            Expira em
            <input
              required
              type="datetime-local"
              className="ds-input mt-1 w-full"
              value={form.reservationExpiresAt}
              onChange={(event) =>
                setForm({ ...form, reservationExpiresAt: event.target.value })
              }
            />
          </label>
          <label className="min-w-0 text-xs text-[var(--text-secondary)]">
            Justificativa de override
            <input
              className="ds-input mt-1 w-full"
              maxLength={500}
              value={form.overrideReason}
              onChange={(event) =>
                setForm({ ...form, overrideReason: event.target.value })
              }
              placeholder="Somente quando autorizado"
            />
          </label>
          <div className="md:col-span-2 xl:col-span-3">
            <button
              className="ds-btn ds-btn-primary"
              type="submit"
              disabled={busy}
            >
              Criar oferta
            </button>
          </div>
        </form>
        <Notice text={message} />
        <Notice text={error} error />
      </Panel>
      <Panel>
        <div className="mb-3">
          <h2 className="text-base font-normal text-[var(--text-primary)]">
            Ofertas de vaga
          </h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Aceite cria apenas um rascunho de matrícula incompleto.
          </p>
        </div>
        {offers.length ? (
          <div className="space-y-3">
            {offers.map((offer) => {
              const decisionReason = reasons[offer.id] ?? "";
              const active = offer.status === "OFERTADA";
              return (
                <div
                  key={offer.id}
                  className="rounded-lg border border-[var(--border-subtle)] p-3"
                >
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-sm text-[var(--text-primary)]">
                        {offer.prospect?.responsibleName ?? "Responsável"} ·{" "}
                        {offer.prospect?.childName ?? "Criança"}
                      </div>
                      <div className="min-w-0 text-xs text-[var(--text-secondary)]">
                        {offer.classroom?.name ?? offer.classroomId} · expira{" "}
                        {formatDate(offer.reservationExpiresAt, true)}
                      </div>
                    </div>
                    <span className="ds-badge ds-badge-blue">
                      {offer.status}
                    </span>
                  </div>
                  {active && (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <input
                        className="ds-input min-w-0 flex-1 sm:w-auto"
                        placeholder="Motivo da decisão (opcional)"
                        value={decisionReason}
                        onChange={(event) =>
                          setReasons((current) => ({
                            ...current,
                            [offer.id]: event.target.value,
                          }))
                        }
                      />
                      <ActionButton
                        tone="primary"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () =>
                              decideJourneyOffer(offer.id, {
                                decision: "accept",
                                reason: decisionReason || undefined,
                                idempotencyKey:
                                  journeyIdempotencyKey("offer-accept"),
                              }),
                            "Oferta aceita; rascunho incompleto criado.",
                          )
                        }
                      >
                        Aceitar
                      </ActionButton>
                      <ActionButton
                        tone="danger"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () =>
                              decideJourneyOffer(offer.id, {
                                decision: "reject",
                                reason: decisionReason || undefined,
                                idempotencyKey:
                                  journeyIdempotencyKey("offer-reject"),
                              }),
                            "Oferta recusada.",
                          )
                        }
                      >
                        Recusar
                      </ActionButton>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-[var(--text-secondary)]">
            Nenhuma oferta no escopo selecionado.
          </p>
        )}
      </Panel>
    </section>
  );
}

export function JourneyDuplicatesPanel({
  reviews,
  onChanged,
}: {
  reviews: JourneyDuplicateReview[];
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const run = async (operation: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await operation();
      await onChanged();
      setMessage(success);
    } catch {
      setError("Não foi possível atualizar a revisão de duplicidade.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel>
      <div className="mb-3">
        <h2 className="text-base font-normal text-[var(--text-primary)]">
          Revisões de duplicidade
        </h2>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          Nenhuma fusão é automática: a decisão fica registrada por operador.
        </p>
      </div>
      <Notice text={message} />
      <Notice text={error} error />
      {reviews.length ? (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="rounded-lg border border-[var(--border-subtle)] p-3"
            >
              <div className="text-sm text-[var(--text-primary)]">
                {review.primary?.responsibleName ?? review.primaryProspectId} ↔{" "}
                {review.duplicate?.responsibleName ??
                  review.duplicateProspectId}
              </div>
              <div className="mt-1 text-xs text-[var(--text-secondary)]">
                {review.primary?.childName ?? ""} · motivos:{" "}
                {review.matchReasons.join(", ")} · {review.status}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {review.status === "PENDENTE" && (
                  <>
                    <ActionButton
                      tone="primary"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () => reviewJourneyDuplicate(review.id, "confirm"),
                          "Duplicidade confirmada.",
                        )
                      }
                    >
                      Confirmar duplicidade
                    </ActionButton>
                    <ActionButton
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () => reviewJourneyDuplicate(review.id, "reject"),
                          "Duplicidade rejeitada.",
                        )
                      }
                    >
                      Rejeitar
                    </ActionButton>
                  </>
                )}
                {review.status === "CONFIRMADA" && (
                  <ActionButton
                    tone="danger"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => undoJourneyDuplicate(review.id),
                        "Revisão desfeita.",
                      )
                    }
                  >
                    Desfazer revisão
                  </ActionButton>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-[var(--text-secondary)]">
          Nenhuma duplicidade pendente.
        </p>
      )}
    </Panel>
  );
}
