// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import {ICircuitValidator} from "@iden3/contracts/interfaces/ICircuitValidator.sol";
import {IZKPVerifier} from "@iden3/contracts/interfaces/IZKPVerifier.sol";

import {CredentialAtomicQueryValidator} from "@iden3/contracts/validators/CredentialAtomicQueryValidator.sol";

import {QueriesStorage, ORGANIZATION_ADMIN_KEY} from "./libs/QueriesStorage.sol";

import {IProtocolQueriesManager} from "./interfaces/IProtocolQueriesManager.sol";

contract ProtocolQueriesManager is IProtocolQueriesManager, OwnableUpgradeable {
    using QueriesStorage for QueriesStorage.ProtocolQueriesData;

    QueriesStorage.ProtocolQueriesData internal _defaultProtocolQueries;

    // Organization id (issuer id) => Protocol Queries data
    mapping(uint256 => QueriesStorage.ProtocolQueriesData) internal _organizationQueries;

    modifier onlyOrganizationAdminCheck(ZKProofData calldata proofData_) {
        onlyOrganizationAdmin(proofData_);
        _;
    }

    function __ProtocolQueriesManager_init(
        UpdateProtocolQueryEntry[] calldata queriesToUpdate_
    ) external initializer {
        __Ownable_init();

        _updateQueries(_defaultProtocolQueries, queriesToUpdate_);
    }

    function updateDefaultQueries(
        UpdateProtocolQueryEntry[] calldata queriesToUpdate_
    ) external onlyOwner {
        _updateQueries(_defaultProtocolQueries, queriesToUpdate_);
    }

    function _updateQueries(
        QueriesStorage.ProtocolQueriesData storage _queriesData,
        UpdateProtocolQueryEntry[] calldata queriesToUpdate_
    ) internal {
        for (uint256 i = 0; i < queriesToUpdate_.length; i++) {
            UpdateProtocolQueryEntry calldata currentQueryEntry_ = queriesToUpdate_[i];

            if (currentQueryEntry_.isAdding) {
                _queriesData.updateQuery(currentQueryEntry_.queryName, currentQueryEntry_.query);
            } else {
                _queriesData.removeQuery(currentQueryEntry_.queryName);
            }
        }
    }

    function updateOrganizationQueries(
        ZKProofData calldata orgAdminProofData_,
        UpdateProtocolQueryEntry[] calldata queriesToUpdate_
    ) external {
        _updateQueries(
            _organizationQueries[getOrganizationId(orgAdminProofData_.inputs)],
            queriesToUpdate_
        );
    }

    function getProtocolQuery(
        uint256 organizationId_,
        string memory queryName_
    ) external view returns (QueriesStorage.ProtocolQuery memory resultQuery_) {
        resultQuery_ = getDefaultProtocolQuery(queryName_);

        if (resultQuery_.validatorAddr == address(0)) {
            resultQuery_ = _organizationQueries[organizationId_].getProtocolQuery(queryName_);
        }
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

    function onlyOrganizationAdmin(ZKProofData calldata proofData_) public view {
        _verifyProof(proofData_, _defaultProtocolQueries.getOrganizationAdminQuery());
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
