// ============================================================
// js/quiz.js - Step1（漢字書き取り）& Step2（県庁所在地）クイズ
// ============================================================

const Quiz = (() => {
  let activeCanvas = null;
  let activeCanvas2 = null;
  let currentPref = null;
  let currentUserId = null;
  let failCount = 0;
  let onComplete = null;

  // ============================================================
  // STEP 1: 漢字書き取りクイズ
  // ============================================================
  function initStep1(pref, userId, completeCb) {
    currentPref = pref;
    currentUserId = userId;
    failCount = 0;
    onComplete = completeCb;

    document.getElementById('step1-pref-display').textContent = pref.reading;

    // ミニマップ初期化
    JapanMap.initMini('mini-map-step1', pref);

    // キャンバス初期化
    if (activeCanvas) { activeCanvas = null; }
    activeCanvas = new HandwritingCanvas('writing-canvas', { penSize: 14 });

    // ツールバー
    document.getElementById('pen-size').addEventListener('input', e => {
      activeCanvas.setPenSize(e.target.value);
    });
    document.getElementById('canvas-clear-btn').addEventListener('click', () => activeCanvas.clear());
    document.getElementById('canvas-undo-btn').addEventListener('click', () => activeCanvas.undo());

    // 音声で問題を読む
    Speech.speakQuestion(`この都道府県の名前を漢字で書いてみよう！ヒント、読み方は「${pref.reading}」です。`);

    // ヒントボタン（最初は非表示）
    document.getElementById('show-hint-btn').classList.add('hidden');
    document.getElementById('show-answer-btn').classList.add('hidden');
    document.getElementById('step1-result').classList.add('hidden');
    document.getElementById('step1-result').innerHTML = '';
    document.getElementById('step1-hint').classList.add('hidden');

    // 判定ボタン
    const judgeBtn = document.getElementById('judge-btn');
    const newBtn = judgeBtn.cloneNode(true);
    judgeBtn.parentNode.replaceChild(newBtn, judgeBtn);
    newBtn.addEventListener('click', () => _judgeStep1());

    // ヒントボタン
    const hintBtn = document.getElementById('show-hint-btn');
    const newHintBtn = hintBtn.cloneNode(true);
    hintBtn.parentNode.replaceChild(newHintBtn, hintBtn);
    newHintBtn.addEventListener('click', () => _showStep1Hint());

    // 答えを見るボタン
    const ansBtn = document.getElementById('show-answer-btn');
    const newAnsBtn = ansBtn.cloneNode(true);
    ansBtn.parentNode.replaceChild(newAnsBtn, ansBtn);
    newAnsBtn.addEventListener('click', () => _showStep1Answer());
  }

  async function _judgeStep1() {
    if (!activeCanvas || activeCanvas.isEmpty()) {
      _showResult('step1-result', false, '何も書かれていないよ！書いてから判定しよう！');
      Speech.speak('何も書かれていないよ！書いてから判定しよう！');
      return;
    }
    _setLoading(true);
    const base64 = activeCanvas.toBase64();
    const result = await OCR.recognize(base64);
    _setLoading(false);

    if (!result.success && result.error === 'no_api_key') {
      _showApiKeyModal();
      return;
    }

    const judgment = OCR.judgeStep1(result.text, currentPref);
    Progress.recordAttempt(currentUserId, currentPref.id, 1, judgment.correct);

    if (judgment.correct) {
      _showResult('step1-result', true, `🎉 ${judgment.message}<br>「<strong>${currentPref.name}</strong>」が書けたね！`);
      Speech.speakCorrect();
      _triggerConfetti();
      setTimeout(() => {
        if (onComplete) onComplete('step1');
      }, 2000);
    } else {
      failCount++;
      _showResult('step1-result', false, `😣 ${judgment.message}`);
      Speech.speakWrong();
      if (failCount >= 2) document.getElementById('show-hint-btn').classList.remove('hidden');
      if (failCount >= 4) document.getElementById('show-answer-btn').classList.remove('hidden');
      if (judgment.hint) Speech.speakHint(judgment.hint);
    }
  }

  function _showStep1Hint() {
    const pref = currentPref;
    const hintEl = document.getElementById('step1-hint');
    hintEl.classList.remove('hidden');
    hintEl.innerHTML = `
      <div class="hint-box">
        <span class="hint-icon">💡</span>
        <div>
          <p>読み方：<strong>${pref.reading}</strong></p>
          <p>文字数：<strong>${pref.name.length}文字</strong></p>
          <p>地方：<strong>${pref.region}地方</strong></p>
          <p>特産品：<strong>${pref.emoji} ${pref.products[0].name}</strong></p>
        </div>
      </div>
    `;
    Speech.speakHint(`読み方は「${pref.reading}」、${pref.name.length}文字の都道府県です！`);
  }

  function _showStep1Answer() {
    const pref = currentPref;
    const hintEl = document.getElementById('step1-hint');
    hintEl.classList.remove('hidden');
    hintEl.innerHTML = `
      <div class="hint-box answer-box">
        <span class="hint-icon">📖</span>
        <div>
          <p>答え：<strong class="big-answer">${pref.name}</strong></p>
          <p style="font-size:0.8em;color:#888">書いてみてから、次へ進もう！</p>
        </div>
      </div>
    `;
    Speech.speak(`答えは「${pref.name}」です。書いてみてから次へ進みましょう！`);
  }

  // ============================================================
  // STEP 2: 県庁所在地クイズ
  // ============================================================
  function initStep2(pref, userId, completeCb) {
    currentPref = pref;
    currentUserId = userId;
    failCount = 0;
    onComplete = completeCb;

    document.getElementById('step2-pref-name').textContent = pref.name;
    JapanMap.initMini('mini-map-step2', pref);

    document.getElementById('step2-result').classList.add('hidden');
    document.getElementById('step2-capital-info').classList.add('hidden');

    // キャンバス初期化
    if (activeCanvas2) { activeCanvas2 = null; }
    activeCanvas2 = new HandwritingCanvas('writing-canvas-2', { penSize: 14 });

    document.getElementById('pen-size-2').addEventListener('input', e => {
      activeCanvas2.setPenSize(e.target.value);
    });
    document.getElementById('canvas2-clear-btn').addEventListener('click', () => activeCanvas2.clear());
    document.getElementById('canvas2-undo-btn').addEventListener('click', () => activeCanvas2.undo());

    // モード切替
    const writeModeBtn = document.getElementById('mode-write-btn');
    const choiceModeBtn = document.getElementById('mode-choice-btn');
    const writeMode = document.getElementById('step2-write-mode');
    const choiceMode = document.getElementById('step2-choice-mode');

    writeModeBtn.addEventListener('click', () => {
      writeModeBtn.classList.add('active'); choiceModeBtn.classList.remove('active');
      writeMode.classList.remove('hidden'); choiceMode.classList.add('hidden');
    });
    choiceModeBtn.addEventListener('click', () => {
      choiceModeBtn.classList.add('active'); writeModeBtn.classList.remove('active');
      choiceMode.classList.remove('hidden'); writeMode.classList.add('hidden');
      _buildChoices();
    });

    // 判定ボタン（書き取りモード）
    const judgeBtn2 = document.getElementById('judge-btn-2');
    const newBtn2 = judgeBtn2.cloneNode(true);
    judgeBtn2.parentNode.replaceChild(newBtn2, judgeBtn2);
    newBtn2.addEventListener('click', () => _judgeStep2Write());

    // 選択肢を生成
    _buildChoices();

    Speech.speakQuestion(`${pref.name}の県庁所在地はどこかな？`);
  }

  async function _judgeStep2Write() {
    if (!activeCanvas2 || activeCanvas2.isEmpty()) {
      _showResult('step2-result', false, '何も書かれていないよ！');
      return;
    }
    _setLoading(true);
    const base64 = activeCanvas2.toBase64();
    const result = await OCR.recognize(base64);
    _setLoading(false);

    if (!result.success && result.error === 'no_api_key') { _showApiKeyModal(); return; }

    const judgment = OCR.judgeStep2(result.text, currentPref);
    Progress.recordAttempt(currentUserId, currentPref.id, 2, judgment.correct);
    _handleStep2Result(judgment);
  }

  function _buildChoices() {
    const container = document.getElementById('step2-choices');
    container.innerHTML = '';
    const correct = currentPref.capital;
    // ランダムに3つの間違い選択肢を選ぶ
    const wrong = PREFECTURES
      .filter(p => p.id !== currentPref.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(p => p.capital);
    const all = [...wrong, correct].sort(() => Math.random() - 0.5);

    all.forEach(cap => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.textContent = cap;
      btn.addEventListener('click', () => {
        const isCorrect = cap === correct;
        Progress.recordAttempt(currentUserId, currentPref.id, 2, isCorrect);
        container.querySelectorAll('.choice-btn').forEach(b => {
          b.disabled = true;
          if (b.textContent === correct) b.classList.add('correct');
          else if (b === btn && !isCorrect) b.classList.add('wrong');
        });
        _handleStep2Result({ correct: isCorrect, score: isCorrect ? 100 : 0, message: isCorrect ? 'せいかい！' : `ざんねん！正解は「${correct}」です！` });
      });
      container.appendChild(btn);
    });
  }

  function _handleStep2Result(judgment) {
    _showResult('step2-result', judgment.correct, judgment.correct ? `🎉 ${judgment.message}` : `😣 ${judgment.message}`);

    if (judgment.correct) {
      Speech.speakCorrect();
      _triggerConfetti();
      // 県庁所在地の情報を表示
      const info = document.getElementById('step2-capital-info');
      info.classList.remove('hidden');
      document.getElementById('step2-capital-name').textContent = currentPref.capital;
      document.getElementById('step2-capital-desc').textContent =
        `${currentPref.capital}は${currentPref.name}の県庁所在地です。よみかたは「${currentPref.capitalReading}」。`;
      Speech.speakCapital(currentPref);
      setTimeout(() => { if (onComplete) onComplete('step2'); }, 2500);
    } else {
      Speech.speakWrong();
    }
  }

  // ============================================================
  // 共通ユーティリティ
  // ============================================================
  function _showResult(elId, isCorrect, html) {
    const el = document.getElementById(elId);
    el.classList.remove('hidden');
    el.className = `result-area ${isCorrect ? 'result-correct' : 'result-wrong'}`;
    el.innerHTML = html;
  }

  function _setLoading(show) {
    document.getElementById('loading-overlay').classList.toggle('hidden', !show);
  }

  function _showApiKeyModal() {
    document.getElementById('api-setup-modal').classList.remove('hidden');
  }

  function _triggerConfetti() {
    if (window.Confetti) window.Confetti.start();
  }

  return { initStep1, initStep2 };
})();
