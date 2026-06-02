import { expect } from "chai";
import { WalletType } from "@prisma/client";

import { prisma } from "../src/services/prisma";
import { isManagedWallet } from "../src/services/managedWalletService";

describe("managedWalletService", () => {
  const prismaAny = prisma as any;
  const originalFindUnique = prisma.accountWallet.findUnique;

  afterEach(() => {
    prismaAny.accountWallet.findUnique = originalFindUnique;
  });

  it("does not treat managed wallet rows without encrypted secrets as executable", async () => {
    prismaAny.accountWallet.findUnique = async () => ({
      walletType: WalletType.MANAGED,
      encryptedSecretKey: null,
    });

    expect(await isManagedWallet("managed-without-secret")).to.equal(false);
  });

  it("treats managed wallet rows with encrypted secrets as executable", async () => {
    prismaAny.accountWallet.findUnique = async () => ({
      walletType: WalletType.MANAGED,
      encryptedSecretKey: new Uint8Array([1, 2, 3]),
    });

    expect(await isManagedWallet("managed-with-secret")).to.equal(true);
  });
});
