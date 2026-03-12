import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawn } from 'child_process';

export const config = {
  runtime: 'nodejs'
};

type BatchItem = {
  id: string;
  fileName: string;
  storagePath: string;
};

const MAX_BATCH_ITEMS = 50;
const MAX_STORAGE_PATH_LENGTH = 1024;

const sanitizeFileName = (name: string) => {
  const base = (name || 'file').trim();
  const cleaned = base.replace(/[\\/:*?"<>|\x00-\x1F]/g, '_').replace(/\s+/g, ' ');
  return cleaned.slice(0, 180) || 'file';
};

const withUniqueName = (fileName: string, used: Map<string, number>) => {
  const dotIndex = fileName.lastIndexOf('.');
  const hasExt = dotIndex > 0 && dotIndex < fileName.length - 1;
  const name = hasExt ? fileName.slice(0, dotIndex) : fileName;
  const ext = hasExt ? fileName.slice(dotIndex) : '';
  const key = `${name}${ext}`.toLowerCase();

  const count = used.get(key) ?? 0;
  used.set(key, count + 1);

  if (count === 0) return `${name}${ext}`;
  return `${name}(${count})${ext}`;
};

const toStorageObjectUrl = (supabaseUrl: string, bucket: string, storagePath: string) => {
  const encodedPath = storagePath
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${bucket}/${encodedPath}`;
};

const nowDate = () => new Date().toISOString().slice(0, 10);

const readEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim()) return value.trim();
  }
  return '';
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const supabaseUrl = readEnv('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const serviceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE', 'SUPABASE_SECRET_KEY');
  const storageAccessKey = serviceRoleKey || readEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const bucket = readEnv('SUPABASE_STORAGE_BUCKET', 'VITE_SUPABASE_STORAGE_BUCKET') || 'assets';

  if (!supabaseUrl) {
    return res.status(500).json({ error: 'Server storage config missing: SUPABASE_URL' });
  }

  if (!storageAccessKey) {
    return res.status(500).json({
      error: 'Server storage config missing: SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY for public bucket)'
    });
  }

  const items = Array.isArray(req.body?.items) ? (req.body.items as BatchItem[]) : [];

  if (items.length === 0) {
    return res.status(400).json({ error: 'items 不能为空' });
  }

  if (items.length > MAX_BATCH_ITEMS) {
    return res.status(400).json({ error: `单次最多下载 ${MAX_BATCH_ITEMS} 个文件` });
  }

  const validItems: BatchItem[] = [];
  for (const item of items) {
    if (!item || typeof item.storagePath !== 'string' || typeof item.fileName !== 'string') {
      continue;
    }
    const storagePath = item.storagePath.trim();
    if (!storagePath || storagePath.length > MAX_STORAGE_PATH_LENGTH || storagePath.startsWith('/')) {
      continue;
    }
    validItems.push({
      id: String(item.id ?? ''),
      fileName: sanitizeFileName(item.fileName),
      storagePath
    });
  }

  if (validItems.length === 0) {
    return res.status(400).json({ error: '没有可下载的有效文件' });
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'batch-download-'));
  const usedNames = new Map<string, number>();
  const failed: { id: string; fileName: string; reason: string }[] = [];
  const successFiles: string[] = [];

  try {
    for (const item of validItems) {
      const localFileName = withUniqueName(item.fileName, usedNames);
      const localPath = join(tempDir, localFileName);

      try {
        const objectUrl = toStorageObjectUrl(supabaseUrl, bucket, item.storagePath);
        const response = await fetch(objectUrl, {
          headers: {
            Authorization: `Bearer ${storageAccessKey}`,
            apikey: storageAccessKey
          }
        });

        if (!response.ok || !response.body) {
          failed.push({ id: item.id, fileName: item.fileName, reason: `读取失败(${response.status})` });
          continue;
        }

        await pipeline(Readable.fromWeb(response.body as any), createWriteStream(localPath));
        successFiles.push(localFileName);
      } catch (error: any) {
        failed.push({ id: item.id, fileName: item.fileName, reason: error?.message || '未知错误' });
      }
    }

    if (successFiles.length === 0) {
      return res.status(502).json({ error: '所有文件读取失败，请稍后重试' });
    }

    if (failed.length > 0) {
      const report = [
        '以下文件打包失败：',
        ...failed.map(item => `- ${item.fileName} (id=${item.id || 'unknown'}): ${item.reason}`),
        '',
        '说明：Vercel Serverless 存在执行时长与临时磁盘/响应体限制，大批量/超大文件建议拆分下载。'
      ].join('\n');
      const reportName = '打包失败清单.txt';
      await writeFile(join(tempDir, reportName), report, 'utf-8');
      successFiles.push(reportName);
    }

    const zipName = `素材批量下载_${nowDate()}.zip`;
    const encodedZipName = encodeURIComponent(zipName);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedZipName}`);
    res.setHeader('Cache-Control', 'no-store');

    const zipArgs = ['-q', '-', ...successFiles];
    const zipProcess = spawn('zip', zipArgs, { cwd: tempDir });

    zipProcess.on('error', (error) => {
      console.error('[batch-download] zip process error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: '压缩失败' });
      } else {
        res.end();
      }
    });

    zipProcess.stderr.on('data', (chunk) => {
      console.warn('[batch-download] zip stderr:', String(chunk));
    });

    zipProcess.stdout.pipe(res);

    zipProcess.on('close', async (code) => {
      if (code && !res.headersSent) {
        res.status(500).json({ error: '压缩失败' });
      }
      await rm(tempDir, { recursive: true, force: true });
    });
  } catch (error: any) {
    await rm(tempDir, { recursive: true, force: true });
    return res.status(500).json({ error: error?.message || '批量下载失败' });
  }
}
