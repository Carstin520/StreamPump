import { apiClient } from "./client";
import { InfluenceRecord } from "./types";

export const getAccountInfluence = (token: string) =>
  apiClient.get<InfluenceRecord>("/account/me/influence", {
    token,
  });
