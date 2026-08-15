// ============================================================
// js/content.js - Step3: 名産品・歴史（解説付き）・観光地カード
// ============================================================

const Content = (() => {
  let currentPref = null;
  let currentUserId = null;
  let readCards = new Set();
  let quizScore = 0;
  let onComplete = null;

  // タブ状態
  let activeTab = 'products';

  function init(pref, userId, completeCb) {
    currentPref = pref;
    currentUserId = userId;
    onComplete = completeCb;
    readCards.clear();
    quizScore = 0;
    activeTab = 'products';

    document.getElementById('step3-pref-title').textContent = pref.name;
    document.getElementById('step3-pref-emoji').textContent = pref.emoji;
    document.getElementById('step3-pref-emoji').title = pref.name;

    Speech.speak(`${pref.name}について学ぼう！`);

    _renderProducts();
    _renderHistory();
    _renderSightseeing();
    _renderQuiz();
    _bindTabs();
  }

  // ============================================================
  // タブ切替
  // ============================================================
  function _bindTabs() {
    document.querySelectorAll('.content-tab').forEach(tab => {
      const newTab = tab.cloneNode(true);
      tab.parentNode.replaceChild(newTab, tab);
      newTab.addEventListener('click', () => {
        document.querySelectorAll('.content-tab').forEach(t => t.classList.remove('active'));
        newTab.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        const target = document.getElementById(`tab-${newTab.dataset.tab}`);
        if (target) { target.classList.remove('hidden'); target.classList.add('active'); }
        activeTab = newTab.dataset.tab;
        if (activeTab === 'products') Speech.speak(`${currentPref.name}の名産品を見てみよう！`);
        if (activeTab === 'history') Speech.speak(`${currentPref.name}の歴史を学ぼう！`);
        if (activeTab === 'sightseeing') Speech.speak(`${currentPref.name}の観光地を見てみよう！`);
        if (activeTab === 'quiz') Speech.speak(`クイズにチャレンジしよう！`);
      });
    });
  }

  // ============================================================
  // 名産品カード
  // ============================================================
  function _renderProducts() {
    const container = document.getElementById('products-cards');
    container.innerHTML = '';

    currentPref.products.forEach((product, i) => {
      const card = document.createElement('div');
      card.className = 'product-card anime-card';
      card.style.animationDelay = `${i * 0.1}s`;
      card.innerHTML = `
        <div class="product-emoji">${product.emoji}</div>
        <div class="product-info">
          <h3 class="product-name">${product.name}</h3>
          <p class="product-desc">${product.desc}</p>
        </div>
        <button class="speak-btn" title="読み上げ" data-text="${product.name}。${product.desc}">🔊</button>
      `;
      card.querySelector('.speak-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        Speech.speak(e.currentTarget.dataset.text);
      });
      container.appendChild(card);
    });
  }

  // ============================================================
  // 歴史タイムライン（詳しい解説付き）
  // ============================================================
  function _renderHistory() {
    const container = document.getElementById('history-timeline');
    container.innerHTML = '';

    // まず「おおまかな歴史」紹介ブロック
    const intro = document.createElement('div');
    intro.className = 'history-intro-card';
    intro.innerHTML = `
      <div class="history-intro-inner">
        <div class="history-intro-icon">📜</div>
        <div>
          <h3>${currentPref.name}の歴史を学ぼう！</h3>
          <p style="font-size:0.9em;color:#666">時代の流れにそってできごとを見ていこう。クリックすると詳しい解説が見られるよ！</p>
        </div>
        <button class="speak-btn" data-text="${currentPref.name}の歴史を説明します。">🔊</button>
      </div>
    `;
    intro.querySelector('.speak-btn').addEventListener('click', e => {
      const text = currentPref.history.map(h => `${h.year}。${h.title}。${h.desc}`).join('。');
      Speech.speak(text, { rate: 0.8 });
    });
    container.appendChild(intro);

    // 各歴史イベント
    currentPref.history.forEach((h, i) => {
      const item = document.createElement('div');
      item.className = 'timeline-item';
      item.innerHTML = `
        <div class="timeline-left">
          <div class="timeline-year">${h.year}</div>
          <div class="timeline-line"></div>
        </div>
        <div class="timeline-right">
          <div class="timeline-card" data-index="${i}">
            <div class="timeline-header">
              <span class="timeline-num">${i + 1}</span>
              <h4 class="timeline-title">${h.title}</h4>
              <button class="speak-btn" title="読み上げ" data-text="${h.year}。${h.title}。${h.desc}">🔊</button>
            </div>
            <p class="timeline-desc">${h.desc}</p>
            <div class="timeline-detail hidden" id="detail-${i}">
              ${_buildHistoryDetail(h, currentPref)}
            </div>
            <button class="detail-toggle-btn" data-target="detail-${i}">
              📖 もっとくわしく見る ▼
            </button>
          </div>
        </div>
      `;
      // 読み上げ
      item.querySelector('.speak-btn').addEventListener('click', e => {
        e.stopPropagation();
        Speech.speak(e.currentTarget.dataset.text, { rate: 0.8 });
      });
      // 詳細展開
      item.querySelector('.detail-toggle-btn').addEventListener('click', e => {
        const targetId = e.currentTarget.dataset.target;
        const detail = document.getElementById(targetId);
        const isOpen = !detail.classList.contains('hidden');
        detail.classList.toggle('hidden');
        e.currentTarget.textContent = isOpen ? '📖 もっとくわしく見る ▼' : '📖 とじる ▲';
        if (!isOpen) {
          // 詳細を開いたときに音声で解説
          Speech.speak(`くわしく説明します。${h.title}について。${h.desc}`, { rate: 0.8 });
        }
      });
      container.appendChild(item);
    });
  }

  // 歴史の詳しい解説を生成
  function _buildHistoryDetail(h, pref) {
    // 時代ごとに背景説明を追加
    const era = _getEraInfo(h.year);
    const related = _getRelatedFacts(h, pref);
    return `
      <div class="detail-inner">
        ${era ? `<div class="detail-era">
          <span class="detail-label">⏰ 時代</span>
          <span>${era}</span>
        </div>` : ''}
        <div class="detail-context">
          <span class="detail-label">📚 くわしい説明</span>
          <p>${_expandDescription(h, pref)}</p>
        </div>
        ${related ? `<div class="detail-related">
          <span class="detail-label">🔗 関係すること</span>
          <p>${related}</p>
        </div>` : ''}
        <div class="detail-question">
          <span class="detail-label">🤔 考えてみよう！</span>
          <p class="think-question">${_getThinkQuestion(h, pref)}</p>
        </div>
      </div>
    `;
  }

  // 年号から時代を返す
  function _getEraInfo(year) {
    if (!year || year.includes('神話') || year.includes('昔話')) return '日本神話・昔話の時代';
    if (year.includes('紀元前')) return '弥生時代・縄文時代';
    const y = parseInt(year);
    if (isNaN(y)) {
      if (year.includes('江戸')) return '江戸時代（1603〜1868年）';
      if (year.includes('戦国')) return '戦国時代（15〜16世紀）';
      if (year.includes('平安')) return '平安時代（794〜1185年）';
      if (year.includes('鎌倉')) return '鎌倉時代（1185〜1333年）';
      if (year.includes('室町')) return '室町時代（1336〜1573年）';
      if (year.includes('明治')) return '明治時代（1868〜1912年）';
      if (year.includes('大正')) return '大正時代（1912〜1926年）';
      if (year.includes('昭和')) return '昭和時代（1926〜1989年）';
      return null;
    }
    if (y < 700) return '古墳時代・飛鳥時代（〜710年ごろ）';
    if (y < 794) return '奈良時代（710〜794年）';
    if (y < 1185) return '平安時代（794〜1185年）';
    if (y < 1333) return '鎌倉時代（1185〜1333年）';
    if (y < 1573) return '室町・南北朝時代（1333〜1573年）';
    if (y < 1603) return '安土桃山時代（1573〜1603年）';
    if (y < 1868) return '江戸時代（1603〜1868年）';
    if (y < 1912) return '明治時代（1868〜1912年）';
    if (y < 1926) return '大正時代（1912〜1926年）';
    if (y < 1989) return '昭和時代（1926〜1989年）';
    return '平成・令和時代（1989年〜）';
  }

  // 説明をより詳しく拡張
  function _expandDescription(h, pref) {
    const base = h.desc;
    // 文末に補足を追加
    const extras = {
      '幕府': '幕府とは、武士が政治を行う政府のことです。',
      '世界遺産': '世界遺産とは、ユネスコ（国連の機関）が「世界にとって大切な場所・もの」として認定したものです。',
      '原子爆弾': '原子爆弾は、広大な範囲を一瞬で壊す恐ろしい兵器です。二度と使われないよう、平和を願い続けることが大切です。',
      '明治維新': '明治維新とは、江戸幕府が終わり、日本が近代国家へと大きく変わった出来事です（1868年）。',
      '戊辰戦争': '戊辰戦争は、旧幕府側と明治新政府側が戦った内戦です（1868〜1869年）。',
      '開国': '開国とは、長く鎖国（外国との交流を制限）していた日本が、外国と交流を始めることです。',
    };
    let extended = base;
    Object.keys(extras).forEach(key => {
      if (base.includes(key) && !extended.includes(extras[key])) {
        extended += `<br><span class="mini-note">💬 ${extras[key]}</span>`;
      }
    });
    return extended;
  }

  // 関連する事実
  function _getRelatedFacts(h, pref) {
    const title = h.title + h.desc;
    if (title.includes('世界遺産')) return '世界遺産は、2024年現在、世界に1200件以上あります。日本には25件の世界遺産があります。';
    if (title.includes('原子爆弾') || title.includes('原爆')) return '日本は世界でただひとつ、戦争中に原子爆弾を使われた国です。だから日本は「核兵器をなくそう」と世界に伝え続けています。';
    if (title.includes('万博')) return '万博（万国博覧会）は、世界各国が技術・文化を紹介する大きなイベントです。2025年にも大阪で開催されます！';
    if (title.includes('オリンピック')) return 'オリンピックは4年ごとに開催される世界最大のスポーツの祭典です。日本は1964年（東京）、1998年（長野）でも開催しました。';
    if (title.includes('お寺') || title.includes('寺')) return 'お寺は仏教の施設です。仏教は6世紀ごろに中国や朝鮮を通じて日本に伝わりました。';
    if (title.includes('神社')) return '神社は神道の施設です。日本には約8万社の神社があります。';
    return null;
  }

  // 考える問いかけ
  function _getThinkQuestion(h, pref) {
    const title = h.title + h.desc;
    if (title.includes('原子爆弾') || title.includes('原爆') || title.includes('戦争')) {
      return 'なぜ平和が大切なのだと思いますか？もし自分が同じ時代に生きていたら、何をしたいと思いますか？';
    }
    if (title.includes('世界遺産')) return `なぜ「${pref.name}のこの場所」が世界遺産に選ばれたと思いますか？どんな価値があるのでしょう？`;
    if (title.includes('幕府') || title.includes('武将') || title.includes('城')) return `もし自分が武将だったら、どんなお城を建てたいですか？どんな国を作りたいですか？`;
    if (title.includes('オリンピック') || title.includes('万博')) return `大きなイベントが開かれると、その地域にはどんないいことがあると思いますか？`;
    return `この出来事が、今の${pref.name}や日本にどんな影響を与えていると思いますか？`;
  }

  // ============================================================
  // 観光地・楽しい豆知識
  // ============================================================
  function _renderSightseeing() {
    const listContainer = document.getElementById('sightseeing-list');
    listContainer.innerHTML = '';

    currentPref.sightseeing.forEach((spot, i) => {
      const item = document.createElement('div');
      item.className = 'sightseeing-item anime-card';
      item.style.animationDelay = `${i * 0.08}s`;
      item.innerHTML = `
        <div class="sightseeing-number">${i + 1}</div>
        <div class="sightseeing-text">${spot}</div>
        <button class="speak-btn" data-text="${spot}">🔊</button>
      `;
      item.querySelector('.speak-btn').addEventListener('click', e => Speech.speak(e.currentTarget.dataset.text));
      listContainer.appendChild(item);
    });

    // 豆知識カード
    const funFact = document.getElementById('fun-fact');
    funFact.innerHTML = `
      <div class="fun-fact-inner">
        <span class="fun-fact-icon">💡</span>
        <div class="fun-fact-content">
          <h4>知ってた？ ${currentPref.name}のびっくりポイント！</h4>
          <p>${currentPref.funFact}</p>
        </div>
        <button class="speak-btn" data-text="${currentPref.funFact}">🔊</button>
      </div>
    `;
    funFact.querySelector('.speak-btn').addEventListener('click', e => Speech.speak(e.currentTarget.dataset.text));
  }

  // ============================================================
  // クイズ（Step3確認）
  // ============================================================
  function _renderQuiz() {
    const container = document.getElementById('step3-quiz-container');
    container.innerHTML = '';
    const questions = _generateQuestions();
    let currentQ = 0;
    let score = 0;

    function renderQ() {
      if (currentQ >= questions.length) {
        _showQuizResult(container, score, questions.length);
        return;
      }
      const q = questions[currentQ];
      container.innerHTML = `
        <div class="quiz-progress">
          <div class="quiz-progress-bar" style="width:${(currentQ / questions.length) * 100}%"></div>
        </div>
        <div class="quiz-q-num">問題 ${currentQ + 1} / ${questions.length}</div>
        <div class="quiz-question-card">
          <button class="speak-btn quiz-speak" data-text="${q.question}">🔊 問題を聞く</button>
          <h3 class="quiz-question">${q.question}</h3>
          <div class="quiz-choices">
            ${q.choices.map((c, ci) => `
              <button class="quiz-choice-btn" data-answer="${c}" data-correct="${q.answer}">
                <span class="choice-letter">${['Ａ','Ｂ','Ｃ'][ci]}</span> ${c}
              </button>
            `).join('')}
          </div>
        </div>
      `;
      container.querySelector('.quiz-speak').addEventListener('click', e => Speech.speak(e.currentTarget.dataset.text));
      container.querySelectorAll('.quiz-choice-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const isCorrect = btn.dataset.answer === btn.dataset.correct;
          container.querySelectorAll('.quiz-choice-btn').forEach(b => {
            b.disabled = true;
            if (b.dataset.answer === b.dataset.correct) b.classList.add('correct');
            else if (b === btn && !isCorrect) b.classList.add('wrong');
          });
          if (isCorrect) { score++; Speech.speakCorrect(); }
          else Speech.speakWrong();
          Progress.recordAttempt(currentUserId, currentPref.id, 3, isCorrect);
          setTimeout(() => { currentQ++; renderQ(); }, 1500);
        });
      });
    }
    renderQ();
  }

  function _generateQuestions() {
    const pref = currentPref;
    const allPrefs = PREFECTURES.filter(p => p.id !== pref.id);
    const rand = arr => arr[Math.floor(Math.random() * arr.length)];
    const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

    const wrong2 = shuffle(allPrefs).slice(0, 2);

    return [
      {
        question: `${pref.name}の県庁所在地はどれ？`,
        answer: pref.capital,
        choices: shuffle([pref.capital, rand(wrong2).capital, rand(allPrefs.filter(p => !wrong2.includes(p))).capital]),
      },
      {
        question: `${pref.name}の名産品として正しいのはどれ？`,
        answer: pref.products[0].name,
        choices: shuffle([pref.products[0].name, rand(wrong2).products[0].name, rand(allPrefs.filter(p => !wrong2.includes(p))).products[0].name]),
      },
      {
        question: `「${pref.history[0].title}」は何年のできごと？`,
        answer: pref.history[0].year,
        choices: shuffle([
          pref.history[0].year,
          rand(allPrefs).history[0].year,
          rand(allPrefs.filter(p => !wrong2.includes(p))).history[0].year,
        ]),
      },
    ];
  }

  function _showQuizResult(container, score, total) {
    const percent = Math.round((score / total) * 100);
    const msg = percent === 100 ? '🎉 かんぺき！全問正解！' :
                percent >= 66 ? '😊 よくできました！' : '📖 もう一度学んでみよう！';
    container.innerHTML = `
      <div class="quiz-result-card">
        <div class="quiz-result-score">${score} / ${total}</div>
        <div class="quiz-result-percent">${percent}点</div>
        <p class="quiz-result-msg">${msg}</p>
        ${percent >= 66 ? `
          <button class="complete-btn" id="step3-complete-btn">
            ✅ ${currentPref.name}の学習 完了！
          </button>
        ` : `
          <button class="retry-btn" id="step3-retry-btn">🔄 もう一度チャレンジ</button>
        `}
      </div>
    `;
    if (percent >= 66) {
      Speech.speak(`${score}問正解！よくできました！`);
      _triggerConfetti();
      document.getElementById('step3-complete-btn')?.addEventListener('click', () => {
        Progress.completeStep3(currentUserId, currentPref.id);
        if (onComplete) onComplete('step3');
      });
    } else {
      Speech.speak(`${score}問正解でした。もう一度学んでみよう！`);
      document.getElementById('step3-retry-btn')?.addEventListener('click', () => _renderQuiz());
    }
  }

  function _triggerConfetti() {
    if (window.Confetti) window.Confetti.start();
  }

  return { init };
})();
