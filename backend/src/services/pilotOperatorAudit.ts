import { Prisma } from "@prisma/client";

export const recordPilotOperatorEvent = async (
  tx: Prisma.TransactionClient,
  params: {
    action: string;
    operatorIdentity: string;
    resourceType: string;
    resourceId: string;
    reason?: string | null;
    evidenceDigestHex?: string | null;
    payload?: Prisma.InputJsonValue;
  }
) =>
  tx.pilotOperatorEvent.create({
    data: {
      action: params.action,
      operatorIdentity: params.operatorIdentity,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      reason: params.reason?.trim() || null,
      evidenceDigestHex: params.evidenceDigestHex?.trim().toLowerCase() || null,
      payloadJson: params.payload,
    },
  });
