#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
REQUEST_KEY_HEADER="${REQUEST_KEY_HEADER:-X-Request-Key}"
REQUEST_KEY="${REQUEST_KEY:-ef928c10-2da4-4ca6-9b49-dedc912d5b4c}"

TEST_USER_ID="${TEST_USER_ID:-900001}"
TEST_ASSET_ID="${TEST_ASSET_ID:-900101}"
TEST_SYMBOL="${TEST_SYMBOL:-AAPLTST}"

export BASE_URL REQUEST_KEY_HEADER REQUEST_KEY TEST_USER_ID TEST_ASSET_ID TEST_SYMBOL

API_TEST_TMP_DIR="${API_TEST_TMP_DIR:-$(mktemp -d)}"
API_TEST_CREATED_TMP_DIR="${API_TEST_CREATED_TMP_DIR:-1}"

LAST_BODY_FILE=""
LAST_STATUS_CODE=""

cleanup_api_test_tmp() {
    if [[ "${API_TEST_CREATED_TMP_DIR}" == "1" && -d "${API_TEST_TMP_DIR}" ]]; then
        rm -rf "${API_TEST_TMP_DIR}"
    fi
}

trap cleanup_api_test_tmp EXIT

require_command() {
    local command_name="$1"
    command -v "${command_name}" >/dev/null 2>&1 || {
        echo "Missing required command: ${command_name}" >&2
        exit 1
    }
}

require_command curl
require_command jq

log_step() {
    printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$1"
}

fail_with_response() {
    local message="$1"
    echo "ERROR: ${message}" >&2
    if [[ -n "${LAST_BODY_FILE}" && -f "${LAST_BODY_FILE}" ]]; then
        echo "--- response body ---" >&2
        cat "${LAST_BODY_FILE}" >&2
        echo >&2
        echo "---------------------" >&2
    fi
    exit 1
}

request_json() {
    local name="$1"
    local method="$2"
    local path="$3"
    local expected_status="$4"
    local body="${5:-}"
    local use_request_key="${6:-1}"

    LAST_BODY_FILE="${API_TEST_TMP_DIR}/${name}.json"

    local -a curl_args=(
        -sS
        -o "${LAST_BODY_FILE}"
        -w "%{http_code}"
        -X "${method}"
        "${BASE_URL}${path}"
        -H "Accept: application/json"
    )

    if [[ "${use_request_key}" == "1" ]]; then
        curl_args+=(-H "${REQUEST_KEY_HEADER}: ${REQUEST_KEY}")
    fi

    if [[ -n "${body}" ]]; then
        curl_args+=(-H "Content-Type: application/json" --data "${body}")
    fi

    LAST_STATUS_CODE="$(curl "${curl_args[@]}")"

    if [[ "${LAST_STATUS_CODE}" != "${expected_status}" ]]; then
        fail_with_response "Expected HTTP ${expected_status} for ${method} ${path}, got ${LAST_STATUS_CODE}"
    fi
}

request_json_with_custom_key() {
    local name="$1"
    local method="$2"
    local path="$3"
    local expected_status="$4"
    local request_key="$5"
    local body="${6:-}"

    LAST_BODY_FILE="${API_TEST_TMP_DIR}/${name}.json"

    local -a curl_args=(
        -sS
        -o "${LAST_BODY_FILE}"
        -w "%{http_code}"
        -X "${method}"
        "${BASE_URL}${path}"
        -H "Accept: application/json"
        -H "${REQUEST_KEY_HEADER}: ${request_key}"
    )

    if [[ -n "${body}" ]]; then
        curl_args+=(-H "Content-Type: application/json" --data "${body}")
    fi

    LAST_STATUS_CODE="$(curl "${curl_args[@]}")"

    if [[ "${LAST_STATUS_CODE}" != "${expected_status}" ]]; then
        fail_with_response "Expected HTTP ${expected_status} for ${method} ${path}, got ${LAST_STATUS_CODE}"
    fi
}

request_expect_one_of() {
    local name="$1"
    local method="$2"
    local path="$3"
    local allowed_statuses="$4"
    local body="${5:-}"

    LAST_BODY_FILE="${API_TEST_TMP_DIR}/${name}.json"

    local -a curl_args=(
        -sS
        -o "${LAST_BODY_FILE}"
        -w "%{http_code}"
        -X "${method}"
        "${BASE_URL}${path}"
        -H "Accept: application/json"
        -H "${REQUEST_KEY_HEADER}: ${REQUEST_KEY}"
    )

    if [[ -n "${body}" ]]; then
        curl_args+=(-H "Content-Type: application/json" --data "${body}")
    fi

    LAST_STATUS_CODE="$(curl "${curl_args[@]}")"

    case ",${allowed_statuses}," in
        *,"${LAST_STATUS_CODE}",*) ;;
        *) fail_with_response "Expected one of [${allowed_statuses}] for ${method} ${path}, got ${LAST_STATUS_CODE}" ;;
    esac
}

assert_jq() {
    local filter="$1"
    local message="$2"
    if ! jq -e "${filter}" "${LAST_BODY_FILE}" >/dev/null 2>&1; then
        fail_with_response "Assertion failed: ${message}"
    fi
}

extract_jq() {
    local filter="$1"
    jq -r "${filter}" "${LAST_BODY_FILE}"
}

assert_file_contains() {
    local needle="$1"
    local message="$2"
    if ! grep -q --fixed-strings "${needle}" "${LAST_BODY_FILE}"; then
        fail_with_response "Assertion failed: ${message}"
    fi
}
