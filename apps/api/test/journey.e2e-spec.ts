import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

type Authenticated = { accessToken: string };

const password = process.env.JOURNEY_E2E_PASSWORD ?? "journey-e2e-password";
const users = {
  admin: "journey-admin@example.invalid",
  admissions: "journey-admissions@example.invalid",
  director: "journey-director@example.invalid",
  pedagogy: "journey-pedagogy@example.invalid",
};

async function login(
  app: INestApplication<App>,
  email: string,
): Promise<Authenticated> {
  const response = await request(app.getHttpServer())
    .post("/auth/login")
    .send({ email, password })
    .expect(200);
  expect(response.body.accessToken).toEqual(expect.any(String));
  return response.body as Authenticated;
}

describe("Journey autenticado — fixture PostgreSQL descartável", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let admin: Authenticated;
  let admissions: Authenticated;
  let director: Authenticated;
  let pedagogy: Authenticated;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    admin = await login(app, users.admin);
    admissions = await login(app, users.admissions);
    director = await login(app, users.director);
    pedagogy = await login(app, users.pedagogy);
  });

  afterAll(async () => {
    await prisma.tenantFeatureFlag.updateMany({
      where: {
        mantenedoraId: "journey-e2e-org",
        flagKey: "journey_admissions_v1",
      },
      data: { enabled: true },
    });
    await app.close();
  });

  it("aplica RBAC granular por endpoint e não permite coordenação pedagógica", async () => {
    await request(app.getHttpServer())
      .get("/journey/units")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get("/journey/prospects")
      .set("Authorization", `Bearer ${admissions.accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get("/journey/prospects")
      .set("Authorization", `Bearer ${pedagogy.accessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .post("/journey/prospects")
      .set("Authorization", `Bearer ${pedagogy.accessToken}`)
      .send({})
      .expect(403);
  });

  it("mantém escopo tenant/unidade/turma, mascara contato e não devolve hashes/ciphertext", async () => {
    const response = await request(app.getHttpServer())
      .get("/journey/prospects/journey-e2e-prospect-a")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(response.body.email).toBe("a***@example.invalid");
    expect(response.body.phone).toBe("***01");
    expect(response.body.emailHash).toBeUndefined();
    expect(response.body.phoneHash).toBeUndefined();
    expect(response.body.emailCiphertext).toBeUndefined();
    expect(response.body.phoneCiphertext).toBeUndefined();
    expect(response.body.privacy).toMatchObject({
      captureLegalBasis: "CONSENT",
      contactLegalBasis: "CONSENT",
      consentPolicyVersion: "journey-privacy-v1",
    });

    await request(app.getHttpServer())
      .get("/journey/prospects/not-from-this-tenant")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .get("/journey/prospects/journey-e2e-foreign-prospect")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .get("/journey/prospects/journey-e2e-isolated-prospect")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .post("/journey/offers")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        unitId: "journey-e2e-unit",
        prospectId: "journey-e2e-prospect-a",
        classroomId: "journey-e2e-isolated-class",
        reservationExpiresAt: "2026-09-15T23:59:59.000Z",
        idempotencyKey: "journey-e2e-isolated-classroom",
      })
      .expect(404);
    await request(app.getHttpServer())
      .post("/journey/offers")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        unitId: "journey-e2e-foreign-unit",
        prospectId: "journey-e2e-foreign-prospect",
        classroomId: "journey-e2e-foreign-class",
        reservationExpiresAt: "2026-09-15T23:59:59.000Z",
        idempotencyKey: "journey-e2e-foreign-classroom",
      })
      .expect(404);
  });

  it("rejeita payload adulterado sem consentimento no servidor", async () => {
    await request(app.getHttpServer())
      .post("/journey/prospects")
      .set("Authorization", `Bearer ${admissions.accessToken}`)
      .send({
        responsibleName: "Teste Sintético",
        childName: "Criança Sintética",
        email: "tampered@example.invalid",
        unitId: "journey-e2e-unit",
        ageGroupMinMonths: 0,
        ageGroupMaxMonths: 48,
        period: "Integral",
        source: "Site",
        consentCapture: false,
        consentContact: false,
        idempotencyKey: "journey-e2e-tampered-consent",
      })
      .expect(400);
  });

  it("respeita flag desligada e volta a operar após reativação sintética", async () => {
    await prisma.tenantFeatureFlag.updateMany({
      where: {
        mantenedoraId: "journey-e2e-org",
        flagKey: "journey_admissions_v1",
      },
      data: { enabled: false },
    });
    await request(app.getHttpServer())
      .get("/journey/units")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(403);
    await prisma.tenantFeatureFlag.updateMany({
      where: {
        mantenedoraId: "journey-e2e-org",
        flagKey: "journey_admissions_v1",
      },
      data: { enabled: true },
    });
    await request(app.getHttpServer())
      .get("/journey/units")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);
  });

  it("exige revisão e publicação por atores diferentes", async () => {
    const created = await request(app.getHttpServer())
      .post("/journey/waitlist/policies")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        unitId: "journey-e2e-unit",
        programKey: "e2e-sintetico",
        ageGroupMinMonths: 0,
        ageGroupMaxMonths: 48,
        period: "Integral",
        version: 2,
        effectiveFrom: "2026-09-01T00:00:00.000Z",
        priorityDefinition: {
          ageGroupMatch: true,
          periodMatch: true,
          desiredDate: true,
          createdAt: true,
        },
        idempotencyKey: "journey-e2e-policy-sod",
      })
      .expect(201);
    const policyId = created.body.id as string;
    await request(app.getHttpServer())
      .patch(`/journey/waitlist/policies/${policyId}/review`)
      .set("Authorization", `Bearer ${admissions.accessToken}`)
      .expect(200);
    const published = await request(app.getHttpServer())
      .patch(`/journey/waitlist/policies/${policyId}/publish`)
      .set("Authorization", `Bearer ${director.accessToken}`)
      .send({ idempotencyKey: "journey-e2e-policy-publish" })
      .expect(200);
    expect(published.body).toMatchObject({
      status: "PUBLICADA",
      createdBy: expect.not.stringMatching(/journey-director/),
      reviewedBy: expect.not.stringMatching(/journey-director/),
      publishedBy: expect.any(String),
    });
  });

  it("executa mutações de atividade, tarefa, visita, espera, oferta e undo em fluxo real", async () => {
    const created = await request(app.getHttpServer())
      .post("/journey/prospects")
      .set("Authorization", `Bearer ${admissions.accessToken}`)
      .send({
        responsibleName: "Fluxo Sintético",
        childName: "Criança Fluxo",
        email: "fluxo@example.invalid",
        phone: "+55 61 99999-0044",
        unitId: "journey-e2e-unit",
        ageGroupMinMonths: 12,
        ageGroupMaxMonths: 36,
        period: "Parcial",
        source: "E2E",
        consentCapture: true,
        consentContact: true,
        captureLegalBasis: "CONSENT",
        contactLegalBasis: "CONSENT",
        consentPolicyVersion: "journey-privacy-v1",
        retentionUntil: "2027-12-01T00:00:00.000Z",
        idempotencyKey: "journey-e2e-flow-prospect",
      })
      .expect(201);
    const prospectId = created.body.prospect.id as string;

    const activity = await request(app.getHttpServer())
      .post(`/journey/prospects/${prospectId}/activities`)
      .set("Authorization", `Bearer ${admissions.accessToken}`)
      .send({
        type: "NOTA",
        title: "Nota de fluxo sintético",
        note: "Registro sem dados reais.",
        idempotencyKey: "journey-e2e-flow-activity",
      })
      .expect(201);
    const activityReplay = await request(app.getHttpServer())
      .post(`/journey/prospects/${prospectId}/activities`)
      .set("Authorization", `Bearer ${admissions.accessToken}`)
      .send({
        type: "NOTA",
        title: "Nota de fluxo sintético",
        note: "Registro sem dados reais.",
        idempotencyKey: "journey-e2e-flow-activity",
      })
      .expect(201);
    expect(activityReplay.body.id).toBe(activity.body.id);

    const task = await request(app.getHttpServer())
      .post(`/journey/prospects/${prospectId}/tasks`)
      .set("Authorization", `Bearer ${admissions.accessToken}`)
      .send({
        title: "Retorno sintético",
        assignedTo: "journey-e2e-admissions-user",
        idempotencyKey: "journey-e2e-flow-task",
      })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/journey/tasks/${task.body.id as string}/complete`)
      .set("Authorization", `Bearer ${admissions.accessToken}`)
      .expect(200);

    const visit = await request(app.getHttpServer())
      .post("/journey/visits")
      .set("Authorization", `Bearer ${admissions.accessToken}`)
      .send({
        prospectId,
        unitId: "journey-e2e-unit",
        startsAt: "2026-09-10T14:00:00.000Z",
        endsAt: "2026-09-10T14:30:00.000Z",
        assignedTo: "journey-e2e-admissions-user",
        notes: "Visita de fluxo sintético.",
        idempotencyKey: "journey-e2e-flow-visit",
      })
      .expect(201);
    const visitId = visit.body.id as string;
    await request(app.getHttpServer())
      .patch(`/journey/visits/${visitId}/reschedule`)
      .set("Authorization", `Bearer ${admissions.accessToken}`)
      .send({
        startsAt: "2026-09-11T14:00:00.000Z",
        endsAt: "2026-09-11T14:30:00.000Z",
        idempotencyKey: "journey-e2e-flow-reschedule",
      })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/journey/visits/${visitId}/confirm`)
      .set("Authorization", `Bearer ${admissions.accessToken}`)
      .send({ idempotencyKey: "journey-e2e-flow-confirm" })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/journey/visits/${visitId}/follow-up`)
      .set("Authorization", `Bearer ${admissions.accessToken}`)
      .send({
        note: "Follow-up sintético.",
        idempotencyKey: "journey-e2e-flow-follow-up",
      })
      .expect(200);

    const waitlist = await request(app.getHttpServer())
      .post("/journey/waitlist")
      .set("Authorization", `Bearer ${admissions.accessToken}`)
      .send({
        unitId: "journey-e2e-unit",
        prospectId,
        policyId: "journey-e2e-policy",
        idempotencyKey: "journey-e2e-flow-waitlist",
      })
      .expect(201);
    expect(waitlist.body.status).toBe("AGUARDANDO");

    const offer = await request(app.getHttpServer())
      .post("/journey/offers")
      .set("Authorization", `Bearer ${director.accessToken}`)
      .send({
        unitId: "journey-e2e-unit",
        prospectId,
        classroomId: "journey-e2e-class",
        waitlistEntryId: waitlist.body.id as string,
        reservationExpiresAt: "2026-09-15T23:59:59.000Z",
        idempotencyKey: "journey-e2e-flow-offer",
      })
      .expect(201);
    const offerId = offer.body.id as string;
    const accepted = await request(app.getHttpServer())
      .patch(`/journey/offers/${offerId}/decision`)
      .set("Authorization", `Bearer ${director.accessToken}`)
      .send({ decision: "accept", idempotencyKey: "journey-e2e-flow-accept" })
      .expect(200);
    expect(accepted.body.offer.status).toBe("ACEITA");

    const duplicate = await prisma.journeyDuplicateReview.create({
      data: {
        mantenedoraId: "journey-e2e-org",
        primaryProspectId: "journey-e2e-prospect-a",
        duplicateProspectId: "journey-e2e-prospect-b",
        matchReasons: ["synthetic-test"],
        previousStage: "LISTA_ESPERA",
        idempotencyKey: "journey-e2e-flow-duplicate",
      },
    });
    await request(app.getHttpServer())
      .patch(`/journey/duplicates/${duplicate.id}/review`)
      .set("Authorization", `Bearer ${director.accessToken}`)
      .send({ decision: "confirm", idempotencyKey: "journey-e2e-flow-review" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/journey/duplicates/${duplicate.id}/undo`)
      .set("Authorization", `Bearer ${director.accessToken}`)
      .send({ idempotencyKey: "journey-e2e-flow-undo" })
      .expect(201);
    await request(app.getHttpServer())
      .get("/journey/prospects/journey-e2e-prospect-b")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200)
      .expect(({ body }) => expect(body.stage).toBe("LISTA_ESPERA"));
  });

  it("persiste retenção, revogação de contato e eliminação lógica após reload", async () => {
    const created = await request(app.getHttpServer())
      .post("/journey/prospects")
      .set("Authorization", `Bearer ${admissions.accessToken}`)
      .send({
        responsibleName: "Persistência Sintética",
        childName: "Criança Persistente",
        email: "persist@example.invalid",
        phone: "+55 61 99999-0033",
        unitId: "journey-e2e-unit",
        ageGroupMinMonths: 12,
        ageGroupMaxMonths: 36,
        period: "Integral",
        source: "Site",
        consentCapture: true,
        consentContact: true,
        captureLegalBasis: "CONSENT",
        contactLegalBasis: "CONSENT",
        consentPolicyVersion: "journey-privacy-v1",
        retentionUntil: "2027-08-22T12:00:00.000Z",
        idempotencyKey: "journey-e2e-privacy-prospect",
      })
      .expect(201);
    const prospectId = created.body.prospect.id as string;
    await request(app.getHttpServer())
      .patch(`/journey/prospects/${prospectId}/privacy/retention`)
      .set("Authorization", `Bearer ${director.accessToken}`)
      .send({
        retentionUntil: "2027-12-01T00:00:00.000Z",
        reason: "Auditoria sintética",
        idempotencyKey: "journey-e2e-retention",
      })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/journey/prospects/${prospectId}/privacy/contact/revoke`)
      .set("Authorization", `Bearer ${director.accessToken}`)
      .send({
        reason: "Solicitação sintética",
        idempotencyKey: "journey-e2e-revoke",
      })
      .expect(200);
    const afterRevoke = await request(app.getHttpServer())
      .get(`/journey/prospects/${prospectId}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(afterRevoke.body.email).toBeUndefined();
    expect(afterRevoke.body.phone).toBeUndefined();
    await request(app.getHttpServer())
      .patch(`/journey/prospects/${prospectId}/privacy/erase`)
      .set("Authorization", `Bearer ${director.accessToken}`)
      .send({
        reason: "Eliminação sintética",
        idempotencyKey: "journey-e2e-erase",
      })
      .expect(200)
      .expect(({ body }) => expect(body.status).toBe("ERASED"));
    await request(app.getHttpServer())
      .get(`/journey/prospects/${prospectId}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(410);
    await expect(
      prisma.journeyProspectPrivacyEvent.count({ where: { prospectId } }),
    ).resolves.toBeGreaterThanOrEqual(3);
  });
});
