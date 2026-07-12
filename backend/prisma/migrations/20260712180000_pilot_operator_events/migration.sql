CREATE TABLE "PilotOperatorEvent" (
  "id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "operatorIdentity" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "reason" TEXT,
  "evidenceDigestHex" TEXT,
  "payloadJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PilotOperatorEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PilotOperatorEvent_resourceType_resourceId_createdAt_idx"
  ON "PilotOperatorEvent"("resourceType", "resourceId", "createdAt");
CREATE INDEX "PilotOperatorEvent_action_createdAt_idx"
  ON "PilotOperatorEvent"("action", "createdAt");
CREATE INDEX "PilotOperatorEvent_operatorIdentity_createdAt_idx"
  ON "PilotOperatorEvent"("operatorIdentity", "createdAt");
