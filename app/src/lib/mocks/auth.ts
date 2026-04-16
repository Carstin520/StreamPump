import { LoginAccountRecord, LoginMethodRecord, LoginPreviewMode } from "@/lib/api/types";

import { avatars } from "./common";
import { currentUser } from "./profile";

export const loginPreviewDefaultMode: LoginPreviewMode = "welcome";

export const loginMethods: LoginMethodRecord[] = [
  {
    id: "email",
    label: "邮箱登录 / 注册",
    subtitle: "最轻量的账户入口",
  },
  {
    id: "google",
    label: "使用 Google 登录",
    subtitle: "默认社交登录路径",
  },
  {
    id: "apple",
    label: "使用 Apple 登录",
    subtitle: "适合 iPhone 与 Mac 用户",
  },
  {
    id: "wallet",
    label: "钱包登录",
    subtitle: "面向签名和高控制权用户",
    tone: "wallet",
  },
];

export const loginAccounts: LoginAccountRecord[] = [
  {
    id: currentUser.id,
    name: currentUser.name,
    handle: currentUser.handle,
    avatarSrc: currentUser.avatarSrc,
    sessionLabel: "当前会话",
    methodLabel: "Google + Embedded Wallet",
    isCurrent: true,
  },
  {
    id: "neo-preview-account",
    name: "Neo Park",
    handle: "@midnightsave",
    avatarSrc: avatars.midnight,
    sessionLabel: "最近登录",
    methodLabel: "Apple Login",
  },
  {
    id: "wallet-preview-account",
    name: "Luna Cai",
    handle: "@wanxinrk",
    avatarSrc: avatars.wanxin,
    sessionLabel: "钱包身份",
    methodLabel: "Phantom",
  },
];

