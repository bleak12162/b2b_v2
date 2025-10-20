# 注文→出荷完了ライフサイクル
1) カタログ参照→カート→POST /orders で new 作成
2) POST /orders/{id}/confirm で引当→processing
3) POST /orders/{id}/ship で出荷→shipped
4) POST /orders/{id}/complete で完了（任意）
