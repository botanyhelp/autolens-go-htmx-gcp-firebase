import React, { useState } from 'react';
import { 
  ShieldCheck, Phone, CheckCircle2, Video, Check, AlertTriangle, 
  HelpCircle, ArrowLeft, Download, PenTool, Sparkles, X, Smartphone, Monitor
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Estimate, PartItem, LaborItem } from '../types/estimate';
import { formatCurrency } from '../utils/videoUtils';
import { VideoPlayerWithChapters } from './VideoPlayerWithChapters';

interface CustomerPortalViewProps {
  estimate: Estimate;
  onUpdateEstimate: (updated: Estimate) => void;
  onBackToMechanic: () => void;
}

export const CustomerPortalView: React.FC<CustomerPortalViewProps> = ({
  estimate,
  onUpdateEstimate,
  onBackToMechanic,
}) => {
  const [deviceFrame, setDeviceFrame] = useState<'mobile' | 'desktop'>('mobile');
  const [selectedParts, setSelectedParts] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    estimate.partsItems.forEach((p) => {
      map[p.id] = p.approved !== false;
    });
    return map;
  });

  const [selectedLabor, setSelectedLabor] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    estimate.laborItems.forEach((l) => {
      map[l.id] = l.approved !== false;
    });
    return map;
  });

  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [signatureName, setSignatureName] = useState(estimate.customerName || '');
  const [customerNotes, setCustomerNotes] = useState('');
  const [hasAgreedTerms, setHasAgreedTerms] = useState(true);

  // Recalculate dynamic totals based on user checkbox toggles
  const approvedPartsTotal = estimate.partsItems.reduce((acc, p) => {
    return selectedParts[p.id] ? acc + p.quantity * p.unitCost : acc;
  }, 0);

  const approvedLaborTotal = estimate.laborItems.reduce((acc, l) => {
    return selectedLabor[l.id] ? acc + l.hours * l.hourlyRate : acc;
  }, 0);

  const taxTotal = (approvedPartsTotal * estimate.taxRatePercent) / 100;
  const approvedGrandTotal = approvedPartsTotal + approvedLaborTotal + taxTotal;

  const togglePart = (part: PartItem) => {
    if (part.required) return; // Cannot uncheck required safety items
    setSelectedParts((prev) => ({ ...prev, [part.id]: !prev[part.id] }));
  };

  const toggleLabor = (labor: LaborItem) => {
    if (labor.required) return;
    setSelectedLabor((prev) => ({ ...prev, [labor.id]: !prev[labor.id] }));
  };

  const handleApproveEstimate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signatureName.trim()) return;

    // Trigger confetti celebration!
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });

    const updatedParts = estimate.partsItems.map((p) => ({
      ...p,
      approved: !!selectedParts[p.id],
    }));

    const updatedLabor = estimate.laborItems.map((l) => ({
      ...l,
      approved: !!selectedLabor[l.id],
    }));

    const updatedEstimate: Estimate = {
      ...estimate,
      partsItems: updatedParts,
      laborItems: updatedLabor,
      status: 'approved',
      customerResponseDate: new Date().toISOString(),
      customerSignature: signatureName.trim(),
      customerNotes: customerNotes.trim() || undefined,
    };

    onUpdateEstimate(updatedEstimate);
    setIsSignModalOpen(false);
  };

  const handleDecline = () => {
    if (confirm('Are you sure you want to decline this repair estimate?')) {
      onUpdateEstimate({
        ...estimate,
        status: 'declined',
        customerResponseDate: new Date().toISOString(),
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      
      {/* Top Navigation Bar: Back & Preview Frame Toggle */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-16 z-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={onBackToMechanic}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Mechanic Bay</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 hidden sm:inline">Preview Mode:</span>
            <div className="bg-slate-950 border border-slate-800 p-0.5 rounded-lg flex text-xs">
              <button
                onClick={() => setDeviceFrame('mobile')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition cursor-pointer ${
                  deviceFrame === 'mobile' ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Mobile (Phone)</span>
              </button>
              <button
                onClick={() => setDeviceFrame('desktop')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition cursor-pointer ${
                  deviceFrame === 'desktop' ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Full Width</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container: Mobile phone mockup or Full desktop width */}
      <div className="max-w-4xl mx-auto px-4 pt-6">
        <div
          className={`mx-auto transition-all ${
            deviceFrame === 'mobile'
              ? 'max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl'
              : 'w-full'
          }`}
        >
          
          {/* Shop Header & Trust Badges */}
          <div className="border-b border-slate-800/80 pb-4 mb-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-white tracking-wide uppercase">{estimate.shopName}</h2>
                  <div className="flex items-center gap-1 text-[10px] text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Verified ASE Certified Repair Center</span>
                  </div>
                </div>
              </div>

              <a
                href={`tel:${estimate.shopPhone}`}
                className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700/80 transition"
              >
                <Phone className="w-3 h-3 text-emerald-400" />
                <span className="text-[11px] font-medium hidden sm:inline">Call Shop</span>
              </a>
            </div>

            {/* Vehicle & Customer Banner */}
            <div className="bg-slate-950/70 rounded-xl p-3 border border-slate-800 flex items-center justify-between mt-3">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Vehicle Inspected</span>
                <span className="text-sm font-bold text-white">
                  {estimate.vehicle.year} {estimate.vehicle.make} {estimate.vehicle.model}
                </span>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Plate: {estimate.vehicle.licensePlate || 'N/A'} &middot; Odometer: {estimate.vehicle.mileage?.toLocaleString() || 'N/A'} mi
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Estimate ID</span>
                <span className="font-mono text-xs font-semibold text-slate-300">{estimate.estimateNumber}</span>
              </div>
            </div>
          </div>

          {/* Video Walkaround Section */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Video className="w-4 h-4 text-blue-400" />
                  Technician Walkaround Review
                </h3>
                <p className="text-[11px] text-slate-400">
                  Recorded in the bay by your technician {estimate.mechanicName}
                </p>
              </div>
            </div>

            {/* Video Player */}
            <VideoPlayerWithChapters video={estimate.video} />
          </div>

          {/* Mechanic's Personal Diagnostic Notes */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 mb-6">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <span>Technician Findings & Notes</span>
            </h4>
            <p className="text-xs text-slate-200 leading-relaxed italic">
              "{estimate.notes}"
            </p>
          </div>

          {/* Interactive Itemized Estimate Checklist */}
          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Recommended Services & Parts</h3>
                <p className="text-[11px] text-slate-400">
                  Select the services you would like performed today.
                </p>
              </div>
            </div>

            {/* Parts List */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Required & Recommended Parts
              </span>

              {estimate.partsItems.map((part) => {
                const isChecked = !!selectedParts[part.id];
                return (
                  <div
                    key={part.id}
                    onClick={() => togglePart(part)}
                    className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                      isChecked
                        ? 'bg-slate-900 border-slate-700 shadow-sm'
                        : 'bg-slate-950/40 border-slate-800/60 opacity-60'
                    } ${part.required ? 'cursor-default' : 'cursor-pointer hover:border-slate-600'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${
                          isChecked
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'border-slate-600 bg-slate-950'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-white">{part.name}</span>
                          {part.required && (
                            <span className="text-[9px] font-bold text-red-400 bg-red-950/80 border border-red-800/80 px-1.5 py-0.2 rounded">
                              Required for Safety
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          Qty: {part.quantity} &middot; {formatCurrency(part.unitCost)} each
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold font-mono text-slate-200">
                        {formatCurrency(part.quantity * part.unitCost)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Labor List */}
            <div className="space-y-2 pt-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Labor Operations
              </span>

              {estimate.laborItems.map((labor) => {
                const isChecked = !!selectedLabor[labor.id];
                return (
                  <div
                    key={labor.id}
                    onClick={() => toggleLabor(labor)}
                    className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                      isChecked
                        ? 'bg-slate-900 border-slate-700 shadow-sm'
                        : 'bg-slate-950/40 border-slate-800/60 opacity-60'
                    } ${labor.required ? 'cursor-default' : 'cursor-pointer hover:border-slate-600'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${
                          isChecked
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'border-slate-600 bg-slate-950'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-white">{labor.description}</span>
                          {labor.required && (
                            <span className="text-[9px] font-bold text-red-400 bg-red-950/80 border border-red-800/80 px-1.5 py-0.2 rounded">
                              Required
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {labor.hours} hrs @ {formatCurrency(labor.hourlyRate)}/hr
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold font-mono text-slate-200">
                        {formatCurrency(labor.hours * labor.hourlyRate)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

          {/* Pricing Summary Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 mb-6 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Selected Parts</span>
              <span className="font-mono text-slate-200">{formatCurrency(approvedPartsTotal)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Selected Labor</span>
              <span className="font-mono text-slate-200">{formatCurrency(approvedLaborTotal)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Estimated Sales Tax ({estimate.taxRatePercent}%)</span>
              <span className="font-mono text-slate-200">{formatCurrency(taxTotal)}</span>
            </div>
            <div className="border-t border-slate-800 pt-2 flex justify-between items-center text-sm font-extrabold text-white">
              <span>Authorized Total</span>
              <span className="font-mono text-emerald-400 text-lg">{formatCurrency(approvedGrandTotal)}</span>
            </div>
          </div>

          {/* Approval Actions */}
          {estimate.status === 'approved' ? (
            <div className="bg-emerald-950/50 border border-emerald-500/40 rounded-2xl p-5 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-emerald-300">You Approved This Repair Estimate</h4>
              <p className="text-xs text-slate-300">
                Signed by <span className="font-serif italic font-bold text-white">{estimate.customerSignature}</span> on {new Date(estimate.customerResponseDate || '').toLocaleDateString()}.
              </p>
              <p className="text-[11px] text-slate-400">
                The technician has been notified and parts have been dispatched for installation.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={() => setIsSignModalOpen(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl text-sm transition cursor-pointer shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
              >
                <PenTool className="w-4 h-4" />
                <span>Authorize & Approve Repairs ({formatCurrency(approvedGrandTotal)})</span>
              </button>

              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <button
                  onClick={handleDecline}
                  className="hover:text-red-400 transition cursor-pointer"
                >
                  Decline Estimate
                </button>
                <a
                  href={`tel:${estimate.shopPhone}`}
                  className="hover:text-blue-400 transition cursor-pointer"
                >
                  Questions? Call Shop at {estimate.shopPhone}
                </a>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Digital Signature & Approval Modal */}
      {isSignModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <PenTool className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Digital Repair Authorization</h3>
              </div>
              <button
                onClick={() => setIsSignModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApproveEstimate} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Customer Signature (Type Full Legal Name) *
                </label>
                <input
                  type="text"
                  required
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  placeholder="e.g. Marcus Vance"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-serif text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Optional Notes / Special Instructions for Shop
                </label>
                <textarea
                  rows={2}
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="e.g. Please save the worn brake pads so I can look at them."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 text-[11px] text-slate-400">
                <div className="flex justify-between font-bold text-slate-200">
                  <span>Authorized Grand Total</span>
                  <span className="font-mono text-emerald-400 text-xs">{formatCurrency(approvedGrandTotal)}</span>
                </div>
                <p className="text-[10px] leading-relaxed text-slate-400 pt-1">
                  By clicking approve, I authorize {estimate.shopName} to perform the selected repair operations and install the specified parts on my {estimate.vehicle.year} {estimate.vehicle.make} {estimate.vehicle.model}.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="agree-check"
                  checked={hasAgreedTerms}
                  onChange={(e) => setHasAgreedTerms(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 accent-emerald-500 cursor-pointer"
                />
                <label htmlFor="agree-check" className="text-[11px] text-slate-300 cursor-pointer">
                  I agree to the repair terms and authorized cost.
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSignModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!hasAgreedTerms || !signatureName.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-lg transition cursor-pointer shadow-lg shadow-emerald-600/20"
                >
                  Submit Approval & Signature
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
