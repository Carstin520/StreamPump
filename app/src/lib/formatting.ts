import { formatUsd } from "@/lib/mocks/utils";

const USDC_DECIMALS = 1_000_000;

export const shortenWallet = (value: string | null | undefined) => {
  if (!value) {
    return "Pending";
  }

  if (value.length <= 10) {
    return value;
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
};

export const formatUsdcAtomic = (value: string | number | bigint | null | undefined) => {
  if (value === null || value === undefined) {
    return formatUsd(0);
  }

  const numeric = typeof value === "bigint" ? Number(value) : Number(value);
  if (!Number.isFinite(numeric)) {
    return formatUsd(0);
  }

  return formatUsd(numeric / USDC_DECIMALS);
};

export const formatIsoLabel = (value: string | null | undefined) => {
  if (!value) {
    return "Pending";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};
