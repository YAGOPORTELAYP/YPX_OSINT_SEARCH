import React, { useState, useEffect, useMemo } from 'react';
import { Search, Shield, Globe, Database, Share2, Loader2, AlertTriangle, MessageSquare, Send, Download, FileText, FileSpreadsheet, FileCode, Activity, LogIn, LogOut, Trash2, Bell, Image as ImageIcon, Film, Map as MapIcon, Volume2, Play, Upload, Eye, History, Maximize2, Minimize2, Target as TargetIcon, RefreshCw, XCircle, Car, Building2, Scan } from 'lucide-react';
import Markdown from 'react-markdown';
import { OSINT_BRAZUCA_REGEX, identifyPattern, formatPatternName, RegexType } from './lib/osintRegex';
import { performIntelligenceSearch, chatIntelligence, performMapsSearch, generateIntelligenceImage, generateIntelligenceVideo, analyzeMedia, textToSpeech, expandIntelligenceNode, performForensicTool, analyzeSocialMedia, performSherlockSearch, performInurlbrScan, performConnectivitySearch, submitFeedback } from './services/geminiService';
import Biometrics from './components/Biometrics';
import { performFaceAnalysis } from './services/biometricService';
import { IntelligenceData, ChatMessage, Target, Alert } from './types';
import Graph from './components/Graph';
import { downloadAsPDF, downloadAsWord, downloadAsExcel } from './lib/downloadUtils';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { Tooltip } from './components/Tooltip';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { collection, query as fsQuery, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, orderBy, limit } from 'firebase/firestore';

