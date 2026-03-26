/**
 * CN: 钱包认证占位服务，当前仍是 stub，后续会替换为 challenge/signature 登录。
 * EN: Wallet-auth placeholder service that is still a stub and will be replaced by challenge/signature login.
 */
export const verifyWeb3AuthToken = async (idToken: string) => {
  if (!idToken) {
    return null;
  }

  // TODO: validate token against Web3Auth verifier/JWKS.
  return {
    isValid: true,
    userId: "mock-user",
  };
};
