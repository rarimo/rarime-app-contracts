import { Deployer, Reporter } from "@solarity/hardhat-migrate";

import { parseConfig, Config } from "@/deploy/helpers/configParser";
import { deployPoseidons } from "@/deploy/helpers/deployHelper";

import {
  PoseidonFacade__factory,
  SpongePoseidon__factory,
  CredentialAtomicQueryBuilder__factory,
  CredentialAtomicQueryV3Builder__factory,
  VerifiedSBT__factory,
  TokensFactory__factory,
  ProtocolManager__factory,
  ProtocolQueriesManager__factory,
  PoseidonFacade,
} from "@/generated-types/ethers";

export = async (deployer: Deployer) => {
  const config: Config = parseConfig();

  let poseidonFacade: PoseidonFacade;

  if (config.poseidonFacade === "") {
    // Deploy Poseidon contracts
    await deployPoseidons(deployer, [1, 2, 3, 4, 5, 6]);

    await deployer.deploy(SpongePoseidon__factory);
    poseidonFacade = await deployer.deploy(PoseidonFacade__factory);
  } else {
    poseidonFacade = await deployer.deployed(PoseidonFacade__factory, config.poseidonFacade);
  }

  // Deploy Query builders
  const credAtomicQueryBuilder = await deployer.deploy(CredentialAtomicQueryBuilder__factory, {
    libraries: {
      PoseidonFacade: await poseidonFacade.getAddress(),
    },
  });
  const credAtomicQueryV3Builder = await deployer.deploy(CredentialAtomicQueryV3Builder__factory, {
    libraries: {
      PoseidonFacade: await poseidonFacade.getAddress(),
    },
  });

  // Deploy TokensFactory contracts
  const verifiedSBTImpl = await deployer.deploy(VerifiedSBT__factory);
  const tokensFactory = await deployer.deploy(TokensFactory__factory);

  // Deploy Main protocol contracts
  const protocolManager = await deployer.deploy(ProtocolManager__factory, {
    libraries: {
      PoseidonFacade: await poseidonFacade.getAddress(),
    },
  });
  const protocolQueriesManager = await deployer.deploy(ProtocolQueriesManager__factory);

  Reporter.reportContracts(
    ["PoseidonFacade", await poseidonFacade.getAddress()],
    ["CredentialAtomicQueryBuilder", await credAtomicQueryBuilder.getAddress()],
    ["CredentialAtomicQueryV3Builder", await credAtomicQueryV3Builder.getAddress()],
    ["VerifiedSBT Impl", await verifiedSBTImpl.getAddress()],
    ["TokensFactory", await tokensFactory.getAddress()],
    ["ProtocolManager", await protocolManager.getAddress()],
    ["ProtocolQueriesManager", await protocolQueriesManager.getAddress()],
  );
};
