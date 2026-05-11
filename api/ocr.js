
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
              text: 'この車検証をOCRしてください'
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
