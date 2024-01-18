import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { Reverter } from "@/test/helpers/reverter";
import { VerifiedSBT, VerifiedSBTMock, TokensFactory } from "@ethers-v6";

describe("TokensFactory", () => {
  const reverter = new Reverter();

  const defaultName: string = "VerifiedSBT Token Name";
  const defaultSymbol: string = "VSBT";
  const defaultBaseURI: string = "some uri";

  let OWNER: SignerWithAddress;
  let SECOND: SignerWithAddress;
  let THIRD: SignerWithAddress;
  let PROTOCOL_MANAGER: SignerWithAddress;

  let tokensFactory: TokensFactory;
  let verifiedSBTImpl: VerifiedSBT;

  before(async () => {
    [OWNER, SECOND, THIRD, PROTOCOL_MANAGER] = await ethers.getSigners();

    const VerifiedSBT = await ethers.getContractFactory("VerifiedSBT");
    verifiedSBTImpl = await VerifiedSBT.deploy();

    const TokensFactory = await ethers.getContractFactory("TokensFactory");
    tokensFactory = await TokensFactory.deploy();

    await tokensFactory.__TokensFactory_init(PROTOCOL_MANAGER.address, await verifiedSBTImpl.getAddress());

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("#creation", () => {
    it("should set parameters correctly", async () => {
      expect(await tokensFactory.owner()).to.be.eq(OWNER.address);
      expect(await tokensFactory.protocolManagerAddr()).to.be.eq(PROTOCOL_MANAGER.address);
      expect(await tokensFactory.verifiedSBTBeacon()).to.be.not.eq(ethers.ZeroAddress);
      expect(await tokensFactory.getVerifiedSBTImpl()).to.be.eq(await verifiedSBTImpl.getAddress());
    });

    it("should get exception if try to call init function twice", async () => {
      const reason = "Initializable: contract is already initialized";

      await expect(tokensFactory.__TokensFactory_init(PROTOCOL_MANAGER.address, ethers.ZeroAddress)).to.be.revertedWith(
        reason,
      );
    });
  });

  describe("#setNewImplementation", () => {
    it("should correctly upgrade VerifiedSBT implementation", async () => {
      const expectedTokenAddress = await tokensFactory
        .connect(PROTOCOL_MANAGER)
        .deployVerifiedSBT.staticCall(defaultName, defaultSymbol, defaultBaseURI);

      await tokensFactory.connect(PROTOCOL_MANAGER).deployVerifiedSBT(defaultName, defaultSymbol, defaultBaseURI);

      const VerifiedSBTMockFactory = await ethers.getContractFactory("VerifiedSBTMock");

      const newVerifiedToken = VerifiedSBTMockFactory.attach(expectedTokenAddress) as VerifiedSBTMock;

      await expect(newVerifiedToken.version()).to.be.revertedWithoutReason();

      const newVerifiedSBTImpl = await VerifiedSBTMockFactory.deploy();

      await tokensFactory.setNewImplementation(await newVerifiedSBTImpl.getAddress());

      expect(await newVerifiedToken.version()).to.be.eq("v2.0.0");

      expect(await tokensFactory.getVerifiedSBTImpl()).to.be.eq(await newVerifiedSBTImpl.getAddress());

      await tokensFactory.setNewImplementation(await newVerifiedSBTImpl.getAddress());

      expect(await tokensFactory.getVerifiedSBTImpl()).to.be.eq(await newVerifiedSBTImpl.getAddress());
    });

    it("should get exception if not an owner try to call this function", async () => {
      const reason = "Ownable: caller is not the owner";

      await expect(tokensFactory.connect(SECOND).setNewImplementation(ethers.ZeroAddress)).to.be.revertedWith(reason);
    });
  });

  describe("#setProtocolManagerAddr", () => {
    it("should correctly update protocol manager address", async () => {
      await tokensFactory.setProtocolManagerAddr(SECOND.address);

      expect(await tokensFactory.protocolManagerAddr()).to.be.eq(SECOND.address);
    });

    it("should get exception if not an owner try to call this function", async () => {
      const reason = "Ownable: caller is not the owner";

      await expect(tokensFactory.connect(SECOND).setProtocolManagerAddr(SECOND.address)).to.be.revertedWith(reason);
    });
  });

  describe("#deployVerifiedSBT", () => {
    it("should correctly deploy new VerifiedSBT contract", async () => {
      const expectedTokenAddress = await tokensFactory
        .connect(PROTOCOL_MANAGER)
        .deployVerifiedSBT.staticCall(defaultName, defaultSymbol, defaultBaseURI);

      await tokensFactory.connect(PROTOCOL_MANAGER).deployVerifiedSBT(defaultName, defaultSymbol, defaultBaseURI);

      const VerifiedSBTFactory = await ethers.getContractFactory("VerifiedSBT");
      const newVerifiedToken = VerifiedSBTFactory.attach(expectedTokenAddress) as VerifiedSBT;

      expect(await newVerifiedToken.name()).to.eq(defaultName);
      expect(await newVerifiedToken.symbol()).to.eq(defaultSymbol);
      expect(await newVerifiedToken.baseURI()).to.eq(defaultBaseURI);
      expect(await newVerifiedToken.protocolManagerAddr()).to.eq(PROTOCOL_MANAGER.address);
    });

    it("should get exception if not a protocol manager try to call this function", async () => {
      await expect(tokensFactory.connect(SECOND).deployVerifiedSBT(defaultName, defaultSymbol, defaultBaseURI))
        .to.be.revertedWithCustomError(tokensFactory, "TokensFactoryUnauthorized")
        .withArgs(SECOND.address);
    });
  });
});
