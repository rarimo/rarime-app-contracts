// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import {StringSet} from "@solarity/solidity-lib/libs/data-structures/StringSet.sol";

string constant ORGANIZATION_ADMIN_KEY = "ORGANIZATION_ADMIN";
string constant GROUP_MEMBER_KEY = "GROUP_MEMBER";

library QueriesStorage {
    using StringSet for StringSet.Set;

    struct ProtocolQuery {
        string metadata;
        address validatorAddr;
        bytes queryData;
        bool isGroupLevel;
        bool isStaticQuery;
    }

    struct ProtocolQueriesData {
        mapping(string => ProtocolQuery) protocolQueries;
        StringSet.Set supportedQueries;
    }

    function updateQuery(
        ProtocolQueriesData storage queriesData,
        string memory queryName_,
        ProtocolQuery memory query_
    ) internal {
        queriesData.protocolQueries[queryName_] = query_;

        if (!contains(queriesData, queryName_)) {
            queriesData.supportedQueries.add(queryName_);
        }
    }

    function removeQuery(
        ProtocolQueriesData storage queriesData,
        string memory queryName_
    ) internal returns (bool) {
        if (contains(queriesData, queryName_)) {
            delete queriesData.protocolQueries[queryName_];
            queriesData.supportedQueries.remove(queryName_);

            return true;
        } else {
            return false;
        }
    }

    function contains(
        ProtocolQueriesData storage queriesData,
        string memory queryName_
    ) internal view returns (bool) {
        return queriesData.supportedQueries.contains(queryName_);
    }

    function getOrganizationAdminQuery(
        ProtocolQueriesData storage queriesData
    ) internal view returns (ProtocolQuery memory) {
        return getProtocolQuery(queriesData, ORGANIZATION_ADMIN_KEY);
    }

    function getProtocolQuery(
        ProtocolQueriesData storage queriesData,
        string memory queryName_
    ) internal view returns (ProtocolQuery memory) {
        return queriesData.protocolQueries[queryName_];
    }

    function getProtocolQueryValidator(
        ProtocolQueriesData storage queriesData,
        string memory queryName_
    ) internal view returns (address) {
        return queriesData.protocolQueries[queryName_].validatorAddr;
    }
}
