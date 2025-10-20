# テスト戦略
- 単体: services（価格、注文、在庫Tx）
- 統合: routes（DTO→DB）
- E2E: 「注文→確定→出荷→完了」
- 受入: 受け入れ基準を満たすこと（docs/02_domain/order_lifecycle.md）
