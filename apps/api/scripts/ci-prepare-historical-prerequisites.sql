-- Fixture somente estrutural para o PostgreSQL efêmero do Gate 0.2.
-- Não contém dados de pessoas e nunca deve ser executada em produção.
-- A migration 20260223 assume estas relações legadas pré-existentes.

CREATE TABLE IF NOT EXISTS "development_observation" (
  "id" TEXT NOT NULL,
  "child_id" TEXT NOT NULL,
  "created_by" VARCHAR(255) NOT NULL,
  "category" VARCHAR(100) NOT NULL DEFAULT 'GERAL',
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "behavior_description" TEXT,
  "social_interaction" TEXT,
  "emotional_state" TEXT,
  "motor_skills" TEXT,
  "cognitive_skills" TEXT,
  "language_skills" TEXT,
  "health_notes" TEXT,
  "dietary_notes" TEXT,
  "sleep_pattern" TEXT,
  "learning_progress" TEXT,
  "interests" TEXT,
  "challenges" TEXT,
  "recommendations" TEXT,
  "next_steps" TEXT,
  "atividade_arquivo_url" TEXT,
  "atividade_arquivo_nome" VARCHAR(255),
  "tags" JSONB NOT NULL DEFAULT '[]',
  "indicadores" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ci_development_observation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "development_report" (
  "id" TEXT NOT NULL,
  "child_id" TEXT NOT NULL,
  "author_id" TEXT NOT NULL,
  "classroom_id" TEXT NOT NULL,
  "unit_id" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "published_at" TIMESTAMP(3),
  "start_date" TIMESTAMP(3),
  "end_date" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ci_development_report_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "material_request_item" (
  "id" TEXT NOT NULL,
  "request_id" TEXT,
  "material_id" TEXT,
  "quantity" INTEGER,
  "unit_price" DECIMAL(10,2),
  "total_price" DECIMAL(10,2),
  "observations" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ci_material_request_item_pkey" PRIMARY KEY ("id")
);

-- Outra migration histórica usa o nome PascalCase para a mesma área.
-- A relação é removida somente no fim do teste efêmero, antes do drift.
CREATE TABLE IF NOT EXISTS "DevelopmentObservation" (
  "id" TEXT NOT NULL,
  CONSTRAINT "ci_development_observation_pascal_pkey" PRIMARY KEY ("id")
);
