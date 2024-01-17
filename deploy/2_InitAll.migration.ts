import { Deployer } from "@solarity/hardhat-migrate";

import { parseConfig, Config } from "@/deploy/helpers/configParser";

import {
  VerifiedSBT__factory,
  TokensFactory__factory,
  ProtocolManager__factory,
  ProtocolQueriesManager__factory,
  CredentialAtomicQueryBuilder__factory,
  CredentialAtomicQueryV3Builder__factory,
  IProtocolQueriesManager,
} from "@/generated-types/ethers";

export = async (deployer: Deployer) => {
  const config: Config = parseConfig();

  const protocolManager = await deployer.deployed(ProtocolManager__factory);
  const protocolQueriesManager = await deployer.deployed(ProtocolQueriesManager__factory);
  const tokensFactory = await deployer.deployed(TokensFactory__factory);
  const verifiedSBTImpl = await deployer.deployed(VerifiedSBT__factory);

  await protocolManager.__ProtocolManager_init(
    await tokensFactory.getAddress(),
    await protocolQueriesManager.getAddress(),
  );
  await tokensFactory.__TokensFactory_init(await protocolManager.getAddress(), await verifiedSBTImpl.getAddress());

  const credentialAtomicQueryBuilderAddr = await (
    await deployer.deployed(CredentialAtomicQueryBuilder__factory)
  ).getAddress();
  const credentialAtomicQueryV3BuilderAddr = await (
    await deployer.deployed(CredentialAtomicQueryV3Builder__factory)
  ).getAddress();

  const queryBuildersToUpdate: IProtocolQueriesManager.UpdateQueryBuilderEntryStruct[] = [
    {
      validatorCircuitId: "credentialAtomicQueryMTPV2OnChain",
      queryBuilderAddr: credentialAtomicQueryBuilderAddr,
      isAdding: true,
    },
    {
      validatorCircuitId: "credentialAtomicQuerySigV2OnChain",
      queryBuilderAddr: credentialAtomicQueryBuilderAddr,
      isAdding: true,
    },
    {
      validatorCircuitId: "credentialAtomicQueryV3OnChain-beta.0",
      queryBuilderAddr: credentialAtomicQueryV3BuilderAddr,
      isAdding: true,
    },
  ];

  await protocolQueriesManager.__ProtocolQueriesManager_init(queryBuildersToUpdate, config.initDefaultQueries);
};
