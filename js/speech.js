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

  // 正解を読む（音声読み上げをやめて、レベルアップ音を鳴らす）
  function speakCorrect() { playSuccessSound(); }

  // 不正解を読む
  function speakWrong() { speak('おしい！もう一度チャレンジしよう！', { pitch: 1.1 }); }

  // ヒントを読む
  function speakHint(text) { speak(`ヒント！${text}`, { rate: 0.8 }); }

  // 音声エフェクト用のAudioContext（iOS対応のためグローバルで保持し、ユーザーアクションで初期化する）
  let audioCtx = null;

  function initAudio() {
    if (audioCtx) {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return;
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioCtx = new AudioCtx();
        // 無音を一度再生してiOSのロックを解除
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        gain.gain.value = 0;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.01);
      }
    } catch (e) {
      console.warn('AudioContext init error:', e);
    }
  }

  // 正解効果音（Web Audio APIによるレベルアップ風サウンド）
  function playSuccessSound() {
    if (!enabled || !audioCtx) return;
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      
      const playTone = (freq, startTime, duration, type='square') => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      
      const now = audioCtx.currentTime;
      // レベルアップ風の軽快なアルペジオ
      playTone(523.25, now, 0.1);         // C5
      playTone(659.25, now + 0.1, 0.1);   // E5
      playTone(783.99, now + 0.2, 0.1);   // G5
      playTone(1046.50, now + 0.3, 0.1);  // C6
      playTone(1318.51, now + 0.4, 0.1);  // E6
      playTone(1567.98, now + 0.5, 0.6);  // G6 (長く伸ばす)
    } catch (e) { console.warn('Audio play error:', e); }
  }

  // 止める
  function stop() {
    if (window.speechSynthesis) speechSynthesis.cancel();
    currentUtterance = null;
  }

  function setEnabled(v) { enabled = v; if (!v) stop(); }
  function isEnabled() { return enabled; }

  return { init, initAudio, speak, speakPrefName, speakCapital, speakQuestion, speakCorrect, speakWrong, speakHint, playSuccessSound, stop, setEnabled, isEnabled };
})();
