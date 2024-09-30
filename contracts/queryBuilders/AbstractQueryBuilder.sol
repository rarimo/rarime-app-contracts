// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {PoseidonFacade} from "@iden3/contracts/lib/Poseidon.sol";

import {IQueryBuilder, MAX_VALUES_ARR_LENGTH} from "../interfaces/IQueryBuilder.sol";

abstract contract AbstractQueryBuilder is IQueryBuilder {
    function _getQueryHash(
        uint256 schema_,
        uint256 claimPathKey_,
        uint256 operator_,
        uint256 slotIndex_,
        uint256[] memory values_,
        uint256 claimPathNotExists_
    ) internal pure returns (uint256) {
        uint256 valuesHash_ = PoseidonFacade.poseidonSponge(_formatValues(values_));

        return
            PoseidonFacade.poseidon6(
                [schema_, slotIndex_, operator_, claimPathKey_, claimPathNotExists_, valuesHash_]
            );
    }

    function _formatValues(
        uint256[] memory values_
    ) internal pure returns (uint256[] memory formattedValuesArr_) {
        if (values_.length == MAX_VALUES_ARR_LENGTH) {
            return values_;
        } else if (values_.length > MAX_VALUES_ARR_LENGTH) {
            revert QueryBuilderInvalidValuesArrLength(values_.length, MAX_VALUES_ARR_LENGTH);
        }

        formattedValuesArr_ = new uint256[](MAX_VALUES_ARR_LENGTH);

        for (uint256 i = 0; i < values_.length; i++) {
            formattedValuesArr_[i] = values_[i];
        }
    }
}
