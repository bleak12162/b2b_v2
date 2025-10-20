# 状態遷移
new ──(confirm)──▶ processing ──(ship)──▶ shipped ──(complete)──▶ completed
  └──(cancel)▶ canceled

- 編集可: new（明細・数量・納期・納品先）
- 在庫引当: new→processingで管理商品のみ
