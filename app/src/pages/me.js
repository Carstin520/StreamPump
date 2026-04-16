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
exports.default = MePage;
const dynamic_1 = __importDefault(require("next/dynamic"));
const head_1 = __importDefault(require("next/head"));
const react_1 = require("react");
const ProfileSurface_1 = require("@/components/profile/ProfileSurface");
const UserShell_1 = require("@/components/user/UserShell");
const UserTopbar_1 = require("@/components/user/UserTopbar");
const profile_1 = require("@/lib/mocks/profile");
const discover_1 = require("@/lib/mocks/discover");
const DynamicPostDetailExperience = (0, dynamic_1.default)(() => Promise.resolve().then(() => __importStar(require("@/components/post/PostDetailExperience"))).then((mod) => mod.PostDetailExperience), { ssr: false });
function MePage() {
    const [activeTab, setActiveTab] = (0, react_1.useState)("笔记");
    const [selectedPostId, setSelectedPostId] = (0, react_1.useState)(null);
    const items = activeTab === "笔记"
        ? profile_1.currentUserNotes
        : activeTab === "收藏"
            ? profile_1.currentUserSavedPosts
            : profile_1.currentUserLikedPosts;
    const tabPosts = (0, react_1.useMemo)(() => (0, ProfileSurface_1.resolveProfilePosts)(items, discover_1.posts), [items]);
    (0, react_1.useEffect)(() => {
        if (selectedPostId && !tabPosts.some((post) => post.id === selectedPostId)) {
            setSelectedPostId(null);
        }
    }, [selectedPostId, tabPosts]);
    return (<>
      <head_1.default>
        <title>StreamPump | Me</title>
      </head_1.default>
      <UserShell_1.UserShell header={<UserTopbar_1.UserTopbar />}>
        <div className="pb-10">
          <ProfileSurface_1.ProfileHero avatarSrc={profile_1.currentUser.avatarSrc} bannerSrc={profile_1.currentUser.bannerSrc} bio={profile_1.currentUser.bio} followersCount={profile_1.currentUser.followersCount} followingCount={profile_1.currentUser.followingCount} handle={profile_1.currentUser.handle} likesAndSavesCount={profile_1.currentUser.totalLikesAndSavesCount} location={profile_1.currentUser.location} name={profile_1.currentUser.name}/>
          <ProfileSurface_1.ProfileTabBar activeTab={activeTab} onTabChange={setActiveTab}/>
          <ProfileSurface_1.ProfileNoteGrid items={items} onOpen={(item) => setSelectedPostId((0, ProfileSurface_1.resolveItemPostId)(item))}/>
        </div>
        {selectedPostId ? (<DynamicPostDetailExperience closeLabel="Close profile post" currentPostId={selectedPostId} items={tabPosts} mode="modal" onChangePostId={setSelectedPostId} onClose={() => setSelectedPostId(null)} syncRoute={false}/>) : null}
      </UserShell_1.UserShell>
    </>);
}
