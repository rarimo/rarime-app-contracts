import * as fs from "fs";

import { ethers } from "hardhat";

import { IProtocolQueriesManager } from "@/generated-types/ethers";
import { ORGANIZATION_ADMIN_KEY } from "./deployHelper";

export type Config = {
  poseidonFacade: string;
  initDefaultQueries: IProtocolQueriesManager.UpdateProtocolQueryEntryStruct[];
};

export function parseConfig(configPath: string = "deploy/data/config.json"): Config {
  const config: Config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Config;

  if (config.poseidonFacade !== "" && !ethers.isAddress(config.poseidonFacade)) {
    throw new Error(`Invalid poseidonFacade address - ${config.poseidonFacade}`);
  }

  validateInitDefaultQueriesArr(config.initDefaultQueries);

  return config;
}

function validateInitDefaultQueriesArr(initDefaultQueries: IProtocolQueriesManager.UpdateProtocolQueryEntryStruct[]) {
  if (
    !initDefaultQueries.find((el: IProtocolQueriesManager.UpdateProtocolQueryEntryStruct) => {
      return el.queryName === ORGANIZATION_ADMIN_KEY;
    })
  ) {
    throw new Error(`Invalid initDefaultQueries arr. Missing ${ORGANIZATION_ADMIN_KEY} query`);
  }

  initDefaultQueries.forEach((el: IProtocolQueriesManager.UpdateProtocolQueryEntryStruct) => {
    if (!ethers.isAddress(el.query.validatorAddr)) {
      throw new Error(
        `Invalid query validator address. Query - ${el.queryName}, validator address - ${el.query.validatorAddr}`,
      );
    }
  });
}
