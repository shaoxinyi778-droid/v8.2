const DASHSCOPE_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";

const PROMPT = `请严格按以下JSON格式分析这张图片：
{
  "has_clear_face": false,
  "face_confidence": 0.0,
  "face_description": "",
  "has_subtitle": false,
  "subtitle_confidence": 0.0,
  "subtitle_text": ""
}
检测标准：
1. 人脸检测：检测画面中是否包含清晰的正面脸或侧脸
   - ✅ 清晰的正面或侧脸
   - ❌ 远景模糊脸、人群中模糊脸、背影
   - 置信度：0.0-1.0
2. 字幕检测：检测画面中任何位置的文字
   - ✅ 中文、英文、标题、水印
   - ❌ 建筑招牌、商店名称、海报文字、墙上的字、产品包装以及无文字画面
请只返回JSON，不要任何其他文字。`;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { image, index } = req.body || {};
    const apiKey = process.env.QWEN_API_KEY || process.env.VITE_QWEN_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Missing QWEN_API_KEY on server' });
    }

    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'Invalid image payload' });
    }

    const response = await fetch(DASHSCOPE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen-vl-max',
        input: {
          messages: [
            {
              role: 'user',
              content: [
                { image },
                { text: `${PROMPT}\n当前帧序号：${index}` }
              ]
            }
          ]
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: 'DashScope request failed',
        details: data
      });
    }

    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({
      error: 'Internal server error',
      details: error?.message || String(error)
    });
  }
}
