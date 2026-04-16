"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveUpgradeReceiptPda = exports.deriveEndorsementPositionPda = exports.deriveProposalVaultPdas = exports.deriveProposalPda = exports.deriveCreatorProfilePda = void 0;
const web3_js_1 = require("@solana/web3.js");
const solana_1 = require("./solana");
const encoder = new TextEncoder();
const i64LeBytes = (value) => {
    const bytes = new Uint8Array(8);
    const view = new DataView(bytes.buffer);
    view.setBigInt64(0, value, true);
    return bytes;
};
const bytesFromHex = (value) => {
    const hex = value.startsWith("0x") ? value.slice(2) : value;
    if (hex.length % 2 !== 0) {
        throw new Error("hex string length must be even");
    }
    const bytes = new Uint8Array(hex.length / 2);
    for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    }
    return bytes;
};
const deriveCreatorProfilePda = (creator, programId = solana_1.STREAMPUMP_PROGRAM_ID) => {
    const [creatorProfile] = web3_js_1.PublicKey.findProgramAddressSync([encoder.encode("creator"), creator.toBytes()], programId);
    return creatorProfile;
};
exports.deriveCreatorProfilePda = deriveCreatorProfilePda;
const deriveProposalPda = (creator, deadlineTs, programId = solana_1.STREAMPUMP_PROGRAM_ID) => {
    const [proposal] = web3_js_1.PublicKey.findProgramAddressSync([encoder.encode("proposal"), creator.toBytes(), i64LeBytes(deadlineTs)], programId);
    return proposal;
};
exports.deriveProposalPda = deriveProposalPda;
const deriveProposalVaultPdas = (proposal, programId = solana_1.STREAMPUMP_PROGRAM_ID) => {
    const [proposalUsdcVault] = web3_js_1.PublicKey.findProgramAddressSync([encoder.encode("proposal_usdc_vault"), proposal.toBytes()], programId);
    const [proposalSpumpVault] = web3_js_1.PublicKey.findProgramAddressSync([encoder.encode("proposal_spump_vault"), proposal.toBytes()], programId);
    return {
        proposalUsdcVault,
        proposalSpumpVault,
    };
};
exports.deriveProposalVaultPdas = deriveProposalVaultPdas;
const deriveEndorsementPositionPda = (user, proposal, programId = solana_1.STREAMPUMP_PROGRAM_ID) => {
    const [endorsementPosition] = web3_js_1.PublicKey.findProgramAddressSync([encoder.encode("endorsement"), user.toBytes(), proposal.toBytes()], programId);
    return endorsementPosition;
};
exports.deriveEndorsementPositionPda = deriveEndorsementPositionPda;
const deriveUpgradeReceiptPda = (creatorProfile, reportIdHex, programId = solana_1.STREAMPUMP_PROGRAM_ID) => {
    const reportId = bytesFromHex(reportIdHex);
    if (reportId.length !== 32) {
        throw new Error("reportIdHex must be 32-byte hex");
    }
    const [upgradeReceipt] = web3_js_1.PublicKey.findProgramAddressSync([encoder.encode("upgrade_receipt"), creatorProfile.toBytes(), reportId], programId);
    return upgradeReceipt;
};
exports.deriveUpgradeReceiptPda = deriveUpgradeReceiptPda;
