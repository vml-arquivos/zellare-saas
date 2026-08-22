-- Migration additive: adicionar campos de imagem, tags e indicadores ao DevelopmentObservation
-- Regra de Ouro: ZERO DROP, ZERO DELETE FROM, apenas ADD COLUMN IF NOT EXISTS
-- Em bancos vazios a tabela pode ser criada por uma migration posterior; o ajuste
-- deve ser reaplicado quando a relação existir no histórico legado.

DO $$
BEGIN
  IF to_regclass('public.DevelopmentObservation') IS NOT NULL THEN
    ALTER TABLE "DevelopmentObservation" ADD COLUMN IF NOT EXISTS "atividade_arquivo_url" TEXT;
    ALTER TABLE "DevelopmentObservation" ADD COLUMN IF NOT EXISTS "atividade_arquivo_nome" VARCHAR(255);
    ALTER TABLE "DevelopmentObservation" ADD COLUMN IF NOT EXISTS "tags" JSONB NOT NULL DEFAULT '[]';
    ALTER TABLE "DevelopmentObservation" ADD COLUMN IF NOT EXISTS "indicadores" JSONB NOT NULL DEFAULT '{}';
  END IF;
END $$;
