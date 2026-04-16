"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = TrendingPage;
const head_1 = __importDefault(require("next/head"));
const DiscoverSurface_1 = require("@/components/user/DiscoverSurface");
function TrendingPage() {
    return (<>
      <head_1.default>
        <title>StreamPump | Trending</title>
      </head_1.default>
      <DiscoverSurface_1.TrendingSurface />
    </>);
}
