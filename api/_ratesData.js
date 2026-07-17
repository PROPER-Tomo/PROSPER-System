// 法定費用 料率表 共通データ・Firestoreヘルパー
// AI自動更新（api/update-rates.js）が書き込む先と、api/rates.js が読む先を共通化する

export const FALLBACK_RATES = {
  jibaiseki: {
    normal:  { 12: 11500, 13: 12010, 24: 17650, 25: 18160 },
    kei:     { 12: 11440, 13: 11950, 24: 17540, 25: 18040 },
    kamotsu_small:   { 12: 13410, 13: 14080, 24: 20340, 25: 20950 },
    kamotsu_2t:      { 12: 18740, 13: 19530, 24: 29300, 25: 29860 },
    kamotsu_2t_over: { 12: 23890, 13: 24790, 24: 39260, 25: 39970 },
    bike250: { 12: 7010, 13: 7150, 24: 8760, 25: 8910 },
    bike125: { 12: 7100, 24: 8920 }
  },
  juryozei_per_year: {
    normal: {
      standard: { "0.5": 4100, "1.0": 8200,  "1.5": 12300, "2.0": 16400, "2.5": 20500, "3.0": 24600 },
      over13:   { "0.5": 5700, "1.0": 11400, "1.5": 17100, "2.0": 22800, "2.5": 28500, "3.0": 34200 },
      over18:   { "0.5": 7500, "1.0": 15000, "1.5": 22500, "2.0": 30000, "2.5": 37500, "3.0": 45000 }
    },
    kei: { standard: 3300, over13: 4100, over18: 4400 },
    kamotsu: {
      standard: { "1.0": 3300, "2.0": 6600,  "2.5": 9900,  "3.0": 12300, "4.0": 16400, "5.0": 20500, "6.0": 24600, "7.0": 28700, "8.0": 32800 },
      over13:   { "1.0": 4100, "2.0": 8200,  "2.5": 12300, "3.0": 17100, "4.0": 22800, "5.0": 28500, "6.0": 34200, "7.0": 39900, "8.0": 45600 },
      over18:   { "1.0": 4400, "2.0": 8800,  "2.5": 13200, "3.0": 18900, "4.0": 25200, "5.0": 31500, "6.0": 37800, "7.0": 44100, "8.0": 50400 }
    },
    bike250: { standard: 3800, over13: 4600, over18: 5000 }
  },
  kensa_tesuryo: { normal_3: 2600, normal_5: 2500, kei: 2500, bike250: 1700,
    chukoshinki_3: 2900, chukoshinki_5: 2800, chukoshinki_kei: 2800 }
};

const FIRESTORE_DOC = 'https://firestore.googleapis.com/v1/projects/prosper-system/databases/(default)/documents/prosper/rates_ai';

export async function getStoredRates() {
  try {
    const r = await fetch(FIRESTORE_DOC);
    if (!r.ok) return null;
    const doc = await r.json();
    const json = doc?.fields?.json?.stringValue;
    if (!json) return null;
    return { rates: JSON.parse(json), updatedAt: doc?.fields?.updated_at?.stringValue, status: doc?.fields?.status?.stringValue };
  } catch {
    return null;
  }
}

export async function saveRates(rates, status) {
  const body = {
    fields: {
      json: { stringValue: JSON.stringify(rates) },
      updated_at: { stringValue: new Date().toISOString() },
      status: { stringValue: status }
    }
  };
  const r = await fetch(FIRESTORE_DOC, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`Firestore save failed: ${r.status} ${await r.text()}`);
}

function collectLeaves(obj, path, out) {
  for (const k in obj) {
    const v = obj[k];
    const p = path ? `${path}.${k}` : k;
    if (typeof v === 'number') out[p] = v;
    else if (v && typeof v === 'object') collectLeaves(v, p, out);
  }
}

// AIの回答が明らかにおかしい（桁違い・欠損）場合を弾く簡易サニティチェック
export function isSane(oldRates, newRates) {
  const oldLeaves = {}, newLeaves = {};
  collectLeaves(oldRates, '', oldLeaves);
  collectLeaves(newRates || {}, '', newLeaves);
  const oldKeys = Object.keys(oldLeaves);
  if (oldKeys.length === 0) return true;
  if (Math.abs(Object.keys(newLeaves).length - oldKeys.length) > 5) return false;
  for (const k of oldKeys) {
    const o = oldLeaves[k], n = newLeaves[k];
    if (typeof n !== 'number' || !isFinite(n) || n <= 0) return false;
    if (o > 0 && (n / o > 2 || n / o < 0.5)) return false;
  }
  return true;
}
