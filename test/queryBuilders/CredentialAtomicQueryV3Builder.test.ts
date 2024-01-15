import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { Reverter } from "@/test/helpers/reverter";
import { CredentialAtomicQueryV3Builder, EncodeHelper, PoseidonFacade } from "@ethers-v6";
import { deployPoseidonFacade } from "@/test/helpers/poseidonHelper";

describe("CredentialAtomicQueryV3Builder", () => {
  const reverter = new Reverter();

  const maxValuesArrLength = 64;

  let OWNER: SignerWithAddress;

  let credentialAtomicQueryV3Builder: CredentialAtomicQueryV3Builder;
  let poseidonFacade: PoseidonFacade;
  let encodeHelper: EncodeHelper;

  before(async () => {
    [OWNER] = await ethers.getSigners();

    poseidonFacade = await deployPoseidonFacade(OWNER, false);

    const CredentialAtomicQueryV3BuilderFactory = await ethers.getContractFactory("CredentialAtomicQueryV3Builder", {
      libraries: {
        PoseidonFacade: await poseidonFacade.getAddress(),
      },
    });
    const EncodeHelperFactory = await ethers.getContractFactory("EncodeHelper");

    credentialAtomicQueryV3Builder = await CredentialAtomicQueryV3BuilderFactory.deploy();
    encodeHelper = await EncodeHelperFactory.deploy();

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("#creation", () => {
    it("should set parameters correctly", async () => {
      expect(await credentialAtomicQueryV3Builder.getBuilderName()).to.be.eq("CredentialAtomicQueryV3Builder");
    });
  });

  describe("#buildQuery", () => {
    const schema = "1111";
    const claimPathKey = "2222";
    const operator = "2";
    const slotIndex = "3";
    const values = ["200"];

    const queryStruct = {
      schema: schema,
      claimPathKey: claimPathKey,
      operator: operator,
      slotIndex: slotIndex,
      value: values,
      queryHash: "0",
      allowedIssuers: [],
      circuitIds: ["credentialAtomicQueryMTPV2OnChain"],
      claimPathNotExists: "0",
      skipClaimRevocationCheck: false,
      groupID: "123",
      nullifierSessionID: "666",
      proofType: "2",
      verifierID: "999",
    };

    it("should correctly update bytes with new values", async () => {
      const queryData: string = await encodeHelper.encodeQueryValidatorV3Struct(queryStruct);

      const newValues = ["300"];
      const newValuesHash = await poseidonFacade.poseidonSponge([
        ...newValues,
        ...new Array(63).fill(63).map((_, i) => "0"),
      ]);
      const newQueryHash = await poseidonFacade.poseidon6([
        schema,
        slotIndex,
        operator,
        claimPathKey,
        "0",
        newValuesHash,
      ]);

      const newQueryData: string = await credentialAtomicQueryV3Builder.buildQuery(queryData, newValues);

      const decodedStruct = await encodeHelper.decodeQueryValidatorV3Struct(newQueryData);

      queryStruct.value = newValues;
      queryStruct.queryHash = newQueryHash.toString();

      expect(queryStruct.schema).to.be.eq(decodedStruct.schema);
      expect(queryStruct.claimPathKey).to.be.eq(decodedStruct.claimPathKey);
      expect(queryStruct.circuitIds).to.be.deep.eq(decodedStruct.circuitIds);
      expect(queryStruct.skipClaimRevocationCheck).to.be.eq(decodedStruct.skipClaimRevocationCheck);
      expect(queryStruct.value).to.be.deep.eq(decodedStruct.value);
      expect(queryStruct.queryHash).to.be.eq(decodedStruct.queryHash);
    });

    it("should correctly update bytes with max length values arr", async () => {
      const queryData: string = await encodeHelper.encodeQueryValidatorV3Struct(queryStruct);

      const newValues = ["400", ...new Array(63).fill(63).map((_, i) => "0")];

      const newValuesHash = await poseidonFacade.poseidonSponge(newValues);
      const newQueryHash = await poseidonFacade.poseidon6([
        schema,
        slotIndex,
        operator,
        claimPathKey,
        "0",
        newValuesHash,
      ]);

      const newQueryData: string = await credentialAtomicQueryV3Builder.buildQuery(queryData, newValues);

      const decodedStruct = await encodeHelper.decodeQueryValidatorV3Struct(newQueryData);

      queryStruct.value = newValues;
      queryStruct.queryHash = newQueryHash.toString();

      expect(queryStruct.schema).to.be.eq(decodedStruct.schema);
      expect(queryStruct.claimPathKey).to.be.eq(decodedStruct.claimPathKey);
      expect(queryStruct.circuitIds).to.be.deep.eq(decodedStruct.circuitIds);
      expect(queryStruct.skipClaimRevocationCheck).to.be.eq(decodedStruct.skipClaimRevocationCheck);
      expect(queryStruct.value).to.be.deep.eq(decodedStruct.value);
      expect(queryStruct.queryHash).to.be.eq(decodedStruct.queryHash);
    });

    it("should get exception if pass values arr with length that greater than the maximum", async () => {
      const queryData: string = await encodeHelper.encodeQueryValidatorV3Struct(queryStruct);
      const newValues = ["500", ...new Array(163).fill(63).map((_, i) => "0")];

      await expect(credentialAtomicQueryV3Builder.buildQuery(queryData, newValues))
        .to.be.revertedWithCustomError(credentialAtomicQueryV3Builder, "QueryBuilderInvalidValuesArrLength")
        .withArgs(newValues.length, maxValuesArrLength);
    });
  });
});
