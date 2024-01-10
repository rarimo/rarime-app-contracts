// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {IProtocolQueriesManager} from "./IProtocolQueriesManager.sol";

interface IProtocolManager {
    struct BaseProofData {
        string queryName;
        IProtocolQueriesManager.ZKProofData proofData;
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
    error ProtocolManagerInvalidProofChallenge();
    error ProtocolManagerZeroMintTokensDataArr();
    error ProtocolManagerInvalidOrganizationId();
    error ProtocolManagerUserAlreadyHasTheToken(address userAddr, address tokenAddr);
    error ProtocolManagerProofOfTheGroupNotVerified();
    error ProtocolManagerUnsupportedValidatorCircuitId(string validatorCircuitId);

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
