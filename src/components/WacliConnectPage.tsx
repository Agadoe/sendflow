'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';

type WacliState = 'DISCONNECTED' | 'QR_READY' | 'CONNECTED' | 'ERROR' | string;

export default function WacliConnectPage() {
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [state, setState] = useState<WacliState>('DISCONNECTED');
  const [phone, setPhone] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  // Poll /status while showing QR — daemon transitions QR_READY → CONNECTED after scan
  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(() => {
      checkStatus(true);
    }, 2000);
    return () => clearInterval(interval);
  }, [polling]);

  async function checkStatus(silent = false) {
    try {
      const res = await fetch('/api/wacli/status', { cache: 'no-store' });
      if (res.status === 401) {
        if (!silent) toast.error('Session expired — please sign in again');
        return;
      }
      const data = await res.json();
      setState(data.state || 'DISCONNECTED');
      setPhone(data.phone || null);
      setConnected(data.connected === true);
      if (data.connected) {
        setQrCode(null);
        setPolling(false);
        if (!silent) toast.success('WhatsApp connected');
      }
    } catch {
      if (!silent) toast.error('Could not reach wacli daemon');
    } finally {
      setChecking(false);
    }
  }

  async function handleConnect() {
    toast.loading('Opening WhatsApp connection wizard…', { id: 'connect' });
    try {
      const res = await fetch('/api/wacli/connect', { method: 'POST' });
      const data = await res.json();
      toast.dismiss('connect');

      if (res.status === 401) {
        toast.error('Session expired — please sign in again');
        return;
      }
      if (!res.ok) {
        toast.error(data.error || 'Connection failed');
        return;
      }

      // Fetch the QR — daemon takes a moment to generate one after /connect
      toast.loading('Generating QR code…', { id: 'qr' });
      await new Promise((r) => setTimeout(r, 2000));
      const qrRes = await fetch('/api/wacli/connect', { cache: 'no-store' });
      const qrData = await qrRes.json();
      toast.dismiss('qr');
      if (!qrRes.ok) {
        toast.error(qrData.error || 'Failed to fetch QR');
        return;
      }

      if (qrData.qr) {
        const dataUrl = await QRCode.toDataURL(qrData.qr, {
          width: 280,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
        });
        setQrDataUrl(dataUrl);
        setQrCode(qrData.qr);
        setState('QR_READY');
        setPolling(true);
        toast.success('Scan the QR with your phone — we’ll detect it automatically');
      } else if (qrData.state === 'CONNECTED') {
        setConnected(true);
        setQrCode(null);
        setPolling(false);
        toast.success('WhatsApp connected');
      } else {
        toast.error('Could not generate QR — try again in a moment');
      }
    } catch {
      toast.dismiss('connect');
      toast.error('Connection failed');
    }
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect this WhatsApp number? Your campaigns will stop sending.')) return;
    try {
      await fetch('/api/wacli/disconnect', { method: 'POST' });
      setConnected(false);
      setQrCode(null);
      setPolling(false);
      setState('DISCONNECTED');
      toast.success('Disconnected');
    } catch {
      toast.error('Disconnect failed');
    }
  }

  if (checking) {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="font-heading text-2xl text-slate">WhatsApp Connection</h1>
          <p className="text-sm text-slate-light mt-0.5">Connect your WhatsApp number to start sending messages</p>
        </div>
        <div className="bg-surface rounded-card border border-gray-100 p-8">
          <div className="flex items-center gap-3 text-slate-light">
            <span className="w-4 h-4 border-2 border-amber/30 border-t-amber rounded-full animate-spin" />
            Checking connection…
          </div>
        </div>
      </div>
    );
  }

  if (connected) {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="font-heading text-2xl text-slate">WhatsApp Connection</h1>
          <p className="text-sm text-slate-light mt-0.5">Connect your WhatsApp number to start sending messages</p>
        </div>
        <div className="bg-surface rounded-card border border-gray-100 p-8">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <span className="text-2xl">✅</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-heading text-xl text-slate">WhatsApp Connected</h3>
                  <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    Active
                  </span>
                </div>
                <p className="text-sm text-slate-light mt-1">
                  {phone ? `Connected as ${phone}` : 'Your WhatsApp is ready to send messages'}
                </p>
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
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl text-slate">WhatsApp Connection</h1>
        <p className="text-sm text-slate-light mt-0.5">Connect your WhatsApp number to start sending messages</p>
      </div>

      <div className="bg-surface rounded-card border border-gray-100 p-8">
        {qrCode ? (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-amber/10 flex items-center justify-center">
                <span className="text-2xl">📱</span>
              </div>
              <div>
                <h3 className="font-heading text-xl text-slate">Scan this QR with your phone</h3>
                <p className="text-sm text-slate-light mt-1">
                  Open WhatsApp → Settings → Linked Devices → Link a Device
                </p>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col items-center gap-3">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="WhatsApp QR Code" className="w-64 h-64" />
              ) : (
                <div className="w-64 h-64 bg-gray-50 animate-pulse rounded flex items-center justify-center text-sm text-gray-400">Generating…</div>
              )}
              <div className="text-xs text-amber font-medium">Waiting for scan…</div>
              <div className="flex items-center gap-2 text-xs text-slate-light">
                <span className="w-2 h-2 border-2 border-amber/30 border-t-amber rounded-full animate-spin" />
                Auto-detecting — this page will update when you scan
              </div>
            </div>

            <div className="text-xs text-slate-light text-center">
              QR expires in ~60 seconds. If it does, click the button below to regenerate.
            </div>

            <button
              onClick={handleConnect}
              className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-slate font-medium rounded-btn transition-colors text-sm"
            >
              Regenerate QR
            </button>

            <button
              onClick={() => { setQrCode(null); setPolling(false); }}
              className="block mx-auto text-xs text-slate-light hover:text-slate"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-amber/10 flex items-center justify-center">
                <span className="text-2xl">📱</span>
              </div>
              <div>
                <h3 className="font-heading text-xl text-slate">Not connected</h3>
                <p className="text-sm text-slate-light mt-1">
                  Connect your WhatsApp to enable message sending
                </p>
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
