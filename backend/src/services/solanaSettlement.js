"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitCreatorUpgradeToProgram = exports.submitOracleReportToProgram = exports.deriveCreatorUpgradeAddresses = exports.deriveProposalAddresses = exports.deriveCreatorProfileAddress = void 0;
/**
 * CN: 旧版 Solana 结算辅助模块，部分地址推导仍基于历史设计，仅保留兼容参考价值。
 * EN: Legacy Solana settlement helper module; some address derivations still follow historical design and remain for compatibility/reference only.
 */
const web3_js_1 = require("@solana/web3.js");
const default_1 = require("../../config/default");
const i64LeBytes = (value) => {
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64LE(value);
    return buffer;
};
const deriveCreatorProfileAddress = (creatorWallet, programId = new web3_js_1.PublicKey(default_1.config.solana.programId)) => {
    const creator = new web3_js_1.PublicKey(creatorWallet);
    const [creatorProfile] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("creator"), creator.toBuffer()], programId);
    return creatorProfile;
};
exports.deriveCreatorProfileAddress = deriveCreatorProfileAddress;
const deriveProposalAddresses = (proposalCreator, proposalDeadline, programId = new web3_js_1.PublicKey(default_1.config.solana.programId)) => {
    const creator = new web3_js_1.PublicKey(proposalCreator);
    const [proposal] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("proposal"), creator.toBuffer(), i64LeBytes(proposalDeadline)], programId);
    const [proposalUsdcVault] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("proposal_usdc_vault"), proposal.toBuffer()], programId);
    const [proposalSpumpVault] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("proposal_spump_vault"), proposal.toBuffer()], programId);
    return {
        proposal,
        proposalUsdcVault,
        proposalSpumpVault,
    };
};
exports.deriveProposalAddresses = deriveProposalAddresses;
const deriveCreatorUpgradeAddresses = (creatorWallet, reportIdHex, programId = new web3_js_1.PublicKey(default_1.config.solana.programId)) => {
    const creatorProfile = (0, exports.deriveCreatorProfileAddress)(creatorWallet, programId);
    const reportIdBytes = Buffer.from(reportIdHex, "hex");
    if (reportIdBytes.length !== 32) {
        throw new Error("reportIdHex must be 32-byte hex");
    }
    const [upgradeReceipt] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("upgrade_receipt"), creatorProfile.toBuffer(), reportIdBytes], programId);
    return {
        creatorProfile,
        upgradeReceipt,
    };
};
exports.deriveCreatorUpgradeAddresses = deriveCreatorUpgradeAddresses;
const submitOracleReportToProgram = async (params) => {
    const connection = new web3_js_1.Connection(default_1.config.solana.rpcEndpoint, "confirmed");
    const programId = new web3_js_1.PublicKey(default_1.config.solana.programId);
    const addresses = (0, exports.deriveProposalAddresses)(params.proposalCreator, params.proposalDeadline, programId);
    if (addresses.proposal.toBase58() !== params.payload.proposalKey) {
        throw new Error("proposalKey does not match derived proposal PDA");
    }
    // Production flow:
    // 1. Load signer for protocol oracle authority.
    // 2. Build Anchor instruction: submit_oracle_report(actual_views).
    // 3. Send + confirm transaction using accounts:
    //    - oracle
    //    - protocol_config PDA
    //    - proposal PDA (derived from creator + deadline)
    // 4. Trigger settle_proposal instruction after oracle report finalization.
    //
    // This scaffold intentionally keeps private key handling and signing out of source control.
    // Integrate with your signer service / HSM / KMS before enabling in production.
    void connection;
    void params;
};
exports.submitOracleReportToProgram = submitOracleReportToProgram;
const submitCreatorUpgradeToProgram = async (params) => {
    const connection = new web3_js_1.Connection(default_1.config.solana.rpcEndpoint, "confirmed");
    const programId = new web3_js_1.PublicKey(default_1.config.solana.programId);
    const addresses = (0, exports.deriveCreatorUpgradeAddresses)(params.creatorWallet, params.payload.reportIdHex, programId);
    const derivedCreatorProfile = (0, exports.deriveCreatorProfileAddress)(params.creatorWallet, programId);
    if (!derivedCreatorProfile.equals(addresses.creatorProfile)) {
        throw new Error("derived creator profile mismatch");
    }
    // Production flow:
    // 1. Load signer for protocol oracle authority.
    // 2. Build Anchor instruction: upgrade_creator(new_level, metric_type, metric_value, report_id, report_digest, observed_at).
    // 3. Send + confirm transaction using accounts:
    //    - oracle
    //    - protocol_config PDA
    //    - creator_profile PDA
    //    - upgrade_receipt PDA
    // 4. Persist upgrade_receipt key for audit and replay protection.
    //
    // This scaffold intentionally keeps private key handling and signing out of source control.
    // Integrate with your signer service / HSM / KMS before enabling in production.
    void connection;
    void params;
};
exports.submitCreatorUpgradeToProgram = submitCreatorUpgradeToProgram;
