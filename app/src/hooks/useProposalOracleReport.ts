import { useCallback, useState } from "react";

export interface ProposalOracleReport {
  proposalKey: string;
  videoId: string;
  actualViews: number;
  reportDigestHex: string;
  generatedAtIso: string;
}

interface UseProposalOracleReportState {
  loading: boolean;
  error: string | null;
  report: ProposalOracleReport | null;
}

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? "http://localhost:4000";

export const useProposalOracleReport = () => {
  const [state, setState] = useState<UseProposalOracleReportState>({
    loading: false,
    error: null,
    report: null,
  });

  const loadReport = useCallback(async (proposalKey: string, videoId: string) => {
    setState({ loading: true, error: null, report: null });

    try {
      const response = await fetch(
        `${BACKEND_BASE_URL}/api/events/reports/${encodeURIComponent(proposalKey)}/${encodeURIComponent(videoId)}`
      );

      if (!response.ok) {
        throw new Error(`request failed (${response.status})`);
      }

      const json = (await response.json()) as ProposalOracleReport;
      setState({ loading: false, error: null, report: json });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      setState({ loading: false, error: message, report: null });
    }
  }, []);

  return {
    ...state,
    loadReport,
  };
};
