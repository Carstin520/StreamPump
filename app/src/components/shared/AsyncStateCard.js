"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsyncStateCard = void 0;
const link_1 = __importDefault(require("next/link"));
const AsyncStateCard = ({ actionHref, actionLabel, body, title, }) => (<section className="glass-card p-5">
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Data state</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">{title}</h2>
      </div>
      <p className="text-sm leading-7 text-slate-300">{body}</p>
      {actionHref && actionLabel ? (<link_1.default className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950" href={actionHref}>
          {actionLabel}
        </link_1.default>) : null}
    </div>
  </section>);
exports.AsyncStateCard = AsyncStateCard;
