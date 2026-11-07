import React from 'react';
import { Wrench, Video, Smartphone, Code2, PlusCircle, Car, ShieldCheck } from 'lucide-react';
import { Estimate } from '../types/estimate';

interface HeaderProps {
  currentTab: 'mechanic' | 'customer' | 'blueprint';
  setCurrentTab: (tab: 'mechanic' | 'customer' | 'blueprint') => void;
  estimates: Estimate[];
  selectedEstimateId: string;
  setSelectedEstimateId: (id: string) => void;
  onOpenNewEstimate: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  estimates,
  selectedEstimateId,
  setSelectedEstimateId,
  onOpenNewEstimate,
}) => {
  const selectedEstimate = estimates.find((e) => e.id === selectedEstimateId) || estimates[0];

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 border border-blue-400/30">
              <Video className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-white flex items-center gap-1.5">
                  AutoLens <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">Video Bay</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                GCP Cloud Storage &middot; Firestore &middot; Go + HTMX Architecture
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-sm">
            <button
              onClick={() => setCurrentTab('mechanic')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                currentTab === 'mechanic'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Wrench className="w-4 h-4" />
              <span className="hidden md:inline">Mechanic Bay</span>
            </button>

            <button
              onClick={() => setCurrentTab('customer')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                currentTab === 'customer'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span className="hidden md:inline">Customer Review Portal</span>
              <span className="text-xs bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded-md hidden lg:inline">
                Live Link
              </span>
            </button>

            <button
              onClick={() => setCurrentTab('blueprint')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                currentTab === 'blueprint'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-4 h-4" />
              <span className="hidden md:inline">Go + GCP Blueprint</span>
              <span className="text-xs bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-md">
                GCS / HTMX
              </span>
            </button>
          </div>

          {/* Right Action: Active Estimate Selector & New Button */}
          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-lg">
              <Car className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedEstimateId}
                onChange={(e) => setSelectedEstimateId(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-none cursor-pointer max-w-[160px] truncate"
              >
                {estimates.map((est) => (
                  <option key={est.id} value={est.id} className="bg-slate-900 text-slate-200">
                    {est.vehicle.year} {est.vehicle.model} ({est.customerName})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={onOpenNewEstimate}
              className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-3.5 py-1.5 rounded-lg text-sm font-semibold shadow-md shadow-blue-600/20 transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">New Estimate</span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
