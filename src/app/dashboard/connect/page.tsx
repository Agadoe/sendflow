'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function ConnectPage() {
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check wacli connection status
    fetch('/api/wacli/status')
      .then(r => r.json())
      .then(d => setConnected(d.connected || false))
      .catch(() => setConnected(false))
      .finally(() => setChecking(false));
  }, []);

  async function handleConnect() {
    toast.loading('Opening WhatsApp connection wizard...', { id: 'connect' });
    try {
      const res = await fetch('/api/wacli/connect', { method: 'POST' });
      const data = await res.json();
      toast.dismiss('connect');
      if (data.qr) {
        // Show QR code
        setConnected(false);
      } else if (data.success) {
        setConnected(true);
        toast.success('WhatsApp connected successfully!');
      }
    } catch {
      toast.dismiss('connect');
      toast.error('Connection failed');
    }
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect this WhatsApp number? Your campaigns will stop sending.')) return;
    await fetch('/api/wacli/disconnect', { method: 'POST' }).catch(() => {});
    setConnected(false);
    toast.success('Disconnected');
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl text-slate">WhatsApp Connection</h1>
        <p className="text-sm text-slate-light mt-0.5">Connect your WhatsApp number to start sending messages</p>
      </div>

      <div className="bg-surface rounded-card border border-gray-100 p-8">
        {checking ? (
          <div className="flex items-center gap-3 text-slate-light">
            <span className="w-4 h-4 border-2 border-amber/30 border-t-amber rounded-full animate-spin" />
            Checking connection...
          </div>
        ) : connected ? (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-7 h-7 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.11.547 4.11 1.497 5.84L0 24l6.335-1.663A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-heading text-xl text-slate">WhatsApp Connected</h3>
                  <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    Active
                  </span>
                </div>
                <p className="text-sm text-slate-light mt-1">Your WhatsApp is ready to send messages</p>
              </div>
            </div>

            <div className="bg-green-50 border border-green-100 rounded-lg px-4 py-3 text-sm">
              ✅ All systems operational — you can start creating and sending campaigns
            </div>

            <button
              onClick={handleDisconnect}
              className="text-sm text-red-500 hover:text-red-600 font-medium transition-colors"
            >
              Disconnect WhatsApp →
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-amber/10 flex items-center justify-center">
                <svg className="w-7 h-7 text-amber" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.11.547 4.11 1.497 5.84L0 24l6.335-1.663A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-heading text-xl text-slate">Not connected</h3>
                <p className="text-sm text-slate-light mt-1">Connect your WhatsApp to enable message sending</p>
              </div>
            </div>

            <div className="bg-amber/5 border border-amber/10 rounded-lg p-4 text-sm text-slate space-y-2">
              <div className="font-semibold text-amber">How it works:</div>
              <div className="flex items-start gap-2">
                <span className="text-amber font-bold">1.</span> Click &quot;Connect WhatsApp&quot; below to start
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber font-bold">2.</span> A QR code will appear — scan it with your phone
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber font-bold">3.</span> Your WhatsApp stays connected 24/7 on our server
              </div>
            </div>

            <button
              onClick={handleConnect}
              className="w-full py-3 bg-amber hover:bg-amber-dark text-white font-semibold rounded-btn transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              Connect WhatsApp
            </button>
          </div>
        )}
      </div>
    </div>
  );
}