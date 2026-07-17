// 法定費用 料率 月次AI自動更新（Vercel Cron から毎月1回呼び出し）
// Claudeに現行の官報公示レート（自賠責・重量税・持込み検査手数料）を確認させ、
// 変更があれば Firestore(prosper/rates_ai) に保存する。api/rates.js がそこから配信する。
import { FALLBACK_RATES, getStoredRates, saveRates, isSane } from './_ratesData.js';

function monthsSchema(keys) {
  const properties = {};
  for (const k of keys) properties[k] = { type: 'number' };
  return { type: 'object', properties, required: keys };
}

function tieredWeightSchema(weightKeys) {
  const tier = monthsSchema(weightKeys);
  return {
    type: 'object',
    properties: { standard: tier, over13: tier, over18: tier },
    required: ['standard', 'over13', 'over18']
  };
}

function tieredScalarSchema() {
  return {
    type: 'object',
    properties: { standard: { type: 'number' }, over13: { type: 'number' }, over18: { type: 'number' } },
    required: ['standard', 'over13', 'over18']
  };
}

const JIBAISEKI_SCHEMA = {
  type: 'object',
  properties: {
    normal: monthsSchema(['12', '13', '24', '25']),
    kei: monthsSchema(['12', '13', '24', '25']),
    kamotsu_small: monthsSchema(['12', '13', '24', '25']),
    kamotsu_2t: monthsSchema(['12', '13', '24', '25']),
    kamotsu_2t_over: monthsSchema(['12', '13', '24', '25']),
    bike250: monthsSchema(['12', '13', '24', '25']),
    bike125: monthsSchema(['12', '24'])
  },
  required: ['normal', 'kei', 'kamotsu_small', 'kamotsu_2t', 'kamotsu_2t_over', 'bike250', 'bike125']
};

const JURYOZEI_SCHEMA = {
  type: 'object',
  properties: {
    normal: tieredWeightSchema(['0.5', '1.0', '1.5', '2.0', '2.5', '3.0']),
    kei: tieredScalarSchema(),
    kamotsu: tieredWeightSchema(['1.0', '2.0', '2.5', '3.0', '4.0', '5.0', '6.0', '7.0', '8.0']),
    bike250: tieredScalarSchema()
  },
  required: ['normal', 'kei', 'kamotsu', 'bike250']
};

const KENSA_SCHEMA = {
  type: 'object',
  properties: {
    normal_3: { type: 'number' }, normal_5: { type: 'number' }, kei: { type: 'number' }, bike250: { type: 'number' },
    chukoshinki_3: { type: 'number' }, chukoshinki_5: { type: 'number' }, chukoshinki_kei: { type: 'number' }
  },
  required: ['normal_3', 'normal_5', 'kei', 'bike250', 'chukoshinki_3', 'chukoshinki_5', 'chukoshinki_kei']
};

export default async function handler(req, res) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers['authorization'];
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }

  try {
    const stored = await getStoredRates();
    const current = stored?.rates || FALLBACK_RATES;

    const system = `あなたは日本の運輸行政・自動車税制に精通した専門家です。熊本県の指定工場を持たない自動車整備工場（持込み検査）向けに、車検にかかる法定費用の最新料率を確認します。

対象は以下の3種類です。
1. 自賠責保険（共済）基準料率 - 継続検査（車検）用、離島以外の本土用
2. 自動車重量税 - エコカー減税対象外・継続検査（車検）1年/2年分
3. 軽自動車検査協会・運輸支局の持込み検査手数料（保安基準適合証がない、通常の持込み検査）

前回保存されている値をこの後渡すので、現時点（今日の日付）で官報改定等により変更がある項目だけを正しい値に修正し、変更がない項目はそのまま返してください。分からない・自信がない項目は前回の値をそのまま維持してください（推測で数値を作らないこと）。`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 4096,
        system,
        tool_choice: { type: 'tool', name: 'submit_rates' },
        tools: [{
          name: 'submit_rates',
          description: '確認済みの法定費用料率表（前回値の維持 or 修正済み）を提出する',
          input_schema: {
            type: 'object',
            properties: {
              jibaiseki: JIBAISEKI_SCHEMA,
              juryozei_per_year: JURYOZEI_SCHEMA,
              kensa_tesuryo: KENSA_SCHEMA,
              change_summary: { type: 'string', description: '前回保存値からの変更点の要約。変更がなければ「変更なし」と書く' }
            },
            required: ['jibaiseki', 'juryozei_per_year', 'kensa_tesuryo', 'change_summary']
          }
        }],
        messages: [{
          role: 'user',
          content: `前回保存されている料率表:\n${JSON.stringify(current, null, 2)}\n\n上記を今日時点の最新の官報公示値と照らし合わせ、submit_rates ツールで結果を返してください。`
        }]
      })
    });

    const data = await response.json();
    if (data.error) {
      console.error('Anthropic API error:', data.error);
      return res.status(200).json({ ok: false, reason: 'api_error', detail: data.error.message });
    }

    const toolUse = (data.content || []).find(c => c.type === 'tool_use');
    if (!toolUse) {
      return res.status(200).json({ ok: false, reason: 'no_tool_use' });
    }

    const proposed = toolUse.input;
    if (!isSane(current, proposed)) {
      await saveRates(current, `rejected_anomaly: ${proposed.change_summary || ''}`);
      return res.status(200).json({ ok: false, reason: 'anomaly_detected', change_summary: proposed.change_summary });
    }

    await saveRates(proposed, `ok: ${proposed.change_summary || ''}`);
    return res.status(200).json({ ok: true, change_summary: proposed.change_summary });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
