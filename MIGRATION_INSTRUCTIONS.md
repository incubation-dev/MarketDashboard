# 本番データベースへのマイグレーション手順

## 問題
本番環境のD1データベースに`region`カラムが存在しないため、データが表示されません。

## 解決方法：Cloudflare Dashboardから手動マイグレーション

### 手順

1. **Cloudflare Dashboardにアクセス**
   - https://dash.cloudflare.com/ にログイン
   - アカウントを選択

2. **D1データベースを開く**
   - 左メニューから「Workers & Pages」→「D1」を選択
   - データベース「notion-market-intel」をクリック

3. **Console タブを開く**
   - 上部タブの「Console」をクリック

4. **以下のSQLを実行**
   ```sql
   -- Migration: Add region (領域) column to market_data table
   ALTER TABLE market_data ADD COLUMN region TEXT;
   
   -- Create index for efficient region-based filtering
   CREATE INDEX IF NOT EXISTS idx_market_data_region ON market_data(region);
   ```

5. **「Execute」ボタンをクリック**

6. **確認**
   - 以下のSQLで確認：
   ```sql
   PRAGMA table_info(market_data);
   ```
   - `region` カラムが表示されればOK

7. **データを再同期**
   - ダッシュボードのUIから「Notion同期」ボタンをクリック
   - または以下のコマンドを実行：
   ```bash
   curl -X POST https://585b1620.aconnect-innovator.pages.dev/api/sync
   ```

## 代替方法：wranglerコマンド（権限がある場合）

```bash
npx wrangler d1 migrations apply notion-market-intel --remote
```

## 確認方法

マイグレーション後、以下で確認：

```bash
curl -X POST https://585b1620.aconnect-innovator.pages.dev/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ marketData { id segment region year } }"}'
```

データが返ってくればOKです。
