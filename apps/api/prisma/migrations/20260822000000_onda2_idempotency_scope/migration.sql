-- Onda 2 / Gate Organizacional 0.3
-- Idempotência é isolada por mantenedora + origem + chave.
-- Não remove dados, tabelas ou colunas e não reescreve histórico.

ALTER TABLE "asset_meter_reading"
  ADD COLUMN "source" VARCHAR(40) NOT NULL DEFAULT 'METER';

ALTER TABLE "maintenance_request"
  ADD COLUMN "source" VARCHAR(40) NOT NULL DEFAULT 'WEB';

ALTER TABLE "preventive_plan_task"
  ADD COLUMN "source" VARCHAR(40) NOT NULL DEFAULT 'SCHEDULER';

ALTER TABLE "staffing_assignment"
  ADD COLUMN "source" VARCHAR(40) NOT NULL DEFAULT 'WEB';

ALTER TABLE "work_order_status_event"
  ADD COLUMN "source" VARCHAR(40) NOT NULL DEFAULT 'WEB';

DROP INDEX IF EXISTS "asset_meter_reading_idempotencyKey_key";
DROP INDEX IF EXISTS "maintenance_request_idempotencyKey_key";
DROP INDEX IF EXISTS "operational_presence_event_idempotencyKey_key";
DROP INDEX IF EXISTS "preventive_plan_task_idempotencyKey_key";
DROP INDEX IF EXISTS "staffing_assignment_idempotencyKey_key";
DROP INDEX IF EXISTS "work_order_status_event_idempotencyKey_key";

CREATE UNIQUE INDEX "asset_meter_reading_mantenedoraId_source_idempotencyKey_key"
  ON "asset_meter_reading"("mantenedoraId", "source", "idempotencyKey");

CREATE UNIQUE INDEX "maintenance_request_mantenedoraId_source_idempotencyKey_key"
  ON "maintenance_request"("mantenedoraId", "source", "idempotencyKey");

CREATE UNIQUE INDEX "operational_presence_event_mantenedoraId_source_idempotency_key"
  ON "operational_presence_event"("mantenedoraId", "source", "idempotencyKey");

CREATE UNIQUE INDEX "preventive_plan_task_mantenedoraId_source_idempotencyKey_key"
  ON "preventive_plan_task"("mantenedoraId", "source", "idempotencyKey");

CREATE UNIQUE INDEX "staffing_assignment_mantenedoraId_source_idempotencyKey_key"
  ON "staffing_assignment"("mantenedoraId", "source", "idempotencyKey");

CREATE UNIQUE INDEX "work_order_status_event_mantenedoraId_source_idempotencyKey_key"
  ON "work_order_status_event"("mantenedoraId", "source", "idempotencyKey");

-- Rollback manual: remover os seis índices compostos e as cinco colunas source;
-- re-criar os seis índices globais somente após confirmar ausência de colisões.
