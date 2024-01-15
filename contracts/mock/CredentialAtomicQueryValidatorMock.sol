// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {CredentialAtomicQueryValidator} from "@iden3/contracts/validators/CredentialAtomicQueryValidator.sol";
import {CredentialAtomicQueryV3Validator} from "@iden3/contracts/validators/CredentialAtomicQueryV3Validator.sol";

import {TypeCaster} from "@solarity/solidity-lib/libs/utils/TypeCaster.sol";

import {ICircuitValidator} from "@iden3/contracts/interfaces/ICircuitValidator.sol";

contract CredentialAtomicQueryValidatorMock is ICircuitValidator {
    using TypeCaster for *;

    string public circuitId;

    bool public verificationResult;

    mapping(string => uint256) public override inputIndexOf;

    error VerificationFailed();

    constructor(
        string memory circuitId_,
        bool verificationResult_,
        string[] memory keys_,
        uint256[] memory values_
    ) {
        circuitId = circuitId_;
        verificationResult = verificationResult_;

        setInputIndexOfValue(keys_, values_);
    }

    function setCircuitId(string memory newCircuitId_) external {
        circuitId = newCircuitId_;
    }

    function setVerificationResult(bool newVerificationResult_) external {
        verificationResult = newVerificationResult_;
    }

    function setInputIndexOfValue(string[] memory keys_, uint256[] memory values_) public {
        for (uint256 i = 0; i < keys_.length; i++) {
            inputIndexOf[keys_[i]] = values_[i];
        }
    }

    function verify(
        uint256[] memory,
        uint256[2] memory,
        uint256[2][2] memory,
        uint256[2] memory,
        bytes calldata
    ) external view {
        if (!verificationResult) {
            revert VerificationFailed();
        }
    }

    function getSupportedCircuitIds() external view returns (string[] memory ids) {
        return circuitId.asSingletonArray();
    }
}
