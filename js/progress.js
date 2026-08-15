// ============================================================
// js/progress.js - 進捗・正答率管理（ユーザーごと）
// ============================================================

const Progress = (() => {
  const STORAGE_KEY = 'pref_progress_v2';

  // データ読み込み
  function _load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch { return {}; }
  }

  // データ保存
  function _save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  // ユーザーの進捗データ取得
  function getUserProgress(userId) {
    const all = _load();
    if (!all[userId]) all[userId] = { prefectures: {}, stats: { lastActive: null, streak: 0, totalCorrect: 0, totalAttempts: 0 } };
    return all[userId];
  }

  // 都道府県のステップデータ取得
  function getPrefStep(userId, prefId, step) {
    const up = getUserProgress(userId);
    const key = `p${prefId}`;
    if (!up.prefectures[key]) up.prefectures[key] = {};
    if (!up.prefectures[key][`s${step}`]) {
      up.prefectures[key][`s${step}`] = { completed: false, attempts: 0, correct: 0, lastAttempt: null };
    }
    return up.prefectures[key][`s${step}`];
  }

  // 解答記録
  function recordAttempt(userId, prefId, step, isCorrect) {
    const all = _load();
    const up = getUserProgress(userId);
    const key = `p${prefId}`;
    if (!up.prefectures[key]) up.prefectures[key] = {};
    if (!up.prefectures[key][`s${step}`]) {
      up.prefectures[key][`s${step}`] = { completed: false, attempts: 0, correct: 0, lastAttempt: null };
    }
    const sd = up.prefectures[key][`s${step}`];
    sd.attempts++;
    if (isCorrect) { sd.correct++; sd.completed = true; }
    sd.lastAttempt = new Date().toISOString();

    // 全体統計更新
    if (!up.stats) up.stats = { lastActive: null, streak: 0, totalCorrect: 0, totalAttempts: 0, dailyHistory: {} };
    up.stats.totalAttempts++;
    if (isCorrect) up.stats.totalCorrect++;
    up.stats.lastActive = new Date().toISOString();

    // 日別履歴
    const today = new Date().toISOString().split('T')[0];
    if (!up.stats.dailyHistory) up.stats.dailyHistory = {};
    if (!up.stats.dailyHistory[today]) up.stats.dailyHistory[today] = { attempts: 0, correct: 0 };
    up.stats.dailyHistory[today].attempts++;
    if (isCorrect) up.stats.dailyHistory[today].correct++;

    // ストリーク更新
    _updateStreak(up);

    all[userId] = up;
    _save(all);
    return sd;
  }

  // ステップ3完了マーク
  function completeStep3(userId, prefId) {
    const all = _load();
    const up = getUserProgress(userId);
    const key = `p${prefId}`;
    if (!up.prefectures[key]) up.prefectures[key] = {};
    if (!up.prefectures[key].s3) up.prefectures[key].s3 = { completed: false, attempts: 0, correct: 0 };
    up.prefectures[key].s3.completed = true;
    up.prefectures[key].s3.lastAttempt = new Date().toISOString();
    all[userId] = up;
    _save(all);
  }

  // 連続学習ストリーク計算
  function _updateStreak(up) {
    if (!up.stats.dailyHistory) return;
    const today = new Date();
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      if (up.stats.dailyHistory[key] && up.stats.dailyHistory[key].attempts > 0) {
        streak++;
      } else if (i > 0) break;
    }
    up.stats.streak = streak;
  }

  // 都道府県ごとのステップ達成状況
  function getPrefStatus(userId, prefId) {
    const up = getUserProgress(userId);
    const key = `p${prefId}`;
    const pdata = up.prefectures[key] || {};
    return {
      step1: pdata.s1 && pdata.s1.completed,
      step2: pdata.s2 && pdata.s2.completed,
      step3: pdata.s3 && pdata.s3.completed,
      step1Accuracy: pdata.s1 ? Math.round((pdata.s1.correct / Math.max(pdata.s1.attempts, 1)) * 100) : 0,
      step2Accuracy: pdata.s2 ? Math.round((pdata.s2.correct / Math.max(pdata.s2.attempts, 1)) * 100) : 0,
    };
  }

  // 全体統計
  function getStats(userId) {
    const up = getUserProgress(userId);
    const prefectures = up.prefectures || {};
    let completed1 = 0, completed2 = 0, completed3 = 0;
    let totalAttempts = 0, totalCorrect = 0;

    PREFECTURES.forEach(p => {
      const key = `p${p.id}`;
      const pd = prefectures[key] || {};
      if (pd.s1 && pd.s1.completed) completed1++;
      if (pd.s2 && pd.s2.completed) completed2++;
      if (pd.s3 && pd.s3.completed) completed3++;
      ['s1', 's2'].forEach(s => {
        if (pd[s]) { totalAttempts += pd[s].attempts; totalCorrect += pd[s].correct; }
      });
    });

    return {
      completed1, completed2, completed3,
      totalPref: PREFECTURES.length,
      overallAccuracy: totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0,
      totalAttempts,
      totalCorrect,
      streak: up.stats ? up.stats.streak : 0,
      dailyHistory: up.stats ? up.stats.dailyHistory || {} : {},
    };
  }

  // 苦手な都道府県（正答率が低い or 未挑戦）
  function getWeakPrefectures(userId, limit = 5) {
    const up = getUserProgress(userId);
    const prefectures = up.prefectures || {};
    return PREFECTURES
      .map(p => {
        const key = `p${p.id}`;
        const pd = prefectures[key] || {};
        const s1 = pd.s1 || { attempts: 0, correct: 0 };
        const acc = s1.attempts > 0 ? (s1.correct / s1.attempts) : -1;
        return { pref: p, accuracy: acc, attempts: s1.attempts };
      })
      .filter(item => item.accuracy < 0.8)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, limit);
  }

  // バッジ一覧
  function getBadges(userId) {
    const stats = getStats(userId);
    const up = getUserProgress(userId);
    const badges = [];

    const allBadges = [
      { id: 'first_step', icon: '🌟', name: 'はじめの一歩', desc: 'はじめて都道府県を書いた！', earned: stats.completed1 >= 1 },
      { id: 'ten_pref', icon: '🔟', name: '10県マスター', desc: '10都道府県の漢字をマスター！', earned: stats.completed1 >= 10 },
      { id: 'all_pref1', icon: '🗾', name: '全国制覇（書き方）', desc: '全47都道府県の漢字を書けた！', earned: stats.completed1 >= 47 },
      { id: 'capital_starter', icon: '🏛️', name: '県庁所在地デビュー', desc: 'はじめて県庁所在地を答えた！', earned: stats.completed2 >= 1 },
      { id: 'all_capital', icon: '🏙️', name: '全国の県庁所在地マスター', desc: '全47県庁所在地をマスター！', earned: stats.completed2 >= 47 },
      { id: 'history_buff', icon: '📜', name: '歴史博士', desc: '10都道府県の歴史を学んだ！', earned: stats.completed3 >= 10 },
      { id: 'all_complete', icon: '👑', name: '都道府県チャンピオン', desc: '全47都道府県のStep3まで完了！', earned: stats.completed3 >= 47 },
      { id: 'streak3', icon: '🔥', name: '3日連続学習！', desc: '3日連続で学習した！', earned: stats.streak >= 3 },
      { id: 'streak7', icon: '🚀', name: '1週間連続学習！', desc: '7日連続で学習した！', earned: stats.streak >= 7 },
      { id: 'perfect', icon: '💯', name: 'パーフェクト！', desc: '正答率100%を達成！', earned: stats.overallAccuracy === 100 && stats.totalAttempts >= 5 },
      { id: 'time_attack_clear', icon: '⏱️', name: 'スピードスター', desc: 'タイムアタックをクリア！', earned: !!up.stats.bestTimeAttack },
      { id: 'time_attack_fast', icon: '⚡️', name: '音速マスター', desc: 'タイムアタックを1分半以内にクリア！', earned: up.stats.bestTimeAttack && up.stats.bestTimeAttack <= 90 * 1000 },
    ];

    return allBadges;
  }

  // タイムアタックの結果保存
  function recordTimeAttack(userId, timeMs) {
    const all = _load();
    const up = getUserProgress(userId);
    if (!up.stats) up.stats = {};
    if (!up.stats.bestTimeAttack || timeMs < up.stats.bestTimeAttack) {
      up.stats.bestTimeAttack = timeMs;
    }
    all[userId] = up;
    _save(all);
    return up.stats.bestTimeAttack;
  }

  // 都道府県の学習記録をリセット
  function resetPrefecture(userId, prefId) {
    const all = _load();
    const up = getUserProgress(userId);
    const key = `p${prefId}`;
    if (up.prefectures[key]) {
      up.prefectures[key] = {
        s1: { completed: false, attempts: 0, correct: 0, lastAttempt: null },
        s2: { completed: false, attempts: 0, correct: 0, lastAttempt: null },
        s3: { completed: false, attempts: 0, correct: 0, lastAttempt: null }
      };
      all[userId] = up;
      _save(all);
    }
  }

  return { recordAttempt, completeStep3, getPrefStatus, getStats, getWeakPrefectures, getBadges, getUserProgress, getPrefStep, resetPrefecture, recordTimeAttack };
})();
