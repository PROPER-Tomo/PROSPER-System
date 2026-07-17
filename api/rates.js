import { FALLBACK_RATES, getStoredRates } from './_ratesData.js';

// 法定費用 料率表 配信API
// 通常は api/update-rates.js が月次でFirestoreに保存したAI確認済みの値を返す。
// Firestoreに値が無い/取得失敗した場合はハードコードのフォールバック値を返す。
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');

  const stored = await getStoredRates();
  const rates = stored?.rates || FALLBACK_RATES;

  res.status(200).json({
    ...rates,
    fetched_at: stored?.updatedAt || new Date().toISOString()
  });
}
