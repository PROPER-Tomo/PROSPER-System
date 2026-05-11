export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=2592000, stale-while-revalidate=86400');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `日本の自動車継続検査（車検）の現在の法定費用を教えてください。JSONのみ返してください（説明文・Markdown禁止）:
{
  "jibaiseki": {
    "normal": {"12": 数値, "13": 数値, "24": 数値, "25": 数値},
    "kei": {"12": 数値, "13": 数値, "24": 数値, "25": 数値}
  },
  "juryozei_per_year": {
    "normal": {"0.5": 数値, "1.0": 数値, "1.5": 数値, "2.0": 数値, "2.5": 数値, "3.0": 数値},
    "kei": 数値
  },
  "kensa_tesuryo": {
    "normal_3": 数値,
    "normal_5": 数値,
    "kei": 数値
  }
}
全て整数（円）。自賠責は損保料率算出機構の最新料率。重量税は継続検査・1年分の金額。検査料は持込み（非認証工場）の印紙・証紙合計額。3ナンバー(normal_3)と5ナンバー(normal_5)で検査料を分けること。`
        }]
      })
    });

    const data = await response.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const m = text.replace(/```json|```/g, '').match(/\{[\s\S]*\}/);
    const rates = JSON.parse(m[0]);

    res.status(200).json({ ...rates, fetched_at: new Date().toISOString() });
  } catch (e) {
    console.error(e);
    res.status(200).json({
      jibaiseki: {
        normal: { 12: 11640, 13: 12530, 24: 17650, 25: 18160 },
        kei:    { 12: 10500, 13: 11280, 24: 15520, 25: 15950 }
      },
      juryozei_per_year: {
        normal: { "0.5": 4100, "1.0": 8200, "1.5": 12300, "2.0": 16400, "2.5": 20500, "3.0": 24600 },
        kei: 3300
      },
      kensa_tesuryo: { normal_3: 2600, normal_5: 2500, kei: 2500 },
      fetched_at: null,
      fallback: true
    });
  }
}
