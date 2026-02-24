import React, { useEffect, useState, useRef } from 'react';
import { LogItem, Video, Project } from '../types';
import { uploadVideoToCloud } from '../services/cloudService';
import { analyzeVideoWithQwen } from '../services/qwenService';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (newVideos: Video[]) => void;
  projects?: Project[];
  initialProjectId?: number;
  existingVideos: Video[];
  isGuest: boolean;
}

export const UploadModal: React.FC<UploadModalProps> = ({ 
  isOpen, 
  onClose, 
  onComplete, 
  projects = [], 
  initialProjectId,
  existingVideos,
  isGuest
}) => {
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'complete'>('idle');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [targetProjectId, setTargetProjectId] = useState<string>('');

  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('准备上传...');
  const [logs, setLogs] = useState<LogItem[]>([]);
  
  const logContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setUploadState('idle');
      setSelectedFiles([]);
      setProgress(0);
      setStatusText('准备上传...');
      setLogs([]);
      setTargetProjectId(initialProjectId ? initialProjectId.toString() : '');
    }
  }, [isOpen, initialProjectId]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const addLog = (text: string, type: LogItem['type']) => {
    setLogs(prev => [...prev, { id: Date.now().toString() + Math.random(), text, type }]);
  };

  const startUpload = () => {
    if (selectedFiles.length === 0) return;
    setUploadState('uploading');
    processFiles();
  };

  const processFiles = async () => {
    const totalFiles = selectedFiles.length;
    let completedFiles = 0;
    const finalProjectId = targetProjectId ? parseInt(targetProjectId) : undefined;
    const processedFileNames = new Set(existingVideos.map(v => v.title));

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      setProgress(((i) / totalFiles) * 100);

      if (processedFileNames.has(file.name)) {
        addLog(`跳过: ${file.name} (已存在)`, 'done');
        completedFiles++;
        continue;
      }
      
      addLog(`[${i+1}/${totalFiles}] Qwen AI 解析中: ${file.name}`, 'loading');
      
      try {
        await new Promise(r => setTimeout(r, 50)); 
        
        // 1. Qwen Analysis
        const meta = await analyzeVideoWithQwen(file, (msg) => {
            // Optional: Update status text or log based on progress
            // addLog(msg, 'loading'); 
        });

        const typeStr = meta.orientation === 'portrait' ? '竖屏' : '横屏';
        const humanStr = meta.hasHuman ? '人像' : '空镜';
        const subStr = meta.hasSubtitles ? '有字幕' : '无字幕';
        
        addLog(`解析结果: ${typeStr} / ${humanStr} / ${subStr}`, 'ai');

        let newVideo: Video;

        if (isGuest) {
            // 2a. Guest Mode: Create Local Blob URL
            addLog(`处理本地预览...`, 'loading');
            const blobUrl = URL.createObjectURL(file);
            
            newVideo = {
                id: Date.now() + Math.random(),
                title: file.name,
                duration: meta.duration,
                orientation: meta.orientation,
                hasHuman: meta.hasHuman,
                hasSubtitles: meta.hasSubtitles,
                color: 'bg-gray-100',
                heightClass: meta.orientation === 'portrait' ? 'aspect-[9/16]' : 'aspect-video',
                uploadDate: new Date().toISOString().split('T')[0],
                url: blobUrl,
                thumbnail: meta.thumbnailBase64,
                projectId: finalProjectId,
                isDeleted: false,
                isFavorite: false
            };
            addLog(`就绪: ${file.name} (本地)`, 'success');
        } else {
            // 2b. Cloud Mode: Upload to Supabase
            addLog(`正在上传至云端...`, 'loading');
            newVideo = await uploadVideoToCloud(file, {
              ...meta,
              projectId: finalProjectId
            });
            addLog(`上传云端成功: ${file.name}`, 'success');
        }

        processedFileNames.add(file.name);
        onComplete([newVideo]);
        
        completedFiles++;
        setProgress((completedFiles / totalFiles) * 100);

      } catch (err: any) {
        console.error(err);
        addLog(`失败: ${file.name} - ${err.message}`, 'error');
      }
    }

    setStatusText('处理完成');
    setProgress(100);
    setUploadState('complete');
    
    setTimeout(onClose, 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center transition-opacity duration-300">
      <div className="bg-white rounded-xl shadow-2xl w-96 p-6 transform transition-transform duration-300 scale-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-800">
            {uploadState === 'idle' ? (isGuest ? '添加本地素材' : '上传视频到云端') : '正在处理'}
            {uploadState !== 'idle' && (
              <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full ml-2">
                剩余 {selectedFiles.length - Math.floor((progress / 100) * selectedFiles.length)} 个
              </span>
            )}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
             <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>
        
        {uploadState === 'idle' ? (
          <div className="space-y-4">
            
            <div className="mb-2">
               <label className="block text-xs font-semibold text-gray-500 mb-1">归档到项目:</label>
               <select 
                 value={targetProjectId}
                 onChange={(e) => setTargetProjectId(e.target.value)}
                 className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
               >
                 <option value="">全部素材 (不归档)</option>
                 {projects.map(p => (
                   <option key={p.id} value={p.id}>{p.name}</option>
                 ))}
               </select>
            </div>

            <div 
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 hover:border-indigo-400 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <input 
                type="file" 
                multiple 
                accept="video/*" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                className="hidden" 
              />
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-3">
                <i className="fa-solid fa-cloud-arrow-up text-xl"></i>
              </div>
              <p className="text-sm font-medium text-gray-700">点击或拖拽上传视频</p>
              <p className="text-xs text-gray-400 mt-1">
                  {isGuest ? 'Qwen AI (人像+字幕) 解析' : 'AI 智能解析 + 云端加密存储'}
              </p>
            </div>

            {selectedFiles.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                <p className="text-xs font-semibold text-gray-500 mb-2">已选 {selectedFiles.length} 个文件:</p>
                <ul className="space-y-1">
                  {selectedFiles.map((file, idx) => (
                    <li key={idx} className="text-xs text-gray-700 flex items-center gap-2 truncate">
                      <i className="fa-regular fa-file-video text-gray-400"></i>
                      {file.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button 
              onClick={startUpload}
              disabled={selectedFiles.length === 0}
              className={`w-full py-2.5 rounded-lg font-medium transition-colors ${
                selectedFiles.length > 0 
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isGuest ? '开始本地解析' : '开始解析并上传'}
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <div className="flex justify-between text-xs font-semibold text-gray-600 mb-1">
                <span>{statusText}</span>
                {progress < 100 && <i className="fa-solid fa-circle-notch fa-spin text-indigo-600"></i>}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 h-40 overflow-y-auto custom-scrollbar" ref={logContainerRef}>
              <ul className="space-y-3 text-xs">
                {logs.map((log) => {
                  let iconClass = '';
                  let colorClass = '';
                  switch(log.type) {
                    case 'loading': iconClass = 'fa-solid fa-cloud-arrow-up'; colorClass = 'text-blue-600'; break;
                    case 'success': iconClass = 'fa-solid fa-check'; colorClass = 'text-green-600'; break;
                    case 'ai': iconClass = 'fa-solid fa-microchip'; colorClass = 'text-purple-600'; break;
                    case 'error': iconClass = 'fa-solid fa-times'; colorClass = 'text-red-600'; break;
                    case 'done': iconClass = 'fa-solid fa-folder-open'; colorClass = 'text-gray-800 font-medium'; break;
                  }
                  return (
                    <li key={log.id} className="flex items-start gap-2 animate-pulse-once">
                      <span className={`${colorClass} mt-0.5`}><i className={iconClass}></i></span>
                      <span>{log.text}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
};