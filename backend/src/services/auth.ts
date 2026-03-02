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
