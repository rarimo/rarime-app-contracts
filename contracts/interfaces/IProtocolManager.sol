// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {IProtocolQueriesManager} from "./IProtocolQueriesManager.sol";

interface IProtocolManager {
    struct MintTokensData {
        string queryName;
        IProtocolQueriesManager.ZKProofData proofData;
    }

    event ProtocolIssuersUpdated(uint256[] issuersIds, bool isAdding);
    event VerifiedSBTDeployed(
        uint256 indexed organizationId,
        string queryName,
        address newTokenAddr
    );
    event BaseTokenURIChanged(
        uint256 indexed organizationId,
        string queryName,
        string newBaseTokenURI
    );

    error ProtocolManagerIsNotTheProtocolIssuer(uint256 issuerId);
    error ProtocolManagerQueryDoesNotExist(uint256 organizationId, string queryName);
    error ProtocolManagerTokenIsAlreadyDeployed(uint256 organizationId, string queryName);
    error ProtocolManagerZeroTokenAddr(uint256 organizationId, string queryName);
    error ProtocolManagerInvalidProofChallenge();
    error ProtocolManagerZeroMintTokensDataArr();
    error ProtocolManagerInvalidOrganizationId();
    error ProtocolManagerUserAlreadyHasTheToken(address userAddr, address tokenAddr);
    error ProtocolManagerProofOfTheGroupNotVerified();

    function updateProtocolIssuers(uint256[] calldata issuersToUpdate_, bool isAdding_) external;

    function changeBaseTokenURI(
        IProtocolQueriesManager.ZKProofData calldata orgAdminProofData_,
        string calldata queryName_,
        string calldata newBaseTokenURI_
    ) external;

    function deployVerifiedSBT(
        IProtocolQueriesManager.ZKProofData calldata orgAdminProofData_,
        string calldata queryName_,
        string calldata tokenName_,
        string calldata tokenSymbol_,
        string calldata tokenBaseURI_
    ) external;

    function mintVerifiedSBT(MintTokensData[] calldata mintTokensData_) external;

    function getProtocolIssuers() external view returns (uint256[] memory);

    function getOrganizationToken(
        uint256 organizationId_,
        string memory queryName_
    ) external view returns (address);

    function isProtocolIssuer(uint256 issuerId_) external view returns (bool);
}
