import React, { useState, useEffect } from 'react';
import { FileCode, File, Save, MousePointerClick, Loader2 } from 'lucide-react';
import { VirtualFileSystem } from '../services/virtualFileSystem';

interface CodeEditorProps {
    activeFile: string | null;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ activeFile }) => {
    const [content, setContent] = useState<string>('');
    const [isSaved, setIsSaved] = useState(true);
    const [isLoading, setIsLoading] = useState(false);

    // Load file content when activeFile changes
    useEffect(() => {
        if (!activeFile) {
            setContent('');
            return;
        }

        const loadContent = async () => {
            setIsLoading(true);
            const vfs = VirtualFileSystem.getInstance();
            const fileContent = await vfs.readFile(activeFile);
            setContent(fileContent || '// File not found or empty');
            setIsSaved(true);
            setIsLoading(false);
        };

        loadContent();

        const vfs = VirtualFileSystem.getInstance();
        const unsub = vfs.subscribe(async () => {
            // In a real app, strictly check if *this* file changed to avoid re-renders
            // For now, we simple re-fetch if we are in a "saved" state (safe to overwrite)
            if (isSaved) {
                const updated = await vfs.readFile(activeFile);
                if (updated && updated !== content) {
                    setContent(updated);
                }
            }
        });
        return unsub;
    }, [activeFile]); // Removed isSaved from dependency to prevent infinite loops

    const handleSave = async () => {
        if (activeFile) {
            const vfs = VirtualFileSystem.getInstance();
            await vfs.writeFile(activeFile, content);
            setIsSaved(true);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setContent(e.target.value);
        setIsSaved(false);
    };

    const lines = content.split('\n');

    if (!activeFile) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-gray-950 text-gray-600 space-y-4">
                <MousePointerClick size={48} className="text-gray-800" />
                <div className="text-center">
                    <p className="text-sm font-medium text-gray-500">No file selected</p>
                    <p className="text-xs mt-1">Select a file from the explorer sidebar to edit.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full bg-gray-950 flex-col min-w-0">
            {/* Editor Toolbar */}
            <div className="h-10 border-b border-gray-800 bg-gray-900 flex items-center justify-between px-4">
                <div className="flex items-center gap-2 text-sm text-gray-300">
                    <File size={14} className="text-indigo-400" />
                    <span className="font-mono">{activeFile}</span>
                    {!isSaved && <span className="text-[10px] text-yellow-500 animate-pulse">● Unsaved</span>}
                </div>
                <button
                    onClick={handleSave}
                    className={`flex items-center gap-2 px-3 py-1 rounded-sm text-xs font-medium transition-colors ${isSaved ? 'text-gray-500 hover:text-gray-300' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}
                >
                    <Save size={12} /> Save
                </button>
            </div>

            {/* Editor Area */}
            <div className="flex-1 relative bg-gray-950 overflow-hidden">
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500 gap-2">
                        <Loader2 className="animate-spin" size={20} /> Loading...
                    </div>
                ) : (
                    <div className="absolute inset-0 flex font-mono text-sm leading-6">
                        {/* Line Numbers */}
                        <div className="w-10 bg-gray-900/50 border-r border-gray-800 text-gray-600 text-right pr-2 py-4 select-none overflow-hidden">
                            {lines.map((_, i) => (
                                <div key={i}>{i + 1}</div>
                            ))}
                        </div>
                        {/* Editable Area */}
                        <textarea
                            className="flex-1 p-4 bg-transparent text-gray-300 outline-hidden resize-none whitespace-pre"
                            value={content}
                            onChange={handleChange}
                            spellCheck={false}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};