// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {ISBT} from "@solarity/solidity-lib/interfaces/tokens/ISBT.sol";

interface IVerifiedSBT is ISBT {
    error VerifiedSBTUnauthorized(address caller);

    function init(
        string calldata name_,
        string calldata symbol_,
        string calldata baseURI_,
        address protocolManagerAddr_
    ) external;

    function setBaseURI(string calldata newBaseURI_) external;

    function batchMint(address[] calldata userAddresses_) external;

    function mint(address userAddr_) external;

    function nextTokenId() external view returns (uint256);
}
