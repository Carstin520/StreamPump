"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * CN: 统一加载 backend 的 .env.local / .env，确保配置模块在读取 process.env 前已经完成加载。
 * EN: Loads backend .env.local / .env before configuration modules read process.env.
 */
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const loadEnvFile = (filePath) => {
    if (!(0, fs_1.existsSync)(filePath)) {
        return;
    }
    dotenv_1.default.config({ path: filePath });
};
[
    path_1.default.resolve(process.cwd(), ".env.local"),
    path_1.default.resolve(process.cwd(), ".env"),
    path_1.default.resolve(__dirname, ".env.local"),
    path_1.default.resolve(__dirname, ".env"),
    path_1.default.resolve(__dirname, "../.env.local"),
    path_1.default.resolve(__dirname, "../.env"),
].forEach(loadEnvFile);
