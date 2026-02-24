import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for base64 images
  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.post("/api/analyze-frame", async (req, res) => {
    try {
      const { image, index } = req.body;
      const apiKey = process.env.VITE_QWEN_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "Missing API Key" });
      }

      // Call Dashscope API
      const response = await fetch("https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-DashScope-WorkSpace": "modal"
        },
        body: JSON.stringify({
          model: "qwen-vl-max",
          input: {
            messages: [
              {
                role: "user",
                content: [
                  { image: image }, // Expecting data:image/jpeg;base64,...
                  { text: `请严格按以下JSON格式分析这张图片：
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
请只返回JSON，不要任何其他文字。` }
                ]
              }
            ]
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Dashscope API Error:", errorText);
        return res.status(response.status).json({ error: errorText });
      }

      const data = await response.json();
      res.json(data);

    } catch (error: any) {
      console.error("Server Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving (if needed, but usually handled by build output)
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
