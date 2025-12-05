# Notion-Driven Market Intelligence Dashboard

## Overview
- **目的**: Notion をマスターデータベースとし、AI 情報収集 → D1 更新 → ダッシュボード可視化 → PDF レポート生成までをワンストップで自動化する軽量 BI。
- **フロント**: React + TailwindCSS + DaisyUI (Apple ライクな UI、ブランドカラー #aa0000)。
- **バックエンド**: Cloudflare Workers (Hono) / D1 / GraphQL / Cron Triggers。
- **AI & 外部サービス**:
  - OpenAI GPT-5.1 で市場インテリジェンスを補完
  - SerpAPI で最新ニュース検索
  - Notion API 双方向同期 (サブページ再帰取得)
  - PDFShift API で PDF レポートを生成

## ディレクトリ構成 (抜粋)
```
├─ src
│  ├─ client/              # フロントエンド (React)
│  │  ├─ components/       # UI コンポーネント (FilterBar, DetailPanel など)
│  │  ├─ lib/              # GraphQL / API ヘルパー
│  │  └─ main.tsx          # エントリポイント
│  ├─ server/
│  │  ├─ db/marketData.ts  # D1 アクセスラッパ
│  │  ├─ graphql/schema.ts # GraphQL Yoga スキーマ
│  │  ├─ services/
│  │  │  ├─ aiResearchAgent.ts # OpenAI + SerpAPI 連携
│  │  │  ├─ notionSync.ts      # Notion 双方向同期
│  │  │  └─ pdfReport.ts       # PDF レポート生成
│  │  └─ types.ts          # Hono Bindings 定義
│  └─ index.ts             # Hono ルーティング
├─ migrations/             # D1 マイグレーション
│  ├─ 0001_init.sql
│  └─ 0002_add_subpages_column.sql
├─ tailwind.config.ts      # Tailwind + DaisyUI 設定
├─ vite.config.ts          # Workers 用 Vite 設定
├─ vite.client.config.ts   # CSR バンドル設定
└─ wrangler.jsonc          # Cloudflare 設定
```

## 主要機能
1. **市場データ GraphQL API** (`/graphql`)
   - `marketData` / `marketDataById`
2. **Notion → D1 同期**
   - `POST /api/sync`
   - Cron Trigger (`scheduled`) が 15 分毎などで定例同期
   - Notion ページコンテンツ全体を取得し、市場インサイトとして表示
3. **AI 市場リサーチ**
   - `POST /api/research`
   - OpenAI GPT-5.1 + SerpAPI で市場規模 / 成長率 / 主要プレイヤーを補完
   - D1 に upsert & Notion ページへサマリー追記
4. **PDF レポート生成**
   - `POST /api/report`
   - PDFShift でチャート画像/市場インサイト/Notionコンテンツを含むレポート
   - **別ウィンドウで PDF プレビュー表示、ダウンロードボタンつき**
5. **ダッシュボード UI**
   - フィルタ (Segment / Issue / Year)
   - バブルチャート (Chart.js)
   - 主要プレイヤーランキング & 集計メトリクス
   - **市場インサイトセクション (Notion ページコンテンツを Markdown 表示)**
   - **PDF 出力ボタン (グラフ下に独立配置)**

## API エンドポイント
| Method | Path           | 説明 |
|--------|----------------|------|
| POST   | `/api/sync`    | Notion DB から D1 へ差分同期。`{ segment?: string }` |
| POST   | `/api/research`| AI による市場データ更新。`{ segment: string, issue?: string, year: number }`|
| POST   | `/api/report`  | 指定 ID の PDF レポートを生成。`{ id: number, chartImageData?: string }`|
| ANY    | `/graphql`     | GraphQL Yoga エンドポイント |
| GET    | `/healthz`     | ヘルスチェック |

## 環境変数 (Wrangler Secrets)
| Key | 用途 |
|-----|------|
| `NOTION_API_KEY` | Notion API シークレット |
| `NOTION_DATABASE_ID` | 市場サマリー DB の ID |
| `OPENAI_API_KEY` | GPT-5.1 呼び出し用 |
| `SERPAPI_KEY` | Google 検索 API (SerpAPI) |
| `PDFSHIFT_API_KEY` | PDFShift (HTML → PDF) 用 |

ローカル/ステージングでは `.dev.vars` を使用し、本番は `wrangler secret put` で登録してください。

## D1 セットアップ
1. **本番 DB 作成** (一度だけ)
   ```bash
   npx wrangler d1 create notion-market-intel
   ```
   生成された `database_id` を `wrangler.jsonc` の `d1_databases[0].database_id` に反映。

2. **ローカルマイグレーション**
   ```bash
   npm run db:migrate:local
   ```

3. **本番マイグレーション** (デプロイ前)
   ```bash
   npm run db:migrate:prod
   ```

## 開発フロー
```bash
npm install
npm run build           # SSR ワーカー & CSR バンドル
npm run preview         # wrangler pages dev (3000)
```

開発サーバー (Cloudflare Pages) 起動時は
```bash
npm run build
pm2 start ecosystem.config.cjs
```
ポート 3000 を空けるのを忘れずに。

## PDFShift 連携メモ
- API Endpoint: `https://api.pdfshift.io/v3/convert/pdf`
- 認証: Basic 認証 (`api:PDFSHIFT_API_KEY`)
- `POST /api/report` に `chartImageData`(data URL) を渡すと、チャート画像がレポートに埋め込まれます。
- **フォント**: Yu Gothic UI (游ゴシック体) を使用し、日本語を美しく表示
- **レイアウト**: A4サイズ、洗練されたスタイリング、#aa0000 のブランドカラー
- **構成**: 主要指標（市場規模、成長率、上位10社シェア）→ グラフ → 市場インサイト → 主要プレイヤー → 参考リンク
- 生成された PDF は新しいウィンドウでプレビュー表示され、ダウンロードボタンで保存可能

## Cron Trigger 設定例
`wrangler.toml` ではなく Dashboard から Cron Trigger を設定してください。
推奨: `*/15 * * * *` (15 分間隔)。

## フロントエンドの使い方
1. フィルタバーでセグメント/課題/年度を選択
2. 「AIで更新」を押すと、OpenAI + SerpAPI がバックグラウンドで市場データを補完
3. バブルチャートから任意の市場をクリックすると市場インサイトセクションが更新
4. グラフ下の「市場インサイト」セクションで Notion ページコンテンツ (Markdown 形式) を確認
5. 「📄 PDF レポート出力」ボタンをクリックすると、**別ウィンドウで PDF プレビューが開き、ダウンロードボタンが表示されます**
6. Notion 側で更新があった場合は「Notion同期」ボタン or Cron による自動同期

## 未実装・今後の推奨改善
- チャート画像生成をより高精細に (キャプチャサイズ調整)
- 大規模データ時のチャンク分割 (client bundle が 500kB 超え)
- SSE / websockets で AI 完了通知をリアルタイム化 (現状はポーリング相当)

## デプロイ
```bash
npm run build
wrangler pages deploy dist --project-name <PROJECT_NAME>
```
`wrangler.jsonc` の `compatibility_date` は 2025-12-03 に設定済み。

## リンク
- Cloudflare D1: https://developers.cloudflare.com/d1/
- Notion API: https://developers.notion.com/
- OpenAI API: https://platform.openai.com/
- SerpAPI: https://serpapi.com/
- PDFShift: https://pdfshift.io/
