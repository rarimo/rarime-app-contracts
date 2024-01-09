// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {QueriesStorage} from "../libs/QueriesStorage.sol";

uint256 constant MAX_VALUES_ARR_LENGTH = 64;

interface IQueryBuilder {
    error QueryBuilderInvalidValuesArrLength(uint256 currentLength, uint256 maxLength);

    function getBuilderName() external view returns (string memory);

    function buildQuery(
        bytes memory queryData_,
        uint256[] memory newValues_
    ) external view returns (bytes memory);
}
