import React, { useState } from 'react';
import { 
  Code2, Copy, Check, Terminal, Cloud, Database, HardDrive, 
  ArrowRight, ShieldCheck, CheckCircle2, Download, Layers, Cpu
} from 'lucide-react';
import { GO_BACKEND_BLUEPRINT, BlueprintFile } from '../data/goBackendBlueprint';

export const GcpGoBlueprintView: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<BlueprintFile>(GO_BACKEND_BLUEPRINT[0]);
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = (file: BlueprintFile) => {
    const element = document.createElement('a');
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(blob);
    element.download = file.name.split('/').pop() || 'file';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-purple-950/60 via-slate-900 to-indigo-950/50 border border-purple-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 text-purple-300 px-3 py-1 rounded-full text-xs font-semibold">
            <Cpu className="w-3.5 h-3.5" />
            <span>Independent Go + HTMX + GCP Cloud Target</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Direct-to-Cloud Video & Firestore Blueprint
          </h2>

          <p className="text-sm text-slate-300 leading-relaxed">
            Here is the turnkey, production-ready Go backend using only the standard library (<code className="text-purple-300 font-mono">net/http</code>, <code className="text-purple-300 font-mono">embed</code>), the official Google Cloud Firestore &amp; Storage SDKs, and HTMX. When you are ready to run independently outside AI Studio, this compiles into a single ~18MB container ready for Cloud Run.
          </p>
        </div>
      </div>

      {/* Visual Architecture Flow Diagram */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-purple-400" />
          The Direct-to-GCS Video Upload Lifecycle
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 relative">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold font-mono">
              1
            </div>
            <h4 className="font-bold text-white">Save Estimate Draft</h4>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Mechanic enters customer name &amp; parts. HTMX submits to Go server, creating the Firestore document.
            </p>
            <div className="font-mono text-[10px] text-blue-400 bg-slate-900 px-2 py-1 rounded">
              POST /api/estimates/create
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 relative">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold font-mono">
              2
            </div>
            <h4 className="font-bold text-white">Generate Signed URL</h4>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Go backend uses GCP credentials to sign a 15-minute write-only HTTP PUT URL for Google Cloud Storage.
            </p>
            <div className="font-mono text-[10px] text-purple-400 bg-slate-900 px-2 py-1 rounded">
              storage.SignedURL(PUT)
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 relative">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold font-mono">
              3
            </div>
            <h4 className="font-bold text-white">Direct Upload to GCS</h4>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Browser streams 200MB video directly to <code className="text-emerald-300">storage.googleapis.com</code> with live progress bar. Zero server RAM load!
            </p>
            <div className="font-mono text-[10px] text-emerald-400 bg-slate-900 px-2 py-1 rounded">
              PUT &rarr; storage.googleapis.com
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 relative">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold font-mono">
              4
            </div>
            <h4 className="font-bold text-white">Customer Video Review</h4>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Customer opens link. Go generates a 2-hour signed playback URL and renders the HTMX review portal.
            </p>
            <div className="font-mono text-[10px] text-amber-400 bg-slate-900 px-2 py-1 rounded">
              GET /review/{`{id}`}
            </div>
          </div>

        </div>
      </div>

      {/* Code Inspector & File Switcher */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        
        {/* File Tabs */}
        <div className="bg-slate-950 p-2 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1 overflow-x-auto">
            {GO_BACKEND_BLUEPRINT.map((file) => (
              <button
                key={file.name}
                onClick={() => setSelectedFile(file)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  selectedFile.name === file.name
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <span>{file.name}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadFile(selectedFile)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>

            <button
              onClick={handleCopyCode}
              className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-purple-600/20"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy File'}</span>
            </button>
          </div>
        </div>

        {/* File Info Bar */}
        <div className="bg-slate-900/90 px-5 py-3 border-b border-slate-800/80 flex items-center justify-between text-xs">
          <div>
            <span className="font-mono text-purple-300 font-semibold">{selectedFile.path}</span>
            <span className="text-slate-400 ml-3 hidden sm:inline">{selectedFile.description}</span>
          </div>
          <span className="text-[11px] font-mono text-slate-500 uppercase">{selectedFile.language}</span>
        </div>

        {/* Code Content */}
        <div className="p-5 bg-slate-950 overflow-x-auto max-h-[500px] text-xs font-mono text-slate-300 leading-relaxed">
          <pre>{selectedFile.content}</pre>
        </div>
      </div>

      {/* Deployment Quickstart Guide */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Terminal className="w-5 h-5 text-purple-400" />
          Deploying this Go + HTMX Application to Google Cloud Run
        </h3>

        <div className="space-y-3 text-xs text-slate-300">
          <p>
            When you export this project and run on Google Cloud Platform, you only need three commands:
          </p>

          <div className="space-y-2">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-purple-300">
              <span className="text-slate-500"># 1. Enable Firestore and Cloud Storage APIs</span>
              <br />
              gcloud services enable firestore.googleapis.com storage.googleapis.com run.googleapis.com
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-purple-300">
              <span className="text-slate-500"># 2. Create the Cloud Storage bucket &amp; apply CORS</span>
              <br />
              gcloud storage buckets create gs://autolens-video-records-PROJECT_ID --location=us-central1
              <br />
              gcloud storage buckets update gs://autolens-video-records-PROJECT_ID --cors-file=cors.json
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-purple-300">
              <span className="text-slate-500"># 3. Build &amp; Deploy single binary container to Cloud Run</span>
              <br />
              gcloud run deploy autolens --source . --region us-central1 --allow-unauthenticated
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
