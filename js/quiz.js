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
  function initStep1(pref, userId, completeCb, isHardMode = false) {
    currentPref = pref;
    currentUserId = userId;
    failCount = 0;
    onComplete = completeCb;

    const isWorld = pref.region === 'world';

    const speechBubble = document.querySelector('.speech-bubble');
    if (speechBubble) {
      if (isWorld) {
        speechBubble.innerHTML = `<strong>よみかた：</strong><span id="step1-pref-display" style="font-size:1.2em;color:#7C4DFF;font-weight:900;">？？？</span><br>この国を<strong>カタカナ</strong>で書いてみよう！📝`;
      } else {
        speechBubble.innerHTML = `<strong>よみかた：</strong><span id="step1-pref-display" style="font-size:1.2em;color:#7C4DFF;font-weight:900;">${isHardMode ? '？？？' : pref.reading}</span><br>この都道府県を<strong>漢字</strong>で書いてみよう！📝`;
      }
    } else {
      // フォールバック
      if (isHardMode || isWorld) {
        document.getElementById('step1-pref-display').textContent = '？？？';
      } else {
        document.getElementById('step1-pref-display').textContent = pref.reading;
      }
    }

    // ミニマップ初期化
    JapanMap.initMini('mini-map-step1', pref);

    const handleStrokeStart = () => {
      // 書き始めたら前回の「ざんねん」メッセージを消す
      document.getElementById('step1-result').classList.add('hidden');
    };

    // キャンバス初期化
    if (activeCanvas) { activeCanvas = null; }
    activeCanvas = new HandwritingCanvas('writing-canvas', { 
      penSize: 14,
      onStrokeStart: handleStrokeStart
    });

    // ツールバー
    document.getElementById('pen-size').addEventListener('input', e => {
      activeCanvas.setPenSize(e.target.value);
    });
    document.getElementById('canvas-clear-btn').addEventListener('click', () => {
      activeCanvas.clear();
      document.getElementById('step1-result').classList.add('hidden');
    });
    document.getElementById('canvas-undo-btn').addEventListener('click', () => {
      activeCanvas.undo();
    });

    // 音声で問題を読む
    if (isWorld) {
      Speech.speakQuestion(`地図の赤い場所はどの国かな？カタカナで書いてみよう！`);
    } else if (isHardMode) {
      Speech.speakQuestion(`地図の赤い場所はどこかな？漢字で書いてみよう！`);
    } else {
      Speech.speakQuestion(`この都道府県の名前を漢字で書いてみよう！ヒント、読み方は「${pref.reading}」です。`);
    }

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
    newBtn.addEventListener('click', () => {
      _judgeStep1(false);
    });

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

  let isJudging = false;

  async function _judgeStep1(isAuto = false) {
    if (isJudging) return;
    if (!activeCanvas || activeCanvas.isEmpty()) {
      if (!isAuto) {
        _showResult('step1-result', false, '何も書かれていないよ！書いてから判定しよう！');
        Speech.speak('何も書かれていないよ！書いてから判定しよう！');
      }
      return;
    }
    
    isJudging = true;
    if (!isAuto) _setLoading(true);
    
    // 自動判定のときは「認識中...」を小さく表示
    if (isAuto) {
      _showResult('step1-result', false, '🤔 文字を認識中...');
      document.getElementById('step1-result').classList.remove('result-wrong');
      document.getElementById('step1-result').style.color = '#666';
      document.getElementById('step1-result').style.backgroundColor = 'transparent';
    }

    const base64 = activeCanvas.toBase64();
    const result = await OCR.recognize(base64);
    
    isJudging = false;
    if (!isAuto) _setLoading(false);

    if (!result.success && result.error === 'no_api_key') {
      if (!isAuto) _showApiKeyModal();
      else document.getElementById('step1-result').classList.add('hidden');
      return;
    }

    if (isAuto && !result.text.trim()) {
      document.getElementById('step1-result').classList.add('hidden');
      return;
    }

    // スタイルのリセット
    document.getElementById('step1-result').style.color = '';
    document.getElementById('step1-result').style.backgroundColor = '';

    const judgment = OCR.judgeStep1(result.text, currentPref);

    if (judgment.correct) {
      Progress.recordAttempt(currentUserId, currentPref.id, 1, true);
      _showResult('step1-result', true, `🎉 ${judgment.message}<br>「<strong>${currentPref.name}</strong>」が書けたね！`);
      Speech.speakCorrect();
      _triggerConfetti();
      setTimeout(() => {
        if (onComplete) onComplete('step1');
      }, 2000);
    } else {
      if (!isAuto) {
        failCount++;
        Progress.recordAttempt(currentUserId, currentPref.id, 1, false);
        _showResult('step1-result', false, `😣 ${judgment.message}`);
        Speech.speakWrong();
        if (failCount >= 2) document.getElementById('show-hint-btn').classList.remove('hidden');
        if (failCount >= 4) document.getElementById('show-answer-btn').classList.remove('hidden');
        if (judgment.hint) Speech.speakHint(judgment.hint);
      } else {
        // 自動判定で間違っていた場合は、静かに認識結果だけ出す（書き続けさせる）
        _showResult('step1-result', false, `👀 認識中...「${result.text}」`);
        document.getElementById('step1-result').classList.remove('result-wrong');
        document.getElementById('step1-result').style.color = '#888';
        document.getElementById('step1-result').style.backgroundColor = 'transparent';
      }
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

    let autoJudgeTimer2 = null;
    const handleStrokeStart2 = () => {
      if (autoJudgeTimer2) clearTimeout(autoJudgeTimer2);
      document.getElementById('step2-result').classList.add('hidden');
    };
    
    const handleStrokeEnd2 = () => {
      if (autoJudgeTimer2) clearTimeout(autoJudgeTimer2);
      autoJudgeTimer2 = setTimeout(() => {
        _judgeStep2Write(true);
      }, 1000); // 1秒で自動判定
    };

    // キャンバス初期化
    if (activeCanvas2) { activeCanvas2 = null; }
    activeCanvas2 = new HandwritingCanvas('writing-canvas-2', { 
      penSize: 14,
      onStrokeStart: handleStrokeStart2,
      onStrokeEnd: handleStrokeEnd2
    });

    document.getElementById('pen-size-2').addEventListener('input', e => {
      activeCanvas2.setPenSize(e.target.value);
    });
    document.getElementById('canvas2-clear-btn').addEventListener('click', () => {
      activeCanvas2.clear();
      if (autoJudgeTimer2) clearTimeout(autoJudgeTimer2);
      document.getElementById('step2-result').classList.add('hidden');
    });
    document.getElementById('canvas2-undo-btn').addEventListener('click', () => {
      activeCanvas2.undo();
      if (autoJudgeTimer2) clearTimeout(autoJudgeTimer2);
      handleStrokeEnd2();
    });

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
    newBtn2.addEventListener('click', () => {
      if (autoJudgeTimer2) clearTimeout(autoJudgeTimer2);
      _judgeStep2Write(false);
    });

    // 選択肢を生成
    _buildChoices();

    Speech.speakQuestion(`${pref.name}の県庁所在地はどこかな？`);
  }

  let isJudging2 = false;

  async function _judgeStep2Write(isAuto = false) {
    if (isJudging2) return;
    if (!activeCanvas2 || activeCanvas2.isEmpty()) {
      if (!isAuto) _showResult('step2-result', false, '何も書かれていないよ！');
      return;
    }
    
    isJudging2 = true;
    if (!isAuto) _setLoading(true);
    
    if (isAuto) {
      _showResult('step2-result', false, '🤔 文字を認識中...');
      document.getElementById('step2-result').classList.remove('result-wrong');
      document.getElementById('step2-result').style.color = '#666';
      document.getElementById('step2-result').style.backgroundColor = 'transparent';
    }

    const base64 = activeCanvas2.toBase64();
    const result = await OCR.recognize(base64);
    
    isJudging2 = false;
    if (!isAuto) _setLoading(false);

    if (!result.success && result.error === 'no_api_key') {
      if (!isAuto) _showApiKeyModal();
      else document.getElementById('step2-result').classList.add('hidden');
      return;
    }

    if (isAuto && !result.text.trim()) {
      document.getElementById('step2-result').classList.add('hidden');
      return;
    }

    document.getElementById('step2-result').style.color = '';
    document.getElementById('step2-result').style.backgroundColor = '';

    const judgment = OCR.judgeStep2(result.text, currentPref);
    
    if (judgment.correct) {
      Progress.recordAttempt(currentUserId, currentPref.id, 2, true);
      _handleStep2Result(judgment);
    } else {
      if (!isAuto) {
        Progress.recordAttempt(currentUserId, currentPref.id, 2, false);
        _handleStep2Result(judgment);
      } else {
        _showResult('step2-result', false, `👀 認識中...「${result.text}」`);
        document.getElementById('step2-result').classList.remove('result-wrong');
        document.getElementById('step2-result').style.color = '#888';
        document.getElementById('step2-result').style.backgroundColor = 'transparent';
      }
    }
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
