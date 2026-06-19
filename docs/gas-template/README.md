# moguchart Google Spreadsheet テンプレート

moguchart の REST API を使って、ガントチャートのデータを Google Spreadsheet で表示・管理するためのテンプレートです。

## 📦 ファイル構成

| ファイル | 説明 |
|---------|------|
| `Config.gs` | 設定管理（APIキー、ベースURL） |
| `MoguchartApi.gs` | REST API クライアント |
| `SheetFunctions.gs` | スプレッドシートへのデータ書き込み |
| `Menu.gs` | カスタムメニューとエントリポイント |

## 🚀 セットアップ手順

### 1. スプレッドシートを作成

1. [Google Spreadsheet](https://sheets.google.com) で新しいスプレッドシートを作成
2. 「拡張機能」>「Apps Script」を開く

### 2. GAS コードを貼り付け

Apps Script エディタで以下の4ファイルを作成し、それぞれのコードをコピー&ペーストします：

1. `Config.gs`
2. `MoguchartApi.gs`
3. `SheetFunctions.gs`
4. `Menu.gs`

> **💡 ヒント**: デフォルトの `コード.gs` は削除して構いません。

### 3. 初期設定

1. スプレッドシートに戻り、ページをリロード
2. メニューバーに「🐹 moguchart」が表示されます
3. 「🐹 moguchart」>「⚙️ 初期設定」をクリック
4. 「設定」シートが作成されるので、B2セルに **APIキー** を入力

### 4. データ取得

1. 「🐹 moguchart」>「📋 プロジェクト一覧を取得」
2. プロジェクト一覧シートで取得したいプロジェクトの行をクリック
3. 「🐹 moguchart」>「📊 タスク一覧を取得」

## 📋 生成されるシート

### 設定シート
| 項目 | 値 |
|------|---|
| APIキー | `mk_xxxxxxxx...` |
| ベースURL | `https://moguchart.jp/api/v1` |

### プロジェクト一覧シート
| プロジェクトID | プロジェクト名 | 開始日 | 終了日 | 公開 | ロール | 表示粒度 | コメント数 | 説明 |
|---|---|---|---|---|---|---|---|---|

### タスク一覧シート
| 行ID | 行名 | タスクID | タスク名 | 開始日 | 終了日 | 日数 | 進捗率(%) | ラベル | 色 | ロック | 依存タスク | 説明 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

- **進捗率**: 条件付き書式で色分け表示（100%=緑、50%以上=黄、着手済み=薄黄）
- **色**: タスクバーの背景色がセルの背景色として反映されます

## 🔑 APIキーの発行

moguchart の Web UI（設定画面）または REST API から発行できます。

```
POST /api/v1/api-keys
X-API-Key: mk_既存のキー
Content-Type: application/json

{ "name": "Spreadsheet連携用", "scope": "read" }
```

> **💡** 読み取り専用の場合は `scope: "read"` を指定すると安全です。

## 📤 配布方法

完成したスプレッドシートの配布リンクを作成するには：

1. スプレッドシートのURLから ID を取得
   - `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
2. 配布用URLを作成
   - `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/copy`
3. このURLを共有すると、相手は自分のGoogleドライブにコピーを作成できます

## ⚠️ 注意事項

- APIキーは第三者と共有しないでください
- `read-write` スコープのキーは、データの変更・削除が可能です
- 大量のデータを頻繁に取得すると、GAS の実行時間制限（6分）に達する可能性があります
