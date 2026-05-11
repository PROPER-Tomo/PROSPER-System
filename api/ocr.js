
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image, mediaType } = req.body;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: (mediaType || 'image/jpeg').replace('jpg','jpeg'),
                data: image
              }
            },
            {
              type: 'text',
              text: '車検証を読み取り、次のJSONだけを返してください。説明文やMarkdownは禁止。キーは必ず owner_name, owner_address, user_name, user_address, plate, model, chassis_no, first_reg, expiry, year, displacement, weight としてください。user_nameは使用者欄、owner_nameは所有者欄です。使用者欄がない場合はowner_nameと同じ値を入れてください。yearは初度登録年月を西暦年に変換、displacementは総排気量をcc換算、weightは車両重量kgを数値で返してください。'
            }
          ]
        }]
      })
    });

    const data = await response.json();

    console.log(data);

    res.status(200).json(data);

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
