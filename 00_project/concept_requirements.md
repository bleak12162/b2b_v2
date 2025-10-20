# コンセプト & 要件
- 役割: orderer(自社:1) / receiver(農家:N) / admin
- スコープ: 商品閲覧→注文(new)→確定(processing:在庫引当)→出荷(shipped)→完了(completed)
- 非機能(初期): 可用性99.9%、1注文=最大50明細、同時接続100ユーザー

## 受け入れ基準(要約)
- newのみ編集可。confirmで在庫引当。shipで出荷情報保存。価格はスナップショット固定。
