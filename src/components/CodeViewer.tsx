import React, { useState } from 'react';
import { FileCode, File, Copy, Check } from 'lucide-react';

// Simple mocked content for files
const MOCK_FILES: Record<string, string> = {
    'src/auth/service.ts': `import { db } from '../db';
import { User } from '../types';

export class AuthService {
    /**
     * Authenticates a user based on credentials
     */
    async login(email: string, pass: string): Promise<User | null> {
        // MAKER Consensus: Optimized query
        const user = await db.users.findUnique({ where: { email } });
        
        if (!user || !user.validatePassword(pass)) {
            return null;
        }

        return user;
    }
}`,
    'src/utils/jwt.ts': `import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'dev-secret';

export function sign(payload: any): string {
    return jwt.sign(payload, SECRET, { expiresIn: '1h' });
}

export function verify(token: string): any {
    try {
        return jwt.verify(token, SECRET);
    } catch (e) {
        return null;
    }
}`
};

export const CodeViewer: React.FC = () => {
    const [selectedFile, setSelectedFile] = useState<string>('src/auth/service.ts');
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const content = MOCK_FILES[selectedFile] || '// Select a file to view content';
    const lines = content.split('\n');

    return (
        <div className="flex h-full bg-gray-950">
            {/* Sidebar File List */}
            <div className="w-48 border-r border-gray-800 bg-gray-900/50 flex flex-col">
                <div className="p-3 text-xs font-semibold text-gray-500 uppercase">Open Files</div>
                {Object.keys(MOCK_FILES).map(fileName => (
                    <button
                        key={fileName}
                        onClick={() => setSelectedFile(fileName)}
                        className={`flex items-center gap-2 px-3 py-2 text-xs text-left truncate transition-colors ${
                            selectedFile === fileName 
                                ? 'bg-indigo-600/20 text-indigo-300 border-r-2 border-indigo-500' 
                                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                        }`}
                    >
                        <FileCode size={12} />
                        <span className="truncate">{fileName.split('/').pop()}</span>
                    </button>
                ))}
            </div>

            {/* Editor Area */}
            <div className="flex-1 flex flex-col min-w-0">
                <div className="h-10 border-b border-gray-800 bg-gray-900 flex items-center justify-between px-4">
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                        <File size={14} className="text-indigo-400" />
                        {selectedFile}
                    </div>
                    <button 
                        onClick={handleCopy}
                        className="p-1.5 rounded-sm hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                        {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    </button>
                </div>

                <div className="flex-1 overflow-auto font-mono text-sm leading-6 relative bg-gray-950">
                    <div className="flex min-h-full">
                        {/* Line Numbers */}
                        <div className="w-10 bg-gray-900/50 border-r border-gray-800 text-gray-600 text-right pr-2 py-4 select-none">
                            {lines.map((_, i) => (
                                <div key={i}>{i + 1}</div>
                            ))}
                        </div>
                        {/* Code Content */}
                        <div className="flex-1 p-4">
                            {lines.map((line, i) => (
                                <div key={i} className="whitespace-pre">
                                    <SyntaxHighlighter line={line} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SyntaxHighlighter: React.FC<{ line: string }> = ({ line }) => {
    // Very basic syntax highlighting for demo
    if (line.trim().startsWith('//')) {
        return <span className="text-gray-500 italic">{line}</span>;
    }
    
    const parts = line.split(/(\s+|[(){}[\].,;])/g);
    
    return (
        <span>
            {parts.map((part, i) => {
                let className = 'text-gray-300';
                if (['import', 'export', 'class', 'function', 'const', 'let', 'var', 'return', 'async', 'await', 'try', 'catch', 'if', 'else'].includes(part)) className = 'text-purple-400';
                else if (['string', 'number', 'boolean', 'any', 'void', 'Promise'].includes(part)) className = 'text-yellow-400';
                else if (['true', 'false', 'null', 'undefined'].includes(part)) className = 'text-orange-400';
                else if (part.match(/^[A-Z][a-zA-Z0-9]*$/)) className = 'text-blue-300'; // Class/Type-ish
                else if (part.startsWith("'") || part.startsWith('"')) className = 'text-green-400';
                
                return <span key={i} className={className}>{part}</span>;
            })}
        </span>
    );
};