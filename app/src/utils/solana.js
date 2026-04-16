"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConnection = exports.STREAMPUMP_PROGRAM_ID = void 0;
const web3_js_1 = require("@solana/web3.js");
exports.STREAMPUMP_PROGRAM_ID = new web3_js_1.PublicKey("EV2frDqtvTfmshXxsNipDSEANWeZxzHEazzDu51rDzre");
const getConnection = () => new web3_js_1.Connection(process.env.NEXT_PUBLIC_RPC_ENDPOINT ?? (0, web3_js_1.clusterApiUrl)("devnet"), "confirmed");
exports.getConnection = getConnection;
