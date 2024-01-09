// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {CredentialAtomicQueryV3Validator} from "@iden3/contracts/validators/CredentialAtomicQueryV3Validator.sol";

import {AbstractQueryBuilder} from "./AbstractQueryBuilder.sol";

contract CredentialAtomicQueryBuilderV3 is AbstractQueryBuilder {
    function getBuilderName() external pure override returns (string memory) {
        return "CredentialAtomicQueryBuilderV3";
    }

    function buildQuery(
        bytes memory queryData_,
        uint256[] memory newValues_
    ) external pure override returns (bytes memory) {
        CredentialAtomicQueryV3Validator.CredentialAtomicQueryV3 memory credAtomicQuery_ = abi
            .decode(queryData_, (CredentialAtomicQueryV3Validator.CredentialAtomicQueryV3));

        credAtomicQuery_.value = newValues_;
        credAtomicQuery_.queryHash = _getQueryHash(
            credAtomicQuery_.schema,
            credAtomicQuery_.claimPathKey,
            credAtomicQuery_.operator,
            credAtomicQuery_.slotIndex,
            newValues_,
            credAtomicQuery_.claimPathNotExists
        );

        return abi.encode(credAtomicQuery_);
    }
}
