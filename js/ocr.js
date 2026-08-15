// ============================================================
// js/ocr.js - Google Cloud Vision API 手書き文字認識・採点
// ============================================================

const OCR = (() => {
  // Vision APIで手書き文字を認識
  async function recognize(base64Image) {
    const apiKey = (typeof CONFIG !== 'undefined' && CONFIG.VISION_API_KEY) ||
                   localStorage.getItem('vision_api_key') || '';
    if (!apiKey) {
      return { success: false, error: 'no_api_key', text: '' };
    }

    const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
    const body = {
      requests: [{
        image: { content: base64Image },
        features: [{ type: 'TEXT_DETECTION', maxResults: 5 }],
        imageContext: { languageHints: ['ja', 'ja-JP'] }
      }]
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const json = await res.json();

      if (json.error) return { success: false, error: json.error.message, text: '' };

      const annotations = json.responses?.[0]?.textAnnotations;
      if (!annotations || annotations.length === 0) {
        return { success: true, text: '', recognized: '' };
      }
      const raw = annotations[0].description || '';
      const clean = raw.replace(/[\s\n\r]/g, '');
      return { success: true, text: clean, recognized: clean };

    } catch (err) {
      return { success: false, error: err.message, text: '' };
    }
  }

  // テキストを正規化（採点用）
  function normalize(text) {
    let t = text.replace(/[\s\n\r]/g, '')
               .replace(/[ａ-ｚＡ-Ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
               .toLowerCase();
    // Vision APIで誤認識されやすい漢字をカタカナに変換
    t = t.replace(/力/g, 'カ')
         .replace(/二/g, 'ニ')
         .replace(/口/g, 'ロ')
         .replace(/工/g, 'エ')
         .replace(/八/g, 'ハ')
         .replace(/一/g, 'ー')
         .replace(/夕/g, 'タ')
         .replace(/十/g, 'ナ'); // ナが十になることもある
    return t;
  }

  // =====================================================
  // Step1: 都道府県名の採点
  // 「神奈川」だけ書いても「神奈川県」と一致にする
  // =====================================================
  function judgeStep1(recognized, pref) {
    const rec = normalize(recognized);
    const prefName = pref.name;
    const prefBase = prefName.replace(/[都道府県]$/, ''); // 末尾の都道府県を除去

    if (!rec || rec.length === 0) return { correct: false, score: 0, message: '文字が認識できませんでした。もう少し大きくはっきり書いてみよう！' };

    // 完全一致
    if (rec === normalize(prefName)) return { correct: true, score: 100, message: 'かんぺき！' };
    // ベース部分の一致（「神奈川」→「神奈川県」OK）
    if (rec === normalize(prefBase)) return { correct: true, score: 95, message: 'せいかい！（「' + prefName.slice(-1) + '」もわすれずに！）' };
    // 部分一致（認識に少しミスがある場合）
    if (normalize(prefName).includes(rec) && rec.length >= prefBase.length - 1) {
      return { correct: true, score: 80, message: 'ほぼ正解！（少し字がにているかも）' };
    }
    // 1文字ミス（惜しい！）
    if (levenshtein(rec, normalize(prefBase)) === 1) {
      return { correct: false, score: 40, message: 'おしい！もう一文字！', hint: `「${prefName}」に近いよ！` };
    }
    return { correct: false, score: 0, message: '「' + prefName + '」と書いてみよう！' };
  }

  // =====================================================
  // Step2: 県庁所在地の採点
  // =====================================================
  function judgeStep2(recognized, pref) {
    const rec = normalize(recognized);
    const capName = pref.capital;
    const capBase = capName.replace(/[市区町村]$/, '');

    if (!rec || rec.length === 0) return { correct: false, score: 0, message: '文字が認識できませんでした。もう少し大きく書いてみよう！' };

    if (rec === normalize(capName)) return { correct: true, score: 100, message: 'かんぺき！' };
    if (rec === normalize(capBase)) return { correct: true, score: 95, message: 'せいかい！' };
    if (normalize(capName).includes(rec) && rec.length >= capBase.length - 1) {
      return { correct: true, score: 80, message: 'ほぼ正解！' };
    }
    if (levenshtein(rec, normalize(capBase)) === 1) {
      return { correct: false, score: 40, message: 'おしい！', hint: `「${capName}」をもう一度書いてみよう！` };
    }
    return { correct: false, score: 0, message: `「${capName}」と書いてみよう！` };
  }

  // レーベンシュタイン距離（文字の間違い数を計算）
  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({length: m + 1}, (_, i) => Array.from({length: n + 1}, (_, j) => j === 0 ? i : 0));
    for (let j = 1; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
    return dp[m][n];
  }

  return { recognize, judgeStep1, judgeStep2 };
})();
