import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:4000";
const ACTION = __ENV.EXECUTE_ACTION || "claim-daily-spump";
const CREATOR_WALLET = __ENV.CREATOR_WALLET || "";
const SPONSOR_WALLET = __ENV.SPONSOR_WALLET || "";
const S1_AMOUNT = __ENV.S1_AMOUNT || "1";
const ACTIONS_PER_USER = Number(__ENV.ACTIONS_PER_USER || "1");

const jobCompletionMs = new Trend("managed_job_completion_ms", true);
const managedJobSucceeded = new Rate("managed_job_succeeded");

export const options = {
  scenarios: {
    demo_day_scan_burst: {
      executor: "ramping-vus",
      stages: [
        { duration: "30s", target: 100 },
        { duration: "4m", target: 100 },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    "http_req_duration{endpoint:ephemeral_session}": ["p(95)<800"],
    "http_req_failed{endpoint:ephemeral_session}": ["rate<0.005"],
    "http_req_duration{endpoint:managed_execute}": ["p(95)<500"],
    "http_req_failed{endpoint:managed_execute}": ["rate<0.005"],
    managed_job_completion_ms: ["p(95)<15000", "p(99)<30000"],
    managed_job_succeeded: ["rate>=0.98"],
  },
};

const buildParams = () => {
  if (ACTION === "buy_s1_token" || ACTION === "buy-s1-token") {
    return {
      creatorWallet: CREATOR_WALLET,
      amount: S1_AMOUNT,
    };
  }

  if (
    ACTION === "claim-s1-buyout-usdc" ||
    ACTION === "claim-demo-usdc" ||
    ACTION === "claim_demo_usdc" ||
    ACTION === "demo-usdc-claim"
  ) {
    return {
      creatorWallet: CREATOR_WALLET,
      sponsorWallet: SPONSOR_WALLET,
    };
  }

  return {};
};

const pollJob = (accessToken, jobId) => {
  const startedAt = Date.now();
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = http.get(`${BASE_URL}/api/v1/s1/managed/jobs/${jobId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      tags: { endpoint: "managed_job_poll" },
    });

    if (response.status === 200) {
      const job = response.json();
      if (job.status === "succeeded") {
        jobCompletionMs.add(Date.now() - startedAt);
        managedJobSucceeded.add(true);
        return;
      }

      if (job.status === "failed") {
        managedJobSucceeded.add(false);
        return;
      }
    }

    sleep(1);
  }

  managedJobSucceeded.add(false);
};

export default function () {
  const subject = `demo-day-${__VU}-${__ITER}`;
  const auth = http.post(
    `${BASE_URL}/api/v1/auth/ephemeral-session`,
    JSON.stringify({ subject }),
    {
      headers: { "Content-Type": "application/json" },
      tags: { endpoint: "ephemeral_session" },
    }
  );

  const authOk = check(auth, {
    "ephemeral session allocated": (response) => response.status === 200 || response.status === 201,
    "ephemeral wallet present": (response) =>
      Boolean(response.json("wallet") && response.json("identity.managedWalletAddress")),
  });
  if (!authOk) {
    managedJobSucceeded.add(false);
    return;
  }

  const accessToken = auth.json("accessToken");
  for (let actionIndex = 0; actionIndex < ACTIONS_PER_USER; actionIndex += 1) {
    const idempotencyKey = `${subject}-${ACTION}-${actionIndex}`;
    const execute = http.post(
      `${BASE_URL}/api/v1/s1/managed/execute`,
      JSON.stringify({
        action: ACTION,
        params: buildParams(),
      }),
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        tags: { endpoint: "managed_execute" },
      }
    );

    const executeOk = check(execute, {
      "managed execute queued": (response) => response.status === 202,
      "job id present": (response) => Boolean(response.json("jobId")),
    });
    if (!executeOk) {
      managedJobSucceeded.add(false);
      continue;
    }

    pollJob(accessToken, execute.json("jobId"));
  }
}
