"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginAccounts = exports.loginMethods = exports.loginPreviewDefaultMode = void 0;
const common_1 = require("./common");
const profile_1 = require("./profile");
exports.loginPreviewDefaultMode = "welcome";
exports.loginMethods = [
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
exports.loginAccounts = [
    {
        id: profile_1.currentUser.id,
        name: profile_1.currentUser.name,
        handle: profile_1.currentUser.handle,
        avatarSrc: profile_1.currentUser.avatarSrc,
        sessionLabel: "当前会话",
        methodLabel: "Google + Embedded Wallet",
        isCurrent: true,
    },
    {
        id: "neo-preview-account",
        name: "Neo Park",
        handle: "@midnightsave",
        avatarSrc: common_1.avatars.midnight,
        sessionLabel: "最近登录",
        methodLabel: "Apple Login",
    },
    {
        id: "wallet-preview-account",
        name: "Luna Cai",
        handle: "@wanxinrk",
        avatarSrc: common_1.avatars.wanxin,
        sessionLabel: "钱包身份",
        methodLabel: "Phantom",
    },
];
