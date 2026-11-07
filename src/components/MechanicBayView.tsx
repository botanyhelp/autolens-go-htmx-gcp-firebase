import React, { useState } from 'react';
import { 
  Car, User, Phone, Mail, Clock, Calendar, CheckCircle, AlertCircle, 
  Share2, Copy, Check, ExternalLink, Video as VideoIcon, PlusCircle, 
  ShieldAlert, DollarSign, Database, Server, Smartphone, Bookmark, ChevronRight
} from 'lucide-react';
import { Estimate, VideoChapter } from '../types/estimate';
import { formatCurrency, formatTime } from '../utils/videoUtils';
import { VideoPlayerWithChapters } from './VideoPlayerWithChapters';
import { VideoRecorderModal } from './VideoRecorderModal';

interface MechanicBayViewProps {
  estimates: Estimate[];
  selectedEstimate: Estimate;
  onSelectEstimate: (id: string) => void;
  onUpdateEstimate: (updated: Estimate) => void;
  onOpenNewEstimate: () => void;
  onSwitchToCustomerView: () => void;
}

export const MechanicBayView: React.FC<MechanicBayViewProps> = ({
  estimates,
  selectedEstimate,
  onSelectEstimate,
  onUpdateEstimate,
  onOpenNewEstimate,
  onSwitchToCustomerView,
}) => {
  const [filter, setFilter] = useState<'all' | 'awaiting_customer' | 'approved' | 'draft'>('all');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [showGcpDetails, setShowGcpDetails] = useState(false);

  const filteredEstimates = estimates.filter((est) => {
    if (filter === 'all') return true;
    return est.status === filter;
  });

  const partsTotal = selectedEstimate.partsItems.reduce((acc, p) => acc + p.quantity * p.unitCost, 0);
  const laborTotal = selectedEstimate.laborItems.reduce((acc, l) => acc + l.hours * l.hourlyRate, 0);
  const taxTotal = (partsTotal * selectedEstimate.taxRatePercent) / 100;
  const grandTotal = partsTotal + laborTotal + taxTotal;

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}?view=customer&est=${selectedEstimate.id}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleAddChapter = (newChap: Omit<VideoChapter, 'id'>) => {
    if (!selectedEstimate.video) return;
    const chapter: VideoChapter = {
      ...newChap,
      id: 'c-' + Math.random().toString(36).substring(2, 7),
    };

    const updatedVideo = {
      ...selectedEstimate.video,
      chapters: [...(selectedEstimate.video.chapters || []), chapter].sort((a, b) => a.timeSeconds - b.timeSeconds),
    };

    onUpdateEstimate({
      ...selectedEstimate,
      video: updatedVideo,
    });
  };

  const handleVideoAttached = (newVid: any) => {
    onUpdateEstimate({
      ...selectedEstimate,
      video: newVid,
      status: selectedEstimate.status === 'draft' ? 'awaiting_customer' : selectedEstimate.status,
    });
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'safety_critical':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-400 bg-red-950/60 border border-red-800/80 px-2 py-0.5 rounded-full">
            <ShieldAlert className="w-3 h-3" />
            Safety Critical
          </span>
        );
      case 'recommended_soon':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-950/60 border border-amber-800/80 px-2 py-0.5 rounded-full">
            <Clock className="w-3 h-3" />
            Recommended Soon
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded-full">
            <CheckCircle className="w-3 h-3" />
            Maintenance
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full">
            <CheckCircle className="w-3.5 h-3.5" />
            Customer Approved
          </span>
        );
      case 'awaiting_customer':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-full">
            <Clock className="w-3.5 h-3.5" />
            Awaiting Review
          </span>
        );
      case 'declined':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2.5 py-1 rounded-full">
            <AlertCircle className="w-3.5 h-3.5" />
            Declined
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-full">
            Draft
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Top Banner: Mechanic Shop Bay Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Bay Active Job: {selectedEstimate.vehicle.year} {selectedEstimate.vehicle.make} {selectedEstimate.vehicle.model}
              {getUrgencyBadge(selectedEstimate.urgency)}
            </h2>
            <p className="text-xs text-slate-400">
              Customer: <span className="text-slate-200 font-medium">{selectedEstimate.customerName}</span> &middot; RO #: <span className="font-mono text-slate-300">{selectedEstimate.estimateNumber}</span> &middot; Tech: <span className="text-slate-300">{selectedEstimate.mechanicName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Direct Customer View trigger */}
          <button
            onClick={onSwitchToCustomerView}
            className="flex items-center gap-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Open Customer Portal View</span>
          </button>

          {/* New Estimate button */}
          <button
            onClick={onOpenNewEstimate}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-md shadow-blue-600/20 transition cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Work Order</span>
          </button>
        </div>
      </div>

      {/* Main Layout Grid: Left Queue, Right Active Estimate Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (4 cols): Queue of Estimates */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
            
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <span>Shop Work Orders</span>
                <span className="bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-[10px] font-mono">
                  {estimates.length}
                </span>
              </h3>

              {/* Status Filter */}
              <select
                value={filter}
                onChange={(e: any) => setFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-[11px] text-slate-300 rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
              >
                <option value="all">All Jobs</option>
                <option value="awaiting_customer">Awaiting Customer</option>
                <option value="approved">Approved</option>
                <option value="draft">Drafts</option>
              </select>
            </div>

            {/* List */}
            <div className="space-y-2.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {filteredEstimates.map((est) => {
                const isSelected = est.id === selectedEstimate.id;
                const estTotal =
                  est.partsItems.reduce((acc, p) => acc + p.quantity * p.unitCost, 0) +
                  est.laborItems.reduce((acc, l) => acc + l.hours * l.hourlyRate, 0);

                return (
                  <button
                    key={est.id}
                    onClick={() => onSelectEstimate(est.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition cursor-pointer flex flex-col gap-2 ${
                      isSelected
                        ? 'bg-blue-600/10 border-blue-500/50 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-white truncate max-w-[170px]">
                        {est.vehicle.year} {est.vehicle.make} {est.vehicle.model}
                      </span>
                      <span className="text-[11px] font-mono font-semibold text-emerald-400">
                        {formatCurrency(estTotal)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="truncate">{est.customerName}</span>
                      <span className="font-mono text-[10px]">{est.estimateNumber}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                      <div className="flex items-center gap-1.5">
                        {est.video ? (
                          <span className="flex items-center gap-1 text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                            <VideoIcon className="w-3 h-3" />
                            <span>Video</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">No video</span>
                        )}
                      </div>
                      {getStatusBadge(est.status)}
                    </div>
                  </button>
                );
              })}
            </div>

          </div>

          {/* Architecture Quick-Summary Card */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-blue-400" />
                GCP Backend Status
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800">
                Connected
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Records are synced to <span className="text-slate-200">Firestore</span> collection <code className="text-blue-400">/estimates</code>. Videos stream directly to <span className="text-slate-200">Google Cloud Storage</span> via 15-minute V4 signed PUT URLs.
            </p>
            <button
              onClick={() => setShowGcpDetails(!showGcpDetails)}
              className="text-[11px] text-blue-400 hover:text-blue-300 font-medium underline cursor-pointer pt-1"
            >
              {showGcpDetails ? 'Hide GCS & Firestore Payload' : 'Inspect Firestore & GCS Document Payload'}
            </button>

            {showGcpDetails && (
              <pre className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[10px] text-slate-300 overflow-x-auto font-mono mt-2">
                {JSON.stringify(
                  {
                    firestore_doc: `estimates/${selectedEstimate.id}`,
                    customer_name: selectedEstimate.customerName,
                    phone: selectedEstimate.phone,
                    vehicle: selectedEstimate.vehicle,
                    parts_subtotal: partsTotal,
                    labor_subtotal: laborTotal,
                    video_gcs_path: selectedEstimate.video?.gcsObjectPath || null,
                    upload_status: selectedEstimate.video?.uploadStatus || 'none',
                    status: selectedEstimate.status,
                  },
                  null,
                  2
                )}
              </pre>
            )}
          </div>
        </div>

        {/* Right Column (8 cols): Active Estimate Workbench */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Share Link Banner with 1-Click Copy */}
          <div className="bg-gradient-to-r from-blue-900/40 via-slate-900 to-indigo-900/30 border border-blue-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Customer Video Review Link</h4>
                <p className="text-[11px] text-slate-300">
                  Send this SMS/Email link so {selectedEstimate.customerName} can watch your walkaround and approve repairs.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyLink}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
              </button>

              <button
                onClick={onSwitchToCustomerView}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Test Customer Portal</span>
              </button>
            </div>
          </div>

          {/* Walkaround Video Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <VideoIcon className="w-4 h-4 text-blue-400" />
                  Mechanic Walkaround Inspection Video
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedEstimate.video?.gcsObjectPath ? (
                    <span className="font-mono text-[11px] text-slate-300">
                      GCS: gs://autolens-video-records/{selectedEstimate.video.gcsObjectPath}
                    </span>
                  ) : (
                    'No video recorded yet for this work order.'
                  )}
                </p>
              </div>

              <button
                onClick={() => setIsRecordModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5"
              >
                <VideoIcon className="w-3.5 h-3.5" />
                <span>{selectedEstimate.video ? 'Replace Video' : 'Record Video'}</span>
              </button>
            </div>

            {/* Video Player Component */}
            <VideoPlayerWithChapters
              video={selectedEstimate.video}
              allowChapterCreation={true}
              onAddChapter={handleAddChapter}
            />
          </div>

          {/* Diagnostic Notes Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Diagnostic & Technician Notes
            </h4>
            <p className="text-xs text-slate-200 leading-relaxed bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
              {selectedEstimate.notes}
            </p>
          </div>

          {/* Itemized Parts & Labor Breakdown Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Itemized Estimate Breakdown</h3>
                <p className="text-xs text-slate-400">Customer can toggle optional recommendations</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400">Estimated Total</span>
                <div className="text-base font-extrabold text-emerald-400 font-mono">
                  {formatCurrency(grandTotal)}
                </div>
              </div>
            </div>

            {/* Parts Table */}
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                Parts ({selectedEstimate.partsItems.length})
              </span>
              <div className="border border-slate-800 rounded-xl overflow-hidden text-xs">
                <div className="grid grid-cols-12 bg-slate-950 p-2.5 font-semibold text-slate-400 border-b border-slate-800">
                  <div className="col-span-6">Part Description</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-2 text-right">Unit Price</div>
                  <div className="col-span-2 text-right">Total</div>
                </div>
                {selectedEstimate.partsItems.map((part) => (
                  <div key={part.id} className="grid grid-cols-12 p-2.5 items-center border-b border-slate-800/60 bg-slate-900/40">
                    <div className="col-span-6">
                      <span className="font-medium text-slate-200 block">{part.name}</span>
                      {part.partNumber && (
                        <span className="text-[10px] font-mono text-slate-500">P/N: {part.partNumber}</span>
                      )}
                    </div>
                    <div className="col-span-2 text-center text-slate-300 font-mono">{part.quantity}</div>
                    <div className="col-span-2 text-right text-slate-300 font-mono">{formatCurrency(part.unitCost)}</div>
                    <div className="col-span-2 text-right font-semibold text-white font-mono">
                      {formatCurrency(part.quantity * part.unitCost)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Labor Table */}
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                Labor Operations ({selectedEstimate.laborItems.length})
              </span>
              <div className="border border-slate-800 rounded-xl overflow-hidden text-xs">
                <div className="grid grid-cols-12 bg-slate-950 p-2.5 font-semibold text-slate-400 border-b border-slate-800">
                  <div className="col-span-6">Operation Description</div>
                  <div className="col-span-2 text-center">Hours</div>
                  <div className="col-span-2 text-right">Rate / Hr</div>
                  <div className="col-span-2 text-right">Total</div>
                </div>
                {selectedEstimate.laborItems.map((labor) => (
                  <div key={labor.id} className="grid grid-cols-12 p-2.5 items-center border-b border-slate-800/60 bg-slate-900/40">
                    <div className="col-span-6 font-medium text-slate-200">{labor.description}</div>
                    <div className="col-span-2 text-center text-slate-300 font-mono">{labor.hours} hrs</div>
                    <div className="col-span-2 text-right text-slate-300 font-mono">{formatCurrency(labor.hourlyRate)}</div>
                    <div className="col-span-2 text-right font-semibold text-white font-mono">
                      {formatCurrency(labor.hours * labor.hourlyRate)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary calculations */}
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 flex justify-end">
              <div className="w-64 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Parts Subtotal</span>
                  <span className="font-mono text-slate-200">{formatCurrency(partsTotal)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Labor Subtotal</span>
                  <span className="font-mono text-slate-200">{formatCurrency(laborTotal)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Sales Tax ({selectedEstimate.taxRatePercent}%)</span>
                  <span className="font-mono text-slate-200">{formatCurrency(taxTotal)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-800 text-sm font-bold text-white">
                  <span>Grand Total</span>
                  <span className="font-mono text-emerald-400">{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Customer Signature & Approval Status (If approved) */}
            {selectedEstimate.status === 'approved' && (
              <div className="bg-emerald-950/40 border border-emerald-600/40 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    Authorized & Digitally Signed by Customer
                  </h5>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Signature: <span className="font-serif italic font-bold text-white">{selectedEstimate.customerSignature}</span> &middot; Date: {selectedEstimate.customerResponseDate ? new Date(selectedEstimate.customerResponseDate).toLocaleDateString() : 'Today'}
                  </p>
                  {selectedEstimate.customerNotes && (
                    <p className="text-[11px] text-emerald-200/80 mt-1 italic">
                      "{selectedEstimate.customerNotes}"
                    </p>
                  )}
                </div>
                <span className="bg-emerald-600 text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg">
                  Ready to Service
                </span>
              </div>
            )}

          </div>

        </div>

      </div>

      {/* Video Recorder Modal */}
      <VideoRecorderModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onVideoReady={handleVideoAttached}
        vehicleName={`${selectedEstimate.vehicle.year} ${selectedEstimate.vehicle.make} ${selectedEstimate.vehicle.model}`}
        customerName={selectedEstimate.customerName}
        mechanicName={selectedEstimate.mechanicName}
      />
    </div>
  );
};
