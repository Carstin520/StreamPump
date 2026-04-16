"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * CN: Proposal intent 控制器辅助逻辑测试，覆盖 bundle 复用判断和签名提取。
 * EN: Proposal intent controller helper tests covering bundle reuse rules and signature extraction.
 */
const chai_1 = require("chai");
const client_1 = require("@prisma/client");
const web3_js_1 = require("@solana/web3.js");
const proposalIntentController_1 = require("../src/controllers/proposalIntentController");
describe("proposalIntentController helpers", () => {
    it("reuses an active built bundle", () => {
        const reusable = (0, proposalIntentController_1.isBundleReusable)({
            status: client_1.BundleStatus.BUILT,
            expiresAt: new Date(Date.now() + 60_000),
        });
        (0, chai_1.expect)(reusable).to.equal(true);
    });
    it("does not reuse an expired partial bundle", () => {
        const reusable = (0, proposalIntentController_1.isBundleReusable)({
            status: client_1.BundleStatus.PARTIAL,
            expiresAt: new Date(Date.now() - 1_000),
        });
        (0, chai_1.expect)(reusable).to.equal(false);
    });
    it("always reuses a confirmed bundle even after expiry", () => {
        const reusable = (0, proposalIntentController_1.isBundleReusable)({
            status: client_1.BundleStatus.CONFIRMED,
            expiresAt: new Date(Date.now() - 1_000),
        });
        (0, chai_1.expect)(reusable).to.equal(true);
    });
    it("extracts the canonical transaction signature from a fully signed v0 transaction", () => {
        const sponsor = web3_js_1.Keypair.generate();
        const recipient = web3_js_1.Keypair.generate().publicKey;
        const tx = new web3_js_1.VersionedTransaction(new web3_js_1.TransactionMessage({
            payerKey: sponsor.publicKey,
            recentBlockhash: web3_js_1.Keypair.generate().publicKey.toBase58(),
            instructions: [
                web3_js_1.SystemProgram.transfer({
                    fromPubkey: sponsor.publicKey,
                    toPubkey: recipient,
                    lamports: 1,
                }),
            ],
        }).compileToV0Message());
        tx.sign([sponsor]);
        const extracted = (0, proposalIntentController_1.extractTransactionSignature)(Buffer.from(tx.serialize()).toString("base64"));
        (0, chai_1.expect)(extracted).to.be.a("string");
        (0, chai_1.expect)(extracted.length).to.be.greaterThan(20);
    });
});
