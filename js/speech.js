// ============================================================
// js/speech.js - 音声読み上げ（Web Speech API）
// ============================================================

const Speech = (() => {
  let enabled = true;
  let currentUtterance = null;
  const voices = [];
  let jaVoice = null;

  // 初期化：日本語ボイス取得
  function init() {
    const load = () => {
      const all = speechSynthesis.getVoices();
      if (all.length === 0) return;
      // 日本語ボイスを優先的に選択
      jaVoice = all.find(v => v.lang === 'ja-JP' && v.localService) ||
                all.find(v => v.lang === 'ja-JP') ||
                all.find(v => v.lang.startsWith('ja')) ||
                null;
    };
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = load;
    }
    load();
  }

  // テキストを読み上げる
  function speak(text, options = {}) {
    if (!enabled || !window.speechSynthesis) return;
    stop();
    const utter = new SpeechSynthesisUtterance(text);
    if (jaVoice) utter.voice = jaVoice;
    utter.lang = 'ja-JP';
    utter.rate = options.rate || 0.85;   // 少しゆっくり（小学生向け）
    utter.pitch = options.pitch || 1.1;  // 少し高め（明るい声）
    utter.volume = options.volume || 1.0;
    currentUtterance = utter;
    speechSynthesis.speak(utter);
    return utter;
  }

  // 都道府県名を読む
  function speakPrefName(pref) {
    speak(`${pref.name}。よみかたは、${pref.reading}。`);
  }

  // 県庁所在地を読む
  function speakCapital(pref) {
    speak(`${pref.name}の県庁所在地は、${pref.capital}です。よみかたは、${pref.capitalReading}。`);
  }

  // クイズ問題を読む
  function speakQuestion(text) { speak(text, { rate: 0.8 }); }

  // 正解を読む
  function speakCorrect() { speak('せいかい！すごいね！', { pitch: 1.3, rate: 1.0 }); }

  // 不正解を読む
  function speakWrong() { speak('おしい！もう一度チャレンジしよう！', { pitch: 1.1 }); }

  // ヒントを読む
  function speakHint(text) { speak(`ヒント！${text}`, { rate: 0.8 }); }

  // 正解効果音（Web Audio APIによるファンファーレ風サウンド）
  function playSuccessSound() {
    if (!enabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const playTone = (freq, startTime, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      
      const now = ctx.currentTime;
      // キラキラッとした和音のアルペジオ（ド・ミ・ソ・高いド）
      playTone(523.25, now, 0.4);       // C5
      playTone(659.25, now + 0.1, 0.4); // E5
      playTone(783.99, now + 0.2, 0.4); // G5
      playTone(1046.50, now + 0.3, 0.8); // C6
    } catch (e) { console.warn('AudioContext error:', e); }
  }

  // 止める
  function stop() {
    if (window.speechSynthesis) speechSynthesis.cancel();
    currentUtterance = null;
  }

  function setEnabled(v) { enabled = v; if (!v) stop(); }
  function isEnabled() { return enabled; }

  return { init, speak, speakPrefName, speakCapital, speakQuestion, speakCorrect, speakWrong, speakHint, playSuccessSound, stop, setEnabled, isEnabled };
})();
