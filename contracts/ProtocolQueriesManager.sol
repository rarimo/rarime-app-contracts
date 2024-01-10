// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import {ICircuitValidator} from "@iden3/contracts/interfaces/ICircuitValidator.sol";
import {IZKPVerifier} from "@iden3/contracts/interfaces/IZKPVerifier.sol";

import {CredentialAtomicQueryValidator} from "@iden3/contracts/validators/CredentialAtomicQueryValidator.sol";

import {QueriesStorage, ORGANIZATION_ADMIN_KEY} from "./libs/QueriesStorage.sol";

import {IProtocolQueriesManager} from "./interfaces/IProtocolQueriesManager.sol";
import {IQueryBuilder} from "./interfaces/IQueryBuilder.sol";

contract ProtocolQueriesManager is IProtocolQueriesManager, OwnableUpgradeable {
    using QueriesStorage for QueriesStorage.ProtocolQueriesData;

    QueriesStorage.ProtocolQueriesData internal _defaultProtocolQueries;

    // Organization id (issuer id) => Protocol Queries data
    mapping(uint256 => QueriesStorage.ProtocolQueriesData) internal _organizationQueries;

    mapping(string => address) internal _queryBuilders;

    modifier onlyOrganizationAdminCheck(ZKProofData calldata proofData_) {
        onlyOrganizationAdmin(proofData_);
        _;
    }

    function __ProtocolQueriesManager_init(
        UpdateQueryBuilderEntry[] calldata queryBuildersToUpdate_,
        UpdateProtocolQueryEntry[] calldata queriesToUpdate_
    ) external initializer {
        __Ownable_init();

        _updateQueryBuilders(queryBuildersToUpdate_);
        _updateQueries(_defaultProtocolQueries, queriesToUpdate_);
    }

    function updateQueryBuilders(
        UpdateQueryBuilderEntry[] calldata queryBuildersToUpdate_
    ) external onlyOwner {
        _updateQueryBuilders(queryBuildersToUpdate_);
    }

    function updateDefaultQueries(
        UpdateProtocolQueryEntry[] calldata queriesToUpdate_
    ) external onlyOwner {
        _updateQueries(_defaultProtocolQueries, queriesToUpdate_);
    }

    function updateOrganizationQueries(
        ZKProofData calldata orgAdminProofData_,
        UpdateProtocolQueryEntry[] calldata queriesToUpdate_
    ) external onlyOrganizationAdminCheck(orgAdminProofData_) {
        _updateQueries(
            _organizationQueries[getOrganizationId(orgAdminProofData_.inputs)],
            queriesToUpdate_
        );
    }

    function getQueryBuilder(string memory validatorCircuitId_) external view returns (address) {
        return _queryBuilders[validatorCircuitId_];
    }

    function getDynamicQueryData(
        address validatorAddr_,
        uint256[] memory newValues_,
        bytes memory currentQueryData_
    ) external view returns (bytes memory) {
        return IQueryBuilder(validatorAddr_).buildQuery(currentQueryData_, newValues_);
    }

    function getProtocolQuery(
        uint256 organizationId_,
        string memory queryName_
    ) external view returns (QueriesStorage.ProtocolQuery memory resultQuery_) {
        return _getProtocolQueriesData(organizationId_, queryName_).getProtocolQuery(queryName_);
    }

    function getProtocolQueryValidator(
        uint256 organizationId_,
        string memory queryName_
    ) external view returns (address) {
        return
            _getProtocolQueriesData(organizationId_, queryName_).getProtocolQueryValidator(
                queryName_
            );
    }

    function isGroupLevelQuery(
        uint256 organizationId_,
        string memory queryName_
    ) external view returns (bool) {
        return _getProtocolQueriesData(organizationId_, queryName_).isGroupLevelQuery(queryName_);
    }

    function isStaticQuery(
        uint256 organizationId_,
        string memory queryName_
    ) external view returns (bool) {
        return _getProtocolQueriesData(organizationId_, queryName_).isStaticQuery(queryName_);
    }

    function getDefaultProtocolQuery(
        string memory queryName_
    ) public view returns (QueriesStorage.ProtocolQuery memory) {
        return _defaultProtocolQueries.getProtocolQuery(queryName_);
    }

    function getOrganizationId(uint256[] memory inputs_) public view returns (uint256) {
        address validatorAddr_ = _defaultProtocolQueries.getProtocolQueryValidator(
            ORGANIZATION_ADMIN_KEY
        );

        return inputs_[CredentialAtomicQueryValidator(validatorAddr_).inputIndexOf("issuerId")];
    }

    function isProtocolQueryExist(
        uint256 organizationId_,
        string memory queryName_
    ) public view returns (bool) {
        bool result_ = isDefaultQueryExist(queryName_);

        return result_ ? result_ : _organizationQueries[organizationId_].contains(queryName_);
    }

    function isDefaultQueryExist(string memory queryName_) public view returns (bool) {
        return _defaultProtocolQueries.contains(queryName_);
    }

    function isValidatorCircuitIdSupported(
        string memory validatorCircuitId_
    ) public view returns (bool) {
        return _queryBuilders[validatorCircuitId_] != address(0);
    }

    function onlyOrganizationAdmin(ZKProofData calldata proofData_) public view {
        _verifyProof(proofData_, _defaultProtocolQueries.getOrganizationAdminQuery());
    }

    function _updateQueryBuilders(
        UpdateQueryBuilderEntry[] calldata queryBuildersToUpdate_
    ) internal {
        for (uint256 i = 0; i < queryBuildersToUpdate_.length; i++) {
            UpdateQueryBuilderEntry calldata currentQueryBuilderEntry_ = queryBuildersToUpdate_[i];

            if (currentQueryBuilderEntry_.isAdding) {
                if (currentQueryBuilderEntry_.queryBuilderAddr == address(0)) {
                    revert ProtocolQueriesManagerZeroAddress("QueryBuilder");
                }

                _queryBuilders[
                    currentQueryBuilderEntry_.validatorCircuitId
                ] = currentQueryBuilderEntry_.queryBuilderAddr;
            } else {
                delete _queryBuilders[currentQueryBuilderEntry_.validatorCircuitId];
            }
        }
    }

    function _updateQueries(
        QueriesStorage.ProtocolQueriesData storage _queriesData,
        UpdateProtocolQueryEntry[] calldata queriesToUpdate_
    ) internal {
        for (uint256 i = 0; i < queriesToUpdate_.length; i++) {
            UpdateProtocolQueryEntry calldata currentQueryEntry_ = queriesToUpdate_[i];

            if (currentQueryEntry_.isAdding) {
                if (currentQueryEntry_.query.validatorAddr == address(0)) {
                    revert ProtocolQueriesManagerZeroAddress("QueryValidator");
                }

                _queriesData.updateQuery(currentQueryEntry_.queryName, currentQueryEntry_.query);
            } else {
                _queriesData.removeQuery(currentQueryEntry_.queryName);
            }
        }
    }

    function _getProtocolQueriesData(
        uint256 organizationId_,
        string memory queryName_
    ) internal view returns (QueriesStorage.ProtocolQueriesData storage) {
        return
            isDefaultQueryExist(queryName_)
                ? _defaultProtocolQueries
                : _organizationQueries[organizationId_];
    }

    function _verifyProof(
        ZKProofData calldata proofData_,
        QueriesStorage.ProtocolQuery memory query_
    ) internal view {
        ICircuitValidator(query_.validatorAddr).verify(
            proofData_.inputs,
            proofData_.a,
            proofData_.b,
            proofData_.c,
            query_.queryData
        );
    }
}
