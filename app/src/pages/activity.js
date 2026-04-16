"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ActivityPage;
const head_1 = __importDefault(require("next/head"));
const ActivitySurface_1 = require("@/components/user/ActivitySurface");
function ActivityPage() {
    return (<>
      <head_1.default>
        <title>StreamPump | 动态</title>
      </head_1.default>
      <ActivitySurface_1.ActivitySurface />
    </>);
}
