-- Normaliza nomes de índices legados criados por migrations históricas.
-- A operação é aditiva/metadata-only: não altera dados, colunas ou constraints.
-- Cada rename só ocorre quando o índice legado existe e o nome canônico ainda não existe.

DO $$
DECLARE
  item RECORD;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('ClassroomPost_classroomId_idx', 'classroom_post_classroom_id_idx'),
      ('ClassroomPost_mantenedoraId_idx', 'classroom_post_mantenedora_id_idx'),
      ('ClassroomPostFile_postId_idx', 'classroom_post_file_post_id_idx'),
      ('DevelopmentObservation_category_idx', 'development_observation_category_idx'),
      ('DevelopmentObservation_childId_idx', 'development_observation_child_id_idx'),
      ('DevelopmentObservation_classroomId_idx', 'development_observation_classroom_id_idx'),
      ('DevelopmentObservation_createdBy_idx', 'development_observation_created_by_idx'),
      ('DevelopmentObservation_date_idx', 'development_observation_date_idx'),
      ('DevelopmentReport_childId_createdAt_idx', 'development_report_childId_createdAt_idx'),
      ('DevelopmentReport_classroomId_period_idx', 'development_report_classroomId_period_idx'),
      ('RdicDocumentEvent_eventType_idx', 'rdic_document_event_eventType_idx'),
      ('RdicDocumentEvent_instanciaId_createdAt_idx', 'rdic_document_event_instanciaId_createdAt_idx'),
      ('RdicDocumentEvent_mantenedoraId_createdAt_idx', 'rdic_document_event_mantenedoraId_createdAt_idx'),
      ('RdicDocumentEvent_unitId_createdAt_idx', 'rdic_document_event_unitId_createdAt_idx'),
      ('RecadoLeitura_recadoId_idx', 'recado_leitura_recado_id_idx'),
      ('RecadoLeitura_recadoId_userId_key', 'recado_leitura_recado_id_user_id_key'),
      ('RecadoLeitura_userId_idx', 'recado_leitura_user_id_idx'),
      ('RecadoTurma_classroomId_idx', 'recado_turma_classroom_id_idx'),
      ('RecadoTurma_criadoPorId_idx', 'recado_turma_criado_por_id_idx'),
      ('RecadoTurma_destinatario_idx', 'recado_turma_destinatario_idx'),
      ('RecadoTurma_expiresAt_idx', 'recado_turma_expires_at_idx'),
      ('RecadoTurma_mantenedoraId_idx', 'recado_turma_mantenedora_id_idx'),
      ('RecadoTurma_unitId_idx', 'recado_turma_unit_id_idx'),
      ('StudentPostPerformance_childId_idx', 'student_post_performance_child_id_idx'),
      ('StudentPostPerformance_postId_childId_key', 'student_post_performance_post_id_child_id_key'),
      ('StudentPostPerformance_postId_idx', 'student_post_performance_post_id_idx')
    ) AS names(legacy_name, canonical_name)
  LOOP
    IF to_regclass(format('%I', item.legacy_name)) IS NOT NULL
       AND to_regclass(format('%I', item.canonical_name)) IS NULL THEN
      EXECUTE format('ALTER INDEX %I RENAME TO %I', item.legacy_name, item.canonical_name);
    END IF;
  END LOOP;
END $$;
