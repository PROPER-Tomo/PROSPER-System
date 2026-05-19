export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=2592000, stale-while-revalidate=86400');

  // 法定費用 料率表（料率改定時はここを更新する）
  // 自賠責: 2023年4月改定 現行料率 / 重量税: エコカー以外 継続検査1年分 / 検査料: 2026年4月改定 持込み
  res.status(200).json({
    jibaiseki: {
      normal: { 12: 11500, 13: 12010, 24: 17650, 25: 18160 },
      kei:    { 12: 11440, 13: 11950, 24: 17540, 25: 18040 }
    },
    juryozei_per_year: {
      normal: { "0.5": 4100, "1.0": 8200, "1.5": 12300, "2.0": 16400, "2.5": 20500, "3.0": 24600 },
      kei: 3300
    },
    kensa_tesuryo: { normal_3: 2600, normal_5: 2500, kei: 2500 },
    fetched_at: new Date().toISOString()
  });
}
