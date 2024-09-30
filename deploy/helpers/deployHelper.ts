import { ethers } from "hardhat";
import { Deployer } from "@solarity/hardhat-migrate";

const { poseidonContract } = require("circomlibjs");

export const ORGANIZATION_ADMIN_KEY: string = "ORGANIZATION_ADMIN";

export async function getPoseidonContractFactory(parametersCount: number) {
  const abi = poseidonContract.generateABI(parametersCount);
  const code = poseidonContract.createCode(parametersCount);

  return new ethers.ContractFactory(abi, code);
}

export async function deployPoseidons(deployer: Deployer, poseidonSizeParams: number[]) {
  poseidonSizeParams.forEach((size) => {
    if (![1, 2, 3, 4, 5, 6].includes(size)) {
      throw new Error(`Poseidon should be integer in a range 1..6. Poseidon size provided: ${size}`);
    }
  });

  const deployPoseidon = async (params: number) => {
    const newPoseidonContract = await deployer.deploy(await getPoseidonContractFactory(params), {
      name: `@iden3/contracts/lib/Poseidon.sol:PoseidonUnit${params}L`,
    });

    return newPoseidonContract;
  };

  const result = [];

  for (const size of poseidonSizeParams) {
    result.push(await deployPoseidon(size));
  }

  return result;
}
