import React from 'react';
import { TopFilterState } from '../types';
import { Search, CheckSquare, User } from 'lucide-react';

interface TopBarProps {
  searchTerm: string;
  onSearchChange: (val: string) => void;
  isSelectionMode: boolean;
  onToggleSelectionMode: () => void;
  topFilter: TopFilterState;
  onTopFilterChange: (key: keyof TopFilterState, value: string) => void;
  userEmail?: string;
  onLoginClick: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  searchTerm,
  onSearchChange,
  isSelectionMode,
  onToggleSelectionMode,
  topFilter,
  onTopFilterChange,
  userEmail,
  onLoginClick
}) => {

  const SegmentedControl = ({ options, activeValue, onChange }: { options: { label: string, value: string }[], activeValue: string, onChange: (val: string) => void }) => (
    <div className="flex bg-gray-100 p-1 rounded-lg text-xs">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-md transition-all duration-200 ${
            activeValue === opt.value
              ? 'bg-white shadow-sm text-gray-900 font-medium'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 shrink-0 z-10">
      
      {/* Search */}
      <div className="relative w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input 
          type="text" 
          placeholder="搜索文件名、标签..." 
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-4 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
        />
      </div>

      {/* Right Toolbar */}
      <div className="flex items-center gap-4">
        
        {/* Batch Select Button */}
        <button 
          onClick={onToggleSelectionMode} 
          className={`flex items-center gap-1.5 text-sm border px-3 py-1.5 rounded-lg transition-colors ${
            isSelectionMode 
              ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-medium' 
              : 'text-gray-600 hover:text-gray-900 border-gray-200'
          }`}
        >
          <CheckSquare size={14} />
          批量管理
        </button>

        <div className="w-px h-6 bg-gray-200 mx-1"></div>

        {/* Filter Groups */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {/* Orientation */}
          <SegmentedControl 
            options={[
              { label: '全部', value: 'all' },
              { label: '竖屏', value: 'portrait' },
              { label: '横屏', value: 'landscape' },
            ]}
            activeValue={topFilter.orientation}
            onChange={(val) => onTopFilterChange('orientation', val)}
          />
          {/* Content */}
          <SegmentedControl 
            options={[
              { label: '全部', value: 'all' },
              { label: '人像', value: 'human' },
              { label: '空镜', value: 'scenery' },
            ]}
            activeValue={topFilter.content}
            onChange={(val) => onTopFilterChange('content', val)}
          />
          {/* Subtitle */}
          <SegmentedControl 
            options={[
              { label: '全部', value: 'all' },
              { label: '有字幕', value: 'with' },
              { label: '无字幕', value: 'without' },
            ]}
            activeValue={topFilter.subtitle}
            onChange={(val) => onTopFilterChange('subtitle', val)}
          />
        </div>

        <div className="w-px h-6 bg-gray-200 mx-1"></div>

        {/* Login / User Info */}
        {userEmail ? (
             <div className="flex items-center gap-2 text-sm text-indigo-600 font-medium bg-indigo-50 px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                云端同步中
             </div>
        ) : (
            <button 
                onClick={onLoginClick}
                className="bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors shadow-sm"
            >
                登录云端
            </button>
        )}
      </div>
    </header>
  );
};