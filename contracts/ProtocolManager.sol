// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import {SetHelper} from "@solarity/solidity-lib/libs/arrays/SetHelper.sol";
import {TypeCaster} from "@solarity/solidity-lib/libs/utils/TypeCaster.sol";

import {ICircuitValidator} from "@iden3/contracts/interfaces/ICircuitValidator.sol";

import {PoseidonFacade} from "@iden3/contracts/lib/Poseidon.sol";
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
    using TypeCaster for *;

    ITokensFactory public tokensFactory;
    IProtocolQueriesManager public queriesManager;

    EnumerableSet.UintSet internal _protocolIssuers;

    // Organization id (issuer id) => Query key => VerifiedSBT address
    mapping(uint256 => mapping(bytes32 => address)) internal _organizationTokens;

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
        BaseProofData calldata orgAdminProofData_,
        string calldata newBaseTokenURI_
    ) external override {
        queriesManager.onlyOrganizationAdmin(orgAdminProofData_.proofData);

        uint256 issuerId_ = queriesManager.getOrganizationId(orgAdminProofData_.proofData.inputs);

        _onlyProtocolIssuer(issuerId_);
        _onlyExistingToken(issuerId_, orgAdminProofData_.groupId, orgAdminProofData_.queryName);

        IVerifiedSBT(
            getOrganizationToken(
                issuerId_,
                orgAdminProofData_.groupId,
                orgAdminProofData_.queryName
            )
        ).setBaseURI(newBaseTokenURI_);

        emit BaseTokenURIChanged(
            issuerId_,
            orgAdminProofData_.groupId,
            orgAdminProofData_.queryName,
            newBaseTokenURI_
        );
    }

    function deployVerifiedSBT(
        BaseProofData calldata orgAdminProofData_,
        string calldata tokenName_,
        string calldata tokenSymbol_,
        string calldata tokenBaseURI_
    ) external override {
        queriesManager.onlyOrganizationAdmin(orgAdminProofData_.proofData);

        uint256 issuerId_ = queriesManager.getOrganizationId(orgAdminProofData_.proofData.inputs);

        _onlyProtocolIssuer(issuerId_);

        if (!queriesManager.isProtocolQueryExist(issuerId_, orgAdminProofData_.queryName)) {
            revert ProtocolManagerQueryDoesNotExist(issuerId_, orgAdminProofData_.queryName);
        }

        bytes32 queryKey_;

        if (queriesManager.isGroupLevelQuery(issuerId_, orgAdminProofData_.queryName)) {
            queryKey_ = keccak256(
                abi.encodePacked(orgAdminProofData_.groupId, orgAdminProofData_.queryName)
            );
        } else {
            queryKey_ = keccak256(abi.encodePacked(orgAdminProofData_.queryName));
        }

        if (_organizationTokens[issuerId_][queryKey_] != address(0)) {
            revert ProtocolManagerTokenIsAlreadyDeployed(issuerId_, queryKey_);
        }

        address newTokenAddr_ = tokensFactory.deployVerifiedSBT(
            tokenName_,
            tokenSymbol_,
            tokenBaseURI_
        );

        _organizationTokens[issuerId_][queryKey_] = newTokenAddr_;

        emit VerifiedSBTDeployed(
            issuerId_,
            orgAdminProofData_.groupId,
            orgAdminProofData_.queryName,
            newTokenAddr_
        );
    }

    function mintVerifiedSBT(MintTokensData[] calldata mintTokensData_) external override {
        if (mintTokensData_.length == 0) {
            revert ProtocolManagerZeroMintTokensDataArr();
        }

        for (uint256 i = 0; i < mintTokensData_.length; i++) {
            MintTokensData calldata currentMintData_ = mintTokensData_[i];

            uint256 issuerId_ = queriesManager.getOrganizationId(
                currentMintData_.baseProofData.proofData.inputs
            );

            _onlyProtocolIssuer(issuerId_);

            if (issuerId_ == 0) {
                revert ProtocolManagerInvalidOrganizationId();
            }

            _onlyExistingQuery(issuerId_, currentMintData_.baseProofData.queryName);
            _onlyExistingToken(
                issuerId_,
                currentMintData_.baseProofData.groupId,
                currentMintData_.baseProofData.queryName
            );

            QueriesStorage.ProtocolQuery memory currentQuery_ = queriesManager.getProtocolQuery(
                issuerId_,
                currentMintData_.baseProofData.queryName
            );

            if (!currentQuery_.isStaticQuery) {
                uint256 fieldValue_ = currentQuery_.isGroupLevel
                    ? PoseidonFacade.poseidon2(
                        [currentMintData_.baseProofData.groupId, currentMintData_.claimFieldValue]
                    )
                    : currentMintData_.claimFieldValue;

                string memory validatorCircuitId_ = ICircuitValidator(currentQuery_.validatorAddr)
                    .getSupportedCircuitIds()[0];

                if (!queriesManager.isValidatorCircuitIdSupported(validatorCircuitId_)) {
                    revert ProtocolManagerUnsupportedValidatorCircuitId(validatorCircuitId_);
                }

                currentQuery_.queryData = queriesManager.getDynamicQueryData(
                    currentQuery_.validatorAddr,
                    fieldValue_.asSingletonArray(),
                    currentQuery_.queryData
                );
            }

            ICircuitValidator(currentQuery_.validatorAddr).verify(
                currentMintData_.baseProofData.proofData.inputs,
                currentMintData_.baseProofData.proofData.a,
                currentMintData_.baseProofData.proofData.b,
                currentMintData_.baseProofData.proofData.c,
                currentQuery_.queryData
            );

            _checkChallenge(
                msg.sender,
                currentQuery_.validatorAddr,
                currentMintData_.baseProofData.proofData.inputs
            );

            IVerifiedSBT currentToken_ = IVerifiedSBT(
                getOrganizationToken(
                    issuerId_,
                    currentMintData_.baseProofData.groupId,
                    currentMintData_.baseProofData.queryName
                )
            );

            if (currentToken_.balanceOf(msg.sender) > 0) {
                revert ProtocolManagerUserAlreadyHasTheToken(msg.sender, address(currentToken_));
            }

            currentToken_.mint(msg.sender);
        }
    }

    function getProtocolIssuers() external view override returns (uint256[] memory) {
        return _protocolIssuers.values();
    }

    function getOrganizationToken(
        uint256 organizationId_,
        uint256 groupId_,
        string memory queryName_
    ) public view override returns (address) {
        return
            _organizationTokens[organizationId_][
                getTokenQueryKey(organizationId_, groupId_, queryName_)
            ];
    }

    function getTokenQueryKey(
        uint256 organizationId_,
        uint256 groupId_,
        string memory queryName_
    ) public view returns (bytes32 queryKey_) {
        if (queriesManager.isGroupLevelQuery(organizationId_, queryName_)) {
            queryKey_ = keccak256(abi.encodePacked(groupId_, queryName_));
        } else {
            queryKey_ = keccak256(abi.encodePacked(queryName_));
        }
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

    function _onlyExistingToken(
        uint256 organizationId_,
        uint256 groupId_,
        string memory queryName_
    ) internal view {
        if (getOrganizationToken(organizationId_, groupId_, queryName_) == address(0)) {
            revert ProtocolManagerZeroTokenAddr(organizationId_, groupId_, queryName_);
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
