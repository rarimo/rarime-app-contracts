// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {ICircuitValidator} from "@iden3/contracts/interfaces/ICircuitValidator.sol";
import {PrimitiveTypeUtils} from "@iden3/contracts/lib/PrimitiveTypeUtils.sol";

import {QueriesStorage} from "./QueriesStorage.sol";

library ZKProofsHelper {
    struct ZKProofData {
        uint256[2] a;
        uint256[2][2] b;
        uint256[2] c;
        uint256[] inputs;
    }

    error ProtocolManagerInvalidProofChallenge();

    function verifyProof(
        ZKProofData memory proofData_,
        address senderAddr_,
        address validatorAddr_,
        bytes memory queryData_
    ) internal view {
        ICircuitValidator(validatorAddr_).verify(
            proofData_.inputs,
            proofData_.a,
            proofData_.b,
            proofData_.c,
            queryData_
        );

        _checkChallenge(senderAddr_, getProofChallenge(proofData_, validatorAddr_));
    }

    function getOrganizationId(
        ZKProofData memory proofData_,
        address validatorAddr_
    ) internal view returns (uint256) {
        return proofData_.inputs[ICircuitValidator(validatorAddr_).inputIndexOf("issuerID")];
    }

    function getProofChallenge(
        ZKProofData memory proofData_,
        address validatorAddr_
    ) internal view returns (uint256) {
        return proofData_.inputs[ICircuitValidator(validatorAddr_).inputIndexOf("challenge")];
    }

    function _checkChallenge(address sender_, uint256 challenge_) private pure {
        if (sender_ != PrimitiveTypeUtils.int256ToAddress(challenge_)) {
            revert ProtocolManagerInvalidProofChallenge();
        }
    }
}
