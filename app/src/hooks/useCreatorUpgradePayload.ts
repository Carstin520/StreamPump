import { useCallback, useState } from "react";

export type CreatorUpgradeMetricType = "followers" | "valid_views";

export interface CreatorUpgradePayload {
  creatorWallet: string;
  newLevel: number;
  metricType: CreatorUpgradeMetricType;
  metricValue: number;
  observedAt: number;
  reportIdHex: string;
  reportDigestHex: string;
}

interface UseCreatorUpgradePayloadState {
  loading: boolean;
  error: string | null;
  payload: CreatorUpgradePayload | null;
}

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? "http://localhost:4000";

export const useCreatorUpgradePayload = () => {
  const [state, setState] = useState<UseCreatorUpgradePayloadState>({
    loading: false,
    error: null,
    payload: null,
  });

  const loadPayload = useCallback(
    async (params: {
      creatorWallet: string;
      newLevel: number;
      metricType: CreatorUpgradeMetricType;
      metricValue: number;
      observedAt?: number;
    }) => {
      setState({ loading: true, error: null, payload: null });

      try {
        const response = await fetch(
          `${BACKEND_BASE_URL}/api/users/${encodeURIComponent(params.creatorWallet)}/upgrade-payload`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              newLevel: params.newLevel,
              metricType: params.metricType,
              metricValue: params.metricValue,
              observedAt: params.observedAt,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`request failed (${response.status})`);
        }

        const json = (await response.json()) as CreatorUpgradePayload;
        setState({ loading: false, error: null, payload: json });
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        setState({ loading: false, error: message, payload: null });
      }
    },
    []
  );

  return {
    ...state,
    loadPayload,
  };
};