const sanitize = (obj: any) => {
  if (!obj) return obj;
  return JSON.parse(JSON.stringify(obj));
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'monitor' | 'multimedia' | 'maps' | 'history' | 'forensics' | 'vehicle-placa' | 'vehicle-renavam' | 'vehicle-chassi' | 'cnpj' | 'validator' | 'social-extract' | 'sherlock' | 'inurlbr' | 'connectivity' | 'biometrics'>('vehicle-placa');
  
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [highThinking, setHighThinking] = useState(false);
  const [brazilLayer, setBrazilLayer] = useState(false);
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
  const [mapsQuery, setMapsQuery] = useState('');
  const [mapsData, setMapsData] = useState<{ report: string, sources: any[] } | null>(null);
  const [mapsLoading, setMapsLoading] = useState(false);

  // Vehicle Consultation State
  const [vehiclePlaca, setVehiclePlaca] = useState('');
  const [vehicleRenavam, setVehicleRenavam] = useState('');
  const [vehicleChassi, setVehicleChassi] = useState('');
  const [vehicleResult, setVehicleResult] = useState<any | null>(null);
  const [vehicleLoading, setVehicleLoading] = useState(false);

  // CNPJ Consultation State
  const [cnpjQuery, setCnpjQuery] = useState('');
  const [cnpjData, setCnpjData] = useState<any | null>(null);
  const [cnpjLoading, setCnpjLoading] = useState(false);

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
  const [detectedPattern, setDetectedPattern] = useState<RegexType | null>(null);
  const [validatorInput, setValidatorInput] = useState('');
  const [validatorResults, setValidatorResults] = useState<{ type: string, value: string }[]>([]);

  // Forensic Tools State
  const [forensicQuery, setForensicQuery] = useState('');
  const [forensicTool, setForensicTool] = useState<'username' | 'email' | 'domain' | 'ip'>('username');
  const [forensicResult, setForensicResult] = useState<string | null>(null);
  const [usernameQuery, setUsernameQuery] = useState('');
  const [forensicLoading, setForensicLoading] = useState(false);
  const [expandingNodeId, setExpandingNodeId] = useState<string | null>(null);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);

  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const [isGraphFullscreen, setIsGraphFullscreen] = useState(false);
  const [liteMode, setLiteMode] = useState(false);
  const [lastActive, setLastActive] = useState(Date.now());
  const [lastSavedData, setLastSavedData] = useState<string>('');
  const [lastSavedChat, setLastSavedChat] = useState<string>('');
  const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  // inurlBR State
  const [inurlbrDork, setInurlbrDork] = useState('');
  const [inurlbrEngine, setInurlbrEngine] = useState('google');
  const [feedbackModal, setFeedbackModal] = useState<{ open: boolean, sourceId: string, type: 'correction' | 'error' | 'praise' | null }>({ open: false, sourceId: '', type: null });
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [inurlbrResults, setInurlbrResults] = useState<{ url: string; title: string; snippet: string; status: string }[]>([]);
  const [inurlbrReport, setInurlbrReport] = useState<string | null>(null);
  const [inurlbrLoading, setInurlbrLoading] = useState(false);

  const handleInurlbrScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inurlbrDork.trim()) return;

    if (!await ensureApiKeySelected()) return;

    setInurlbrLoading(true);
    setInurlbrResults([]);
    setInurlbrReport(null);
    try {
      const result = await performInurlbrScan(inurlbrDork, inurlbrEngine);
      setInurlbrResults(result.results);
      setInurlbrReport(result.report);
      
      if (user) {
        try {
          await addDoc(collection(db, 'history'), {
            query: `INURLBR: ${inurlbrDork.trim()}`,
            type: 'inurlbr',
            data: sanitize(result),
            uid: user.uid,
            timestamp: serverTimestamp()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'history');
        }
      }
    } catch (err) {
      handleApiError(err);
    } finally {
      setInurlbrLoading(false);
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!user || !feedbackModal.type) return;
    setFeedbackLoading(true);
    try {
      await submitFeedback({
        sourceId: feedbackModal.sourceId,
        type: feedbackModal.type,
        comment: feedbackComment,
        originalData: data,
        uid: user.uid
      });
      setFeedbackModal({ open: false, sourceId: '', type: null });
      setFeedbackComment('');
    } catch (err) {
      console.error("Feedback failed:", err);
    } finally {
      setFeedbackLoading(false);
    }
  };

  // Sherlock State
  const [sherlockUsername, setSherlockUsername] = useState('');
  const [sherlockResults, setSherlockResults] = useState<{ site: string; url: string; status: 'found' | 'not_found' }[]>([]);
  const [sherlockReport, setSherlockReport] = useState<string | null>(null);
  const [sherlockLoading, setSherlockLoading] = useState(false);
  const [sherlockFilter, setSherlockFilter] = useState('');
  const [sherlockSort, setSherlockSort] = useState<'site' | 'status' | 'none'>('none');

  // Connectivity (IBC) State
  const [ibcMunicipality, setIbcMunicipality] = useState('');
  const [ibcState, setIbcState] = useState('');
  const [ibcData, setIbcData] = useState<{ report: string; data: any; sources: any[] } | null>(null);
  const [ibcLoading, setIbcLoading] = useState(false);
  const [ibcHistory, setIbcHistory] = useState<any[]>([]);
  const [ibcFilter, setIbcFilter] = useState('');
  const [ibcSort, setIbcSort] = useState<'municipality' | 'ibc' | 'none'>('none');

  const handleConnectivitySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ibcMunicipality.trim()) return;

    if (!await ensureApiKeySelected()) return;

    setIbcLoading(true);
    setIbcData(null);
    try {
      const result = await performConnectivitySearch(ibcMunicipality, ibcState);
      setIbcData(result);
      
      if (user) {
        try {
          await addDoc(collection(db, 'history'), {
            query: `IBC: ${ibcMunicipality.trim()}${ibcState ? `, ${ibcState}` : ''}`,
            type: 'connectivity',
            data: sanitize(result),
            uid: user.uid,
            timestamp: serverTimestamp()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'history');
        }
      }
    } catch (err) {
      handleApiError(err);
    } finally {
      setIbcLoading(false);
    }
  };

  const handleSherlockSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sherlockUsername.trim()) return;

    if (!await ensureApiKeySelected()) return;

    setSherlockLoading(true);
    setSherlockResults([]);
    setSherlockReport(null);
    try {
      const result = await performSherlockSearch(sherlockUsername);
      setSherlockResults(result.profiles);
      setSherlockReport(result.report);
      
      if (user) {
        try {
          await addDoc(collection(db, 'history'), {
            query: `SHERLOCK: ${sherlockUsername.trim()}`,
            type: 'sherlock',
            data: sanitize(result),
            uid: user.uid,
            timestamp: serverTimestamp()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'history');
        }
      }
    } catch (err) {
      handleApiError(err);
    } finally {
      setSherlockLoading(false);
    }
  };

  const handleAnalyzeSocialMedia = async () => {
    if (!data?.report) return;

    if (!await ensureApiKeySelected()) return;

    setLoading(true);
    try {
      const result = await analyzeSocialMedia(data.report, data.nodes, data.links, highThinking);
      
      // Merge new nodes and links
      const existingNodeIds = new Set(data.nodes.map(n => n.id));
      const newNodes = result.nodes.filter(n => !existingNodeIds.has(n.id));
      
      const existingLinkKeys = new Set(data.links.map(l => {
        const s = typeof l.source === 'string' ? l.source : l.source.id;
        const t = typeof l.target === 'string' ? l.target : l.target.id;
        return `${s}-${t}-${l.label}`;
      }));
      const newLinks = result.links.filter(l => {
        const s = typeof l.source === 'string' ? l.source : l.source.id;
        const t = typeof l.target === 'string' ? l.target : l.target.id;
        return !existingLinkKeys.has(`${s}-${t}-${l.label}`);
      });
      
      const updatedData = {
        ...data,
        nodes: [...data.nodes, ...newNodes],
        links: [...data.links, ...newLinks]
      };
      
      setData(updatedData);
      
      // Update history
      if (currentHistoryId) {
        const historyRef = doc(db, 'history', currentHistoryId);
        await updateDoc(historyRef, { data: sanitize(updatedData) });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenKeySelection = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setError(null);
    } else {
      setError("INTELLIGENCE GRID CONNECTION ERROR: Key selection interface unavailable. Please ensure you are in the AI Studio environment.");
    }
  };

  const updateHistory = async (newData?: IntelligenceData, newChatMessages?: ChatMessage[]) => {
    if (newData) setData(newData);
    if (newChatMessages) setChatMessages(newChatMessages);

    if (user && currentHistoryId) {
      try {
        const updateObj: any = {};
        if (newData) updateObj.data = sanitize(newData);
        if (newChatMessages) updateObj.chatMessages = sanitize(newChatMessages);
        
        await updateDoc(doc(db, 'history', currentHistoryId), {
          ...updateObj,
          timestamp: serverTimestamp()
        });
        
        // Update last saved state to prevent redundant auto-saves
        if (newData) setLastSavedData(JSON.stringify(newData));
        if (newChatMessages) setLastSavedChat(JSON.stringify(newChatMessages));
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `history/${currentHistoryId}`);
      }
    }
  };

  // Auto-save useEffect
  useEffect(() => {
    if (!user || !currentHistoryId || !data) return;

    const interval = setInterval(async () => {
      const currentDataStr = JSON.stringify(data);
      const currentChatStr = JSON.stringify(chatMessages);

      if (currentDataStr !== lastSavedData || currentChatStr !== lastSavedChat) {
        console.log("Auto-saving intelligence state...");
        try {
          await updateDoc(doc(db, 'history', currentHistoryId), {
            data: sanitize(data),
            chatMessages: sanitize(chatMessages),
            timestamp: serverTimestamp()
          });
          setLastSavedData(currentDataStr);
          setLastSavedChat(currentChatStr);
        } catch (err) {
          console.error("Auto-save failed:", err);
        }
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [user, currentHistoryId, data, chatMessages, lastSavedData, lastSavedChat]);

  // IBC History Listener
  useEffect(() => {
    if (!user) {
      setIbcHistory([]);
      return;
    }

    const q = fsQuery(
      collection(db, 'history'),
      where('uid', '==', user.uid),
      where('type', '==', 'connectivity'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const history = snapshot.docs.map(doc => {
        const data = doc.data();
        const [m, s] = data.query.replace('IBC: ', '').split(', ');
        return {
          id: doc.id,
          municipality: m || '',
          state: s || '',
          data: data.data,
          timestamp: data.timestamp
        };
      });
      setIbcHistory(history);
    }, (err) => {
      console.error("Failed to fetch IBC history:", err);
    });

    return () => unsubscribe();
  }, [user]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    
    return () => unsubscribe();
  }, []);

  // Real-time Listeners for Monitoring
  useEffect(() => {
    if (!isAuthReady || !user) {
      setMonitoredTargets([]);
      setAlerts([]);
      return;
    }

    const targetsQuery = fsQuery(collection(db, 'targets'), where('uid', '==', user.uid));
    const unsubscribeTargets = onSnapshot(targetsQuery, (snapshot) => {
      setMonitoredTargets(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Target)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'targets');
    });

    const alertsQuery = fsQuery(collection(db, 'alerts'), where('uid', '==', user.uid), orderBy('timestamp', 'desc'), limit(20));
    const unsubscribeAlerts = onSnapshot(alertsQuery, (snapshot) => {
      setAlerts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Alert)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'alerts');
    });

    setHistoryLoading(true);
    const historyQuery = fsQuery(collection(db, 'history'), where('uid', '==', user.uid), orderBy('timestamp', 'desc'));
    const unsubscribeHistory = onSnapshot(historyQuery, (snapshot) => {
      setHistory(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setHistoryLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'history');
      setHistoryLoading(false);
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

  const handleLogout = () => {
    auth.signOut();
    setError("SESSION EXPIRED: You have been logged out due to inactivity.");
  };

  // Session Timeout Logic
  useEffect(() => {
    if (!user) return;

    const updateActivity = () => setLastActive(Date.now());

    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('scroll', updateActivity);

    const checkTimeout = setInterval(() => {
      const now = Date.now();
      if (now - lastActive > SESSION_TIMEOUT) {
        handleLogout();
      }
    }, 60000); // Check every minute

    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('scroll', updateActivity);
      clearInterval(checkTimeout);
    };
  }, [user, lastActive]);

  const handleApiError = (err: any) => {
    console.error(err);
    const message = err instanceof Error ? err.message : String(err);
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes("quota") || lowerMessage.includes("rate limit") || lowerMessage.includes("429")) {
      setError("INTELLIGENCE GRID QUOTA EXCEEDED: You have reached the request limit for your Intelligence Key. Please wait a few minutes or use a different key.");
    } else if (lowerMessage.includes("paid project") || lowerMessage.includes("billing") || lowerMessage.includes("upgrade")) {
      setError("INTELLIGENCE GRID RESTRICTION: This feature requires a Paid Project or Billing enabled. I've automatically optimized your session for LITE MODE to continue using free resources.");
      setLiteMode(true);
    } else if (
      lowerMessage.includes("api key not valid") || 
      lowerMessage.includes("invalid api key") || 
      lowerMessage.includes("api key invalid") ||
      lowerMessage.includes("403") || 
      lowerMessage.includes("unauthorized") ||
      lowerMessage.includes("requested entity was not found") ||
      lowerMessage.includes("connection error")
    ) {
      setError("INTELLIGENCE GRID CONNECTION ERROR: The system cannot verify your access credentials. Please click the 'RE-ESTABLISH CONNECTION' button below to connect your Intelligence Key.");
    } else {
      setError(message || "An unexpected error occurred in the intelligence engine.");
    }
  };

  const ensureApiKeySelected = async () => {
    if (window.aistudio?.hasSelectedApiKey) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await handleOpenKeySelection();
        return false;
      }
    }
    return true;
  };

  const resetSession = () => {
    setData(null);
    setQuery('');
    setChatMessages([]);
    setCurrentHistoryId(null);
    setError(null);
    setChatInput('');
    setForensicResult(null);
    setMapsData(null);
    setAudioUrl(null);
    setLastSavedData('');
    setLastSavedChat('');
  };

  const filteredSherlock = useMemo(() => {
    let results = [...sherlockResults];
    if (sherlockFilter) {
      results = results.filter(r => r.site.toLowerCase().includes(sherlockFilter.toLowerCase()));
    }
    if (sherlockSort === 'site') {
      results.sort((a, b) => a.site.localeCompare(b.site));
    } else if (sherlockSort === 'status') {
      results.sort((a, b) => a.status.localeCompare(b.status));
    }
    return results;
  }, [sherlockResults, sherlockFilter, sherlockSort]);

  const filteredIbc = useMemo(() => {
    let results = [...ibcHistory];
    if (ibcFilter) {
      results = results.filter(r => r.municipality.toLowerCase().includes(ibcFilter.toLowerCase()));
    }
    if (ibcSort === 'municipality') {
      results.sort((a, b) => a.municipality.localeCompare(b.municipality));
    } else if (ibcSort === 'ibc') {
      results.sort((a, b) => (b.data.ibc || 0) - (a.data.ibc || 0));
    }
    return results;
  }, [ibcHistory, ibcFilter, ibcSort]);

  const handleValidatorSearch = () => {
    const results: { type: string, value: string }[] = [];
    for (const [key, regex] of Object.entries(OSINT_BRAZUCA_REGEX)) {
      const matches = validatorInput.match(new RegExp(regex, 'gi'));
      if (matches) {
        matches.forEach(match => {
          if (!results.find(r => r.value === match)) {
            results.push({ type: formatPatternName(key as RegexType), value: match });
          }
        });
      }
    }
    setValidatorResults(results);
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setDetectedPattern(identifyPattern(val));
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const hasKey = await ensureApiKeySelected();
    if (!hasKey) return;

    setLoading(true);
    setError(null);
    setChatMessages([]); 
    try {
      const result = await performIntelligenceSearch(query, false, brazilLayer, liteMode);
      setData(result);
      setLastSavedData(JSON.stringify(result));
      setLastSavedChat(JSON.stringify([]));
      
      // Save to history if user is logged in
      if (user) {
        try {
          const docRef = await addDoc(collection(db, 'history'), {
            query: query.trim(),
            type: 'intelligence',
            data: sanitize(result),
            chatMessages: [],
            uid: user.uid,
            timestamp: serverTimestamp(),
            brazilLayer
          });
          setCurrentHistoryId(docRef.id);
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'history');
        }
      }
    } catch (err) {
      handleApiError(err);
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
    updateHistory({
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
    updateHistory({
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
      handleFirestoreError(err, OperationType.WRITE, 'targets');
    } finally {
      setMonitoringLoading(false);
    }
  };

  const deleteTarget = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'targets', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `targets/${id}`);
    }
  };

  const deleteHistoryItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'history', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `history/${id}`);
    }
  };

  const loadHistoryItem = (item: any) => {
    setCurrentHistoryId(item.id);
    if (item.type === 'maps') {
      setMapsData(item.data);
      setMapsQuery(item.query);
      setActiveTab('maps');
    } else if (item.type === 'forensics') {
      setForensicResult(item.data.report);
      setForensicQuery(item.query);
      if (item.tool) setForensicTool(item.tool);
      setActiveTab('forensics');
    } else if (item.type === 'connectivity') {
      setIbcData(item.data);
      const [m, s] = item.query.replace('IBC: ', '').split(', ');
      setIbcMunicipality(m || '');
      setIbcState(s || '');
      setActiveTab('connectivity');
    } else {
      setData(item.data);
      setQuery(item.query);
      setChatMessages(item.chatMessages || []);
      setActiveTab('search');
    }
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

  const handleContinueChat = async () => {
    if (chatLoading || !data) return;

    const hasKey = await ensureApiKeySelected();
    if (!hasKey) return;

    setChatLoading(true);
    setError(null);
    try {
      const response = await chatIntelligence(
        '[CONTINUE GENERATION FROM LAST POINT]',
        JSON.stringify({ nodes: data.nodes, links: data.links }),
        chatMessages,
        highThinking,
        brazilLayer,
        liteMode
      );
      
      let updatedData = data;
      if (response.nodes || response.links) {
        const existingNodeIds = new Set(data.nodes.map(n => n.id));
        const newNodes = (response.nodes || []).filter(n => !existingNodeIds.has(n.id));
        const allNodeIds = new Set([...existingNodeIds, ...newNodes.map(n => n.id)]);
        
        const existingLinkKeys = new Set(data.links.map(l => {
          const s = typeof l.source === 'string' ? l.source : l.source.id;
          const t = typeof l.target === 'string' ? l.target : l.target.id;
          return `${s}-${t}-${l.label}`;
        }));
        const newLinks = (response.links || []).filter(l => {
          const s = typeof l.source === 'string' ? l.source : l.source.id;
          const t = typeof l.target === 'string' ? l.target : l.target.id;
          return !existingLinkKeys.has(`${s}-${t}-${l.label}`) &&
                 allNodeIds.has(s) &&
                 allNodeIds.has(t);
        });
        
        if (newNodes.length > 0 || newLinks.length > 0) {
          updatedData = {
            ...data,
            nodes: [...data.nodes, ...newNodes],
            links: [...data.links, ...newLinks]
          };
        }
      }
      
      const finalMessages: ChatMessage[] = [...chatMessages, { role: 'model', text: response.text }];
      updateHistory(updatedData, finalMessages);
      
      if (user && currentHistoryId) {
        updateDoc(doc(db, 'history', currentHistoryId), {
          data: sanitize(updatedData),
          chatMessages: sanitize(finalMessages),
          timestamp: serverTimestamp()
        }).catch(err => console.error("Failed to save continued message:", err));
      }
    } catch (err) {
      handleApiError(err);
    } finally {
      setChatLoading(false);
    }
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const hasKey = await ensureApiKeySelected();
    if (!hasKey) return;

    const userMsg: ChatMessage = { role: 'user', text: chatInput };
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    const currentInput = chatInput;
    setChatInput('');
    setChatLoading(true);

    // Save user message to history immediately
    if (user && currentHistoryId) {
      updateDoc(doc(db, 'history', currentHistoryId), {
        chatMessages: sanitize(updatedMessages),
        timestamp: serverTimestamp()
      }).catch(err => console.error("Failed to save user message:", err));
    }

    try {
      if (!data) {
        // Initial search via chat
        setQuery(currentInput);
        const result = await performIntelligenceSearch(currentInput, false, brazilLayer);
        setData(result);
        
        const finalMessages: ChatMessage[] = [...updatedMessages, { role: 'model', text: "Intelligence gathered. Analysis complete. I've generated the graph and report based on your query. How can I assist further?" }];
        setChatMessages(finalMessages);

        if (user) {
          try {
            const docRef = await addDoc(collection(db, 'history'), {
              query: currentInput.trim(),
              type: 'intelligence',
              data: sanitize(result),
              chatMessages: sanitize(finalMessages),
              uid: user.uid,
              timestamp: serverTimestamp(),
              brazilLayer
            });
            setCurrentHistoryId(docRef.id);
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, 'history');
          }
        }
      } else {
        const response = await chatIntelligence(currentInput, JSON.stringify({ nodes: data.nodes, links: data.links }), chatMessages, false, brazilLayer, liteMode);
        
        let updatedData = data;
        if (response.nodes || response.links) {
          const existingNodeIds = new Set(data.nodes.map(n => n.id));
          const newNodes = (response.nodes || []).filter(n => !existingNodeIds.has(n.id));
          
          // Combine existing and new node IDs for link validation
          const allNodeIds = new Set([...existingNodeIds, ...newNodes.map(n => n.id)]);
          
          const existingLinkKeys = new Set(data.links.map(l => {
            const s = typeof l.source === 'string' ? l.source : l.source.id;
            const t = typeof l.target === 'string' ? l.target : l.target.id;
            return `${s}-${t}-${l.label}`;
          }));
          const newLinks = (response.links || []).filter(l => {
            const s = typeof l.source === 'string' ? l.source : l.source.id;
            const t = typeof l.target === 'string' ? l.target : l.target.id;
            return !existingLinkKeys.has(`${s}-${t}-${l.label}`) &&
                   allNodeIds.has(s) &&
                   allNodeIds.has(t);
          });
          
          if (newNodes.length > 0 || newLinks.length > 0) {
            updatedData = {
              ...data,
              nodes: [...data.nodes, ...newNodes],
              links: [...data.links, ...newLinks]
            };
          }
        }
        
        const finalMessages: ChatMessage[] = [...updatedMessages, { role: 'model', text: response.text }];
        updateHistory(updatedData, finalMessages);
      }
    } catch (err) {
      handleApiError(err);
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
      const result = await performMapsSearch(mapsQuery, undefined, undefined, liteMode);
      setMapsData(result);
      
      if (user) {
        try {
          await addDoc(collection(db, 'history'), {
            query: mapsQuery.trim(),
            type: 'maps',
            data: sanitize(result),
            uid: user.uid,
            timestamp: serverTimestamp()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'history');
        }
      }
    } catch (err) {
      handleApiError(err);
    } finally {
      setMapsLoading(false);
    }
  };

  const handleVehicleSearch = async (e: React.FormEvent, type: 'placa' | 'renavam' | 'chassi') => {
    e.preventDefault();
    
    let payload: any = { type };
    let queryLabel = "";

    if (type === 'placa') {
      if (!vehiclePlaca.trim()) return;
      payload.placa = vehiclePlaca.trim();
      queryLabel = `PLACA: ${vehiclePlaca.trim()}`;
    } else if (type === 'renavam') {
      if (!vehicleRenavam.trim()) return;
      payload.renavam = vehicleRenavam.trim();
      queryLabel = `RENAVAM: ${vehicleRenavam.trim()}`;
    } else if (type === 'chassi') {
      if (!vehicleChassi.trim()) return;
      payload.chassi = vehicleChassi.trim();
      queryLabel = `CHASSI: ${vehicleChassi.trim()}`;
    }
    
    setVehicleLoading(true);
    setVehicleResult(null);
    setError(null);

    try {
      const response = await fetch('/api/vehicle-consultation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        setVehicleResult(result);
        
        if (user) {
          try {
            await addDoc(collection(db, 'history'), {
              query: queryLabel,
              type: `vehicle-${type}`,
              data: sanitize(result),
              uid: user.uid,
              timestamp: serverTimestamp()
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, 'history');
          }
        }
      } else {
        setError(result.error || "Vehicle consultation failed.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to connect to consultation server.");
    } finally {
      setVehicleLoading(false);
    }
  };

  const handleCnpjSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cnpjQuery.trim()) return;
    
    setCnpjLoading(true);
    setCnpjData(null);
    setError(null);

    try {
      const response = await fetch('/api/cnpj-consultation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cnpj: cnpjQuery.trim(),
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setCnpjData(result);
        
        if (user) {
          try {
            await addDoc(collection(db, 'history'), {
              query: `CNPJ: ${cnpjQuery.trim()}`,
              type: 'cnpj',
              data: sanitize(result),
              uid: user.uid,
              timestamp: serverTimestamp()
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, 'history');
          }
        }
      } else {
        setError(result.error || "CNPJ consultation failed.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to connect to CNPJ consultation server.");
    } finally {
      setCnpjLoading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!mmPrompt.trim()) return;
    if (!await ensureApiKeySelected()) return;
    setMmLoading(true);
    try {
      const url = await generateIntelligenceImage(mmPrompt, mmSize);
      setMmResult({ type: 'image', url });
    } catch (err) {
      handleApiError(err);
    } finally {
      setMmLoading(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!mmPrompt.trim()) return;
    if (!await ensureApiKeySelected()) return;
    setMmLoading(true);
    try {
      const url = await generateIntelligenceVideo(mmPrompt, mmResult?.type === 'image' ? mmResult.url : undefined);
      setMmResult({ type: 'video', url });
    } catch (err) {
      handleApiError(err);
    } finally {
      setMmLoading(false);
    }
  };

  const handleAnalyzeMedia = async () => {
    if (!selectedFile || !mmPrompt.trim()) return;
    if (!await ensureApiKeySelected()) return;
    setMmLoading(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const text = await analyzeMedia(mmPrompt, base64, selectedFile.type);
          setMmResult({ type: 'analysis', text });
        } catch (err) {
          handleApiError(err);
        } finally {
          setMmLoading(false);
        }
      };
    } catch (err) {
      handleApiError(err);
      setMmLoading(false);
    }
  };

  const handleTTS = async (text: string) => {
    if (!text) return;
    if (!await ensureApiKeySelected()) return;
    setTtsLoading(true);
    try {
      const url = await textToSpeech(text);
      setAudioUrl(url);
    } catch (err) {
      handleApiError(err);
    } finally {
      setTtsLoading(false);
    }
  };

  const handleExpandNode = async (nodeId: string, nodeLabel: string) => {
    if (!data) return;
    if (!await ensureApiKeySelected()) return;
    setExpandingNodeId(nodeId);
    try {
      const result = await expandIntelligenceNode(nodeId, nodeLabel, data, highThinking, brazilLayer, liteMode);
      
      // Merge new nodes and links
      const existingNodeIds = new Set(data.nodes.map(n => n.id));
      const newNodes = result.nodes.filter(n => !existingNodeIds.has(n.id));
      
      // Combine existing and new node IDs for link validation
      const allNodeIds = new Set([...existingNodeIds, ...newNodes.map(n => n.id)]);
      
      const existingLinkKeys = new Set(data.links.map(l => {
        const s = typeof l.source === 'string' ? l.source : l.source.id;
        const t = typeof l.target === 'string' ? l.target : l.target.id;
        return `${s}-${t}-${l.label}`;
      }));
      const newLinks = result.links.filter(l => {
        const s = typeof l.source === 'string' ? l.source : l.source.id;
        const t = typeof l.target === 'string' ? l.target : l.target.id;
        return !existingLinkKeys.has(`${s}-${t}-${l.label}`) &&
               allNodeIds.has(s) &&
               allNodeIds.has(t);
      });
      
      updateHistory({
        ...data,
        nodes: [...data.nodes, ...newNodes],
        links: [...data.links, ...newLinks],
        report: data.report + "\n\n### Node Expansion Update: " + nodeLabel + "\n" + result.report
      });
    } catch (err) {
      handleApiError(err);
    } finally {
      setExpandingNodeId(null);
    }
  };

  const handleNodeDragEnd = (updatedNodes: any[]) => {
    if (!data) return;
    updateHistory({
      ...data,
      nodes: updatedNodes
    });
  };

  const handleForensicSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forensicQuery.trim()) return;
    if (!await ensureApiKeySelected()) return;
    setForensicLoading(true);
    try {
      const result = await performForensicTool(forensicTool, forensicQuery);
      setForensicResult(result);
      
      if (user) {
        try {
          await addDoc(collection(db, 'history'), {
            query: forensicQuery.trim(),
            type: 'forensics',
            tool: forensicTool,
            data: sanitize({ report: result }),
            uid: user.uid,
            timestamp: serverTimestamp()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'history');
        }
      }
    } catch (err) {
      handleApiError(err);
    } finally {
      setForensicLoading(false);
    }
  };

  const handleUsernameSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameQuery.trim()) return;
    if (!await ensureApiKeySelected()) return;
    setForensicLoading(true);
    try {
      const result = await performForensicTool('username', usernameQuery);
      setForensicResult(result);
      
      if (user) {
        try {
          await addDoc(collection(db, 'history'), {
            query: usernameQuery.trim(),
            type: 'forensics',
            tool: 'username',
            data: sanitize({ report: result }),
            uid: user.uid,
            timestamp: serverTimestamp()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'history');
        }
      }
    } catch (err) {
      handleApiError(err);
    } finally {
      setForensicLoading(false);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center font-mono">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-[#00ff00] animate-spin mx-auto" strokeWidth={1} />
          <p className="text-[10px] text-[#00ff00] uppercase tracking-[0.5em] animate-pulse">Initializing Neural Link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-mono selection:bg-[#00ff00] selection:text-black">
      {/* Header */}
      <header className="border-b border-[#1a1a1a] p-4 flex flex-col md:flex-row items-center justify-between bg-[#0a0a0a] gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Shield className="text-[#00ff00] w-8 h-8 glitch-hover shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-bold tracking-tighter uppercase italic glitch-hover truncate">VOID OSINT // ANONYMOUS</h1>
            <p className="text-[8px] md:text-[10px] text-[#666] uppercase tracking-widest truncate">DATA EXPLOITATION & NETWORK MAPPING</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-black/50 border border-[#1a1a1a] px-3 py-1.5 rounded">
              <span className={`text-[8px] font-bold uppercase ${liteMode ? 'text-yellow-500' : 'text-[#00ff00]'}`}>
                {liteMode ? 'Lite Mode Active' : 'Full Grid Active'}
              </span>
              <button 
                onClick={() => setLiteMode(!liteMode)}
                className={`w-8 h-4 rounded-full relative transition-all ${liteMode ? 'bg-yellow-500/20' : 'bg-[#00ff00]/20'}`}
              >
                <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${liteMode ? 'right-0.5 bg-yellow-500' : 'left-0.5 bg-[#00ff00]'}`} />
              </button>
            </div>

            <nav className="flex items-center gap-1 bg-black p-1 rounded border border-[#1a1a1a] overflow-x-auto max-w-full no-scrollbar">
            <Tooltip text="INTELLIGENCE SEARCH">
              <button 
                onClick={() => setActiveTab('search')}
                className={`px-3 md:px-4 py-1.5 rounded text-[9px] md:text-[10px] font-bold uppercase transition-all whitespace-nowrap ${activeTab === 'search' ? 'bg-[#00ff00] text-black' : 'text-[#666] hover:text-[#eee]'}`}
              >
                INFILTRATE
              </button>
            </Tooltip>
            <Tooltip text="MULTIMEDIA EXFILTRATION">
              <button 
                onClick={() => setActiveTab('multimedia')}
                className={`px-3 md:px-4 py-1.5 rounded text-[9px] md:text-[10px] font-bold uppercase transition-all whitespace-nowrap ${activeTab === 'multimedia' ? 'bg-[#00ff00] text-black' : 'text-[#666] hover:text-[#eee]'}`}
              >
                EXFILTRATION
              </button>
            </Tooltip>
            <Tooltip text="GEOSPATIAL INTELLIGENCE">
              <button 
                onClick={() => setActiveTab('maps')}
                className={`px-3 md:px-4 py-1.5 rounded text-[9px] md:text-[10px] font-bold uppercase transition-all whitespace-nowrap ${activeTab === 'maps' ? 'bg-[#00ff00] text-black' : 'text-[#666] hover:text-[#eee]'}`}
              >
                GEOLOCATION
              </button>
            </Tooltip>
            <Tooltip text="REAL-TIME SURVEILLANCE">
              <button 
                onClick={() => setActiveTab('monitor')}
                className={`px-3 md:px-4 py-1.5 rounded text-[9px] md:text-[10px] font-bold uppercase transition-all whitespace-nowrap ${activeTab === 'monitor' ? 'bg-[#00ff00] text-black' : 'text-[#666] hover:text-[#eee]'}`}
              >
                SURVEILLANCE
              </button>
            </Tooltip>
            <Tooltip text="BIOMETRIC FORENSICS">
              <button 
                onClick={() => setActiveTab('biometrics')}
                className={`px-3 md:px-4 py-1.5 rounded text-[9px] md:text-[10px] font-bold uppercase transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'biometrics' ? 'bg-[#00ff00] text-black' : 'text-[#666] hover:text-[#eee]'}`}
              >
                <Scan size={12} />
                BIOMETRICS
              </button>
            </Tooltip>
            <Tooltip text="INTELLIGENCE HISTORY">
              <button 
                onClick={() => setActiveTab('history')}
                className={`px-3 md:px-4 py-1.5 rounded text-[9px] md:text-[10px] font-bold uppercase transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'history' ? 'bg-[#00ff00] text-black' : 'text-[#666] hover:text-[#eee]'}`}
              >
                <History size={12} />
                HISTORY
              </button>
            </Tooltip>
            <Tooltip text="SYSTEM EXPLOITATION">
              <button 
                onClick={() => setActiveTab('forensics')}
                className={`px-3 md:px-4 py-1.5 rounded text-[9px] md:text-[10px] font-bold uppercase transition-all whitespace-nowrap ${activeTab === 'forensics' ? 'bg-[#00ff00] text-black' : 'text-[#666] hover:text-[#eee]'}`}
              >
                EXPLOITATION
              </button>
            </Tooltip>
            <Tooltip text="OSINT PATTERN VALIDATOR">
              <button 
                onClick={() => setActiveTab('validator')}
                className={`px-3 md:px-4 py-1.5 rounded text-[9px] md:text-[10px] font-bold uppercase transition-all whitespace-nowrap ${activeTab === 'validator' ? 'bg-[#00ff00] text-black' : 'text-[#666] hover:text-[#eee]'}`}
              >
                VALIDATOR
              </button>
            </Tooltip>
            <Tooltip text="EXTRACT SOCIAL MEDIA">
              <button 
                onClick={() => setActiveTab('social-extract')}
                className={`px-3 md:px-4 py-1.5 rounded text-[9px] md:text-[10px] font-bold uppercase transition-all whitespace-nowrap ${activeTab === 'social-extract' ? 'bg-[#00ff00] text-black' : 'text-[#666] hover:text-[#eee]'}`}
              >
                SOCIAL
              </button>
            </Tooltip>
            <Tooltip text="CONNECTIVITY INTELLIGENCE (IBC)">
              <button 
                onClick={() => setActiveTab('connectivity')}
                className={`px-3 md:px-4 py-1.5 rounded text-[9px] md:text-[10px] font-bold uppercase transition-all whitespace-nowrap ${activeTab === 'connectivity' ? 'bg-[#00ff00] text-black' : 'text-[#666] hover:text-[#eee]'}`}
              >
                CONNECTIVITY
              </button>
            </Tooltip>
            <Tooltip text="SHERLOCK USERNAME SEARCH">
              <button 
                onClick={() => setActiveTab('sherlock')}
                className={`px-3 md:px-4 py-1.5 rounded text-[9px] md:text-[10px] font-bold uppercase transition-all whitespace-nowrap ${activeTab === 'sherlock' ? 'bg-[#00ff00] text-black' : 'text-[#666] hover:text-[#eee]'}`}
              >
                SHERLOCK
              </button>
            </Tooltip>
            <Tooltip text="INURLBR ADVANCED DORKING">
              <button 
                onClick={() => setActiveTab('inurlbr')}
                className={`px-3 md:px-4 py-1.5 rounded text-[9px] md:text-[10px] font-bold uppercase transition-all whitespace-nowrap ${activeTab === 'inurlbr' ? 'bg-[#00ff00] text-black' : 'text-[#666] hover:text-[#eee]'}`}
              >
                INURLBR
              </button>
            </Tooltip>
            <Tooltip text="VEHICLE BY PLATE">
              <button 
                onClick={() => setActiveTab('vehicle-placa')}
                className={`px-3 md:px-4 py-1.5 rounded text-[9px] md:text-[10px] font-bold uppercase transition-all whitespace-nowrap ${activeTab === 'vehicle-placa' ? 'bg-[#00ff00] text-black' : 'text-[#666] hover:text-[#eee]'}`}
              >
                PLACA
              </button>
            </Tooltip>
            <Tooltip text="VEHICLE BY RENAVAM">
              <button 
                onClick={() => setActiveTab('vehicle-renavam')}
                className={`px-3 md:px-4 py-1.5 rounded text-[9px] md:text-[10px] font-bold uppercase transition-all whitespace-nowrap ${activeTab === 'vehicle-renavam' ? 'bg-[#00ff00] text-black' : 'text-[#666] hover:text-[#eee]'}`}
              >
                RENAVAM
              </button>
            </Tooltip>
            <Tooltip text="VEHICLE BY CHASSI">
              <button 
                onClick={() => setActiveTab('vehicle-chassi')}
                className={`px-3 md:px-4 py-1.5 rounded text-[9px] md:text-[10px] font-bold uppercase transition-all whitespace-nowrap ${activeTab === 'vehicle-chassi' ? 'bg-[#00ff00] text-black' : 'text-[#666] hover:text-[#eee]'}`}
              >
                CHASSI
              </button>
            </Tooltip>
            <Tooltip text="CNPJ CONSULTATION">
              <button 
                onClick={() => setActiveTab('cnpj')}
                className={`px-3 md:px-4 py-1.5 rounded text-[9px] md:text-[10px] font-bold uppercase transition-all whitespace-nowrap ${activeTab === 'cnpj' ? 'bg-[#00ff00] text-black' : 'text-[#666] hover:text-[#eee]'}`}
              >
                CNPJ
              </button>
            </Tooltip>
          </nav>

          <div className="flex items-center gap-4 text-[10px] text-[#444] border-t sm:border-t-0 sm:border-l border-[#1a1a1a] pt-4 sm:pt-0 sm:pl-6 w-full sm:w-auto justify-center">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-[#00ff00]/10 border border-[#00ff00]/30 rounded-full">
              <div className={`w-2 h-2 rounded-full ${error ? 'bg-red-500' : 'bg-[#00ff00] animate-pulse'}`} />
              <span className="text-[10px] font-bold tracking-tighter text-[#00ff00]">
                {error ? 'CONNECTION INTERRUPTED' : 'SYSTEM ONLINE'}
              </span>
            </div>
            <Tooltip text="VIEW PREVIOUS BREACHES">
              <button 
                onClick={() => setShowHistorySidebar(!showHistorySidebar)}
                className={`flex items-center gap-2 text-[8px] md:text-[9px] font-bold uppercase border px-2 md:px-3 py-1 rounded transition-all ${showHistorySidebar ? 'bg-[#00ff00] text-black border-[#00ff00]' : 'text-[#666] border-[#333] hover:border-[#00ff00]'}`}
              >
                <History size={10} className="md:w-3 md:h-3" />
                {showHistorySidebar ? 'CLOSE ARCHIVE' : 'OPEN ARCHIVE'}
              </button>
            </Tooltip>
            {user ? (
              <div className="flex items-center gap-3">
                <img src={user.photoURL || ''} className="w-6 h-6 rounded-full border border-[#333]" alt="User" referrerPolicy="no-referrer" />
                <Tooltip text="DISCONNECT FROM SYSTEM">
                  <button onClick={handleLogout} className="hover:text-[#00ff00] transition-colors uppercase font-bold">DISCONNECT</button>
                </Tooltip>
              </div>
            ) : (
              <Tooltip text="AUTHENTICATE OPERATOR">
                <button onClick={handleLogin} className="flex items-center gap-2 hover:text-[#00ff00] transition-colors uppercase font-bold">
                  <LogIn size={14} /> CONNECT OPERATOR
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      </header>

      <main className="p-4 md:p-6 max-w-7xl mx-auto">
        {activeTab === 'search' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
            {/* Search Section (Chat-First) */}
            {!data && (
              <div className="lg:col-span-12 flex flex-col items-center justify-center min-h-[400px] md:min-h-[600px] space-y-6 md:space-y-8 animate-in fade-in zoom-in-95 duration-500 py-10">
                <div className="relative">
                  <div className="absolute -inset-4 bg-[#00ff00]/5 blur-3xl rounded-full animate-pulse" />
                  <Shield className="text-[#00ff00] w-16 h-16 md:w-24 md:h-24 relative glitch-hover" strokeWidth={1} />
                </div>
                
                <div className="text-center space-y-2 px-4">
                  <h2 className="text-lg md:text-2xl font-bold tracking-[0.1em] md:tracking-[0.3em] uppercase italic text-[#eee] glitch-hover break-words">COGNITIVE AUTONOMOUS SYSTEM // LEVEL 9</h2>
                  <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4">
                    <p className="text-[8px] md:text-[10px] text-[#00ff00] uppercase tracking-[0.2em] md:tracking-[0.5em] font-bold">AGENTIC REASONING ACTIVE</p>
                    <div className="hidden md:block w-1 h-1 rounded-full bg-[#00ff00] animate-pulse" />
                    <p className="text-[8px] md:text-[10px] text-[#00ff00] uppercase tracking-[0.2em] md:tracking-[0.5em] font-bold">TOKEN EFFICIENCY MODE</p>
                  </div>
                </div>

                <div className="w-full max-w-2xl space-y-6 px-4">
                  {chatLoading && !data ? (
                    <div className="flex flex-col items-center justify-center space-y-4 p-6 md:p-12 bg-[#0a0a0a] border border-[#00ff00]/20 rounded-lg animate-pulse">
                      <Loader2 className="w-8 h-8 md:w-12 md:h-12 text-[#00ff00] animate-spin" strokeWidth={1} />
                      <div className="text-center">
                        <p className="text-[8px] md:text-[10px] text-[#00ff00] uppercase tracking-[0.2em] md:tracking-[0.4em] font-bold">BREACHING GRID // EXTRACTING DATA</p>
                        <p className="text-[7px] md:text-[8px] text-[#333] uppercase tracking-[0.1em] md:tracking-[0.2em] mt-1">Awaiting Intelligence Response...</p>
                      </div>
                      <button 
                        onClick={() => {
                          setChatLoading(false);
                          setLoading(false);
                          resetSession();
                        }}
                        className="text-[8px] md:text-[9px] text-red-500 uppercase border border-red-500/30 px-3 md:px-4 py-1.5 md:py-2 rounded hover:bg-red-500 hover:text-black transition-all mt-4"
                      >
                        Abort Breach
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleChat} className="relative group">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => {
                          setChatInput(e.target.value);
                          setDetectedPattern(identifyPattern(e.target.value));
                        }}
                        placeholder="DESCRIBE YOUR TARGET..."
                        className="w-full bg-[#0a0a0a] border border-[#333] p-4 md:p-6 pl-12 md:pl-14 pr-28 md:pr-36 rounded-lg focus:outline-none focus:border-[#00ff00] transition-all text-sm md:text-lg tracking-tight placeholder:text-[#111]"
                      />
                      {detectedPattern && (
                        <div className="absolute right-28 md:right-40 top-1/2 -translate-y-1/2 px-2 py-1 bg-[#00ff00]/20 border border-[#00ff00] rounded text-[8px] md:text-[10px] font-bold text-[#00ff00] animate-pulse whitespace-nowrap">
                          {formatPatternName(detectedPattern)}
                        </div>
                      )}
                      <MessageSquare className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 text-[#333] group-focus-within:text-[#00ff00] transition-colors w-4 h-4 md:w-6 md:h-6" />
                      <Tooltip text="START DATA BREACH">
                        <button
                          disabled={chatLoading || !chatInput.trim()}
                          className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 bg-[#00ff00] text-black px-4 md:px-6 py-1.5 md:py-2 rounded text-xs md:text-sm font-bold hover:bg-[#00ff00]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {chatLoading ? <Loader2 className="animate-spin w-4 h-4" /> : 'INITIATE'}
                        </button>
                      </Tooltip>
                    </form>
                  )}

                  <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8">
                    <Tooltip text="START NEW BREACH">
                      <button 
                        onClick={resetSession}
                        className="flex items-center gap-2 text-[8px] md:text-[9px] font-bold uppercase text-[#666] border border-[#333] px-3 md:px-4 py-1.5 md:py-2 rounded hover:border-[#00ff00] hover:text-[#00ff00] transition-all"
                      >
                        <RefreshCw size={10} className="md:w-3 md:h-3" />
                        NEW BREACH
                      </button>
                    </Tooltip>
                    <Tooltip text="ACTIVATE BRAZILIAN OSINT SOURCES">
                      <label className="flex items-center gap-2 md:gap-3 cursor-pointer group">
                        <div className="relative">
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={brazilLayer}
                            onChange={(e) => setBrazilLayer(e.target.checked)}
                          />
                          <div className={`w-8 md:w-10 h-4 md:h-5 rounded-full border border-[#333] transition-colors ${brazilLayer ? 'bg-[#00ff00]/20 border-[#00ff00]' : 'bg-[#0a0a0a]'}`} />
                          <div className={`absolute top-0.5 md:top-1 left-0.5 md:left-1 w-3 h-3 rounded-full transition-all ${brazilLayer ? 'translate-x-4 md:translate-x-5 bg-[#00ff00]' : 'bg-[#333]'}`} />
                        </div>
                        <span className={`text-[8px] md:text-[10px] font-bold uppercase tracking-widest transition-colors ${brazilLayer ? 'text-[#00ff00]' : 'text-[#666]'}`}>
                          BRAZIL LAYER
                        </span>
                      </label>
                    </Tooltip>
                  </div>
                </div>

                {error && (
                  <div className="w-full max-w-2xl bg-[#00ff00]/10 border border-[#00ff00] p-4 rounded flex flex-col gap-3 text-[#00ff00]">
                    <div className="flex items-center gap-3">
                      <AlertTriangle size={20} />
                      <span className="text-xs uppercase tracking-widest font-bold">{error}</span>
                      <div className="w-2 h-2 rounded-full bg-[#00ff00] animate-pulse ml-auto" />
                    </div>
                    {error.includes("INTELLIGENCE GRID CONNECTION ERROR") && (
                      <button 
                        onClick={handleOpenKeySelection}
                        className="flex items-center justify-center gap-2 bg-[#00ff00] text-black font-bold py-2 px-4 rounded hover:bg-[#00cc00] transition-colors text-[10px] tracking-widest uppercase"
                      >
                        <RefreshCw size={14} className="animate-spin-slow" />
                        RE-ESTABLISH CONNECTION
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {data && (
              <>
                {/* Header for Active Session */}
                <div className="lg:col-span-12 flex flex-col sm:flex-row sm:items-center justify-between bg-[#0a0a0a] border border-[#333] p-4 rounded-lg gap-4">
                  <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#00ff00] animate-pulse" />
                      <span className="text-[9px] md:text-[10px] font-bold uppercase text-[#eee] tracking-widest truncate max-w-[200px] md:max-w-none">COGNITIVE SESSION: {query}</span>
                    </div>
                    
                    {/* Operational Loop Visualization */}
                    <div className="hidden xl:flex items-center gap-4 border-l border-[#1a1a1a] pl-6">
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] text-[#333] font-bold">INPUT</span>
                        <div className="w-4 h-[1px] bg-[#333]" />
                        <span className="text-[8px] text-[#00ff00] font-bold animate-pulse">ACTION</span>
                        <div className="w-4 h-[1px] bg-[#333]" />
                        <span className="text-[8px] text-[#333] font-bold">OBSERVE</span>
                        <div className="w-4 h-[1px] bg-[#333]" />
                        <span className="text-[8px] text-[#333] font-bold">ADJUST</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:gap-4">
                  <div className="flex items-center gap-4 border-l border-[#1a1a1a] pl-4">
                    <Tooltip text="ACTIVATE BRAZILIAN OSINT SOURCES">
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <div className="relative">
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={brazilLayer}
                              onChange={(e) => setBrazilLayer(e.target.checked)}
                            />
                            <div className={`w-7 md:w-8 h-3.5 md:h-4 rounded-full border border-[#333] transition-colors ${brazilLayer ? 'bg-[#00ff00]/20 border-[#00ff00]' : 'bg-[#0a0a0a]'}`} />
                            <div className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full transition-all ${brazilLayer ? 'translate-x-3.5 md:translate-x-4 bg-[#00ff00]' : 'bg-[#333]'}`} />
                          </div>
                          <span className={`text-[8px] md:text-[9px] font-bold uppercase tracking-widest transition-colors ${brazilLayer ? 'text-[#00ff00]' : 'text-[#666]'}`}>
                            BRAZIL
                          </span>
                        </label>
                      </Tooltip>
                    </div>
                    {user && (
                      <button 
                        onClick={startMonitoring}
                        disabled={monitoringLoading}
                        className="flex items-center gap-2 text-[8px] md:text-[9px] font-bold uppercase text-[#00ff00] border border-[#00ff00]/30 px-2 md:px-3 py-1 rounded hover:bg-[#00ff00] hover:text-black transition-all"
                      >
                        {monitoringLoading ? <Loader2 className="w-2.5 h-2.5 md:w-3 md:h-3 animate-spin" /> : <Activity size={10} className="md:w-3 md:h-3" />}
                        SURVEILLANCE
                      </button>
                    )}
                    <Tooltip text="TERMINATE SESSION & START NEW">
                      <button 
                        onClick={resetSession}
                        className="flex items-center gap-2 text-[8px] md:text-[9px] font-bold uppercase text-red-500 border border-red-500/30 px-2 md:px-3 py-1 rounded hover:bg-red-500 hover:text-black transition-all"
                      >
                        <XCircle size={10} className="md:w-3 md:h-3" />
                        TERMINATE
                      </button>
                    </Tooltip>
                  </div>
                </div>

                {error && (
                  <div className="lg:col-span-12 bg-[#00ff00]/10 border border-[#00ff00] p-4 rounded flex flex-col gap-3 text-[#00ff00] animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-3">
                      <AlertTriangle size={20} />
                      <span className="text-xs uppercase tracking-widest font-bold">{error}</span>
                      <div className="w-2 h-2 rounded-full bg-[#00ff00] animate-pulse ml-auto" />
                    </div>
                    {error.includes("INTELLIGENCE GRID CONNECTION ERROR") && (
                      <button 
                        onClick={handleOpenKeySelection}
                        className="flex items-center justify-center gap-2 bg-[#00ff00] text-black font-bold py-2 px-4 rounded hover:bg-[#00cc00] transition-colors text-[10px] tracking-widest uppercase mt-2"
                      >
                        <RefreshCw size={14} className="animate-spin-slow" />
                        RE-ESTABLISH CONNECTION
                      </button>
                    )}
                  </div>
                )}

                <div className={`lg:col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 transition-all duration-300 ${showHistorySidebar ? 'lg:grid-cols-[250px_1fr]' : ''}`}>
                  {showHistorySidebar && (
                    <div className="lg:col-span-1 bg-[#0a0a0a] border border-[#333] rounded-lg p-4 h-[300px] lg:h-[600px] overflow-y-auto custom-scrollbar animate-in slide-in-from-left-4 duration-300">
                      <h3 className="text-[9px] md:text-[10px] font-bold text-[#666] uppercase mb-4 flex items-center gap-2 tracking-widest">
                        <History size={12} /> EVOLUTIONARY MEMORY
                      </h3>
                      <div className="space-y-2">
                        {historyLoading ? (
                          <div className="flex flex-col items-center justify-center py-10 space-y-2">
                            <Loader2 className="w-6 h-6 animate-spin text-[#00ff00]/50" />
                            <span className="text-[8px] text-[#333] uppercase tracking-widest">Accessing Archive...</span>
                          </div>
                        ) : history.length === 0 ? (
                          <div className="text-center py-10 text-[#333] text-[8px] uppercase tracking-widest">
                            Archive Empty
                          </div>
                        ) : history.map(item => (
                          <Tooltip key={item.id} text={`LOAD BREACH: ${item.query.toUpperCase()}`}>
                            <div 
                              onClick={() => loadHistoryItem(item)}
                              className={`p-3 rounded border transition-all cursor-pointer group ${currentHistoryId === item.id ? 'bg-[#00ff00]/10 border-[#00ff00] text-[#00ff00]' : 'bg-[#111] border-[#222] text-[#666] hover:border-[#00ff00]'}`}
                            >
                              <div className="text-[10px] font-bold truncate mb-1 group-hover:text-[#eee]">{item.query}</div>
                              <div className="flex items-center justify-between text-[8px] uppercase tracking-tighter opacity-50">
                                <span>{item.timestamp?.toDate().toLocaleDateString()}</span>
                                <span className="group-hover:text-[#00ff00]">{(item.data?.nodes?.length || 0)}N</span>
                              </div>
                            </div>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className={`${showHistorySidebar ? 'lg:col-span-11' : 'lg:col-span-12'} grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6`}>
                    {/* Graph Visualization */}
                    <div className="lg:col-span-7 h-[400px] md:h-[600px] relative flex flex-col gap-4">
                  <div className={`${isGraphFullscreen ? 'fixed inset-0 z-[100] p-4 bg-[#050505]' : 'flex-1 relative'} bg-[#0a0a0a] border border-[#333] rounded-lg overflow-hidden transition-all duration-300`}>
                    <div className="absolute top-2 md:top-4 left-2 md:left-4 z-10 bg-black/80 p-1.5 md:p-2 border border-[#333] rounded text-[8px] md:text-[10px] text-[#666] space-y-0.5 md:space-y-1">
                      <div className="flex items-center gap-1.5 md:gap-2"><div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#00ff00]" /> TARGET</div>
                      <div className="flex items-center gap-1.5 md:gap-2"><div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#00ffff]" /> EMAIL</div>
                      <div className="flex items-center gap-1.5 md:gap-2"><div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#ffff00]" /> DOMAIN</div>
                      <div className="flex items-center gap-1.5 md:gap-2"><div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#ff00ff]" /> SOCIAL</div>
                      <div className="flex items-center gap-1.5 md:gap-2"><div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#ff0000]" /> LEAK</div>
                      <div className="flex items-center gap-1.5 md:gap-2"><div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#00ff00]" /> PERSON</div>
                      <div className="flex items-center gap-1.5 md:gap-2"><div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#3366ff]" /> COMPANY</div>
                      <div className="flex items-center gap-1.5 md:gap-2"><div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#ff9900]" /> POLITICAL</div>
                      <div className="flex items-center gap-1.5 md:gap-2"><div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#00cc66]" /> FINANCIAL</div>
                    </div>
                    
                    <div className="absolute top-2 md:top-4 right-2 md:right-4 z-10 flex flex-col gap-1.5 md:gap-2">
                      <Tooltip text="ANALYZE SOCIAL MEDIA">
                        <button 
                          onClick={handleAnalyzeSocialMedia}
                          disabled={loading || !data}
                          className="p-1.5 md:p-2 bg-[#111] border border-[#333] text-[#00ff00] rounded hover:bg-[#222] transition-all disabled:opacity-50"
                        >
                          <Share2 size={14} className="md:w-4 md:h-4" />
                        </button>
                      </Tooltip>
                      <Tooltip text={isGraphFullscreen ? "EXIT FULLSCREEN" : "FULLSCREEN MODE"}>
                        <button 
                          onClick={() => setIsGraphFullscreen(!isGraphFullscreen)}
                          className="p-1.5 md:p-2 rounded border border-[#333] bg-black text-[#666] hover:border-[#00ff00] hover:text-[#00ff00] transition-all"
                        >
                          {isGraphFullscreen ? <Minimize2 size={14} className="md:w-4 md:h-4" /> : <Maximize2 size={14} className="md:w-4 md:h-4" />}
                        </button>
                      </Tooltip>
                      <Tooltip text="TOGGLE GRAPH EDITOR">
                        <button 
                          onClick={() => setShowEditor(!showEditor)}
                          className={`p-1.5 md:p-2 rounded border transition-all ${showEditor ? 'bg-[#00ff00] text-black border-[#00ff00]' : 'bg-black text-[#666] border-[#333] hover:border-[#00ff00]'}`}
                        >
                          <Share2 size={14} className="md:w-4 md:h-4" />
                        </button>
                      </Tooltip>
                      {selectedNodeId && (
                        <Tooltip text="CLEAR SELECTION">
                          <button 
                            onClick={() => setSelectedNodeId(null)}
                            className="p-1.5 md:p-2 bg-[#111] border border-[#333] text-red-500 rounded hover:bg-[#222] transition-all"
                          >
                            <XCircle size={14} className="md:w-4 md:h-4" />
                          </button>
                        </Tooltip>
                      )}
                      {selectedNodeId && (
                        <Tooltip text="EXPAND NODE INTELLIGENCE">
                          <button 
                            onClick={() => {
                              const node = data.nodes.find(n => n.id === selectedNodeId);
                              if (node) handleExpandNode(node.id, node.label);
                            }}
                            disabled={!!expandingNodeId}
                            className={`p-1.5 md:p-2 rounded border transition-all ${expandingNodeId === selectedNodeId ? 'bg-[#00ff00] text-black border-[#00ff00]' : 'bg-black text-[#00ff00] border-[#333] hover:border-[#00ff00]'}`}
                          >
                            {expandingNodeId === selectedNodeId ? <Loader2 size={14} className="md:w-4 md:h-4 animate-spin" /> : <Activity size={14} className="md:w-4 md:h-4" />}
                          </button>
                        </Tooltip>
                      )}
                    </div>

                    <Graph 
                      nodes={data.nodes} 
                      links={data.links} 
                      onNodeClick={(node) => setSelectedNodeId(node.id)}
                      onNodeDragEnd={handleNodeDragEnd}
                      selectedNodeId={selectedNodeId}
                    />
                  </div>

                  {showEditor && (
                    <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2">
                      {/* Add Node */}
                      <div className="space-y-3 border-b sm:border-b-0 sm:border-r border-[#1a1a1a] pb-4 sm:pb-0 sm:pr-4">
                        <h3 className="text-[9px] md:text-[10px] font-bold text-[#666] uppercase">Add New Entity</h3>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={newNodeLabel}
                            onChange={(e) => setNewNodeLabel(e.target.value)}
                            placeholder="NAME/LABEL..."
                            className="flex-1 bg-black border border-[#222] p-2 text-[10px] focus:border-[#00ff00] outline-none"
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
                          <Tooltip text="ADD CUSTOM ENTITY">
                            <button 
                              onClick={addCustomNode}
                              className="bg-[#333] hover:bg-[#00ff00] text-[#eee] px-3 rounded transition-colors"
                            >
                              +
                            </button>
                          </Tooltip>
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
                            className="flex-1 bg-black border border-[#222] p-2 text-[10px] focus:border-[#00ff00] outline-none"
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
                          <Tooltip text="ESTABLISH RELATIONSHIP">
                            <button 
                              onClick={addCustomLink}
                              disabled={!selectedNodeId || !targetNodeId}
                              className="bg-[#333] hover:bg-[#00ff00] text-[#eee] px-3 rounded transition-colors disabled:opacity-30"
                            >
                              LINK
                            </button>
                          </Tooltip>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sources & Chat */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                  {/* Intelligence Report */}
                  <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-4 md:p-6 h-[300px] md:h-[400px] overflow-y-auto custom-scrollbar relative group">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-[10px] md:text-xs font-bold text-[#666] uppercase flex items-center gap-2">
                        <Database size={14} /> Intelligence Report
                      </h2>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={handleAnalyzeSocialMedia}
                          disabled={loading || !data}
                          className="flex items-center gap-2 px-3 py-1.5 bg-[#111] border border-[#00ff00]/30 text-[#00ff00] rounded hover:bg-[#00ff00]/10 transition-all disabled:opacity-50 text-[10px] font-bold uppercase tracking-wider"
                        >
                          {loading ? <Loader2 size={12} className="animate-spin" /> : <Share2 size={12} />}
                          EXTRACT SOCIAL MEDIA
                        </button>
                        <Tooltip text="LISTEN TO REPORT">
                          <button 
                            onClick={() => handleTTS(data.report)}
                            disabled={ttsLoading}
                            className="p-1.5 bg-[#111] border border-[#222] hover:border-[#00ff00] rounded text-[#666] hover:text-[#00ff00] transition-all"
                          >
                            {ttsLoading ? <Loader2 size={12} className="animate-spin" /> : <Volume2 size={12} />}
                          </button>
                        </Tooltip>
                        <Tooltip text="DOWNLOAD PDF">
                          <button 
                            onClick={() => downloadAsPDF(data)}
                            className="p-1.5 bg-[#111] border border-[#222] hover:border-[#00ff00] rounded text-[#666] hover:text-[#00ff00] transition-all"
                          >
                            <FileText size={12} />
                          </button>
                        </Tooltip>
                        <Tooltip text="DOWNLOAD WORD">
                          <button 
                            onClick={() => downloadAsWord(data)}
                            className="p-1.5 bg-[#111] border border-[#222] hover:border-[#4444ff] rounded text-[#666] hover:text-[#4444ff] transition-all"
                          >
                            <FileCode size={12} />
                          </button>
                        </Tooltip>
                        <Tooltip text="DOWNLOAD EXCEL">
                          <button 
                            onClick={() => downloadAsExcel(data)}
                            className="p-1.5 bg-[#111] border border-[#222] hover:border-[#44ff44] rounded text-[#666] hover:text-[#44ff44] transition-all"
                          >
                            <FileSpreadsheet size={12} />
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                    {/* Cognitive Insights Section */}
                    {(data.hypothesis || data.strategy) && (
                      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {data.hypothesis && (
                          <div className="p-3 bg-[#00ff00]/5 border border-[#00ff00]/20 rounded space-y-2">
                            <div className="flex items-center gap-2 text-[9px] md:text-[10px] font-bold text-[#00ff00] uppercase tracking-widest">
                              <Activity size={12} /> HYPOTHESIS ENGINE
                            </div>
                            <p className="text-[9px] md:text-[10px] text-[#888] leading-relaxed italic">"{data.hypothesis}"</p>
                          </div>
                        )}
                        {data.strategy && (
                          <div className="p-3 bg-[#00ff00]/5 border border-[#00ff00]/20 rounded space-y-2">
                            <div className="flex items-center gap-2 text-[9px] md:text-[10px] font-bold text-[#00ff00] uppercase tracking-widest">
                              <TargetIcon size={12} /> EXECUTION STRATEGY
                            </div>
                            <p className="text-[9px] md:text-[10px] text-[#888] leading-relaxed italic">"{data.strategy}"</p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="prose prose-invert prose-xs md:prose-sm max-w-none prose-headings:text-[#00ff00] prose-a:text-[#00ff00]">
                      <Markdown>{data.report}</Markdown>
                    </div>

                    <div className="mt-8 pt-6 border-t border-[#1a1a1a] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-[#333]" />
                        <span className="text-[8px] text-[#333] uppercase font-bold tracking-[0.2em]">Self-Improvement Protocol Active</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[8px] text-[#444] uppercase font-bold">Rate Accuracy:</span>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => setFeedbackModal({ open: true, sourceId: currentHistoryId || 'current', type: 'praise' })}
                            className="p-1.5 hover:bg-[#00ff00]/10 rounded text-[#333] hover:text-[#00ff00] transition-all group"
                          >
                            <Shield size={14} className="group-hover:scale-110 transition-transform" />
                          </button>
                          <button 
                            onClick={() => setFeedbackModal({ open: true, sourceId: currentHistoryId || 'current', type: 'error' })}
                            className="p-1.5 hover:bg-red-500/10 rounded text-[#333] hover:text-red-500 transition-all group"
                          >
                            <AlertTriangle size={14} className="group-hover:scale-110 transition-transform" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {audioUrl && (
                      <div className="mt-4 p-2 bg-black border border-[#222] rounded flex items-center gap-3">
                        <Play size={14} className="text-[#00ff00]" />
                        <audio src={audioUrl} controls className="h-8 flex-1 invert" autoPlay />
                      </div>
                    )}
                  </div>

                  {/* Chat Interface */}
                  <div className="bg-[#0a0a0a] border border-[#333] rounded-lg flex flex-col h-[350px] md:h-[400px]">
                    <div className="p-3 md:p-4 border-b border-[#1a1a1a] flex items-center justify-between">
                      <h2 className="text-[10px] md:text-xs font-bold text-[#666] uppercase flex items-center gap-2">
                        <MessageSquare size={14} /> Analyst Chat
                      </h2>
                      <div className="flex items-center gap-2 md:gap-3">
                        <Tooltip text="CLEAR CHAT HISTORY">
                          <button 
                            onClick={() => setChatMessages([])}
                            className="text-[8px] md:text-[9px] text-[#333] uppercase hover:text-[#00ff00] transition-colors flex items-center gap-1"
                          >
                            <Trash2 size={10} /> Clear
                          </button>
                        </Tooltip>
                        <Tooltip text="START NEW SESSION">
                          <button 
                            onClick={resetSession}
                            className="text-[8px] md:text-[9px] text-red-500/50 uppercase hover:text-red-500 transition-colors flex items-center gap-1"
                          >
                            <RefreshCw size={10} /> New Session
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4 custom-scrollbar">
                      {chatMessages.length === 0 && (
                        <div className="text-center text-[#333] text-[9px] md:text-[10px] mt-10 uppercase tracking-widest">
                          Ask for more details about the target...
                        </div>
                      )}
                      {chatMessages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[90%] md:max-w-[85%] p-2.5 md:p-3 rounded text-[10px] md:text-[11px] ${
                            msg.role === 'user' 
                              ? 'bg-[#00ff00]/10 border border-[#00ff00]/30 text-[#eee]' 
                              : 'bg-[#111] border border-[#222] text-[#aaa]'
                          }`}>
                            <div className="text-[8px] md:text-[9px] uppercase font-bold mb-1 opacity-50">
                              {msg.role === 'user' ? 'OPERATOR' : 'VOID AI'}
                            </div>
                            <div className="prose prose-invert prose-xs prose-headings:text-[#00ff00] prose-a:text-[#00ff00]">
                              <Markdown>{msg.text}</Markdown>
                            </div>
                            {msg.role === 'model' && i === chatMessages.length - 1 && (msg.text.endsWith(':') || msg.text.length > 5000) && (
                              <button
                                onClick={handleContinueChat}
                                className="mt-2 text-[8px] font-bold text-[#00ff00] uppercase border border-[#00ff00]/30 px-2 py-1 rounded hover:bg-[#00ff00] hover:text-black transition-all flex items-center gap-1"
                              >
                                <RefreshCw size={10} /> Continue Generation
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {chatLoading && (
                        <div className="flex justify-start items-center gap-3">
                          <div className="bg-[#111] border border-[#222] p-2.5 md:p-3 rounded">
                            <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin text-[#00ff00]" />
                          </div>
                          <button 
                            onClick={() => setChatLoading(false)}
                            className="text-[8px] md:text-[9px] text-red-500 uppercase border border-red-500/30 px-2 py-1 rounded hover:bg-red-500 hover:text-black transition-all"
                          >
                            Stop
                          </button>
                        </div>
                      )}
                    </div>

                    <form onSubmit={handleChat} className="p-3 md:p-4 border-t border-[#1a1a1a] flex gap-2">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="ASK ANALYST..."
                        className="flex-1 bg-black border border-[#222] p-2 text-[10px] md:text-[11px] focus:outline-none focus:border-[#00ff00] transition-colors"
                      />
                      <Tooltip text="SEND MESSAGE">
                        <button 
                          type="submit"
                          disabled={chatLoading || !chatInput.trim()}
                          className="bg-[#00ff00] text-black p-2 rounded hover:bg-[#00ff00]/80 transition-colors disabled:opacity-50"
                        >
                          <Send size={14} />
                        </button>
                      </Tooltip>
                    </form>
                  </div>

                  {/* Sources */}
                  <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-4 md:p-6 max-h-[200px] overflow-y-auto custom-scrollbar">
                    <h2 className="text-[10px] md:text-xs font-bold text-[#666] uppercase mb-4 flex items-center gap-2">
                      <Globe size={14} /> Verified Sources
                    </h2>
                    <div className="space-y-3">
                      {data.sources.length > 0 ? data.sources.map((source, i) => (
                        <Tooltip key={i} text={`OPEN SOURCE: ${source.title.toUpperCase()}`}>
                          <a
                            href={source.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block p-2.5 md:p-3 bg-[#111] border border-[#222] hover:border-[#444] transition-colors rounded text-[10px] md:text-[11px]"
                          >
                            <div className="text-[#eee] font-bold truncate">{source.title}</div>
                            <div className="text-[#444] truncate">{source.uri}</div>
                          </a>
                        </Tooltip>
                      )) : (
                        <p className="text-[#333] italic text-[10px] uppercase tracking-widest text-center py-4">No external sources identified.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
        ) : activeTab === 'biometrics' ? (
          <Biometrics 
            onAddNode={(newNode) => {
              if (data) {
                updateHistory({
                  ...data,
                  nodes: [...data.nodes, newNode]
                });
                setActiveTab('search');
              }
            }}
          />
        ) : activeTab === 'multimedia' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
            <div className="lg:col-span-4 space-y-4 md:space-y-6">
              <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-4 md:p-6">
                <h2 className="text-[10px] md:text-xs font-bold text-[#666] uppercase mb-4 md:mb-6 flex items-center gap-2">
                  <ImageIcon size={14} /> Multimedia Controls
                </h2>
                {liteMode && (
                  <div className="mb-4 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-[9px] text-yellow-500 uppercase font-bold leading-tight">
                    <AlertTriangle size={10} className="inline mr-1 mb-0.5" />
                    Lite Mode Active: Multimedia generation (Image/Video) may be restricted or unavailable.
                  </div>
                )}
                <div className="space-y-4">
                  <div>
                    <label className="text-[8px] md:text-[10px] text-[#444] uppercase mb-2 block">Intelligence Prompt</label>
                    <Tooltip text="DESCRIBE VISUAL EVIDENCE">
                      <textarea 
                        value={mmPrompt}
                        onChange={(e) => setMmPrompt(e.target.value)}
                        placeholder="DESCRIBE THE VISUAL EVIDENCE OR SCENARIO..."
                        className="w-full bg-black border border-[#222] p-3 text-[10px] md:text-xs focus:border-[#00ff00] outline-none h-24 resize-none"
                      />
                    </Tooltip>
                  </div>
                  <div className="flex gap-2">
                    <Tooltip text="GENERATE IMAGE EVIDENCE">
                      <button 
                        onClick={handleGenerateImage}
                        disabled={mmLoading}
                        className="flex-1 bg-[#111] border border-[#222] hover:border-[#00ff00] p-2.5 md:p-3 rounded text-[9px] md:text-[10px] font-bold uppercase flex items-center justify-center gap-2 transition-all"
                      >
                        {mmLoading ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />}
                        IMAGE
                      </button>
                    </Tooltip>
                    <Tooltip text="GENERATE VIDEO EVIDENCE">
                      <button 
                        onClick={handleGenerateVideo}
                        disabled={mmLoading}
                        className="flex-1 bg-[#111] border border-[#222] hover:border-[#00ff00] p-2.5 md:p-3 rounded text-[9px] md:text-[10px] font-bold uppercase flex items-center justify-center gap-2 transition-all"
                      >
                        {mmLoading ? <Loader2 size={12} className="animate-spin" /> : <Film size={12} />}
                        VIDEO
                      </button>
                    </Tooltip>
                  </div>
                  <div className="border-t border-[#1a1a1a] pt-4">
                    <label className="text-[8px] md:text-[10px] text-[#444] uppercase mb-2 block">Forensic Analysis</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Tooltip text="UPLOAD FILE FOR ANALYSIS">
                        <label className="flex-1 bg-[#111] border border-[#222] hover:border-[#eee] p-2.5 md:p-3 rounded text-[9px] md:text-[10px] font-bold uppercase flex items-center justify-center gap-2 cursor-pointer transition-all">
                          <Upload size={12} />
                          {selectedFile ? selectedFile.name.slice(0, 10) + '...' : 'Upload'}
                          <input type="file" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
                        </label>
                      </Tooltip>
                      <Tooltip text="RUN FORENSIC ANALYSIS">
                        <button 
                          onClick={handleAnalyzeMedia}
                          disabled={mmLoading || !selectedFile}
                          className="bg-[#00ff00] text-black px-4 py-2.5 md:py-0 rounded font-bold uppercase text-[9px] md:text-[10px] disabled:opacity-50"
                        >
                          ANALYZE
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:col-span-8">
              <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-4 md:p-6 min-h-[300px] md:min-h-[600px] flex flex-col items-center justify-center relative overflow-hidden">
                {!mmResult && !mmLoading && (
                  <div className="text-center text-[#1a1a1a]">
                    <ImageIcon strokeWidth={1} className="w-12 h-12 md:w-16 md:h-16 mx-auto" />
                    <p className="mt-4 uppercase tracking-[0.2em] text-xs md:text-sm">Multimedia Output Terminal</p>
                  </div>
                )}
                {mmLoading && (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-[#00ff00] w-8 h-8 md:w-12 md:h-12" />
                    <p className="text-[8px] md:text-[10px] text-[#666] uppercase animate-pulse">PROCESSING NEURAL EVIDENCE...</p>
                  </div>
                )}
                {mmResult?.type === 'image' && (
                  <img src={mmResult.url} alt="Generated" className="max-w-full max-h-[300px] md:max-h-[500px] rounded border border-[#333] shadow-2xl" />
                )}
                {mmResult?.type === 'video' && (
                  <video src={mmResult.url} controls autoPlay className="max-w-full max-h-[300px] md:max-h-[500px] rounded border border-[#333] shadow-2xl" />
                )}
                {mmResult?.type === 'analysis' && (
                  <div className="w-full h-full p-2 md:p-6 overflow-y-auto custom-scrollbar">
                    <h3 className="text-[10px] md:text-xs font-bold text-[#00ff00] uppercase mb-4 flex items-center gap-2">
                      <Eye size={14} /> FORENSIC ANALYSIS REPORT
                    </h3>
                    <div className="prose prose-invert prose-xs md:prose-sm max-w-none prose-headings:text-[#00ff00] prose-a:text-[#00ff00]">
                      <Markdown>{mmResult.text || ''}</Markdown>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'maps' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
            <div className="lg:col-span-12">
              {liteMode && (
                <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-[10px] text-yellow-500 uppercase font-bold flex items-center gap-2">
                  <AlertTriangle size={14} />
                  Lite Mode Active: Live Google Maps integration is disabled. Using internal knowledge base for geolocation.
                </div>
              )}
              <form onSubmit={handleMapsSearch} className="relative group">
                <Tooltip text="ENTER TARGET LOCATION">
                  <input
                    type="text"
                    value={mapsQuery}
                    onChange={(e) => setMapsQuery(e.target.value)}
                    placeholder="ENTER LOCATION..."
                    className="w-full bg-[#0a0a0a] border border-[#333] p-4 md:p-6 pl-12 md:pl-14 rounded-lg focus:outline-none focus:border-[#00ff00] transition-all text-sm md:text-lg tracking-tight placeholder:text-[#333]"
                  />
                </Tooltip>
                <MapIcon className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 text-[#333] group-focus-within:text-[#00ff00] transition-colors w-4 h-4 md:w-6 md:h-6" />
                <Tooltip text="EXECUTE GEOSPATIAL SEARCH">
                  <button
                    disabled={mapsLoading}
                    className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 bg-[#00ff00] text-black px-4 md:px-6 py-1.5 md:py-2 rounded text-xs md:text-sm font-bold hover:bg-[#00ff00]/80 transition-colors disabled:opacity-50"
                  >
                    {mapsLoading ? <Loader2 className="animate-spin w-4 h-4" /> : 'LOCATE'}
                  </button>
                </Tooltip>
              </form>
            </div>
            {mapsData ? (
              <>
                <div className="lg:col-span-8 bg-[#0a0a0a] border border-[#333] rounded-lg p-4 md:p-6 min-h-[300px] md:min-h-[500px] overflow-y-auto custom-scrollbar">
                  <h2 className="text-[10px] md:text-xs font-bold text-[#666] uppercase mb-4 md:mb-6 flex items-center gap-2">
                    <Globe size={14} /> Geospatial Intelligence Report
                  </h2>
                  <div className="prose prose-invert prose-xs md:prose-sm max-w-none prose-headings:text-[#00ff00] prose-a:text-[#00ff00]">
                    <Markdown>{mapsData.report}</Markdown>
                  </div>
                </div>
                <div className="lg:col-span-4 bg-[#0a0a0a] border border-[#333] rounded-lg p-4 md:p-6">
                  <h2 className="text-[10px] md:text-xs font-bold text-[#666] uppercase mb-4 md:mb-6 flex items-center gap-2">
                    <MapIcon size={14} /> Map References
                  </h2>
                  <div className="space-y-3">
                    {mapsData.sources.map((source, i) => (
                      <Tooltip key={i} text={`OPEN MAP: ${source.title.toUpperCase()}`}>
                        <a
                          href={source.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-2.5 md:p-3 bg-[#111] border border-[#222] hover:border-[#00ff00] transition-colors rounded text-[10px] md:text-[11px]"
                        >
                          <div className="text-[#eee] font-bold truncate">{source.title}</div>
                          <div className="text-[#444] truncate">{source.uri}</div>
                        </a>
                      </Tooltip>
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
        ) : activeTab === 'history' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
            <div className="lg:col-span-4 space-y-4 md:space-y-6">
              <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-4 md:p-6 min-h-[400px] md:min-h-[600px]">
                <h2 className="text-[10px] md:text-xs font-bold text-[#666] uppercase mb-4 md:mb-6 flex items-center gap-2">
                  <Database size={14} /> Intelligence History
                </h2>
                <div className="mb-6 p-4 bg-[#00ff00]/5 border border-[#00ff00]/20 rounded space-y-3">
                  <h3 className="text-[9px] font-bold text-[#00ff00] uppercase tracking-widest">Advanced Dorking Scan</h3>
                  <p className="text-[10px] text-[#666] leading-relaxed">
                    Use the INURLBR module to perform advanced search engine dorking for leaks and vulnerabilities.
                  </p>
                  <button 
                    onClick={() => setActiveTab('inurlbr')}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#111] border border-[#333] text-[#00ff00] rounded font-bold uppercase text-[10px] hover:bg-[#222] transition-all"
                  >
                    <Search size={14} /> Open INURLBR Module
                  </button>
                </div>
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
                      <Tooltip key={item.id} text={`LOAD BREACH: ${item.query.toUpperCase()}`}>
                        <div className="p-4 bg-[#111] border border-[#222] rounded group hover:border-[#00ff00] transition-all cursor-pointer" onClick={() => loadHistoryItem(item)}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex flex-col">
                              <span className="text-[11px] font-bold text-[#eee] truncate max-w-[150px]">{item.query}</span>
                              <span className="text-[8px] text-[#00ff00] uppercase font-bold tracking-tighter">
                                {item.type || 'intelligence'} {item.tool ? `// ${item.tool}` : ''}
                              </span>
                            </div>
                            <span className="text-[8px] text-[#444] uppercase">{item.timestamp?.toDate().toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between text-[9px] text-[#444] uppercase">
                            <span>
                              {item.type === 'intelligence' ? (
                                `${(item.data?.nodes?.length || 0)} Nodes // ${(item.data?.links?.length || 0)} Links`
                              ) : item.type === 'maps' ? (
                                `${(item.data?.sources?.length || 0)} Locations`
                              ) : (
                                'Forensic Report'
                              )}
                            </span>
                            <Tooltip text="PURGE FROM ARCHIVE">
                              <button 
                                onClick={(e) => { e.stopPropagation(); deleteHistoryItem(item.id); }} 
                                className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-[#00ff00]"
                              >
                                <Trash2 size={12} />
                              </button>
                            </Tooltip>
                          </div>
                        </div>
                      </Tooltip>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-8 space-y-4 md:space-y-6">
              <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-4 md:p-6 min-h-[400px] md:min-h-[600px]">
                <h2 className="text-[10px] md:text-xs font-bold text-[#666] uppercase mb-4 md:mb-6 flex items-center gap-2">
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                      <div className="bg-[#111] p-3 md:p-4 border border-[#222] rounded">
                        <div className="text-[8px] md:text-[9px] text-[#444] uppercase mb-1">Total Entities</div>
                        <div className="text-xl md:text-2xl font-bold text-[#00ff00]">
                          {Array.from(new Set(history.flatMap(h => h.data?.nodes?.map((n: any) => n.label) || []))).length}
                        </div>
                      </div>
                      <div className="bg-[#111] p-3 md:p-4 border border-[#222] rounded">
                        <div className="text-[8px] md:text-[9px] text-[#444] uppercase mb-1">Total Relations</div>
                        <div className="text-xl md:text-2xl font-bold text-[#00ff00]">
                          {history.reduce((acc, h) => acc + (h.data?.links?.length || 0), 0)}
                        </div>
                      </div>
                      <div className="bg-[#111] p-3 md:p-4 border border-[#222] rounded">
                        <div className="text-[8px] md:text-[9px] text-[#444] uppercase mb-1">Geospatial Points</div>
                        <div className="text-xl md:text-2xl font-bold text-[#00ff00]">
                          {history.reduce((acc, h) => acc + (h.type === 'maps' ? (h.data?.sources?.length || 0) : 0), 0)}
                        </div>
                      </div>
                      <div className="bg-[#111] p-3 md:p-4 border border-[#222] rounded">
                        <div className="text-[8px] md:text-[9px] text-[#444] uppercase mb-1">Forensic Records</div>
                        <div className="text-xl md:text-2xl font-bold text-[#00ff00]">
                          {history.filter(h => h.type === 'forensics').length}
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
                                <span className="px-2 py-0.5 rounded text-[8px] font-bold uppercase bg-[#00ff00]/20 text-[#00ff00]">
                                  {info.type}
                                </span>
                              </td>
                              <td className="p-3 text-[#666]">{info.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-10">
                      <h2 className="text-xs font-bold text-[#666] uppercase mb-6 flex items-center gap-2">
                        <Share2 size={14} /> Brazilian OSINT Knowledge Base
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          { name: 'OSINT Brazuca', desc: 'Primary repository for Brazilian public data (CNPJ, TSE, Receita).', url: 'https://github.com/osintbrazuca/osint-brazuca' },
                          { name: 'OSINTKit-Brasil', desc: '1,600+ Brazilian OSINT links and tools.', url: 'https://github.com/sudo-flgr/OSINTKit-Brasil' },
                          { name: 'Capivara OSINT', desc: 'Brazilian OSINT Framework fork.', url: 'https://www.capivaraosint.cc/' },
                          { name: 'br-acc', desc: 'World Transparency Graph (Brazilian Transparency ETL).', url: 'https://github.com/br-acc' },
                          { name: 'OSINT-Tools-Brazil', desc: 'Curated Brazilian OSINT resources.', url: 'https://github.com/bgmello/OSINT-Tools-Brazil' },
                          { name: 'Blackbird', desc: 'Social media username lookup tool.', url: 'https://github.com/p1ngul1n0/blackbird' }
                        ].map((resource, i) => (
                          <a 
                            key={i} 
                            href={resource.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-4 bg-[#111] border border-[#222] rounded hover:border-[#00ff00] transition-all group"
                          >
                            <div className="text-[11px] font-bold text-[#00ff00] mb-1 uppercase tracking-wider">{resource.name}</div>
                            <div className="text-[10px] text-[#666] leading-relaxed">{resource.desc}</div>
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'forensics' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
            <div className="lg:col-span-4 space-y-4 md:space-y-6">
              <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-4 md:p-6">
                <h2 className="text-[10px] md:text-xs font-bold text-[#666] uppercase mb-4 md:mb-6 flex items-center gap-2">
                  <Shield size={14} /> Forensic Modules
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] text-[#444] uppercase mb-2 block">Select Module</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['username', 'email', 'domain', 'ip'] as const).map(tool => (
                        <Tooltip key={tool} text={`SELECT ${tool.toUpperCase()} MODULE`}>
                          <button
                            onClick={() => setForensicTool(tool)}
                            className={`p-3 rounded border text-[10px] font-bold uppercase transition-all ${forensicTool === tool ? 'bg-[#00ff00] text-black border-[#00ff00]' : 'bg-[#111] text-[#666] border-[#222] hover:border-[#00ff00]'}`}
                          >
                            {tool}
                          </button>
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#444] uppercase mb-2 block">Target Input</label>
                    <form onSubmit={handleForensicSearch} className="flex gap-2">
                      <Tooltip text="ENTER TARGET DATA">
                        <input 
                          type="text" 
                          value={forensicQuery}
                          onChange={(e) => setForensicQuery(e.target.value)}
                          placeholder={`Enter ${forensicTool}...`}
                          className="flex-1 bg-black border border-[#222] p-3 text-xs focus:border-[#00ff00] outline-none"
                        />
                      </Tooltip>
                      <Tooltip text="EXECUTE FORENSIC MODULE">
                        <button 
                          type="submit"
                          disabled={forensicLoading || !forensicQuery.trim()}
                          className="bg-[#00ff00] text-black px-4 rounded font-bold uppercase text-[10px] disabled:opacity-50"
                        >
                          {forensicLoading ? <Loader2 size={14} className="animate-spin" /> : 'RUN'}
                        </button>
                      </Tooltip>
                    </form>
                  </div>

                  <div className="pt-4 border-t border-[#222]">
                    <label className="text-[10px] text-[#444] uppercase mb-2 block">Dedicated Username Search</label>
                    <div className="p-3 bg-[#00ff00]/5 border border-[#00ff00]/20 rounded mb-3">
                      <p className="text-[9px] text-[#666] leading-relaxed mb-2">
                        For advanced social media extraction and profile mapping, use the dedicated SOCIAL module.
                      </p>
                      <button 
                        onClick={() => setActiveTab('social-extract')}
                        className="text-[9px] font-bold text-[#00ff00] uppercase hover:underline flex items-center gap-1"
                      >
                        <Share2 size={10} /> Open Social Module
                      </button>
                    </div>
                    <div className="p-3 bg-[#00ff00]/5 border border-[#00ff00]/20 rounded mb-3">
                      <p className="text-[9px] text-[#666] leading-relaxed mb-2">
                        For global username hunting across 400+ platforms, use the dedicated SHERLOCK module.
                      </p>
                      <button 
                        onClick={() => setActiveTab('sherlock')}
                        className="text-[9px] font-bold text-[#00ff00] uppercase hover:underline flex items-center gap-1"
                      >
                        <TargetIcon size={10} /> Open Sherlock Module
                      </button>
                    </div>
                    <form onSubmit={handleUsernameSearch} className="flex gap-2">
                      <Tooltip text="ENTER USERNAME TO SEARCH">
                        <input 
                          type="text" 
                          value={usernameQuery}
                          onChange={(e) => setUsernameQuery(e.target.value)}
                          placeholder="Enter username..."
                          className="flex-1 bg-black border border-[#222] p-3 text-xs focus:border-[#00ff00] outline-none"
                        />
                      </Tooltip>
                      <Tooltip text="SEARCH USERNAME">
                        <button 
                          type="submit"
                          disabled={forensicLoading || !usernameQuery.trim()}
                          className="bg-[#00ff00] text-black px-4 rounded font-bold uppercase text-[10px] disabled:opacity-50"
                        >
                          {forensicLoading ? <Loader2 size={14} className="animate-spin" /> : 'SEARCH'}
                        </button>
                      </Tooltip>
                    </form>
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:col-span-8">
              <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-4 md:p-6 min-h-[400px] md:min-h-[600px] flex flex-col relative overflow-hidden">
                <h2 className="text-[10px] md:text-xs font-bold text-[#666] uppercase mb-4 md:mb-6 flex items-center gap-2">
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
                    <Loader2 size={48} className="animate-spin text-[#00ff00]" />
                    <p className="text-[10px] text-[#666] uppercase animate-pulse">MINING UNSTRUCTURED DATA...</p>
                  </div>
                )}
                {forensicResult && (
                  <div className="prose prose-invert prose-xs md:prose-sm max-w-none prose-headings:text-[#00ff00] prose-a:text-[#00ff00]">
                    <Markdown>{forensicResult}</Markdown>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'validator' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
            <div className="lg:col-span-12 space-y-6">
              <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-6">
                <h2 className="text-xs font-bold text-[#00ff00] uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Shield size={16} /> OSINT PATTERN EXTRACTOR
                </h2>
                <p className="text-[10px] text-[#666] uppercase mb-4 tracking-wider">
                  PASTE ANY TEXT, LOGS, OR DATA BELOW TO AUTOMATICALLY EXTRACT BRAZILIAN OSINT PATTERNS (CPF, CNPJ, PLACA, EMAIL, ETC.)
                </p>
                <textarea
                  value={validatorInput}
                  onChange={(e) => setValidatorInput(e.target.value)}
                  placeholder="PASTE RAW DATA HERE..."
                  className="w-full h-48 bg-black border border-[#222] p-4 text-[#00ff00] font-mono text-xs focus:border-[#00ff00] outline-none rounded-lg resize-none mb-4"
                />
                <button
                  onClick={handleValidatorSearch}
                  className="w-full bg-[#00ff00] text-black py-3 rounded-lg font-bold uppercase text-xs hover:bg-[#00ff00]/80 transition-all flex items-center justify-center gap-2"
                >
                  <Search size={16} /> EXTRACT INTELLIGENCE
                </button>
              </div>

              {validatorResults.length > 0 && (
                <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-6 animate-in fade-in slide-in-from-bottom-4">
                  <h3 className="text-[10px] font-bold text-[#eee] uppercase tracking-widest mb-4">EXTRACTED ENTITIES ({validatorResults.length})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {validatorResults.map((res, i) => (
                      <div key={i} className="bg-black/50 border border-[#222] p-3 rounded flex flex-col gap-1 group hover:border-[#00ff00]/50 transition-all">
                        <span className="text-[8px] font-bold text-[#00ff00] uppercase tracking-tighter opacity-50 group-hover:opacity-100">{res.type}</span>
                        <div className="flex items-center justify-between gap-2">
                          <code className="text-[11px] text-[#eee] font-mono truncate">{res.value}</code>
                          <button 
                            onClick={() => {
                              setQuery(res.value);
                              setActiveTab('search');
                              // Trigger search manually if needed, but for now just set query
                            }}
                            className="text-[9px] text-[#00ff00] hover:underline uppercase font-bold"
                          >
                            SEARCH
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : activeTab.startsWith('vehicle-') ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
            <div className="lg:col-span-4 space-y-4 md:space-y-6">
              <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-4 md:p-6">
                <h2 className="text-[10px] md:text-xs font-bold text-[#666] uppercase mb-4 md:mb-6 flex items-center gap-2">
                  <Car size={14} /> Vehicle Consultation ({activeTab.split('-')[1].toUpperCase()})
                </h2>
                <form onSubmit={(e) => handleVehicleSearch(e, activeTab.split('-')[1] as any)} className="space-y-4">
                  {activeTab === 'vehicle-placa' && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] text-[#444] uppercase mb-2 block">License Plate (Placa)</label>
                        <input 
                          type="text" 
                          value={vehiclePlaca}
                          onChange={(e) => setVehiclePlaca(e.target.value.toUpperCase())}
                          placeholder="ABC1234"
                          className="w-full bg-black border border-[#222] p-3 text-xs focus:border-[#00ff00] outline-none"
                        />
                      </div>
                    </div>
                  )}
                  {activeTab === 'vehicle-renavam' && (
                    <div>
                      <label className="text-[10px] text-[#444] uppercase mb-2 block">RENAVAM</label>
                      <input 
                        type="text" 
                        value={vehicleRenavam}
                        onChange={(e) => setVehicleRenavam(e.target.value)}
                        placeholder="123456789"
                        className="w-full bg-black border border-[#222] p-3 text-xs focus:border-[#00ff00] outline-none"
                      />
                    </div>
                  )}
                  {activeTab === 'vehicle-chassi' && (
                    <div>
                      <label className="text-[10px] text-[#444] uppercase mb-2 block">CHASSI</label>
                      <input 
                        type="text" 
                        value={vehicleChassi}
                        onChange={(e) => setVehicleChassi(e.target.value.toUpperCase())}
                        placeholder="9BWAAA00000000000"
                        className="w-full bg-black border border-[#222] p-3 text-xs focus:border-[#00ff00] outline-none"
                      />
                    </div>
                  )}
                  <button 
                    type="submit"
                    disabled={vehicleLoading || (activeTab === 'vehicle-placa' && !vehiclePlaca.trim()) || (activeTab === 'vehicle-renavam' && !vehicleRenavam.trim()) || (activeTab === 'vehicle-chassi' && !vehicleChassi.trim())}
                    className="w-full bg-[#00ff00] text-black py-3 rounded font-bold uppercase text-[10px] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {vehicleLoading ? <Loader2 size={14} className="animate-spin" /> : 'CONSULT BIN'}
                  </button>
                </form>

                <div className="mt-6 p-4 bg-[#111] border border-[#222] rounded">
                  <h3 className="text-[9px] font-bold text-[#666] uppercase mb-2">Integration Status</h3>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#00ff00] animate-pulse" />
                    <span className="text-[10px] text-[#eee]">
                      Intelligence Grid Active
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:col-span-8">
              <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-4 md:p-6 min-h-[400px] md:min-h-[600px] flex flex-col relative overflow-hidden">
                <h2 className="text-[10px] md:text-xs font-bold text-[#666] uppercase mb-4 md:mb-6 flex items-center gap-2">
                  <Database size={14} /> BIN Consultation Result
                </h2>
                {!vehicleResult && !vehicleLoading && (
                  <div className="flex-1 flex flex-col items-center justify-center text-[#1a1a1a]">
                    <Car size={64} strokeWidth={1} />
                    <p className="mt-4 uppercase tracking-[0.2em] text-sm text-center">Awaiting Vehicle Identification ({activeTab.split('-')[1].toUpperCase()})</p>
                  </div>
                )}
                {vehicleLoading && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4">
                    <Loader2 size={48} className="animate-spin text-[#00ff00]" />
                    <p className="text-[10px] text-[#666] uppercase animate-pulse">
                      QUERYING INTELLIGENCE DATABASE...
                    </p>
                  </div>
                )}
                {vehicleResult && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-[#111] border border-[#222] rounded">
                        <div className="text-[9px] text-[#444] uppercase mb-1">Vehicle Status</div>
                        <div className={`text-lg font-bold ${vehicleResult.situacao_veiculo?.includes('NORMAL') ? 'text-[#00ff00]' : 'text-red-500'}`}>
                          {vehicleResult.situacao_veiculo}
                        </div>
                      </div>
                      <div className="p-4 bg-[#111] border border-[#222] rounded">
                        <div className="text-[9px] text-[#444] uppercase mb-1">Financial Restriction</div>
                        <div className={`text-lg font-bold ${vehicleResult.restricao_financeira === 'NADA CONSTA' ? 'text-[#00ff00]' : 'text-yellow-500'}`}>
                          {vehicleResult.restricao_financeira}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-[#111] border border-[#222] rounded">
                        <div className="text-[9px] text-[#444] uppercase mb-1">Make / Model</div>
                        <div className="text-sm font-bold text-[#eee]">{vehicleResult.marca_modelo}</div>
                      </div>
                      <div className="p-4 bg-[#111] border border-[#222] rounded">
                        <div className="text-[9px] text-[#444] uppercase mb-1">Color</div>
                        <div className="text-sm font-bold text-[#eee]">{vehicleResult.cor}</div>
                      </div>
                      <div className="p-4 bg-[#111] border border-[#222] rounded">
                        <div className="text-[9px] text-[#444] uppercase mb-1">Year (Fab/Mod)</div>
                        <div className="text-sm font-bold text-[#eee]">{vehicleResult.ano_fabricacao} / {vehicleResult.ano_modelo}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-[#111] border border-[#222] rounded">
                        <div className="text-[9px] text-[#444] uppercase mb-1">Plate</div>
                        <div className="text-sm font-bold text-[#eee]">{vehicleResult.placa}</div>
                      </div>
                      <div className="p-4 bg-[#111] border border-[#222] rounded">
                        <div className="text-[9px] text-[#444] uppercase mb-1">Renavam</div>
                        <div className="text-sm font-bold text-[#eee]">{vehicleResult.renavam}</div>
                      </div>
                      <div className="p-4 bg-[#111] border border-[#222] rounded">
                        <div className="text-[9px] text-[#444] uppercase mb-1">Chassi</div>
                        <div className="text-sm font-bold text-[#eee]">{vehicleResult.chassi}</div>
                      </div>
                    </div>

                    {vehicleResult.restricao_financeira !== 'NADA CONSTA' && (
                      <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded flex items-start gap-3">
                        <AlertTriangle className="text-yellow-500 shrink-0" size={18} />
                        <div>
                          <div className="text-[11px] font-bold text-yellow-500 uppercase mb-1">Impediment Detected</div>
                          <p className="text-[10px] text-[#aaa]">This vehicle has active financial restrictions. Further investigation is recommended before proceeding with any operation.</p>
                        </div>
                      </div>
                    )}

                    <div className="mt-8">
                      <h3 className="text-[10px] font-bold text-[#666] uppercase mb-4">Raw Response Data (JSON)</h3>
                      <div className="bg-black border border-[#222] p-4 rounded overflow-x-auto">
                        <pre className="text-[10px] text-[#00ff00]">
                          {JSON.stringify(vehicleResult, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'cnpj' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
            <div className="lg:col-span-4 space-y-4 md:space-y-6">
              <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-4 md:p-6">
                <h2 className="text-[10px] md:text-xs font-bold text-[#666] uppercase mb-4 md:mb-6 flex items-center gap-2">
                  <Building2 size={14} /> CNPJ Consultation
                </h2>
                <form onSubmit={handleCnpjSearch} className="space-y-4">
                  <div>
                    <label className="text-[10px] text-[#444] uppercase mb-2 block">CNPJ Number</label>
                    <input 
                      type="text" 
                      value={cnpjQuery}
                      onChange={(e) => setCnpjQuery(e.target.value)}
                      placeholder="00.000.000/0000-00"
                      className="w-full bg-black border border-[#222] p-3 text-xs focus:border-[#00ff00] outline-none"
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={cnpjLoading || !cnpjQuery.trim()}
                    className="w-full bg-[#00ff00] text-black py-3 rounded font-bold uppercase text-[10px] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {cnpjLoading ? <Loader2 size={14} className="animate-spin" /> : 'QUERY DATABASE'}
                  </button>
                </form>

                <div className="mt-6 p-4 bg-[#111] border border-[#222] rounded">
                  <h3 className="text-[9px] font-bold text-[#666] uppercase mb-2">Data Source</h3>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#00ff00] animate-pulse" />
                    <span className="text-[10px] text-[#eee]">Public CNPJA API Connected</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:col-span-8">
              <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-4 md:p-6 min-h-[400px] md:min-h-[600px] flex flex-col relative overflow-hidden">
                <h2 className="text-[10px] md:text-xs font-bold text-[#666] uppercase mb-4 md:mb-6 flex items-center gap-2">
                  <Database size={14} /> Corporate Intelligence Result
                </h2>
                {!cnpjData && !cnpjLoading && (
                  <div className="flex-1 flex flex-col items-center justify-center text-[#1a1a1a]">
                    <Building2 size={64} strokeWidth={1} />
                    <p className="mt-4 uppercase tracking-[0.2em] text-sm text-center">Awaiting Corporate Identification</p>
                  </div>
                )}
                {cnpjLoading && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4">
                    <Loader2 size={48} className="animate-spin text-[#00ff00]" />
                    <p className="text-[10px] text-[#666] uppercase animate-pulse">MINING CORPORATE RECORDS...</p>
                  </div>
                )}
                {cnpjData && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-[#111] border border-[#222] rounded">
                        <div className="text-[9px] text-[#444] uppercase mb-1">Company Name</div>
                        <div className="text-lg font-bold text-[#00ff00]">
                          {cnpjData.alias || cnpjData.name}
                        </div>
                      </div>
                      <div className="p-4 bg-[#111] border border-[#222] rounded">
                        <div className="text-[9px] text-[#444] uppercase mb-1">Status</div>
                        <div className={`text-lg font-bold ${cnpjData.status?.text === 'ATIVA' ? 'text-[#00ff00]' : 'text-red-500'}`}>
                          {cnpjData.status?.text || 'UNKNOWN'}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-[#111] border border-[#222] rounded">
                        <div className="text-[9px] text-[#444] uppercase mb-1">Founded</div>
                        <div className="text-sm font-bold text-[#eee]">
                          {cnpjData.founded}
                        </div>
                      </div>
                      <div className="p-4 bg-[#111] border border-[#222] rounded">
                        <div className="text-[9px] text-[#444] uppercase mb-1">Capital</div>
                        <div className="text-sm font-bold text-[#eee]">
                          {cnpjData.equity?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                      </div>
                      <div className="p-4 bg-[#111] border border-[#222] rounded">
                        <div className="text-[9px] text-[#444] uppercase mb-1">Tax Regime</div>
                        <div className="text-sm font-bold text-[#eee]">
                          {cnpjData.tax_regime || 'N/A'}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-[#111] border border-[#222] rounded">
                      <div className="text-[9px] text-[#444] uppercase mb-1">Address</div>
                      <div className="text-sm text-[#eee]">
                        {cnpjData.address?.street}, {cnpjData.address?.number} {cnpjData.address?.details}
                        <br />
                        {cnpjData.address?.district} - {cnpjData.address?.city} / {cnpjData.address?.state}
                        <br />
                        CEP: {cnpjData.address?.zip}
                      </div>
                    </div>

                    <div className="mt-8">
                      <h3 className="text-[10px] font-bold text-[#666] uppercase mb-4">Full Intelligence Payload</h3>
                      <div className="bg-black border border-[#222] p-4 rounded overflow-x-auto">
                        <pre className="text-[10px] text-[#00ff00]">
                          {JSON.stringify(cnpjData, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'connectivity' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
            <div className="lg:col-span-4 space-y-4 md:space-y-6">
              <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-4 md:p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded bg-[#00ff00]/10 flex items-center justify-center text-[#00ff00]">
                    <Globe size={20} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#eee] uppercase tracking-tighter">CONNECTIVITY INTELLIGENCE</h2>
                    <p className="text-[8px] text-[#666] uppercase tracking-widest">Anatel IBC Analysis (2021-2024)</p>
                  </div>
                </div>

                <form onSubmit={handleConnectivitySearch} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-[10px] text-[#444] uppercase mb-2 block tracking-widest">Municipality</label>
                      <input 
                        type="text" 
                        value={ibcMunicipality}
                        onChange={(e) => setIbcMunicipality(e.target.value)}
                        placeholder="e.g. São Paulo"
                        className="w-full bg-black border border-[#222] p-3 text-xs focus:border-[#00ff00] outline-none transition-all placeholder:text-[#1a1a1a]"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-[10px] text-[#444] uppercase mb-2 block tracking-widest">State (UF)</label>
                      <input 
                        type="text" 
                        value={ibcState}
                        onChange={(e) => setIbcState(e.target.value)}
                        placeholder="e.g. SP"
                        className="w-full bg-black border border-[#222] p-3 text-xs focus:border-[#00ff00] outline-none transition-all placeholder:text-[#1a1a1a]"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={ibcLoading || !ibcMunicipality.trim()}
                    className="w-full bg-[#00ff00] text-black py-3 rounded font-bold uppercase text-[10px] hover:bg-[#00ff00]/80 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {ibcLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                    {ibcLoading ? 'ANALYZING...' : 'ANALYZE CONNECTIVITY'}
                  </button>
                </form>

                <div className="mt-8 p-4 bg-[#111] border border-[#222] rounded space-y-4">
                  <div className="flex items-center gap-2 text-[9px] font-bold text-[#666] uppercase tracking-widest border-b border-[#222] pb-2">
                    <Activity size={12} /> IBC Metrics Guide
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-[9px] text-[#eee] font-bold uppercase">IBC (Índice Brasileiro de Conectividade)</p>
                      <p className="text-[8px] text-[#444] leading-relaxed">Overall connectivity index calculated by Anatel based on infrastructure, coverage, and competition.</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-[#eee] font-bold uppercase">4G/5G Coverage</p>
                      <p className="text-[8px] text-[#444] leading-relaxed">Percentage of the population covered by high-speed mobile technology.</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-[#eee] font-bold uppercase">Fiber Backhaul</p>
                      <p className="text-[8px] text-[#444] leading-relaxed">Presence of fiber optic infrastructure (0-100 scale).</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8">
              <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-4 md:p-6 min-h-[400px] md:min-h-[600px] flex flex-col relative overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-[10px] md:text-xs font-bold text-[#666] uppercase flex items-center gap-2">
                    <Database size={14} /> Connectivity Profile
                  </h2>
                  {ibcData && (
                    <div className="text-[9px] font-bold text-[#00ff00] bg-[#00ff00]/10 px-2 py-1 rounded border border-[#00ff00]/30">
                      IBC: {ibcData.data.ibc?.toFixed(2) || 'N/A'}
                    </div>
                  )}
                </div>

                {!ibcData && !ibcLoading && (
                  <div className="flex-1 flex flex-col items-center justify-center text-[#111]">
                    <Globe size={80} strokeWidth={0.5} />
                    <p className="mt-4 uppercase tracking-[0.4em] text-sm">Awaiting Location Designation</p>
                  </div>
                )}

                {ibcLoading && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-6">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full border-2 border-[#00ff00]/10 border-t-[#00ff00] animate-spin" />
                      <Globe className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[#00ff00] w-8 h-8 animate-pulse" />
                    </div>
                    <div className="text-center space-y-2">
                      <p className="text-[10px] text-[#00ff00] uppercase tracking-[0.3em] font-bold animate-pulse">Retrieving Anatel Data...</p>
                      <p className="text-[8px] text-[#333] uppercase tracking-widest">Analyzing infrastructure and market competitiveness</p>
                    </div>
                  </div>
                )}

                {ibcData && (
                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-[#111] border border-[#222] rounded text-center space-y-1">
                        <p className="text-[8px] text-[#444] uppercase font-bold tracking-widest">IBC Index</p>
                        <p className="text-xl font-bold text-[#00ff00]">{ibcData.data.ibc?.toFixed(2) || 'N/A'}</p>
                      </div>
                      <div className="p-4 bg-[#111] border border-[#222] rounded text-center space-y-1">
                        <p className="text-[8px] text-[#444] uppercase font-bold tracking-widest">4G/5G Coverage</p>
                        <p className="text-xl font-bold text-[#00ff00]">{ibcData.data.cobertura_4g5g ? `${(ibcData.data.cobertura_4g5g * 100).toFixed(1)}%` : 'N/A'}</p>
                      </div>
                      <div className="p-4 bg-[#111] border border-[#222] rounded text-center space-y-1">
                        <p className="text-[8px] text-[#444] uppercase font-bold tracking-widest">Fiber Score</p>
                        <p className="text-xl font-bold text-[#00ff00]">{ibcData.data.fibra || 'N/A'}</p>
                      </div>
                      <div className="p-4 bg-[#111] border border-[#222] rounded text-center space-y-1">
                        <p className="text-[8px] text-[#444] uppercase font-bold tracking-widest">ERB Density</p>
                        <p className="text-xl font-bold text-[#00ff00]">{ibcData.data.adensamento_estacoes?.toFixed(2) || 'N/A'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-4 bg-[#111] border border-[#222] rounded space-y-4">
                        <h3 className="text-[10px] font-bold text-[#666] uppercase tracking-widest flex items-center gap-2">
                          <Activity size={12} /> Mobile Market (SMP)
                        </h3>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-[#444] uppercase">Density</span>
                            <span className="text-[10px] text-[#eee] font-bold">{ibcData.data.densidade_smp?.toFixed(2) || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-[#444] uppercase">HHI (Concentration)</span>
                            <span className="text-[10px] text-[#eee] font-bold">{ibcData.data.hhi_smp || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 bg-[#111] border border-[#222] rounded space-y-4">
                        <h3 className="text-[10px] font-bold text-[#666] uppercase tracking-widest flex items-center gap-2">
                          <Activity size={12} /> Fixed Broadband (SCM)
                        </h3>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-[#444] uppercase">Density</span>
                            <span className="text-[10px] text-[#eee] font-bold">{ibcData.data.densidade_scm?.toFixed(2) || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-[#444] uppercase">HHI (Concentration)</span>
                            <span className="text-[10px] text-[#eee] font-bold">{ibcData.data.hhi_scm || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-[#222]">
                      <h3 className="text-[10px] font-bold text-[#666] uppercase mb-4 tracking-widest">Intelligence Report</h3>
                      <div className="prose prose-invert prose-xs max-w-none bg-black/30 p-4 rounded border border-[#1a1a1a]">
                        <Markdown>{ibcData.report}</Markdown>
                      </div>
                    </div>

                    {ibcData.sources.length > 0 && (
                      <div className="pt-6 border-t border-[#222]">
                        <h3 className="text-[10px] font-bold text-[#666] uppercase mb-4 tracking-widest">Data Sources</h3>
                        <div className="flex flex-wrap gap-2">
                          {ibcData.sources.map((source, idx) => (
                            <a 
                              key={idx}
                              href={source.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[9px] bg-[#111] border border-[#222] px-3 py-1 rounded text-[#444] hover:text-[#00ff00] hover:border-[#00ff00]/30 transition-all flex items-center gap-2"
                            >
                              <Globe size={10} /> {source.title}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {ibcHistory.length > 0 && (
                      <div className="pt-8 border-t border-[#222] space-y-4">
                        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                          <h3 className="text-[10px] font-bold text-[#666] uppercase tracking-widest">Recent IBC Intelligence</h3>
                          <div className="flex items-center gap-4">
                            <div className="relative w-48">
                              <input 
                                type="text" 
                                value={ibcFilter}
                                onChange={(e) => setIbcFilter(e.target.value)}
                                placeholder="Filter by city..."
                                className="w-full bg-black border border-[#222] p-1.5 pl-7 text-[9px] focus:border-[#00ff00] outline-none text-[#eee] uppercase"
                              />
                              <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-[#333] w-3 h-3" />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[8px] text-[#444] uppercase font-bold">Sort:</span>
                              <button 
                                onClick={() => setIbcSort(ibcSort === 'municipality' ? 'none' : 'municipality')}
                                className={`text-[8px] px-2 py-1 rounded border ${ibcSort === 'municipality' ? 'bg-[#00ff00] text-black border-[#00ff00]' : 'border-[#222] text-[#666] hover:text-[#eee]'}`}
                              >
                                CITY
                              </button>
                              <button 
                                onClick={() => setIbcSort(ibcSort === 'ibc' ? 'none' : 'ibc')}
                                className={`text-[8px] px-2 py-1 rounded border ${ibcSort === 'ibc' ? 'bg-[#00ff00] text-black border-[#00ff00]' : 'border-[#222] text-[#666] hover:text-[#eee]'}`}
                              >
                                IBC
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-[#222]">
                                <th className="py-2 px-3 text-[8px] text-[#444] uppercase font-bold">Municipality</th>
                                <th className="py-2 px-3 text-[8px] text-[#444] uppercase font-bold">State</th>
                                <th className="py-2 px-3 text-[8px] text-[#444] uppercase font-bold">IBC Index</th>
                                <th className="py-2 px-3 text-[8px] text-[#444] uppercase font-bold">Coverage</th>
                                <th className="py-2 px-3 text-[8px] text-[#444] uppercase font-bold">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredIbc.map((item, idx) => (
                                <tr key={idx} className="border-b border-[#111] hover:bg-[#111] transition-colors group">
                                  <td className="py-2 px-3 text-[10px] text-[#eee] font-medium">{item.municipality}</td>
                                  <td className="py-2 px-3 text-[10px] text-[#666]">{item.state || 'N/A'}</td>
                                  <td className="py-2 px-3 text-[10px] text-[#00ff00] font-bold">{item.data.ibc?.toFixed(2) || 'N/A'}</td>
                                  <td className="py-2 px-3 text-[10px] text-[#aaa]">{item.data.cobertura_4g5g ? `${(item.data.cobertura_4g5g * 100).toFixed(1)}%` : '0%'}</td>
                                  <td className="py-2 px-3">
                                    <button 
                                      onClick={() => setIbcData(item)}
                                      className="text-[8px] text-[#444] hover:text-[#00ff00] uppercase font-bold tracking-widest transition-colors"
                                    >
                                      View
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'inurlbr' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
            <div className="lg:col-span-4 space-y-4 md:space-y-6">
              <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-4 md:p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded bg-[#00ff00]/10 flex items-center justify-center text-[#00ff00]">
                    <Search size={20} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#eee] uppercase tracking-tighter">INURLBR MODULE</h2>
                    <p className="text-[8px] text-[#666] uppercase tracking-widest">Advanced Dorking Engine</p>
                  </div>
                </div>

                <form onSubmit={handleInurlbrScan} className="space-y-4">
                  <div>
                    <label className="text-[10px] text-[#444] uppercase mb-2 block tracking-widest">Search Dork</label>
                    <div className="relative">
                      <textarea 
                        value={inurlbrDork}
                        onChange={(e) => setInurlbrDork(e.target.value)}
                        placeholder='inurl:".php?id=" "admin" site:br'
                        rows={3}
                        className="w-full bg-black border border-[#222] p-4 pl-10 text-xs focus:border-[#00ff00] outline-none transition-all placeholder:text-[#1a1a1a] resize-none"
                      />
                      <FileCode className="absolute left-3 top-4 text-[#333] w-4 h-4" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#444] uppercase mb-2 block tracking-widest">Search Engine</label>
                    <select 
                      value={inurlbrEngine}
                      onChange={(e) => setInurlbrEngine(e.target.value)}
                      className="w-full bg-black border border-[#222] p-3 text-xs focus:border-[#00ff00] outline-none text-[#eee]"
                    >
                      <option value="google">GOOGLE (DEFAULT)</option>
                      <option value="bing">BING</option>
                      <option value="duckduckgo">DUCKDUCKGO</option>
                      <option value="shodan">SHODAN (SIMULATED)</option>
                      <option value="censys">CENSYS (SIMULATED)</option>
                    </select>
                  </div>

                  <button 
                    type="submit"
                    disabled={inurlbrLoading || !inurlbrDork.trim()}
                    className="w-full bg-[#00ff00] text-black py-3 rounded font-bold uppercase text-[10px] hover:bg-[#00ff00]/80 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {inurlbrLoading ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
                    {inurlbrLoading ? 'SCANNING...' : 'EXECUTE SCAN'}
                  </button>
                </form>

                <div className="mt-8 p-4 bg-[#111] border border-[#222] rounded space-y-3">
                  <div className="flex items-center gap-2 text-[9px] font-bold text-[#666] uppercase tracking-widest">
                    <Activity size={12} /> Engine Status
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[9px]">
                      <span className="text-[#444]">Dork Library</span>
                      <span className="text-[#00ff00]">v5.2.1-EXPLOIT</span>
                    </div>
                    <div className="flex items-center justify-between text-[9px]">
                      <span className="text-[#444]">Scraper Layer</span>
                      <span className="text-[#00ff00]">MULTI-THREADED</span>
                    </div>
                    <div className="flex items-center justify-between text-[9px]">
                      <span className="text-[#444]">Proxy Rotation</span>
                      <span className="text-[#00ff00]">ACTIVE</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8">
              <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-4 md:p-6 min-h-[400px] md:min-h-[600px] flex flex-col relative overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-[10px] md:text-xs font-bold text-[#666] uppercase flex items-center gap-2">
                    <Database size={14} /> Scan Results
                  </h2>
                  {inurlbrResults.length > 0 && (
                    <div className="text-[9px] font-bold text-[#00ff00] bg-[#00ff00]/10 px-2 py-1 rounded border border-[#00ff00]/30">
                      {inurlbrResults.length} TARGETS IDENTIFIED
                    </div>
                  )}
                </div>

                {!inurlbrResults.length && !inurlbrLoading && (
                  <div className="flex-1 flex flex-col items-center justify-center text-[#111]">
                    <Search size={80} strokeWidth={0.5} />
                    <p className="mt-4 uppercase tracking-[0.4em] text-sm">Awaiting Dork Input</p>
                  </div>
                )}

                {inurlbrLoading && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-6">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full border-2 border-[#00ff00]/10 border-t-[#00ff00] animate-spin" />
                      <Search className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[#00ff00] w-8 h-8 animate-pulse" />
                    </div>
                    <div className="text-center space-y-2">
                      <p className="text-[10px] text-[#00ff00] uppercase tracking-[0.3em] font-bold animate-pulse">Crawling Search Engines...</p>
                      <p className="text-[8px] text-[#333] uppercase tracking-widest">Analyzing results for vulnerabilities and leaks</p>
                    </div>
                  </div>
                )}

                {inurlbrResults.length > 0 && (
                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
                    <div className="space-y-3">
                      {inurlbrResults.map((result, idx) => (
                        <div 
                          key={idx}
                          className="p-4 bg-[#111] border border-[#222] rounded hover:border-[#00ff00]/30 transition-all group"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Globe size={14} className="text-[#333] group-hover:text-[#00ff00] transition-colors" />
                              <span className="text-[11px] font-bold text-[#eee] truncate max-w-[300px]">{result.title}</span>
                            </div>
                            <div className={`text-[8px] px-2 py-0.5 rounded uppercase font-bold ${
                              result.status === 'vulnerable' ? 'bg-red-500/10 text-red-500' : 
                              result.status === 'info' ? 'bg-blue-500/10 text-blue-500' : 
                              'bg-[#00ff00]/10 text-[#00ff00]'
                            }`}>
                              {result.status}
                            </div>
                          </div>
                          <a 
                            href={result.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[9px] text-[#444] hover:text-[#00ff00] transition-colors block mb-2 truncate"
                          >
                            {result.url}
                          </a>
                          <p className="text-[10px] text-[#666] leading-relaxed line-clamp-2 italic">
                            "{result.snippet}"
                          </p>
                        </div>
                      ))}
                    </div>

                    {inurlbrReport && (
                      <div className="mt-8 pt-6 border-t border-[#222]">
                        <h3 className="text-[10px] font-bold text-[#666] uppercase mb-4 tracking-widest">Scan Analysis Report</h3>
                        <div className="prose prose-invert prose-xs max-w-none bg-black/30 p-4 rounded border border-[#1a1a1a]">
                          <Markdown>{inurlbrReport}</Markdown>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'sherlock' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
            <div className="lg:col-span-4 space-y-4 md:space-y-6">
              <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-4 md:p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded bg-[#00ff00]/10 flex items-center justify-center text-[#00ff00]">
                    <TargetIcon size={20} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#eee] uppercase tracking-tighter">SHERLOCK MODULE</h2>
                    <p className="text-[8px] text-[#666] uppercase tracking-widest">Username Network Mapping</p>
                  </div>
                </div>

                <form onSubmit={handleSherlockSearch} className="space-y-4">
                  <div>
                    <label className="text-[10px] text-[#444] uppercase mb-2 block tracking-widest">Target Username</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={sherlockUsername}
                        onChange={(e) => setSherlockUsername(e.target.value)}
                        placeholder="Enter username to hunt..."
                        className="w-full bg-black border border-[#222] p-4 pl-10 text-xs focus:border-[#00ff00] outline-none transition-all placeholder:text-[#1a1a1a]"
                      />
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#333] w-4 h-4" />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={sherlockLoading || !sherlockUsername.trim()}
                    className="w-full bg-[#00ff00] text-black py-3 rounded font-bold uppercase text-[10px] hover:bg-[#00ff00]/80 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {sherlockLoading ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                    {sherlockLoading ? 'HUNTING...' : 'EXECUTE HUNT'}
                  </button>
                </form>

                <div className="mt-8 p-4 bg-[#111] border border-[#222] rounded space-y-3">
                  <div className="flex items-center gap-2 text-[9px] font-bold text-[#666] uppercase tracking-widest">
                    <Activity size={12} /> Module Status
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[9px]">
                      <span className="text-[#444]">Core Engine</span>
                      <span className="text-[#00ff00]">v2.10.4-STABLE</span>
                    </div>
                    <div className="flex items-center justify-between text-[9px]">
                      <span className="text-[#444]">Site Database</span>
                      <span className="text-[#00ff00]">400+ PLATFORMS</span>
                    </div>
                    <div className="flex items-center justify-between text-[9px]">
                      <span className="text-[#444]">Network Layer</span>
                      <span className="text-[#00ff00]">ENCRYPTED</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8">
              <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-4 md:p-6 min-h-[400px] md:min-h-[600px] flex flex-col relative overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-[10px] md:text-xs font-bold text-[#666] uppercase flex items-center gap-2">
                    <Database size={14} /> Hunt Results
                  </h2>
                  {sherlockResults.length > 0 && (
                    <div className="text-[9px] font-bold text-[#00ff00] bg-[#00ff00]/10 px-2 py-1 rounded border border-[#00ff00]/30">
                      {sherlockResults.length} PROFILES IDENTIFIED
                    </div>
                  )}
                </div>

                {!sherlockResults.length && !sherlockLoading && (
                  <div className="flex-1 flex flex-col items-center justify-center text-[#111]">
                    <TargetIcon size={80} strokeWidth={0.5} />
                    <p className="mt-4 uppercase tracking-[0.4em] text-sm">Awaiting Target Designation</p>
                  </div>
                )}

                {sherlockLoading && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-6">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full border-2 border-[#00ff00]/10 border-t-[#00ff00] animate-spin" />
                      <TargetIcon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[#00ff00] w-8 h-8 animate-pulse" />
                    </div>
                    <div className="text-center space-y-2">
                      <p className="text-[10px] text-[#00ff00] uppercase tracking-[0.3em] font-bold animate-pulse">Scanning Global Networks...</p>
                      <p className="text-[8px] text-[#333] uppercase tracking-widest">Checking 400+ social platforms for matches</p>
                    </div>
                  </div>
                )}

                {sherlockResults.length > 0 && (
                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-[#111] p-4 rounded border border-[#222]">
                      <div className="relative w-full md:w-64">
                        <input 
                          type="text" 
                          value={sherlockFilter}
                          onChange={(e) => setSherlockFilter(e.target.value)}
                          placeholder="Filter by site..."
                          className="w-full bg-black border border-[#222] p-2 pl-8 text-[10px] focus:border-[#00ff00] outline-none text-[#eee] uppercase"
                        />
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-[#333] w-3 h-3" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-[#444] uppercase font-bold">Sort:</span>
                        <button 
                          onClick={() => setSherlockSort(sherlockSort === 'site' ? 'none' : 'site')}
                          className={`text-[9px] px-2 py-1 rounded border ${sherlockSort === 'site' ? 'bg-[#00ff00] text-black border-[#00ff00]' : 'border-[#222] text-[#666] hover:text-[#eee]'}`}
                        >
                          SITE
                        </button>
                        <button 
                          onClick={() => setSherlockSort(sherlockSort === 'status' ? 'none' : 'status')}
                          className={`text-[9px] px-2 py-1 rounded border ${sherlockSort === 'status' ? 'bg-[#00ff00] text-black border-[#00ff00]' : 'border-[#222] text-[#666] hover:text-[#eee]'}`}
                        >
                          STATUS
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {filteredSherlock.map((profile, idx) => (
                        <a 
                          key={idx}
                          href={profile.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 bg-[#111] border border-[#222] rounded flex items-center justify-between group hover:border-[#00ff00] transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-[#00ff00]/10 flex items-center justify-center text-[#00ff00]">
                              <Globe size={14} />
                            </div>
                            <div>
                              <div className="text-[11px] font-bold text-[#eee] group-hover:text-[#00ff00] transition-colors">{profile.site}</div>
                              <div className="text-[8px] text-[#444] truncate max-w-[150px]">{profile.url}</div>
                            </div>
                          </div>
                          <Share2 size={12} className="text-[#222] group-hover:text-[#00ff00] transition-colors" />
                        </a>
                      ))}
                    </div>

                    {sherlockReport && (
                      <div className="mt-8 pt-6 border-t border-[#222]">
                        <h3 className="text-[10px] font-bold text-[#666] uppercase mb-4 tracking-widest">Hunt Analysis Report</h3>
                        <div className="prose prose-invert prose-xs max-w-none bg-black/30 p-4 rounded border border-[#1a1a1a]">
                          <Markdown>{sherlockReport}</Markdown>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'social-extract' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
            <div className="lg:col-span-4 space-y-4 md:space-y-6">
              <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-4 md:p-6">
                <h2 className="text-[10px] md:text-xs font-bold text-[#666] uppercase mb-4 md:mb-6 flex items-center gap-2">
                  <Share2 size={14} /> Social Intelligence
                </h2>
                <div className="space-y-4">
                  <div className="p-4 bg-[#111] border border-[#222] rounded space-y-3">
                    <h3 className="text-[9px] font-bold text-[#00ff00] uppercase tracking-widest">Report Extraction</h3>
                    <p className="text-[10px] text-[#666] leading-relaxed">
                      Analyze the current intelligence report to automatically identify and map social media profiles to the graph.
                    </p>
                    <button 
                      onClick={handleAnalyzeSocialMedia}
                      disabled={loading || !data}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#00ff00] text-black rounded font-bold uppercase text-[10px] hover:bg-[#00ff00]/80 transition-all disabled:opacity-50"
                    >
                      {loading ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                      Extract from Report
                    </button>
                  </div>

                  <div className="p-4 bg-[#111] border border-[#222] rounded space-y-3">
                    <h3 className="text-[9px] font-bold text-[#00ff00] uppercase tracking-widest">Global Username Hunt</h3>
                    <p className="text-[10px] text-[#666] leading-relaxed">
                      Use the dedicated Sherlock module to scan 400+ social platforms for a specific username.
                    </p>
                    <button 
                      onClick={() => setActiveTab('sherlock')}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#111] border border-[#333] text-[#00ff00] rounded font-bold uppercase text-[10px] hover:bg-[#222] transition-all"
                    >
                      <TargetIcon size={14} /> Open Sherlock Module
                    </button>
                  </div>

                  <div className="p-4 bg-[#111] border border-[#222] rounded space-y-3">
                    <h3 className="text-[9px] font-bold text-[#00ff00] uppercase tracking-widest">Username Forensic</h3>
                    <form onSubmit={handleUsernameSearch} className="space-y-2">
                      <input 
                        type="text" 
                        value={usernameQuery}
                        onChange={(e) => setUsernameQuery(e.target.value)}
                        placeholder="Enter username..."
                        className="w-full bg-black border border-[#222] p-3 text-xs focus:border-[#00ff00] outline-none"
                      />
                      <button 
                        type="submit"
                        disabled={forensicLoading || !usernameQuery.trim()}
                        className="w-full bg-[#111] border border-[#333] text-[#00ff00] px-4 py-2 rounded font-bold uppercase text-[10px] hover:bg-[#222] transition-all disabled:opacity-50"
                      >
                        {forensicLoading ? <Loader2 size={14} className="animate-spin" /> : 'Search Profiles'}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:col-span-8">
              <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-4 md:p-6 min-h-[400px] md:min-h-[600px] flex flex-col relative overflow-hidden">
                <h2 className="text-[10px] md:text-xs font-bold text-[#666] uppercase mb-4 md:mb-6 flex items-center gap-2">
                  <Database size={14} /> Social Profile Archive
                </h2>
                {(!data?.nodes.some(n => n.type === 'social') && !forensicResult && !forensicLoading) && (
                  <div className="flex-1 flex flex-col items-center justify-center text-[#1a1a1a]">
                    <Share2 size={64} strokeWidth={1} />
                    <p className="mt-4 uppercase tracking-[0.2em] text-sm text-center">No Social Profiles Identified</p>
                  </div>
                )}
                {forensicLoading && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4">
                    <Loader2 size={48} className="animate-spin text-[#00ff00]" />
                    <p className="text-[10px] text-[#666] uppercase animate-pulse">Scanning Social Networks...</p>
                  </div>
                )}
                {(data?.nodes.some(n => n.type === 'social') || forensicResult) && (
                  <div className="space-y-6 overflow-y-auto custom-scrollbar flex-1">
                    {data?.nodes.filter(n => n.type === 'social').length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-[9px] font-bold text-[#444] uppercase tracking-widest border-b border-[#222] pb-1">Identified Profiles</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {data.nodes.filter(n => n.type === 'social').map(node => (
                            <div key={node.id} className="p-3 bg-[#111] border border-[#222] rounded flex items-center justify-between group">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded bg-[#00ff00]/10 flex items-center justify-center text-[#00ff00]">
                                  <Globe size={14} />
                                </div>
                                <div>
                                  <div className="text-[11px] font-bold text-[#eee]">{node.label}</div>
                                  <div className="text-[8px] text-[#444] uppercase">{node.id}</div>
                                </div>
                              </div>
                              <button 
                                onClick={() => handleExpandNode(node.id, node.label)}
                                className="p-1.5 text-[#444] hover:text-[#00ff00] transition-colors"
                              >
                                <Maximize2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {forensicResult && (
                      <div className="space-y-4 pt-4 border-t border-[#222]">
                        <h3 className="text-[9px] font-bold text-[#444] uppercase tracking-widest border-b border-[#222] pb-1">Forensic Username Report</h3>
                        <div className="prose prose-invert prose-xs max-w-none">
                          <Markdown>{forensicResult}</Markdown>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
            {/* Monitoring Dashboard */}
            <div className="lg:col-span-4 space-y-4 md:space-y-6">
              <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-4 md:p-6 min-h-[400px] md:min-h-[600px]">
                <h2 className="text-[10px] md:text-xs font-bold text-[#666] uppercase mb-4 md:mb-6 flex items-center gap-2">
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
                          <div className={`text-[8px] px-2 py-0.5 rounded uppercase font-bold ${target.status === 'active' ? 'bg-[#00ff00]/10 text-[#00ff00]' : 'bg-[#00ff00]/10 text-[#00ff00]'}`}>
                            {target.status}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-[#444] uppercase">
                          <span>Added: {target.createdAt?.toDate().toLocaleDateString()}</span>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Tooltip text={target.status === 'active' ? 'PAUSE MONITORING' : 'RESUME MONITORING'}>
                              <button onClick={() => toggleTargetStatus(target)} className="hover:text-[#eee]">
                                {target.status === 'active' ? 'PAUSE' : 'RESUME'}
                              </button>
                            </Tooltip>
                            <Tooltip text="REMOVE FROM WATCHLIST">
                              <button onClick={() => deleteTarget(target.id)} className="hover:text-[#00ff00]">
                                <Trash2 size={12} />
                              </button>
                            </Tooltip>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-8 space-y-4 md:space-y-6">
              <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-4 md:p-6 min-h-[400px] md:min-h-[600px]">
                <h2 className="text-[10px] md:text-xs font-bold text-[#666] uppercase mb-4 md:mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-2"><Bell size={14} /> Intelligence Feed</div>
                  <span className="text-[8px] md:text-[9px] text-[#333]">Real-time Updates</span>
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
                      <div key={alert.id} className="p-4 bg-[#111] border-l-2 border-[#00ff00] rounded-r">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xs font-bold text-[#eee]">{alert.title}</h3>
                          <span className="text-[9px] text-[#666] uppercase">{alert.timestamp?.toDate().toLocaleString()}</span>
                        </div>
                        <p className="text-[11px] text-[#aaa] mb-3">{alert.content}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-[#444] uppercase">Target: {monitoredTargets.find(t => t.id === alert.targetId)?.query || 'Unknown'}</span>
                          <div className={`text-[8px] px-2 py-0.5 rounded uppercase font-bold ${
                            alert.severity === 'critical' ? 'bg-[#00ff00] text-black' :
                            'bg-[#00ff00]/20 text-[#00ff00]'
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
        VOID OSINT // ANONYMOUS v1.0.4 // AUTHORIZED ACCESS ONLY
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
      {/* Feedback Modal */}
      {feedbackModal.open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-[#0a0a0a] border border-[#333] rounded-lg p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#eee] uppercase tracking-widest flex items-center gap-2">
                <Activity size={14} className="text-[#00ff00]" />
                System Feedback Loop
              </h3>
              <button onClick={() => setFeedbackModal({ ...feedbackModal, open: false })} className="text-[#444] hover:text-[#eee]">
                <XCircle size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex gap-4">
                <button 
                  onClick={() => setFeedbackModal({ ...feedbackModal, type: 'praise' })}
                  className={`flex-1 p-3 rounded border transition-all text-center ${feedbackModal.type === 'praise' ? 'bg-[#00ff00]/20 border-[#00ff00] text-[#00ff00]' : 'bg-[#111] border-[#222] text-[#444] hover:border-[#444]'}`}
                >
                  <div className="text-[10px] font-bold uppercase mb-1">Accurate</div>
                  <Shield size={16} className="mx-auto" />
                </button>
                <button 
                  onClick={() => setFeedbackModal({ ...feedbackModal, type: 'error' })}
                  className={`flex-1 p-3 rounded border transition-all text-center ${feedbackModal.type === 'error' ? 'bg-red-500/20 border-red-500 text-red-500' : 'bg-[#111] border-[#222] text-[#444] hover:border-[#444]'}`}
                >
                  <div className="text-[10px] font-bold uppercase mb-1">Incorrect</div>
                  <AlertTriangle size={16} className="mx-auto" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-bold text-[#666] uppercase tracking-wider">Comments / Corrections</label>
                <textarea 
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  placeholder="Describe the error or suggest an improvement..."
                  className="w-full bg-black border border-[#222] p-3 rounded text-sm text-[#eee] focus:border-[#00ff00] outline-none min-h-[100px] resize-none"
                />
              </div>
            </div>

            <button 
              onClick={handleFeedbackSubmit}
              disabled={feedbackLoading || !feedbackModal.type || !feedbackComment.trim()}
              className="w-full bg-[#00ff00] text-black py-3 rounded font-bold uppercase tracking-widest hover:bg-[#00ff00]/80 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {feedbackLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send size={14} />}
              Submit to Intelligence Engine
            </button>
            
            <p className="text-[8px] text-[#333] text-center uppercase tracking-tighter">
              Your feedback is processed by the consolidation engine to improve future cognitive patterns.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

