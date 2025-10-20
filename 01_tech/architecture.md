# アーキテクチャ
- API: Node.js + Fastify + Zod
- ORM: Prisma（PostgreSQL）
- DB: PostgreSQL（Cloud SQL / Supabase / ローカル）
- PDF/通知: 後段で接続（LINE, HTML→Chromium→PDF）

## 境界
- services: ドメインロジック（価格・注文・在庫）
- routes: DTO検証＆サービス呼び出し
- db: Prisma Client
