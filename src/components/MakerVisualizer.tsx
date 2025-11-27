import React, { useState } from 'react';
import { SubTask, AgentStatus, TaskStatus, MakerConfig } from '../types';
import { CheckCircle, Circle, AlertCircle, Loader2, Cpu, Zap, ShieldAlert, GitBranch, GitMerge, Clock, Save, Eye, ClipboardList, Terminal, Download } from 'lucide-react';
import { VotingInspector } from './VotingInspector';
import { StepDetailView } from './StepDetailView';
import { MockTauriService } from '../services/tauriBridge';

interface MakerVisualizerProps {
  state: TaskStatus | null;
  config: MakerConfig;
}

export const MakerVisualizer: React.FC<MakerVisualizerProps> = ({ state, config }) => {
  const [inspectingStep, setInspectingStep] = useState<SubTask | null>(null);
  const [detailStep, setDetailStep] = useState<SubTask | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportLogs = async () => {
    if (!state) return;
    setIsExporting(true);
    try {
      const filename = `maker_trace_${Date.now()}.json`;
      const path = await MockTauriService.saveDialog(filename);

      if (path) {
        const content = JSON.stringify(state, null, 2);
        await MockTauriService.writeFile(path, content);
        // Note: We don't have a toast function here, but the file saving is explicit
        console.log(`Logs saved to ${path}`);
      }
    } catch (e) {
      console.error("Failed to export logs:", e);
    } finally {
      setIsExporting(false);
    }
  };

  if (!state || state.decomposition.length === 0) {
    return (
      <div className="h-full w-full p-8 flex flex-col items-center justify-center text-gray-600 space-y-4">
        <div className="relative">
          <div className="absolute -inset-1 bg-indigo-500 rounded-full opacity-20 blur-xl"></div>
          <Cpu size={64} className="relative text-gray-700" />
        </div>
        <p className="text-sm font-mono">MAKER Engine Standby</p>
        <p className="text-xs text-gray-700 max-w-xs text-center">
          System ready. Configure agents above or enter a prompt to begin decomposition.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full p-8 overflow-y-auto relative">
      {inspectingStep && (
        <VotingInspector step={inspectingStep} onClose={() => setInspectingStep(null)} />
      )}

      {detailStep && (
        <StepDetailView step={detailStep} onClose={() => setDetailStep(null)} />
      )}

      <div className="max-w-3xl mx-auto">

        {/* Header Controls */}
        <div className="flex justify-end mb-4">
          <button
            onClick={handleExportLogs}
            disabled={isExporting}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-sm text-xs font-medium transition-colors border border-gray-700 disabled:opacity-50"
          >
            {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Export Debug Logs
          </button>
        </div>

        {/* Planning Mode Banner */}
        {state.isPlanning && (
          <div className="mb-8 p-4 bg-indigo-900/20 border border-indigo-500/30 rounded-lg flex items-center justify-between animate-in slide-in-from-top duration-500">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/20 rounded-full text-indigo-400">
                <ClipboardList size={24} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-indigo-200">Plan Review Required</h2>
                <p className="text-xs text-indigo-400/70">MAKER has decomposed the task into {state.decomposition.length} atomic steps.</p>
              </div>
            </div>
            <div className="text-xs text-indigo-300 font-mono animate-pulse">Waiting for approval...</div>
          </div>
        )}

        <div className="mb-8 text-center mt-2">
          {!state.isPlanning && (
            <>
              <h2 className="text-lg font-bold text-gray-100 mb-2">Execution Graph</h2>
              <div className="flex flex-wrap justify-center gap-4 text-xs font-mono text-gray-500 bg-gray-900/50 py-2 rounded-xl border border-gray-800 px-6">
                <span>Steps: {state.completedSteps}/{state.totalSteps}</span>
                <span className="text-teal-400">Workers: {state.activeWorkers}</span>
                <span className="text-red-400">Red Flags: {state.errorCount}</span>
              </div>
            </>
          )}
        </div>

        <div className="space-y-6 relative">
          {/* Vertical connector line */}
          <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-gray-800 z-0"></div>

          {state.decomposition.map((step, idx) => (
            <StepCard
              key={step.id}
              step={step}
              index={idx}
              onInspectVote={() => step.status === AgentStatus.PASSED || step.status === AgentStatus.VOTING ? setInspectingStep(step) : null}
              onViewDetails={() => setDetailStep(step)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const StepCard: React.FC<{ step: SubTask; index: number; onInspectVote: () => void; onViewDetails: () => void }> = ({ step, index, onInspectVote, onViewDetails }) => {
  const getStatusColor = (s: AgentStatus) => {
    switch (s) {
      case AgentStatus.PLANNING: return 'border-indigo-500/30 bg-indigo-900/5 text-gray-400';
      case AgentStatus.QUEUED: return 'border-gray-800 bg-gray-900/50 text-gray-500';
      case AgentStatus.ANALYZING: return 'border-yellow-500/30 bg-yellow-900/10 text-yellow-500';
      case AgentStatus.THINKING: return 'border-indigo-500/50 bg-indigo-900/10 text-indigo-300';
      case AgentStatus.VOTING: return 'border-purple-500/50 bg-purple-900/10 text-purple-300';
      case AgentStatus.PASSED: return 'border-green-500/50 bg-green-900/10 text-green-300';
      case AgentStatus.SKIPPED_VOTE: return 'border-teal-500/50 bg-teal-900/10 text-teal-300';
      case AgentStatus.FAILED: return 'border-red-500/50 bg-red-900/10 text-red-300';
      case AgentStatus.EXECUTING: return 'border-blue-500/50 bg-blue-900/10 text-blue-300';
      case AgentStatus.CHECKPOINTING: return 'border-orange-500/50 bg-orange-900/10 text-orange-300';
      case AgentStatus.MERGING: return 'border-pink-500/50 bg-pink-900/10 text-pink-300';
      default: return 'border-gray-800';
    }
  };

  const getIcon = (s: AgentStatus) => {
    switch (s) {
      case AgentStatus.PLANNING: return <Circle size={18} className="text-indigo-500/50" />;
      case AgentStatus.PASSED: return <CheckCircle size={18} className="text-green-500" />;
      case AgentStatus.SKIPPED_VOTE: return <Zap size={18} className="text-teal-400" />;
      case AgentStatus.FAILED: return <AlertCircle size={18} className="text-red-500" />;
      case AgentStatus.ANALYZING: return <ShieldAlert size={18} className="text-yellow-500 animate-pulse" />;
      case AgentStatus.QUEUED: return <Clock size={18} className="text-gray-600" />;
      case AgentStatus.CHECKPOINTING: return <Save size={18} className="text-orange-500 animate-pulse" />;
      case AgentStatus.MERGING: return <GitMerge size={18} className="text-pink-500 animate-bounce" />;
      case AgentStatus.THINKING:
      case AgentStatus.VOTING:
      case AgentStatus.EXECUTING:
        return <Loader2 size={18} className="animate-spin text-indigo-500" />;
      default: return <Circle size={18} className="text-gray-600" />;
    }
  };

  const isVoteInspectable = (step.status === AgentStatus.PASSED || step.status === AgentStatus.VOTING) && step.candidates && step.candidates.length > 0;

  return (
    <div className={`relative z-10 flex items-start gap-4 transition-all duration-500 ${step.status === AgentStatus.QUEUED ? 'opacity-60' : 'opacity-100'}`}>
      <div className={`mt-3 w-12 h-12 rounded-full border-4 border-gray-950 flex items-center justify-center bg-gray-900 shadow-xl ${step.status === AgentStatus.PASSED ? 'ring-2 ring-green-500/50' :
        step.status === AgentStatus.SKIPPED_VOTE ? 'ring-2 ring-teal-500/50' :
          step.status === AgentStatus.VOTING ? 'ring-2 ring-purple-500/50' :
            step.status === AgentStatus.CHECKPOINTING ? 'ring-2 ring-orange-500/50' : ''
        }`}>
        {getIcon(step.status)}
      </div>

      <div className={`flex-1 p-4 rounded-lg border backdrop-blur-xs shadow-xs transition-colors ${getStatusColor(step.status)}`}>
        <div className="flex justify-between items-start mb-2">
          <div className="flex flex-col">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              Step {index + 1}: {step.description}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              {step.riskReason && step.status !== AgentStatus.PLANNING && (
                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                  Risk: {step.riskScore > 0.5 ? <span className="text-red-400 font-bold">HIGH</span> : <span className="text-green-400 font-bold">LOW</span>}
                </span>
              )}
              {step.role && (
                <span className="text-[9px] bg-indigo-900/40 text-indigo-300 px-1.5 py-0.5 rounded-sm uppercase tracking-wider border border-indigo-500/20">
                  {step.role}
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onViewDetails}
              className="p-1.5 rounded-sm bg-gray-900/50 hover:bg-white/10 text-gray-400 hover:text-white transition-colors border border-gray-800"
              title="View Flight Recorder"
            >
              <Terminal size={12} />
            </button>
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-sm bg-gray-950/30 border border-white/5 self-center">
              {step.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Git Branch Info */}
        {step.gitBranch && (
          <div className="text-[10px] font-mono text-orange-400/80 mb-2 flex items-center gap-1 bg-orange-950/20 w-fit px-1.5 py-0.5 rounded-sm border border-orange-900/30">
            <GitBranch size={10} /> {step.gitBranch}
          </div>
        )}

        <div className="text-xs font-mono opacity-70 mb-3 flex items-center gap-2">
          <span className="bg-gray-800 px-1 rounded-sm text-[10px]">FILE</span> {step.fileTarget}
          {step.dependencies.length > 0 && (
            <span className="ml-2 text-gray-500">Wait for: [{step.dependencies.join(', ')}]</span>
          )}
        </div>

        {/* Voting Visuals */}
        {(step.status === AgentStatus.VOTING || (step.status === AgentStatus.PASSED && step.riskScore > 0.5)) && (
          <div
            className={`mt-2 pt-2 border-t border-gray-700/50 ${isVoteInspectable ? 'cursor-pointer hover:bg-white/5 p-2 -mx-2 rounded-sm transition-colors' : ''}`}
            onClick={isVoteInspectable ? onInspectVote : undefined}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase font-bold text-gray-500">MAKER Consensus Engine</span>
              <div className="h-px bg-gray-700/50 flex-1"></div>
            </div>
            <div className="flex gap-2">
              {[1, 2, 3].map((agentId) => (
                <div key={agentId} className="flex-1 bg-gray-950/50 rounded-sm p-2 flex items-center gap-2 border border-gray-800">
                  <div className={`w-1.5 h-1.5 rounded-full ${step.status === AgentStatus.PASSED ? 'bg-green-500' : 'bg-purple-500 animate-pulse'}`}></div>
                  <span className="text-[10px] text-gray-400">Agent {agentId}</span>
                </div>
              ))}
            </div>
            {isVoteInspectable && <div className="text-[9px] text-center text-gray-600 mt-1">Click to inspect candidates</div>}
          </div>
        )}
      </div>
    </div>
  );
};