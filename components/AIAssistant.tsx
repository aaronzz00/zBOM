import React, { useState, useEffect } from 'react';
import { BOMNode } from '../types';
import { analyzeBOMNode, chatWithBOM } from '../services/gemini';
import { Sparkles, X, MessageSquare, AlertTriangle, TrendingDown, Send } from 'lucide-react';

interface AIAssistantProps {
  selectedNode: BOMNode | null;
  onClose: () => void;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ selectedNode, onClose }) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'analysis'>('analysis');
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<{role: 'user'|'model', text: string}[]>([]);

  useEffect(() => {
    // Reset analysis when node changes
    setAnalysisResult(null);
  }, [selectedNode]);

  const handleAnalysis = async (type: 'optimize' | 'risks' | 'alternatives') => {
    if (!selectedNode) return;
    setLoading(true);
    const result = await analyzeBOMNode(selectedNode, type);
    setAnalysisResult(result);
    setLoading(false);
    setActiveTab('analysis');
  };

  const handleChatSend = async () => {
      if (!chatInput.trim()) return;
      
      const userMsg = chatInput;
      setChatHistory(prev => [...prev, {role: 'user', text: userMsg}]);
      setChatInput("");
      setLoading(true);

      const response = await chatWithBOM(chatHistory, selectedNode, userMsg);
      setChatHistory(prev => [...prev, {role: 'model', text: response}]);
      setLoading(false);
  }

  return (
    <div className="w-[400px] bg-white border-l border-slate-200 flex flex-col h-full shadow-xl animate-in slide-in-from-right duration-300">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-white">
        <div className="flex items-center gap-2 text-blue-700">
          <Sparkles className="w-5 h-5" />
          <h3 className="font-bold">zBOM AI Assistant</h3>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-blue-100 rounded text-slate-400 hover:text-blue-700 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('analysis')}
          className={`flex-1 py-3 text-sm font-medium ${activeTab === 'analysis' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          Context Analysis
        </button>
        <button 
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-3 text-sm font-medium ${activeTab === 'chat' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
        {activeTab === 'analysis' ? (
          <div className="space-y-6">
            {!selectedNode ? (
               <div className="text-center py-10 text-slate-400">
                  <p>Select a BOM Item to analyze</p>
               </div>
            ) : (
                <>
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                <h4 className="text-sm font-semibold text-slate-800 mb-2">Analyze: {selectedNode.partNumber}</h4>
                <p className="text-xs text-slate-500 mb-4">{selectedNode.name}</p>
                
                <div className="grid grid-cols-1 gap-2">
                    <button 
                    onClick={() => handleAnalysis('optimize')}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded border border-blue-200 hover:bg-blue-100 transition-colors text-sm font-medium text-left"
                    >
                    <TrendingDown className="w-4 h-4" />
                    Find Cost Reductions
                    </button>
                    <button 
                    onClick={() => handleAnalysis('risks')}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 rounded border border-amber-200 hover:bg-amber-100 transition-colors text-sm font-medium text-left"
                    >
                    <AlertTriangle className="w-4 h-4" />
                    Identify Supply Risks
                    </button>
                    <button 
                    onClick={() => handleAnalysis('alternatives')}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-2 bg-purple-50 text-purple-700 rounded border border-purple-200 hover:bg-purple-100 transition-colors text-sm font-medium text-left"
                    >
                    <MessageSquare className="w-4 h-4" />
                    Suggest Alternatives
                    </button>
                </div>
                </div>

                {loading && (
                    <div className="flex flex-col items-center justify-center py-8 gap-3">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs text-slate-500 animate-pulse">Processing with Gemini Pro...</span>
                    </div>
                )}

                {analysisResult && !loading && (
                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">AI Insights</h4>
                        <div className="prose prose-sm prose-slate text-sm leading-relaxed whitespace-pre-line">
                            {analysisResult}
                        </div>
                    </div>
                )}
                </>
            )}
          </div>
        ) : (
            <div className="flex flex-col h-full">
                <div className="flex-1 space-y-4 mb-4">
                    {chatHistory.length === 0 && (
                        <div className="text-center text-sm text-slate-400 mt-10">
                            Ask me anything about your BOM, inventory, or specs.
                        </div>
                    )}
                    {chatHistory.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-lg p-3 text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-700 shadow-sm'}`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    {loading && (
                         <div className="flex justify-start">
                             <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                                 <div className="flex gap-1">
                                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100"></span>
                                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200"></span>
                                 </div>
                             </div>
                         </div>
                    )}
                </div>
            </div>
        )}
      </div>

      {activeTab === 'chat' && (
          <div className="p-4 border-t border-slate-200 bg-white">
            <div className="relative">
                <input 
                    className="w-full pl-4 pr-10 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="Ask a question..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
                />
                <button 
                    onClick={handleChatSend}
                    disabled={loading || !chatInput}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-600 disabled:text-slate-300 p-1 hover:bg-blue-50 rounded"
                >
                    <Send className="w-4 h-4" />
                </button>
            </div>
          </div>
      )}
    </div>
  );
};