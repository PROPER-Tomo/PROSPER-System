
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image, mediaType } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'image is required' });
    }

    const isPdf = (mediaType || '').includes('pdf');
    const fileContent = isPdf ? {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: image }
    } : {
      type: 'image',
      source: { type: 'base64', media_type: (mediaType || 'image/jpeg').replace('jpg', 'jpeg'), data: image }
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-7',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            fileContent,
            {
              type: 'text',
              text: 'この車検証（自動車検査証）を読み取り、以下のJSON形式のみを返してください。前置き・説明・マークダウン・コードブロック（```）は一切不要です。JSONオブジェクトだけを出力してください。\n{"owner_name":"","owner_address":"","user_name":"","user_address":"","plate":"","model":"","chassis_no":"","first_reg":"","expiry":"","year":0,"displacement":0,"weight":0}\n\nルール:\n- user_name=使用者欄、owner_name=所有者欄（使用者欄がなければowner_nameと同値）\n- year=初度登録年月を西暦年（整数）\n- expiry=有効期間満了日をYYYY-MM-DD形式\n- first_reg=初度登録年月をYYYY-MM-DD形式\n- displacement=総排気量をcc整数（最大積載量・車両総重量と混同厳禁）\n- weight=車両重量kg整数'
            }
          ]
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', data);
      return res.status(response.status).json({ error: data.error?.message || 'Anthropic API error', detail: data });
    }

    res.status(200).json(data);

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
