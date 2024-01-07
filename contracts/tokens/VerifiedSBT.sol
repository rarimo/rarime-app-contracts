// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {ISBT} from "@solarity/solidity-lib/interfaces/tokens/ISBT.sol";
import {SBT} from "@solarity/solidity-lib/tokens/SBT.sol";

import {IVerifiedSBT} from "../interfaces/tokens/IVerifiedSBT.sol";

contract VerifiedSBT is IVerifiedSBT, SBT {
    uint256 public override nextTokenId;

    address public protocolManagerAddr;

    modifier onlyProtocolManager() {
        _onlyProtocolManager();
        _;
    }

    function init(
        string calldata name_,
        string calldata symbol_,
        string calldata baseURI_,
        address protocolManagerAddr_
    ) external override initializer {
        __SBT_init(name_, symbol_);

        protocolManagerAddr = protocolManagerAddr_;

        _setBaseURI(baseURI_);
    }

    function setBaseURI(string calldata newBaseURI_) external override onlyProtocolManager {
        _setBaseURI(newBaseURI_);
    }

    function batchMint(address[] calldata userAddresses_) external override onlyProtocolManager {
        for (uint256 i = 0; i < userAddresses_.length; i++) {
            _mint(userAddresses_[i], nextTokenId++);
        }
    }

    function mint(address userAddr_) external override onlyProtocolManager {
        _mint(userAddr_, nextTokenId++);
    }

    function tokenURI(uint256) public view override(ISBT, SBT) returns (string memory) {
        return baseURI();
    }

    function _onlyProtocolManager() internal view {
        if (msg.sender != protocolManagerAddr) {
            revert VerifiedSBTUnauthorized(msg.sender);
        }
    }
}
