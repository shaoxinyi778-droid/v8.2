import React from 'react';
import { FilterFolder, Project, TopFilterState } from '../types';
import { supabase } from '../lib/supabaseClient';
import { 
  Folder, 
  Heart, 
  Trash2, 
  Smartphone, 
  Monitor, 
  User, 
  Image as ImageIcon, 
  Type, 
  TypeOutline,
  Wand2,
  Plus,
  Video,
  LogOut,
  X
} from 'lucide-react';

interface SidebarProps {
  currentFolder: FilterFolder;
  onFilterChange: (folder: FilterFolder) => void;
  onUploadClick: () => void;
  projects: Project[];
  onCreateProject: () => void;
  onDeleteProject: (id: number, e: React.MouseEvent) => void;
  userEmail?: string;
  topFilter: TopFilterState;
  onTopFilterChange: (key: keyof TopFilterState, value: any) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentFolder, 
  onFilterChange, 
  onUploadClick,
  projects,
  onCreateProject,
  onDeleteProject,
  userEmail,
  topFilter,
  onTopFilterChange
}) => {
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const NavItem = ({ icon, label, active, onClick, className }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void, className?: string }) => (
    <div 
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
        active 
          ? 'bg-indigo-50 text-indigo-700 font-medium' 
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      } ${className || ''}`}
    >
      <div className={active ? 'text-indigo-600' : 'text-gray-400'}>
        {icon}
      </div>
      <span className="truncate">{label}</span>
    </div>
  );

  return (
    <aside className="w-64 bg-[#f8f9fa] border-r border-gray-100 flex flex-col h-full shrink-0 z-20">
      {/* Logo Area */}
      <div className="h-16 flex items-center px-6 text-indigo-600 font-bold text-lg gap-2">
        <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center text-white">
          <Video size={14} />
        </div>
        智能素材库
      </div>

      {/* Add Button */}
      <div className="px-4 py-2">
        <button 
          onClick={onUploadClick}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={16} />
          {userEmail ? '上传视频' : '添加本地视频'}
        </button>
      </div>

      {/* Navigation Menu */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 scrollbar-thin scrollbar-thumb-gray-200">
        
        {/* Basic Overview */}
        <div>
          <div className="text-xs text-gray-400 font-medium px-2 mb-2">素材库概览</div>
          <div className="space-y-0.5">
            <NavItem 
              icon={<Folder size={16} />} 
              label="全部素材" 
              active={currentFolder === 'all'} 
              onClick={() => {
                onFilterChange('all');
                // Optional: Reset filters when clicking 'All'
                // onTopFilterChange('orientation', 'all');
                // onTopFilterChange('content', 'all');
                // onTopFilterChange('subtitle', 'all');
              }} 
            />
            <NavItem 
              icon={<Heart size={16} />} 
              label="收藏夹" 
              active={currentFolder === 'fav'} 
              onClick={() => onFilterChange('fav')} 
            />
            <NavItem 
              icon={<Trash2 size={16} />} 
              label="回收站" 
              active={currentFolder === 'trash'} 
              onClick={() => onFilterChange('trash')} 
            />
          </div>
        </div>

        {/* Smart Attributes */}
        <div>
          <div className="flex items-center justify-between text-xs text-gray-400 font-medium px-2 mb-2">
            <span>智能属性 (AI)</span>
            <Wand2 size={12} className="text-indigo-400" />
          </div>
          
          {/* Orientation */}
          <div className="space-y-0.5 mb-2">
            <NavItem 
              icon={<Smartphone size={16} />} 
              label="竖屏素材" 
              active={topFilter.orientation === 'portrait'}
              onClick={() => onTopFilterChange('orientation', topFilter.orientation === 'portrait' ? 'all' : 'portrait')} 
            />
            <NavItem 
              icon={<Monitor size={16} />} 
              label="横屏素材" 
              active={topFilter.orientation === 'landscape'}
              onClick={() => onTopFilterChange('orientation', topFilter.orientation === 'landscape' ? 'all' : 'landscape')} 
            />
          </div>

          {/* Content */}
          <div className="space-y-0.5 mb-2">
            <NavItem 
              icon={<User size={16} />} 
              label="有人像" 
              active={topFilter.content === 'human'}
              onClick={() => onTopFilterChange('content', topFilter.content === 'human' ? 'all' : 'human')} 
            />
            <NavItem 
              icon={<ImageIcon size={16} />} 
              label="空镜" 
              active={topFilter.content === 'scenery'}
              onClick={() => onTopFilterChange('content', topFilter.content === 'scenery' ? 'all' : 'scenery')} 
            />
          </div>

          {/* Subtitle */}
          <div className="space-y-0.5">
            <NavItem 
              icon={<Type size={16} />} 
              label="有字幕" 
              active={topFilter.subtitle === 'with'}
              onClick={() => onTopFilterChange('subtitle', topFilter.subtitle === 'with' ? 'all' : 'with')} 
            />
            <NavItem 
              icon={<TypeOutline size={16} />} 
              label="无字幕" 
              active={topFilter.subtitle === 'without'}
              onClick={() => onTopFilterChange('subtitle', topFilter.subtitle === 'without' ? 'all' : 'without')} 
            />
          </div>
        </div>

        {/* Custom Projects */}
        <div>
          <div className="flex items-center justify-between text-xs text-gray-400 font-medium px-2 mb-2 group cursor-pointer hover:text-indigo-600" onClick={onCreateProject}>
            <span>自定义项目</span>
            <Plus size={14} />
          </div>
          <div className="space-y-0.5">
            {projects.map(project => (
              <div key={project.id} className="group/item relative">
                <NavItem 
                  icon={<Folder size={16} className="text-yellow-500" />} 
                  label={project.name}
                  active={currentFolder === `project-${project.id}`}
                  onClick={() => onFilterChange(`project-${project.id}`)}
                />
                <button 
                  onClick={(e) => onDeleteProject(project.id, e)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-opacity p-1"
                  title="删除项目"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {projects.length === 0 && (
              <div className="text-xs text-gray-400 px-2 italic">暂无项目，点击上方 + 号新建</div>
            )}
          </div>
        </div>
      </div>

      {/* Footer / User Profile */}
      <div className="p-4 border-t border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${userEmail ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-500'}`}>
            {userEmail ? userEmail[0].toUpperCase() : <User size={16} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate" title={userEmail}>
              {userEmail || '访客模式'}
            </div>
            <div className={`text-xs flex items-center gap-1 ${userEmail ? 'text-green-600' : 'text-gray-500'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${userEmail ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              {userEmail ? '已同步云端' : '本地暂存'}
            </div>
          </div>
          {userEmail && (
            <button 
              onClick={handleLogout}
              className="text-gray-400 hover:text-red-500 p-1 transition-colors"
              title="退出登录"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};