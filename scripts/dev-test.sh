#!/usr/bin/env bash
set -euo pipefail

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required" >&2
  exit 1
fi

BASE_URL="${BASE_URL:-http://localhost:${PORT:-3000}}"
FARMER_ID="${FARMER_ID:?FARMER_ID is required}"
ORDER_USER_ID="${ORDER_USER_ID:?ORDER_USER_ID is required}"
PRODUCT_ID="${PRODUCT_ID:?PRODUCT_ID is required}"
SHIP_TO_ID="${SHIP_TO_ID:?SHIP_TO_ID is required}"
TRACKING_NUMBER="${TRACKING_NUMBER:-DEV-TRACKING-001}"

function curl_json() {
  curl -sS -H 'Content-Type: application/json' "$@"
}

echo "[1/6] GET /health"
curl -sS "${BASE_URL}/health" | jq . || true

echo "[2/6] GET /farmers/${FARMER_ID}/products"
curl -sS "${BASE_URL}/farmers/${FARMER_ID}/products" | jq . || true

PAYLOAD_CREATE=$(cat <<JSON
{
  "farmerCompanyId": "${FARMER_ID}",
  "orderedById": "${ORDER_USER_ID}",
  "shipToId": "${SHIP_TO_ID}",
  "items": [
    { "productId": "${PRODUCT_ID}", "quantity": 1 }
  ]
}
JSON
)

echo "[3/6] POST /orders"
CREATE_RESPONSE=$(curl_json -X POST "${BASE_URL}/orders" -d "${PAYLOAD_CREATE}")
ORDER_ID=$(echo "${CREATE_RESPONSE}" | jq -r '.order.id')
echo "Order ID: ${ORDER_ID}"
echo "${CREATE_RESPONSE}" | jq . || true

if [[ -z "${ORDER_ID}" || "${ORDER_ID}" == "null" ]]; then
  echo "Failed to create order" >&2
  exit 1
fi

echo "[4/6] POST /orders/${ORDER_ID}/confirm"
CONFIRM_RESPONSE=$(curl_json -X POST "${BASE_URL}/orders/${ORDER_ID}/confirm")
echo "${CONFIRM_RESPONSE}" | jq . || true

echo "[5/6] POST /orders/${ORDER_ID}/ship"
SHIP_PAYLOAD=$(cat <<JSON
{
  "trackingNumber": "${TRACKING_NUMBER}"
}
JSON
)
SHIP_RESPONSE=$(curl_json -X POST "${BASE_URL}/orders/${ORDER_ID}/ship" -d "${SHIP_PAYLOAD}")
echo "${SHIP_RESPONSE}" | jq . || true

echo "[6/6] POST /orders/${ORDER_ID}/complete"
COMPLETE_RESPONSE=$(curl_json -X POST "${BASE_URL}/orders/${ORDER_ID}/complete")
echo "${COMPLETE_RESPONSE}" | jq . || true

echo "Dev flow completed"
