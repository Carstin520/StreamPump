"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useProgram = void 0;
const anchor_1 = require("@coral-xyz/anchor");
const wallet_adapter_react_1 = require("@solana/wallet-adapter-react");
const web3_js_1 = require("@solana/web3.js");
const react_1 = require("react");
const PROGRAM_ID = new web3_js_1.PublicKey("EV2frDqtvTfmshXxsNipDSEANWeZxzHEazzDu51rDzre");
const useProgram = (idl) => {
    const { connection } = (0, wallet_adapter_react_1.useConnection)();
    const wallet = (0, wallet_adapter_react_1.useWallet)();
    return (0, react_1.useMemo)(() => {
        if (!idl || !wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
            return null;
        }
        const provider = new anchor_1.AnchorProvider(connection, wallet, {
            commitment: "confirmed",
        });
        return new anchor_1.Program(idl, {
            programId: PROGRAM_ID,
            provider,
        });
    }, [connection, idl, wallet]);
};
exports.useProgram = useProgram;
