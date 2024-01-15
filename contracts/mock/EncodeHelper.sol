// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {CredentialAtomicQueryValidator} from "@iden3/contracts/validators/CredentialAtomicQueryValidator.sol";
import {CredentialAtomicQueryV3Validator} from "@iden3/contracts/validators/CredentialAtomicQueryV3Validator.sol";

import {IQueryBuilder, MAX_VALUES_ARR_LENGTH} from "../interfaces/IQueryBuilder.sol";

contract EncodeHelper {
    function encodeQueryValidatorStruct(
        CredentialAtomicQueryValidator.CredentialAtomicQuery memory credAtomicQuery_
    ) external pure returns (bytes memory) {
        return abi.encode(credAtomicQuery_);
    }

    function encodeQueryValidatorV3Struct(
        CredentialAtomicQueryV3Validator.CredentialAtomicQueryV3 memory credAtomicQueryV3_
    ) external pure returns (bytes memory) {
        return abi.encode(credAtomicQueryV3_);
    }

    function decodeQueryValidatorStruct(
        bytes calldata queryData_
    ) external pure returns (CredentialAtomicQueryValidator.CredentialAtomicQuery memory) {
        return abi.decode(queryData_, (CredentialAtomicQueryValidator.CredentialAtomicQuery));
    }

    function decodeQueryValidatorV3Struct(
        bytes calldata queryData_
    ) external pure returns (CredentialAtomicQueryV3Validator.CredentialAtomicQueryV3 memory) {
        return abi.decode(queryData_, (CredentialAtomicQueryV3Validator.CredentialAtomicQueryV3));
    }

    function formatValues(
        uint256[] memory values_
    ) external pure returns (uint256[] memory formattedValuesArr_) {
        if (values_.length == MAX_VALUES_ARR_LENGTH) {
            return values_;
        }

        formattedValuesArr_ = new uint256[](MAX_VALUES_ARR_LENGTH);

        for (uint256 i = 0; i < values_.length; i++) {
            formattedValuesArr_[i] = values_[i];
        }
    }
}
