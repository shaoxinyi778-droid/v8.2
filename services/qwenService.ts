import { Video } from '../types';

// Configuration
const SAMPLE_FRAMES = 6;
const MAX_IMAGE_SIZE = 1024;
const FACE_CONFIDENCE_MIN = 0.7;
const FACE_MIN_FRAMES = 2;
const SUBTITLE_CONFIDENCE_MIN = 0.7;
const SUBTITLE_MIN_FRAMES = 2;

interface FrameAnalysis {
  frame_index: number;
  has_clear_face: boolean;
  face_confidence: number;
  face_description: string;
  has_subtitle: boolean;
  subtitle_confidence: number;
  subtitle_text: string;
}

interface QwenAnalysisResult {
  frame_analyses: FrameAnalysis[];
  overall_summary: {
    total_frames_with_face: number;
    total_frames_with_subtitle: number;
    conclusion: string;
  };
}

export interface VideoAnalysisResult {
  hasHuman: boolean;
  hasSubtitles: boolean;
  orientation: 'portrait' | 'landscape';
  duration: string;
  width: number;
  height: number;
  thumbnailBase64: string;
}

// Helper: Format duration
const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// Helper: Resize image if too large
const resizeImage = async (base64Str: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = img.width;
      const h = img.height;
      if (Math.max(w, h) <= MAX_IMAGE_SIZE) {
        resolve(base64Str);
        return;
      }

      const scale = MAX_IMAGE_SIZE / Math.max(w, h);
      const canvas = document.createElement('canvas');
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // Remove data:image/jpeg;base64, prefix for API if needed, but here we keep it for now and strip later
        resolve(canvas.toDataURL('image/jpeg', 0.85)); 
      } else {
        resolve(base64Str);
      }
    };
    img.src = base64Str;
  });
};

// Helper: Extract frames
export const extractFrames = async (file: File): Promise<{ frames: string[], meta: { duration: string, width: number, height: number, orientation: 'portrait' | 'landscape', thumbnail: string } }> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      URL.revokeObjectURL(video.src);
      video.remove();
    };

    video.onloadedmetadata = async () => {
      try {
        const duration = video.duration || 0;
        const width = video.videoWidth;
        const height = video.videoHeight;
        const orientation = width < height ? 'portrait' : 'landscape';
        
        // Sample points
        const points = [];
        for (let i = 0; i < SAMPLE_FRAMES; i++) {
          points.push((i * duration) / SAMPLE_FRAMES);
        }

        const frames: string[] = [];
        let thumbnail = '';

        for (let i = 0; i < points.length; i++) {
          await new Promise<void>((r) => {
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              r();
            };
            video.addEventListener('seeked', onSeeked);
            video.currentTime = points[i];
          });

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            
            // Resize for API
            const resized = await resizeImage(dataUrl);
            frames.push(resized);

            if (i === 0) {
                // Create a smaller thumbnail for UI
                const thumbCanvas = document.createElement('canvas');
                const scale = Math.min(1, 360 / width);
                thumbCanvas.width = width * scale;
                thumbCanvas.height = height * scale;
                thumbCanvas.getContext('2d')?.drawImage(video, 0, 0, thumbCanvas.width, thumbCanvas.height);
                thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.6);
            }
          }
        }

        resolve({
          frames,
          meta: {
            duration: formatDuration(duration),
            width,
            height,
            orientation,
            thumbnail
          }
        });
        cleanup();
      } catch (e) {
        reject(e);
        cleanup();
      }
    };

    video.onerror = () => {
      reject(new Error("Video load error"));
      cleanup();
    };
  });
};

// Call Qwen API for a single frame via backend proxy
const analyzeFrameWithQwen = async (base64Image: string, index: number): Promise<FrameAnalysis> => {
  // Ensure we have the full data URI
  let imagePayload = base64Image;
  if (!base64Image.startsWith('data:image')) {
      imagePayload = `data:image/jpeg;base64,${base64Image}`;
  }

  try {
    const response = await fetch("/api/analyze-frame", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: imagePayload,
        index
      })
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error("Qwen API Error:", errText);
        throw new Error(`API Error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    // Parse output
    // Structure: output.choices[0].message.content (which might be a list or string)
    let content = data.output?.choices?.[0]?.message?.content;
    let text = "";
    
    if (Array.isArray(content)) {
        text = content.find((c: any) => c.text)?.text || "";
    } else if (typeof content === 'string') {
        text = content;
    } else if (typeof content === 'object' && content.text) {
        text = content.text;
    }

    // Extract JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    
    const result = JSON.parse(jsonMatch[0]);
    
    return {
        frame_index: index,
        has_clear_face: !!result.has_clear_face,
        face_confidence: Number(result.face_confidence) || 0,
        face_description: result.face_description || "",
        has_subtitle: !!result.has_subtitle,
        subtitle_confidence: Number(result.subtitle_confidence) || 0,
        subtitle_text: result.subtitle_text || ""
    };

  } catch (e) {
    console.warn(`Frame ${index} analysis failed:`, e);
    return {
        frame_index: index,
        has_clear_face: false,
        face_confidence: 0,
        face_description: "Error",
        has_subtitle: false,
        subtitle_confidence: 0,
        subtitle_text: ""
    };
  }
};

export const analyzeVideoWithQwen = async (file: File, onProgress?: (msg: string) => void): Promise<VideoAnalysisResult> => {
  // Note: API Key check is now done on the backend
  
  if (onProgress) onProgress("正在提取视频帧...");
  const { frames, meta } = await extractFrames(file);

  if (onProgress) onProgress(`提取完成，开始AI分析 (共${frames.length}帧)...`);
  
  // Analyze frames in parallel (limit concurrency if needed, but 6 is low enough)
  const analysisPromises = frames.map((frame, idx) => analyzeFrameWithQwen(frame, idx));
  const analyses = await Promise.all(analysisPromises);

  const failedFrames = analyses.filter(a => a.face_description === 'Error').length;
  if (failedFrames === analyses.length) {
    throw new Error('AI服务调用失败：所有帧都解析失败。请检查 Vercel 环境变量 QWEN_API_KEY、部署地域网络连通性，以及 /api/analyze-frame 是否可访问。');
  }

  // Aggregate results
  let faceCount = 0;
  let subtitleCount = 0;

  analyses.forEach(a => {
    if (a.has_clear_face && a.face_confidence >= FACE_CONFIDENCE_MIN) faceCount++;
    if (a.has_subtitle && a.subtitle_confidence >= SUBTITLE_CONFIDENCE_MIN) subtitleCount++;
  });

  const hasHuman = faceCount >= FACE_MIN_FRAMES;
  const hasSubtitles = subtitleCount >= SUBTITLE_MIN_FRAMES;

  if (onProgress) onProgress(`分析完成: ${hasHuman ? '有人像' : '无人像'}, ${hasSubtitles ? '有字幕' : '无字幕'}`);

  return {
    hasHuman,
    hasSubtitles,
    orientation: meta.orientation as 'portrait' | 'landscape',
    duration: meta.duration,
    width: meta.width,
    height: meta.height,
    thumbnailBase64: meta.thumbnail
  };
};
