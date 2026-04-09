import React, { useState, useRef, useEffect } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { Camera, Upload, Scan, User, Shield, Activity, Loader2, AlertCircle, CheckCircle2, Search } from 'lucide-react';
import { performFaceAnalysis } from '../services/biometricService';
import Markdown from 'react-markdown';

interface BiometricsProps {
  onAddNode?: (node: any) => void;
}

const Biometrics: React.FC<BiometricsProps> = ({ onAddNode }) => {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model/';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
          faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL)
        ]);
        setModelsLoaded(true);
      } catch (err) {
        console.error("Failed to load face-api models:", err);
        setError("BIOMETRIC ENGINE ERROR: Models failed to load. Check network connection.");
      }
    };
    loadModels();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target?.result as string);
        setAnalysis(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError("CAMERA ERROR: Unable to access camera.");
    }
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg');
      setImage(dataUrl);
      
      // Stop camera
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const runAnalysis = async () => {
    if (!image || !modelsLoaded) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Client-side CV Detection
      const img = await faceapi.fetchImage(image);
      const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions()
        .withAgeAndGender();

      if (detections.length === 0) {
        setError("ANALYSIS FAILED: No faces detected in the image.");
        setLoading(false);
        return;
      }

      // 2. AI-powered Forensic Analysis
      const result = await performFaceAnalysis(image);
      setAnalysis(result);

      // 3. Draw detections on canvas
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const displaySize = { width: img.width, height: img.height };
        faceapi.matchDimensions(canvas, displaySize);
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
      }
    } catch (err) {
      console.error(err);
      setError("BIOMETRIC ANALYSIS ERROR: System failure during processing.");
    } finally {
      setLoading(false);
    }
  };

  const addToGraph = (face: any) => {
    if (onAddNode) {
      onAddNode({
        id: `biometric-${Date.now()}`,
        label: face.identification || `Subject: ${face.gender} (${face.age})`,
        type: 'person',
        imageUrl: image
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] text-[#eee] font-mono overflow-hidden">
      <div className="p-4 border-b border-[#1a1a1a] flex items-center justify-between bg-black/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#00ff00]/10 rounded border border-[#00ff00]/30">
            <Scan className="text-[#00ff00]" size={20} />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-widest text-[#00ff00] uppercase">Biometric Forensic Grid</h2>
            <p className="text-[10px] text-[#666]">LEVEL 9 COGNITIVE FACIAL RECOGNITION SYSTEM</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`px-2 py-0.5 rounded-full border text-[9px] flex items-center gap-1 ${modelsLoaded ? 'bg-[#00ff00]/10 border-[#00ff00]/30 text-[#00ff00]' : 'bg-red-500/10 border-red-500/30 text-red-500'}`}>
            <Activity size={10} className={modelsLoaded ? 'animate-pulse' : ''} />
            {modelsLoaded ? 'ENGINE: ONLINE' : 'ENGINE: OFFLINE'}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded flex items-center gap-3 text-red-500 text-xs animate-in fade-in slide-in-from-top-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="space-y-4">
            <div className="relative aspect-video bg-black border border-[#1a1a1a] rounded-lg overflow-hidden flex items-center justify-center group">
              {image ? (
                <>
                  <img src={image} alt="Target" className="w-full h-full object-contain" />
                  <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
                </>
              ) : (
                <div className="text-center space-y-4 p-8">
                  <div className="w-16 h-16 mx-auto rounded-full bg-[#1a1a1a] flex items-center justify-center border border-[#333] group-hover:border-[#00ff00]/50 transition-all">
                    <User className="text-[#333] group-hover:text-[#00ff00]/50" size={32} />
                  </div>
                  <p className="text-xs text-[#444] uppercase tracking-tighter">No Target Image Loaded</p>
                </div>
              )}
              
              {loading && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                  <Loader2 className="text-[#00ff00] animate-spin" size={48} />
                  <div className="text-center">
                    <p className="text-[#00ff00] text-xs font-bold tracking-widest animate-pulse">ANALYZING BIOMETRIC DATA...</p>
                    <p className="text-[9px] text-[#666] mt-1">SCANNING NEURAL PATHWAYS</p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 p-3 bg-[#111] border border-[#222] rounded hover:border-[#00ff00]/50 hover:bg-[#1a1a1a] transition-all text-xs font-bold uppercase tracking-widest"
              >
                <Upload size={16} className="text-[#00ff00]" />
                Upload Image
              </button>
              <button 
                onClick={startCamera}
                className="flex items-center justify-center gap-2 p-3 bg-[#111] border border-[#222] rounded hover:border-[#00ff00]/50 hover:bg-[#1a1a1a] transition-all text-xs font-bold uppercase tracking-widest"
              >
                <Camera size={16} className="text-[#00ff00]" />
                Live Camera
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                accept="image/*" 
              />
            </div>

            {image && !loading && (
              <button 
                onClick={runAnalysis}
                disabled={!modelsLoaded}
                className="w-full flex items-center justify-center gap-2 p-4 bg-[#00ff00] text-black rounded font-black uppercase tracking-[0.2em] hover:bg-[#00cc00] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(0,255,0,0.2)]"
              >
                <Scan size={20} />
                Execute Recognition Scan
              </button>
            )}
          </div>

          {/* Results Section */}
          <div className="space-y-4">
            {analysis ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                <div className="grid grid-cols-2 gap-4">
                  {analysis.faces.map((face: any, idx: number) => (
                    <div key={idx} className="p-4 bg-[#111] border border-[#00ff00]/20 rounded-lg space-y-3 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-100 transition-opacity">
                        <CheckCircle2 className="text-[#00ff00]" size={16} />
                      </div>
                      <div className="flex items-center gap-2 text-[#00ff00]">
                        <User size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Subject #{idx + 1}</span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold">{face.identification || 'UNKNOWN SUBJECT'}</p>
                        <div className="flex flex-wrap gap-1">
                          <span className="px-1.5 py-0.5 bg-black border border-[#222] text-[9px] text-[#666] rounded uppercase">{face.gender}</span>
                          <span className="px-1.5 py-0.5 bg-black border border-[#222] text-[9px] text-[#666] rounded uppercase">{face.age}</span>
                          <span className="px-1.5 py-0.5 bg-black border border-[#222] text-[9px] text-[#666] rounded uppercase">{face.emotion}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] text-[#444] uppercase font-bold">Distinctive Features</p>
                        <ul className="text-[10px] text-[#888] list-disc list-inside">
                          {face.features.map((f: string, i: number) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                      </div>
                      <button 
                        onClick={() => addToGraph(face)}
                        className="w-full mt-2 p-2 bg-[#00ff00]/10 border border-[#00ff00]/30 text-[#00ff00] text-[9px] font-bold uppercase tracking-widest rounded hover:bg-[#00ff00]/20 transition-all flex items-center justify-center gap-2"
                      >
                        <Search size={12} />
                        Add to Intelligence Graph
                      </button>
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg">
                  <div className="flex items-center gap-2 mb-4 text-[#00ff00] border-b border-[#1a1a1a] pb-2">
                    <Shield size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Forensic Biometric Report</span>
                  </div>
                  <div className="prose prose-invert prose-xs max-w-none text-[11px] leading-relaxed text-[#aaa]">
                    <Markdown>{analysis.report}</Markdown>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-[#1a1a1a] rounded-lg space-y-4">
                <div className="p-4 bg-[#111] rounded-full border border-[#1a1a1a]">
                  <Scan className="text-[#222]" size={48} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-[#333] uppercase tracking-widest">Awaiting Scan Execution</p>
                  <p className="text-[10px] text-[#222]">LOAD TARGET IMAGE TO BEGIN RECOGNITION SEQUENCE</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <video ref={videoRef} className="hidden" autoPlay playsInline />
    </div>
  );
};

export default Biometrics;
