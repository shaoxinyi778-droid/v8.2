import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { VideoCard } from './components/VideoCard';
import { BatchActionBar } from './components/BatchActionBar';
import { UploadModal } from './components/UploadModal';
import { DetailModal } from './components/DetailModal';
import { Toast, ToastState } from './components/Toast';
import { LoginModal } from './components/LoginModal';
import { FilterFolder, TopFilterState, Video, Project } from './types';
import { 
  fetchRemoteVideos, 
  fetchRemoteProjects, 
  createRemoteProject, 
  deleteRemoteProject,
  updateRemoteVideoStatus,
  deleteRemoteVideoPermanently
} from './services/cloudService';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Data State
  const [videos, setVideos] = useState<Video[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // UI State
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedVideoDetail, setSelectedVideoDetail] = useState<Video | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<FilterFolder>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [topFilter, setTopFilter] = useState<TopFilterState>({ orientation: 'all', content: 'all', subtitle: 'all' });
  const [toast, setToast] = useState<ToastState>({ message: '', type: 'success', visible: false });

  // Auth & Init
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      // When session changes (login/logout), reload data appropriate to state
      if (session) {
          loadCloudData();
      } else {
          // Switch to Guest Mode: Clear cloud data
          setVideos([]); 
          setProjects([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch Data when Session exists
  useEffect(() => {
    if (session) {
      loadCloudData();
    }
  }, []); // Only initial load helper, auth listener handles the rest

  const loadCloudData = async () => {
    try {
      const [remoteVideos, remoteProjects] = await Promise.all([
        fetchRemoteVideos(),
        fetchRemoteProjects()
      ]);
      setVideos(remoteVideos);
      setProjects(remoteProjects);
      showToast('已加载云端数据', 'success');
    } catch (error) {
      console.error("Failed to load cloud data", error);
      showToast('云端数据加载失败', 'error');
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  // ---------------- Project Logic ----------------
  const handleCreateProject = async () => {
    if (!session) {
        showToast('访客模式下无法创建项目，请先登录', 'error');
        setIsLoginModalOpen(true);
        return;
    }

    const name = window.prompt("请输入新项目名称：");
    if (name && name.trim()) {
      try {
        const newProject = await createRemoteProject(name.trim());
        if (newProject) {
          setProjects(prev => [newProject, ...prev]);
          showToast(`已创建项目 "${name}"`, 'success');
        }
      } catch (e) {
        showToast('创建项目失败', 'error');
      }
    }
  };

  const handleDeleteProject = async (projectId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!session) return;
    
    if (window.confirm("确定要删除此项目吗？项目内的视频将保留在“全部素材”中。")) {
      try {
        await deleteRemoteProject(projectId);
        setProjects(prev => prev.filter(p => p.id !== projectId));
        if (currentFolder === `project-${projectId}`) {
          setCurrentFolder('all');
        }
        setVideos(prev => prev.map(v => v.projectId === projectId ? { ...v, projectId: undefined } : v));
        showToast('项目已删除', 'success');
      } catch (e) {
        showToast('删除项目失败', 'error');
      }
    }
  };

  // ---------------- Filtering Logic ----------------
  const filteredVideos = useMemo(() => {
    return videos.filter(video => {
      const isDeleted = !!video.isDeleted;
      
      if (isDeleted && currentFolder !== 'trash') return false;
      if (!isDeleted && currentFolder === 'trash') return false;

      if (currentFolder.startsWith('project-')) {
        const projectId = parseInt(currentFolder.split('-')[1]);
        if (video.projectId !== projectId) return false;
      } else {
        switch (currentFolder) {
          case 'fav': if (!video.isFavorite) return false; break;
          case 'trash': if (!isDeleted) return false; break;
          case 'all': default: break;
        }
      }

      if (searchTerm) {
        if (!video.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      }

      if (topFilter.orientation !== 'all' && video.orientation !== topFilter.orientation) return false;
      if (topFilter.content !== 'all') {
        const isHuman = topFilter.content === 'human';
        if (video.hasHuman !== isHuman) return false;
      }
      if (topFilter.subtitle !== 'all') {
        const hasSub = !!video.hasSubtitles;
        if (topFilter.subtitle === 'with' && !hasSub) return false;
        if (topFilter.subtitle === 'without' && hasSub) return false;
      }

      return true;
    });
  }, [videos, currentFolder, searchTerm, topFilter]);

  // ---------------- Selection & Batch Logic ----------------
  const toggleSelectionMode = () => {
    if (isSelectionMode) {
      setSelectedIds(new Set());
      setIsSelectionMode(false);
    } else {
      setIsSelectionMode(true);
    }
  };

  const handleToggleSelect = (id: number) => {
    if (!isSelectionMode) setIsSelectionMode(true);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(filteredVideos.map(v => v.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const handleBatchDownload = () => {
    if (selectedIds.size === 0) return showToast('请先选择视频', 'error');
    const selectedVideos = videos.filter(v => selectedIds.has(v.id));
    selectedVideos.forEach((video, idx) => {
      if (video.url) {
        setTimeout(() => {
          const a = document.createElement('a');
          a.href = video.url!;
          a.download = video.title;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }, idx * 500);
      }
    });
    showToast(`已触发下载任务`, 'success');
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return showToast('请先选择视频', 'error');
    const ids = Array.from(selectedIds) as number[];

    if (!session) {
        // Guest mode batch delete (local only)
        if (window.confirm(`确定要移除选中的 ${ids.length} 个本地视频吗？`)) {
            setVideos(prev => prev.filter(v => !selectedIds.has(v.id)));
            setSelectedIds(new Set());
            setIsSelectionMode(false);
        }
        return;
    }

    if (currentFolder === 'trash') {
      if (!window.confirm(`确定要彻底删除选中的 ${ids.length} 个视频吗？此操作无法撤销。`)) return;
      try {
        await Promise.all(ids.map(id => deleteRemoteVideoPermanently(id)));
        setVideos(prev => prev.filter(v => !selectedIds.has(v.id)));
        showToast(`已彻底删除`, 'success');
      } catch (e) { showToast('批量删除失败', 'error'); }
    } else {
      if (!window.confirm(`确定要将选中的 ${ids.length} 个视频移至回收站吗？`)) return;
      try {
        await Promise.all(ids.map(id => updateRemoteVideoStatus(id, { isDeleted: true })));
        setVideos(prev => prev.map(v => selectedIds.has(v.id) ? { ...v, isDeleted: true } : v));
        showToast(`已移至回收站`, 'success');
      } catch (e) { showToast('操作失败', 'error'); }
    }
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  // ---------------- Single Video Actions ----------------
  const handleDownloadVideo = (video: Video) => {
    if (video.url) {
      const a = document.createElement('a');
      a.href = video.url;
      a.download = video.title;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleToggleFavorite = async (id: number) => {
    const video = videos.find(v => v.id === id);
    if (!video) return;
    const newStatus = !video.isFavorite;

    // Optimistic Update
    setVideos(prev => prev.map(v => v.id === id ? { ...v, isFavorite: newStatus } : v));
    if (selectedVideoDetail?.id === id) {
      setSelectedVideoDetail(prev => prev ? ({ ...prev, isFavorite: newStatus }) : null);
    }

    if (session) {
        try {
            await updateRemoteVideoStatus(id, { isFavorite: newStatus });
            showToast(newStatus ? '已收藏' : '已取消收藏');
        } catch (e) {
            // Revert on error
            setVideos(prev => prev.map(v => v.id === id ? { ...v, isFavorite: !newStatus } : v));
            showToast('操作失败', 'error');
        }
    }
  };

  const handleDeleteVideo = async (id: number) => {
    const video = videos.find(v => v.id === id);
    if (!video) return;

    // Guest Mode Delete
    if (!session) {
        setVideos(prev => prev.filter(v => v.id !== id));
        setSelectedVideoDetail(null);
        showToast('已移除本地视频', 'success');
        return;
    }

    // Cloud Mode Delete
    if (video.isDeleted) {
      if (!window.confirm("确定要彻底删除此视频吗？")) return;
      try {
        await deleteRemoteVideoPermanently(id);
        setVideos(prev => prev.filter(v => v.id !== id));
        setSelectedVideoDetail(null);
        showToast('已彻底删除', 'success');
      } catch (e) { showToast('删除失败', 'error'); }
    } else {
      if (!window.confirm("确定移至回收站？")) return;
      try {
        await updateRemoteVideoStatus(id, { isDeleted: true });
        setVideos(prev => prev.map(v => v.id === id ? { ...v, isDeleted: true } : v));
        setSelectedVideoDetail(null);
        showToast('已移至回收站', 'success');
      } catch (e) { showToast('操作失败', 'error'); }
    }
  };

  const handleRestoreVideo = async (id: number) => {
    if (!session) return;
    try {
      await updateRemoteVideoStatus(id, { isDeleted: false });
      setVideos(prev => prev.map(v => v.id === id ? { ...v, isDeleted: false } : v));
      if (selectedVideoDetail?.id === id) {
        setSelectedVideoDetail(prev => prev ? ({ ...prev, isDeleted: false }) : null);
      }
      showToast('已恢复', 'success');
    } catch (e) { showToast('恢复失败', 'error'); }
  };

  const handleUploadComplete = (newVideos: Video[]) => {
    setVideos(prev => [...newVideos, ...prev]);
    showToast(session ? `成功上传 ${newVideos.length} 个视频` : `已添加 ${newVideos.length} 个本地视频`, 'success');
  };

  const getFolderTitle = () => {
    if (currentFolder.startsWith('project-')) {
      const pid = parseInt(currentFolder.split('-')[1]);
      const project = projects.find(p => p.id === pid);
      return project ? `项目：${project.name}` : '未知项目';
    }
    switch (currentFolder) {
      case 'fav': return '收藏夹';
      case 'trash': return '回收站';
      case 'all': 
      default:
        const parts = [];
        if (topFilter.orientation !== 'all') parts.push(topFilter.orientation === 'portrait' ? '竖屏' : '横屏');
        if (topFilter.content !== 'all') parts.push(topFilter.content === 'human' ? '有人像' : '空镜');
        if (topFilter.subtitle !== 'all') parts.push(topFilter.subtitle === 'with' ? '有字幕' : '无字幕');
        return parts.length > 0 ? parts.join(' - ') : '全部素材';
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50 text-gray-400">Loading...</div>;

  return (
    <div className="flex h-full">
      <Sidebar 
        currentFolder={currentFolder} 
        onFilterChange={setCurrentFolder} 
        onUploadClick={() => setIsUploadModalOpen(true)}
        projects={projects}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        userEmail={session?.user?.email}
        topFilter={topFilter}
        onTopFilterChange={(k, v) => setTopFilter(prev => ({ ...prev, [k]: v }))}
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-slate-50">
        <TopBar 
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          isSelectionMode={isSelectionMode}
          onToggleSelectionMode={toggleSelectionMode}
          topFilter={topFilter}
          onTopFilterChange={(k, v) => setTopFilter(prev => ({ ...prev, [k]: v }))}
          userEmail={session?.user?.email}
          onLoginClick={() => setIsLoginModalOpen(true)}
        />

        <div className="flex-1 overflow-y-auto p-6 pb-24">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{getFolderTitle()}</h1>
              <p className="text-sm text-gray-500 mt-1">
                  {session ? `云端共 ${filteredVideos.length} 个项目` : `本地暂存 ${filteredVideos.length} 个项目 (未同步)`}
              </p>
            </div>
            <div className="text-sm text-gray-500">
              按 <span className="font-medium text-gray-700 cursor-pointer">上传时间 <i className="fa-solid fa-chevron-down text-xs"></i></span> 排序
            </div>
          </div>

          {filteredVideos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <i className={`fa-solid ${session ? 'fa-cloud' : 'fa-laptop'} text-5xl mb-4 opacity-50`}></i>
              <p>{session ? '暂无云端内容' : '暂无本地素材'}</p>
              <button 
                  onClick={() => setIsUploadModalOpen(true)}
                  className="mt-4 text-indigo-600 hover:text-indigo-800 text-sm font-medium"
              >
                  {session ? '上传视频到此项目' : '添加视频进行解析'}
              </button>
            </div>
          ) : (
            <div className="columns-2 lg:columns-3 xl:columns-4 gap-6 pb-10">
              {filteredVideos.map(video => (
                <VideoCard 
                  key={video.id} 
                  video={video}
                  isSelected={selectedIds.has(video.id)}
                  isSelectionMode={isSelectionMode}
                  onToggleSelect={handleToggleSelect}
                  onClick={setSelectedVideoDetail}
                />
              ))}
            </div>
          )}
        </div>

        <BatchActionBar 
          isVisible={isSelectionMode}
          selectedCount={selectedIds.size}
          onSelectAll={selectAll}
          onDeselectAll={deselectAll}
          onDownload={handleBatchDownload}
          onDelete={handleBatchDelete}
          onClose={toggleSelectionMode}
        />
      </main>

      <UploadModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)}
        onComplete={handleUploadComplete}
        projects={projects}
        initialProjectId={currentFolder.startsWith('project-') ? parseInt(currentFolder.split('-')[1]) : undefined}
        existingVideos={videos}
        isGuest={!session}
      />

      <DetailModal 
        video={selectedVideoDetail} 
        onClose={() => setSelectedVideoDetail(null)}
        onDownload={handleDownloadVideo}
        onFavorite={handleToggleFavorite}
        onDelete={handleDeleteVideo}
        onRestore={handleRestoreVideo}
        onShare={() => showToast('链接已复制', 'success')}
      />

      <LoginModal 
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={() => setIsLoginModalOpen(false)}
      />

      <Toast toast={toast} />
    </div>
  );
}

export default App;