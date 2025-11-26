import React, { useState } from 'react';
import { SubTask, AgentStatus } from '../types';
import { X, ArrowUp, ArrowDown, Plus, Save, AlertCircle } from 'lucide-react';

interface PlanEditorProps {
    steps: SubTask[];
    onUpdate: (steps: SubTask[]) => void;
    onClose: () => void;
}

export const PlanEditor: React.FC<PlanEditorProps> = ({ steps, onUpdate, onClose }) => {
    const [editedSteps, setEditedSteps] = useState<SubTask[]>([...steps]);
    const [newStepDesc, setNewStepDesc] = useState('');

    const handleStepChange = (index: number, field: keyof SubTask, value: any) => {
        const updated = [...editedSteps];
        updated[index] = { ...updated[index], [field]: value };
        setEditedSteps(updated);
    };

    const handleDelete = (index: number) => {
        const updated = editedSteps.filter((_, i) => i !== index);
        setEditedSteps(updated);
    };

    const handleMove = (index: number, direction: -1 | 1) => {
        if (index + direction < 0 || index + direction >= editedSteps.length) return;
        const updated = [...editedSteps];
        const temp = updated[index];
        updated[index] = updated[index + direction];
        updated[index + direction] = temp;
        setEditedSteps(updated);
    };

    const handleAddStep = () => {
        if (!newStepDesc.trim()) return;
        const newStep: SubTask = {
            id: Math.random().toString(36).substring(2, 9),
            description: newStepDesc,
            fileTarget: './new-file.ts',
            status: AgentStatus.QUEUED,
            attempts: 0,
            votes: 0,
            riskScore: 0.1,
            logs: [],
            dependencies: index > 0 ? [editedSteps[editedSteps.length - 1].id] : [],
            candidates: []
        };
        // Insert at end
        const index = editedSteps.length;
        setEditedSteps([...editedSteps, newStep]);
        setNewStepDesc('');
    };

    const handleSave = () => {
        onUpdate(editedSteps);
        onClose();
    };

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-950/90 backdrop-blur-xs p-8">
            <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-900">
                    <div>
                        <h2 className="text-lg font-bold text-gray-100">Execution Plan Editor</h2>
                        <p className="text-xs text-gray-500">Review and modify agent tasks before execution.</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 rounded-sm text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
                            Cancel
                        </button>
                        <button onClick={handleSave} className="px-4 py-2 rounded-sm text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-2 shadow-lg shadow-indigo-500/20">
                            <Save size={14} /> Save Plan
                        </button>
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3">
                    {editedSteps.length === 0 && (
                        <div className="text-center text-gray-500 py-12 border-2 border-dashed border-gray-800 rounded-lg">
                            <AlertCircle className="mx-auto mb-2 opacity-50" />
                            <p>No steps in plan. Add one below.</p>
                        </div>
                    )}

                    {editedSteps.map((step, idx) => (
                        <div key={step.id} className="bg-gray-950 border border-gray-800 rounded-lg p-3 flex gap-4 items-start group hover:border-gray-700 transition-colors">
                            {/* Order Controls */}
                            <div className="flex flex-col gap-1 mt-1 text-gray-600">
                                <button onClick={() => handleMove(idx, -1)} disabled={idx === 0} className="hover:text-indigo-400 disabled:opacity-30">
                                    <ArrowUp size={14} />
                                </button>
                                <span className="text-[10px] font-mono text-center">{idx + 1}</span>
                                <button onClick={() => handleMove(idx, 1)} disabled={idx === editedSteps.length - 1} className="hover:text-indigo-400 disabled:opacity-30">
                                    <ArrowDown size={14} />
                                </button>
                            </div>

                            {/* Inputs */}
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-2 space-y-1">
                                    <label className="text-[10px] uppercase text-gray-600 font-bold">Task Description</label>
                                    <input
                                        value={step.description}
                                        onChange={(e) => handleStepChange(idx, 'description', e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-800 rounded-sm px-2 py-1.5 text-sm text-gray-200 focus:border-indigo-500 outline-hidden"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase text-gray-600 font-bold">Target File</label>
                                    <input
                                        value={step.fileTarget}
                                        onChange={(e) => handleStepChange(idx, 'fileTarget', e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-800 rounded-sm px-2 py-1.5 text-xs font-mono text-indigo-300 focus:border-indigo-500 outline-hidden"
                                    />
                                </div>
                            </div>

                            {/* Delete */}
                            <button onClick={() => handleDelete(idx)} className="mt-1 p-2 text-gray-600 hover:text-red-400 hover:bg-red-900/10 rounded-sm transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Add New */}
                <div className="p-4 bg-gray-900 border-t border-gray-800 flex gap-2">
                    <input
                        value={newStepDesc}
                        onChange={(e) => setNewStepDesc(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddStep()}
                        placeholder="Add a new task step..."
                        className="flex-1 bg-gray-950 border border-gray-800 rounded-sm px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 outline-hidden"
                    />
                    <button onClick={handleAddStep} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-sm flex items-center gap-2">
                        <Plus size={16} /> Add
                    </button>
                </div>
            </div>
        </div>
    );
};