"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Topbar = void 0;
const link_1 = __importDefault(require("next/link"));
const wallet_adapter_react_1 = require("@solana/wallet-adapter-react");
const mock_data_1 = require("@/lib/mock-data");
const Badge_1 = require("@/components/shared/Badge");
const Web3AuthContext_1 = require("@/components/Wallet/Web3AuthContext");
const Topbar = ({ title, subtitle, action, }) => {
    const wallet = (0, wallet_adapter_react_1.useWallet)();
    const { provider } = (0, Web3AuthContext_1.useWeb3Auth)();
    return (<div className="flex flex-col gap-4 rounded-[28px] border border-white/10 bg-[#0d1627]/88 p-5 text-slate-100 shadow-[0_20px_70px_rgba(2,6,23,0.4)] lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge_1.Badge label={provider ? "Social session active" : "Social session idle"} tone={provider ? "success" : "neutral"}/>
          <Badge_1.Badge label={wallet.connected ? "External wallet connected" : "External wallet optional"} tone={wallet.connected ? "warm" : "neutral"}/>
        </div>
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-white">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">{subtitle}</p>
        </div>
      </div>

      <div className="min-w-[240px] rounded-2xl bg-white/5 p-4">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Session</p>
        <p className="mt-2 text-sm font-medium text-white">{mock_data_1.currentUser.name}</p>
        <p className="text-sm text-slate-300">{mock_data_1.currentUser.handle}</p>
        <p className="mt-2 text-xs text-slate-400">{mock_data_1.currentUser.sessionMode}</p>
        <p className="mt-1 text-xs text-slate-500">{mock_data_1.currentUser.primaryWallet}</p>
        <div className="mt-4 flex items-center gap-2">
          {action}
          <link_1.default className="rounded-full border border-white/12 px-4 py-2 text-sm text-slate-200 hover:bg-white/8" href="/login">
            Auth
          </link_1.default>
        </div>
      </div>
    </div>);
};
exports.Topbar = Topbar;
