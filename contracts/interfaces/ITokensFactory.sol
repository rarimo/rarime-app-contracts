// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {ProxyBeacon} from "@solarity/solidity-lib/proxy/beacon/ProxyBeacon.sol";

interface ITokensFactory {
    error TokensFactoryUnauthorized(address caller);

    function setNewImplementation(address newVerifiedSBTImpl_) external;

    function setProtocolManagerAddr(address newProtocolManager_) external;

    function deployVerifiedSBT(
        string calldata name_,
        string calldata symbol_,
        string calldata baseURI_
    ) external returns (address);

    function verifiedSBTBeacon() external view returns (ProxyBeacon);

    function protocolManagerAddr() external view returns (address);

    function getVerifiedSBTImpl() external view returns (address);
}
