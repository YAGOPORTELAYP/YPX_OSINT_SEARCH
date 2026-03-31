import React, { useState, useEffect } from 'react';
import { Search, Shield, Globe, Database, Share2, Loader2, AlertTriangle, MessageSquare, Send, Download, FileText, FileSpreadsheet, FileCode, Activity, LogIn, LogOut, Trash2, Bell, Image as ImageIcon, Film, Map as MapIcon, Volume2, Play, Upload, Eye } from 'lucide-react';
import Markdown from 'react-markdown';
import { performIntelligenceSearch, chatIntelligence, performMapsSearch, generateIntelligenceImage, generateIntelligenceVideo, analyzeMedia, textToSpeech, expandIntelligenceNode, performForensicTool } from './services/geminiService';
import { IntelligenceData, ChatMessage, Target, Alert } from './types';
import Graph from './components/Graph';
import { downloadAsPDF, downloadAsWord, downloadAsExcel } from './lib/downloadUtils';
import { auth, db } from './firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { collection, query as fsQuery, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, orderBy, limit } from 'firebase/firestore';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'search' | 'monitor' | 'multimedia' | 'maps' | 'database' | 'forensics'>('search');
  
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [highThinking, setHighThinking] = useState(false);
  const [data, setData] = useState<IntelligenceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // History State
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Multimedia Lab State
  const [mmPrompt, setMmPrompt] = useState('');
  const [mmSize, setMmSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [mmResult, setMmResult] = useState<{ type: 'image' | 'video' | 'analysis', url?: string, text?: string } | null>(null);
  const [mmLoading, setMmLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Maps State
  const [mapsQuery, setMapsQuery] = useState('');
  const [mapsData, setMapsData] = useState<{ report: string, sources: any[] } | null>(null);
  const [mapsLoading, setMapsLoading] = useState(false);

  // TTS State
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [ttsLoading, setTtsLoading] = useState(false);
  
  // Graph Editor State
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [newNodeLabel, setNewNodeLabel] = useState('');
  const [newNodeType, setNewNodeType] = useState<any>('person');
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [targetNodeId, setTargetNodeId] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [monitoredTargets, setMonitoredTargets] = useState<Target[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [monitoringLoading, setMonitoringLoading] = useState(false);

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Forensic Tools State
  const [forensicQuery, setForensicQuery] = useState('');
  const [forensicTool, setForensicTool] = useState<'username' | 'email' | 'domain' | 'ip'>('username');
  const [forensicResult, setForensicResult] = useState<string | null>(null);
  const [forensicLoading, setForensicLoading] = useState(false);
  const [expandingNodeId, setExpandingNodeId] = useState<string | null>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Real-time Listeners for Monitoring
  useEffect(() => {
    if (!user) {
      setMonitoredTargets([]);
      setAlerts([]);
      return;
    }

    const targetsQuery = fsQuery(collection(db, 'targets'), where('uid', '==', user.uid));
    const unsubscribeTargets = onSnapshot(targetsQuery, (snapshot) => {
      setMonitoredTargets(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Target)));
    });

    const alertsQuery = fsQuery(collection(db, 'alerts'), where('uid', '==', user.uid), orderBy('timestamp', 'desc'), limit(20));
    const unsubscribeAlerts = onSnapshot(alertsQuery, (snapshot) => {
      setAlerts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Alert)));
    });

    const historyQuery = fsQuery(collection(db, 'history'), where('uid', '==', user.uid), orderBy('timestamp', 'desc'));
    const unsubscribeHistory = onSnapshot(historyQuery, (snapshot) => {
      setHistory(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubscribeTargets();
      unsubscribeAlerts();
      unsubscribeHistory();
    };
  }, [user]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => auth.signOut();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setChatMessages([]); 
    try {
      const result = await performIntelligenceSearch(query, highThinking);
      setData(result);
      
      // Save to history if user is logged in
      if (user) {
        await addDoc(collection(db, 'history'), {
          query: query.trim(),
          data: result,
          uid: user.uid,
          timestamp: serverTimestamp()
        });
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch intelligence data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const addCustomNode = () => {
    if (!newNodeLabel.trim() || !data) return;
    const newNode = {
      id: `custom-${Date.now()}`,
      label: newNodeLabel.trim(),
      type: newNodeType
    };
    setData({
      ...data,
      nodes: [...data.nodes, newNode]
    });
    setNewNodeLabel('');
  };

  const addCustomLink = () => {
    if (!selectedNodeId || !targetNodeId || !data) return;
    const newLink = {
      source: selectedNodeId,
      target: targetNodeId,
      label: newLinkLabel.trim() || 'related'
    };
    setData({
      ...data,
      links: [...data.links, newLink]
    });
    setNewLinkLabel('');
    setTargetNodeId('');
  };

  const startMonitoring = async () => {
    if (!user || !query.trim()) return;
    setMonitoringLoading(true);
    try {
      await addDoc(collection(db, 'targets'), {
        query: query.trim(),
        status: 'active',
        uid: user.uid,
        createdAt: serverTimestamp(),
        lastChecked: serverTimestamp()
      });
      setActiveTab('monitor');
    } catch (err) {
      console.error(err);
      setError('Failed to start monitoring.');
    } finally {
      setMonitoringLoading(false);
    }
  };

  const deleteTarget = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'targets', id));
    } catch (err) {
      console.error(err);
    }
  };

  const deleteHistoryItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'history', id));
    } catch (err) {
      console.error(err);
    }
  };

  const loadHistoryItem = (item: any) => {
    setData(item.data);
    setQuery(item.query);
    setActiveTab('search');
    setChatMessages([]);
  };

  const toggleTargetStatus = async (target: Target) => {
    try {
      await updateDoc(doc(db, 'targets', target.id), {
        status: target.status === 'active' ? 'paused' : 'active'
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMsg: ChatMessage = { role: 'user', text: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    const currentInput = chatInput;
    setChatInput('');
    setChatLoading(true);

    try {
      if (!data) {
        // Initial search via chat
        setQuery(currentInput);
        const result = await performIntelligenceSearch(currentInput, highThinking);
        setData(result);
        
        if (user) {
          await addDoc(collection(db, 'history'), {
            query: currentInput.trim(),
            data: result,
            uid: user.uid,
            timestamp: serverTimestamp()
          });
        }
        setChatMessages(prev => [...prev, { role: 'model', text: "Intelligence gathered. Analysis complete. I've generated the graph and report based on your query. How can I assist further?" }]);
      } else {
        const response = await chatIntelligence(currentInput, data.context || '', chatMessages, highThinking);
        setChatMessages(prev => [...prev, { role: 'model', text: response }]);
      }
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { role: 'model', text: 'ERROR: Intelligence engine offline.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleMapsSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapsQuery.trim()) return;
    setMapsLoading(true);
    try {
      const result = await performMapsSearch(mapsQuery);
      setMapsData(result);
    } catch (err) {
      console.error(err);
      setError('Maps intelligence engine failure.');
    } finally {
      setMapsLoading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!mmPrompt.trim()) return;
    setMmLoading(true);
    try {
      const url = await generateIntelligenceImage(mmPrompt, mmSize);
      setMmResult({ type: 'image', url });
    } catch (err) {
      console.error(err);
      setError('Image generation failed.');
    } finally {
      setMmLoading(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!mmPrompt.trim()) return;
    setMmLoading(true);
    try {
      const url = await generateIntelligenceVideo(mmPrompt, mmResult?.type === 'image' ? mmResult.url : undefined);
      setMmResult({ type: 'video', url });
    } catch (err) {
      console.error(err);
      setError('Video generation failed.');
    } finally {
      setMmLoading(false);
    }
  };

  const handleAnalyzeMedia = async () => {
    if (!selectedFile || !mmPrompt.trim()) return;
    setMmLoading(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      reader.onload = async () => {
        const base64 = reader.result as string;
        const text = await analyzeMedia(mmPrompt, base64, selectedFile.type);
        setMmResult({ type: 'analysis', text });
        setMmLoading(false);
      };
    } catch (err) {
      console.error(err);
      setError('Media analysis failed.');
      setMmLoading(false);
    }
  };

  const handleTTS = async (text: string) => {
    setTtsLoading(true);
    try {
      const url = await textToSpeech(text);
      setAudioUrl(url);
    } catch (err) {
      console.error(err);
    } finally {
      setTtsLoading(false);
    }
  };

  const handleExpandNode = async (nodeId: string, nodeLabel: string) => {
    if (!data) return;
    setExpandingNodeId(nodeId);
    try {
      const result = await expandIntelligenceNode(nodeId, nodeLabel, data, highThinking);
      
      // Merge new nodes and links
      const newNodes = [...data.nodes];
      const newLinks = [...data.links];
      
      result.nodes.forEach(newNode => {
        if (!newNodes.find(n => n.id === newNode.id)) {
          newNodes.push(newNode);
        }
      });
      
      result.links.forEach(newLink => {
        newLinks.push(newLink);
      });
      
      setData({
        ...data,
        nodes: newNodes,
        links: newLinks,
        report: data.report + "\n\n### Node Expansion Update: " + nodeLabel + "\n" + result.report
      });
    } catch (err) {
      console.error(err);
      setError('Node expansion failed.');
    } finally {
      setExpandingNodeId(null);
    }
  };

  const handleForensicSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forensicQuery.trim()) return;
    setForensicLoading(true);
    try {
      const result = await performForensicTool(forensicTool, forensicQuery);
      setForensicResult(result);
    } catch (err) {
      console.error(err);
      setError('Forensic tool execution failed.');
    } finally {
      setForensicLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-mono selection:bg-[#ff4444] selection:text-black">
      {/* Header */}
      <header className="border-b border-[#1a1a1a] p-4 flex items-center justify-between bg-[#0a0a0a]">
        <div className="flex items-center gap-3">
          <Shield className="text-[#ff4444] w-8 h-8" />
          <div>
            <h1 className="text-xl font-bold tracking-tighter uppercase italic">Nexus Intelligence</h1>
            <p className="text-[10px] text-[#666] uppercase tracking-widest">OSINT & Graph Network Analysis</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
            <nav className="flex items-center gap-2 bg-black p-1 rounded border border-[#1a1a1a]">
            <button 
              onClick={() => setActiveTab('search')}
              className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${activeTab === 'search' ? 'bg-[#ff4444] text-black' : 'text-[#666] hover:text-[#eee]'}`}
            >
              Search
            </button>
            <button 
              onClick={() => setActiveTab('multimedia')}
              className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${activeTab === 'multimedia' ? 'bg-[#ff4444] text-black' : 'text-[#666] hover:text-[#eee]'}`}
            >
              Multimedia Lab
            </button>
            <button 
              onClick={() => setActiveTab('maps')}
              className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${activeTab === 'maps' ? 'bg-[#ff4444] text-black' : 'text-[#666] hover:text-[#eee]'}`}
            >
              Maps Intel
            </button>
            <button 
              onClick={() => setActiveTab('monitor')}
              className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${activeTab === 'monitor' ? 'bg-[#ff4444] text-black' : 'text-[#666] hover:text-[#eee]'}`}
            >
              Monitoring
            </button>
            <button 
              onClick={() => setActiveTab('database')}
              className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${activeTab === 'database' ? 'bg-[#ff4444] text-black' : 'text-[#666] hover:text-[#eee]'}`}
            >
              Database
            </button>
            <button 
              onClick={() => setActiveTab('forensics')}
              className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${activeTab === 'forensics' ? 'bg-[#ff4444] text-black' : 'text-[#666] hover:text-[#eee]'}`}
            >
              Forensics
            </button>
          </nav>

          <div className="flex items-center gap-4 text-[10px] text-[#444] border-l border-[#1a1a1a] pl-6">
            {user ? (
              <div className="flex items-center gap-3">
                <img src={user.photoURL || ''} className="w-6 h-6 rounded-full border border-[#333]" alt="User" />
                <button onClick={handleLogout} className="hover:text-[#ff4444] transition-colors uppercase font-bold">Disconnect</button>
              </div>
            ) : (
              <button onClick={handleLogin} className="flex items-center gap-2 hover:text-[#eee] transition-colors uppercase font-bold">
                <LogIn size={14} /> Connect Operator
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto">
        {activeTab === 'search' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Search Section (Chat-First) */}
            {!data && (
              <div className="lg:col-span-12 flex flex-col items-center justify-center min-h-[600px] space-y-8 animate-in fade-in zoom-in-95 duration-500">
                <div className="relative">
                  <div className="absolute -inset-4 bg-[#ff4444]/5 blur-3xl rounded-full animate-pulse" />
                  <Shield className="text-[#ff4444] w-24 h-24 relative" strokeWidth={1} />
                </div>
                
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-bold tracking-[0.3em] uppercase italic text-[#eee]">Nexus Intelligence System</h2>
                  <p className="text-[10px] text-[#444] uppercase tracking-[0.5em]">Awaiting Operator Input // Encrypted Session</p>
                </div>

                <div className="w-full max-w-2xl space-y-6">
                  <form onSubmit={handleChat} className="relative group">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="DESCRIBE YOUR TARGET OR INTELLIGENCE GOAL..."
                      className="w-full bg-[#0a0a0a] border border-[#333] p-6 pl-14 rounded-lg focus:outline-none focus:border-[#ff4444] transition-all text-lg tracking-tight placeholder:text-[#222]"
                    />
                    <MessageSquare className="absolute left-6 top-1/2 -translate-y-1/2 text-[#333] group-focus-within:text-[#ff4444] transition-colors" />
                    <button
                      disabled={chatLoading || !chatInput.trim()}
                      className="absolute right-4 top-1/2 -translate-y-1/2 bg-[#ff4444] text-black px-6 py-2 rounded font-bold hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {chatLoading ? <Loader2 className="animate-spin" /> : 'INITIATE'}
                    </button>
                  </form>

                  <div className="flex items-center justify-center gap-8">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={highThinking}
                          onChange={(e) => setHighThinking(e.target.checked)}
                        />
                        <div className={`w-10 h-5 rounded-full border border-[#333] transition-colors ${highThinking ? 'bg-[#ff4444]/20 border-[#ff4444]' : 'bg-[#0a0a0a]'}`} />
                        <div className={`absolute top-1 left-1 w-3 h-3 rounded-full transition-all ${highThinking ? 'translate-x-5 bg-[#ff4444]' : 'bg-[#333]'}`} />
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${highThinking ? 'text-[#ff4444]' : 'text-[#666]'}`}>
                        Deep Intelligence Mode (Thinking v3.1)
                      </span>
                    </label>
                  </div>
                </div>

                {error && (
                  <div className="w-full max-w-2xl bg-[#ff4444]/10 border border-[#ff4444] p-4 rounded flex items-center gap-3 text-[#ff4444]">
                    <AlertTriangle size={20} />
                    <span className="text-xs uppercase tracking-widest">{error}</span>
                  </div>
                )}
              </div>
            )}

            {data && (
              <>
                {/* Header for Active Session */}
                <div className="lg:col-span-12 flex items-center justify-between bg-[#0a0a0a] border border-[#333] p-4 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-2 h-2 rounded-full bg-[#ff4444] animate-pulse" />
                    <span className="text-[10px] font-bold uppercase text-[#eee]">Active Intelligence Session: {query}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={highThinking}
                          onChange={(e) => setHighThinking(e.target.checked)}
                        />
                        <div className={`w-8 h-4 rounded-full border border-[#333] transition-colors ${highThinking ? 'bg-[#ff4444]/20 border-[#ff4444]' : 'bg-[#0a0a0a]'}`} />
                        <div className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full transition-all ${highThinking ? 'translate-x-4 bg-[#ff4444]' : 'bg-[#333]'}`} />
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-widest transition-colors ${highThinking ? 'text-[#ff4444]' : 'text-[#666]'}`}>
                        Deep Mode
                      </span>
                    </label>
                    {user && (
                      <button 
                        onClick={startMonitoring}
                        disabled={monitoringLoading}
                        className="flex items-center gap-2 text-[9px] font-bold uppercase text-[#ff4444] border border-[#ff4444]/30 px-3 py-1 rounded hover:bg-[#ff4444] hover:text-black transition-all"
                      >
                        {monitoringLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity size={12} />}
                        Monitor
                      </button>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="lg:col-span-12 bg-[#ff4444]/10 border border-[#ff4444] p-4 rounded flex items-center gap-3 text-[#ff4444]">
                    <AlertTriangle size={20} />
                    <span>{error}</span>
                  </div>
                )}

                {/* Graph Visualization */}
                <div className="lg:col-span-7 h-[600px] relative flex flex-col gap-4">
                  <div className="flex-1 relative bg-[#0a0a0a] border border-[#333] rounded-lg overflow-hidden">
                    <div className="absolute top-4 left-4 z-10 bg-black/80 p-2 border border-[#333] rounded text-[10px] text-[#666] space-y-1">
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#ff4444]" /> TARGET</div>
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#44ff44]" /> EMAIL</div>
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#4444ff]" /> DOMAIN</div>
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#ffff44]" /> SOCIAL</div>
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#ff44ff]" /> LEAK</div>
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#ffaa00]" /> PERSON</div>
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#00ffff]" /> COMPANY</div>
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#ff00ff]" /> POLITICAL</div>
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#00ff00]" /> FINANCIAL</div>
                    </div>
                    
                    <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                      <button 
                        onClick={() => setShowEditor(!showEditor)}
                        className={`p-2 rounded border transition-all ${showEditor ? 'bg-[#ff4444] text-black border-[#ff4444]' : 'bg-black text-[#666] border-[#333] hover:border-[#ff4444]'}`}
                        title="Toggle Graph Editor"
                      >
                        <Share2 size={16} />
                      </button>
                      {selectedNodeId && (
                        <button 
                          onClick={() => {
                            const node = data.nodes.find(n => n.id === selectedNodeId);
                            if (node) handleExpandNode(node.id, node.label);
                          }}
                          disabled={!!expandingNodeId}
                          className={`p-2 rounded border transition-all ${expandingNodeId === selectedNodeId ? 'bg-[#ff4444] text-black border-[#ff4444]' : 'bg-black text-[#ff4444] border-[#333] hover:border-[#ff4444]'}`}
                          title="Expand Node Intelligence"
                        >
                          {expandingNodeId === selectedNodeId ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16} />}
                        </button>
                      )}
                    </div>

                    <Graph 
                      nodes={data.nodes} 
                      links={data.links} 
                      onNodeClick={(node) => setSelectedNodeId(node.id)}
                      selectedNodeId={selectedNodeId}
                    />
                  </div>

                  {showEditor && (
                    <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-4 grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2">
                      {/* Add Node */}
                      <div className="space-y-3 border-r border-[#1a1a1a] pr-4">
                        <h3 className="text-[10px] font-bold text-[#666] uppercase">Add New Entity</h3>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={newNodeLabel}
                            onChange={(e) => setNewNodeLabel(e.target.value)}
                            placeholder="NAME/LABEL..."
                            className="flex-1 bg-black border border-[#222] p-2 text-[10px] focus:border-[#ff4444] outline-none"
                          />
                          <select 
                            value={newNodeType}
                            onChange={(e) => setNewNodeType(e.target.value as any)}
                            className="bg-black border border-[#222] p-2 text-[10px] text-[#eee] outline-none"
                          >
                            <option value="person">PERSON</option>
                            <option value="company">COMPANY</option>
                            <option value="political">POLITICAL</option>
                            <option value="financial">FINANCIAL</option>
                            <option value="social">SOCIAL</option>
                            <option value="email">EMAIL</option>
                          </select>
                          <button 
                            onClick={addCustomNode}
                            className="bg-[#333] hover:bg-[#ff4444] text-white px-3 rounded transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Add Link */}
                      <div className="space-y-3">
                        <h3 className="text-[10px] font-bold text-[#666] uppercase">
                          Create Relationship {selectedNodeId ? `from [${data.nodes.find(n => n.id === selectedNodeId)?.label}]` : '(Select a node first)'}
                        </h3>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={newLinkLabel}
                            onChange={(e) => setNewLinkLabel(e.target.value)}
                            placeholder="RELATIONSHIP (e.g. SON, CEO)..."
                            className="flex-1 bg-black border border-[#222] p-2 text-[10px] focus:border-[#ff4444] outline-none"
                          />
                          <select 
                            value={targetNodeId}
                            onChange={(e) => setTargetNodeId(e.target.value)}
                            className="bg-black border border-[#222] p-2 text-[10px] text-[#eee] outline-none"
                          >
                            <option value="">TO TARGET...</option>
                            {data.nodes.filter(n => n.id !== selectedNodeId).map(n => (
                              <option key={n.id} value={n.id}>{n.label}</option>
                            ))}
                          </select>
                          <button 
                            onClick={addCustomLink}
                            disabled={!selectedNodeId || !targetNodeId}
                            className="bg-[#333] hover:bg-[#ff4444] text-white px-3 rounded transition-colors disabled:opacity-30"
                          >
                            LINK
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sources & Chat */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                  {/* Intelligence Report */}
                  <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-6 h-[300px] overflow-y-auto custom-scrollbar relative group">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xs font-bold text-[#666] uppercase flex items-center gap-2">
                        <Database size={14} /> Intelligence Report
                      </h2>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleTTS(data.report)}
                          disabled={ttsLoading}
                          title="Listen to Report"
                          className="p-1.5 bg-[#111] border border-[#222] hover:border-[#ff4444] rounded text-[#666] hover:text-[#ff4444] transition-all"
                        >
                          {ttsLoading ? <Loader2 size={12} className="animate-spin" /> : <Volume2 size={12} />}
                        </button>
                        <button 
                          onClick={() => downloadAsPDF(data)}
                          title="Download PDF"
                          className="p-1.5 bg-[#111] border border-[#222] hover:border-[#ff4444] rounded text-[#666] hover:text-[#ff4444] transition-all"
                        >
                          <FileText size={12} />
                        </button>
                        <button 
                          onClick={() => downloadAsWord(data)}
                          title="Download Word"
                          className="p-1.5 bg-[#111] border border-[#222] hover:border-[#4444ff] rounded text-[#666] hover:text-[#4444ff] transition-all"
                        >
                          <FileCode size={12} />
                        </button>
                        <button 
                          onClick={() => downloadAsExcel(data)}
                          title="Download Excel"
                          className="p-1.5 bg-[#111] border border-[#222] hover:border-[#44ff44] rounded text-[#666] hover:text-[#44ff44] transition-all"
                        >
                          <FileSpreadsheet size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="prose prose-invert prose-sm max-w-none prose-headings:text-[#ff4444] prose-a:text-[#4444ff]">
                      <Markdown>{data.report}</Markdown>
                    </div>
                    {audioUrl && (
                      <div className="mt-4 p-2 bg-black border border-[#222] rounded flex items-center gap-3">
                        <Play size={14} className="text-[#ff4444]" />
                        <audio src={audioUrl} controls className="h-8 flex-1 invert" autoPlay />
                      </div>
                    )}
                  </div>

                  {/* Chat Interface */}
                  <div className="bg-[#0a0a0a] border border-[#333] rounded-lg flex flex-col h-[400px]">
                    <div className="p-4 border-b border-[#1a1a1a] flex items-center justify-between">
                      <h2 className="text-xs font-bold text-[#666] uppercase flex items-center gap-2">
                        <MessageSquare size={14} /> Analyst Chat
                      </h2>
                      <span className="text-[9px] text-[#333] uppercase">Encrypted Session</span>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                      {chatMessages.length === 0 && (
                        <div className="text-center text-[#333] text-[10px] mt-10 uppercase tracking-widest">
                          Ask for more details about the target...
                        </div>
                      )}
                      {chatMessages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] p-3 rounded text-[11px] ${
                            msg.role === 'user' 
                              ? 'bg-[#ff4444]/10 border border-[#ff4444]/30 text-[#eee]' 
                              : 'bg-[#111] border border-[#222] text-[#aaa]'
                          }`}>
                            <div className="text-[9px] uppercase font-bold mb-1 opacity-50">
                              {msg.role === 'user' ? 'Operator' : 'Nexus AI'}
                            </div>
                            <div className="prose prose-invert prose-xs">
                              <Markdown>{msg.text}</Markdown>
                            </div>
                          </div>
                        </div>
                      ))}
                      {chatLoading && (
                        <div className="flex justify-start">
                          <div className="bg-[#111] border border-[#222] p-3 rounded">
                            <Loader2 className="w-4 h-4 animate-spin text-[#ff4444]" />
                          </div>
                        </div>
                      )}
                    </div>

                    <form onSubmit={handleChat} className="p-4 border-t border-[#1a1a1a] flex gap-2">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="ASK ANALYST..."
                        className="flex-1 bg-black border border-[#222] p-2 text-[11px] focus:outline-none focus:border-[#ff4444] transition-colors"
                      />
                      <button 
                        type="submit"
                        disabled={chatLoading || !chatInput.trim()}
                        className="bg-[#ff4444] text-black p-2 rounded hover:bg-white transition-colors disabled:opacity-50"
                      >
                        <Send size={14} />
                      </button>
                    </form>
                  </div>

                  {/* Sources */}
                  <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-6 max-h-[200px] overflow-y-auto custom-scrollbar">
                    <h2 className="text-xs font-bold text-[#666] uppercase mb-4 flex items-center gap-2">
                      <Globe size={14} /> Verified Sources
                    </h2>
                    <div className="space-y-3">
                      {data.sources.length > 0 ? data.sources.map((source, i) => (
                        <a
                          key={i}
                          href={source.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-3 bg-[#111] border border-[#222] hover:border-[#444] transition-colors rounded text-[11px]"
                        >
                          <div className="text-[#eee] font-bold truncate">{source.title}</div>
                          <div className="text-[#444] truncate">{source.uri}</div>
                        </a>
                      )) : (
                        <p className="text-[#333] italic text-xs">No external sources identified.</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : activeTab === 'multimedia' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-6">
                <h2 className="text-xs font-bold text-[#666] uppercase mb-6 flex items-center gap-2">
                  <ImageIcon size={14} /> Multimedia Controls
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] text-[#444] uppercase mb-2 block">Intelligence Prompt</label>
                    <textarea 
                      value={mmPrompt}
                      onChange={(e) => setMmPrompt(e.target.value)}
                      placeholder="Describe the visual evidence or scenario..."
                      className="w-full bg-black border border-[#222] p-3 text-xs focus:border-[#ff4444] outline-none h-24 resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleGenerateImage}
                      disabled={mmLoading}
                      className="flex-1 bg-[#111] border border-[#222] hover:border-[#ff4444] p-3 rounded text-[10px] font-bold uppercase flex items-center justify-center gap-2 transition-all"
                    >
                      {mmLoading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                      Gen Image
                    </button>
                    <button 
                      onClick={handleGenerateVideo}
                      disabled={mmLoading}
                      className="flex-1 bg-[#111] border border-[#222] hover:border-[#ff4444] p-3 rounded text-[10px] font-bold uppercase flex items-center justify-center gap-2 transition-all"
                    >
                      {mmLoading ? <Loader2 size={14} className="animate-spin" /> : <Film size={14} />}
                      Gen Video
                    </button>
                  </div>
                  <div className="border-t border-[#1a1a1a] pt-4">
                    <label className="text-[10px] text-[#444] uppercase mb-2 block">Forensic Analysis</label>
                    <div className="flex gap-2">
                      <label className="flex-1 bg-[#111] border border-[#222] hover:border-[#eee] p-3 rounded text-[10px] font-bold uppercase flex items-center justify-center gap-2 cursor-pointer transition-all">
                        <Upload size={14} />
                        {selectedFile ? selectedFile.name.slice(0, 10) + '...' : 'Upload File'}
                        <input type="file" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
                      </label>
                      <button 
                        onClick={handleAnalyzeMedia}
                        disabled={mmLoading || !selectedFile}
                        className="bg-[#ff4444] text-black px-4 rounded font-bold uppercase text-[10px] disabled:opacity-50"
                      >
                        Analyze
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:col-span-8">
              <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-6 min-h-[600px] flex flex-col items-center justify-center relative overflow-hidden">
                {!mmResult && !mmLoading && (
                  <div className="text-center text-[#1a1a1a]">
                    <ImageIcon size={64} strokeWidth={1} />
                    <p className="mt-4 uppercase tracking-[0.2em] text-sm">Multimedia Output Terminal</p>
                  </div>
                )}
                {mmLoading && (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 size={48} className="animate-spin text-[#ff4444]" />
                    <p className="text-[10px] text-[#666] uppercase animate-pulse">Processing Neural Evidence...</p>
                  </div>
                )}
                {mmResult?.type === 'image' && (
                  <img src={mmResult.url} alt="Generated" className="max-w-full max-h-[500px] rounded border border-[#333] shadow-2xl" />
                )}
                {mmResult?.type === 'video' && (
                  <video src={mmResult.url} controls autoPlay className="max-w-full max-h-[500px] rounded border border-[#333] shadow-2xl" />
                )}
                {mmResult?.type === 'analysis' && (
                  <div className="w-full h-full p-6 overflow-y-auto custom-scrollbar">
                    <h3 className="text-xs font-bold text-[#ff4444] uppercase mb-4 flex items-center gap-2">
                      <Eye size={14} /> Forensic Analysis Report
                    </h3>
                    <div className="prose prose-invert prose-sm max-w-none">
                      <Markdown>{mmResult.text || ''}</Markdown>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'maps' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-12">
              <form onSubmit={handleMapsSearch} className="relative group">
                <input
                  type="text"
                  value={mapsQuery}
                  onChange={(e) => setMapsQuery(e.target.value)}
                  placeholder="ENTER LOCATION OR GEOSPATIAL TARGET..."
                  className="w-full bg-[#0a0a0a] border border-[#333] p-6 pl-14 rounded-lg focus:outline-none focus:border-[#ff4444] transition-all text-lg tracking-tight placeholder:text-[#333]"
                />
                <MapIcon className="absolute left-6 top-1/2 -translate-y-1/2 text-[#333] group-focus-within:text-[#ff4444] transition-colors" />
                <button
                  disabled={mapsLoading}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-[#ff4444] text-black px-6 py-2 rounded font-bold hover:bg-white transition-colors disabled:opacity-50"
                >
                  {mapsLoading ? <Loader2 className="animate-spin" /> : 'LOCATE'}
                </button>
              </form>
            </div>
            {mapsData ? (
              <>
                <div className="lg:col-span-8 bg-[#0a0a0a] border border-[#333] rounded-lg p-6 min-h-[500px] overflow-y-auto custom-scrollbar">
                  <h2 className="text-xs font-bold text-[#666] uppercase mb-6 flex items-center gap-2">
                    <Globe size={14} /> Geospatial Intelligence Report
                  </h2>
                  <div className="prose prose-invert prose-sm max-w-none prose-headings:text-[#ff4444]">
                    <Markdown>{mapsData.report}</Markdown>
                  </div>
                </div>
                <div className="lg:col-span-4 bg-[#0a0a0a] border border-[#333] rounded-lg p-6">
                  <h2 className="text-xs font-bold text-[#666] uppercase mb-6 flex items-center gap-2">
                    <MapIcon size={14} /> Map References
                  </h2>
                  <div className="space-y-3">
                    {mapsData.sources.map((source, i) => (
                      <a
                        key={i}
                        href={source.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 bg-[#111] border border-[#222] hover:border-[#ff4444] transition-colors rounded text-[11px]"
                      >
                        <div className="text-[#eee] font-bold truncate">{source.title}</div>
                        <div className="text-[#444] truncate">{source.uri}</div>
                      </a>
                    ))}
                  </div>
                </div>
              </>
            ) : !mapsLoading && (
              <div className="lg:col-span-12 h-[500px] border border-dashed border-[#1a1a1a] rounded-lg flex flex-col items-center justify-center text-[#1a1a1a]">
                <MapIcon size={64} strokeWidth={1} />
                <p className="mt-4 uppercase tracking-[0.2em] text-sm">Awaiting Geospatial Query</p>
              </div>
            )}
          </div>
        ) : activeTab === 'database' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-6 min-h-[600px]">
                <h2 className="text-xs font-bold text-[#666] uppercase mb-6 flex items-center gap-2">
                  <Database size={14} /> Intelligence History
                </h2>
                {!user ? (
                  <div className="text-center py-20 text-[#333] text-[10px] uppercase tracking-widest">
                    Connect Operator to view history
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-20 text-[#333] text-[10px] uppercase tracking-widest">
                    No intelligence history found
                  </div>
                ) : (
                  <div className="space-y-4">
                    {history.map(item => (
                      <div key={item.id} className="p-4 bg-[#111] border border-[#222] rounded group hover:border-[#ff4444] transition-all cursor-pointer" onClick={() => loadHistoryItem(item)}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold text-[#eee] truncate">{item.query}</span>
                          <span className="text-[8px] text-[#444] uppercase">{item.timestamp?.toDate().toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-[#444] uppercase">
                          <span>{(item.data?.nodes?.length || 0)} Nodes // {(item.data?.links?.length || 0)} Links</span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); deleteHistoryItem(item.id); }} 
                            className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-[#ff4444]"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-8 space-y-6">
              <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-6 min-h-[600px]">
                <h2 className="text-xs font-bold text-[#666] uppercase mb-6 flex items-center gap-2">
                  <Globe size={14} /> Global Intelligence Database
                </h2>
                {!user ? (
                  <div className="text-center py-40 text-[#333] text-[10px] uppercase tracking-widest">
                    Operator Authentication Required
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-40 text-[#333] text-[10px] uppercase tracking-widest">
                    Database empty. Perform searches to populate.
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-[#111] p-4 border border-[#222] rounded">
                        <div className="text-[9px] text-[#444] uppercase mb-1">Total Entities</div>
                        <div className="text-2xl font-bold text-[#ff4444]">
                          {Array.from(new Set(history.flatMap(h => h.data?.nodes?.map((n: any) => n.label) || []))).length}
                        </div>
                      </div>
                      <div className="bg-[#111] p-4 border border-[#222] rounded">
                        <div className="text-[9px] text-[#444] uppercase mb-1">Total Relations</div>
                        <div className="text-2xl font-bold text-[#4444ff]">
                          {history.reduce((acc, h) => acc + (h.data?.links?.length || 0), 0)}
                        </div>
                      </div>
                      <div className="bg-[#111] p-4 border border-[#222] rounded">
                        <div className="text-[9px] text-[#444] uppercase mb-1">Data Sources</div>
                        <div className="text-2xl font-bold text-[#44ff44]">
                          {Array.from(new Set(history.flatMap(h => h.data?.sources?.map((s: any) => s.uri) || []))).length}
                        </div>
                      </div>
                    </div>

                    <div className="border border-[#222] rounded overflow-hidden">
                      <table className="w-full text-left text-[10px]">
                        <thead className="bg-[#111] text-[#666] uppercase">
                          <tr>
                            <th className="p-3 border-b border-[#222]">Label</th>
                            <th className="p-3 border-b border-[#222]">Type</th>
                            <th className="p-3 border-b border-[#222]">Occurrences</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1a1a1a]">
                          {Object.entries(
                            history.flatMap(h => h.data?.nodes || []).reduce((acc: any, node: any) => {
                              if (!acc[node.label]) acc[node.label] = { type: node.type, count: 0 };
                              acc[node.label].count++;
                              return acc;
                            }, {})
                          ).sort((a: any, b: any) => b[1].count - a[1].count).slice(0, 50).map(([label, info]: any) => (
                            <tr key={label} className="hover:bg-[#111] transition-colors">
                              <td className="p-3 font-bold text-[#eee]">{label}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                                  info.type === 'target' ? 'bg-[#ff4444]/20 text-[#ff4444]' :
                                  info.type === 'person' ? 'bg-[#ffaa00]/20 text-[#ffaa00]' :
                                  info.type === 'company' ? 'bg-[#00ffff]/20 text-[#00ffff]' :
                                  'bg-[#333] text-[#666]'
                                }`}>
                                  {info.type}
                                </span>
                              </td>
                              <td className="p-3 text-[#666]">{info.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'forensics' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-6">
                <h2 className="text-xs font-bold text-[#666] uppercase mb-6 flex items-center gap-2">
                  <Shield size={14} /> Forensic Modules
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] text-[#444] uppercase mb-2 block">Select Module</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['username', 'email', 'domain', 'ip'] as const).map(tool => (
                        <button
                          key={tool}
                          onClick={() => setForensicTool(tool)}
                          className={`p-3 rounded border text-[10px] font-bold uppercase transition-all ${forensicTool === tool ? 'bg-[#ff4444] text-black border-[#ff4444]' : 'bg-[#111] text-[#666] border-[#222] hover:border-[#ff4444]'}`}
                        >
                          {tool}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#444] uppercase mb-2 block">Target Input</label>
                    <form onSubmit={handleForensicSearch} className="flex gap-2">
                      <input 
                        type="text" 
                        value={forensicQuery}
                        onChange={(e) => setForensicQuery(e.target.value)}
                        placeholder={`Enter ${forensicTool}...`}
                        className="flex-1 bg-black border border-[#222] p-3 text-xs focus:border-[#ff4444] outline-none"
                      />
                      <button 
                        type="submit"
                        disabled={forensicLoading || !forensicQuery.trim()}
                        className="bg-[#ff4444] text-black px-4 rounded font-bold uppercase text-[10px] disabled:opacity-50"
                      >
                        {forensicLoading ? <Loader2 size={14} className="animate-spin" /> : 'Run'}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:col-span-8">
              <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-6 min-h-[600px] flex flex-col relative overflow-hidden">
                <h2 className="text-xs font-bold text-[#666] uppercase mb-6 flex items-center gap-2">
                  <Database size={14} /> Forensic Output
                </h2>
                {!forensicResult && !forensicLoading && (
                  <div className="flex-1 flex flex-col items-center justify-center text-[#1a1a1a]">
                    <Shield size={64} strokeWidth={1} />
                    <p className="mt-4 uppercase tracking-[0.2em] text-sm">Awaiting Forensic Execution</p>
                  </div>
                )}
                {forensicLoading && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4">
                    <Loader2 size={48} className="animate-spin text-[#ff4444]" />
                    <p className="text-[10px] text-[#666] uppercase animate-pulse">Mining Unstructured Data...</p>
                  </div>
                )}
                {forensicResult && (
                  <div className="prose prose-invert prose-sm max-w-none prose-headings:text-[#ff4444]">
                    <Markdown>{forensicResult}</Markdown>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Monitoring Dashboard */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-6 min-h-[600px]">
                <h2 className="text-xs font-bold text-[#666] uppercase mb-6 flex items-center gap-2">
                  <Activity size={14} /> Active Watchlist
                </h2>
                {!user ? (
                  <div className="text-center py-20 text-[#333] text-[10px] uppercase tracking-widest">
                    Connect Operator to view watchlist
                  </div>
                ) : monitoredTargets.length === 0 ? (
                  <div className="text-center py-20 text-[#333] text-[10px] uppercase tracking-widest">
                    No targets currently monitored
                  </div>
                ) : (
                  <div className="space-y-4">
                    {monitoredTargets.map(target => (
                      <div key={target.id} className="p-4 bg-[#111] border border-[#222] rounded group">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold text-[#eee] truncate">{target.query}</span>
                          <div className={`text-[8px] px-2 py-0.5 rounded uppercase font-bold ${target.status === 'active' ? 'bg-[#44ff44]/10 text-[#44ff44]' : 'bg-[#ff4444]/10 text-[#ff4444]'}`}>
                            {target.status}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-[#444] uppercase">
                          <span>Added: {target.createdAt?.toDate().toLocaleDateString()}</span>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => toggleTargetStatus(target)} className="hover:text-[#eee]">
                              {target.status === 'active' ? 'Pause' : 'Resume'}
                            </button>
                            <button onClick={() => deleteTarget(target.id)} className="hover:text-[#ff4444]">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-8 space-y-6">
              <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-6 min-h-[600px]">
                <h2 className="text-xs font-bold text-[#666] uppercase mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-2"><Bell size={14} /> Intelligence Feed</div>
                  <span className="text-[9px] text-[#333]">Real-time Updates</span>
                </h2>
                
                {!user ? (
                  <div className="text-center py-40 text-[#333] text-[10px] uppercase tracking-widest">
                    Operator Authentication Required
                  </div>
                ) : alerts.length === 0 ? (
                  <div className="text-center py-40 text-[#333] text-[10px] uppercase tracking-widest">
                    Awaiting intelligence updates...
                  </div>
                ) : (
                  <div className="space-y-4">
                    {alerts.map(alert => (
                      <div key={alert.id} className="p-4 bg-[#111] border-l-2 border-[#ff4444] rounded-r">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xs font-bold text-[#eee]">{alert.title}</h3>
                          <span className="text-[9px] text-[#666] uppercase">{alert.timestamp?.toDate().toLocaleString()}</span>
                        </div>
                        <p className="text-[11px] text-[#aaa] mb-3">{alert.content}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-[#444] uppercase">Target: {monitoredTargets.find(t => t.id === alert.targetId)?.query || 'Unknown'}</span>
                          <div className={`text-[8px] px-2 py-0.5 rounded uppercase font-bold ${
                            alert.severity === 'critical' ? 'bg-[#ff4444] text-black' :
                            alert.severity === 'high' ? 'bg-[#ff4444]/20 text-[#ff4444]' :
                            alert.severity === 'medium' ? 'bg-[#ffff44]/20 text-[#ffff44]' :
                            'bg-[#44ff44]/20 text-[#44ff44]'
                          }`}>
                            {alert.severity}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-[#1a1a1a] p-4 text-center text-[10px] text-[#333] uppercase tracking-widest">
        Nexus Intelligence System v1.0.4 // Authorized Access Only
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #050505;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1a1a1a;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #333;
        }
      `}</style>
    </div>
  );
}

