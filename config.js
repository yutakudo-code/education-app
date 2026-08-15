// ====================================================
// Google Cloud Vision API 設定
// ====================================================
// APIキーの取得方法:
// 1. https://console.cloud.google.com/ にアクセス
// 2. プロジェクトを作成
// 3. Cloud Vision API を有効化
// 4. 「認証情報」からAPIキーを作成
// 5. 下の VISION_API_KEY に貼り付ける
// ====================================================

const CONFIG = {
  VISION_API_KEY: '', // ← ここにAPIキーを入力してください
  VISION_API_URL: 'https://vision.googleapis.com/v1/images:annotate',
};
