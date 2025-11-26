import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export interface ToastMessage {
    id: string;
    type: 'success' | 'error' | 'info';
    message: string;
}

interface ToastContainerProps {
    toasts: ToastMessage[];
    onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
            {toasts.map(t => (
                <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
            ))}
        </div>
    );
};

const ToastItem: React.FC<{ toast: ToastMessage, onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss(toast.id);
        }, 5000);
        return () => clearTimeout(timer);
    }, [toast.id, onDismiss]);

    const bg = toast.type === 'success' ? 'bg-green-900/90 border-green-500/50' :
        toast.type === 'error' ? 'bg-red-900/90 border-red-500/50' :
            'bg-gray-800/90 border-gray-600/50';

    const icon = toast.type === 'success' ? <CheckCircle size={16} className="text-green-400" /> :
        toast.type === 'error' ? <AlertCircle size={16} className="text-red-400" /> :
            <Info size={16} className="text-blue-400" />;

    return (
        <div className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-sm shadow-lg border backdrop-blur-xs animate-in slide-in-from-right fade-in duration-300 w-80 ${bg}`}>
            {icon}
            <p className="flex-1 text-xs text-gray-200">{toast.message}</p>
            <button onClick={() => onDismiss(toast.id)} className="text-gray-400 hover:text-white">
                <X size={14} />
            </button>
        </div>
    );
};