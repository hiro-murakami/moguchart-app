// フロントエンドと共有する型定義
// 注意: ここにはバックエンド固有のライブラリ(firebase-admin等)をimportしないでください。

export interface SharedUser {
  id: string;
  email: string;
  displayName?: string;
  createdAt: string; // JSONシリアライズ後の型(Dateではなくstring)にすることを推奨
}

export interface ApiResponse<T> {
  data: T;
  status: "success" | "error";
}
