/**
 * Helper utilities for video recording, thumbnail generation, and sample walkaround clips.
 */

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Creates an animated canvas video stream for demo testing when no webcam or file is available.
 * Draws an authentic automotive diagnostic walkaround overlay.
 */
export async function generateSyntheticInspectionVideo(
  vehicleName: string,
  mechanicName: string,
  durationSec = 6
): Promise<{ blob: Blob; url: string; duration: number }> {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Set up MediaStream from canvas
  const stream = canvas.captureStream(30); // 30 FPS
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm',
  });

  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const framesTotal = durationSec * 30;
  let frame = 0;

  return new Promise((resolve) => {
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      resolve({ blob, url, duration: durationSec });
    };

    mediaRecorder.start();

    const interval = setInterval(() => {
      const progress = frame / framesTotal;
      const currentSec = (frame / 30).toFixed(1);

      // Background bay scene simulation
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, '#111827');
      grad.addColorStop(1, '#030712');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw simulated lift/under-chassis grid
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Animated mechanical diagnostic target
      const rotorX = 220 + Math.sin(frame * 0.05) * 20;
      const rotorY = 180 + Math.cos(frame * 0.04) * 10;
      
      // Draw simulated brake rotor / component
      ctx.save();
      ctx.translate(rotorX, rotorY);
      ctx.beginPath();
      ctx.arc(0, 0, 75, 0, Math.PI * 2);
      ctx.fillStyle = '#334155';
      ctx.fill();
      ctx.lineWidth = 8;
      ctx.strokeStyle = frame % 20 < 10 ? '#ef4444' : '#f97316';
      ctx.stroke();

      // Rotor vent slots
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4 + frame * 0.02;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 25, Math.sin(angle) * 25);
        ctx.lineTo(Math.cos(angle) * 60, Math.sin(angle) * 60);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#64748b';
        ctx.stroke();
      }
      ctx.restore();

      // Digital caliper measurement overlay
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(360, 110, 240, 140);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(362, 112, 236, 136);

      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = '#ef4444';
      ctx.fillText('DIAGNOSTIC TELEMETRY', 376, 135);
      
      ctx.font = '16px monospace';
      ctx.fillStyle = '#f87171';
      ctx.fillText(`PAD THICKNESS: ${(2.1 - progress * 0.3).toFixed(2)} mm`, 376, 168);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px sans-serif';
      ctx.fillText('CRITICAL: Below 3.0mm legal minimum', 376, 190);
      ctx.fillText('ROTOR RUNOUT: 0.007" (Spec max: 0.002")', 376, 210);
      ctx.fillText('PULSE VIBRATION DETECTED', 376, 230);

      // HUD Header
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(0, 0, canvas.width, 42);

      // REC indicator with blinking dot
      if (Math.floor(frame / 15) % 2 === 0) {
        ctx.beginPath();
        ctx.arc(20, 21, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
      }
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('REC', 34, 25);

      ctx.font = '11px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`TIME: 00:0${currentSec}`, 72, 25);
      ctx.fillText(`VEHICLE: ${vehicleName}`, 190, 25);
      ctx.fillText(`TECH: ${mechanicName}`, 470, 25);

      // Audio waveform simulation at bottom
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.fillRect(0, canvas.height - 32, canvas.width, 32);
      ctx.fillStyle = '#38bdf8';
      for (let i = 0; i < 40; i++) {
        const barH = 4 + Math.sin(frame * 0.2 + i * 0.6) * 10 + Math.random() * 6;
        ctx.fillRect(20 + i * 14, canvas.height - 16 - barH / 2, 8, barH);
      }
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '10px sans-serif';
      ctx.fillText('🎙️ "Customer noticed steering vibration during highway braking..."', 600 - 380, canvas.height - 12);

      frame++;
      if (frame >= framesTotal) {
        clearInterval(interval);
        mediaRecorder.stop();
      }
    }, 1000 / 30);
  });
}
