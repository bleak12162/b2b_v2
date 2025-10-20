# DB設計（PostgreSQL）
- ER: Company, User, Product, ProductSpecialPrice, Order, OrderItem, InventoryLedger, ShipTo, ShipToFarmerRoute, UserSetting
- 価格: Product.unitPrice / 特価(期間内) → effectivePrice(受注時に保存)
- 納品先: ShipToは自社配下。注文に shipTo{Id,LabelSnap,AddrSnap,PhoneSnap} を保存。

## マイグレーション指針
- 受注金額はOrderItemからトリガで再計算（migration.sql）
- 変更は必ずmigrationファイル化
