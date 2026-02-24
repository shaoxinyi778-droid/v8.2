<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/e4f5aa7c-92d8-4ce8-810d-39d4a500bd07

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set Qwen key in `.env.local`:
   `QWEN_API_KEY=your_dashscope_api_key`
3. Run the app:
   `npm run dev`

## Vercel deployment notes (Qwen)

This project now calls Qwen through a server-side Vercel Function:

- Endpoint: `/api/analyze-frame`
- Function file: `api/analyze-frame.ts`
- Required env var in Vercel: `QWEN_API_KEY`

### Why this fixes low accuracy after deployment

If `/api/analyze-frame` fails (missing env var / network connectivity / bad response), the frontend used to silently mark each frame as "no face + no subtitle", which looked like model quality dropped.

Now, when all sampled frames fail, frontend throws a clear error so you can quickly identify deployment issues instead of getting false negatives.
