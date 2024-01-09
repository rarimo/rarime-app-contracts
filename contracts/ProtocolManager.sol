// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import {SetHelper} from "@solarity/solidity-lib/libs/arrays/SetHelper.sol";

import {ICircuitValidator} from "@iden3/contracts/interfaces/ICircuitValidator.sol";

import {PrimitiveTypeUtils} from "@iden3/contracts/lib/PrimitiveTypeUtils.sol";
import {CredentialAtomicQueryValidator} from "@iden3/contracts/validators/CredentialAtomicQueryValidator.sol";

import {QueriesStorage, GROUP_MEMBER_KEY} from "./libs/QueriesStorage.sol";

import {IProtocolManager} from "./interfaces/IProtocolManager.sol";
import {IProtocolQueriesManager} from "./interfaces/IProtocolQueriesManager.sol";
import {ITokensFactory} from "./interfaces/ITokensFactory.sol";
import {IVerifiedSBT} from "./interfaces/tokens/IVerifiedSBT.sol";

contract ProtocolManager is IProtocolManager, OwnableUpgradeable {
    using EnumerableSet for EnumerableSet.UintSet;
    using SetHelper for EnumerableSet.UintSet;

    ITokensFactory public tokensFactory;
    IProtocolQueriesManager public queriesManager;

    EnumerableSet.UintSet internal _protocolIssuers;

    // Organization id (issuer id) => Query key => VerifiedSBT address
    mapping(uint256 => mapping(string => address)) internal _organizationTokens;

    function __ProtocolManager_init(
        address tokensFactoryAddr_,
        address queriesManagerAddr_
    ) external initializer {
        __Ownable_init();

        tokensFactory = ITokensFactory(tokensFactoryAddr_);
        queriesManager = IProtocolQueriesManager(queriesManagerAddr_);
    }

    function updateProtocolIssuers(
        uint256[] calldata issuersToUpdate_,
        bool isAdding_
    ) external override onlyOwner {
        if (isAdding_) {
            _protocolIssuers.add(issuersToUpdate_);
        } else {
            _protocolIssuers.remove(issuersToUpdate_);
        }

        emit ProtocolIssuersUpdated(issuersToUpdate_, isAdding_);
    }

    function changeBaseTokenURI(
        IProtocolQueriesManager.ZKProofData calldata orgAdminProofData_,
        string calldata queryName_,
        string calldata newBaseTokenURI_
    ) external override {
        queriesManager.onlyOrganizationAdmin(orgAdminProofData_);

        uint256 issuerId_ = queriesManager.getOrganizationId(orgAdminProofData_.inputs);

        _onlyProtocolIssuer(issuerId_);
        _onlyExistingToken(issuerId_, queryName_);

        IVerifiedSBT(getOrganizationToken(issuerId_, queryName_)).setBaseURI(newBaseTokenURI_);

        emit BaseTokenURIChanged(issuerId_, queryName_, newBaseTokenURI_);
    }

    function deployVerifiedSBT(
        IProtocolQueriesManager.ZKProofData calldata orgAdminProofData_,
        string calldata queryName_,
        string calldata tokenName_,
        string calldata tokenSymbol_,
        string calldata tokenBaseURI_
    ) external override {
        queriesManager.onlyOrganizationAdmin(orgAdminProofData_);

        uint256 issuerId_ = queriesManager.getOrganizationId(orgAdminProofData_.inputs);

        _onlyProtocolIssuer(issuerId_);

        if (!queriesManager.isProtocolQueryExist(issuerId_, queryName_)) {
            revert ProtocolManagerQueryDoesNotExist(issuerId_, queryName_);
        }

        if (_organizationTokens[issuerId_][queryName_] != address(0)) {
            revert ProtocolManagerTokenIsAlreadyDeployed(issuerId_, queryName_);
        }

        address newTokenAddr_ = tokensFactory.deployVerifiedSBT(
            tokenName_,
            tokenSymbol_,
            tokenBaseURI_
        );

        emit VerifiedSBTDeployed(issuerId_, queryName_, newTokenAddr_);
    }

    function mintVerifiedSBT(MintTokensData[] calldata mintTokensData_) external override {
        if (mintTokensData_.length == 0) {
            revert ProtocolManagerZeroMintTokensDataArr();
        }

        uint256 issuerId_ = queriesManager.getOrganizationId(mintTokensData_[0].proofData.inputs);

        _onlyProtocolIssuer(issuerId_);

        bytes32 groupMemberKeyHash_ = keccak256(abi.encodePacked(GROUP_MEMBER_KEY));

        bool isGroupMemberChecked_;
        bool isGroupLevelNeeded_;

        for (uint256 i = 0; i < mintTokensData_.length; i++) {
            MintTokensData calldata currentMintData_ = mintTokensData_[i];

            if (
                i > 0 &&
                queriesManager.getOrganizationId(currentMintData_.proofData.inputs) != issuerId_
            ) {
                revert ProtocolManagerInvalidOrganizationId();
            }

            _onlyExistingQuery(issuerId_, currentMintData_.queryName);

            QueriesStorage.ProtocolQuery memory currentQuery_ = queriesManager.getProtocolQuery(
                issuerId_,
                currentMintData_.queryName
            );

            if (currentQuery_.isGroupLevel && !isGroupLevelNeeded_) {
                isGroupLevelNeeded_ = true;
            }

            ICircuitValidator(currentQuery_.validatorAddr).verify(
                currentMintData_.proofData.inputs,
                currentMintData_.proofData.a,
                currentMintData_.proofData.b,
                currentMintData_.proofData.c,
                currentQuery_.queryData
            );

            _checkChallenge(
                msg.sender,
                currentQuery_.validatorAddr,
                currentMintData_.proofData.inputs
            );

            if (keccak256(abi.encodePacked(currentMintData_.queryName)) == groupMemberKeyHash_) {
                isGroupMemberChecked_ = true;
            } else {
                _onlyExistingToken(issuerId_, currentMintData_.queryName);

                IVerifiedSBT currentToken_ = IVerifiedSBT(
                    getOrganizationToken(issuerId_, currentMintData_.queryName)
                );

                if (currentToken_.balanceOf(msg.sender) > 0) {
                    revert ProtocolManagerUserAlreadyHasTheToken(
                        msg.sender,
                        address(currentToken_)
                    );
                }

                currentToken_.mint(msg.sender);
            }
        }

        if (isGroupLevelNeeded_ && !isGroupMemberChecked_) {
            revert ProtocolManagerProofOfTheGroupNotVerified();
        }
    }

    function getProtocolIssuers() external view override returns (uint256[] memory) {
        return _protocolIssuers.values();
    }

    function getOrganizationToken(
        uint256 organizationId_,
        string memory queryName_
    ) public view override returns (address) {
        return _organizationTokens[organizationId_][queryName_];
    }

    function isProtocolIssuer(uint256 issuerId_) public view override returns (bool) {
        return _protocolIssuers.contains(issuerId_);
    }

    function _onlyProtocolIssuer(uint256 issuerId_) internal view {
        if (!isProtocolIssuer(issuerId_)) {
            revert ProtocolManagerIsNotTheProtocolIssuer(issuerId_);
        }
    }

    function _onlyExistingQuery(uint256 organizationId_, string memory queryName_) internal view {
        if (!queriesManager.isProtocolQueryExist(organizationId_, queryName_)) {
            revert ProtocolManagerQueryDoesNotExist(organizationId_, queryName_);
        }
    }

    function _onlyExistingToken(uint256 organizationId_, string memory queryName_) internal view {
        if (_organizationTokens[organizationId_][queryName_] == address(0)) {
            revert ProtocolManagerZeroTokenAddr(organizationId_, queryName_);
        }
    }

    function _checkChallenge(
        address sender_,
        address validatorAddr_,
        uint256[] calldata inputs_
    ) internal view {
        uint256 challenge_ = inputs_[
            CredentialAtomicQueryValidator(validatorAddr_).inputIndexOf("challenge")
        ];

        if (sender_ != PrimitiveTypeUtils.int256ToAddress(challenge_)) {
            revert ProtocolManagerInvalidProofChallenge();
        }
    }
}
