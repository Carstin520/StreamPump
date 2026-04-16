"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = CreatorDetailPage;
const head_1 = __importDefault(require("next/head"));
const link_1 = __importDefault(require("next/link"));
const router_1 = require("next/router");
const CreatorStageView_1 = require("@/components/user/CreatorStageView");
const UserShell_1 = require("@/components/user/UserShell");
const UserTopbar_1 = require("@/components/user/UserTopbar");
const discover_1 = require("@/lib/mocks/discover");
function CreatorDetailPage() {
    const router = (0, router_1.useRouter)();
    const creator = (0, discover_1.findCreator)(String(router.query.creatorId ?? ""));
    return (<>
      <head_1.default>
        <title>{`StreamPump | ${creator.name}`}</title>
      </head_1.default>
      <UserShell_1.UserShell header={<UserTopbar_1.UserTopbar />}>
        <div className="mb-1">
          <link_1.default className="inline-flex rounded-full border border-white/8 bg-white/4 px-4 py-2 text-sm text-[#d9e3f2]" href="/trending">
            返回 Trending Creators
          </link_1.default>
        </div>
        <CreatorStageView_1.CreatorStageView creator={creator}/>
      </UserShell_1.UserShell>
    </>);
}
