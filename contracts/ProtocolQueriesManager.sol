// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import {ICircuitValidator} from "@iden3/contracts/interfaces/ICircuitValidator.sol";
import {IZKPVerifier} from "@iden3/contracts/interfaces/IZKPVerifier.sol";

import {CredentialAtomicQueryValidator} from "@iden3/contracts/validators/CredentialAtomicQueryValidator.sol";

import {IProtocolQueriesManager} from "./interfaces/IProtocolQueriesManager.sol";

contract ProtocolQueriesManager is IProtocolQueriesManager, OwnableUpgradeable {
    string public constant override ORGANIZATION_ADMIN_KEY = "ORGANIZATION_ADMIN";
    string public constant override GROUP_MEMBER_KEY = "GROUP_MEMBER";

    // Query key => Protocol Query struct
    mapping(string => ProtocolQuery) internal _defaultProtocolQueries;

    // Organization id (issuer id) => Query key => Protocol Query struct
    mapping(uint256 => mapping(string => ProtocolQuery)) internal _organizationQueries;

    modifier onlyOrganizationAdminCheck(ZKProofData calldata proofData_) {
        onlyOrganizationAdmin(proofData_);
        _;
    }

    function __ProtocolQueriesManager_init(
        UpdateProtocolQueryEntry[] calldata queriesToUpdate_
    ) external initializer {
        __Ownable_init();

        _updateDefaultQueries(queriesToUpdate_);
    }

    function updateDefaultQueries(
        UpdateProtocolQueryEntry[] calldata queriesToUpdate_
    ) external onlyOwner {
        _updateDefaultQueries(queriesToUpdate_);
    }

    function updateOrganizationQueries(
        ZKProofData calldata orgAdminProofData_,
        UpdateProtocolQueryEntry[] calldata queriesToUpdate_
    ) external onlyOrganizationAdminCheck(orgAdminProofData_) {
        _updateOrganizationQueries(getOrganizationId(orgAdminProofData_.inputs), queriesToUpdate_);
    }

    function getProtocolQuery(
        uint256 organizationId_,
        string memory queryName_
    ) external view returns (ProtocolQuery memory resultQuery_) {
        resultQuery_ = getDefaultProtocolQuery(queryName_);

        if (resultQuery_.validatorAddr == address(0)) {
            resultQuery_ = _organizationQueries[organizationId_][queryName_];
        }
    }

    function getDefaultProtocolQuery(
        string memory queryName_
    ) public view returns (ProtocolQuery memory) {
        return _defaultProtocolQueries[queryName_];
    }

    function getOrganizationId(uint256[] memory inputs_) public view returns (uint256) {
        address validatorAddr_ = _defaultProtocolQueries[ORGANIZATION_ADMIN_KEY].validatorAddr;

        return inputs_[CredentialAtomicQueryValidator(validatorAddr_).inputIndexOf("issuerId")];
    }

    function isProtocolQueryExist(
        uint256 organizationId_,
        string memory queryName_
    ) public view returns (bool) {
        bool result_ = isDefaultQueryExist(queryName_);

        return
            result_
                ? result_
                : _organizationQueries[organizationId_][queryName_].validatorAddr != address(0);
    }

    function isDefaultQueryExist(string memory queryName_) public view returns (bool) {
        return _defaultProtocolQueries[queryName_].validatorAddr != address(0);
    }

    function onlyOrganizationAdmin(ZKProofData calldata proofData_) public view {
        _verifyProof(proofData_, _defaultProtocolQueries[ORGANIZATION_ADMIN_KEY]);
    }

    function _updateDefaultQueries(UpdateProtocolQueryEntry[] calldata queriesToUpdate_) internal {
        for (uint256 i = 0; i < queriesToUpdate_.length; i++) {
            UpdateProtocolQueryEntry calldata currentQueryEntry_ = queriesToUpdate_[i];

            if (currentQueryEntry_.isAdding) {
                _defaultProtocolQueries[currentQueryEntry_.queryName] = currentQueryEntry_.query;
            } else {
                delete _defaultProtocolQueries[currentQueryEntry_.queryName];
            }
        }
    }

    function _updateOrganizationQueries(
        uint256 organizationId_,
        UpdateProtocolQueryEntry[] calldata queriesToUpdate_
    ) internal {
        for (uint256 i = 0; i < queriesToUpdate_.length; i++) {
            UpdateProtocolQueryEntry calldata currentQueryEntry_ = queriesToUpdate_[i];

            if (currentQueryEntry_.isAdding) {
                _organizationQueries[organizationId_][
                    currentQueryEntry_.queryName
                ] = currentQueryEntry_.query;
            } else {
                delete _organizationQueries[organizationId_][currentQueryEntry_.queryName];
            }
        }
    }

    function _onlyExistingQuery(ProtocolQuery memory query_) internal view {
        if (query_.validatorAddr == address(0)) {
            revert ProtocolQueriesManagerQueryDoesNotExist();
        }
    }

    function _verifyProof(
        ZKProofData calldata proofData_,
        ProtocolQuery memory query_
    ) internal view {
        _onlyExistingQuery(query_);

        ICircuitValidator(query_.validatorAddr).verify(
            proofData_.inputs,
            proofData_.a,
            proofData_.b,
            proofData_.c,
            query_.queryData
        );
    }
}
