// ============================================================
// js/app.js - メインアプリケーション・ルーター
// ============================================================

// グローバルルーター（dashboard.jsからもアクセス可能）
window.AppRouter = null;

document.addEventListener('DOMContentLoaded', () => {
  // ============================================================
  // 初期化
  // ============================================================
  Speech.init();

  let currentUser = null;
  let selectedPref = null;
  let currentRandomStep = null; // ランダムモード中なら1, 2, 3のいずれか
  let currentMapMode = 'japan'; // 'japan' または 'world'

  // ビューのリスト
  const VIEWS = ['view-login', 'view-home', 'view-step1', 'view-step2', 'view-step3', 'view-dashboard'];

  function showView(id, keepHeader = false) {
    VIEWS.forEach(v => document.getElementById(v)?.classList.add('hidden'));
    document.getElementById(id)?.classList.remove('hidden');
    // ヘッダー表示制御
    const backBtn = document.getElementById('back-btn');
    const header = document.getElementById('app-header');
    if (id === 'view-login') {
      header.classList.add('hidden');
    } else {
      header.classList.remove('hidden');
      const isHome = id === 'view-home';
      backBtn.classList.toggle('hidden', isHome || id === 'view-dashboard');
    }
  }

  // ============================================================
  // ルーター（グローバルに公開）
  // ============================================================
  window.AppRouter = {
    goPortal: () => {
      showView('view-portal');
      document.getElementById('header-title-text').textContent = 'まなぼう！47都道府県';
      selectedPref = null;
    },
    goHome: () => {
      showView('view-home');
      document.getElementById('header-title-text').textContent = currentMapMode === 'japan' ? '🗾 地図からえらぶ' : '🌍 地図からえらぶ';
      if (currentMapMode === 'japan') {
        JapanMap.updateColors();
      } else {
        WorldMap.updateColors();
      }
      _updateHeaderStats();
      selectedPref = null;
      document.getElementById('pref-panel').classList.add('hidden');
    },
    goPref: (pref) => {
      selectedPref = pref;
      _openPrefPanel(pref);
    },
    goStep1: (pref, isHardMode = false) => {
      selectedPref = pref;
      showView('view-step1');
      const isWorld = pref.region === 'world';
      const actionText = isWorld ? 'カタカナで書こう' : '漢字で書こう';
      document.getElementById('header-title-text').textContent = isHardMode ? `😈 ${pref.name}を書こう（ノーヒント）` : `✍️ ${pref.name}を${actionText}`;
      Quiz.initStep1(pref, currentUser.id, (step) => {
        _onStepComplete(step);
      }, isHardMode);
    },
    goStep2: (pref) => {
      selectedPref = pref;
      showView('view-step2');
      document.getElementById('header-title-text').textContent = `🏛️ ${pref.name}の県庁所在地`;
      Quiz.initStep2(pref, currentUser.id, (step) => {
        _onStepComplete(step);
      });
    },
    goStep3: (pref, autoSwitchTab = 'products') => {
      selectedPref = pref;
      showView('view-step3');
      document.getElementById('header-title-text').textContent = `📚 ${pref.name}を知ろう`;
      Content.init(pref, currentUser.id, (step) => {
        _onStepComplete(step);
      }, autoSwitchTab);
    },
    goDashboard: () => {
      showView('view-dashboard');
      document.getElementById('header-title-text').textContent = '📊 学習ダッシュボード';
      Dashboard.show(currentUser.id);
    },
  };

  // ============================================================
  // ログイン
  // ============================================================
  const existingProfile = Auth.getActiveProfile();
  if (existingProfile) {
    _onLogin(existingProfile);
  } else {
    showView('view-login');
    showLoginScreen(_onLogin);
  }

  function _onLogin(profile) {
    currentUser = profile;
    document.getElementById('view-login').classList.add('hidden');
    JapanMap.setUser(profile.id);
    document.getElementById('current-user-name').innerHTML = `<span class="user-avatar">${profile.avatar}</span> ${profile.name}`;
    document.getElementById('app-header').classList.remove('hidden');
    _updateHeaderStats();
    Speech.speak(`${profile.name}さん、こんにちは！今日もがんばろう！`);
    window.AppRouter.goPortal(); // ログイン後はポータルへ
  }

  // ============================================================
  // ポータル画面・ホーム画面 - モード切替とナビゲーション
  // ============================================================
  document.getElementById('portal-map-japan')?.addEventListener('click', () => {
    if (currentMapMode === 'japan') return;
    currentMapMode = 'japan';
    document.getElementById('portal-map-japan').classList.add('active');
    document.getElementById('portal-map-world').classList.remove('active');
    document.getElementById('region-tabs').classList.remove('hidden');
    _initMap();
  });

  document.getElementById('portal-map-world')?.addEventListener('click', () => {
    if (currentMapMode === 'world') return;
    currentMapMode = 'world';
    document.getElementById('portal-map-world').classList.add('active');
    document.getElementById('portal-map-japan').classList.remove('active');
    document.getElementById('region-tabs').classList.add('hidden');
    _initMap();
  });

  // ポータルボタン
  document.getElementById('portal-btn-map')?.addEventListener('click', () => {
    window.AppRouter.goHome();
  });
  document.getElementById('portal-btn-random')?.addEventListener('click', () => {
    document.getElementById('random-setup-modal').classList.remove('hidden');
  });
  document.getElementById('portal-btn-challenge')?.addEventListener('click', () => {
    document.getElementById('challenge-setup-modal').classList.remove('hidden');
  });
  document.getElementById('portal-btn-dashboard')?.addEventListener('click', () => {
    window.AppRouter.goDashboard();
  });

  // ヘッダーロゴクリックでポータルへ
  document.getElementById('header-logo-btn')?.addEventListener('click', () => {
    window.AppRouter.goPortal();
  });

  function _initMap() {
    if (currentMapMode === 'japan') {
      JapanMap.init('japan-map', currentUser?.id, (pref) => {
        _openPrefPanel(pref);
      });
    } else {
      WorldMap.init('japan-map', currentUser?.id, (country) => {
        _openPrefPanel(country);
      });
    }
  }

  // 都道府県パネルを開く
  function _openPrefPanel(pref) {
    selectedPref = pref;
    showView('view-home');

    const panel = document.getElementById('pref-panel');
    panel.classList.remove('hidden');
    panel.classList.add('slide-in');

    document.getElementById('pref-emoji').textContent = pref.emoji;
    document.getElementById('pref-name').textContent = pref.name;
    document.getElementById('pref-reading').textContent = pref.reading;

    // ステップ達成状況表示
    const status = Progress.getPrefStatus(currentUser.id, pref.id);
    _updateStepIndicators(status);

    // 世界地図モードの場合はStep2とStep3を非表示にする
    if (currentMapMode === 'world') {
      document.getElementById('start-step2-btn').classList.add('hidden');
      document.getElementById('start-step3-btn').classList.add('hidden');
      document.getElementById('step-ind-2').classList.add('hidden');
      document.getElementById('step-ind-3').classList.add('hidden');
      document.querySelectorAll('.step-connector').forEach(el => el.classList.add('hidden'));
    } else {
      document.getElementById('start-step2-btn').classList.remove('hidden');
      document.getElementById('start-step3-btn').classList.remove('hidden');
      document.getElementById('step-ind-2').classList.remove('hidden');
      document.getElementById('step-ind-3').classList.remove('hidden');
      document.querySelectorAll('.step-connector').forEach(el => el.classList.remove('hidden'));
    }

    // 音声で読む
    Speech.speakPrefName(pref);
  }

  function _updateStepIndicators(status) {
    for (let i = 1; i <= 3; i++) {
      const ind = document.getElementById(`step-ind-${i}`);
      if (!ind) continue;
      const done = status[`step${i}`];
      ind.classList.toggle('step-done', done);
      ind.querySelector('.step-circle').textContent = done ? '✅' : ['✍️', '🏛️', '📚'][i - 1];
    }
  }

  // ============================================================
  // 地方タブ
  // ============================================================
  document.querySelectorAll('.region-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.region-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      JapanMap.filterByRegion(tab.dataset.region);
    });
  });

  // ============================================================
  // Step選択ボタン
  // ============================================================
  document.getElementById('start-step1-btn').addEventListener('click', () => {
    if (selectedPref) window.AppRouter.goStep1(selectedPref);
  });
  document.getElementById('start-step2-btn').addEventListener('click', () => {
    if (selectedPref) window.AppRouter.goStep2(selectedPref);
  });
  document.getElementById('start-step3-btn').addEventListener('click', () => {
    if (selectedPref) window.AppRouter.goStep3(selectedPref);
  });

  // パネルを閉じる
  document.getElementById('panel-close-btn').addEventListener('click', () => {
    document.getElementById('pref-panel').classList.add('hidden');
    selectedPref = null;
  });

  // 記録のリセット
  document.getElementById('pref-reset-btn')?.addEventListener('click', () => {
    if (!selectedPref || !currentUser) return;
    if (confirm(`${selectedPref.name} の学習記録をリセットして最初からやり直しますか？`)) {
      Progress.resetPrefecture(currentUser.id, selectedPref.id);
      _openPrefPanel(selectedPref); // パネルの表示を更新
      JapanMap.updateColors(); // 地図の色を更新
      _updateHeaderStats(); // ヘッダーの進捗を更新
      Speech.speak(`${selectedPref.name}の記録をリセットしました！もう一度がんばろう！`);
    }
  });

  // 戻るボタン
  document.getElementById('back-btn').addEventListener('click', () => {
    Speech.stop();
    currentRandomStep = null; // ランダムモード解除
    if (selectedPref) {
      window.AppRouter.goHome();
      setTimeout(() => _openPrefPanel(selectedPref), 100);
    } else {
      window.AppRouter.goHome();
    }
  });

  // ダッシュボードボタン
  document.getElementById('dashboard-btn').addEventListener('click', () => {
    window.AppRouter.goDashboard();
  });
  document.getElementById('back-from-dash-btn')?.addEventListener('click', () => {
    window.AppRouter.goHome();
  });

  // 音声ON/OFFボタン
  document.getElementById('sound-toggle-btn').addEventListener('click', () => {
    const enabled = !Speech.isEnabled();
    Speech.setEnabled(enabled);
    document.getElementById('sound-toggle-btn').textContent = enabled ? '🔊' : '🔇';
    document.getElementById('sound-toggle-btn').title = enabled ? '音声ON' : '音声OFF';
  });

  // プロフィール切替
  document.getElementById('switch-user-btn')?.addEventListener('click', () => {
    Speech.stop();
    Auth.setActiveProfile(null);
    showView('view-login');
    showLoginScreen(_onLogin);
  });

  // ============================================================
  // APIキー設定モーダル
  // ============================================================
  document.getElementById('save-api-key-btn').addEventListener('click', () => {
    const key = document.getElementById('api-key-input').value.trim();
    if (!key) { alert('APIキーを入力してください'); return; }
    localStorage.setItem('vision_api_key', key);
    if (typeof CONFIG !== 'undefined') CONFIG.VISION_API_KEY = key;
    document.getElementById('api-setup-modal').classList.add('hidden');
    Speech.speak('APIキーを保存しました！これで手書き判定が使えます！');
  });
  document.getElementById('skip-api-key-btn').addEventListener('click', () => {
    document.getElementById('api-setup-modal').classList.add('hidden');
    Speech.speak('あとでAPIキーを設定できます。設定ボタンから入力してね！');
  });

  // ============================================================
  // ステップ完了ハンドラ
  // ============================================================
  function _onStepComplete(step) {
    if (currentRandomStep === 'challenge') {
      Speech.playSuccessSound();
      challengeScore++;
      challengeCurrentIndex++;
      // Wait a moment so user can see "Correct!" before jumping
      setTimeout(() => {
        nextChallengeQuestion();
      }, 1500);
      return; // Skip success overlay!
    } else {
      _showSuccessOverlay(step);
    }
    if (currentMapMode === 'japan') {
      JapanMap.updateColors();
    } else {
      WorldMap.updateColors();
    }
    _updateHeaderStats();
  }

  function _showSuccessOverlay(step) {
    const overlay = document.getElementById('success-overlay');
    overlay.classList.remove('hidden');
    const msgs = {
      step1: { title: 'Step1 クリア！🎉', msg: `${selectedPref?.name}の漢字が書けるようになったね！` },
      step2: { title: 'Step2 クリア！🏛️', msg: `${selectedPref?.capital}を覚えたね！` },
      step3: { title: 'Step3 クリア！📚', msg: `${selectedPref?.name}のすべてを学んだよ！すごい！` },
    };
    const data = msgs[step] || { title: 'クリア！', msg: 'よくできました！' };
    document.getElementById('success-title').textContent = data.title;
    document.getElementById('success-message').textContent = data.msg;
    
    // 効果音と「やったね！」ボイス
    Speech.playSuccessSound();
    Speech.speak(`やったね！${data.title}。${data.msg}`, { pitch: 1.2, rate: 1.0 });
    
    _triggerConfetti();

    // 継続ボタンの入れ替え（イベントリスナー重複防止）
    const btn = document.getElementById('success-continue-btn');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => {
      overlay.classList.add('hidden');
      currentRandomStep = null;
      window.AppRouter.goHome();
    });

    // ランダムテスト用「次へ」ボタンの表示制御
    const randBtn = document.getElementById('success-random-btn');
    if (currentRandomStep) {
      randBtn.classList.remove('hidden');
      const newRandBtn = randBtn.cloneNode(true);
      randBtn.parentNode.replaceChild(newRandBtn, randBtn);
      newRandBtn.addEventListener('click', () => {
        overlay.classList.add('hidden');
        startRandomTest(currentRandomStep);
      });
    } else {
      randBtn.classList.add('hidden');
    }
  }

  // ============================================================
  // ランダムテスト機能
  // ============================================================
  document.getElementById('open-random-modal-btn')?.addEventListener('click', () => {
    document.getElementById('random-setup-modal').classList.remove('hidden');
  });
  document.getElementById('close-random-modal-btn')?.addEventListener('click', () => {
    document.getElementById('random-setup-modal').classList.add('hidden');
  });

  document.getElementById('btn-rand-step1')?.addEventListener('click', () => {
    document.getElementById('random-setup-modal').classList.add('hidden');
    startRandomTest(1);
  });
  document.getElementById('btn-rand-step1-hard')?.addEventListener('click', () => {
    document.getElementById('random-setup-modal').classList.add('hidden');
    startRandomTest('1-hard');
  });
  document.getElementById('btn-rand-step2')?.addEventListener('click', () => {
    document.getElementById('random-setup-modal').classList.add('hidden');
    startRandomTest(2);
  });
  document.getElementById('btn-rand-step3')?.addEventListener('click', () => {
    document.getElementById('random-setup-modal').classList.add('hidden');
    startRandomTest(3);
  });

  function startRandomTest(stepNum) {
    currentRandomStep = stepNum;
    const targetList = currentMapMode === 'japan' ? PREFECTURES : COUNTRIES;
    const randomIndex = Math.floor(Math.random() * targetList.length);
    const pref = targetList[randomIndex];
    if (stepNum === 1) window.AppRouter.goStep1(pref, false);
    else if (stepNum === '1-hard') window.AppRouter.goStep1(pref, true);
    else if (stepNum === 2 && currentMapMode === 'japan') window.AppRouter.goStep2(pref);
    else if (stepNum === 3 && currentMapMode === 'japan') window.AppRouter.goStep3(pref);
  }

  // ============================================================
  // チャレンジ機能 (サバイバル & 全国一周)
  // ============================================================
  let challengeInterval = null;
  let challengeStartTime = 0;
  let challengeQueue = [];
  let challengeCurrentIndex = 0;
  let challengeMode = ''; // 'survival' | 'tour'
  let challengeType = ''; // 'kanji' | 'quiz'
  let challengeScore = 0;
  let challengeTimeRemaining = 60;
  
  function startChallenge(mode, type) {
    document.getElementById('challenge-setup-modal').classList.add('hidden');
    challengeMode = mode;
    challengeType = type;
    challengeScore = 0;
    challengeTimeRemaining = 60;

    const targetList = currentMapMode === 'japan' ? PREFECTURES : COUNTRIES;
    const shuffled = [...targetList].sort(() => 0.5 - Math.random());
    challengeQueue = shuffled;
    challengeCurrentIndex = 0;
    
    document.getElementById('challenge-header').classList.remove('hidden');
    document.getElementById('challenge-timer').classList.remove('hidden');
    
    challengeStartTime = Date.now();
    challengeInterval = setInterval(() => {
      if (challengeMode === 'survival') {
        challengeTimeRemaining -= 0.1;
        if (challengeTimeRemaining <= 0) {
          challengeTimeRemaining = 0;
          document.getElementById('challenge-timer').textContent = `⏱️ 0.0秒`;
          finishChallenge();
        } else {
          document.getElementById('challenge-timer').textContent = `⏱️ ${challengeTimeRemaining.toFixed(1)}秒`;
        }
      } else {
        const elapsed = Date.now() - challengeStartTime;
        document.getElementById('challenge-timer').textContent = `⏱️ ${(elapsed / 1000).toFixed(1)}秒`;
      }
    }, 100);
    
    nextChallengeQuestion();
  }

  function finishChallenge() {
    clearInterval(challengeInterval);
    document.getElementById('challenge-header').classList.add('hidden');
    
    const resModal = document.getElementById('random-result-modal');
    if (challengeMode === 'survival') {
      document.getElementById('random-result-title').textContent = 'タイムアップ！⏳';
      document.getElementById('random-result-desc').textContent = `結果: ${challengeScore}問 正解！`;
    } else {
      const elapsed = Date.now() - challengeStartTime;
      const best = Progress.recordTimeAttack(currentUser.id, elapsed); // 記録保存
      document.getElementById('random-result-title').textContent = '全国一周 クリア！🎌';
      document.getElementById('random-result-desc').textContent = `タイム: ${(elapsed / 1000).toFixed(1)}秒 (ベスト: ${(best / 1000).toFixed(1)}秒)`;
    }
    resModal.classList.remove('hidden');
    currentRandomStep = null;
  }

  function nextChallengeQuestion() {
    if (challengeCurrentIndex >= challengeQueue.length) {
      if (challengeMode === 'survival') {
        // 全問解き終わっても時間が余っていたらループする
        challengeQueue = [...challengeQueue].sort(() => 0.5 - Math.random());
        challengeCurrentIndex = 0;
      } else {
        finishChallenge();
        return;
      }
    }
    
    const pref = challengeQueue[challengeCurrentIndex];
    if (challengeMode === 'tour') {
      document.getElementById('challenge-counter').textContent = `${challengeCurrentIndex + 1} / ${challengeQueue.length}`;
    } else {
      document.getElementById('challenge-counter').textContent = `スコア: ${challengeScore}`;
    }
    
    const isWorld = pref.region === 'world';
    currentRandomStep = 'challenge';
    
    if (challengeType === 'kanji') {
      const actionText = isWorld ? 'カタカナで！' : '漢字で！';
      const readingText = isWorld ? 'この国' : pref.reading;
      document.getElementById('challenge-question').textContent = `✍️ 「${readingText}」を${actionText}`;
      // 世界モードは地図のみ（ノーヒント）
      window.AppRouter.goStep1(pref, false);
    } else if (challengeType === 'quiz') {
      document.getElementById('challenge-question').textContent = `🧩 クイズに答えよう！`;
      window.AppRouter.goStep3(pref, 'quiz');
    }
  }

  // チャレンジモーダル表示
  document.getElementById('btn-challenge-modal')?.addEventListener('click', () => {
    if (!currentUser) return;
    document.getElementById('challenge-setup-modal').classList.remove('hidden');
  });
  document.getElementById('close-challenge-modal-btn')?.addEventListener('click', () => {
    document.getElementById('challenge-setup-modal').classList.add('hidden');
  });

  // モードごとの開始ボタン
  document.getElementById('btn-chal-survival-kanji')?.addEventListener('click', () => startChallenge('survival', 'kanji'));
  document.getElementById('btn-chal-survival-quiz')?.addEventListener('click', () => startChallenge('survival', 'quiz'));
  document.getElementById('btn-chal-tour-kanji')?.addEventListener('click', () => startChallenge('tour', 'kanji'));
  document.getElementById('btn-chal-tour-quiz')?.addEventListener('click', () => startChallenge('tour', 'quiz'));

  document.getElementById('btn-cancel-challenge')?.addEventListener('click', () => {
    clearInterval(challengeInterval);
    document.getElementById('challenge-header').classList.add('hidden');
    currentRandomStep = null;
    window.AppRouter.goHome();
  });

  document.getElementById('btn-close-random-result')?.addEventListener('click', () => {
    document.getElementById('random-result-modal').classList.add('hidden');
    currentRandomStep = null;
    window.AppRouter.goHome();
  });

  // ============================================================
  // バッジ（称号）機能
  // ============================================================
  document.getElementById('btn-badges')?.addEventListener('click', () => {
    if (!currentUser) return;
    const badges = Progress.getBadges(currentUser.id);
    const badgeList = document.getElementById('badge-list');
    badgeList.innerHTML = '';
    badges.forEach(b => {
      const div = document.createElement('div');
      div.className = `badge-item ${b.earned ? 'earned' : 'locked'}`;
      div.innerHTML = `
        <div class="badge-icon">${b.icon}</div>
        <div class="badge-name">${b.name}</div>
        <div class="badge-desc">${b.desc}</div>
      `;
      badgeList.appendChild(div);
    });
    document.getElementById('badge-modal').classList.remove('hidden');
  });

  document.getElementById('btn-close-badges')?.addEventListener('click', () => {
    document.getElementById('badge-modal').classList.add('hidden');
  });

  function _updateHeaderStats() {
    if (!currentUser) return;
    const stats = Progress.getStats(currentUser.id);
    document.getElementById('progress-badge').textContent = `⭐ ${stats.completed1}/47`;
  }

  // ============================================================
  // コンフェッティ（紙吹雪）
  // ============================================================
  window.Confetti = {
    start: () => {
      const canvas = document.getElementById('confetti-canvas');
      if (!canvas) return;
      canvas.style.display = 'block';
      const ctx = canvas.getContext('2d');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const particles = Array.from({length: 80}, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        vx: (Math.random() - 0.5) * 3,
        vy: Math.random() * 4 + 2,
        color: ['#FF6B9D','#7C4DFF','#FFD93D','#4ECDC4','#6BCB77'][Math.floor(Math.random() * 5)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 6,
      }));
      let frame = 0;
      const MAX_FRAMES = 120;
      function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
          p.x += p.vx; p.y += p.vy; p.rotation += p.rotationSpeed;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation * Math.PI / 180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size * 0.6);
          ctx.restore();
        });
        frame++;
        if (frame < MAX_FRAMES) requestAnimationFrame(animate);
        else { ctx.clearRect(0,0,canvas.width,canvas.height); canvas.style.display='none'; }
      }
      animate();
    }
  };

  function _triggerConfetti() { window.Confetti.start(); }

  // ============================================================
  // ウィンドウリサイズ対応
  // ============================================================
  window.addEventListener('resize', () => {
    if (document.getElementById('view-home') && !document.getElementById('view-home').classList.contains('hidden')) {
      JapanMap.init('japan-map', currentUser?.id, (pref) => _openPrefPanel(pref));
    }
  });

  // ============================================================
  // 地図の初期化（ホーム表示後）
  // ============================================================
  // 少し遅らせてからロード（ログインアニメーション後）
  setTimeout(() => {
    if (currentUser) _initMap();
  }, 300);

  // APIキーをlocalStorageから復元
  const savedKey = localStorage.getItem('vision_api_key');
  if (savedKey && typeof CONFIG !== 'undefined' && !CONFIG.VISION_API_KEY) {
    CONFIG.VISION_API_KEY = savedKey;
  }

  // ヘッダー統計を初期表示
  setTimeout(_updateHeaderStats, 500);
});
