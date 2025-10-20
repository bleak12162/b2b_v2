# B2B v2 API

受発注フローを最小構成で運用するための Fastify + Prisma サーバです。詳細な設計・運用ルールは `00_project/` および `01_tech/` 以下のドキュメントを参照してください。

## 起動手順
`03_ops/setup.md` の手順をベースに、以下の流れでローカル環境を起動できます。

1. `.env.example` をコピーして `.env` を作成し、`DATABASE_URL` と `ORDERER_COMPANY_ID`（初期データ投入後）を設定します。
2. 依存関係をインストールします。
   ```bash
   pnpm install
   ```
3. Prisma クライアント生成とマイグレーションを実行します。
   ```bash
   pnpm prisma:generate
   pnpm prisma:migrate --name init
   ```
4. API サーバを起動します。
   ```bash
   pnpm dev
   ```
5. 別ターミナルで `scripts/dev-test.sh` を実行すると、ヘルスチェックから注文作成〜完了までの API フローを一括で検証できます。

## テストスクリプト
`scripts/dev-test.sh` は以下の環境変数を利用して疎通確認を行います。

- `FARMER_ID`: `/farmers/{id}/products` を叩く対象の農家 Company ID
- `ORDER_USER_ID`: 注文を作成するユーザー ID
- `PRODUCT_ID`: 注文明細に使用する商品 ID
- `SHIP_TO_ID`: 納品先 ID
- `TRACKING_NUMBER` (任意): 出荷時に付与する伝票番号

```bash
FARMER_ID=... ORDER_USER_ID=... PRODUCT_ID=... SHIP_TO_ID=... ./scripts/dev-test.sh
```

## LINE Push 通知
`.env` で `ENABLE_LINE_PUSH=true` と `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_CHANNEL_SECRET` を設定すると、`UserSetting.lineEnabled=true` かつ `lineUserId` が登録されたユーザーに対して注文ライフサイクル（作成/確定/出荷/完了）の通知が送信されます。

## 参考ドキュメント
- アーキテクチャ: `01_tech/architecture.md`
- API 仕様: `01_tech/api_design.md`
- ドメイン仕様: `02_domain/`
- 運用手順: `03_ops/setup.md`
