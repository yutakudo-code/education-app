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
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
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
    const prefBase = prefName.replace(/[都府県]$/, '');

    if (!rec || rec.length === 0) return { correct: false, score: 0, message: '文字が認識できませんでした。もう少し大きくはっきり書いてみよう！' };

    const validTargets = [normalize(prefName), normalize(prefBase)];
    if (pref.displayName) validTargets.push(normalize(pref.displayName));
    if (pref.region === 'world' && pref.reading) validTargets.push(normalize(pref.reading));

    // 完全一致
    for (const target of validTargets) {
      if (rec === target) {
        return { correct: true, score: 100, message: 'かんぺき！' };
      }
    }
    
    // 1文字ミス（惜しい！）
    for (const target of validTargets) {
      if (levenshtein(rec, target) === 1 && rec.length === target.length) {
        return { correct: false, score: 40, message: 'おしい！1文字だけちがうかも！', hint: `「${pref.displayName || prefName}」に近いよ！` };
      }
    }
    
    return { correct: false, score: 0, message: '「' + (pref.displayName || prefName) + '」と書いてみよう！' };
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
    
    if (levenshtein(rec, normalize(capBase)) === 1 && rec.length === capBase.length) {
      return { correct: false, score: 40, message: 'おしい！1文字だけちがうかも！', hint: `「${capName}」をもう一度書いてみよう！` };
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
