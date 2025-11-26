import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, File, Folder, Loader2 } from 'lucide-react';
import { VirtualFileSystem } from '../services/virtualFileSystem';

interface FileExplorerProps {
  onSelectFile: (path: string) => void;
  activeFile: string | null;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ onSelectFile, activeFile }) => {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const vfs = VirtualFileSystem.getInstance();

    const updateFiles = async () => {
      setLoading(true);
      const tree = await vfs.getDirectoryTree();
      setFiles(tree);
      setLoading(false);
    };

    // Initial load
    updateFiles();

    // Subscribe to changes
    return vfs.subscribe(updateFiles);
  }, []);

  if (loading && files.length === 0) {
    return <div className="p-4 text-gray-500 flex items-center gap-2 text-xs"><Loader2 className="animate-spin" size={12} /> Loading...</div>;
  }

  return (
    <div className="pl-2">
      {files.map((file, i) => (
        <FileTreeItem
          key={file.path + i}
          item={file}
          level={0}
          onSelect={onSelectFile}
          activeFile={activeFile}
        />
      ))}
    </div>
  );
};

interface FileTreeItemProps {
  item: any;
  level: number;
  onSelect: (path: string) => void;
  activeFile: string | null;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({ item, level, onSelect, activeFile }) => {
  const [isOpen, setIsOpen] = useState(false);
  const paddingLeft = level * 12 + 8;
  const isActive = activeFile === item.path;

  const handleClick = () => {
    if (item.isDirectory) {
      setIsOpen(!isOpen);
    } else {
      onSelect(item.path);
    }
  };

  return (
    <div>
      <div
        onClick={handleClick}
        className={`flex items-center gap-1 py-1 pr-2 cursor-pointer select-none text-sm transition-colors ${isActive
          ? 'bg-indigo-600/20 text-indigo-300 border-r-2 border-indigo-500'
          : 'hover:bg-gray-800 text-gray-400 hover:text-gray-100'
          }`}
        style={{ paddingLeft: `${paddingLeft}px` }}
      >
        <span className="opacity-70">
          {item.isDirectory ? (
            isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : <div className="w-3.5" />}
        </span>
        <span className="opacity-70">
          {item.isDirectory ? <Folder size={14} className="text-indigo-400" /> : <File size={14} />}
        </span>
        <span className="truncate">{item.name}</span>
      </div>
      {isOpen && item.children && (
        <div>
          {item.children.map((child: any, i: number) => (
            <FileTreeItem
              key={child.path + i}
              item={child}
              level={level + 1}
              onSelect={onSelect}
              activeFile={activeFile}
            />
          ))}
        </div>
      )}
      {/* Visual placeholder for empty directories */}
      {isOpen && (!item.children || item.children.length === 0) && item.isDirectory && (
        <div className="text-[10px] text-gray-600 py-1 select-none italic" style={{ paddingLeft: `${paddingLeft + 20}px` }}>
          (empty)
        </div>
      )}
    </div>
  );
};