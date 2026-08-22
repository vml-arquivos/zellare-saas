import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JourneyVisitsPanel } from "./JourneyActionPanels";
import { confirmJourneyVisit, createJourneyVisit } from "../api/journey";

vi.mock("../api/journey", () => ({
  cancelJourneyVisit: vi.fn(),
  confirmJourneyVisit: vi.fn(),
  createJourneyOffer: vi.fn(),
  createJourneyPolicy: vi.fn(),
  createJourneyVisit: vi.fn(),
  decideJourneyOffer: vi.fn(),
  joinJourneyWaitlist: vi.fn(),
  journeyIdempotencyKey: (prefix: string) => `${prefix}-test`,
  markJourneyVisitAbsence: vi.fn(),
  publishJourneyPolicy: vi.fn(),
  registerJourneyVisitFollowUp: vi.fn(),
  rescheduleJourneyVisit: vi.fn(),
  reviewJourneyDuplicate: vi.fn(),
  reviewJourneyPolicy: vi.fn(),
  undoJourneyDuplicate: vi.fn(),
}));

describe("JourneyActionPanels", () => {
  const prospect = {
    id: "prospect-1",
    unitId: "unit-a",
    responsibleName: "Responsável Sintético",
    childName: "Criança Sintética",
    source: "site",
    ageGroupMinMonths: 0,
    ageGroupMaxMonths: 48,
    period: "Integral",
    consentCapture: true,
    consentContact: true,
    stage: "NOVO" as const,
    version: 1,
    createdAt: "2026-08-22T00:00:00.000Z",
    updatedAt: "2026-08-22T00:00:00.000Z",
  };

  it("submete uma visita ao cliente HTTP e relê após sucesso", async () => {
    vi.mocked(createJourneyVisit).mockResolvedValueOnce({ id: "visit-1" } as never);
    const onChanged = vi.fn();
    render(<JourneyVisitsPanel visits={[]} prospects={[prospect]} unitId="unit-a" units={[{ id: "unit-a", name: "Unidade Sintética", code: "SYN", capacity: 10 }]} onChanged={onChanged} />);

    fireEvent.change(screen.getByLabelText("Interessado"), { target: { value: "prospect-1" } });
    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-08-30T10:00" } });
    fireEvent.change(screen.getByLabelText("Fim"), { target: { value: "2026-08-30T11:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Agendar visita" }));

    await waitFor(() => expect(createJourneyVisit).toHaveBeenCalledWith(expect.objectContaining({ prospectId: "prospect-1", unitId: "unit-a" })));
    expect(onChanged).toHaveBeenCalledOnce();
  });

  it("confirma presença por ação persistida", async () => {
    vi.mocked(confirmJourneyVisit).mockResolvedValueOnce({ id: "visit-1", status: "REALIZADA" } as never);
    const onChanged = vi.fn();
    render(<JourneyVisitsPanel visits={[{ id: "visit-1", unitId: "unit-a", prospectId: "prospect-1", startsAt: "2026-08-30T10:00:00.000Z", endsAt: "2026-08-30T11:00:00.000Z", status: "AGENDADA", prospect }]} prospects={[prospect]} unitId="unit-a" units={[]} onChanged={onChanged} />);

    fireEvent.click(screen.getByRole("button", { name: "Confirmar presença" }));

    await waitFor(() => expect(confirmJourneyVisit).toHaveBeenCalledWith("visit-1", expect.objectContaining({ idempotencyKey: "visit-confirm-test" })));
    expect(onChanged).toHaveBeenCalledOnce();
  });
});
