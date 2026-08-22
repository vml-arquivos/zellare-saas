import { InsightsService } from "./insights.service";

describe("InsightsService", () => {
  it("inclui o classroomId no planejamento ativo para as ações do professor", async () => {
    const prisma = {
      planning: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue({
          id: "pr22-planning",
          title: "Semana sintética",
          status: "APROVADO",
          description: JSON.stringify({ version: 2, days: [] }),
          startDate: new Date("2026-08-20T00:00:00.000Z"),
          endDate: new Date("2026-08-30T23:59:59.000Z"),
          classroomId: "pr22-classroom",
          classroom: { id: "pr22-classroom", name: "Turma Demo" },
        }),
      },
      classroomTeacher: {
        findMany: jest.fn().mockResolvedValue([
          {
            classroomId: "pr22-classroom",
            classroom: { name: "Turma Demo" },
          },
        ]),
      },
      attendance: { count: jest.fn().mockResolvedValue(0) },
      diaryEvent: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    const service = new InsightsService(prisma as never);
    const result = await service.getTeacherToday({
      sub: "pr22-teacher",
      mantenedoraId: "pr22-tenant",
      unitId: "pr22-unit",
      roles: [{ level: "PROFESSOR" }],
    } as never);

    expect(result.planejamentoAtivo).toMatchObject({
      id: "pr22-planning",
      classroomId: "pr22-classroom",
      turma: "Turma Demo",
    });
  });
});
