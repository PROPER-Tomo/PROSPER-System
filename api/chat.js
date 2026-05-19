export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, vehicle } = req.body;

    const v = vehicle || {};
    const catLabel = { normal: '普通乗用', kei: '軽自動車', kamotsu: '普通貨物' }[v.cat] || v.cat || '不明';
    const vehicleInfo = [
      v.plate ? `ナンバー: ${v.plate}` : null,
      v.model ? `型式: ${v.model}` : null,
      v.year  ? `年式: ${v.year}年` : null,
      v.disp  ? `排気量: ${v.disp}cc` : null,
      v.weight? `重量: ${v.weight}kg` : null,
      `区分: ${catLabel}`
    ].filter(Boolean).join(' / ');

    const system = `あなたは日本の自動車整備ショップ「PROSPER」の見積アシスタントです。

工賃単価: 12,000円/時間
部品マージン: デフォルト20%（売価 = 原価 ÷ (1 - マージン率/100)）

対象車両: ${vehicleInfo || '（未入力）'}

見積を作成・変更する際は set_estimate ツールを必ず使用してください。
- 作業名・部品名は日本語で具体的に記入
- part_lines の cost は税抜原価（円）
- hours は小数OK（例: 0.5 = 30分）
- summary にユーザーへの説明を必ず含めること
質問や確認だけの場合はツールを使わず返答してください。`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system,
        tools: [{
          name: 'set_estimate',
          description: '見積の工賃・部品明細を設定する（既存の内容を上書き）',
          input_schema: {
            type: 'object',
            properties: {
              labor_lines: {
                type: 'array',
                description: '工賃明細リスト',
                items: {
                  type: 'object',
                  properties: {
                    name:  { type: 'string', description: '作業名' },
                    hours: { type: 'number', description: '工賃時間数' }
                  },
                  required: ['name', 'hours']
                }
              },
              part_lines: {
                type: 'array',
                description: '部品明細リスト',
                items: {
                  type: 'object',
                  properties: {
                    name:   { type: 'string', description: '部品名' },
                    cost:   { type: 'number', description: '原価（円・税抜）' },
                    qty:    { type: 'number', description: '数量' },
                    margin: { type: 'number', description: 'マージン率（%）' }
                  },
                  required: ['name', 'cost', 'qty']
                }
              },
              summary: { type: 'string', description: 'ユーザーへの説明（設定内容の要約）' }
            },
            required: ['summary']
          }
        }],
        messages
      })
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
