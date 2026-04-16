"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildViewCountRequest = exports.loadFunctionsSource = void 0;
/**
 * CN: Chainlink Functions 辅助加载器，读取源码脚本并封装请求参数。
 * EN: Chainlink Functions helper that loads the source script and packages request arguments.
 */
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const loadFunctionsSource = () => {
    const sourcePath = path_1.default.resolve(__dirname, "functions/functions-source.js");
    return fs_1.default.readFileSync(sourcePath, "utf8");
};
exports.loadFunctionsSource = loadFunctionsSource;
const buildViewCountRequest = (params) => ({
    source: (0, exports.loadFunctionsSource)(),
    args: [params.platform, params.contentId, `{{secrets.${params.apiKeySecretName}}}`],
});
exports.buildViewCountRequest = buildViewCountRequest;
