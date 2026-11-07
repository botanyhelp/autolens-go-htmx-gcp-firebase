import React, { useState } from 'react';
import { X, Plus, Trash2, Camera, Car, DollarSign, AlertTriangle, ShieldCheck, CheckCircle2, Wrench } from 'lucide-react';
import { Estimate, PartItem, LaborItem, UrgencyLevel, VideoReview } from '../types/estimate';
import { formatCurrency } from '../utils/videoUtils';
import { VideoRecorderModal } from './VideoRecorderModal';

interface NewEstimateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (estimate: Estimate) => void;
}

export const NewEstimateModal: React.FC<NewEstimateModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [year, setYear] = useState<number>(2022);
  const [make, setMake] = useState('Honda');
  const [model, setModel] = useState('Civic Sport');
  const [licensePlate, setLicensePlate] = useState('6TRK491');
  const [mileage, setMileage] = useState<number>(42000);
  const [urgency, setUrgency] = useState<UrgencyLevel>('safety_critical');
  const [mechanicName, setMechanicName] = useState('Dave Miller (Master Tech)');
  const [notes, setNotes] = useState(
    'Front suspension strut mount bushing has excessive axial play causing thumping over bumps. Outer tie rod end boots are degraded.'
  );

  const [parts, setParts] = useState<PartItem[]>([
    {
      id: 'p-new-1',
      name: 'Front Quick-Strut Assembly (Pair)',
      partNumber: '172901',
      quantity: 2,
      unitCost: 165.00,
      approved: true,
      required: true,
    },
    {
      id: 'p-new-2',
      name: 'Outer Tie Rod Ends',
      partNumber: 'ES80098',
      quantity: 2,
      unitCost: 42.50,
      approved: true,
      required: false,
    },
  ]);

  const [labor, setLabor] = useState<LaborItem[]>([
    {
      id: 'l-new-1',
      description: 'Remove & Replace Front Strut Assemblies & Hardware',
      hours: 2.2,
      hourlyRate: 145.00,
      approved: true,
      required: true,
    },
    {
      id: 'l-new-2',
      description: 'Four-Wheel Computerized Alignment',
      hours: 1.0,
      hourlyRate: 145.00,
      approved: true,
      required: true,
    },
  ]);

  const [taxRate, setTaxRate] = useState(7.75);
  const [video, setVideo] = useState<VideoReview | undefined>(undefined);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);

  // Calculations
  const partsSubtotal = parts.reduce((acc, p) => acc + p.quantity * p.unitCost, 0);
  const laborSubtotal = labor.reduce((acc, l) => acc + l.hours * l.hourlyRate, 0);
  const taxAmount = (partsSubtotal * taxRate) / 100;
  const grandTotal = partsSubtotal + laborSubtotal + taxAmount;

  const handleAddPart = () => {
    setParts((prev) => [
      ...prev,
      {
        id: 'p-' + Math.random().toString(36).substring(2, 7),
        name: 'New Replacement Part',
        quantity: 1,
        unitCost: 50.0,
        approved: true,
        required: false,
      },
    ]);
  };

  const handleRemovePart = (id: string) => {
    setParts((prev) => prev.filter((p) => p.id !== id));
  };

  const handleAddLabor = () => {
    setLabor((prev) => [
      ...prev,
      {
        id: 'l-' + Math.random().toString(36).substring(2, 7),
        description: 'Mechanical Labor Operation',
        hours: 1.0,
        hourlyRate: 145.0,
        approved: true,
        required: false,
      },
    ]);
  };

  const handleRemoveLabor = (id: string) => {
    setLabor((prev) => prev.filter((l) => l.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !phone) return;

    const newEstimate: Estimate = {
      id: 'est-' + Math.floor(1000 + Math.random() * 9000),
      estimateNumber: `EST-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName,
      email: email || `${customerName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      phone,
      vehicle: {
        year: Number(year),
        make,
        model,
        licensePlate,
        mileage: Number(mileage),
      },
      urgency,
      mechanicName,
      shopName: 'Apex Motor Works & Diagnostics',
      shopPhone: '(555) 742-8800',
      shopAddress: '1420 Industrial Pkwy, Suite 4B',
      notes,
      partsItems: parts,
      laborItems: labor,
      taxRatePercent: taxRate,
      video: video,
      status: 'awaiting_customer',
      createdAt: new Date().toISOString(),
    };

    onSave(newEstimate);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
          
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                <Wrench className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Create Repair Estimate Record</h3>
                <p className="text-xs text-slate-400">Stores customer info in Firestore & walkaround video in Cloud Storage</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
            
            {/* Customer & Vehicle Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Customer Box */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <span>Customer Details</span>
                </h4>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Customer Full Name *</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Rachel Miller"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 234-5678"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Email (Optional)</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="rachel@example.com"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Vehicle Box */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Car className="w-3.5 h-3.5 text-blue-400" />
                  <span>Vehicle Specifications</span>
                </h4>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Year</label>
                    <input
                      type="number"
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Make</label>
                    <input
                      type="text"
                      value={make}
                      onChange={(e) => setMake(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Model</label>
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Plate / VIN</label>
                    <input
                      type="text"
                      value={licensePlate}
                      onChange={(e) => setLicensePlate(e.target.value)}
                      placeholder="6TRK491"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Odometer</label>
                    <input
                      type="number"
                      value={mileage}
                      onChange={(e) => setMileage(Number(e.target.value))}
                      placeholder="42,000"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Video Attachment Banner */}
            <div className="bg-gradient-to-r from-blue-900/30 to-indigo-900/20 border border-blue-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-300">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                    Walkaround Video Review
                    {video ? (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-medium">
                        Attached ({video.fileSizeFormatted})
                      </span>
                    ) : (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-medium">
                        Recommended
                      </span>
                    )}
                  </h5>
                  <p className="text-[11px] text-slate-400">
                    {video
                      ? `File: ${video.fileName} with ${video.chapters?.length || 0} pinned key moments.`
                      : 'Record live camera walkaround or upload video clip to send to customer.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsRecordModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{video ? 'Re-record / Change Video' : 'Capture Walkaround Video'}</span>
              </button>
            </div>

            {/* Diagnostic Notes & Urgency */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Mechanic Diagnostic & Inspection Findings
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Inspection Priority</label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as UrgencyLevel)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="safety_critical">🔴 Immediate Safety Critical</option>
                  <option value="recommended_soon">🟡 Recommended Soon</option>
                  <option value="routine_maintenance">🟢 Routine Maintenance</option>
                </select>

                <div className="mt-2">
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Technician</label>
                  <input
                    type="text"
                    value={mechanicName}
                    onChange={(e) => setMechanicName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Itemized Parts Section */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Parts Estimate Breakdown</h4>
                  <p className="text-[11px] text-slate-400">Subtotal: {formatCurrency(partsSubtotal)}</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddPart}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-blue-400 px-2.5 py-1 rounded-md flex items-center gap-1 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Part</span>
                </button>
              </div>

              <div className="space-y-2">
                {parts.map((p, idx) => (
                  <div key={p.id} className="grid grid-cols-12 gap-2 items-center bg-slate-900/80 p-2 rounded-lg border border-slate-800 text-xs">
                    <div className="col-span-5">
                      <input
                        type="text"
                        value={p.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setParts((list) => list.map((item) => (item.id === p.id ? { ...item, name: val } : item)));
                        }}
                        placeholder="Part description"
                        className="w-full bg-transparent border-b border-slate-700 focus:border-blue-500 text-slate-200 px-1 py-0.5 focus:outline-none text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="1"
                        value={p.quantity}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value) || 1);
                          setParts((list) => list.map((item) => (item.id === p.id ? { ...item, quantity: val } : item)));
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-slate-200 text-center text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        step="0.01"
                        value={p.unitCost}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setParts((list) => list.map((item) => (item.id === p.id ? { ...item, unitCost: val } : item)));
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-slate-200 text-right text-xs"
                      />
                    </div>
                    <div className="col-span-2 text-right font-mono font-semibold text-slate-300">
                      {formatCurrency(p.quantity * p.unitCost)}
                    </div>
                    <div className="col-span-1 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemovePart(p.id)}
                        className="text-slate-500 hover:text-red-400 p-1 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Itemized Labor Section */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Labor Estimate Breakdown</h4>
                  <p className="text-[11px] text-slate-400">Subtotal: {formatCurrency(laborSubtotal)}</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddLabor}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-blue-400 px-2.5 py-1 rounded-md flex items-center gap-1 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Labor Operation</span>
                </button>
              </div>

              <div className="space-y-2">
                {labor.map((l, idx) => (
                  <div key={l.id} className="grid grid-cols-12 gap-2 items-center bg-slate-900/80 p-2 rounded-lg border border-slate-800 text-xs">
                    <div className="col-span-5">
                      <input
                        type="text"
                        value={l.description}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLabor((list) => list.map((item) => (item.id === l.id ? { ...item, description: val } : item)));
                        }}
                        placeholder="Labor operation"
                        className="w-full bg-transparent border-b border-slate-700 focus:border-blue-500 text-slate-200 px-1 py-0.5 focus:outline-none text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.1"
                          value={l.hours}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setLabor((list) => list.map((item) => (item.id === l.id ? { ...item, hours: val } : item)));
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-slate-200 text-center text-xs"
                        />
                        <span className="text-[10px] text-slate-500">hrs</span>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-500">$</span>
                        <input
                          type="number"
                          value={l.hourlyRate}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setLabor((list) => list.map((item) => (item.id === l.id ? { ...item, hourlyRate: val } : item)));
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-slate-200 text-right text-xs"
                        />
                      </div>
                    </div>
                    <div className="col-span-2 text-right font-mono font-semibold text-slate-300">
                      {formatCurrency(l.hours * l.hourlyRate)}
                    </div>
                    <div className="col-span-1 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveLabor(l.id)}
                        className="text-slate-500 hover:text-red-400 p-1 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Summary Footer Box */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-6 text-xs">
                <div>
                  <span className="text-slate-400 block">Parts Total</span>
                  <span className="font-mono font-semibold text-white">{formatCurrency(partsSubtotal)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Labor Total</span>
                  <span className="font-mono font-semibold text-white">{formatCurrency(laborSubtotal)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Tax ({taxRate}%)</span>
                  <span className="font-mono font-semibold text-white">{formatCurrency(taxAmount)}</span>
                </div>
                <div className="border-l border-slate-800 pl-4">
                  <span className="text-slate-400 block">Total Estimate</span>
                  <span className="font-mono text-base font-bold text-emerald-400">{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition cursor-pointer shadow-lg shadow-blue-600/20 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save & Generate Customer Link</span>
                </button>
              </div>
            </div>

          </form>
        </div>
      </div>

      {/* Video Recorder Modal */}
      <VideoRecorderModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onVideoReady={(vid) => setVideo(vid)}
        vehicleName={`${year} ${make} ${model}`}
        customerName={customerName || 'Customer'}
        mechanicName={mechanicName}
      />
    </>
  );
};
