import { useCallback, useEffect, useRef, useState } from "react";

export type DemoActionStatus = "idle" | "confirming" | "submitted" | "success" | "failed";

export type DemoActionState = {
  status: DemoActionStatus;
  error: string | null;
};

type SubmitOptions = {
  fail?: boolean;
  onSuccess?: () => void;
};

export const useDemoActionFlow = (successDelayMs = 700) => {
  const timeoutRef = useRef<number | null>(null);
  const [state, setState] = useState<DemoActionState>({ status: "idle", error: null });

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    setState({ status: "idle", error: null });
  }, [clearTimer]);

  const begin = useCallback(() => {
    clearTimer();
    setState({ status: "confirming", error: null });
  }, [clearTimer]);

  const submit = useCallback(
    ({ fail = false, onSuccess }: SubmitOptions = {}) => {
      clearTimer();
      setState({ status: "submitted", error: null });
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
        if (fail) {
          setState({
            status: "failed",
            error: "Demo failure simulated. Retry to continue the presentation.",
          });
          return;
        }
        onSuccess?.();
        setState({ status: "success", error: null });
      }, successDelayMs);
    },
    [clearTimer, successDelayMs],
  );

  const simulateFail = useCallback(() => {
    clearTimer();
    setState({
      status: "failed",
      error: "Demo failure simulated. Retry to continue the presentation.",
    });
  }, [clearTimer]);

  return {
    begin,
    busy: state.status === "submitted",
    reset,
    retry: begin,
    simulateFail,
    state,
    submit,
  };
};
