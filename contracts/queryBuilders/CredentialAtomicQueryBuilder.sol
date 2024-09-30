// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {CredentialAtomicQueryValidator} from "@iden3/contracts/validators/CredentialAtomicQueryValidator.sol";

import {AbstractQueryBuilder} from "./AbstractQueryBuilder.sol";

contract CredentialAtomicQueryBuilder is AbstractQueryBuilder {
    function getBuilderName() external pure override returns (string memory) {
        return "CredentialAtomicQueryBuilder";
    }

    function buildQuery(
        bytes memory queryData_,
        uint256[] memory newValues_
    ) external pure override returns (bytes memory) {
        CredentialAtomicQueryValidator.CredentialAtomicQuery memory credAtomicQuery_ = abi.decode(
            queryData_,
            (CredentialAtomicQueryValidator.CredentialAtomicQuery)
        );

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
