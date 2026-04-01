export interface Node {
  id: string;
  label: string;
  type: 'target' | 'email' | 'domain' | 'social' | 'leak' | 'public_data' | 'person' | 'company' | 'political' | 'financial';
}

export interface Link {
  source: string;
  target: string;
  label?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface Target {
  id: string;
  query: string;
  status: 'active' | 'paused';
  lastChecked?: any;
  uid: string;
  createdAt: any;
}

export interface Alert {
  id: string;
  targetId: string;
  title: string;
  content: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: any;
  uid: string;
}

export interface IntelligenceData {
  nodes: Node[];
  links: Link[];
  report: string;
  sources: { uri: string; title: string }[];
  context?: string; // Store the raw context for chat
}

export interface HistoryItem {
  id: string;
  query: string;
  data: IntelligenceData;
  chatMessages?: ChatMessage[];
  timestamp: any;
  uid: string;
}

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
