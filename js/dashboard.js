// ============================================================
// js/dashboard.js - 学習ダッシュボード（正答率・進捗・バッジ）
// ============================================================

const Dashboard = (() => {
  let currentUserId = null;

  function show(userId) {
    currentUserId = userId;
    const view = document.getElementById('view-dashboard');
    view.classList.remove('hidden');
    _render();
  }

  function hide() {
    document.getElementById('view-dashboard').classList.add('hidden');
  }

  function _render() {
    const stats = Progress.getStats(currentUserId);
    const profile = Auth.getActiveProfile();

    // ヘッダー統計
    document.getElementById('dash-profile-avatar').textContent = profile?.avatar || '🦊';
    document.getElementById('dash-profile-name').textContent = profile?.name || 'まなびちゃん';

    // サマリーカード
    document.getElementById('dash-completed1').textContent = `${stats.completed1}/47`;
    document.getElementById('dash-completed2').textContent = `${stats.completed2}/47`;
    document.getElementById('dash-completed3').textContent = `${stats.completed3}/47`;
    document.getElementById('dash-accuracy').textContent = `${stats.overallAccuracy}%`;
    document.getElementById('dash-streak').textContent = `${stats.streak}日`;

    // 進捗リング
    _renderRing('ring-step1', stats.completed1 / 47);
    _renderRing('ring-step2', stats.completed2 / 47);
    _renderRing('ring-step3', stats.completed3 / 47);

    // 地方別進捗
    _renderRegionProgress();

    // 直近7日間の活動グラフ
    _renderActivityChart(stats.dailyHistory);

    // バッジ
    _renderBadges();

    // 苦手都道府県
    _renderWeakPrefs();

    // 都道府県一覧テーブル
    _renderPrefTable();
  }

  // 円グラフ（SVGリング）
  function _renderRing(elId, ratio) {
    const el = document.getElementById(elId);
    if (!el) return;
    const r = 40, cx = 50, cy = 50;
    const circ = 2 * Math.PI * r;
    const filled = circ * Math.min(ratio, 1);
    el.innerHTML = `
      <svg viewBox="0 0 100 100" width="100" height="100">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#eee" stroke-width="12"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
          stroke="url(#ringGrad-${elId})" stroke-width="12"
          stroke-dasharray="${filled} ${circ}"
          stroke-linecap="round"
          transform="rotate(-90 ${cx} ${cy})"/>
        <defs>
          <linearGradient id="ringGrad-${elId}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#7C4DFF"/>
            <stop offset="100%" stop-color="#FF6B9D"/>
          </linearGradient>
        </defs>
        <text x="${cx}" y="${cy}" text-anchor="middle" dy="0.35em"
          font-size="18" font-weight="bold" fill="#333">
          ${Math.round(ratio * 100)}%
        </text>
      </svg>
    `;
  }

  // 地方別進捗バー
  function _renderRegionProgress() {
    const container = document.getElementById('dash-region-progress');
    if (!container) return;
    container.innerHTML = '';

    REGIONS.forEach(region => {
      const prefs = PREFECTURES.filter(p => p.region === region);
      let step1Done = 0;
      prefs.forEach(p => {
        const st = Progress.getPrefStatus(currentUserId, p.id);
        if (st.step1) step1Done++;
      });
      const ratio = step1Done / prefs.length;

      const row = document.createElement('div');
      row.className = 'region-row';
      row.innerHTML = `
        <div class="region-name">${region}</div>
        <div class="region-bar-wrap">
          <div class="region-bar" style="width:${ratio * 100}%;background:linear-gradient(90deg,#7C4DFF,#FF6B9D)"></div>
        </div>
        <div class="region-count">${step1Done}/${prefs.length}</div>
      `;
      container.appendChild(row);
    });
  }

  // 活動グラフ（直近7日）
  function _renderActivityChart(dailyHistory) {
    const container = document.getElementById('dash-activity-chart');
    if (!container) return;
    container.innerHTML = '';

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const label = i === 0 ? '今日' : `${d.getMonth()+1}/${d.getDate()}`;
      const data = dailyHistory[key] || { attempts: 0, correct: 0 };
      days.push({ label, ...data });
    }

    const maxAttempts = Math.max(...days.map(d => d.attempts), 1);

    days.forEach(day => {
      const bar = document.createElement('div');
      bar.className = 'activity-bar-col';
      const height = Math.max((day.attempts / maxAttempts) * 80, day.attempts > 0 ? 4 : 0);
      const accuracy = day.attempts > 0 ? Math.round((day.correct / day.attempts) * 100) : 0;
      bar.innerHTML = `
        <div class="activity-bar-wrap" title="${day.attempts}問 / 正答率${accuracy}%">
          <div class="activity-bar" style="height:${height}px;background:${day.attempts > 0 ? 'linear-gradient(180deg,#7C4DFF,#FF6B9D)' : '#eee'}"></div>
        </div>
        <div class="activity-label">${day.label}</div>
        ${day.attempts > 0 ? `<div class="activity-count">${day.attempts}問</div>` : ''}
      `;
      container.appendChild(bar);
    });
  }

  // バッジ表示
  function _renderBadges() {
    const container = document.getElementById('dash-badges');
    if (!container) return;
    container.innerHTML = '';
    const badges = Progress.getBadges(currentUserId);
    badges.forEach(badge => {
      const el = document.createElement('div');
      el.className = `badge-card ${badge.earned ? 'earned' : 'locked'}`;
      el.title = badge.desc;
      el.innerHTML = `
        <div class="badge-icon">${badge.earned ? badge.icon : '🔒'}</div>
        <div class="badge-name">${badge.name}</div>
        <div class="badge-desc">${badge.desc}</div>
      `;
      if (badge.earned) {
        el.addEventListener('click', () => Speech.speak(`${badge.name}！${badge.desc}`));
      }
      container.appendChild(el);
    });
  }

  // 苦手都道府県
  function _renderWeakPrefs() {
    const container = document.getElementById('dash-weak-prefs');
    if (!container) return;
    container.innerHTML = '';
    const weak = Progress.getWeakPrefectures(currentUserId, 5);
    if (weak.length === 0) {
      container.innerHTML = '<p class="dash-empty">苦手な都道府県はまだないよ！どんどん挑戦しよう！</p>';
      return;
    }
    weak.forEach(item => {
      const el = document.createElement('div');
      el.className = 'weak-pref-item';
      const acc = item.accuracy >= 0 ? `${Math.round(item.accuracy * 100)}%` : '未挑戦';
      el.innerHTML = `
        <span class="weak-pref-emoji">${item.pref.emoji}</span>
        <span class="weak-pref-name">${item.pref.name}</span>
        <span class="weak-pref-acc ${item.accuracy < 0.5 ? 'low' : ''}">${acc}</span>
      `;
      el.addEventListener('click', () => {
        hide();
        window.AppRouter && window.AppRouter.goPref(item.pref);
      });
      container.appendChild(el);
    });
  }

  // 都道府県一覧テーブル
  function _renderPrefTable() {
    const tbody = document.getElementById('pref-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    PREFECTURES.forEach(pref => {
      const st = Progress.getPrefStatus(currentUserId, pref.id);
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${pref.emoji} ${pref.name}</td>
        <td><span class="step-check ${st.step1 ? 'done' : ''}">${st.step1 ? '✅' : '—'}</span></td>
        <td><span class="step-check ${st.step2 ? 'done' : ''}">${st.step2 ? '✅' : '—'}</span></td>
        <td><span class="step-check ${st.step3 ? 'done' : ''}">${st.step3 ? '✅' : '—'}</span></td>
        <td>${st.step1Accuracy > 0 ? st.step1Accuracy + '%' : '—'}</td>
      `;
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        hide();
        window.AppRouter && window.AppRouter.goPref(pref);
      });
      tbody.appendChild(row);
    });
  }

  return { show, hide };
})();
