/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Estimate } from './types/estimate';
import { INITIAL_ESTIMATES } from './data/sampleEstimates';
import { Header } from './components/Header';
import { MechanicBayView } from './components/MechanicBayView';
import { CustomerPortalView } from './components/CustomerPortalView';
import { GcpGoBlueprintView } from './components/GcpGoBlueprintView';
import { NewEstimateModal } from './components/NewEstimateModal';
import { generateSyntheticInspectionVideo } from './utils/videoUtils';

const STORAGE_KEY = 'autolens_estimates_v1';

export default function App() {
  const [estimates, setEstimates] = useState<Estimate[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load local estimates:', e);
    }
    return INITIAL_ESTIMATES;
  });

  const [selectedEstimateId, setSelectedEstimateId] = useState<string>(() => {
    // Check URL params for direct link to an estimate
    const params = new URLSearchParams(window.location.search);
    const estParam = params.get('est');
    if (estParam) return estParam;
    return INITIAL_ESTIMATES[0]?.id || '';
  });

  const [currentTab, setCurrentTab] = useState<'mechanic' | 'customer' | 'blueprint'>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'customer') return 'customer';
    if (params.get('view') === 'blueprint') return 'blueprint';
    return 'mechanic';
  });

  const [isNewEstimateOpen, setIsNewEstimateOpen] = useState(false);

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(estimates));
    } catch (e) {
      console.warn('Failed to save to local storage:', e);
    }
  }, [estimates]);

  // Ensure initial samples have working video streams if url is blank
  useEffect(() => {
    let isMounted = true;
    const generateDemoVideos = async () => {
      let changed = false;
      const updated = await Promise.all(
        estimates.map(async (est) => {
          if (est.video && !est.video.url) {
            try {
              const res = await generateSyntheticInspectionVideo(
                `${est.vehicle.year} ${est.vehicle.make} ${est.vehicle.model}`,
                est.mechanicName,
                est.video.durationSeconds || 6
              );
              changed = true;
              return {
                ...est,
                video: {
                  ...est.video,
                  url: res.url,
                },
              };
            } catch (err) {
              console.warn('Error generating demo video:', err);
              return est;
            }
          }
          return est;
        })
      );

      if (changed && isMounted) {
        setEstimates(updated);
      }
    };

    generateDemoVideos();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedEstimate =
    estimates.find((e) => e.id === selectedEstimateId) || estimates[0];

  const handleUpdateEstimate = (updated: Estimate) => {
    setEstimates((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
  };

  const handleSaveNewEstimate = (newEst: Estimate) => {
    setEstimates((prev) => [newEst, ...prev]);
    setSelectedEstimateId(newEst.id);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      
      {/* Top Navigation */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        estimates={estimates}
        selectedEstimateId={selectedEstimateId}
        setSelectedEstimateId={setSelectedEstimateId}
        onOpenNewEstimate={() => setIsNewEstimateOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {currentTab === 'mechanic' && selectedEstimate && (
          <MechanicBayView
            estimates={estimates}
            selectedEstimate={selectedEstimate}
            onSelectEstimate={setSelectedEstimateId}
            onUpdateEstimate={handleUpdateEstimate}
            onOpenNewEstimate={() => setIsNewEstimateOpen(true)}
            onSwitchToCustomerView={() => setCurrentTab('customer')}
          />
        )}

        {currentTab === 'customer' && selectedEstimate && (
          <CustomerPortalView
            estimate={selectedEstimate}
            onUpdateEstimate={handleUpdateEstimate}
            onBackToMechanic={() => setCurrentTab('mechanic')}
          />
        )}

        {currentTab === 'blueprint' && <GcpGoBlueprintView />}
      </main>

      {/* New Estimate Creation Modal */}
      <NewEstimateModal
        isOpen={isNewEstimateOpen}
        onClose={() => setIsNewEstimateOpen(false)}
        onSave={handleSaveNewEstimate}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            AutoLens Repair Estimates &middot; Architecture: Go net/http + HTMX + Cloud Storage Direct Upload + Firestore
          </p>
          <div className="flex items-center gap-4 text-[11px]">
            <button
              onClick={() => setCurrentTab('blueprint')}
              className="text-purple-400 hover:text-purple-300 transition cursor-pointer"
            >
              Export Go + GCS Backend
            </button>
            <span className="text-slate-700">&middot;</span>
            <span className="text-slate-400">Google Cloud Ready</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
