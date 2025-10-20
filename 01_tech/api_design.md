# API設計（REST）
- GET  /health
- GET  /farmers/:id/products … effectivePrice付与
- POST /orders … new作成（単価スナップショット）
- PATCH /orders/:id … new限定で編集
- POST /orders/:id/confirm … new→processing（在庫確保Tx）
- POST /orders/:id/ship … processing→shipped（trackingNo, shippedAt）
- POST /orders/:id/complete … shipped→completed
- GET  /orders?status&farmer&from&to
- GET  /ship-tos / POST /ship-tos / PATCH /ship-tos/:id

## エラー方針
- 422: 在庫不足 / 400: 入力不正 / 403: 権限不足 / 404: 参照なし
- 統一レスポンス: { error: { code, message, details? } }
