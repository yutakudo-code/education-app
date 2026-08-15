// ============================================================
// data/countries.js - 世界の主要国データ
// ============================================================

const COUNTRIES = [
  { id: 101, name: 'アメリカ', reading: 'あめりか', color: '#FF6B6B', emoji: '🇺🇸', region: 'world' },
  { id: 102, name: 'イギリス', reading: 'いぎりす', color: '#5DADE2', emoji: '🇬🇧', region: 'world' },
  { id: 103, name: 'フランス', reading: 'ふらんす', color: '#4ECDC4', emoji: '🇫🇷', region: 'world' },
  { id: 104, name: 'ドイツ', reading: 'どいつ', color: '#FFD93D', emoji: '🇩🇪', region: 'world' },
  { id: 105, name: 'イタリア', reading: 'いたりあ', color: '#6BCB77', emoji: '🇮🇹', region: 'world' },
  { id: 106, name: 'カナダ', reading: 'かなだ', color: '#FF9F43', emoji: '🇨🇦', region: 'world' },
  { id: 107, name: 'ブラジル', reading: 'ぶらじる', color: '#8854d0', emoji: '🇧🇷', region: 'world' },
  { id: 108, name: 'オーストラリア', reading: 'おーすとらりあ', color: '#2bcbba', emoji: '🇦🇺', region: 'world' },
  { id: 109, name: 'インド', reading: 'いんど', color: '#fd9644', emoji: '🇮🇳', region: 'world' },
  { id: 110, name: 'ちゅうごく', reading: 'ちゅうごく', displayName: '中国', color: '#eb3b5a', emoji: '🇨🇳', region: 'world' },
  { id: 111, name: 'かんこく', reading: 'かんこく', displayName: '韓国', color: '#45aaf2', emoji: '🇰🇷', region: 'world' },
  { id: 112, name: 'ロシア', reading: 'ろしあ', color: '#a5b1c2', emoji: '🇷🇺', region: 'world' },
  { id: 113, name: 'エジプト', reading: 'えじぷと', color: '#f7b731', emoji: '🇪🇬', region: 'world' },
  { id: 114, name: 'メキシコ', reading: 'めきしこ', color: '#20bf6b', emoji: '🇲🇽', region: 'world' },
  { id: 115, name: 'アルゼンチン', reading: 'あるぜんちん', color: '#0fb9b1', emoji: '🇦🇷', region: 'world' },
  { id: 116, name: 'サウジアラビア', reading: 'さうじあらびあ', color: '#26de81', emoji: '🇸🇦', region: 'world' },
  { id: 117, name: 'トルコ', reading: 'とるこ', color: '#eb3b5a', emoji: '🇹🇷', region: 'world' },
  { id: 118, name: 'スペイン', reading: 'すぺいん', color: '#fa8231', emoji: '🇪🇸', region: 'world' },
  { id: 119, name: 'ケニア', reading: 'けにあ', color: '#4b4b4b', emoji: '🇰🇪', region: 'world' },
  { id: 120, name: 'にほん', reading: 'にほん', displayName: '日本', color: '#ffffff', emoji: '🇯🇵', region: 'world' }
];

const WORLD_TO_JP_NAME = {
  'USA': 'アメリカ',
  'United Kingdom': 'イギリス',
  'England': 'イギリス',
  'France': 'フランス',
  'Germany': 'ドイツ',
  'Italy': 'イタリア',
  'Canada': 'カナダ',
  'Brazil': 'ブラジル',
  'Australia': 'オーストラリア',
  'India': 'インド',
  'China': '中国',
  'South Korea': '韓国',
  'Russia': 'ロシア',
  'Egypt': 'エジプト',
  'Mexico': 'メキシコ',
  'Argentina': 'アルゼンチン',
  'Saudi Arabia': 'サウジアラビア',
  'Turkey': 'トルコ',
  'Spain': 'スペイン',
  'Kenya': 'ケニア',
  'Japan': '日本'
};

function getCountryByName(name) {
  let displayName = WORLD_TO_JP_NAME[name];
  if (!displayName) return null;
  return COUNTRIES.find(c => c.name === displayName || c.displayName === displayName);
}
