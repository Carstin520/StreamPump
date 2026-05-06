export type S1EmissionPolicyInput = {
  activeUsers: number;
};

export type S1EmissionPolicyOutput = {
  dailySpumpEmissionMultiplierBps: number;
};

const assertActiveUsers = (activeUsers: number): void => {
  if (!Number.isInteger(activeUsers) || activeUsers < 0) {
    throw new Error("activeUsers must be a non-negative integer");
  }
};

const linearDecay = (
  activeUsers: number,
  startUsers: number,
  endUsers: number,
  startBps: number,
  endBps: number
): number => {
  const progress = (activeUsers - startUsers) / (endUsers - startUsers);
  return Math.round(startBps - progress * (startBps - endBps));
};

export const calculatePlatformEmissionPolicy = (
  input: S1EmissionPolicyInput
): S1EmissionPolicyOutput => {
  assertActiveUsers(input.activeUsers);

  if (input.activeUsers < 1_000) {
    return { dailySpumpEmissionMultiplierBps: 100_000 };
  }

  if (input.activeUsers <= 10_000) {
    return {
      dailySpumpEmissionMultiplierBps: linearDecay(
        input.activeUsers,
        1_000,
        10_000,
        50_000,
        20_000
      ),
    };
  }

  if (input.activeUsers >= 100_000) {
    return { dailySpumpEmissionMultiplierBps: 10_000 };
  }

  return {
    dailySpumpEmissionMultiplierBps: linearDecay(
      input.activeUsers,
      10_000,
      100_000,
      20_000,
      10_000
    ),
  };
};
