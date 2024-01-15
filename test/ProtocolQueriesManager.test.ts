import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { Reverter } from "@/test/helpers/reverter";
import {
  ProtocolQueriesManager,
  IProtocolQueriesManager,
  CredentialAtomicQueryBuilder,
  CredentialAtomicQueryV3Validator,
  PoseidonFacade,
  EncodeHelper,
  CredentialAtomicQueryValidatorMock,
} from "@ethers-v6";
import { ZKProofsHelper, QueriesStorage } from "@/generated-types/ethers/contracts/ProtocolQueriesManager";
import { CredentialAtomicQueryValidator } from "@/generated-types/ethers/contracts/mock/EncodeHelper";
import { deployPoseidonFacade } from "./helpers/poseidonHelper";

const ORGANIZATION_ADMIN_KEY: string = "ORGANIZATION_ADMIN";
const DATE_OF_BIRTH_KEY: string = "DATE_OF_BIRTH";

describe("ProtocolQueriesManager", () => {
  const reverter = new Reverter();

  let OWNER: SignerWithAddress;
  let SECOND: SignerWithAddress;
  let THIRD: SignerWithAddress;
  let SOME_VALIDATOR: SignerWithAddress;

  let protocolQueriesManager: ProtocolQueriesManager;

  let credentialAtomicQueryBuilder: CredentialAtomicQueryBuilder;
  let credentialAtomicQueryV3Builder: CredentialAtomicQueryV3Validator;

  let poseidonFacade: PoseidonFacade;
  let encodeHelper: EncodeHelper;

  let queryValidatorMock: CredentialAtomicQueryValidatorMock;

  let defaultQueryBuilders: IProtocolQueriesManager.UpdateQueryBuilderEntryStruct[] = [];
  let defaultQueries: IProtocolQueriesManager.UpdateProtocolQueryEntryStruct[] = [];

  const defaultCircuitId: string = "credentialAtomicQueryMTPV2OnChain";

  before(async () => {
    [OWNER, SECOND, THIRD, SOME_VALIDATOR] = await ethers.getSigners();

    poseidonFacade = await deployPoseidonFacade(OWNER, false);

    const ProtocolQueriesManagerFactory = await ethers.getContractFactory("ProtocolQueriesManager");
    const CredentialAtomicQueryBuilderFactory = await ethers.getContractFactory("CredentialAtomicQueryBuilder", {
      libraries: {
        PoseidonFacade: await poseidonFacade.getAddress(),
      },
    });
    const CredentialAtomicQueryV3ValidatorFactory = await ethers.getContractFactory("CredentialAtomicQueryV3Validator");
    const CredentialAtomicQueryValidatorMockFactory = await ethers.getContractFactory(
      "CredentialAtomicQueryValidatorMock",
    );
    const EncodeHelperFactory = await ethers.getContractFactory("EncodeHelper");

    protocolQueriesManager = await ProtocolQueriesManagerFactory.deploy();
    credentialAtomicQueryBuilder = await CredentialAtomicQueryBuilderFactory.deploy();
    credentialAtomicQueryV3Builder = await CredentialAtomicQueryV3ValidatorFactory.deploy();

    queryValidatorMock = await CredentialAtomicQueryValidatorMockFactory.deploy(
      defaultCircuitId,
      true,
      ["issuerID", "challenge"],
      ["6", "4"],
    );
    encodeHelper = await EncodeHelperFactory.deploy();

    defaultQueryBuilders = [
      {
        validatorCircuitId: "credentialAtomicQueryMTPV2OnChain",
        queryBuilderAddr: await credentialAtomicQueryBuilder.getAddress(),
        isAdding: true,
      },
      {
        validatorCircuitId: "credentialAtomicQuerySigV2OnChain",
        queryBuilderAddr: await credentialAtomicQueryBuilder.getAddress(),
        isAdding: true,
      },
      {
        validatorCircuitId: "credentialAtomicQueryV3OnChain-beta.0",
        queryBuilderAddr: await credentialAtomicQueryV3Builder.getAddress(),
        isAdding: true,
      },
    ];

    defaultQueries = [
      {
        queryName: ORGANIZATION_ADMIN_KEY,
        query: {
          metadata: "Organization admin schema query",
          queryData: "0x",
          validatorAddr: await queryValidatorMock.getAddress(),
          isStaticQuery: true,
          isGroupLevel: false,
        },
        isAdding: true,
      },
      {
        queryName: DATE_OF_BIRTH_KEY,
        query: {
          metadata: "Query for checking date of birth",
          queryData: "0x",
          validatorAddr: await queryValidatorMock.getAddress(),
          isStaticQuery: true,
          isGroupLevel: true,
        },
        isAdding: true,
      },
    ];

    await protocolQueriesManager.__ProtocolQueriesManager_init(defaultQueryBuilders, defaultQueries);

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("#creation", () => {
    it("should set correct data after creation", async () => {
      expect(await protocolQueriesManager.owner()).to.be.eq(OWNER.address);

      defaultQueryBuilders.forEach(async (el: IProtocolQueriesManager.UpdateQueryBuilderEntryStruct) => {
        expect(await protocolQueriesManager.getQueryBuilder(el.validatorCircuitId)).to.be.eq(el.queryBuilderAddr);
      });

      defaultQueries.forEach(async (el: IProtocolQueriesManager.UpdateProtocolQueryEntryStruct) => {
        expect(await protocolQueriesManager.isDefaultQueryExist(el.queryName)).to.be.eq(true);

        const storedQuery: QueriesStorage.ProtocolQueryStruct = await protocolQueriesManager.getDefaultProtocolQuery(
          el.queryName,
        );

        expect(storedQuery.metadata).to.be.eq(el.query.metadata);

        expect(await protocolQueriesManager.isStaticQuery(0, el.queryName)).to.be.eq(el.query.isStaticQuery);
        expect(await protocolQueriesManager.isGroupLevelQuery(0, el.queryName)).to.be.eq(el.query.isGroupLevel);
        expect(await protocolQueriesManager.isDefaultQueryExist(el.queryName)).to.be.eq(true);
      });

      const adminQuery: QueriesStorage.ProtocolQueryStruct = await protocolQueriesManager.getOrganizationAdminQuery();
      const adminQueryValidator = await protocolQueriesManager.getOrganizationAdminQueryValidator();

      expect(adminQuery.metadata).to.be.eq(defaultQueries[0].query.metadata);
      expect(adminQuery.validatorAddr).to.be.eq(defaultQueries[0].query.validatorAddr);

      expect(adminQueryValidator).to.be.eq(defaultQueries[0].query.validatorAddr);

      expect(await protocolQueriesManager.isProtocolQueryExist(0, ORGANIZATION_ADMIN_KEY)).to.be.eq(true);
    });

    it("should get exception if try to call init function twice", async () => {
      const reason = "Initializable: contract is already initialized";

      await expect(
        protocolQueriesManager.__ProtocolQueriesManager_init(defaultQueryBuilders, defaultQueries),
      ).to.be.revertedWith(reason);
    });
  });

  describe("#updateQueryBuilders", () => {
    it("should correctly add and remove query builders", async () => {
      const queryBuildersToUpdate: IProtocolQueriesManager.UpdateQueryBuilderEntryStruct[] = [
        {
          validatorCircuitId: "credentialAtomicQuerySigV2OnChain",
          queryBuilderAddr: ethers.ZeroAddress,
          isAdding: false,
        },
        {
          validatorCircuitId: "credentialAtomicQueryV3OnChain-beta.1",
          queryBuilderAddr: SOME_VALIDATOR.address,
          isAdding: true,
        },
      ];

      await protocolQueriesManager.updateQueryBuilders(queryBuildersToUpdate);

      expect(
        await protocolQueriesManager.isValidatorCircuitIdSupported(queryBuildersToUpdate[0].validatorCircuitId),
      ).to.be.eq(false);
      expect(await protocolQueriesManager.getQueryBuilder(queryBuildersToUpdate[0].validatorCircuitId)).to.be.eq(
        ethers.ZeroAddress,
      );

      expect(
        await protocolQueriesManager.isValidatorCircuitIdSupported(queryBuildersToUpdate[1].validatorCircuitId),
      ).to.be.eq(true);
      expect(await protocolQueriesManager.getQueryBuilder(queryBuildersToUpdate[1].validatorCircuitId)).to.be.eq(
        SOME_VALIDATOR.address,
      );
    });

    it("should get exception if pass zero query builder address", async () => {
      await expect(
        protocolQueriesManager.updateQueryBuilders([
          {
            validatorCircuitId: "credentialAtomicQueryV3OnChain-beta.1",
            queryBuilderAddr: ethers.ZeroAddress,
            isAdding: true,
          },
        ]),
      )
        .to.be.revertedWithCustomError(protocolQueriesManager, "ProtocolQueriesManagerZeroAddress")
        .withArgs("QueryBuilder");
    });

    it("should get exception if not an owner try to call this function", async () => {
      const reason = "Ownable: caller is not the owner";

      await expect(
        protocolQueriesManager.connect(SOME_VALIDATOR).updateQueryBuilders([
          {
            validatorCircuitId: "credentialAtomicQueryV3OnChain-beta.1",
            queryBuilderAddr: SOME_VALIDATOR.address,
            isAdding: true,
          },
        ]),
      ).to.be.revertedWith(reason);
    });
  });

  describe("#updateDefaultQueries", () => {
    it("should corectly update default queries", async () => {
      const queriesToUpdate: IProtocolQueriesManager.UpdateProtocolQueryEntryStruct[] = [
        {
          queryName: DATE_OF_BIRTH_KEY,
          query: {
            metadata: "",
            queryData: "0x",
            validatorAddr: ethers.ZeroAddress,
            isStaticQuery: false,
            isGroupLevel: false,
          },
          isAdding: false,
        },
        {
          queryName: "EMAIL",
          query: {
            metadata: "Query for checking email",
            queryData: "0x",
            validatorAddr: await queryValidatorMock.getAddress(),
            isStaticQuery: false,
            isGroupLevel: true,
          },
          isAdding: true,
        },
      ];

      await protocolQueriesManager.updateDefaultQueries(queriesToUpdate);

      let storedQuery: QueriesStorage.ProtocolQueryStruct = await protocolQueriesManager.getDefaultProtocolQuery(
        queriesToUpdate[1].queryName,
      );

      expect(storedQuery.metadata).to.be.eq(queriesToUpdate[1].query.metadata);
      expect(await protocolQueriesManager.isGroupLevelQuery(0, queriesToUpdate[1].queryName)).to.be.eq(true);
      expect(await protocolQueriesManager.isStaticQuery(0, queriesToUpdate[1].queryName)).to.be.eq(false);
      expect(await protocolQueriesManager.isDefaultQueryExist(queriesToUpdate[1].queryName)).to.be.eq(true);

      storedQuery = await protocolQueriesManager.getDefaultProtocolQuery(queriesToUpdate[0].queryName);

      expect(storedQuery.metadata).to.be.eq(queriesToUpdate[0].query.metadata);
      expect(await protocolQueriesManager.isGroupLevelQuery(0, queriesToUpdate[0].queryName)).to.be.eq(false);
      expect(await protocolQueriesManager.isStaticQuery(0, queriesToUpdate[0].queryName)).to.be.eq(false);
      expect(await protocolQueriesManager.isDefaultQueryExist(queriesToUpdate[0].queryName)).to.be.eq(false);
    });

    it("should get exception if try to remove ORGANIZATION_ADMIN query", async () => {
      await expect(
        protocolQueriesManager.updateDefaultQueries([
          {
            queryName: ORGANIZATION_ADMIN_KEY,
            query: {
              metadata: "",
              queryData: "0x",
              validatorAddr: ethers.ZeroAddress,
              isStaticQuery: false,
              isGroupLevel: false,
            },
            isAdding: false,
          },
        ]),
      )
        .to.be.revertedWithCustomError(protocolQueriesManager, "ProtocolQueriesManagerQueryDoesNotExist")
        .withArgs(ORGANIZATION_ADMIN_KEY);
    });

    it("should get exception if not an owner try to call this function", async () => {
      const reason = "Ownable: caller is not the owner";

      await expect(
        protocolQueriesManager.connect(SOME_VALIDATOR).updateDefaultQueries([
          {
            queryName: ORGANIZATION_ADMIN_KEY,
            query: {
              metadata: "",
              queryData: "0x",
              validatorAddr: SOME_VALIDATOR.address,
              isStaticQuery: false,
              isGroupLevel: false,
            },
            isAdding: false,
          },
        ]),
      ).to.be.revertedWith(reason);
    });
  });

  describe("#updateOrganizationQueries", () => {
    const orgId: string = "20823307793724103113205494482134473400617001723515577429684573989557567489";
    const defOrgAdminProofData: ZKProofsHelper.ZKProofDataStruct = {
      a: [
        "15179469140258623977285828435965999511234057423399365801923122856697320108354",
        "2820709928966508686873009193307242432166796085797273283980351966293213344691",
      ],
      b: [
        [
          "21332868369288711817785997568459773223173686191140723363560672439238184973232",
          "7475056094516417624058659607914629311319020598126056520700330923116796147442",
        ],
        [
          "1812611376386162888441884715916474915097523781157633162843739183884165412036",
          "21443701837978743728840029836386339650015013562474440573115584473366000442895",
        ],
      ],
      c: [
        "5591557545424946855918281274808711389904750124876358805343538644310381923440",
        "3680391878932234435484487320153831020125844444773977200637075441184588563840",
      ],
      inputs: [
        "1",
        "6812322478969695814909118190554556889830814522342428473396967608251481543532",
        "13711720206708139028151549152951467462236062438736016491241886057196878646979",
        "1",
        "583091486781463398742321306787801699791102451699",
        "0",
        orgId,
        "18704549882014608248287768418949674472202294737477580461706000241488297935",
        "1",
        "13711720206708139028151549152921467462236062438734016491241886057196878646979",
        "1687267233",
      ],
    };

    it("should correctly update organization queries", async () => {
      const newQueryKey: string = "TELEGRAM";
      const orgQueriesToAdd: IProtocolQueriesManager.UpdateProtocolQueryEntryStruct[] = [
        {
          queryName: newQueryKey,
          query: {
            metadata: "Query for checking telegram name",
            queryData: "0x",
            validatorAddr: SOME_VALIDATOR.address,
            isStaticQuery: true,
            isGroupLevel: true,
          },
          isAdding: true,
        },
      ];

      await protocolQueriesManager.updateOrganizationQueries(defOrgAdminProofData, orgQueriesToAdd);

      expect(await protocolQueriesManager.isDefaultQueryExist(newQueryKey)).to.be.eq(false);
      expect(await protocolQueriesManager.isProtocolQueryExist(orgId, newQueryKey)).to.be.eq(true);

      const storedQuery: QueriesStorage.ProtocolQueryStruct = await protocolQueriesManager.getProtocolQuery(
        orgId,
        newQueryKey,
      );

      expect(storedQuery.metadata).to.be.eq(orgQueriesToAdd[0].query.metadata);

      expect(await protocolQueriesManager.getProtocolQueryValidator(orgId, newQueryKey)).to.be.eq(
        SOME_VALIDATOR.address,
      );

      orgQueriesToAdd[0].isAdding = false;

      await protocolQueriesManager.updateOrganizationQueries(defOrgAdminProofData, orgQueriesToAdd);

      expect(await protocolQueriesManager.isProtocolQueryExist(orgId, newQueryKey)).to.be.eq(false);
    });

    it("should get exception if pass invalid proof data", async () => {
      await queryValidatorMock.setVerificationResult(false);

      const newQueryKey: string = "TELEGRAM";
      const orgQueriesToAdd: IProtocolQueriesManager.UpdateProtocolQueryEntryStruct[] = [
        {
          queryName: newQueryKey,
          query: {
            metadata: "Query for checking telegram name",
            queryData: "0x",
            validatorAddr: await queryValidatorMock.getAddress(),
            isStaticQuery: true,
            isGroupLevel: true,
          },
          isAdding: true,
        },
      ];

      await expect(
        protocolQueriesManager.updateOrganizationQueries(defOrgAdminProofData, orgQueriesToAdd),
      ).to.be.revertedWithCustomError(queryValidatorMock, "VerificationFailed");
    });
  });

  describe("#getDynamicQueryData", () => {
    it("should return correct info", async () => {
      const schema = "1111";
      const claimPathKey = "2222";
      const operator = "2";
      const slotIndex = "3";
      const values = ["200"];

      const queryDataStruct: CredentialAtomicQueryValidator.CredentialAtomicQueryStruct = {
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

      const queryData: string = await encodeHelper.encodeQueryValidatorStruct(queryDataStruct);

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

      queryDataStruct.value = newValues;
      queryDataStruct.queryHash = newQueryHash;

      const newData = await protocolQueriesManager.getDynamicQueryData(
        "credentialAtomicQueryMTPV2OnChain",
        newValues,
        queryData,
      );

      const decodedStruct: CredentialAtomicQueryValidator.CredentialAtomicQueryStruct =
        await encodeHelper.decodeQueryValidatorStruct(newData);

      expect(queryDataStruct.queryHash).to.be.eq(decodedStruct.queryHash);
      expect(queryDataStruct.value).to.be.deep.eq(decodedStruct.value);
      expect(queryDataStruct.circuitIds).to.deep.eq(decodedStruct.circuitIds);
    });
  });
});
