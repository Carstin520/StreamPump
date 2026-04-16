"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentSession = exports.verifyWalletAuthChallenge = exports.createWalletAuthChallenge = exports.exchangeProviderSession = void 0;
const client_1 = require("./client");
const exchangeProviderSession = (input) => client_1.apiClient.post("/auth/provider-exchange", {
    body: input,
});
exports.exchangeProviderSession = exchangeProviderSession;
const createWalletAuthChallenge = (wallet) => client_1.apiClient.post("/auth/challenge", {
    body: { wallet },
});
exports.createWalletAuthChallenge = createWalletAuthChallenge;
const verifyWalletAuthChallenge = (input) => client_1.apiClient.post("/auth/verify", {
    body: input,
});
exports.verifyWalletAuthChallenge = verifyWalletAuthChallenge;
const getCurrentSession = (token) => client_1.apiClient.get("/auth/session", {
    token,
});
exports.getCurrentSession = getCurrentSession;
