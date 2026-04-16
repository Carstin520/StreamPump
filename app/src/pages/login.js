"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = LoginPage;
const dynamic_1 = __importDefault(require("next/dynamic"));
const head_1 = __importDefault(require("next/head"));
const link_1 = __importDefault(require("next/link"));
const router_1 = require("next/router");
const react_1 = require("react");
const AnimatedFeedBackdrop_1 = require("@/components/shared/AnimatedFeedBackdrop");
const auth_1 = require("@/lib/mocks/auth");
const DynamicAuthOptionsPanel = (0, dynamic_1.default)(() => Promise.resolve().then(() => __importStar(require("@/components/auth/AuthOptionsPanel"))).then((mod) => mod.AuthOptionsPanel), { ssr: false });
const getPreviewMode = (value) => value === "switch" ? "switch" : "welcome";
function LoginPage() {
    const router = (0, router_1.useRouter)();
    const [previewMode, setPreviewMode] = (0, react_1.useState)(auth_1.loginPreviewDefaultMode);
    (0, react_1.useEffect)(() => {
        if (!router.isReady) {
            return;
        }
        setPreviewMode(getPreviewMode(router.query.preview));
    }, [router.isReady, router.query.preview]);
    const handleModeChange = (mode) => {
        setPreviewMode(mode);
        void router.replace({
            pathname: "/login",
            query: mode === "switch" ? { preview: "switch" } : {},
        }, undefined, { shallow: true, scroll: false });
    };
    return (<>
      <head_1.default>
        <title>StreamPump | Login</title>
      </head_1.default>
      <main className="relative min-h-screen overflow-hidden bg-[#080c14] text-white">
        <AnimatedFeedBackdrop_1.AnimatedFeedBackdrop className="opacity-[0.85]"/>
        <div className="pointer-events-none absolute inset-[8%] rounded-[54px] border border-white/[0.03] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_36%)] backdrop-blur-[2px]"/>

        <div className="relative flex min-h-screen flex-col px-5 py-5 lg:px-8">
          <div className="flex items-center justify-between">
            <link_1.default className="flex items-center gap-3" href="/explore">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#de402a] text-sm font-semibold shadow-[0_12px_30px_rgba(222,64,42,0.32)]">
                SP
              </span>
              <span className="text-lg font-semibold tracking-[-0.04em] text-white">StreamPump</span>
            </link_1.default>

            <div className="hidden rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs text-[#8ea0ba] md:block">
              Preview state syncs with <code className="text-white/80">?preview=</code>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center py-10">
            <div className="w-full max-w-[1040px]">
              <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.8fr)]">
                <div className="hidden px-6 lg:block">
                  <p className="text-xs uppercase tracking-[0.28em] text-[#7f90ab]">Access Layer</p>
                  <h1 className="mt-5 max-w-[520px] text-[56px] font-semibold leading-[0.94] tracking-[-0.06em] text-white">
                    Accounts that feel native to the product, not bolted on later.
                  </h1>
                  <p className="mt-6 max-w-[440px] text-base leading-8 text-[#95a6bf]">
                    This preview keeps creator investing, social identity, and wallet power in one coherent entry flow. Start simple, then reveal control only when the user needs it.
                  </p>
                </div>

                <DynamicAuthOptionsPanel mode={previewMode} onModeChange={handleModeChange}/>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>);
}
