// ============================================================
// js/auth.js - プロフィール（ログイン）管理
// ============================================================

const Auth = (() => {
  const STORAGE_KEY = 'pref_profiles_v2';
  const AVATARS = ['🦊', '🐼', '🐨', '🐯', '🐸', '🦁', '🐻', '🐶', '🐱', '🐰'];
  const PROFILE_COLORS = ['#FF6B9D', '#7C4DFF', '#FF9F43', '#4ECDC4', '#6BCB77', '#FF6B6B', '#5DADE2', '#A569BD'];

  function _load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { profiles: [], activeId: null }; }
    catch { return { profiles: [], activeId: null }; }
  }

  function _save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function getProfiles() { return _load().profiles; }

  function getActiveProfile() {
    const data = _load();
    return data.profiles.find(p => p.id === data.activeId) || null;
  }

  function setActiveProfile(id) {
    const data = _load();
    data.activeId = id;
    _save(data);
  }

  function createProfile(name, avatarIndex, colorIndex) {
    const data = _load();
    if (data.profiles.length >= 5) return null;
    const profile = {
      id: 'u_' + Date.now(),
      name: name.trim().slice(0, 10),
      avatar: AVATARS[avatarIndex] || AVATARS[0],
      color: PROFILE_COLORS[colorIndex] || PROFILE_COLORS[0],
      createdAt: new Date().toISOString(),
    };
    data.profiles.push(profile);
    data.activeId = profile.id;
    _save(data);
    return profile;
  }

  function deleteProfile(id) {
    const data = _load();
    data.profiles = data.profiles.filter(p => p.id !== id);
    if (data.activeId === id) data.activeId = data.profiles[0]?.id || null;
    _save(data);
    // 進捗データも削除
    try {
      const progress = JSON.parse(localStorage.getItem('pref_progress_v2')) || {};
      delete progress[id];
      localStorage.setItem('pref_progress_v2', JSON.stringify(progress));
    } catch {}
  }

  return { getProfiles, getActiveProfile, setActiveProfile, createProfile, deleteProfile, AVATARS, PROFILE_COLORS };
})();

// ============================================================
// ログイン画面 UI
// ============================================================

function showLoginScreen(onLogin) {
  const profiles = Auth.getProfiles();
  const loginDiv = document.getElementById('view-login');
  loginDiv.classList.remove('hidden');

  const profileList = document.getElementById('profile-list');
  const addProfileForm = document.getElementById('add-profile-form');

  renderProfileList();

  function renderProfileList() {
    profileList.innerHTML = '';
    const profiles = Auth.getProfiles();
    profiles.forEach(profile => {
      const card = document.createElement('div');
      card.className = 'profile-card';
      card.style.setProperty('--profile-color', profile.color);
      card.innerHTML = `
        <div class="profile-avatar">${profile.avatar}</div>
        <div class="profile-name">${profile.name}</div>
        <button class="profile-delete-btn" data-id="${profile.id}" title="削除">✕</button>
      `;
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('profile-delete-btn')) {
          if (confirm(`「${profile.name}」のデータを削除しますか？`)) {
            Auth.deleteProfile(profile.id);
            renderProfileList();
          }
          return;
        }
        Auth.setActiveProfile(profile.id);
        loginDiv.classList.add('hidden');
        onLogin(profile);
      });
      profileList.appendChild(card);
    });

    // 追加ボタン
    if (profiles.length < 5) {
      const addCard = document.createElement('div');
      addCard.className = 'profile-card add-card';
      addCard.innerHTML = `<div class="add-icon">＋</div><div class="profile-name">ついか</div>`;
      addCard.addEventListener('click', () => {
        addProfileForm.classList.toggle('hidden');
      });
      profileList.appendChild(addCard);
    }
  }

  // アバター選択
  let selectedAvatar = 0;
  let selectedColor = 0;
  const avatarGrid = document.getElementById('avatar-grid');
  Auth.AVATARS.forEach((av, i) => {
    const btn = document.createElement('button');
    btn.className = 'avatar-btn' + (i === 0 ? ' selected' : '');
    btn.textContent = av;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.avatar-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedAvatar = i;
    });
    avatarGrid.appendChild(btn);
  });

  const colorGrid = document.getElementById('color-grid');
  Auth.PROFILE_COLORS.forEach((c, i) => {
    const btn = document.createElement('button');
    btn.className = 'color-btn' + (i === 0 ? ' selected' : '');
    btn.style.background = c;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedColor = i;
    });
    colorGrid.appendChild(btn);
  });

  document.getElementById('create-profile-btn').addEventListener('click', () => {
    const name = document.getElementById('profile-name-input').value.trim();
    if (!name) { alert('なまえを入れてください！'); return; }
    const profile = Auth.createProfile(name, selectedAvatar, selectedColor);
    if (profile) {
      addProfileForm.classList.add('hidden');
      document.getElementById('profile-name-input').value = '';
      renderProfileList();
    }
  });

  document.getElementById('cancel-profile-btn').addEventListener('click', () => {
    addProfileForm.classList.add('hidden');
  });
}
