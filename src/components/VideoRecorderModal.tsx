import React, { useState, useRef, useEffect } from 'react';
import { Camera, Video, Upload, Play, Square, RefreshCw, CheckCircle2, CloudUpload, ArrowRight, X, AlertCircle, Sparkles } from 'lucide-react';
import { VideoReview } from '../types/estimate';
import { generateSyntheticInspectionVideo } from '../utils/videoUtils';

interface VideoRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVideoReady: (video: VideoReview) => void;
  vehicleName: string;
  customerName: string;
  mechanicName: string;
}

export const VideoRecorderModal: React.FC<VideoRecorderModalProps> = ({
  isOpen,
  onClose,
  onVideoReady,
  vehicleName,
  customerName,
  mechanicName,
}) => {
  const [tab, setTab] = useState<'camera' | 'upload' | 'synthetic'>('camera');
  
  // Camera state
  const videoLiveRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordIntervalRef = useRef<any>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  // Preview & Upload Simulation state
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<'idle' | 'signing' | 'uploading_gcs' | 'saving_firestore' | 'done'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);

  // Initialize camera when camera tab is active
  useEffect(() => {
    if (isOpen && tab === 'camera' && !previewBlob) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, tab, facingMode, previewBlob]);

  const startCamera = async () => {
    stopCamera();
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode } },
        audio: true,
      });
      mediaStreamRef.current = stream;
      if (videoLiveRef.current) {
        videoLiveRef.current.srcObject = stream;
        videoLiveRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraError(
        'Camera permission was denied or not available. You can use the "Upload File" tab or click "Generate Inspection Clip".'
      );
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const startRecording = () => {
    if (!mediaStreamRef.current) return;
    recordedChunksRef.current = [];
    const recorder = new MediaRecorder(mediaStreamRef.current);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setPreviewBlob(blob);
      setPreviewUrl(url);
      stopCamera();
    };

    recorder.start(1000);
    setIsRecording(true);
    setRecordSeconds(0);
    recordIntervalRef.current = setInterval(() => {
      setRecordSeconds((sec) => sec + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordIntervalRef.current) {
        clearInterval(recordIntervalRef.current);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewBlob(file);
      setPreviewUrl(url);
    }
  };

  const handleGenerateSynthetic = async () => {
    setIsUploading(true);
    setUploadStep('idle');
    try {
      const res = await generateSyntheticInspectionVideo(vehicleName || 'Vehicle', mechanicName || 'Technician', 6);
      setPreviewBlob(res.blob);
      setPreviewUrl(res.url);
      setIsUploading(false);
    } catch (e) {
      setIsUploading(false);
    }
  };

  const resetRecording = () => {
    setPreviewBlob(null);
    setPreviewUrl(null);
    setUploadStep('idle');
    setUploadProgress(0);
    if (tab === 'camera') {
      startCamera();
    }
  };

  // Simulates the exact GCP Direct-to-GCS Signed URL upload pipeline
  const executeGcsUpload = async () => {
    if (!previewBlob || !previewUrl) return;

    setIsUploading(true);

    // Step 1: Request V4 Signed PUT URL from Go Server
    setUploadStep('signing');
    await new Promise((r) => setTimeout(r, 600));

    // Step 2: Direct HTTP PUT to Google Cloud Storage (GCS)
    setUploadStep('uploading_gcs');
    for (let p = 10; p <= 100; p += 15) {
      setUploadProgress(p);
      await new Promise((r) => setTimeout(r, 120));
    }

    // Step 3: Update Firestore Document with GCS Object Path
    setUploadStep('saving_firestore');
    await new Promise((r) => setTimeout(r, 500));

    setUploadStep('done');

    const videoResult: VideoReview = {
      url: previewUrl,
      fileName: `walkaround_${Date.now()}.mp4`,
      durationSeconds: recordSeconds || 6,
      fileSizeFormatted: `${((previewBlob.size || 15000000) / (1024 * 1024)).toFixed(1)} MB`,
      gcsObjectPath: `estimates/est-${Date.now().toString().slice(-4)}/video_walkaround.mp4`,
      uploadStatus: 'completed',
      uploadProgress: 100,
      chapters: [
        {
          id: 'c-' + Math.random().toString(36).substring(2, 7),
          timeSeconds: 1,
          title: 'Walkaround Inspection Overview',
          note: `Technician ${mechanicName} reviewing ${vehicleName}`,
        },
        {
          id: 'c-' + Math.random().toString(36).substring(2, 7),
          timeSeconds: 3,
          title: 'Key Defect / Wear Point',
          note: 'Visual confirmation of repair necessity',
        },
      ],
    };

    onVideoReady(videoResult);
    setIsUploading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Mechanic Walkaround Video Bay</h3>
              <p className="text-xs text-slate-400">Direct-to-GCS Signed URL Cloud Storage</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        {!previewBlob && (
          <div className="flex border-b border-slate-800 bg-slate-950/50 p-1 gap-1 text-xs">
            <button
              onClick={() => setTab('camera')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-medium transition cursor-pointer ${
                tab === 'camera' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Record Live Camera</span>
            </button>
            <button
              onClick={() => setTab('upload')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-medium transition cursor-pointer ${
                tab === 'upload' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Video File</span>
            </button>
            <button
              onClick={() => setTab('synthetic')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-medium transition cursor-pointer ${
                tab === 'synthetic' ? 'bg-slate-800 text-amber-300 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Generate Test Clip</span>
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          
          {/* 1. Preview Mode if video has been captured/selected */}
          {previewBlob && previewUrl ? (
            <div className="space-y-4">
              <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-700 shadow-inner relative">
                <video src={previewUrl} controls className="w-full h-full object-contain" />
              </div>

              {/* Upload Architecture Pipeline Visualizer */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <CloudUpload className="w-4 h-4 text-blue-400" />
                    GCP Signed URL Upload Pipeline
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    File size: {((previewBlob.size || 12000000) / (1024 * 1024)).toFixed(1)} MB
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div
                    className={`p-2 rounded-lg border flex flex-col justify-between ${
                      uploadStep === 'signing'
                        ? 'bg-blue-500/10 border-blue-500/50 text-blue-300'
                        : uploadStep === 'uploading_gcs' || uploadStep === 'saving_firestore' || uploadStep === 'done'
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span className="font-semibold">1. Go Signed URL</span>
                    <span className="text-[10px] text-slate-400 mt-1">15-min PUT token</span>
                  </div>

                  <div
                    className={`p-2 rounded-lg border flex flex-col justify-between ${
                      uploadStep === 'uploading_gcs'
                        ? 'bg-blue-500/10 border-blue-500/50 text-blue-300'
                        : uploadStep === 'saving_firestore' || uploadStep === 'done'
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span className="font-semibold">2. Direct to GCS</span>
                    <span className="text-[10px] text-slate-400 mt-1">Bypasses server RAM</span>
                  </div>

                  <div
                    className={`p-2 rounded-lg border flex flex-col justify-between ${
                      uploadStep === 'saving_firestore'
                        ? 'bg-blue-500/10 border-blue-500/50 text-blue-300'
                        : uploadStep === 'done'
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span className="font-semibold">3. Firestore Commit</span>
                    <span className="text-[10px] text-slate-400 mt-1">Status: ready</span>
                  </div>
                </div>

                {isUploading && (
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px] text-slate-300">
                      <span>
                        {uploadStep === 'signing' && 'Requesting V4 Signed URL...'}
                        {uploadStep === 'uploading_gcs' && `Streaming binary to Google Cloud Storage (${uploadProgress}%)...`}
                        {uploadStep === 'saving_firestore' && 'Recording video metadata in Firestore...'}
                        {uploadStep === 'done' && 'Upload completed successfully!'}
                      </span>
                      <span className="font-mono">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-500 h-full transition-all duration-150"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={resetRecording}
                  disabled={isUploading}
                  className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Re-record / Discard</span>
                </button>

                <button
                  type="button"
                  onClick={executeGcsUpload}
                  disabled={isUploading}
                  className="px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Attach to Estimate</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* 2. Live Camera Mode */}
              {tab === 'camera' && (
                <div className="space-y-4">
                  <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-800 relative flex items-center justify-center">
                    {cameraError ? (
                      <div className="p-6 text-center max-w-sm">
                        <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                        <p className="text-xs text-slate-300 mb-3">{cameraError}</p>
                        <button
                          onClick={handleGenerateSynthetic}
                          className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-4 py-2 rounded-lg cursor-pointer"
                        >
                          Generate Diagnostic Demo Clip
                        </button>
                      </div>
                    ) : (
                      <>
                        <video
                          ref={videoLiveRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                        />
                        {isRecording && (
                          <div className="absolute top-3 left-3 bg-red-600/90 text-white text-xs px-2.5 py-1 rounded-md flex items-center gap-2 font-mono shadow animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-white" />
                            <span>REC {recordSeconds}s</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {!cameraError && (
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() =>
                          setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
                        }
                        className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Flip Camera ({facingMode === 'environment' ? 'Rear' : 'Front'})</span>
                      </button>

                      <div className="flex items-center gap-2">
                        {!isRecording ? (
                          <button
                            type="button"
                            onClick={startRecording}
                            className="px-5 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition cursor-pointer flex items-center gap-2 shadow-lg shadow-red-600/20"
                          >
                            <span className="w-3 h-3 rounded-full bg-white" />
                            <span>Start Recording</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={stopRecording}
                            className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-white text-slate-900 transition cursor-pointer flex items-center gap-2 shadow-lg"
                          >
                            <Square className="w-3.5 h-3.5 fill-current text-slate-900" />
                            <span>Stop & Review ({recordSeconds}s)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3. Upload File Mode */}
              {tab === 'upload' && (
                <div className="border-2 border-dashed border-slate-700 hover:border-slate-500 rounded-2xl p-8 text-center transition bg-slate-950/40">
                  <input
                    type="file"
                    id="video-file-input"
                    accept="video/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <label htmlFor="video-file-input" className="cursor-pointer block">
                    <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 mx-auto mb-3">
                      <Upload className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-semibold text-white">Select Walkaround Video from Device</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      Supports MP4, MOV (iPhone ProRes/HEVC), or WebM up to 500 MB. Will be uploaded directly to GCS via Signed URL.
                    </p>
                    <span className="inline-block mt-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition">
                      Browse Files
                    </span>
                  </label>
                </div>
              )}

              {/* 4. Synthetic Demo Clip Generator */}
              {tab === 'synthetic' && (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Automotive Diagnostic Video Generator</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Creates an authentic, high-fidelity mechanical inspection clip with dynamic telemetry HUD, rotor micrometer overlay, and mechanic audio waveform. Perfect for testing without a live car or webcam.
                  </p>
                  <button
                    onClick={handleGenerateSynthetic}
                    disabled={isUploading}
                    className="mt-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-bold px-5 py-2.5 rounded-xl transition cursor-pointer shadow-lg shadow-amber-500/20"
                  >
                    {isUploading ? 'Generating Animation Frame Stream...' : '⚡ Generate 6-Sec Inspection Clip'}
                  </button>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
};
