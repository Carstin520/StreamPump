/**
 * CN: 统一加载 backend 的 .env.local / .env，确保配置模块在读取 process.env 前已经完成加载。
 * EN: Loads backend .env.local / .env before configuration modules read process.env.
 */
import dotenv from "dotenv";
import { existsSync } from "fs";
import path from "path";

const loadEnvFile = (filePath: string): void => {
  if (!existsSync(filePath)) {
    return;
  }

  dotenv.config({ path: filePath });
};

[
  path.resolve(process.cwd(), ".env.local"),
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, ".env.local"),
  path.resolve(__dirname, ".env"),
  path.resolve(__dirname, "../.env.local"),
  path.resolve(__dirname, "../.env"),
].forEach(loadEnvFile);
