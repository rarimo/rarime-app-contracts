import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { Reverter } from "@/test/helpers/reverter";
import {
  ProtocolQueriesManager,
  ProtocolManager,
  CredentialAtomicQueryBuilder,
  CredentialAtomicQueryV3Validator,
  PoseidonFacade,
  EncodeHelper,
  CredentialAtomicQueryValidatorMock,
  VerifiedSBT,
  TokensFactory,
  IProtocolQueriesManager,
} from "@ethers-v6";
import { ZKProofsHelper } from "@/generated-types/ethers/contracts/ProtocolQueriesManager";
import { deployPoseidonFacade } from "./helpers/poseidonHelper";

const ORGANIZATION_ADMIN_KEY: string = "ORGANIZATION_ADMIN";
const DATE_OF_BIRTH_KEY: string = "DATE_OF_BIRTH";

describe("ProtocolManager", () => {
  const reverter = new Reverter();

  const defaultName: string = "VerifiedSBT Token Name";
  const defaultSymbol: string = "VSBT";
  const defaultBaseURI: string = "some uri";

  let OWNER: SignerWithAddress;
  let SECOND: SignerWithAddress;
  let THIRD: SignerWithAddress;

  let tokensFactory: TokensFactory;
  let verifiedSBTImpl: VerifiedSBT;

  let protocolManager: ProtocolManager;
  let protocolQueriesManager: ProtocolQueriesManager;

  let credentialAtomicQueryBuilder: CredentialAtomicQueryBuilder;
  let credentialAtomicQueryV3Builder: CredentialAtomicQueryV3Validator;

  let poseidonFacade: PoseidonFacade;
  let encodeHelper: EncodeHelper;

  let queryValidatorMock: CredentialAtomicQueryValidatorMock;

  let defaultQueryBuilders: IProtocolQueriesManager.UpdateQueryBuilderEntryStruct[] = [];
  let defaultQueries: IProtocolQueriesManager.UpdateProtocolQueryEntryStruct[] = [];

  const defaultCircuitId: string = "credentialAtomicQueryMTPV2OnChain";

  const defOrgId: string = "20823307793724103113205494482134473400617001723515577429684573989557567489";
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
      defOrgId,
      "18704549882014608248287768418949674472202294737477580461706000241488297935",
      "1",
      "13711720206708139028151549152921467462236062438734016491241886057196878646979",
      "1687267233",
    ],
  };

  before(async () => {
    [OWNER, SECOND, THIRD] = await ethers.getSigners();

    poseidonFacade = await deployPoseidonFacade(OWNER, false);

    const ProtocolManagerFactory = await ethers.getContractFactory("ProtocolManager", {
      libraries: {
        PoseidonFacade: await poseidonFacade.getAddress(),
      },
    });
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

    const VerifiedSBT = await ethers.getContractFactory("VerifiedSBT");
    const TokensFactory = await ethers.getContractFactory("TokensFactory");

    protocolManager = await ProtocolManagerFactory.deploy();
    protocolQueriesManager = await ProtocolQueriesManagerFactory.deploy();
    credentialAtomicQueryBuilder = await CredentialAtomicQueryBuilderFactory.deploy();
    credentialAtomicQueryV3Builder = await CredentialAtomicQueryV3ValidatorFactory.deploy();

    verifiedSBTImpl = await VerifiedSBT.deploy();
    tokensFactory = await TokensFactory.deploy();

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

    await protocolManager.__ProtocolManager_init(
      await tokensFactory.getAddress(),
      await protocolQueriesManager.getAddress(),
    );
    await protocolQueriesManager.__ProtocolQueriesManager_init(defaultQueryBuilders, defaultQueries);
    await tokensFactory.__TokensFactory_init(await protocolManager.getAddress(), await verifiedSBTImpl.getAddress());

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("#creation", () => {
    it("should set parameters correctly", async () => {
      expect(await protocolManager.owner()).to.be.eq(OWNER.address);
      expect(await protocolManager.queriesManager()).to.be.eq(await protocolQueriesManager.getAddress());
      expect(await protocolManager.tokensFactory()).to.be.eq(await tokensFactory.getAddress());
    });

    it("should get exception if try to call init function twice", async () => {
      const reason = "Initializable: contract is already initialized";

      await expect(
        protocolManager.__ProtocolManager_init(
          await tokensFactory.getAddress(),
          await protocolQueriesManager.getAddress(),
        ),
      ).to.be.revertedWith(reason);
    });
  });

  describe("#updateProtocolIssuers", () => {
    it("should correctly update protocol issuers list", async () => {
      const issuersToAdd = ["123", "222", "333"];

      let tx = await protocolManager.updateProtocolIssuers(issuersToAdd, true);

      expect(tx).to.be.emit(protocolManager, "ProtocolIssuersUpdated").withArgs(issuersToAdd, true);

      expect(await protocolManager.getProtocolIssuers()).to.be.deep.eq(issuersToAdd);
      expect(await protocolManager.isProtocolIssuer(issuersToAdd[0])).to.be.eq(true);

      const issuersToRemove = issuersToAdd.slice(1, 3);

      tx = await protocolManager.updateProtocolIssuers(issuersToRemove, false);

      expect(tx).to.be.emit(protocolManager, "ProtocolIssuersUpdated").withArgs(issuersToRemove, false);

      expect(await protocolManager.getProtocolIssuers()).to.be.deep.eq(issuersToAdd.slice(0, 1));
      expect(await protocolManager.isProtocolIssuer(issuersToAdd[0])).to.be.eq(true);
      expect(await protocolManager.isProtocolIssuer(issuersToAdd[1])).to.be.eq(false);
    });

    it("should get exception if not an owner try to call this function", async () => {
      const reason = "Ownable: caller is not the owner";

      await expect(protocolManager.connect(SECOND).updateProtocolIssuers(["123"], true)).to.be.revertedWith(reason);
    });
  });

  describe("#deployVerifiedSBT", () => {
    const groupId: string = "2211";

    beforeEach("setup", async () => {
      await protocolManager.updateProtocolIssuers([defOrgId], true);
    });

    it("should correctly deploy new verified SBT Token", async () => {
      const tx = await protocolManager.deployVerifiedSBT(
        {
          organizationId: defOrgId,
          proofData: defOrgAdminProofData,
          groupId: groupId,
          queryName: DATE_OF_BIRTH_KEY,
        },
        defaultName,
        defaultSymbol,
        defaultBaseURI,
      );

      const deployedTokenAddr = await protocolManager.getOrganizationToken(defOrgId, groupId, DATE_OF_BIRTH_KEY);

      expect(tx)
        .to.be.emit(protocolManager, "VerifiedSBTDeployed")
        .withArgs(defOrgId, groupId, DATE_OF_BIRTH_KEY, deployedTokenAddr);
      expect(deployedTokenAddr).to.be.not.eq(ethers.ZeroAddress);
    });

    it("should get exception if issuer id is not in the protocols issuers list", async () => {
      await expect(
        protocolManager.deployVerifiedSBT(
          {
            organizationId: "123",
            proofData: defOrgAdminProofData,
            groupId: groupId,
            queryName: DATE_OF_BIRTH_KEY,
          },
          defaultName,
          defaultSymbol,
          defaultBaseURI,
        ),
      )
        .to.be.revertedWithCustomError(protocolManager, "ProtocolManagerIsNotTheProtocolIssuer")
        .withArgs("123");
    });

    it("should get exception if user passed invalid organization ID", async () => {
      await protocolManager.updateProtocolIssuers(["123"], true);

      await expect(
        protocolManager.deployVerifiedSBT(
          {
            organizationId: "123",
            proofData: defOrgAdminProofData,
            groupId: groupId,
            queryName: DATE_OF_BIRTH_KEY,
          },
          defaultName,
          defaultSymbol,
          defaultBaseURI,
        ),
      )
        .to.be.revertedWithCustomError(protocolManager, "ProtocolManagerInvalidaOrganizationId")
        .withArgs("123", defOrgId);
    });

    it("should get exception if query does not exist", async () => {
      const invalidQueryName = "SOME_NAME";

      await expect(
        protocolManager.deployVerifiedSBT(
          {
            organizationId: defOrgId,
            proofData: defOrgAdminProofData,
            groupId: groupId,
            queryName: invalidQueryName,
          },
          defaultName,
          defaultSymbol,
          defaultBaseURI,
        ),
      )
        .to.be.revertedWithCustomError(protocolManager, "ProtocolManagerQueryDoesNotExist")
        .withArgs(defOrgId, invalidQueryName);
    });

    it("should get exception if the token is already deployed", async () => {
      await protocolManager.deployVerifiedSBT(
        {
          organizationId: defOrgId,
          proofData: defOrgAdminProofData,
          groupId: groupId,
          queryName: DATE_OF_BIRTH_KEY,
        },
        defaultName,
        defaultSymbol,
        defaultBaseURI,
      );

      const queryKey = await protocolManager.getTokenQueryKey(defOrgId, groupId, DATE_OF_BIRTH_KEY);

      await expect(
        protocolManager.deployVerifiedSBT(
          {
            organizationId: defOrgId,
            proofData: defOrgAdminProofData,
            groupId: groupId,
            queryName: DATE_OF_BIRTH_KEY,
          },
          defaultName + "New",
          defaultSymbol,
          defaultBaseURI,
        ),
      )
        .to.be.revertedWithCustomError(protocolManager, "ProtocolManagerTokenIsAlreadyDeployed")
        .withArgs(defOrgId, queryKey);
    });
  });

  describe("#changeBaseTokenURI", () => {
    const groupId1: string = "2211";
    const groupId2: string = "3311";
    const newBaseURI = "new base URI";

    beforeEach("setup", async () => {
      await protocolManager.updateProtocolIssuers([defOrgId], true);
      await protocolManager.deployVerifiedSBT(
        {
          organizationId: defOrgId,
          proofData: defOrgAdminProofData,
          groupId: groupId1,
          queryName: DATE_OF_BIRTH_KEY,
        },
        defaultName,
        defaultSymbol,
        defaultBaseURI,
      );
    });

    it("should corectly update base token URI", async () => {
      const tx = await protocolManager.changeBaseTokenURI(
        {
          organizationId: defOrgId,
          proofData: defOrgAdminProofData,
          groupId: groupId1,
          queryName: DATE_OF_BIRTH_KEY,
        },
        newBaseURI,
      );

      const VerifiedSBT = await ethers.getContractFactory("VerifiedSBT");

      const deployedTokenAddr = await protocolManager.getOrganizationToken(defOrgId, groupId1, DATE_OF_BIRTH_KEY);

      expect(await (VerifiedSBT.attach(deployedTokenAddr) as VerifiedSBT).baseURI()).to.be.eq(newBaseURI);
      expect(tx)
        .to.be.emit(protocolManager, "BaseTokenURIChanged")
        .withArgs(defOrgId, groupId1, DATE_OF_BIRTH_KEY, newBaseURI);
    });

    it("should get exception if token does not exist", async () => {
      await expect(
        protocolManager.changeBaseTokenURI(
          {
            organizationId: defOrgId,
            proofData: defOrgAdminProofData,
            groupId: groupId2,
            queryName: DATE_OF_BIRTH_KEY,
          },
          newBaseURI,
        ),
      )
        .to.be.revertedWithCustomError(protocolManager, "ProtocolManagerZeroTokenAddr")
        .withArgs(defOrgId, groupId2, DATE_OF_BIRTH_KEY);
    });
  });

  describe("#mintVerifiedSBT", () => {
    const groupId: string = "2211";
    let dateOfBirthSBT: VerifiedSBT;

    beforeEach("setup", async () => {
      await protocolManager.updateProtocolIssuers([defOrgId], true);
      await protocolManager.deployVerifiedSBT(
        {
          organizationId: defOrgId,
          proofData: defOrgAdminProofData,
          groupId: groupId,
          queryName: DATE_OF_BIRTH_KEY,
        },
        defaultName,
        defaultSymbol,
        defaultBaseURI,
      );

      const VerifiedSBT = await ethers.getContractFactory("VerifiedSBT");
      const deployedTokenAddr = await protocolManager.getOrganizationToken(defOrgId, groupId, DATE_OF_BIRTH_KEY);

      dateOfBirthSBT = VerifiedSBT.attach(deployedTokenAddr) as VerifiedSBT;
    });

    it("should correctly mint SBT token", async () => {
      await protocolManager.mintVerifiedSBT([
        {
          baseProofData: {
            organizationId: defOrgId,
            proofData: defOrgAdminProofData,
            groupId: groupId,
            queryName: DATE_OF_BIRTH_KEY,
          },
          claimFieldValue: "0",
        },
      ]);

      expect(await dateOfBirthSBT.balanceOf(OWNER.address)).to.be.eq(1);
    });

    it("should get exception if pass empty mint data arr", async () => {
      await expect(protocolManager.mintVerifiedSBT([])).to.be.revertedWithCustomError(
        protocolManager,
        "ProtocolManagerZeroMintTokensDataArr",
      );
    });

    it("should get exception if pass empty mint data arr", async () => {
      await protocolManager.mintVerifiedSBT([
        {
          baseProofData: {
            organizationId: defOrgId,
            proofData: defOrgAdminProofData,
            groupId: groupId,
            queryName: DATE_OF_BIRTH_KEY,
          },
          claimFieldValue: "0",
        },
      ]);

      await expect(
        protocolManager.mintVerifiedSBT([
          {
            baseProofData: {
              organizationId: defOrgId,
              proofData: defOrgAdminProofData,
              groupId: groupId,
              queryName: DATE_OF_BIRTH_KEY,
            },
            claimFieldValue: "0",
          },
        ]),
      )
        .to.be.revertedWithCustomError(protocolManager, "ProtocolManagerUserAlreadyHasTheToken")
        .withArgs(OWNER.address, await dateOfBirthSBT.getAddress());
    });

    it("should get exception if query does not exist", async () => {
      const invalidQueryName = "some query name";

      await expect(
        protocolManager.mintVerifiedSBT([
          {
            baseProofData: {
              organizationId: defOrgId,
              proofData: defOrgAdminProofData,
              groupId: groupId,
              queryName: invalidQueryName,
            },
            claimFieldValue: "0",
          },
        ]),
      )
        .to.be.revertedWithCustomError(protocolManager, "ProtocolManagerQueryDoesNotExist")
        .withArgs(defOrgId, invalidQueryName);
    });
  });
});
