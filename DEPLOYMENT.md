# B2B Procurement System - Deployment Guide

## 概要

B2B Procurement System は Docker Compose を使用して、ローカルまたは本番環境で実行できます。

## 前提条件

- Docker 20.10+
- Docker Compose 2.0+
- Git

## ローカル開発環境での実行

### 1. リポジトリをクローン

```bash
git clone https://github.com/bleak12162/b2b_v2.git
cd b2b_v2
```

### 2. 環境設定

```bash
# 本番用環境ファイルをコピー
cp .env.production .env

# 本番パスワードを変更（必須）
# .env ファイルを編集して、DB_PASSWORD を変更してください
```

### 3. Docker で起動

```bash
# すべてのサービスを起動
docker-compose up -d

# ログを確認
docker-compose logs -f

# 初期データを投入（初回のみ）
docker-compose exec backend pnpm prisma db seed
```

### 4. アクセス

- **フロントエンド**: http://localhost
- **バックエンド API**: http://localhost:3000
- **HealthCheck**: http://localhost:3000/health

### 5. 停止

```bash
docker-compose down

# データベースを削除
docker-compose down -v
```

---

## 本番環境へのデプロイ

### Google Cloud Run へのデプロイ

#### 前提条件
- Google Cloud Platform (GCP) アカウント
- gcloud CLI インストール済み
- Container Registry または Artifact Registry へのアクセス権

#### デプロイ手順

```bash
# GCP プロジェクトを設定
gcloud config set project YOUR_PROJECT_ID

# イメージをビルドしてアップロード
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/b2b-backend:latest ./b2b_v2

# Cloud Run にデプロイ
gcloud run deploy b2b-backend \
  --image gcr.io/YOUR_PROJECT_ID/b2b-backend:latest \
  --platform managed \
  --region us-central1 \
  --memory 512Mi \
  --cpu 1 \
  --set-env-vars "DATABASE_URL=postgresql://user:pass@host:5432/db" \
  --allow-unauthenticated
```

### VPS へのデプロイ（自管理）

#### 1. サーバー準備

```bash
# SSH でサーバーにログイン
ssh user@your-server.com

# Docker をインストール
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Docker Compose をインストール
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### 2. リポジトリをクローンしてデプロイ

```bash
# リポジトリをクローン
git clone https://github.com/bleak12162/b2b_v2.git
cd b2b_v2

# 環境設定
cp .env.production .env
# .env を編集して、本番用の設定を入力

# Docker Compose で起動
docker-compose -f docker-compose.yml up -d

# ログ確認
docker-compose logs -f backend
```

#### 3. SSL/TLS 設定（Nginx + Certbot）

```bash
# Nginx をインストール
sudo apt-get install -y nginx certbot python3-certbot-nginx

# SSL 証明書を取得
sudo certbot certonly --standalone -d your-domain.com

# Nginx 設定ファイルを作成
sudo nano /etc/nginx/sites-available/b2b

# リバースプロキシ設定
server {
    listen 80;
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_set_header Host $host;
    }
}

# Nginx を有効にして再起動
sudo ln -s /etc/nginx/sites-available/b2b /etc/nginx/sites-enabled/
sudo systemctl restart nginx
```

---

## ディレクトリ構成

```
.
├── b2b_v2/                 # バックエンド
│   ├── Dockerfile
│   ├── prisma/
│   ├── src/
│   └── package.json
├── b2b_v2_frontend/        # フロントエンド
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── src/
│   └── package.json
├── docker-compose.yml      # Docker Compose 設定
├── .env.production         # 本番環境設定テンプレート
└── DEPLOYMENT.md           # このファイル
```

---

## トラブルシューティング

### ポートがすでに使用されている

```bash
# 使用中のポートを確認
lsof -i :3000
lsof -i :5432

# プロセスを終了
kill -9 <PID>
```

### データベース接続エラー

```bash
# Postgres コンテナのログを確認
docker-compose logs postgres

# Postgres に直接接続してテスト
docker-compose exec postgres psql -U b2b_user -d b2b_v2 -c "SELECT 1;"
```

### Docker イメージのキャッシュ削除

```bash
# イメージを削除してリビルド
docker-compose down
docker system prune -a
docker-compose up --build
```

---

## セキュリティのベストプラクティス

1. **環境変数を安全に管理**
   - .env ファイルは Git にコミットしない
   - 本番環境ではシークレット管理ツール（GCP Secret Manager など）を使用

2. **定期的なバックアップ**
   ```bash
   # データベースをバックアップ
   docker-compose exec postgres pg_dump -U b2b_user b2b_v2 > backup.sql
   ```

3. **ファイアウォール設定**
   - ポート 5432（PostgreSQL）は外部からアクセス不可
   - ポート 3000（API）は内部ネットワークのみ
   - ポート 80/443（フロントエンド）のみ公開

4. **監視とログ**
   - 本番環境ではログ集約ツール（ELK、Datadog など）を使用
   - ヘルスチェックエンドポイントを監視

---

## 更新とロールバック

### 更新手順

```bash
# 最新コードを取得
git pull origin master

# 新しいイメージをビルド
docker-compose build

# コンテナを再起動
docker-compose up -d

# マイグレーション実行
docker-compose exec backend pnpm prisma migrate deploy
```

### ロールバック

```bash
# 前のバージョンを取得
git checkout <previous-commit>

# 前のイメージで再起動
docker-compose up -d

# 前のマイグレーション状態に戻す
docker-compose exec backend pnpm prisma migrate resolve --rolled-back <migration-name>
```

---

## サポート

問題が発生した場合は、以下を確認してください：

1. [GitHub Issues](https://github.com/bleak12162/b2b_v2/issues)
2. Docker ログ: `docker-compose logs`
3. アプリケーションログ: `docker-compose logs backend`

---

最終更新: 2025-10-20
