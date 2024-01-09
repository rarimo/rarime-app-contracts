// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {QueriesStorage} from "../libs/QueriesStorage.sol";

interface IProtocolQueriesManager {
    struct UpdateProtocolQueryEntry {
        string queryName;
        QueriesStorage.ProtocolQuery query;
        bool isAdding;
    }

    struct ZKProofData {
        uint256[2] a;
        uint256[2][2] b;
        uint256[2] c;
        uint256[] inputs;
    }

    error ProtocolQueriesManagerQueryDoesNotExist();

    function updateDefaultQueries(UpdateProtocolQueryEntry[] calldata queriesToUpdate_) external;

    function updateOrganizationQueries(
        ZKProofData calldata orgAdminProofData_,
        UpdateProtocolQueryEntry[] calldata queriesToUpdate_
    ) external;

    function getProtocolQuery(
        uint256 organizationId_,
        string memory queryName_
    ) external view returns (QueriesStorage.ProtocolQuery memory resultQuery_);

    function getDefaultProtocolQuery(
        string memory queryName_
    ) external view returns (QueriesStorage.ProtocolQuery memory);

    function getOrganizationId(uint256[] memory inputs_) external view returns (uint256);

    function isProtocolQueryExist(
        uint256 organizationId_,
        string memory queryName_
    ) external view returns (bool);

    function isDefaultQueryExist(string memory queryName_) external view returns (bool);

    function onlyOrganizationAdmin(ZKProofData calldata proofData_) external view;
}
