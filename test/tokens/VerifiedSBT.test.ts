import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { Reverter } from "@/test/helpers/reverter";
import { VerifiedSBT } from "@ethers-v6";

describe("VerifiedSBT", () => {
  const reverter = new Reverter();

  const defaultName: string = "VerifiedSBT Token Name";
  const defaultSymbol: string = "VSBT";
  const defaultBaseURI: string = "some uri";

  let OWNER: SignerWithAddress;
  let SECOND: SignerWithAddress;
  let THIRD: SignerWithAddress;
  let PROTOCOL_MANAGER: SignerWithAddress;

  let verifiedSBT: VerifiedSBT;

  before(async () => {
    [OWNER, SECOND, THIRD, PROTOCOL_MANAGER] = await ethers.getSigners();

    const VerifiedSBT = await ethers.getContractFactory("VerifiedSBT");
    verifiedSBT = await VerifiedSBT.deploy();

    await verifiedSBT.init(defaultName, defaultSymbol, defaultBaseURI, PROTOCOL_MANAGER.address);

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("#creation", () => {
    it("should set parameters correctly", async () => {
      expect(await verifiedSBT.name()).to.eq(defaultName);
      expect(await verifiedSBT.symbol()).to.eq(defaultSymbol);
      expect(await verifiedSBT.baseURI()).to.eq(defaultBaseURI);
      expect(await verifiedSBT.protocolManagerAddr()).to.eq(PROTOCOL_MANAGER.address);
    });

    it("should get exception if try to call init function twice", async () => {
      const reason = "Initializable: contract is already initialized";

      await expect(verifiedSBT.init(defaultName, defaultSymbol, "", OWNER.address)).to.be.revertedWith(reason);
    });
  });

  describe("#setBaseURI", () => {
    const newBaseURI = "new base URI";

    it("should correctly update base URI", async () => {
      await verifiedSBT.connect(PROTOCOL_MANAGER).setBaseURI(newBaseURI);

      expect(await verifiedSBT.baseURI()).to.eq(newBaseURI);
    });

    it("should get exception if not a protocol manager try to call this function", async () => {
      await expect(verifiedSBT.connect(SECOND).setBaseURI(newBaseURI))
        .to.be.revertedWithCustomError(verifiedSBT, "VerifiedSBTUnauthorized")
        .withArgs(SECOND.address);
    });
  });

  describe("#batchMint", () => {
    let addresses: string[];

    beforeEach("setup", async () => {
      addresses = [OWNER.address, SECOND.address, THIRD.address];
    });

    it("should correctly mint tokens for the passed addresses", async () => {
      await verifiedSBT.connect(PROTOCOL_MANAGER).batchMint(addresses);

      expect(await verifiedSBT.nextTokenId()).to.be.eq(addresses.length);

      for (let i = 0; i < addresses.length; i++) {
        expect(await verifiedSBT.ownerOf(i)).to.be.eq(addresses[i]);
        expect(await verifiedSBT.tokenURI(i)).to.be.eq(defaultBaseURI);
      }
    });

    it("should get exception if not a protocol manager try to call this function", async () => {
      await expect(verifiedSBT.connect(SECOND).batchMint(addresses))
        .to.be.revertedWithCustomError(verifiedSBT, "VerifiedSBTUnauthorized")
        .withArgs(SECOND.address);
    });
  });

  describe("#mint", () => {
    it("should correctly mint tokens for the passed addresses", async () => {
      const nextTokenId = await verifiedSBT.nextTokenId();

      await verifiedSBT.connect(PROTOCOL_MANAGER).mint(SECOND.address);

      expect(await verifiedSBT.nextTokenId()).to.be.eq(1);

      expect(await verifiedSBT.ownerOf(nextTokenId)).to.be.eq(SECOND.address);
      expect(await verifiedSBT.tokenURI(nextTokenId)).to.be.eq(defaultBaseURI);
    });

    it("should get exception if not a protocol manager try to call this function", async () => {
      await expect(verifiedSBT.connect(SECOND).mint(SECOND.address))
        .to.be.revertedWithCustomError(verifiedSBT, "VerifiedSBTUnauthorized")
        .withArgs(SECOND.address);
    });
  });
});
