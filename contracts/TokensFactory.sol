// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {SBT} from "@solarity/solidity-lib/tokens/SBT.sol";

import {ProxyBeacon} from "@solarity/solidity-lib/proxy/beacon/ProxyBeacon.sol";
import {PublicBeaconProxy} from "@solarity/solidity-lib/proxy/beacon/PublicBeaconProxy.sol";

import {ITokensFactory} from "./interfaces/ITokensFactory.sol";
import {IVerifiedSBT} from "./interfaces/tokens/IVerifiedSBT.sol";

contract TokensFactory is ITokensFactory, OwnableUpgradeable {
    ProxyBeacon public override verifiedSBTBeacon;

    address public override protocolManagerAddr;

    modifier onlyProtocolManager() {
        _onlyProtocolManager();
        _;
    }

    function __TokensFactory_init(
        address protocolManagerAddr_,
        address verifiedSBTImplAddr_
    ) external initializer {
        __Ownable_init();

        verifiedSBTBeacon = new ProxyBeacon();
        protocolManagerAddr = protocolManagerAddr_;

        _setNewImplementation(verifiedSBTImplAddr_);
    }

    function setNewImplementation(address newVerifiedSBTImpl_) external onlyOwner {
        _setNewImplementation(newVerifiedSBTImpl_);
    }

    function setProtocolManagerAddr(address newProtocolManager_) external onlyOwner {
        protocolManagerAddr = newProtocolManager_;
    }

    function deployVerifiedSBT(
        string calldata name_,
        string calldata symbol_,
        string calldata baseURI_
    ) external onlyProtocolManager returns (address) {
        address newVerifiedSBTProxy_ = address(
            new PublicBeaconProxy(address(verifiedSBTBeacon), "")
        );

        IVerifiedSBT(newVerifiedSBTProxy_).init(name_, symbol_, baseURI_, protocolManagerAddr);

        return newVerifiedSBTProxy_;
    }

    function _setNewImplementation(address newImplementation_) internal {
        if (verifiedSBTBeacon.implementation() != newImplementation_) {
            verifiedSBTBeacon.upgradeTo(newImplementation_);
        }
    }

    function _onlyProtocolManager() internal view {
        if (msg.sender != protocolManagerAddr) {
            revert TokensFactoryUnauthorized(msg.sender);
        }
    }
}
