// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {VerifiedSBT} from "../../tokens/VerifiedSBT.sol";

contract VerifiedSBTMock is VerifiedSBT {
    function version() external pure returns (string memory) {
        return "v2.0.0";
    }
}
