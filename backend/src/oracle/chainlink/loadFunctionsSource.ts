import fs from "fs";
import path from "path";

export interface ChainlinkFunctionsRequest {
  source: string;
  args: string[];
  secrets?: Record<string, string>;
}

export const loadFunctionsSource = () => {
  const sourcePath = path.resolve(
    __dirname,
    "functions/functions-source.js"
  );

  return fs.readFileSync(sourcePath, "utf8");
};

export const buildViewCountRequest = (params: {
  platform: "youtube" | "tiktok";
  contentId: string;
  apiKeySecretName: string;
}): ChainlinkFunctionsRequest => ({
  source: loadFunctionsSource(),
  args: [params.platform, params.contentId, `{{secrets.${params.apiKeySecretName}}}`],
});
