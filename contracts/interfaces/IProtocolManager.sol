// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {ZKProofsHelper} from "../libs/ZKProofsHelper.sol";

interface IProtocolManager {
    struct BaseProofData {
        uint256 organizationId;
        string queryName;
        ZKProofsHelper.ZKProofData proofData;
        uint256 groupId;
    }

    struct MintTokensData {
        BaseProofData baseProofData;
        uint256 claimFieldValue;
    }

    event ProtocolIssuersUpdated(uint256[] issuersIds, bool isAdding);
    event VerifiedSBTDeployed(
        uint256 indexed organizationId,
        uint256 groupId,
        string queryName,
        address newTokenAddr
    );
    event BaseTokenURIChanged(
        uint256 indexed organizationId,
        uint256 groupId,
        string queryName,
        string newBaseTokenURI
    );

    error ProtocolManagerIsNotTheProtocolIssuer(uint256 issuerId);
    error ProtocolManagerQueryDoesNotExist(uint256 organizationId, string queryName);
    error ProtocolManagerTokenIsAlreadyDeployed(uint256 organizationId, bytes32 queryKey);
    error ProtocolManagerZeroTokenAddr(uint256 organizationId, uint256 groupId, string queryName);
    error ProtocolManagerZeroMintTokensDataArr();
    error ProtocolManagerUserAlreadyHasTheToken(address userAddr, address tokenAddr);
    error ProtocolManagerUnsupportedValidatorCircuitId(string validatorCircuitId);
    error ProtocolManagerInvalidaOrganizationId(
        uint256 organizationId,
        uint256 proofOrganizationId
    );

    function updateProtocolIssuers(uint256[] calldata issuersToUpdate_, bool isAdding_) external;

    function changeBaseTokenURI(
        BaseProofData calldata orgAdminProofData_,
        string calldata newBaseTokenURI_
    ) external;

    function deployVerifiedSBT(
        BaseProofData calldata orgAdminProofData_,
        string calldata tokenName_,
        string calldata tokenSymbol_,
        string calldata tokenBaseURI_
    ) external;

    function mintVerifiedSBT(MintTokensData[] calldata mintTokensData_) external;

    function getProtocolIssuers() external view returns (uint256[] memory);

    function getOrganizationToken(
        uint256 organizationId_,
        uint256 groupId_,
        string memory queryName_
    ) external view returns (address);

    function getTokenQueryKey(
        uint256 organizationId_,
        uint256 groupId_,
        string memory queryName_
    ) external view returns (bytes32);

    function isProtocolIssuer(uint256 issuerId_) external view returns (bool);
}
