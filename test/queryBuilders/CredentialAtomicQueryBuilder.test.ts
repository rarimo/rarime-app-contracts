import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { Reverter } from "@/test/helpers/reverter";
import { CredentialAtomicQueryBuilder, EncodeHelper, PoseidonFacade } from "@ethers-v6";
import { deployPoseidonFacade } from "@/test/helpers/poseidonHelper";

describe("CredentialAtomicQueryBuilder", () => {
  const reverter = new Reverter();

  const maxValuesArrLength = 64;

  let OWNER: SignerWithAddress;

  let credentialAtomicQueryBuilder: CredentialAtomicQueryBuilder;
  let poseidonFacade: PoseidonFacade;
  let encodeHelper: EncodeHelper;

  before(async () => {
    [OWNER] = await ethers.getSigners();

    poseidonFacade = await deployPoseidonFacade(OWNER, false);

    const CredentialAtomicQueryBuilderFactory = await ethers.getContractFactory("CredentialAtomicQueryBuilder", {
      libraries: {
        PoseidonFacade: await poseidonFacade.getAddress(),
      },
    });
    const EncodeHelperFactory = await ethers.getContractFactory("EncodeHelper");

    credentialAtomicQueryBuilder = await CredentialAtomicQueryBuilderFactory.deploy();
    encodeHelper = await EncodeHelperFactory.deploy();

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("#creation", () => {
    it("should set parameters correctly", async () => {
      expect(await credentialAtomicQueryBuilder.getBuilderName()).to.be.eq("CredentialAtomicQueryBuilder");
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
    };

    it("should correctly update bytes with new values", async () => {
      const queryData: string = await encodeHelper.encodeQueryValidatorStruct(queryStruct);

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

      const newQueryData: string = await credentialAtomicQueryBuilder.buildQuery(queryData, newValues);

      const decodedStruct = await encodeHelper.decodeQueryValidatorStruct(newQueryData);

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
      const queryData: string = await encodeHelper.encodeQueryValidatorStruct(queryStruct);

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

      const newQueryData: string = await credentialAtomicQueryBuilder.buildQuery(queryData, newValues);

      const decodedStruct = await encodeHelper.decodeQueryValidatorStruct(newQueryData);

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
      const queryData: string = await encodeHelper.encodeQueryValidatorStruct(queryStruct);
      const newValues = ["500", ...new Array(163).fill(63).map((_, i) => "0")];

      await expect(credentialAtomicQueryBuilder.buildQuery(queryData, newValues))
        .to.be.revertedWithCustomError(credentialAtomicQueryBuilder, "QueryBuilderInvalidValuesArrLength")
        .withArgs(newValues.length, maxValuesArrLength);
    });
  });
});
