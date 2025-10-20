# セットアップ
1) .env設定（DATABASE_URL, ORDERER_COMPANY_ID, LINE_*）
2) prisma migrate: `pnpm prisma migrate dev`
3) 起動: `pnpm dev` → /health が { ok: true }
