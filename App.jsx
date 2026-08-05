import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from './supabaseClient.js';
import { currentUser } from './currentUser.js';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  LayoutDashboard, Users, Scale as ScaleIcon, Wallet, FileBarChart, Warehouse, Settings as SettingsIcon,
  Plus, Printer, Bluetooth, BluetoothConnected, Search, X, Phone, ChevronRight, Download, Package, ShoppingCart, Clock as ClockIcon,
  Receipt, Banknote, ListChecks, Upload, MessageCircle, Truck, Contact as IdCard, Menu,
  Wrench, Fuel, FileText, ShieldAlert, AlertTriangle, Disc, TrendingUp, Gauge, CalendarClock,
  Sparkles, AlertOctagon, UserCheck, Archive, Target, Radar, RefreshCw, Trash2, Mic, MicOff, Send, Bot, Bell, Pencil,
} from 'lucide-react';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const todayStr = () => new Date().toISOString().slice(0, 10);

// Ayarlar sayfasından değiştirilebilen, tüm dosyada paylaşılan biçimlendirme durumu.
// React state değil çünkü fmtTL/fmtDate gibi yardımcılar yüzlerce yerde çağrılıyor;
// bunun yerine değerler mutasyona uğratılır ve React'in normal render döngüsü
// (ayarlar değiştiğinde tetiklenen re-render) yeni değerleri otomatik yansıtır.
const CURRENCY_CODE_MAP = { '₺': 'TRY', '$': 'USD', '€': 'EUR' };
let FORMAT_STATE = { currencySymbol: '₺', dateFormat: 'DMY' };

const fmtTL = (n) => (Number(n) || 0).toLocaleString('tr-TR', { style: 'currency', currency: CURRENCY_CODE_MAP[FORMAT_STATE.currencySymbol] || 'TRY', maximumFractionDigits: 2 });
const fmtKg = (n) => (Number(n) || 0).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + ' kg';
const fmtDate = (d) => {
  const date = new Date(d);
  if (FORMAT_STATE.dateFormat === 'YMD') return date.toLocaleDateString('sv-SE');
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const fmtDateShort = (d) => new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });

// Bu proje bagimsiz calistigi icin Claude artifact ortamindaki window.storage
// yerine Supabase (gercek Postgres veritabani) kullanir. Her satir giris yapan
// kullanicinin e-postasina (owner_email) baglidir, boylece her hesap sadece
// kendi verisini gorur/degistirir.
async function storageGet(key) {
  try {
    const { data, error } = await supabase.from('app_data').select('value').eq('key', key).eq('owner_email', currentUser.email).maybeSingle();
    if (error) { console.error('Depolama okuma hatasi:', error); return null; }
    return data ? data.value : null;
  } catch (e) {
    console.error('Depolama okuma hatasi:', e);
    return null;
  }
}
async function storageSet(key, value) {
  try {
    const { error } = await supabase.from('app_data').upsert({ key, value, owner_email: currentUser.email, updated_at: new Date().toISOString() });
    if (error) console.error('Depolama yazma hatasi:', error);
  } catch (e) {
    console.error('Depolama yazma hatasi:', e);
  }
}

const COLORS = {
  ink: '#2B2A25',
  inkSoft: '#5B5A50',
  paper: '#F3F0E6',
  paperCard: '#FFFFFF',
  border: '#DCD6C4',
  olive: '#3F4A2E',
  oliveLight: '#6B7A4F',
  oliveSoft: '#E7EBDC',
  gold: '#B3892B',
  goldSoft: '#F4E9D2',
  red: '#A13D2E',
  redSoft: '#F6E4DF',
  blue: '#3B5E73',
  blueSoft: '#E1EAEE',
};

const THEME_PRESETS = {
  light: { paper: '#F3F0E6', paperCard: '#FFFFFF', ink: '#2B2A25', inkSoft: '#5B5A50', border: '#DCD6C4', olive: '#3F4A2E', oliveSoft: '#E7EBDC' },
  dark: { paper: '#1B1E17', paperCard: '#242822', ink: '#EDEAE0', inkSoft: '#A9A79C', border: '#3A3E33', olive: '#5C6B44', oliveSoft: '#2E3527' },
  navy: { paper: '#101826', paperCard: '#182338', ink: '#E7ECF5', inkSoft: '#9AA7BD', border: '#2A374D', olive: '#2E4A6E', oliveSoft: '#1C2E45' },
  highContrast: { paper: '#000000', paperCard: '#0D0D0D', ink: '#FFFFFF', inkSoft: '#D8D8D8', border: '#FFFFFF', olive: '#00A86B', oliveSoft: '#003D26' },
};

function applyAppearance(settings) {
  const preset = THEME_PRESETS[settings.theme] || THEME_PRESETS.light;
  Object.assign(COLORS, preset);
  if (settings.accentColor) COLORS.gold = settings.accentColor;
  FORMAT_STATE = { currencySymbol: settings.currencySymbol || '₺', dateFormat: settings.dateFormat || 'DMY' };
}

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');
      :root { --font-display: 'Fraunces', Georgia, serif; --font-body: 'Inter', -apple-system, 'Segoe UI', sans-serif; }
      .zk-app { font-family: var(--font-body); color: ${COLORS.ink}; background: ${COLORS.paper}; min-height: 100vh; }
      .zk-shell { display: flex; min-height: 100vh; }
      .zk-sidebar { width: 216px; background: ${COLORS.olive}; flex-shrink: 0; padding: 22px 12px; display: flex; flex-direction: column; gap: 3px; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
      .zk-brand-row { display: flex; align-items: center; gap: 9px; padding: 0 10px; margin-bottom: 2px; }
      .zk-brand { color: #F5F2E8; font-family: var(--font-display); font-size: 19px; font-weight: 600; letter-spacing: 0.2px; }
      .zk-brand-sub { color: #A9B896; font-size: 10.5px; padding: 0 10px; margin-bottom: 24px; letter-spacing: 0.6px; text-transform: uppercase; }
      .zk-navbtn { display: flex; align-items: center; gap: 10px; padding: 9px 11px; border-radius: 8px; background: transparent; border: none; border-left: 2px solid transparent; color: #C9D2B9; font-size: 13px; font-weight: 500; cursor: pointer; text-align: left; width: 100%; transition: background 0.12s ease, color 0.12s ease; }
      .zk-sidebar-compact .zk-navbtn { padding: 6px 11px; font-size: 12px; gap: 8px; }
      .zk-sidebar-compact .zk-brand-sub { margin-bottom: 14px; }
      .zk-navbtn:hover { background: rgba(255,255,255,0.07); color: #F5F2E8; }
      .zk-navbtn.active { background: rgba(255,255,255,0.13); color: #fff; border-left: 2px solid ${COLORS.gold}; }
      .zk-main { flex: 1; padding: 28px 32px; max-width: 1180px; min-width: 0; }
      .zk-topbar { display: none; }
      .zk-sidebar-overlay { display: none; }
      .zk-h1 { font-family: var(--font-display); font-size: 23px; font-weight: 600; margin-bottom: 3px; letter-spacing: 0.1px; }
      .zk-h1-sub { font-size: 12.5px; color: ${COLORS.inkSoft}; margin-bottom: 20px; }
      .zk-card { background: ${COLORS.paperCard}; border: 1px solid ${COLORS.border}; border-radius: 12px; padding: 16px 18px; transition: box-shadow 0.15s ease, border-color 0.15s ease; overflow-x: auto; }
      .zk-grid { display: grid; gap: 12px; }
      .zk-stat { background: ${COLORS.paperCard}; border: 1px solid ${COLORS.border}; border-radius: 12px; padding: 14px 16px; transition: box-shadow 0.15s ease, transform 0.15s ease; }
      .zk-stat:hover { box-shadow: 0 4px 14px rgba(43,42,37,0.07); transform: translateY(-1px); }
      .zk-stat-label { font-size: 11px; color: ${COLORS.inkSoft}; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
      .zk-stat-icon { width: 22px; height: 22px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; background: ${COLORS.oliveSoft}; color: ${COLORS.olive}; }
      .zk-stat-value { font-family: var(--font-display); font-size: 22px; font-weight: 600; }
      .zk-input, .zk-select { width: 100%; padding: 11px 12px; border-radius: 8px; border: 1px solid ${COLORS.border}; background: #FCFBF7; font-size: 16px; font-family: inherit; color: ${COLORS.ink}; min-height: 44px; }
      .zk-input:focus, .zk-select:focus { outline: none; border-color: ${COLORS.oliveLight}; box-shadow: 0 0 0 3px ${COLORS.oliveSoft}; }
      .zk-label { font-size: 12.5px; font-weight: 600; color: ${COLORS.inkSoft}; margin-bottom: 5px; display: block; }
      .zk-btn { display: inline-flex; align-items: center; gap: 6px; padding: 11px 16px; border-radius: 8px; border: none; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background 0.12s ease, transform 0.08s ease, box-shadow 0.12s ease; min-height: 44px; }
      .zk-btn:active:not(:disabled) { transform: scale(0.97); }
      .zk-btn-primary { background: ${COLORS.olive}; color: #fff; }
      .zk-btn-primary:hover { background: #333c25; box-shadow: 0 2px 8px rgba(63,74,46,0.25); }
      .zk-btn-gold { background: ${COLORS.gold}; color: #fff; }
      .zk-btn-gold:hover { box-shadow: 0 2px 8px rgba(179,137,43,0.3); }
      .zk-btn-blue { background: ${COLORS.blue}; color: #fff; }
      .zk-btn-blue:hover { box-shadow: 0 2px 8px rgba(59,94,115,0.3); }
      .zk-btn-secondary { background: #fff; color: ${COLORS.ink}; border: 1px solid ${COLORS.border}; }
      .zk-btn-secondary:hover { background: #F7F5EE; }
      .zk-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .zk-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
      .zk-table th { text-align: left; font-size: 11px; letter-spacing: 0.4px; color: ${COLORS.inkSoft}; padding: 9px 10px; border-bottom: 1px solid ${COLORS.border}; font-weight: 600; }
      .zk-table td { padding: 12px 10px; border-bottom: 1px solid #EFEBDD; }
      .zk-table tr { transition: background 0.1s ease; }
      .zk-table tr:hover td { background: #FAF8F1; }
      .zk-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11.5px; font-weight: 600; }
      .zk-badge-olive { background: ${COLORS.oliveSoft}; color: ${COLORS.olive}; }
      .zk-badge-gold { background: ${COLORS.goldSoft}; color: ${COLORS.gold}; }
      .zk-badge-red { background: ${COLORS.redSoft}; color: ${COLORS.red}; }
      .zk-badge-blue { background: ${COLORS.blueSoft}; color: ${COLORS.blue}; }
      .zk-scalebox { background: #1C2226; border-radius: 12px; padding: 15px 16px; color: #fff; }
      .zk-scale-readout { font-family: 'Courier New', monospace; font-size: 30px; font-weight: 700; color: #7FDB8F; }
      .zk-modal-overlay { position: fixed; inset: 0; background: rgba(20,20,15,0.45); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 20px; }
      .zk-modal { background: #fff; border-radius: 14px; padding: 22px; width: 100%; max-width: 440px; max-height: 90vh; overflow-y: auto; }
      .zk-close { background: none; border: none; cursor: pointer; color: ${COLORS.inkSoft}; padding: 8px; min-height: 40px; min-width: 40px; }
      .zk-empty { text-align: center; padding: 36px 20px; color: ${COLORS.inkSoft}; font-size: 13px; }
      .zk-farmer-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 13px; border-radius: 10px; cursor: pointer; border: 1px solid transparent; transition: background 0.12s ease, border-color 0.12s ease; min-height: 44px; }
      .zk-farmer-row:hover { background: #FAF8F1; border-color: ${COLORS.border}; }
      .zk-avatar { width: 34px; height: 34px; border-radius: 50%; background: ${COLORS.oliveSoft}; color: ${COLORS.olive}; display: inline-flex; align-items: center; justify-content: center; font-size: 12.5px; font-weight: 700; font-family: var(--font-display); flex-shrink: 0; }
      .zk-tag { font-size: 10.5px; padding: 2px 8px; border-radius: 5px; background: ${COLORS.oliveSoft}; color: ${COLORS.olive}; font-weight: 600; }
      .zk-checkbox-row { display: flex; align-items: center; gap: 9px; font-size: 13.5px; min-height: 30px; }
      .zk-checkbox-row input[type="checkbox"] { width: 19px; height: 19px; accent-color: ${COLORS.olive}; flex-shrink: 0; }
      .zk-empty-icon { color: ${COLORS.border}; margin-bottom: 8px; }
      #zk-print-area { display: none; }
      @media print {
        @page { size: 80mm auto; margin: 3mm; }
        body * { visibility: hidden; }
        #zk-print-area, #zk-print-area * { visibility: visible; }
        #zk-print-area { display: block; position: absolute; top: 0; left: 0; width: 100%; }
      }

      /* Tablet: sidebar sabit kalır, sadece içerik alanı biraz daralır */
      @media (max-width: 1024px) {
        .zk-sidebar { width: 190px; }
        .zk-main { padding: 22px 20px; }
      }

      /* Telefon: sidebar gizli çekmeceye döner, üstte hamburger bar açar */
      @media (max-width: 768px) {
        .zk-topbar {
          display: flex; align-items: center; gap: 12px; padding: 12px 16px;
          background: ${COLORS.olive}; position: sticky; top: 0; z-index: 60;
        }
        .zk-topbar-btn { background: rgba(255,255,255,0.1); border: none; border-radius: 8px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; color: #fff; cursor: pointer; flex-shrink: 0; }
        .zk-topbar-brand { color: #F5F2E8; font-family: var(--font-display); font-size: 16px; font-weight: 600; }
        .zk-shell { display: block; }
        .zk-sidebar {
          position: fixed; top: 0; left: -260px; height: 100vh; width: 232px; z-index: 90;
          transition: left 0.22s ease; box-shadow: 2px 0 18px rgba(0,0,0,0.25); overflow-y: auto;
        }
        .zk-sidebar.zk-sidebar-open { left: 0; }
        .zk-sidebar-overlay {
          display: none; position: fixed; inset: 0; background: rgba(20,20,15,0.45); z-index: 80;
        }
        .zk-sidebar-overlay.zk-sidebar-open { display: block; }
        .zk-main { padding: 16px 14px; max-width: 100%; }
      }
      @media (max-width: 720px) {
        .zk-grid[style*="1fr 1fr"] { grid-template-columns: 1fr !important; }
      }

      /* Telefon düzeni: tüm çok sütunlu ızgaralar tek sütuna iner, tablolar yatay kayar */
      @media (max-width: 600px) {
        [style*="gridTemplateColumns"] { grid-template-columns: 1fr !important; }
        .zk-main { padding: 14px 12px; }
        .zk-h1 { font-size: 18px; }
        .zk-h1-sub { font-size: 11.5px; margin-bottom: 14px; }
        .zk-card { padding: 12px 13px; }
        .zk-stat-value { font-size: 18px; }
        .zk-table { min-width: 560px; }
        .zk-modal { max-width: 94vw; padding: 16px; }
        .zk-brand { font-size: 15px; }
        .zk-navbtn { padding: 9px 10px; font-size: 12px; }
        .zk-scale-readout { font-size: 24px; }
        .zk-btn { padding: 10px 12px; font-size: 12.5px; }
      }
    `}</style>
  );
}

function StatCard({ label, value, tone, icon: Icon }) {
  return (
    <div className="zk-stat">
      <div className="zk-stat-label">
        {Icon && <span className="zk-stat-icon" style={tone ? { background: tone + '1A', color: tone } : undefined}><Icon size={12} /></span>}
        {label}
      </div>
      <div className="zk-stat-value" style={{ color: tone || COLORS.ink }}>{value}</div>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="zk-modal-overlay" onClick={onClose}>
      <div className="zk-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
          <button className="zk-close" onClick={onClose} aria-label="Kapat"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ScaleWidget({ onWeightCapture, compact }) {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('Bağlı değil');
  const [rawLines, setRawLines] = useState([]);
  const [lastValue, setLastValue] = useState(null);
  const [baud, setBaud] = useState(9600);
  const portRef = useRef(null);
  const readerRef = useRef(null);
  const keepReadingRef = useRef(false);
  const bufferRef = useRef('');

  const extractNumber = (line) => {
    const m = line.match(/-?\d+[.,]?\d*/);
    if (!m) return null;
    return parseFloat(m[0].replace(',', '.'));
  };

  const handleIncoming = useCallback((chunk) => {
    bufferRef.current += chunk;
    let idx;
    while ((idx = bufferRef.current.search(/[\r\n]/)) >= 0) {
      const line = bufferRef.current.slice(0, idx).trim();
      bufferRef.current = bufferRef.current.slice(idx + 1);
      if (!line) continue;
      setRawLines((prev) => [...prev.slice(-4), line]);
      const num = extractNumber(line);
      if (num !== null) setLastValue(num);
    }
  }, []);

  const readLoop = useCallback(async (port) => {
    const decoder = new TextDecoderStream();
    const closed = port.readable.pipeTo(decoder.writable);
    const reader = decoder.readable.getReader();
    readerRef.current = reader;
    try {
      while (keepReadingRef.current) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) handleIncoming(value);
      }
    } catch (e) {
      console.error(e);
    } finally {
      reader.releaseLock();
      await closed.catch(() => {});
    }
  }, [handleIncoming]);

  const connect = async () => {
    if (!('serial' in navigator)) {
      alert('Bu tarayıcı Web Serial API desteklemiyor. Masaüstü Chrome veya Edge kullanın.');
      return;
    }
    try {
      setStatus('Bağlanıyor...');
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: baud });
      portRef.current = port;
      setConnected(true);
      setStatus('Bağlı');
      keepReadingRef.current = true;
      readLoop(port);
    } catch (e) {
      setStatus('Bağlanamadı');
    }
  };

  const disconnect = async () => {
    keepReadingRef.current = false;
    try {
      if (readerRef.current) await readerRef.current.cancel();
      if (portRef.current) await portRef.current.close();
    } catch (e) {}
    setConnected(false);
    setStatus('Bağlı değil');
    setLastValue(null);
  };

  if (compact) {
    return (
      <div className="zk-scalebox zk-scalebox-compact">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#B7C4B3', minWidth: 90 }}>
            {connected ? <BluetoothConnected size={15} /> : <Bluetooth size={15} />}
            {status}
          </div>

          <div className="zk-scale-readout" style={{ fontSize: 26 }}>{lastValue !== null ? lastValue.toFixed(1) : '—'}</div>

          {rawLines.length > 0 && (
            <div style={{ fontSize: 10, color: '#6A7A6A', fontFamily: 'Courier New, monospace', flex: 1, minWidth: 100 }}>
              {rawLines[rawLines.length - 1]}
            </div>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {!connected && (
              <select value={baud} onChange={(e) => setBaud(Number(e.target.value))} style={{ background: '#2A3128', color: '#DCE2CC', border: '1px solid #3A4235', borderRadius: 6, fontSize: 11, padding: '6px 6px' }}>
                <option value={9600}>9600</option>
                <option value={4800}>4800</option>
                <option value={2400}>2400</option>
                <option value={1200}>1200</option>
                <option value={19200}>19200</option>
              </select>
            )}
            {!connected ? (
              <button className="zk-btn zk-btn-gold" onClick={connect}>Kantara bağlan</button>
            ) : (
              <>
                <button className="zk-btn zk-btn-secondary" onClick={disconnect} style={{ background: '#2A3128', color: '#DCE2CC', border: 'none' }}>Kes</button>
                <button className="zk-btn zk-btn-gold" disabled={lastValue === null} onClick={() => onWeightCapture(lastValue)}>
                  Bu değeri kullan
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="zk-scalebox">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#B7C4B3' }}>
          {connected ? <BluetoothConnected size={15} /> : <Bluetooth size={15} />}
          {status}
        </div>
        {!connected && (
          <select value={baud} onChange={(e) => setBaud(Number(e.target.value))} style={{ background: '#2A3128', color: '#DCE2CC', border: '1px solid #3A4235', borderRadius: 6, fontSize: 11, padding: '4px 6px' }}>
            <option value={9600}>9600</option>
            <option value={4800}>4800</option>
            <option value={2400}>2400</option>
            <option value={1200}>1200</option>
            <option value={19200}>19200</option>
          </select>
        )}
      </div>
      <div className="zk-scale-readout">{lastValue !== null ? lastValue.toFixed(1) : '—'}</div>
      {rawLines.length > 0 && (
        <div style={{ fontSize: 10, color: '#6A7A6A', marginTop: 6, fontFamily: 'Courier New, monospace' }}>
          {rawLines[rawLines.length - 1]}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {!connected ? (
          <button className="zk-btn zk-btn-gold" onClick={connect} style={{ flex: 1, justifyContent: 'center' }}>Kantara bağlan</button>
        ) : (
          <>
            <button className="zk-btn zk-btn-secondary" onClick={disconnect} style={{ flex: 1, justifyContent: 'center', background: '#2A3128', color: '#DCE2CC', border: 'none' }}>Kes</button>
            <button
              className="zk-btn zk-btn-gold"
              style={{ flex: 1, justifyContent: 'center' }}
              disabled={lastValue === null}
              onClick={() => onWeightCapture(lastValue)}
            >
              Bu değeri kullan
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function stopajOraniHesapla(borsaTescilli) {
  return borsaTescilli ? 2 : 4;
}

function formatPhoneForWhatsApp(phone) {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 0) return null;
  if (digits.startsWith('0')) digits = '90' + digits.slice(1);
  else if (digits.startsWith('90')) { /* zaten doğru */ }
  else if (digits.length === 10) digits = '90' + digits;
  return digits;
}

function buildWhatsAppReceiptText(purchase, farmer, settings) {
  const lines = [];
  lines.push(`*${settings.businessName || 'Zeytin Komisyonculuğu'}*`);
  lines.push(`Müstahsil Makbuzu No: ${purchase.makbuzNo}`);
  lines.push(`Tarih: ${fmtDate(purchase.date)}${purchase.time ? ' · ' + purchase.time : ''}`);
  lines.push(`Sayın ${farmer.name},`);
  lines.push('');
  lines.push('Zeytin teslimatınızın dökümü:');
  (purchase.items || []).forEach((it) => {
    lines.push(`• ${it.grade}: ${fmtKg(it.kg)} × ${fmtTL(it.pricePerKg)}/kg = ${fmtTL(it.amount)}`);
  });
  lines.push('');
  lines.push(`Toplam net: ${fmtKg(purchase.netKg)}`);
  lines.push(`Ürün tutarı: ${fmtTL(purchase.amount)}`);
  if (!purchase.noDeduction) {
    lines.push(`Komisyon (%${purchase.commissionRate}): -${fmtTL(purchase.commissionAmount)}`);
    lines.push(`Stopaj (%${purchase.stopajOrani}): -${fmtTL(purchase.stopajTutari)}`);
    if (purchase.applyBagkur) lines.push(`BAĞ-KUR (%${purchase.bagkurRate}): -${fmtTL(purchase.bagkurTutari)}`);
  }
  lines.push(`*Ödenecek net: ${fmtTL(purchase.netPayment)}*`);
  if (purchase.note) lines.push(`Not: ${purchase.note}`);
  lines.push('');
  lines.push('Teşekkür ederiz.');
  return lines.join('\n');
}

function DashboardTab({ farmers, purchases, payments, sales, setTab }) {
  const today = todayStr();
  const todaysPurchases = purchases.filter((p) => p.date === today);
  const totalKgToday = todaysPurchases.reduce((s, p) => s + p.netKg, 0);
  const totalAmountToday = todaysPurchases.reduce((s, p) => s + p.netPayment, 0);

  const totalPurchasedKg = purchases.reduce((s, p) => s + p.netKg, 0);
  const totalSoldKg = sales.reduce((s, s2) => s + s2.kg, 0);
  const currentStock = totalPurchasedKg - totalSoldKg;

  const balances = useMemo(() => {
    const map = {};
    farmers.forEach((f) => { map[f.id] = 0; });
    purchases.forEach((p) => { map[p.farmerId] = (map[p.farmerId] || 0) + p.netPayment; });
    payments.forEach((pay) => { map[pay.farmerId] = (map[pay.farmerId] || 0) - pay.amount; });
    return map;
  }, [farmers, purchases, payments]);
  const totalDebt = Object.values(balances).reduce((s, v) => s + Math.max(v, 0), 0);

  const chartData = useMemo(() => {
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const kg = purchases.filter((p) => p.date === key).reduce((s, p) => s + p.netKg, 0);
      days.push({ date: fmtDateShort(key), kg: Math.round(kg * 10) / 10 });
    }
    return days;
  }, [purchases]);

  const recent = [...purchases].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);

  return (
    <div>
      <div className="zk-h1">Pano</div>
      <div className="zk-h1-sub">{fmtDate(today)} · genel durum</div>

      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 16 }}>
        <StatCard label="Bugün alınan" value={fmtKg(totalKgToday)} />
        <StatCard label="Bugünkü net ödeme" value={fmtTL(totalAmountToday)} />
        <StatCard label="Mevcut stok" value={fmtKg(currentStock)} tone={COLORS.blue} icon={Warehouse} />
        <StatCard label="Ödenecek bakiye" value={fmtTL(totalDebt)} tone={totalDebt > 0 ? COLORS.red : COLORS.olive} />
      </div>

      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Son 14 gün alım (kg)</div>
        <div style={{ width: '100%', height: 180 }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EFEBDD" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.inkSoft }} />
              <YAxis tick={{ fontSize: 10, fill: COLORS.inkSoft }} width={40} />
              <Tooltip formatter={(v) => [v + ' kg', 'Alım']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Line type="monotone" dataKey="kg" stroke={COLORS.olive} strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="zk-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>Son alımlar</div>
          <button className="zk-btn zk-btn-primary" onClick={() => setTab('purchase')}><Plus size={14} /> Yeni alım</button>
        </div>
        {recent.length === 0 ? (
          <div className="zk-empty"><Package size={26} className="zk-empty-icon" /><br/>Henüz alım kaydı yok. "Yeni alım" ile başlayın.</div>
        ) : (
          <table className="zk-table">
            <thead>
              <tr><th>Tarih</th><th>Çiftçi</th><th>Net kg</th><th>Fiyat</th><th>Net ödeme</th></tr>
            </thead>
            <tbody>
              {recent.map((p) => {
                const f = farmers.find((x) => x.id === p.farmerId);
                return (
                  <tr key={p.id}>
                    <td>{fmtDate(p.date)}</td>
                    <td>{f ? f.name : '—'}</td>
                    <td>{fmtKg(p.netKg)}</td>
                    <td>{fmtTL(p.pricePerKg)}/kg</td>
                    <td>{fmtTL(p.netPayment)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function AddPersonnelModal({ onClose, onSave, initialData }) {
  const [name, setName] = useState(initialData?.name || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [role, setRole] = useState(initialData?.role || '');
  return (
    <Modal title={initialData ? 'Personeli düzenle' : 'Yeni personel ekle'} onClose={onClose}>
      <div style={{ marginBottom: 12 }}>
        <label className="zk-label">Ad soyad</label>
        <input className="zk-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="örn. Ali Demir" autoFocus />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
        <div>
          <label className="zk-label">Telefon</label>
          <input className="zk-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0532 xxx xx xx" />
        </div>
        <div>
          <label className="zk-label">Görev (opsiyonel)</label>
          <input className="zk-input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="örn. Şoför, Tartı memuru" />
        </div>
      </div>
      <button className="zk-btn zk-btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => onSave({ name, phone, role })}>Kaydet</button>
    </Modal>
  );
}

function AddVehicleModal({ onClose, onSave, personnel, initialData }) {
  const [plaka, setPlaka] = useState(initialData?.plaka || '');
  const [marka, setMarka] = useState(initialData?.marka || '');
  const [kapasite, setKapasite] = useState(initialData?.kapasite || '');
  const [defaultPersonnelId, setDefaultPersonnelId] = useState(initialData?.defaultPersonnelId || '');
  return (
    <Modal title={initialData ? 'Aracı düzenle' : 'Yeni araç ekle'} onClose={onClose}>
      <div style={{ marginBottom: 12 }}>
        <label className="zk-label">Plaka</label>
        <input className="zk-input" value={plaka} onChange={(e) => setPlaka(e.target.value.toUpperCase())} placeholder="örn. 35 ABC 123" autoFocus />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <label className="zk-label">Marka / model</label>
          <input className="zk-input" value={marka} onChange={(e) => setMarka(e.target.value)} placeholder="örn. Ford Kamyonet" />
        </div>
        <div>
          <label className="zk-label">Kapasite (kg)</label>
          <input className="zk-input" type="number" value={kapasite} onChange={(e) => setKapasite(e.target.value)} placeholder="örn. 3000" />
        </div>
      </div>
      <div style={{ marginBottom: 18 }}>
        <label className="zk-label">Varsayılan sürücü (opsiyonel)</label>
        <select className="zk-select" value={defaultPersonnelId} onChange={(e) => setDefaultPersonnelId(e.target.value)}>
          <option value="">Seçin...</option>
          {personnel.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <button className="zk-btn zk-btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => onSave({ plaka, marka, kapasite: parseFloat(kapasite) || 0, defaultPersonnelId })}>Kaydet</button>
    </Modal>
  );
}

function AddFarmerModal({ onClose, onSave, initialData }) {
  const [name, setName] = useState(initialData?.name || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [tcNo, setTcNo] = useState(initialData?.tcNo || '');
  const [address, setAddress] = useState(initialData?.address || '');
  const [bagkurStatus, setBagkurStatus] = useState(initialData?.bagkurStatus || false);

  const submit = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), phone: phone.trim(), tcNo: tcNo.trim(), address: address.trim(), bagkurStatus });
  };

  return (
    <Modal title={initialData ? 'Çiftçiyi düzenle' : 'Yeni çiftçi ekle'} onClose={onClose}>
      <div style={{ marginBottom: 12 }}>
        <label className="zk-label">Ad soyad</label>
        <input className="zk-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="örn. Mehmet Yılmaz" autoFocus />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <label className="zk-label">Telefon</label>
          <input className="zk-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0532 xxx xx xx" />
        </div>
        <div>
          <label className="zk-label">TC Kimlik No</label>
          <input className="zk-input" value={tcNo} onChange={(e) => setTcNo(e.target.value)} placeholder="11 haneli" maxLength={11} />
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label className="zk-label">Adres (müstahsil makbuzu için)</label>
        <input className="zk-input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Köy / ilçe / il" />
      </div>
      <div style={{ marginBottom: 18 }}>
        <label className="zk-checkbox-row">
          <input type="checkbox" checked={bagkurStatus} onChange={(e) => setBagkurStatus(e.target.checked)} />
          Tarım BAĞ-KUR'lu (SGK kesintisi uygulanır)
        </label>
      </div>
      <button className="zk-btn zk-btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={submit}>Kaydet</button>
    </Modal>
  );
}

function FarmersTab({ farmers, setFarmers, purchases, payments, setTab, setSelectedFarmerId }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingFarmer, setEditingFarmer] = useState(null);
  const [query, setQuery] = useState('');

  const balances = useMemo(() => {
    const map = {};
    farmers.forEach((f) => { map[f.id] = 0; });
    purchases.forEach((p) => { map[p.farmerId] = (map[p.farmerId] || 0) + p.netPayment; });
    payments.forEach((pay) => { map[pay.farmerId] = (map[pay.farmerId] || 0) - pay.amount; });
    return map;
  }, [farmers, purchases, payments]);

  const filtered = farmers.filter((f) => f.name.toLowerCase().includes(query.toLowerCase()));

  const addFarmer = async (data) => {
    const newFarmer = { id: uid(), ...data, createdAt: Date.now() };
    const next = [...farmers, newFarmer];
    setFarmers(next);
    await storageSet('zk:farmers', next);
    setShowAdd(false);
  };

  const saveEdit = async (data) => {
    const next = farmers.map((f) => (f.id === editingFarmer.id ? { ...f, ...data } : f));
    setFarmers(next);
    await storageSet('zk:farmers', next);
    setEditingFarmer(null);
  };

  const removeFarmer = async (f) => {
    const hasHistory = purchases.some((p) => p.farmerId === f.id) || payments.some((p) => p.farmerId === f.id);
    const warning = hasHistory
      ? `${f.name} adına kayıtlı alım/ödeme geçmişi var. Çiftçiyi silerseniz bu kayıtlar listede "—" olarak görünmeye devam eder ama çiftçi kaydı kalıcı olarak silinir. Emin misiniz?`
      : `${f.name} adlı çiftçiyi silmek istediğinize emin misiniz?`;
    if (!window.confirm(warning)) return;
    const next = farmers.filter((x) => x.id !== f.id);
    setFarmers(next);
    await storageSet('zk:farmers', next);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="zk-h1">Çiftçiler</div>
          <div className="zk-h1-sub">{farmers.length} kayıtlı çiftçi</div>
        </div>
        <button className="zk-btn zk-btn-primary" onClick={() => setShowAdd(true)}><Plus size={14} /> Çiftçi ekle</button>
      </div>

      <div style={{ position: 'relative', marginBottom: 14, maxWidth: 320 }}>
        <Search size={15} style={{ position: 'absolute', left: 10, top: 9, color: COLORS.inkSoft }} />
        <input className="zk-input" style={{ paddingLeft: 32 }} placeholder="Çiftçi ara..." value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="zk-card">
        {filtered.length === 0 ? (
          <div className="zk-empty"><Users size={26} className="zk-empty-icon" /><br/>{farmers.length === 0 ? 'Henüz çiftçi eklenmedi.' : 'Sonuç bulunamadı.'}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {filtered.map((f) => {
              const bal = balances[f.id] || 0;
              return (
                <div key={f.id} className="zk-farmer-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', flex: 1 }} onClick={() => { setSelectedFarmerId(f.id); setTab('ledger'); }}>
                    <div className="zk-avatar">{f.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 7 }}>
                        {f.name}
                        {f.bagkurStatus && <span className="zk-tag">BAĞ-KUR</span>}
                      </div>
                      <div style={{ fontSize: 11.5, color: COLORS.inkSoft, display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                        {f.phone && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={11} />{f.phone}</span>}
                        {f.tcNo && <span>TC: {f.tcNo}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`zk-badge ${bal > 0 ? 'zk-badge-red' : 'zk-badge-olive'}`}>
                      {bal > 0 ? `${fmtTL(bal)} ödenecek` : 'Bakiye kapalı'}
                    </span>
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 8px' }} onClick={() => setEditingFarmer(f)}><Pencil size={12} /></button>
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 8px' }} onClick={() => removeFarmer(f)}><Trash2 size={12} /></button>
                    <ChevronRight size={16} color={COLORS.inkSoft} onClick={() => { setSelectedFarmerId(f.id); setTab('ledger'); }} style={{ cursor: 'pointer' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAdd && <AddFarmerModal onClose={() => setShowAdd(false)} onSave={addFarmer} />}
      {editingFarmer && <AddFarmerModal onClose={() => setEditingFarmer(null)} onSave={saveEdit} initialData={editingFarmer} />}
    </div>
  );
}

function PurchaseTab({ farmers, setFarmers, purchases, setPurchases, onPrintReceipt, settings, priceList, personnel, setPersonnel, vehicles, setVehicles }) {
  const [farmerId, setFarmerId] = useState('');
  const [showAddFarmer, setShowAddFarmer] = useState(false);
  const [personnelId, setPersonnelId] = useState('');
  const [showAddPersonnel, setShowAddPersonnel] = useState(false);
  const [vehicleId, setVehicleId] = useState('');
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [now, setNow] = useState(new Date());
  const [commissionRate, setCommissionRate] = useState((settings.defaultCommissionRate ?? 3).toString());
  const [borsaTescilli, setBorsaTescilli] = useState(false);
  const [noDeduction, setNoDeduction] = useState(settings.defaultNoDeduction ?? true);
  const [note, setNote] = useState('');
  const [applyBagkur, setApplyBagkur] = useState(false);
  const [bagkurRate, setBagkurRate] = useState((settings.defaultBagkurRate ?? 1).toString());
  const [lastSaved, setLastSaved] = useState(null);

  const [items, setItems] = useState([]);
  const [lineVariety, setLineVariety] = useState(priceList[0]?.name || '');
  const [lineGradeName, setLineGradeName] = useState('');
  const [lineKg, setLineKg] = useState('');
  const [crateWeight] = useState(settings.crateWeight ?? 2);
  const [crateCount, setCrateCount] = useState(Math.max(0, Math.min(7, settings.defaultCrateCount ?? 5)));
  const [linePrice, setLinePrice] = useState('');

  const lineDara = crateCount * crateWeight;
  const adjustCrateCount = (delta) => setCrateCount((c) => Math.max(0, Math.min(7, c + delta)));

  const farmer = farmers.find((f) => f.id === farmerId);
  const selectedVariety = priceList.find((v) => v.name === lineVariety);
  const date = now.toISOString().slice(0, 10);
  const timeLabel = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const dateTimeLabel = now.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' · ' + timeLabel;

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setApplyBagkur(farmer ? !!farmer.bagkurStatus : false);
  }, [farmerId]);

  useEffect(() => {
    if (!selectedVariety) return;
    if (selectedVariety.hasGrades) {
      const firstGrade = selectedVariety.grades[0];
      setLineGradeName(firstGrade ? firstGrade.name : '');
      setLinePrice(firstGrade ? firstGrade.price.toString() : '');
    } else {
      setLineGradeName('');
      setLinePrice((selectedVariety.singlePrice || 0).toString());
    }
  }, [lineVariety, priceList]);

  useEffect(() => {
    if (!selectedVariety || !selectedVariety.hasGrades) return;
    const g = selectedVariety.grades.find((x) => x.name === lineGradeName);
    if (g) setLinePrice(g.price.toString());
  }, [lineGradeName]);

  const handleFarmerSelect = (value) => {
    if (value === '__add_new__') { setShowAddFarmer(true); return; }
    setFarmerId(value);
  };

  const saveNewFarmer = async (data) => {
    const newFarmer = { id: uid(), ...data, createdAt: Date.now() };
    const next = [...farmers, newFarmer];
    setFarmers(next);
    await storageSet('zk:farmers', next);
    setShowAddFarmer(false);
    setFarmerId(newFarmer.id);
  };

  const handlePersonnelSelect = (value) => {
    if (value === '__add_new__') { setShowAddPersonnel(true); return; }
    setPersonnelId(value);
  };

  const saveNewPersonnel = async (data) => {
    if (!data.name || !data.name.trim()) return;
    const newPerson = { id: uid(), name: data.name.trim(), phone: data.phone || '', role: data.role || '', createdAt: Date.now() };
    const next = [...personnel, newPerson];
    setPersonnel(next);
    await storageSet('zk:personnel', next);
    setShowAddPersonnel(false);
    setPersonnelId(newPerson.id);
  };

  const handleVehicleSelect = (value) => {
    if (value === '__add_new__') { setShowAddVehicle(true); return; }
    setVehicleId(value);
    const v = vehicles.find((x) => x.id === value);
    if (v && v.defaultPersonnelId && !personnelId) setPersonnelId(v.defaultPersonnelId);
  };

  const saveNewVehicle = async (data) => {
    if (!data.plaka || !data.plaka.trim()) return;
    const newVehicle = { id: uid(), plaka: data.plaka.trim(), marka: data.marka || '', kapasite: data.kapasite || 0, defaultPersonnelId: data.defaultPersonnelId || '', createdAt: Date.now() };
    const next = [...vehicles, newVehicle];
    setVehicles(next);
    await storageSet('zk:vehicles', next);
    setShowAddVehicle(false);
    setVehicleId(newVehicle.id);
  };

  const addLine = () => {
    const grossVal = parseFloat(lineKg);
    const daraVal = lineDara;
    const priceVal = parseFloat(linePrice);
    const netVal = grossVal - daraVal;
    if (!lineVariety || !grossVal || grossVal <= 0 || netVal <= 0 || !priceVal || priceVal <= 0) return;
    const label = lineGradeName ? `${lineVariety} · ${lineGradeName}` : lineVariety;
    setItems((prev) => [...prev, { id: uid(), grade: label, grossKg: grossVal, dara: daraVal, crateCount, kg: netVal, pricePerKg: priceVal, amount: netVal * priceVal }]);
    setLineKg('');
  };

  const removeLine = (id) => setItems((prev) => prev.filter((x) => x.id !== id));

  const netKg = items.reduce((s, i) => s + i.kg, 0);
  const amount = items.reduce((s, i) => s + i.amount, 0);
  const commissionAmount = noDeduction ? 0 : amount * ((parseFloat(commissionRate) || 0) / 100);
  const stopajOrani = stopajOraniHesapla(borsaTescilli);
  const stopajTutari = noDeduction ? 0 : amount * (stopajOrani / 100);
  const bagkurTutari = (!noDeduction && applyBagkur) ? amount * ((parseFloat(bagkurRate) || 0) / 100) : 0;
  const netPayment = amount - commissionAmount - stopajTutari - bagkurTutari;

  const canSave = farmerId && items.length > 0;

  const save = async () => {
    if (!canSave) return;
    const person = personnel.find((p) => p.id === personnelId);
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    const record = {
      id: uid(),
      makbuzNo: purchases.length + 1,
      farmerId,
      date,
      time: now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      personnelId: personnelId || null,
      personnelName: person ? person.name : '',
      vehicleId: vehicleId || null,
      vehiclePlaka: vehicle ? vehicle.plaka : '',
      items,
      netKg,
      noDeduction,
      commissionRate: noDeduction ? 0 : (parseFloat(commissionRate) || 0),
      commissionAmount,
      borsaTescilli,
      stopajOrani: noDeduction ? 0 : stopajOrani,
      stopajTutari,
      applyBagkur: noDeduction ? false : applyBagkur,
      bagkurRate: parseFloat(bagkurRate) || 0,
      bagkurTutari,
      amount,
      netPayment,
      note,
      createdAt: Date.now(),
    };
    const next = [...purchases, record];
    setPurchases(next);
    await storageSet('zk:purchases', next);
    setLastSaved(record);
    setItems([]); setNote(''); setLineKg('');
  };

  return (
    <div>
      <div className="zk-h1">Alım</div>
      <div className="zk-h1-sub">Elekten çıkan her sınıfı ayrı tartıp ekleyin, sonunda toplam üzerinden hesaplansın</div>

      <ScaleWidget onWeightCapture={(v) => setLineKg(v.toFixed(1))} compact />

      <div style={{ maxWidth: 640, marginTop: 16 }}>
        <div className="zk-card">
          <div style={{ marginBottom: 10 }}>
            <label className="zk-label">Çiftçi</label>
            <select className="zk-select" value={farmerId} onChange={(e) => handleFarmerSelect(e.target.value)}>
              <option value="">Seçin...</option>
              {farmers.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              <option value="__add_new__">+ Yeni çiftçi ekle</option>
            </select>
          </div>

          <div className="zk-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 10 }}>
            <div>
              <label className="zk-label">Alımı yapan personel</label>
              <select className="zk-select" value={personnelId} onChange={(e) => handlePersonnelSelect(e.target.value)}>
                <option value="">Seçin...</option>
                {personnel.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                <option value="__add_new__">+ Yeni personel ekle</option>
              </select>
            </div>
            <div>
              <label className="zk-label">Araç</label>
              <select className="zk-select" value={vehicleId} onChange={(e) => handleVehicleSelect(e.target.value)}>
                <option value="">Seçin...</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plaka}</option>)}
                <option value="__add_new__">+ Yeni araç ekle</option>
              </select>
            </div>
          </div>

          <div style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ClockIcon size={13} /> {dateTimeLabel} (otomatik)
          </div>

          <div style={{ background: COLORS.paper, borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <div className="zk-label" style={{ marginBottom: 8 }}>Tartım satırı ekle</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'end' }}>
              <div style={{ flex: '1 1 140px' }}>
                <label className="zk-label">Tür</label>
                <select className="zk-select" value={lineVariety} onChange={(e) => setLineVariety(e.target.value)}>
                  {priceList.length === 0 && <option value="">Fiyat listesi boş</option>}
                  {priceList.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
                </select>
              </div>
              {selectedVariety?.hasGrades && (
                <div style={{ flex: '1 1 120px' }}>
                  <label className="zk-label">Numara</label>
                  <select className="zk-select" value={lineGradeName} onChange={(e) => setLineGradeName(e.target.value)}>
                    {selectedVariety.grades.length === 0 && <option value="">Numara yok</option>}
                    {selectedVariety.grades.map((g) => <option key={g.id} value={g.name}>{g.name}</option>)}
                  </select>
                </div>
              )}
              <div style={{ flex: '1 1 100px' }}>
                <label className="zk-label">Ölçülen (kg)</label>
                <input className="zk-input" type="number" value={lineKg} onChange={(e) => setLineKg(e.target.value)} placeholder="0" />
              </div>
              <div style={{ flex: '1 1 150px' }}>
                <label className="zk-label">Dara (kasa)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button className="zk-btn zk-btn-secondary" style={{ padding: '0 12px', minWidth: 40 }} onClick={() => adjustCrateCount(-1)} disabled={crateCount <= 0}>−</button>
                  <div style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600 }}>
                    {crateCount} kasa<div style={{ fontSize: 10.5, color: COLORS.inkSoft, fontWeight: 400 }}>{fmtKg(lineDara)}</div>
                  </div>
                  <button className="zk-btn zk-btn-secondary" style={{ padding: '0 12px', minWidth: 40 }} onClick={() => adjustCrateCount(1)} disabled={crateCount >= 7}>+</button>
                </div>
              </div>
              <div style={{ flex: '1 1 100px' }}>
                <label className="zk-label">Fiyat/kg</label>
                <input className="zk-input" type="number" value={linePrice} onChange={(e) => setLinePrice(e.target.value)} placeholder="0.00" />
              </div>
              <button className="zk-btn zk-btn-gold" onClick={addLine}><Plus size={14} /> Ekle</button>
            </div>
            {lineKg && (
              <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginTop: 8 }}>
                Net: {fmtKg(Math.max((parseFloat(lineKg) || 0) - lineDara, 0))}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <table className="zk-table" style={{ marginBottom: 14 }}>
              <thead><tr><th>Sınıf</th><th>Ölçülen</th><th>Dara</th><th>Net</th><th>Fiyat</th><th>Tutar</th><th></th></tr></thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td><span className="zk-badge zk-badge-blue">{it.grade}</span></td>
                    <td>{fmtKg(it.grossKg ?? it.kg)}</td>
                    <td>{fmtKg(it.dara || 0)}{it.crateCount != null ? ` (${it.crateCount} kasa)` : ''}</td>
                    <td style={{ fontWeight: 600 }}>{fmtKg(it.kg)}</td>
                    <td>{fmtTL(it.pricePerKg)}/kg</td>
                    <td>{fmtTL(it.amount)}</td>
                    <td><button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => removeLine(it.id)}><X size={12} /></button></td>
                  </tr>
                ))}
                <tr>
                  <td style={{ fontWeight: 700 }}>Toplam</td>
                  <td></td>
                  <td></td>
                  <td style={{ fontWeight: 700 }}>{fmtKg(netKg)}</td>
                  <td></td>
                  <td style={{ fontWeight: 700 }}>{fmtTL(amount)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          )}

          <label className="zk-checkbox-row" style={{ background: COLORS.oliveSoft, padding: '9px 12px', borderRadius: 8, marginBottom: 12 }}>
            <input type="checkbox" checked={noDeduction} onChange={(e) => setNoDeduction(e.target.checked)} />
            Kesintisiz hesapla (komisyon / stopaj / BAĞ-KUR uygulanmasın, tutarın tamamı ödensin)
          </label>

          {!noDeduction && (
            <div className="zk-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 12 }}>
              <div>
                <label className="zk-label">Komisyon oranı (%)</label>
                <input className="zk-input" type="number" value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)} placeholder="3" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 6 }}>
                <label className="zk-checkbox-row">
                  <input type="checkbox" checked={borsaTescilli} onChange={(e) => setBorsaTescilli(e.target.checked)} />
                  Ticaret borsasına tescilli
                </label>
                <label className="zk-checkbox-row">
                  <input type="checkbox" checked={applyBagkur} onChange={(e) => setApplyBagkur(e.target.checked)} />
                  BAĞ-KUR kesintisi uygula (%)
                  <input
                    className="zk-input"
                    type="number"
                    value={bagkurRate}
                    onChange={(e) => setBagkurRate(e.target.value)}
                    style={{ width: 55, padding: '4px 6px' }}
                    disabled={!applyBagkur}
                  />
                </label>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label className="zk-label">Not (opsiyonel)</label>
            <input className="zk-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="serbest not..." />
          </div>

          <div style={{ background: COLORS.paper, borderRadius: 10, padding: 14, marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12.5 }}>
            <div>Ürün tutarı ({fmtKg(netKg)})</div><div style={{ textAlign: 'right', fontWeight: 600 }}>{fmtTL(amount)}</div>
            {!noDeduction && (
              <>
                <div style={{ color: COLORS.gold }}>Komisyon (%{commissionRate || 0})</div><div style={{ textAlign: 'right', fontWeight: 600, color: COLORS.gold }}>− {fmtTL(commissionAmount)}</div>
                <div style={{ color: COLORS.blue }}>Stopaj (%{stopajOrani})</div><div style={{ textAlign: 'right', fontWeight: 600, color: COLORS.blue }}>− {fmtTL(stopajTutari)}</div>
                {applyBagkur && (<><div style={{ color: COLORS.red }}>BAĞ-KUR (%{bagkurRate || 0})</div><div style={{ textAlign: 'right', fontWeight: 600, color: COLORS.red }}>− {fmtTL(bagkurTutari)}</div></>)}
              </>
            )}
            <div style={{ fontWeight: 700, borderTop: `1px solid ${COLORS.border}`, paddingTop: 8 }}>Çiftçiye ödenecek</div>
            <div style={{ textAlign: 'right', fontWeight: 700, borderTop: `1px solid ${COLORS.border}`, paddingTop: 8, color: COLORS.olive }}>{fmtTL(netPayment)}</div>
          </div>

          <button className="zk-btn zk-btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={!canSave} onClick={save}>
            Alımı kaydet
          </button>

          {lastSaved && (() => {
            const lastSavedFarmer = farmers.find((f) => f.id === lastSaved.farmerId);
            const waPhone = lastSavedFarmer ? formatPhoneForWhatsApp(lastSavedFarmer.phone) : null;
            const waHref = waPhone
              ? `https://wa.me/${waPhone}?text=${encodeURIComponent(buildWhatsAppReceiptText(lastSaved, lastSavedFarmer, settings))}`
              : null;
            return (
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: COLORS.oliveSoft, padding: '10px 12px', borderRadius: 8, flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 12, color: COLORS.olive }}>Alım #{lastSaved.makbuzNo} kaydedildi.</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="zk-btn zk-btn-secondary" onClick={() => onPrintReceipt(lastSaved)}><Printer size={13} /> Yazdır</button>
                  {waHref ? (
                    <a className="zk-btn" style={{ background: '#25D366', color: '#fff' }} href={waHref} target="_blank" rel="noopener noreferrer">
                      <MessageCircle size={13} /> WhatsApp'tan gönder
                    </a>
                  ) : (
                    <span style={{ fontSize: 11, color: COLORS.inkSoft, alignSelf: 'center' }}>Çiftçinin telefonu kayıtlı değil</span>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {showAddFarmer && <AddFarmerModal onClose={() => setShowAddFarmer(false)} onSave={saveNewFarmer} />}
      {showAddPersonnel && <AddPersonnelModal onClose={() => setShowAddPersonnel(false)} onSave={saveNewPersonnel} />}
      {showAddVehicle && <AddVehicleModal onClose={() => setShowAddVehicle(false)} onSave={saveNewVehicle} personnel={personnel} />}
    </div>
  );
}

function WarehouseTab({ purchases, buyers, setBuyers, sales, setSales, vehicles, setVehicles, personnel }) {
  const [showAddBuyer, setShowAddBuyer] = useState(false);
  const [editingBuyer, setEditingBuyer] = useState(null);
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');

  const [buyerId, setBuyerId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [grade, setGrade] = useState('');
  const [kg, setKg] = useState('');
  const [pricePerKg, setPricePerKg] = useState('');
  const [note, setNote] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [showAddVehicle, setShowAddVehicle] = useState(false);

  const totalPurchasedKg = purchases.reduce((s, p) => s + p.netKg, 0);
  const totalSoldKg = sales.reduce((s, s2) => s + s2.kg, 0);
  const currentStock = totalPurchasedKg - totalSoldKg;

  const purchasedByGrade = useMemo(() => {
    const map = {};
    purchases.forEach((p) => {
      (p.items || []).forEach((it) => { map[it.grade] = (map[it.grade] || 0) + it.kg; });
    });
    return map;
  }, [purchases]);

  const soldByGrade = useMemo(() => {
    const map = {};
    sales.forEach((s) => { map[s.grade || 'Etiketsiz'] = (map[s.grade || 'Etiketsiz'] || 0) + s.kg; });
    return map;
  }, [sales]);

  const stockByGrade = useMemo(() => {
    const grades = new Set([...Object.keys(purchasedByGrade), ...Object.keys(soldByGrade)]);
    return Array.from(grades).map((g) => ({ grade: g, stock: (purchasedByGrade[g] || 0) - (soldByGrade[g] || 0) })).sort((a, b) => b.stock - a.stock);
  }, [purchasedByGrade, soldByGrade]);

  const availableForGrade = grade ? (purchasedByGrade[grade] || 0) - (soldByGrade[grade] || 0) : 0;
  const amount = (parseFloat(kg) || 0) * (parseFloat(pricePerKg) || 0);
  const canSave = buyerId && grade && parseFloat(kg) > 0 && parseFloat(pricePerKg) > 0 && parseFloat(kg) <= availableForGrade + 0.001;

  const addBuyer = async () => {
    if (!buyerName.trim()) return;
    const b = { id: uid(), name: buyerName.trim(), phone: buyerPhone.trim(), createdAt: Date.now() };
    const next = [...buyers, b];
    setBuyers(next);
    await storageSet('zk:buyers', next);
    setBuyerName(''); setBuyerPhone(''); setShowAddBuyer(false);
    setBuyerId(b.id);
  };

  const removeSale = async (id) => {
    if (!window.confirm('Bu satış kaydını silmek istediğinize emin misiniz? Stok hesabına geri eklenecektir.')) return;
    const next = sales.filter((s) => s.id !== id);
    setSales(next);
    await storageSet('zk:sales', next);
  };

  const removeBuyer = async (b) => {
    const hasHistory = sales.some((s) => s.buyerId === b.id);
    const msg = hasHistory
      ? `${b.name} adına kayıtlı satış geçmişi var. Yine de silmek istediğinize emin misiniz?`
      : `${b.name} adlı alıcıyı silmek istediğinize emin misiniz?`;
    if (!window.confirm(msg)) return;
    const next = buyers.filter((x) => x.id !== b.id);
    setBuyers(next);
    await storageSet('zk:buyers', next);
  };

  const handleVehicleSelect = (value) => {
    if (value === '__add_new__') { setShowAddVehicle(true); return; }
    setVehicleId(value);
  };

  const saveNewVehicle = async (data) => {
    if (!data.plaka || !data.plaka.trim()) return;
    const newVehicle = { id: uid(), plaka: data.plaka.trim(), marka: data.marka || '', kapasite: data.kapasite || 0, defaultPersonnelId: data.defaultPersonnelId || '', createdAt: Date.now() };
    const next = [...vehicles, newVehicle];
    setVehicles(next);
    await storageSet('zk:vehicles', next);
    setShowAddVehicle(false);
    setVehicleId(newVehicle.id);
  };

  const saveSale = async () => {
    if (!canSave) return;
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    const record = { id: uid(), buyerId, date, grade, kg: parseFloat(kg), pricePerKg: parseFloat(pricePerKg), amount, note, vehicleId: vehicleId || null, vehiclePlaka: vehicle ? vehicle.plaka : '', createdAt: Date.now() };
    const next = [...sales, record];
    setSales(next);
    await storageSet('zk:sales', next);
    setKg(''); setPricePerKg(''); setNote('');
  };

  const recentSales = [...sales].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);

  return (
    <div>
      <div className="zk-h1">Depo ve satış</div>
      <div className="zk-h1-sub">Sınıf bazında stok durumu ve alıcıya satış kayıtları</div>

      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 18 }}>
        <StatCard label="Toplam alınan" value={fmtKg(totalPurchasedKg)} icon={Package} />
        <StatCard label="Toplam satılan" value={fmtKg(totalSoldKg)} icon={ShoppingCart} />
        <StatCard label="Mevcut stok" value={fmtKg(currentStock)} tone={COLORS.blue} icon={Warehouse} />
      </div>

      <div style={{ maxWidth: 640 }}>
        <div className="zk-card">
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Yeni satış</div>
          <div className="zk-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 10 }}>
            <div>
              <label className="zk-label">Alıcı</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <select className="zk-select" value={buyerId} onChange={(e) => setBuyerId(e.target.value)}>
                  <option value="">Seçin...</option>
                  {buyers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <button className="zk-btn zk-btn-secondary" onClick={() => setShowAddBuyer(true)}><Plus size={13} /></button>
              </div>
            </div>
            <div>
              <label className="zk-label">Tarih</label>
              <input className="zk-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label className="zk-label">Sınıf / numara</label>
            <select className="zk-select" value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option value="">Seçin...</option>
              {stockByGrade.filter((g) => g.stock > 0.01).map((g) => <option key={g.grade} value={g.grade}>{g.grade} · stokta {fmtKg(g.stock)}</option>)}
            </select>
          </div>
          <div className="zk-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 10 }}>
            <div>
              <label className="zk-label">Miktar (kg){grade ? ` · stokta ${fmtKg(availableForGrade)}` : ''}</label>
              <input className="zk-input" type="number" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="zk-label">Kg fiyatı (TL)</label>
              <input className="zk-input" type="number" value={pricePerKg} onChange={(e) => setPricePerKg(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label className="zk-label">Teslimatı yapan araç (opsiyonel)</label>
            <select className="zk-select" value={vehicleId} onChange={(e) => handleVehicleSelect(e.target.value)}>
              <option value="">Seçin...</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plaka}</option>)}
              <option value="__add_new__">+ Yeni araç ekle</option>
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="zk-label">Not</label>
            <input className="zk-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="opsiyonel" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, fontSize: 13 }}>
            <span style={{ color: COLORS.inkSoft }}>Toplam tutar</span>
            <span style={{ fontWeight: 700 }}>{fmtTL(amount)}</span>
          </div>
          <button className="zk-btn zk-btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={!canSave} onClick={saveSale}>
            Satışı kaydet
          </button>
          {grade && parseFloat(kg) > availableForGrade && kg && (
            <div style={{ fontSize: 11.5, color: COLORS.red, marginTop: 8 }}>Bu sınıfta stoktan fazla miktar girdiniz.</div>
          )}
        </div>
      </div>

      <div className="zk-card" style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Alıcılar</div>
        {buyers.length === 0 ? (
          <div className="zk-empty">Henüz alıcı eklenmedi.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {buyers.map((b) => (
              <div key={b.id} className="zk-farmer-row">
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{b.name}</div>
                  {b.phone && <div style={{ fontSize: 11.5, color: COLORS.inkSoft }}>{b.phone}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 8px' }} onClick={() => setEditingBuyer(b)}><Pencil size={12} /></button>
                  <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 8px' }} onClick={() => removeBuyer(b)}><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="zk-card" style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Sınıf bazında stok</div>
        {stockByGrade.length === 0 ? (
          <div className="zk-empty">Kayıt yok.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stockByGrade.map(({ grade: g, stock }) => (
              <div key={g} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                <span className="zk-badge zk-badge-blue">{g}</span>
                <span style={{ fontWeight: 600, color: stock < 0 ? COLORS.red : COLORS.ink }}>{fmtKg(stock)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="zk-card" style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Son satışlar</div>
        {recentSales.length === 0 ? (
          <div className="zk-empty">Henüz satış kaydı yok.</div>
        ) : (
          <table className="zk-table">
            <thead><tr><th>Tarih</th><th>Alıcı</th><th>Sınıf</th><th>Kg</th><th>Fiyat</th><th>Tutar</th><th>Araç</th><th></th></tr></thead>
            <tbody>
              {recentSales.map((s) => {
                const b = buyers.find((x) => x.id === s.buyerId);
                return (
                  <tr key={s.id}>
                    <td>{fmtDate(s.date)}</td>
                    <td>{b ? b.name : '—'}</td>
                    <td><span className="zk-badge zk-badge-blue">{s.grade || '—'}</span></td>
                    <td>{fmtKg(s.kg)}</td>
                    <td>{fmtTL(s.pricePerKg)}/kg</td>
                    <td>{fmtTL(s.amount)}</td>
                    <td style={{ color: COLORS.inkSoft }}>{s.vehiclePlaka || '—'}</td>
                    <td><button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => removeSale(s.id)}><Trash2 size={12} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showAddBuyer && (
        <Modal title="Yeni alıcı ekle" onClose={() => setShowAddBuyer(false)}>
          <div style={{ marginBottom: 12 }}>
            <label className="zk-label">Alıcı / firma adı</label>
            <input className="zk-input" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="örn. Ege Zeytinyağı A.Ş." autoFocus />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label className="zk-label">Telefon (opsiyonel)</label>
            <input className="zk-input" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} />
          </div>
          <button className="zk-btn zk-btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={addBuyer}>Kaydet</button>
        </Modal>
      )}
      {showAddVehicle && <AddVehicleModal onClose={() => setShowAddVehicle(false)} onSave={saveNewVehicle} personnel={personnel} />}
      {editingBuyer && (
        <Modal title="Alıcıyı düzenle" onClose={() => setEditingBuyer(null)}>
          <div style={{ marginBottom: 12 }}>
            <label className="zk-label">Alıcı / firma adı</label>
            <input className="zk-input" value={editingBuyer.name} onChange={(e) => setEditingBuyer({ ...editingBuyer, name: e.target.value })} autoFocus />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label className="zk-label">Telefon (opsiyonel)</label>
            <input className="zk-input" value={editingBuyer.phone || ''} onChange={(e) => setEditingBuyer({ ...editingBuyer, phone: e.target.value })} />
          </div>
          <button
            className="zk-btn zk-btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={async () => {
              const next = buyers.map((x) => (x.id === editingBuyer.id ? editingBuyer : x));
              setBuyers(next);
              await storageSet('zk:buyers', next);
              setEditingBuyer(null);
            }}
          >
            Kaydet
          </button>
        </Modal>
      )}
    </div>
  );
}

const EXPENSE_CATEGORIES = ['Nakliye', 'İşçilik', 'Depo kirası', 'Elektrik', 'Yakıt', 'Bakım/onarım', 'Diğer'];
const INCOME_CATEGORIES = ['Hizmet Bedeli', 'Kira Geliri', 'Satış Geliri', 'Diğer Gelir'];

function ExpensesTab({ expenses, setExpenses, settings }) {
  const categories = (settings?.expenseCategories && settings.expenseCategories.length > 0) ? settings.expenseCategories : EXPENSE_CATEGORIES;
  const [date, setDate] = useState(todayStr());
  const [category, setCategory] = useState(categories[0]);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [range, setRange] = useState('month');

  const filtered = useMemo(() => {
    const now = new Date();
    return expenses.filter((e) => {
      const d = new Date(e.date);
      if (range === 'today') return e.date === todayStr();
      if (range === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      return true;
    });
  }, [expenses, range]);

  const total = filtered.reduce((s, e) => s + e.amount, 0);

  const byCategory = useMemo(() => {
    const map = {};
    filtered.forEach((e) => { map[e.category] = (map[e.category] || 0) + e.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const save = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    const record = { id: uid(), date, category, amount: amt, note, createdAt: Date.now() };
    const next = [...expenses, record];
    setExpenses(next);
    await storageSet('zk:expenses', next);
    setAmount(''); setNote('');
  };

  const removeExpense = async (id) => {
    if (!window.confirm('Bu gider kaydını silmek istediğinize emin misiniz?')) return;
    const next = expenses.filter((e) => e.id !== id);
    setExpenses(next);
    await storageSet('zk:expenses', next);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="zk-h1">Giderler</div>
          <div className="zk-h1-sub">Nakliye, işçilik, depo gibi işletme giderleri</div>
        </div>
        <select className="zk-select" style={{ width: 130 }} value={range} onChange={(e) => setRange(e.target.value)}>
          <option value="today">Bugün</option>
          <option value="month">Bu ay</option>
          <option value="all">Tümü</option>
        </select>
      </div>

      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 18 }}>
        <StatCard label="Toplam gider" value={fmtTL(total)} tone={COLORS.red} />
        <StatCard label="Kayıt sayısı" value={filtered.length} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        <div className="zk-card">
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Yeni gider ekle</div>
          <div className="zk-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 10 }}>
            <div>
              <label className="zk-label">Kategori</label>
              <select className="zk-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="zk-label">Tarih</label>
              <input className="zk-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label className="zk-label">Tutar (TL)</label>
            <input className="zk-input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="zk-label">Not</label>
            <input className="zk-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="opsiyonel" />
          </div>
          <button className="zk-btn zk-btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={save}>Kaydet</button>
        </div>

        <div className="zk-card">
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Kategori bazında dağılım</div>
          {byCategory.length === 0 ? (
            <div className="zk-empty">Kayıt yok.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {byCategory.map(([cat, amt]) => (
                <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                  <span className="zk-badge zk-badge-red">{cat}</span>
                  <span style={{ fontWeight: 600 }}>{fmtTL(amt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="zk-card" style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Gider kayıtları</div>
        {filtered.length === 0 ? (
          <div className="zk-empty">Kayıt yok.</div>
        ) : (
          <table className="zk-table">
            <thead><tr><th>Tarih</th><th>Kategori</th><th>Not</th><th>Tutar</th><th></th></tr></thead>
            <tbody>
              {[...filtered].reverse().map((e) => (
                <tr key={e.id}>
                  <td>{fmtDate(e.date)}</td>
                  <td><span className="zk-badge zk-badge-red">{e.category}</span></td>
                  <td style={{ color: COLORS.inkSoft }}>{e.note || '—'}</td>
                  <td style={{ fontWeight: 600 }}>{fmtTL(e.amount)}</td>
                  <td><button className="zk-btn zk-btn-secondary" style={{ padding: '5px 9px' }} onClick={() => removeExpense(e.id)}><X size={12} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function CashTab({ settings, setSettings, payments, expenses, cashEntries, setCashEntries, farmers }) {
  const [openingBalance, setOpeningBalance] = useState(settings.openingCashBalance ?? 0);
  const [entryType, setEntryType] = useState('giris');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryNote, setEntryNote] = useState('');
  const [entryCategory, setEntryCategory] = useState('');

  const incomeCategories = (settings?.incomeCategories && settings.incomeCategories.length > 0) ? settings.incomeCategories : INCOME_CATEGORIES;

  const saveOpening = async () => {
    const next = { ...settings, openingCashBalance: parseFloat(openingBalance) || 0 };
    setSettings(next);
    await storageSet('zk:settings', next);
  };

  const addEntry = async () => {
    const amt = parseFloat(entryAmount);
    if (!amt || amt <= 0) return;
    const record = { id: uid(), date: todayStr(), type: entryType, amount: amt, note: entryNote, category: entryType === 'giris' ? entryCategory : '', createdAt: Date.now() };
    const next = [...cashEntries, record];
    setCashEntries(next);
    await storageSet('zk:cashEntries', next);
    setEntryAmount(''); setEntryNote('');
  };

  const movements = useMemo(() => {
    const manual = cashEntries.map((e) => ({
      date: e.date, createdAt: e.createdAt,
      amount: e.type === 'giris' ? e.amount : -e.amount,
      label: e.type === 'giris' ? (e.category || 'Manuel giriş') : 'Manuel çıkış',
      note: e.note,
    }));
    const pay = payments.map((p) => {
      const f = farmers.find((x) => x.id === p.farmerId);
      return {
        date: p.date, createdAt: p.createdAt,
        amount: -p.amount,
        label: p.payType === 'avans' ? 'Avans' : 'Çiftçi ödemesi',
        note: f ? f.name : '',
      };
    });
    const exp = expenses.map((e) => ({
      date: e.date, createdAt: e.createdAt, amount: -e.amount, label: 'Gider', note: e.category,
    }));
    return [...manual, ...pay, ...exp].sort((a, b) => a.createdAt - b.createdAt);
  }, [cashEntries, payments, expenses, farmers]);

  const opening = settings.openingCashBalance ?? 0;
  let running = opening;
  const withRunning = movements.map((m) => { running += m.amount; return { ...m, running }; });
  const currentBalance = running;

  const removeEntry = async (id) => {
    if (!window.confirm('Bu kasa hareketini silmek istediğinize emin misiniz?')) return;
    const next = cashEntries.filter((e) => e.id !== id);
    setCashEntries(next);
    await storageSet('zk:cashEntries', next);
  };

  return (
    <div>
      <div className="zk-h1">Kasa</div>
      <div className="zk-h1-sub">Nakit takibi — çiftçi ödemeleri/avanslar ve giderler otomatik düşülür</div>

      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 18 }}>
        <StatCard label="Güncel kasa bakiyesi" value={fmtTL(currentBalance)} tone={currentBalance < 0 ? COLORS.red : COLORS.olive} />
        <StatCard label="Açılış bakiyesi" value={fmtTL(opening)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start', marginBottom: 16 }}>
        <div className="zk-card">
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Açılış bakiyesi</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="zk-input" type="number" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
            <button className="zk-btn zk-btn-primary" onClick={saveOpening}>Kaydet</button>
          </div>
        </div>

        <div className="zk-card">
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Manuel kasa hareketi ekle</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <select className="zk-select" value={entryType} onChange={(e) => setEntryType(e.target.value)} style={{ maxWidth: 120 }}>
              <option value="giris">Giriş</option>
              <option value="cikis">Çıkış</option>
            </select>
            {entryType === 'giris' && (
              <select className="zk-select" value={entryCategory} onChange={(e) => setEntryCategory(e.target.value)} style={{ maxWidth: 150 }}>
                <option value="">Kategori (opsiyonel)</option>
                {incomeCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <input className="zk-input" type="number" placeholder="Tutar" value={entryAmount} onChange={(e) => setEntryAmount(e.target.value)} style={{ maxWidth: 130 }} />
            <input className="zk-input" placeholder="Not (örn. satış tahsilatı)" value={entryNote} onChange={(e) => setEntryNote(e.target.value)} style={{ flex: 1, minWidth: 130 }} />
          </div>
          <button className="zk-btn zk-btn-gold" style={{ width: '100%', justifyContent: 'center' }} onClick={addEntry}>Ekle</button>
        </div>
      </div>

      <div className="zk-card">
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Kasa hareketleri</div>
        {withRunning.length === 0 ? (
          <div className="zk-empty">Hareket yok.</div>
        ) : (
          <table className="zk-table">
            <thead><tr><th>Tarih</th><th>İşlem</th><th>Tutar</th><th>Bakiye</th></tr></thead>
            <tbody>
              {withRunning.slice().reverse().map((m, i) => (
                <tr key={i}>
                  <td>{fmtDate(m.date)}</td>
                  <td><span className={`zk-badge ${m.amount >= 0 ? 'zk-badge-olive' : 'zk-badge-red'}`}>{m.label}{m.note ? ` · ${m.note}` : ''}</span></td>
                  <td style={{ fontWeight: 600, color: m.amount >= 0 ? COLORS.olive : COLORS.red }}>{m.amount >= 0 ? '+' : ''}{fmtTL(m.amount)}</td>
                  <td style={{ fontWeight: 600 }}>{fmtTL(m.running)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function AllPurchasesTab({ farmers, purchases, setPurchases, personnel, onPrintReceipt, settings }) {
  const [query, setQuery] = useState('');
  const [farmerFilter, setFarmerFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const filtered = useMemo(() => {
    return purchases.filter((p) => {
      if (farmerFilter && p.farmerId !== farmerFilter) return false;
      if (fromDate && p.date < fromDate) return false;
      if (toDate && p.date > toDate) return false;
      if (query) {
        const f = farmers.find((x) => x.id === p.farmerId);
        const haystack = [
          f?.name || '', p.note || '', String(p.makbuzNo),
          ...(p.items || []).map((it) => it.grade),
        ].join(' ').toLowerCase();
        if (!haystack.includes(query.toLowerCase())) return false;
      }
      return true;
    }).sort((a, b) => b.createdAt - a.createdAt);
  }, [purchases, farmerFilter, fromDate, toDate, query, farmers]);

  const totalKg = filtered.reduce((s, p) => s + p.netKg, 0);
  const totalAmount = filtered.reduce((s, p) => s + p.netPayment, 0);

  const removePurchase = async (p) => {
    if (!window.confirm(`#${p.makbuzNo} numaralı alım kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve çiftçinin cari hesabını etkiler.`)) return;
    const next = purchases.filter((x) => x.id !== p.id);
    setPurchases(next);
    await storageSet('zk:purchases', next);
  };

  return (
    <div>
      <div className="zk-h1">Tüm alımlar</div>
      <div className="zk-h1-sub">{filtered.length} kayıt · {fmtKg(totalKg)} · {fmtTL(totalAmount)}</div>

      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ position: 'relative', flex: '2 1 200px' }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: 14, color: COLORS.inkSoft }} />
            <input className="zk-input" style={{ paddingLeft: 32 }} placeholder="Çiftçi, sınıf, not, makbuz no ara..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select className="zk-select" style={{ flex: '1 1 140px' }} value={farmerFilter} onChange={(e) => setFarmerFilter(e.target.value)}>
            <option value="">Tüm çiftçiler</option>
            {farmers.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <input className="zk-input" type="date" style={{ flex: '1 1 140px' }} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <input className="zk-input" type="date" style={{ flex: '1 1 140px' }} value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
      </div>

      <div className="zk-card">
        {filtered.length === 0 ? (
          <div className="zk-empty"><Package size={26} className="zk-empty-icon" /><br/>Kayıt bulunamadı.</div>
        ) : (
          <table className="zk-table">
            <thead><tr><th>No</th><th>Tarih</th><th>Çiftçi</th><th>Personel</th><th>Araç</th><th>Sınıflar</th><th>Net kg</th><th>Net ödeme</th><th></th></tr></thead>
            <tbody>
              {filtered.map((p) => {
                const f = farmers.find((x) => x.id === p.farmerId);
                const waPhone = f ? formatPhoneForWhatsApp(f.phone) : null;
                return (
                  <tr key={p.id}>
                    <td>#{p.makbuzNo}</td>
                    <td>{fmtDate(p.date)}{p.time ? ` · ${p.time}` : ''}</td>
                    <td>{f ? f.name : '—'}</td>
                    <td style={{ color: COLORS.inkSoft }}>{p.personnelName || '—'}</td>
                    <td style={{ color: COLORS.inkSoft }}>{p.vehiclePlaka || '—'}</td>
                    <td style={{ fontSize: 11.5, color: COLORS.inkSoft }}>{(p.items || []).map((it) => it.grade).join(', ')}</td>
                    <td>{fmtKg(p.netKg)}</td>
                    <td style={{ fontWeight: 600 }}>{fmtTL(p.netPayment)}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 9px' }} onClick={() => onPrintReceipt(p)}><Printer size={12} /></button>
                      {waPhone && (
                        <a className="zk-btn" style={{ padding: '5px 9px', background: '#25D366', color: '#fff' }} href={`https://wa.me/${waPhone}?text=${encodeURIComponent(buildWhatsAppReceiptText(p, f, settings))}`} target="_blank" rel="noopener noreferrer">
                          <MessageCircle size={12} />
                        </a>
                      )}
                      <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 9px' }} onClick={() => removePurchase(p)}><Trash2 size={12} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const MAINTENANCE_TYPES = ['Periyodik Bakım', 'Yağ Değişimi', 'Fren', 'Akü', 'Triger/Kayış', 'Klima', 'Diğer'];
const DOC_TYPES = ['Ruhsat', 'Muayene', 'Egzoz Pulu', 'K Belgesi', 'SRC Belgesi', 'Diğer'];
const TIRE_POSITIONS = ['Ön Sol', 'Ön Sağ', 'Arka Sol', 'Arka Sağ', 'Yedek'];
const TIRE_STATUSES = ['Yeni', 'İyi', 'Orta', 'Değişmeli'];

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date(todayStr());
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function ExpiryBadge({ dateStr }) {
  const d = daysUntil(dateStr);
  if (d === null) return <span className="zk-badge" style={{ background: '#EEE', color: COLORS.inkSoft }}>Tarih yok</span>;
  if (d < 0) return <span className="zk-badge zk-badge-red">{Math.abs(d)} gün önce doldu</span>;
  if (d <= 30) return <span className="zk-badge zk-badge-gold">{d} gün kaldı</span>;
  return <span className="zk-badge zk-badge-olive">{d} gün kaldı</span>;
}

function MaintenanceSection({ vehicleId, records, setRecords }) {
  const [date, setDate] = useState(todayStr());
  const [km, setKm] = useState('');
  const [type, setType] = useState(MAINTENANCE_TYPES[0]);
  const [cost, setCost] = useState('');
  const [note, setNote] = useState('');

  const vehicleRecords = records.filter((r) => r.vehicleId === vehicleId).sort((a, b) => b.createdAt - a.createdAt);
  const total = vehicleRecords.reduce((s, r) => s + r.cost, 0);

  const save = async () => {
    const c = parseFloat(cost);
    if (!c || c <= 0) return;
    const record = { id: uid(), vehicleId, date, km: parseFloat(km) || 0, type, cost: c, note, createdAt: Date.now() };
    const next = [...records, record];
    setRecords(next);
    await storageSet('zk:vehicleMaintenance', next);
    setKm(''); setCost(''); setNote('');
  };

  const remove = async (id) => {
    if (!window.confirm('Bu bakım kaydını silmek istediğinize emin misiniz?')) return;
    const next = records.filter((r) => r.id !== id);
    setRecords(next);
    await storageSet('zk:vehicleMaintenance', next);
  };

  return (
    <div>
      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 16 }}>
        <StatCard label="Toplam bakım maliyeti" value={fmtTL(total)} tone={COLORS.red} />
        <StatCard label="Bakım sayısı" value={vehicleRecords.length} />
      </div>
      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Yeni bakım kaydı</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <select className="zk-select" style={{ flex: '1 1 160px' }} value={type} onChange={(e) => setType(e.target.value)}>
            {MAINTENANCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input className="zk-input" type="date" style={{ flex: '1 1 140px' }} value={date} onChange={(e) => setDate(e.target.value)} />
          <input className="zk-input" type="number" placeholder="Km" style={{ flex: '1 1 110px' }} value={km} onChange={(e) => setKm(e.target.value)} />
          <input className="zk-input" type="number" placeholder="Maliyet (TL)" style={{ flex: '1 1 130px' }} value={cost} onChange={(e) => setCost(e.target.value)} />
          <input className="zk-input" placeholder="Not" style={{ flex: '2 1 180px' }} value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="zk-btn zk-btn-gold" onClick={save}><Plus size={14} /> Ekle</button>
        </div>
      </div>
      <div className="zk-card">
        {vehicleRecords.length === 0 ? (
          <div className="zk-empty">Bakım kaydı yok.</div>
        ) : (
          <table className="zk-table">
            <thead><tr><th>Tarih</th><th>Km</th><th>Tür</th><th>Maliyet</th><th>Not</th><th></th></tr></thead>
            <tbody>
              {vehicleRecords.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.date)}</td>
                  <td>{r.km ? fmtKg(r.km).replace('kg', 'km') : '—'}</td>
                  <td><span className="zk-badge zk-badge-blue">{r.type}</span></td>
                  <td style={{ fontWeight: 600 }}>{fmtTL(r.cost)}</td>
                  <td style={{ color: COLORS.inkSoft }}>{r.note || '—'}</td>
                  <td><button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => remove(r.id)}><X size={12} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function FuelSection({ vehicleId, records, setRecords, settings }) {
  const [date, setDate] = useState(todayStr());
  const [km, setKm] = useState('');
  const [liters, setLiters] = useState('');
  const [pricePerLiter, setPricePerLiter] = useState(settings?.defaultFuelPrice ? String(settings.defaultFuelPrice) : '');
  const [note, setNote] = useState('');

  const vehicleRecords = records.filter((r) => r.vehicleId === vehicleId).sort((a, b) => (a.km || 0) - (b.km || 0));
  const totalCost = vehicleRecords.reduce((s, r) => s + r.totalCost, 0);
  const totalLiters = vehicleRecords.reduce((s, r) => s + r.liters, 0);

  const efficiency = useMemo(() => {
    const withKm = vehicleRecords.filter((r) => r.km > 0);
    if (withKm.length < 2) return null;
    const first = withKm[0], last = withKm[withKm.length - 1];
    const kmDiff = last.km - first.km;
    const litersUsed = withKm.slice(1).reduce((s, r) => s + r.liters, 0);
    if (kmDiff <= 0 || litersUsed <= 0) return null;
    return { kmDiff, litersUsed, per100km: (litersUsed / kmDiff) * 100 };
  }, [vehicleRecords]);

  const save = async () => {
    const l = parseFloat(liters), p = parseFloat(pricePerLiter);
    if (!l || l <= 0 || !p || p <= 0) return;
    const record = { id: uid(), vehicleId, date, km: parseFloat(km) || 0, liters: l, pricePerLiter: p, totalCost: l * p, note, createdAt: Date.now() };
    const next = [...records, record];
    setRecords(next);
    await storageSet('zk:vehicleFuel', next);
    setKm(''); setLiters(''); setPricePerLiter(''); setNote('');
  };

  const remove = async (id) => {
    if (!window.confirm('Bu yakıt kaydını silmek istediğinize emin misiniz?')) return;
    const next = records.filter((r) => r.id !== id);
    setRecords(next);
    await storageSet('zk:vehicleFuel', next);
  };

  return (
    <div>
      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 16 }}>
        <StatCard label="Toplam yakıt maliyeti" value={fmtTL(totalCost)} tone={COLORS.red} />
        <StatCard label="Toplam litre" value={totalLiters.toFixed(1) + ' L'} />
        <StatCard label="Ortalama tüketim" value={efficiency ? `${efficiency.per100km.toFixed(1)} L/100km` : '—'} tone={COLORS.blue} icon={TrendingUp} />
      </div>
      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Yeni yakıt kaydı</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <input className="zk-input" type="date" style={{ flex: '1 1 140px' }} value={date} onChange={(e) => setDate(e.target.value)} />
          <input className="zk-input" type="number" placeholder="Kilometre (gösterge)" style={{ flex: '1 1 160px' }} value={km} onChange={(e) => setKm(e.target.value)} />
          <input className="zk-input" type="number" placeholder="Litre" style={{ flex: '1 1 100px' }} value={liters} onChange={(e) => setLiters(e.target.value)} />
          <input className="zk-input" type="number" placeholder="Litre fiyatı" style={{ flex: '1 1 110px' }} value={pricePerLiter} onChange={(e) => setPricePerLiter(e.target.value)} />
          <input className="zk-input" placeholder="Not" style={{ flex: '2 1 160px' }} value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="zk-btn zk-btn-gold" onClick={save}><Plus size={14} /> Ekle</button>
        </div>
      </div>
      <div className="zk-card">
        {vehicleRecords.length === 0 ? (
          <div className="zk-empty">Yakıt kaydı yok.</div>
        ) : (
          <table className="zk-table">
            <thead><tr><th>Tarih</th><th>Km</th><th>Litre</th><th>Litre fiyatı</th><th>Tutar</th><th></th></tr></thead>
            <tbody>
              {[...vehicleRecords].reverse().map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.date)}</td>
                  <td>{r.km || '—'}</td>
                  <td>{r.liters.toFixed(1)} L</td>
                  <td>{fmtTL(r.pricePerLiter)}</td>
                  <td style={{ fontWeight: 600 }}>{fmtTL(r.totalCost)}</td>
                  <td><button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => remove(r.id)}><X size={12} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function DocumentsSection({ vehicleId, records, setRecords }) {
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [note, setNote] = useState('');

  const vehicleRecords = records.filter((r) => r.vehicleId === vehicleId).sort((a, b) => (daysUntil(a.expiryDate) ?? 9999) - (daysUntil(b.expiryDate) ?? 9999));

  const save = async () => {
    if (!expiryDate) return;
    const record = { id: uid(), vehicleId, docType, issueDate, expiryDate, note, createdAt: Date.now() };
    const next = [...records, record];
    setRecords(next);
    await storageSet('zk:vehicleDocuments', next);
    setIssueDate(''); setExpiryDate(''); setNote('');
  };

  const remove = async (id) => {
    if (!window.confirm('Bu evrak kaydını silmek istediğinize emin misiniz?')) return;
    const next = records.filter((r) => r.id !== id);
    setRecords(next);
    await storageSet('zk:vehicleDocuments', next);
  };

  return (
    <div>
      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Yeni evrak kaydı</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <select className="zk-select" style={{ flex: '1 1 150px' }} value={docType} onChange={(e) => setDocType(e.target.value)}>
            {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <div style={{ flex: '1 1 140px' }}>
            <label className="zk-label">Düzenleme tarihi</label>
            <input className="zk-input" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <label className="zk-label">Geçerlilik bitiş</label>
            <input className="zk-input" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </div>
          <div style={{ flex: '2 1 160px' }}>
            <label className="zk-label">Not</label>
            <input className="zk-input" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <button className="zk-btn zk-btn-gold" style={{ alignSelf: 'flex-end' }} onClick={save}><Plus size={14} /> Ekle</button>
        </div>
      </div>
      <div className="zk-card">
        {vehicleRecords.length === 0 ? (
          <div className="zk-empty">Evrak kaydı yok.</div>
        ) : (
          <table className="zk-table">
            <thead><tr><th>Belge</th><th>Düzenleme</th><th>Bitiş</th><th>Durum</th><th>Not</th><th></th></tr></thead>
            <tbody>
              {vehicleRecords.map((r) => (
                <tr key={r.id}>
                  <td><span className="zk-badge zk-badge-blue">{r.docType}</span></td>
                  <td>{r.issueDate ? fmtDate(r.issueDate) : '—'}</td>
                  <td>{fmtDate(r.expiryDate)}</td>
                  <td><ExpiryBadge dateStr={r.expiryDate} /></td>
                  <td style={{ color: COLORS.inkSoft }}>{r.note || '—'}</td>
                  <td><button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => remove(r.id)}><X size={12} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function InsuranceDamageSection({ vehicleId, insurance, setInsurance, damages, setDamages }) {
  const [policyType, setPolicyType] = useState('Trafik');
  const [company, setCompany] = useState('');
  const [policyNo, setPolicyNo] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [premium, setPremium] = useState('');

  const [damageDate, setDamageDate] = useState(todayStr());
  const [damageDesc, setDamageDesc] = useState('');
  const [damageCost, setDamageCost] = useState('');
  const [damageStatus, setDamageStatus] = useState('Bekliyor');

  const vehiclePolicies = insurance.filter((r) => r.vehicleId === vehicleId).sort((a, b) => (daysUntil(a.endDate) ?? 9999) - (daysUntil(b.endDate) ?? 9999));
  const vehicleDamages = damages.filter((r) => r.vehicleId === vehicleId).sort((a, b) => b.createdAt - a.createdAt);
  const totalDamageCost = vehicleDamages.reduce((s, r) => s + r.cost, 0);

  const savePolicy = async () => {
    if (!company.trim() || !endDate) return;
    const record = { id: uid(), vehicleId, policyType, company: company.trim(), policyNo, startDate, endDate, premium: parseFloat(premium) || 0, createdAt: Date.now() };
    const next = [...insurance, record];
    setInsurance(next);
    await storageSet('zk:vehicleInsurance', next);
    setCompany(''); setPolicyNo(''); setStartDate(''); setEndDate(''); setPremium('');
  };

  const removePolicy = async (id) => {
    if (!window.confirm('Bu poliçe kaydını silmek istediğinize emin misiniz?')) return;
    const next = insurance.filter((r) => r.id !== id);
    setInsurance(next);
    await storageSet('zk:vehicleInsurance', next);
  };

  const saveDamage = async () => {
    const c = parseFloat(damageCost);
    if (!damageDesc.trim()) return;
    const record = { id: uid(), vehicleId, date: damageDate, description: damageDesc.trim(), cost: c || 0, status: damageStatus, createdAt: Date.now() };
    const next = [...damages, record];
    setDamages(next);
    await storageSet('zk:vehicleDamage', next);
    setDamageDesc(''); setDamageCost('');
  };

  const removeDamage = async (id) => {
    if (!window.confirm('Bu hasar kaydını silmek istediğinize emin misiniz?')) return;
    const next = damages.filter((r) => r.id !== id);
    setDamages(next);
    await storageSet('zk:vehicleDamage', next);
  };

  return (
    <div>
      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Yeni poliçe ekle</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <select className="zk-select" style={{ flex: '1 1 110px' }} value={policyType} onChange={(e) => setPolicyType(e.target.value)}>
            <option value="Trafik">Trafik</option>
            <option value="Kasko">Kasko</option>
          </select>
          <input className="zk-input" placeholder="Sigorta şirketi" style={{ flex: '1 1 150px' }} value={company} onChange={(e) => setCompany(e.target.value)} />
          <input className="zk-input" placeholder="Poliçe no" style={{ flex: '1 1 120px' }} value={policyNo} onChange={(e) => setPolicyNo(e.target.value)} />
          <input className="zk-input" type="date" style={{ flex: '1 1 130px' }} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <input className="zk-input" type="date" style={{ flex: '1 1 130px' }} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <input className="zk-input" type="number" placeholder="Prim (TL)" style={{ flex: '1 1 110px' }} value={premium} onChange={(e) => setPremium(e.target.value)} />
          <button className="zk-btn zk-btn-gold" onClick={savePolicy}><Plus size={14} /> Ekle</button>
        </div>
        {vehiclePolicies.length === 0 ? (
          <div className="zk-empty">Poliçe kaydı yok.</div>
        ) : (
          <table className="zk-table">
            <thead><tr><th>Tür</th><th>Şirket</th><th>Bitiş</th><th>Durum</th><th>Prim</th><th></th></tr></thead>
            <tbody>
              {vehiclePolicies.map((r) => (
                <tr key={r.id}>
                  <td><span className="zk-badge zk-badge-blue">{r.policyType}</span></td>
                  <td>{r.company}</td>
                  <td>{fmtDate(r.endDate)}</td>
                  <td><ExpiryBadge dateStr={r.endDate} /></td>
                  <td>{fmtTL(r.premium)}</td>
                  <td><button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => removePolicy(r.id)}><X size={12} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 16 }}>
        <StatCard label="Toplam hasar maliyeti" value={fmtTL(totalDamageCost)} tone={COLORS.red} />
        <StatCard label="Hasar sayısı" value={vehicleDamages.length} />
      </div>

      <div className="zk-card">
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Yeni hasar kaydı</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <input className="zk-input" type="date" style={{ flex: '1 1 130px' }} value={damageDate} onChange={(e) => setDamageDate(e.target.value)} />
          <input className="zk-input" placeholder="Açıklama" style={{ flex: '2 1 200px' }} value={damageDesc} onChange={(e) => setDamageDesc(e.target.value)} />
          <input className="zk-input" type="number" placeholder="Onarım maliyeti" style={{ flex: '1 1 130px' }} value={damageCost} onChange={(e) => setDamageCost(e.target.value)} />
          <select className="zk-select" style={{ flex: '1 1 120px' }} value={damageStatus} onChange={(e) => setDamageStatus(e.target.value)}>
            <option value="Bekliyor">Bekliyor</option>
            <option value="Onarımda">Onarımda</option>
            <option value="Onarıldı">Onarıldı</option>
          </select>
          <button className="zk-btn zk-btn-gold" onClick={saveDamage}><Plus size={14} /> Ekle</button>
        </div>
        {vehicleDamages.length === 0 ? (
          <div className="zk-empty">Hasar kaydı yok.</div>
        ) : (
          <table className="zk-table">
            <thead><tr><th>Tarih</th><th>Açıklama</th><th>Maliyet</th><th>Durum</th><th></th></tr></thead>
            <tbody>
              {vehicleDamages.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.date)}</td>
                  <td>{r.description}</td>
                  <td style={{ fontWeight: 600 }}>{fmtTL(r.cost)}</td>
                  <td>
                    <span className={`zk-badge ${r.status === 'Onarıldı' ? 'zk-badge-olive' : r.status === 'Onarımda' ? 'zk-badge-gold' : 'zk-badge-red'}`}>{r.status}</span>
                  </td>
                  <td><button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => removeDamage(r.id)}><X size={12} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function FinesSection({ vehicleId, records, setRecords }) {
  const [date, setDate] = useState(todayStr());
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');

  const vehicleRecords = records.filter((r) => r.vehicleId === vehicleId).sort((a, b) => b.createdAt - a.createdAt);
  const totalAmount = vehicleRecords.reduce((s, r) => s + r.amount, 0);
  const unpaidAmount = vehicleRecords.filter((r) => !r.paid).reduce((s, r) => s + r.amount, 0);

  const save = async () => {
    const a = parseFloat(amount);
    if (!description.trim() || !a || a <= 0) return;
    const record = { id: uid(), vehicleId, date, description: description.trim(), amount: a, dueDate, paid: false, createdAt: Date.now() };
    const next = [...records, record];
    setRecords(next);
    await storageSet('zk:vehicleFines', next);
    setDescription(''); setAmount(''); setDueDate('');
  };

  const togglePaid = async (id) => {
    const next = records.map((r) => (r.id === id ? { ...r, paid: !r.paid } : r));
    setRecords(next);
    await storageSet('zk:vehicleFines', next);
  };

  const remove = async (id) => {
    if (!window.confirm('Bu ceza kaydını silmek istediğinize emin misiniz?')) return;
    const next = records.filter((r) => r.id !== id);
    setRecords(next);
    await storageSet('zk:vehicleFines', next);
  };

  return (
    <div>
      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 16 }}>
        <StatCard label="Toplam ceza" value={fmtTL(totalAmount)} tone={COLORS.red} />
        <StatCard label="Ödenmemiş" value={fmtTL(unpaidAmount)} tone={unpaidAmount > 0 ? COLORS.red : COLORS.olive} />
      </div>
      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Yeni ceza kaydı</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <input className="zk-input" type="date" style={{ flex: '1 1 130px' }} value={date} onChange={(e) => setDate(e.target.value)} />
          <input className="zk-input" placeholder="Açıklama (örn. hız ihlali)" style={{ flex: '2 1 200px' }} value={description} onChange={(e) => setDescription(e.target.value)} />
          <input className="zk-input" type="number" placeholder="Tutar (TL)" style={{ flex: '1 1 110px' }} value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input className="zk-input" type="date" placeholder="Son ödeme" style={{ flex: '1 1 130px' }} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <button className="zk-btn zk-btn-gold" onClick={save}><Plus size={14} /> Ekle</button>
        </div>
      </div>
      <div className="zk-card">
        {vehicleRecords.length === 0 ? (
          <div className="zk-empty">Ceza kaydı yok.</div>
        ) : (
          <table className="zk-table">
            <thead><tr><th>Tarih</th><th>Açıklama</th><th>Tutar</th><th>Son ödeme</th><th>Durum</th><th></th></tr></thead>
            <tbody>
              {vehicleRecords.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.date)}</td>
                  <td>{r.description}</td>
                  <td style={{ fontWeight: 600 }}>{fmtTL(r.amount)}</td>
                  <td>{r.dueDate ? fmtDate(r.dueDate) : '—'}</td>
                  <td>
                    <button className={`zk-badge ${r.paid ? 'zk-badge-olive' : 'zk-badge-red'}`} style={{ border: 'none', cursor: 'pointer' }} onClick={() => togglePaid(r.id)}>
                      {r.paid ? 'Ödendi' : 'Ödenmedi'}
                    </button>
                  </td>
                  <td><button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => remove(r.id)}><X size={12} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function TiresSection({ vehicleId, records, setRecords }) {
  const [position, setPosition] = useState(TIRE_POSITIONS[0]);
  const [brand, setBrand] = useState('');
  const [installDate, setInstallDate] = useState(todayStr());
  const [installKm, setInstallKm] = useState('');
  const [status, setStatus] = useState('Yeni');
  const [note, setNote] = useState('');

  const vehicleRecords = records.filter((r) => r.vehicleId === vehicleId).sort((a, b) => b.createdAt - a.createdAt);

  const save = async () => {
    if (!brand.trim()) return;
    const record = { id: uid(), vehicleId, position, brand: brand.trim(), installDate, installKm: parseFloat(installKm) || 0, status, note, createdAt: Date.now() };
    const next = [...records, record];
    setRecords(next);
    await storageSet('zk:vehicleTires', next);
    setBrand(''); setInstallKm(''); setNote('');
  };

  const remove = async (id) => {
    if (!window.confirm('Bu lastik kaydını silmek istediğinize emin misiniz?')) return;
    const next = records.filter((r) => r.id !== id);
    setRecords(next);
    await storageSet('zk:vehicleTires', next);
  };

  return (
    <div>
      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Yeni lastik kaydı</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <select className="zk-select" style={{ flex: '1 1 110px' }} value={position} onChange={(e) => setPosition(e.target.value)}>
            {TIRE_POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <input className="zk-input" placeholder="Marka" style={{ flex: '1 1 130px' }} value={brand} onChange={(e) => setBrand(e.target.value)} />
          <input className="zk-input" type="date" style={{ flex: '1 1 130px' }} value={installDate} onChange={(e) => setInstallDate(e.target.value)} />
          <input className="zk-input" type="number" placeholder="Takılan km" style={{ flex: '1 1 110px' }} value={installKm} onChange={(e) => setInstallKm(e.target.value)} />
          <select className="zk-select" style={{ flex: '1 1 100px' }} value={status} onChange={(e) => setStatus(e.target.value)}>
            {TIRE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input className="zk-input" placeholder="Not" style={{ flex: '1 1 120px' }} value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="zk-btn zk-btn-gold" onClick={save}><Plus size={14} /> Ekle</button>
        </div>
      </div>
      <div className="zk-card">
        {vehicleRecords.length === 0 ? (
          <div className="zk-empty">Lastik kaydı yok.</div>
        ) : (
          <table className="zk-table">
            <thead><tr><th>Konum</th><th>Marka</th><th>Takılma</th><th>Km</th><th>Durum</th><th>Not</th><th></th></tr></thead>
            <tbody>
              {vehicleRecords.map((r) => (
                <tr key={r.id}>
                  <td><span className="zk-badge zk-badge-blue">{r.position}</span></td>
                  <td>{r.brand}</td>
                  <td>{fmtDate(r.installDate)}</td>
                  <td>{r.installKm || '—'}</td>
                  <td>
                    <span className={`zk-badge ${r.status === 'Değişmeli' ? 'zk-badge-red' : r.status === 'Orta' ? 'zk-badge-gold' : 'zk-badge-olive'}`}>{r.status}</span>
                  </td>
                  <td style={{ color: COLORS.inkSoft }}>{r.note || '—'}</td>
                  <td><button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => remove(r.id)}><X size={12} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function CostAnalysisSection({ vehicleId, maintenance, fuel, fines, insurance, damages, vehiclePickups, vehicleDeliveries }) {
  const maintCost = maintenance.filter((r) => r.vehicleId === vehicleId).reduce((s, r) => s + r.cost, 0);
  const fuelCost = fuel.filter((r) => r.vehicleId === vehicleId).reduce((s, r) => s + r.totalCost, 0);
  const fineCost = fines.filter((r) => r.vehicleId === vehicleId).reduce((s, r) => s + r.amount, 0);
  const insuranceCost = insurance.filter((r) => r.vehicleId === vehicleId).reduce((s, r) => s + r.premium, 0);
  const damageCost = damages.filter((r) => r.vehicleId === vehicleId).reduce((s, r) => s + r.cost, 0);
  const totalCost = maintCost + fuelCost + fineCost + insuranceCost + damageCost;

  const fuelRecords = fuel.filter((r) => r.vehicleId === vehicleId && r.km > 0).sort((a, b) => a.km - b.km);
  const totalKm = fuelRecords.length >= 2 ? fuelRecords[fuelRecords.length - 1].km - fuelRecords[0].km : 0;
  const costPerKm = totalKm > 0 ? totalCost / totalKm : null;

  const totalPickupKg = vehiclePickups.reduce((s, p) => s + p.netKg, 0);

  const chartData = [
    { name: 'Yakıt', tutar: fuelCost },
    { name: 'Bakım', tutar: maintCost },
    { name: 'Ceza', tutar: fineCost },
    { name: 'Sigorta', tutar: insuranceCost },
    { name: 'Hasar', tutar: damageCost },
  ].filter((d) => d.tutar > 0);

  return (
    <div>
      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 16 }}>
        <StatCard label="Toplam maliyet" value={fmtTL(totalCost)} tone={COLORS.red} />
        <StatCard label="Km başına maliyet" value={costPerKm ? fmtTL(costPerKm) : '—'} tone={COLORS.blue} icon={Gauge} />
        <StatCard label="Taşınan zeytin" value={fmtKg(totalPickupKg)} tone={COLORS.olive} />
      </div>

      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Maliyet dağılımı</div>
        {chartData.length === 0 ? (
          <div className="zk-empty">Henüz maliyet kaydı yok.</div>
        ) : (
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFEBDD" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: COLORS.inkSoft }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: COLORS.inkSoft }} width={60} />
                <Tooltip formatter={(v) => [fmtTL(v), 'Tutar']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="tutar" fill={COLORS.red} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="zk-card">
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Kalem bazında özet</div>
        <table className="zk-table">
          <thead><tr><th>Kalem</th><th>Tutar</th></tr></thead>
          <tbody>
            <tr><td>Yakıt</td><td style={{ fontWeight: 600 }}>{fmtTL(fuelCost)}</td></tr>
            <tr><td>Bakım</td><td style={{ fontWeight: 600 }}>{fmtTL(maintCost)}</td></tr>
            <tr><td>Trafik cezaları</td><td style={{ fontWeight: 600 }}>{fmtTL(fineCost)}</td></tr>
            <tr><td>Sigorta primleri</td><td style={{ fontWeight: 600 }}>{fmtTL(insuranceCost)}</td></tr>
            <tr><td>Hasar onarımı</td><td style={{ fontWeight: 600 }}>{fmtTL(damageCost)}</td></tr>
            <tr style={{ borderTop: `2px solid ${COLORS.border}` }}><td style={{ fontWeight: 700 }}>Toplam</td><td style={{ fontWeight: 700, color: COLORS.red }}>{fmtTL(totalCost)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- AI Asistan: kural/istatistik tabanlı analiz motoru (ücretsiz, API gerektirmez) ----------

function mean(arr) { return arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0; }
function stdDev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(mean(arr.map((x) => (x - m) ** 2)));
}
function linearTrend(points) {
  // points: [{x, y}] -> en küçük kareler ile eğim/kesişim
  const n = points.length;
  if (n < 2) return null;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}
function monthKey(dateStr) { return dateStr.slice(0, 7); }
function lastNMonthKeys(n) {
  const keys = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

function AiSectionShell({ title, subtitle, icon: Icon, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        {Icon && <Icon size={18} color={COLORS.gold} />}
        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{title}</div>
      </div>
      {subtitle && <div style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 16 }}>{subtitle}</div>}
      {children}
    </div>
  );
}

function ExecutiveSummarySection({ farmers, purchases, sales, expenses, payments, vehicles, documents, insurance }) {
  const now = new Date();
  const thisMonthPurchases = purchases.filter((p) => monthKey(p.date) === monthKey(todayStr()));
  const thisMonthSales = sales.filter((s) => monthKey(s.date) === monthKey(todayStr()));
  const thisMonthExpenses = expenses.filter((e) => monthKey(e.date) === monthKey(todayStr()));

  const totalKg = thisMonthPurchases.reduce((s, p) => s + p.netKg, 0);
  const totalPaid = thisMonthPurchases.reduce((s, p) => s + p.netPayment, 0);
  const totalCommission = thisMonthPurchases.reduce((s, p) => s + p.commissionAmount, 0);
  const totalSalesAmount = thisMonthSales.reduce((s, s2) => s + s2.amount, 0);
  const totalExpenseAmount = thisMonthExpenses.reduce((s, e) => s + e.amount, 0);
  const estProfit = totalCommission + totalSalesAmount - totalExpenseAmount;

  const farmerVolume = {};
  thisMonthPurchases.forEach((p) => { farmerVolume[p.farmerId] = (farmerVolume[p.farmerId] || 0) + p.netKg; });
  const topFarmerId = Object.entries(farmerVolume).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topFarmer = farmers.find((f) => f.id === topFarmerId);

  const balances = {};
  farmers.forEach((f) => { balances[f.id] = 0; });
  purchases.forEach((p) => { balances[p.farmerId] = (balances[p.farmerId] || 0) + p.netPayment; });
  payments.forEach((pay) => { balances[pay.farmerId] = (balances[pay.farmerId] || 0) - pay.amount; });
  const totalOutstanding = Object.values(balances).reduce((s, v) => s + Math.max(v, 0), 0);

  const expiringDocs = documents.filter((d) => { const days = daysUntil(d.expiryDate); return days !== null && days <= 30; }).length
    + insurance.filter((i) => { const days = daysUntil(i.endDate); return days !== null && days <= 30; }).length;

  const [savedNote, setSavedNote] = useState('');

  const saveToArchive = async () => {
    const existing = (await storageGet('zk:aiReports')) || [];
    const report = {
      id: uid(),
      type: 'Yönetici Özeti',
      createdAt: Date.now(),
      date: todayStr(),
      summary: {
        totalKg, totalPaid, totalCommission, totalSalesAmount, totalExpenseAmount, estProfit,
        topFarmer: topFarmer?.name || null, totalOutstanding, expiringDocs, vehicleCount: vehicles.length,
      },
    };
    const next = [report, ...existing].slice(0, 200);
    await storageSet('zk:aiReports', next);
    setSavedNote('Özet arşive kaydedildi.');
    setTimeout(() => setSavedNote(''), 2500);
  };

  return (
    <AiSectionShell title="Yönetici Özeti" subtitle="Bu ayın verilerinden otomatik oluşturulan özet" icon={Sparkles}>
      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 16 }}>
        <StatCard label="Bu ay alınan" value={fmtKg(totalKg)} />
        <StatCard label="Çiftçilere ödenen" value={fmtTL(totalPaid)} tone={COLORS.olive} />
        <StatCard label="Tahmini kâr" value={fmtTL(estProfit)} tone={estProfit >= 0 ? COLORS.olive : COLORS.red} />
        <StatCard label="Açık bakiye toplamı" value={fmtTL(totalOutstanding)} tone={totalOutstanding > 0 ? COLORS.red : COLORS.olive} />
      </div>
      <div className="zk-card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: COLORS.ink }}>
          Bu ay <strong>{fmtKg(totalKg)}</strong> zeytin alındı, çiftçilere toplam <strong>{fmtTL(totalPaid)}</strong> ödendi
          {topFarmer && <> — en çok çalışılan çiftçi <strong>{topFarmer.name}</strong> oldu</>}.
          Satışlardan <strong>{fmtTL(totalSalesAmount)}</strong> gelir elde edildi, giderler <strong>{fmtTL(totalExpenseAmount)}</strong> olarak gerçekleşti.
          Tahmini net kâr <strong style={{ color: estProfit >= 0 ? COLORS.olive : COLORS.red }}>{fmtTL(estProfit)}</strong>.{' '}
          {totalOutstanding > 0 && <>Çiftçilere ödenmemiş <strong style={{ color: COLORS.red }}>{fmtTL(totalOutstanding)}</strong> bakiye bulunuyor.{' '}</>}
          {expiringDocs > 0 && <>Filoda <strong style={{ color: COLORS.gold }}>{expiringDocs}</strong> belge/poliçe 30 gün içinde sona eriyor, kontrol edin.</>}
          {expiringDocs === 0 && vehicles.length > 0 && <>Filodaki tüm evrak ve poliçeler güncel görünüyor.</>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="zk-btn zk-btn-gold" onClick={saveToArchive}><Archive size={13} /> Arşive kaydet</button>
        {savedNote && <span style={{ fontSize: 12, color: COLORS.olive }}>{savedNote}</span>}
      </div>
    </AiSectionShell>
  );
}

function AnomalySection({ purchases, farmers }) {
  const anomalies = useMemo(() => {
    const byGrade = {};
    purchases.forEach((p) => {
      (p.items || []).forEach((it) => {
        if (!byGrade[it.grade]) byGrade[it.grade] = [];
        byGrade[it.grade].push({ price: it.pricePerKg, purchaseId: p.id, date: p.date, farmerId: p.farmerId, kg: it.kg, grade: it.grade });
      });
    });
    const results = [];
    Object.values(byGrade).forEach((items) => {
      if (items.length < 3) return;
      const prices = items.map((i) => i.price);
      const m = mean(prices), sd = stdDev(prices);
      if (sd === 0) return;
      items.forEach((it) => {
        const z = (it.price - m) / sd;
        if (Math.abs(z) >= 2) results.push({ ...it, avg: m, z });
      });
    });
    return results.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
  }, [purchases]);

  return (
    <AiSectionShell title="Anomali Tespiti" subtitle="Sınıf ortalamasından belirgin sapan fiyatlar (istatistiksel aykırı değer analizi)" icon={AlertOctagon}>
      <div className="zk-card">
        {anomalies.length === 0 ? (
          <div className="zk-empty"><AlertOctagon size={26} className="zk-empty-icon" /><br/>Belirgin bir anomali tespit edilmedi.</div>
        ) : (
          <table className="zk-table">
            <thead><tr><th>Tarih</th><th>Çiftçi</th><th>Sınıf</th><th>Fiyat</th><th>Sınıf ortalaması</th><th>Sapma</th></tr></thead>
            <tbody>
              {anomalies.slice(0, 30).map((a, i) => {
                const f = farmers.find((x) => x.id === a.farmerId);
                return (
                  <tr key={i}>
                    <td>{fmtDate(a.date)}</td>
                    <td>{f ? f.name : '—'}</td>
                    <td><span className="zk-badge zk-badge-blue">{a.grade}</span></td>
                    <td style={{ fontWeight: 600 }}>{fmtTL(a.price)}/kg</td>
                    <td style={{ color: COLORS.inkSoft }}>{fmtTL(a.avg)}/kg</td>
                    <td><span className={`zk-badge ${a.z > 0 ? 'zk-badge-gold' : 'zk-badge-red'}`}>{a.z > 0 ? '+' : ''}{a.z.toFixed(1)}σ</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </AiSectionShell>
  );
}

function CariRiskSection({ farmers, purchases, payments }) {
  const riskList = useMemo(() => {
    return farmers.map((f) => {
      const farmerPurchases = purchases.filter((p) => p.farmerId === f.id);
      const farmerPayments = payments.filter((p) => p.farmerId === f.id);
      const balance = farmerPurchases.reduce((s, p) => s + p.netPayment, 0) - farmerPayments.reduce((s, p) => s + p.amount, 0);
      const lastActivity = [...farmerPurchases, ...farmerPayments].sort((a, b) => b.createdAt - a.createdAt)[0];
      const daysSince = lastActivity ? Math.round((Date.now() - lastActivity.createdAt) / (1000 * 60 * 60 * 24)) : null;
      let risk = 'Düşük';
      if (balance > 0 && daysSince !== null && daysSince > 45) risk = 'Yüksek';
      else if (balance > 0 && daysSince !== null && daysSince > 20) risk = 'Orta';
      else if (balance <= 0) risk = 'Yok';
      return { farmer: f, balance, daysSince, risk };
    }).filter((r) => r.balance > 0).sort((a, b) => b.balance - a.balance);
  }, [farmers, purchases, payments]);

  const badgeClass = { 'Yüksek': 'zk-badge-red', 'Orta': 'zk-badge-gold', 'Düşük': 'zk-badge-olive', 'Yok': 'zk-badge-olive' };

  return (
    <AiSectionShell title="Cari Risk Analizi" subtitle="Ödenmemiş bakiyesi olan çiftçiler, son hareketten geçen süreye göre risk seviyesi" icon={ShieldAlert}>
      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 16 }}>
        <StatCard label="Açık bakiyesi olan çiftçi" value={riskList.length} />
        <StatCard label="Yüksek risk" value={riskList.filter((r) => r.risk === 'Yüksek').length} tone={COLORS.red} />
        <StatCard label="Toplam açık bakiye" value={fmtTL(riskList.reduce((s, r) => s + r.balance, 0))} tone={COLORS.red} />
      </div>
      <div className="zk-card">
        {riskList.length === 0 ? (
          <div className="zk-empty">Açık bakiyesi olan çiftçi yok.</div>
        ) : (
          <table className="zk-table">
            <thead><tr><th>Çiftçi</th><th>Bakiye</th><th>Son hareket</th><th>Risk</th></tr></thead>
            <tbody>
              {riskList.map((r) => (
                <tr key={r.farmer.id}>
                  <td>{r.farmer.name}</td>
                  <td style={{ fontWeight: 600 }}>{fmtTL(r.balance)}</td>
                  <td style={{ color: COLORS.inkSoft }}>{r.daysSince !== null ? `${r.daysSince} gün önce` : '—'}</td>
                  <td><span className={`zk-badge ${badgeClass[r.risk]}`}>{r.risk}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AiSectionShell>
  );
}

function MaintenancePredictionSection({ vehicles, maintenance, fuel }) {
  const predictions = useMemo(() => {
    return vehicles.map((v) => {
      const records = maintenance.filter((m) => m.vehicleId === v.id && m.km > 0).sort((a, b) => a.km - b.km);
      const fuelRecords = fuel.filter((f) => f.vehicleId === v.id && f.km > 0).sort((a, b) => b.km - a.km);
      const currentKm = fuelRecords[0]?.km || records[records.length - 1]?.km || 0;
      if (records.length < 2) return { vehicle: v, status: 'insufficient', currentKm };
      const intervals = [];
      for (let i = 1; i < records.length; i++) intervals.push(records[i].km - records[i - 1].km);
      const avgInterval = mean(intervals);
      const lastKm = records[records.length - 1].km;
      const remaining = avgInterval - (currentKm - lastKm);
      return { vehicle: v, status: 'ok', currentKm, avgInterval, lastKm, remaining };
    });
  }, [vehicles, maintenance, fuel]);

  return (
    <AiSectionShell title="Arıza / Bakım Tahmini" subtitle="Geçmiş bakım aralıklarına göre bir sonraki bakımın ne zaman gerekeceği tahmini" icon={Wrench}>
      {vehicles.length === 0 ? (
        <div className="zk-empty">Henüz araç eklenmedi.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {predictions.map((p) => (
            <div key={p.vehicle.id} className="zk-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{p.vehicle.plaka}</div>
                  <div style={{ fontSize: 11.5, color: COLORS.inkSoft }}>{p.vehicle.marka || ''}</div>
                </div>
                {p.status === 'insufficient' ? (
                  <span className="zk-badge" style={{ background: '#EEE', color: COLORS.inkSoft }}>Tahmin için yetersiz veri (en az 2 bakım kaydı gerekli)</span>
                ) : p.remaining < 0 ? (
                  <span className="zk-badge zk-badge-red">Bakım süresi geçmiş olabilir (~{Math.abs(Math.round(p.remaining))} km aşıldı)</span>
                ) : p.remaining < 500 ? (
                  <span className="zk-badge zk-badge-gold">Yaklaşıyor — tahmini {Math.round(p.remaining)} km kaldı</span>
                ) : (
                  <span className="zk-badge zk-badge-olive">Normal — tahmini {Math.round(p.remaining)} km kaldı</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AiSectionShell>
  );
}

function BusinessCostSection({ expenses, vehicles, maintenance, fuel, fines, insurance, damages }) {
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalMaint = maintenance.reduce((s, r) => s + r.cost, 0);
  const totalFuel = fuel.reduce((s, r) => s + r.totalCost, 0);
  const totalFines = fines.reduce((s, r) => s + r.amount, 0);
  const totalInsurance = insurance.reduce((s, r) => s + r.premium, 0);
  const totalDamage = damages.reduce((s, r) => s + r.cost, 0);
  const grandTotal = totalExpenses + totalMaint + totalFuel + totalFines + totalInsurance + totalDamage;

  const chartData = [
    { name: 'İşletme gideri', tutar: totalExpenses },
    { name: 'Yakıt', tutar: totalFuel },
    { name: 'Bakım', tutar: totalMaint },
    { name: 'Sigorta', tutar: totalInsurance },
    { name: 'Ceza', tutar: totalFines },
    { name: 'Hasar', tutar: totalDamage },
  ].filter((d) => d.tutar > 0);

  return (
    <AiSectionShell title="Maliyet Analizi" subtitle="İşletme giderleri ve tüm filo maliyetlerinin birleşik görünümü" icon={Banknote}>
      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 16 }}>
        <StatCard label="Toplam işletme maliyeti" value={fmtTL(grandTotal)} tone={COLORS.red} />
        <StatCard label="Araç maliyetleri" value={fmtTL(totalMaint + totalFuel + totalFines + totalInsurance + totalDamage)} />
        <StatCard label="Genel giderler" value={fmtTL(totalExpenses)} />
      </div>
      <div className="zk-card">
        {chartData.length === 0 ? (
          <div className="zk-empty">Henüz maliyet kaydı yok.</div>
        ) : (
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFEBDD" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: COLORS.inkSoft }} />
                <YAxis tick={{ fontSize: 10, fill: COLORS.inkSoft }} width={50} />
                <Tooltip formatter={(v) => [fmtTL(v), 'Tutar']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="tutar" fill={COLORS.red} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </AiSectionShell>
  );
}

function PriceOptimizationSection({ purchases, sales }) {
  const gradeMargins = useMemo(() => {
    const purchasePrices = {};
    purchases.forEach((p) => {
      (p.items || []).forEach((it) => {
        if (!purchasePrices[it.grade]) purchasePrices[it.grade] = [];
        purchasePrices[it.grade].push(it.pricePerKg);
      });
    });
    const salePrices = {};
    sales.forEach((s) => {
      if (!salePrices[s.grade]) salePrices[s.grade] = [];
      salePrices[s.grade].push(s.pricePerKg);
    });
    const grades = new Set([...Object.keys(purchasePrices), ...Object.keys(salePrices)]);
    return Array.from(grades).map((g) => {
      const avgBuy = purchasePrices[g] ? mean(purchasePrices[g]) : null;
      const avgSell = salePrices[g] ? mean(salePrices[g]) : null;
      const margin = (avgBuy !== null && avgSell !== null) ? avgSell - avgBuy : null;
      const marginPct = (margin !== null && avgBuy > 0) ? (margin / avgBuy) * 100 : null;
      return { grade: g, avgBuy, avgSell, margin, marginPct };
    }).sort((a, b) => (b.marginPct ?? -999) - (a.marginPct ?? -999));
  }, [purchases, sales]);

  return (
    <AiSectionShell title="Fiyat Optimizasyonu" subtitle="Sınıf bazında alım ve satış fiyatlarının karşılaştırması — hangi sınıf daha kârlı" icon={Target}>
      <div className="zk-card">
        {gradeMargins.length === 0 ? (
          <div className="zk-empty">Henüz karşılaştırılacak veri yok.</div>
        ) : (
          <table className="zk-table">
            <thead><tr><th>Sınıf</th><th>Ort. alım fiyatı</th><th>Ort. satış fiyatı</th><th>Marj</th><th>Marj %</th></tr></thead>
            <tbody>
              {gradeMargins.map((g) => (
                <tr key={g.grade}>
                  <td><span className="zk-badge zk-badge-blue">{g.grade}</span></td>
                  <td>{g.avgBuy !== null ? fmtTL(g.avgBuy) : '—'}</td>
                  <td>{g.avgSell !== null ? fmtTL(g.avgSell) : '—'}</td>
                  <td style={{ fontWeight: 600, color: g.margin > 0 ? COLORS.olive : g.margin < 0 ? COLORS.red : COLORS.inkSoft }}>
                    {g.margin !== null ? fmtTL(g.margin) : 'Satış verisi yok'}
                  </td>
                  <td>
                    {g.marginPct !== null && (
                      <span className={`zk-badge ${g.marginPct > 10 ? 'zk-badge-olive' : g.marginPct > 0 ? 'zk-badge-gold' : 'zk-badge-red'}`}>
                        {g.marginPct > 0 ? '+' : ''}{g.marginPct.toFixed(1)}%
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AiSectionShell>
  );
}

function DemandForecastSection({ purchases, sales }) {
  const months = lastNMonthKeys(6);

  const buildSeries = (records, dateField, valueField) => {
    return months.map((mk, i) => {
      const monthRecords = records.filter((r) => monthKey(r[dateField]) === mk);
      const total = monthRecords.reduce((s, r) => s + r[valueField], 0);
      return { x: i, month: mk, y: total };
    });
  };

  const purchaseSeries = buildSeries(purchases, 'date', 'netKg');
  const salesSeries = buildSeries(sales, 'date', 'kg');

  const purchaseTrend = linearTrend(purchaseSeries.map((p) => ({ x: p.x, y: p.y })));
  const salesTrend = linearTrend(salesSeries.map((p) => ({ x: p.x, y: p.y })));

  const nextPurchaseForecast = purchaseTrend ? Math.max(0, purchaseTrend.slope * months.length + purchaseTrend.intercept) : null;
  const nextSalesForecast = salesTrend ? Math.max(0, salesTrend.slope * months.length + salesTrend.intercept) : null;

  const chartData = months.map((mk, i) => ({
    ay: mk.slice(5) + '.' + mk.slice(2, 4),
    alım: Math.round(purchaseSeries[i].y),
    satış: Math.round(salesSeries[i].y),
  }));

  return (
    <AiSectionShell title="Talep Tahmini" subtitle="Son 6 ayın alım/satış trendine göre basit doğrusal projeksiyon" icon={Radar}>
      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 16 }}>
        <StatCard label="Gelecek ay tahmini alım" value={nextPurchaseForecast !== null ? fmtKg(nextPurchaseForecast) : 'Yetersiz veri'} tone={COLORS.olive} />
        <StatCard label="Gelecek ay tahmini satış" value={nextSalesForecast !== null ? fmtKg(nextSalesForecast) : 'Yetersiz veri'} tone={COLORS.blue} />
      </div>
      <div className="zk-card">
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Son 6 ay trendi</div>
        <div style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EFEBDD" />
              <XAxis dataKey="ay" tick={{ fontSize: 10, fill: COLORS.inkSoft }} />
              <YAxis tick={{ fontSize: 10, fill: COLORS.inkSoft }} width={50} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Line type="monotone" dataKey="alım" stroke={COLORS.olive} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="satış" stroke={COLORS.blue} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ fontSize: 11, color: COLORS.inkSoft, marginTop: 8 }}>
          Bu basit bir eğilim projeksiyonudur, mevsimsellik (hasat dönemi vb.) hesaba katmaz.
        </div>
      </div>
    </AiSectionShell>
  );
}

function CustomerBehaviorSection({ buyers, sales }) {
  const buyerStats = useMemo(() => {
    return buyers.map((b) => {
      const buyerSales = sales.filter((s) => s.buyerId === b.id).sort((a, b2) => a.createdAt - b2.createdAt);
      const totalKg = buyerSales.reduce((s, r) => s + r.kg, 0);
      const totalAmount = buyerSales.reduce((s, r) => s + r.amount, 0);
      const avgPrice = buyerSales.length ? mean(buyerSales.map((r) => r.pricePerKg)) : 0;
      const gradeCounts = {};
      buyerSales.forEach((r) => { gradeCounts[r.grade] = (gradeCounts[r.grade] || 0) + r.kg; });
      const favoriteGrade = Object.entries(gradeCounts).sort((a, b2) => b2[1] - a[1])[0]?.[0];
      let avgGapDays = null;
      if (buyerSales.length >= 2) {
        const gaps = [];
        for (let i = 1; i < buyerSales.length; i++) gaps.push((buyerSales[i].createdAt - buyerSales[i - 1].createdAt) / (1000 * 60 * 60 * 24));
        avgGapDays = mean(gaps);
      }
      return { buyer: b, count: buyerSales.length, totalKg, totalAmount, avgPrice, favoriteGrade, avgGapDays };
    }).filter((r) => r.count > 0).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [buyers, sales]);

  return (
    <AiSectionShell title="Müşteri (Alıcı) Davranışı" subtitle="Alıcıların satın alma sıklığı, tercih ettiği sınıf ve toplam hacmi" icon={UserCheck}>
      <div className="zk-card">
        {buyerStats.length === 0 ? (
          <div className="zk-empty">Henüz satış kaydı yok.</div>
        ) : (
          <table className="zk-table">
            <thead><tr><th>Alıcı</th><th>Alım sayısı</th><th>Toplam kg</th><th>Toplam tutar</th><th>Ort. fiyat</th><th>Sık tercih</th><th>Ort. sıklık</th></tr></thead>
            <tbody>
              {buyerStats.map((r) => (
                <tr key={r.buyer.id}>
                  <td>{r.buyer.name}</td>
                  <td>{r.count}</td>
                  <td>{fmtKg(r.totalKg)}</td>
                  <td style={{ fontWeight: 600 }}>{fmtTL(r.totalAmount)}</td>
                  <td>{fmtTL(r.avgPrice)}/kg</td>
                  <td>{r.favoriteGrade ? <span className="zk-badge zk-badge-blue">{r.favoriteGrade}</span> : '—'}</td>
                  <td style={{ color: COLORS.inkSoft }}>{r.avgGapDays !== null ? `~${Math.round(r.avgGapDays)} günde bir` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AiSectionShell>
  );
}

function ReportArchiveSection({ reports, setReports }) {
  const remove = async (id) => {
    if (!window.confirm('Bu arşiv kaydını silmek istediğinize emin misiniz?')) return;
    const next = reports.filter((r) => r.id !== id);
    setReports(next);
    await storageSet('zk:aiReports', next);
  };
  const clearAll = async () => {
    setReports([]);
    await storageSet('zk:aiReports', []);
  };

  return (
    <AiSectionShell title="Rapor Arşivi" subtitle="Yönetici özeti gibi kaydedilen anlık görüntülerin geçmişi" icon={Archive}>
      {reports.length === 0 ? (
        <div className="zk-card"><div className="zk-empty"><Archive size={26} className="zk-empty-icon" /><br/>Henüz arşivlenmiş rapor yok. Yönetici Özeti sekmesinden "Arşive kaydet" ile ekleyebilirsiniz.</div></div>
      ) : (
        <>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="zk-btn zk-btn-secondary" onClick={clearAll}><Trash2 size={13} /> Tümünü temizle</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {reports.map((r) => (
              <div key={r.id} className="zk-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{r.type}</div>
                    <div style={{ fontSize: 11.5, color: COLORS.inkSoft }}>{fmtDate(r.date)} · {new Date(r.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => remove(r.id)}><X size={12} /></button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 8, fontSize: 12 }}>
                  <div><span style={{ color: COLORS.inkSoft }}>Alınan: </span><strong>{fmtKg(r.summary.totalKg)}</strong></div>
                  <div><span style={{ color: COLORS.inkSoft }}>Ödenen: </span><strong>{fmtTL(r.summary.totalPaid)}</strong></div>
                  <div><span style={{ color: COLORS.inkSoft }}>Tahmini kâr: </span><strong>{fmtTL(r.summary.estProfit)}</strong></div>
                  <div><span style={{ color: COLORS.inkSoft }}>Açık bakiye: </span><strong>{fmtTL(r.summary.totalOutstanding)}</strong></div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </AiSectionShell>
  );
}

function AiAssistantTab({ farmers, purchases, sales, expenses, payments, buyers, vehicles, maintenance, fuel, documents, insurance, damages, fines }) {
  const [section, setSection] = useState('summary');
  const [reports, setReports] = useState([]);
  const [loadedReports, setLoadedReports] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await storageGet('zk:aiReports');
      setReports(r || []);
      setLoadedReports(true);
    })();
  }, []);

  const sections = [
    { key: 'summary', label: 'Yönetici Özeti', icon: Sparkles },
    { key: 'maintenance', label: 'Arıza Tahmini', icon: Wrench },
    { key: 'cost', label: 'Maliyet Analizi', icon: Banknote },
    { key: 'price', label: 'Fiyat Optimizasyonu', icon: Target },
    { key: 'demand', label: 'Talep Tahmini', icon: Radar },
    { key: 'customer', label: 'Müşteri Davranışı', icon: UserCheck },
    { key: 'anomaly', label: 'Anomali Tespiti', icon: AlertOctagon },
    { key: 'risk', label: 'Cari Risk Analizi', icon: ShieldAlert },
    { key: 'archive', label: 'Rapor Arşivi', icon: Archive },
  ];

  return (
    <div>
      <div className="zk-h1">💬 AI Asistan</div>
      <div className="zk-h1-sub">Verilerinizden otomatik üretilen kural tabanlı analiz ve içgörüler — dış API kullanılmaz, tüm hesaplama tarayıcınızda yapılır</div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
        {sections.map((s) => (
          <button
            key={s.key}
            className={`zk-btn ${section === s.key ? 'zk-btn-primary' : 'zk-btn-secondary'}`}
            style={{ fontSize: 12 }}
            onClick={() => setSection(s.key)}
          >
            <s.icon size={13} /> {s.label}
          </button>
        ))}
      </div>

      {section === 'summary' && <ExecutiveSummarySection farmers={farmers} purchases={purchases} sales={sales} expenses={expenses} payments={payments} vehicles={vehicles} documents={documents} insurance={insurance} />}
      {section === 'maintenance' && <MaintenancePredictionSection vehicles={vehicles} maintenance={maintenance} fuel={fuel} />}
      {section === 'cost' && <BusinessCostSection expenses={expenses} vehicles={vehicles} maintenance={maintenance} fuel={fuel} fines={fines} insurance={insurance} damages={damages} />}
      {section === 'price' && <PriceOptimizationSection purchases={purchases} sales={sales} />}
      {section === 'demand' && <DemandForecastSection purchases={purchases} sales={sales} />}
      {section === 'customer' && <CustomerBehaviorSection buyers={buyers} sales={sales} />}
      {section === 'anomaly' && <AnomalySection purchases={purchases} farmers={farmers} />}
      {section === 'risk' && <CariRiskSection farmers={farmers} purchases={purchases} payments={payments} />}
      {section === 'archive' && loadedReports && <ReportArchiveSection reports={reports} setReports={setReports} />}
    </div>
  );
}

function FleetTab({ vehicles, setVehicles, personnel, setPersonnel, purchases, sales, farmers, buyers, maintenance, setMaintenance, fuel, setFuel, documents, setDocuments, insurance, setInsurance, damages, setDamages, fines, setFines, tires, setTires, settings }) {
  const [view, setView] = useState('vehicles');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [vehicleSubTab, setVehicleSubTab] = useState('overview');
  const [selectedPersonnelId, setSelectedPersonnelId] = useState('');
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showAddPersonnel, setShowAddPersonnel] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [editingPersonnel, setEditingPersonnel] = useState(null);

  const addVehicle = async (data) => {
    if (!data.plaka || !data.plaka.trim()) return;
    const newVehicle = { id: uid(), plaka: data.plaka.trim(), marka: data.marka || '', kapasite: data.kapasite || 0, defaultPersonnelId: data.defaultPersonnelId || '', createdAt: Date.now() };
    const next = [...vehicles, newVehicle];
    setVehicles(next);
    await storageSet('zk:vehicles', next);
    setShowAddVehicle(false);
  };

  const saveVehicleEdit = async (data) => {
    const next = vehicles.map((v) => (v.id === editingVehicle.id ? { ...v, ...data, plaka: data.plaka.trim() } : v));
    setVehicles(next);
    await storageSet('zk:vehicles', next);
    setEditingVehicle(null);
  };

  const removeVehicle = async (v) => {
    const hasHistory = purchases.some((p) => p.vehicleId === v.id) || sales.some((s) => s.vehicleId === v.id);
    const msg = hasHistory
      ? `${v.plaka} plakalı aracın alım/satış geçmişi var. Aracı silerseniz bu geçmiş kayıtlarda araç bilgisi görünmeye devam eder ama araç kaydı ve bakım/yakıt/evrak/sigorta/ceza/lastik verileri kalıcı olarak silinir. Emin misiniz?`
      : `${v.plaka} plakalı aracı silmek istediğinize emin misiniz?`;
    if (!window.confirm(msg)) return;
    const next = vehicles.filter((x) => x.id !== v.id);
    setVehicles(next);
    await storageSet('zk:vehicles', next);
    const cleanMaint = maintenance.filter((r) => r.vehicleId !== v.id);
    setMaintenance(cleanMaint); await storageSet('zk:vehicleMaintenance', cleanMaint);
    const cleanFuel = fuel.filter((r) => r.vehicleId !== v.id);
    setFuel(cleanFuel); await storageSet('zk:vehicleFuel', cleanFuel);
    const cleanDocs = documents.filter((r) => r.vehicleId !== v.id);
    setDocuments(cleanDocs); await storageSet('zk:vehicleDocuments', cleanDocs);
    const cleanIns = insurance.filter((r) => r.vehicleId !== v.id);
    setInsurance(cleanIns); await storageSet('zk:vehicleInsurance', cleanIns);
    const cleanDmg = damages.filter((r) => r.vehicleId !== v.id);
    setDamages(cleanDmg); await storageSet('zk:vehicleDamage', cleanDmg);
    const cleanFines = fines.filter((r) => r.vehicleId !== v.id);
    setFines(cleanFines); await storageSet('zk:vehicleFines', cleanFines);
    const cleanTires = tires.filter((r) => r.vehicleId !== v.id);
    setTires(cleanTires); await storageSet('zk:vehicleTires', cleanTires);
  };

  const addPersonnel = async (data) => {
    if (!data.name || !data.name.trim()) return;
    const newPerson = { id: uid(), name: data.name.trim(), phone: data.phone || '', role: data.role || '', createdAt: Date.now() };
    const next = [...personnel, newPerson];
    setPersonnel(next);
    await storageSet('zk:personnel', next);
    setShowAddPersonnel(false);
  };

  const savePersonnelEdit = async (data) => {
    const next = personnel.map((p) => (p.id === editingPersonnel.id ? { ...p, ...data, name: data.name.trim() } : p));
    setPersonnel(next);
    await storageSet('zk:personnel', next);
    setEditingPersonnel(null);
  };

  const removePersonnel = async (p) => {
    const hasHistory = purchases.some((x) => x.personnelId === p.id);
    const msg = hasHistory
      ? `${p.name} adına kayıtlı alım geçmişi var. Yine de silmek istediğinize emin misiniz?`
      : `${p.name} adlı personeli silmek istediğinize emin misiniz?`;
    if (!window.confirm(msg)) return;
    const next = personnel.filter((x) => x.id !== p.id);
    setPersonnel(next);
    await storageSet('zk:personnel', next);
  };

  const vehicleStats = useMemo(() => {
    const map = {};
    vehicles.forEach((v) => { map[v.id] = { pickups: 0, pickupKg: 0, deliveries: 0, deliveryKg: 0 }; });
    purchases.forEach((p) => {
      if (p.vehicleId && map[p.vehicleId]) { map[p.vehicleId].pickups += 1; map[p.vehicleId].pickupKg += p.netKg; }
    });
    sales.forEach((s) => {
      if (s.vehicleId && map[s.vehicleId]) { map[s.vehicleId].deliveries += 1; map[s.vehicleId].deliveryKg += s.kg; }
    });
    return map;
  }, [vehicles, purchases, sales]);

  const personnelStats = useMemo(() => {
    const map = {};
    personnel.forEach((p) => { map[p.id] = { count: 0, kg: 0, amount: 0 }; });
    purchases.forEach((p) => {
      if (p.personnelId && map[p.personnelId]) { map[p.personnelId].count += 1; map[p.personnelId].kg += p.netKg; map[p.personnelId].amount += p.netPayment; }
    });
    return map;
  }, [personnel, purchases]);

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
  const selectedPersonnel = personnel.find((p) => p.id === selectedPersonnelId);

  const vehiclePickups = selectedVehicle ? purchases.filter((p) => p.vehicleId === selectedVehicle.id).sort((a, b) => b.createdAt - a.createdAt) : [];
  const vehicleDeliveries = selectedVehicle ? sales.filter((s) => s.vehicleId === selectedVehicle.id).sort((a, b) => b.createdAt - a.createdAt) : [];
  const personnelPickups = selectedPersonnel ? purchases.filter((p) => p.personnelId === selectedPersonnel.id).sort((a, b) => b.createdAt - a.createdAt) : [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="zk-h1">Filo & Personel</div>
          <div className="zk-h1-sub">Hangi araç/personel nereden ne kadar topladı, kime teslim etti</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`zk-btn ${view === 'vehicles' ? 'zk-btn-primary' : 'zk-btn-secondary'}`} onClick={() => { setView('vehicles'); setSelectedPersonnelId(''); }}>
            <Truck size={14} /> Araçlar
          </button>
          <button className={`zk-btn ${view === 'personnel' ? 'zk-btn-primary' : 'zk-btn-secondary'}`} onClick={() => { setView('personnel'); setSelectedVehicleId(''); }}>
            <IdCard size={14} /> Personel
          </button>
        </div>
      </div>

      {view === 'vehicles' && !selectedVehicle && (
        <div className="zk-card" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>Araç listesi</div>
            <button className="zk-btn zk-btn-gold" onClick={() => setShowAddVehicle(true)}><Plus size={14} /> Araç ekle</button>
          </div>
          {vehicles.length === 0 ? (
            <div className="zk-empty"><Truck size={26} className="zk-empty-icon" /><br/>Henüz araç eklenmedi.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {vehicles.map((v) => {
                const stat = vehicleStats[v.id] || { pickups: 0, pickupKg: 0, deliveries: 0, deliveryKg: 0 };
                const driver = personnel.find((p) => p.id === v.defaultPersonnelId);
                return (
                  <div key={v.id} className="zk-farmer-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', flex: 1 }} onClick={() => { setSelectedVehicleId(v.id); setVehicleSubTab('overview'); }}>
                      <div className="zk-avatar"><Truck size={16} /></div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{v.plaka}</div>
                        <div style={{ fontSize: 11.5, color: COLORS.inkSoft }}>
                          {v.marka && `${v.marka} · `}{v.kapasite ? `${fmtKg(v.kapasite)} kapasite · ` : ''}{driver ? `Sürücü: ${driver.name}` : 'Sürücü atanmadı'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="zk-badge zk-badge-olive">{fmtKg(stat.pickupKg)} topladı</span>
                      <span className="zk-badge zk-badge-blue">{fmtKg(stat.deliveryKg)} teslim etti</span>
                      <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 8px' }} onClick={() => setEditingVehicle(v)}><Pencil size={12} /></button>
                      <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 8px' }} onClick={() => removeVehicle(v)}><Trash2 size={12} /></button>
                      <ChevronRight size={16} color={COLORS.inkSoft} style={{ cursor: 'pointer' }} onClick={() => { setSelectedVehicleId(v.id); setVehicleSubTab('overview'); }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {view === 'vehicles' && selectedVehicle && (
        <div style={{ marginTop: 16 }}>
          <button className="zk-btn zk-btn-secondary" style={{ marginBottom: 14 }} onClick={() => setSelectedVehicleId('')}>← Araç listesine dön</button>
          <div className="zk-h1" style={{ fontSize: 20 }}>{selectedVehicle.plaka}</div>
          <div className="zk-h1-sub">
            {selectedVehicle.marka && `${selectedVehicle.marka} · `}
            {personnel.find((p) => p.id === selectedVehicle.defaultPersonnelId)?.name ? `Varsayılan sürücü: ${personnel.find((p) => p.id === selectedVehicle.defaultPersonnelId).name}` : 'Sürücü atanmadı'}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
            {[
              { key: 'overview', label: 'Genel Bakış', icon: Truck },
              { key: 'maintenance', label: 'Bakım Takibi', icon: Wrench },
              { key: 'fuel', label: 'Yakıt Yönetimi', icon: Fuel },
              { key: 'documents', label: 'Evrak Takibi', icon: FileText },
              { key: 'insurance', label: 'Hasar & Sigorta', icon: ShieldAlert },
              { key: 'fines', label: 'Trafik Cezaları', icon: AlertTriangle },
              { key: 'tires', label: 'Lastik Takibi', icon: Disc },
              { key: 'cost', label: 'Maliyet Analizi', icon: TrendingUp },
            ].map((t) => (
              <button
                key={t.key}
                className={`zk-btn ${vehicleSubTab === t.key ? 'zk-btn-primary' : 'zk-btn-secondary'}`}
                style={{ fontSize: 12 }}
                onClick={() => setVehicleSubTab(t.key)}
              >
                <t.icon size={13} /> {t.label}
              </button>
            ))}
          </div>

          {vehicleSubTab === 'overview' && (
            <div>
              <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 18 }}>
                <StatCard label="Toplama sayısı" value={vehiclePickups.length} icon={Package} />
                <StatCard label="Toplam toplanan" value={fmtKg(vehicleStats[selectedVehicle.id]?.pickupKg || 0)} tone={COLORS.olive} />
                <StatCard label="Teslimat sayısı" value={vehicleDeliveries.length} icon={ShoppingCart} />
                <StatCard label="Toplam teslim edilen" value={fmtKg(vehicleStats[selectedVehicle.id]?.deliveryKg || 0)} tone={COLORS.blue} />
              </div>

              <div className="zk-card" style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Toplama geçmişi — nereden ne kadar aldı</div>
                {vehiclePickups.length === 0 ? (
                  <div className="zk-empty">Bu araca bağlı toplama kaydı yok.</div>
                ) : (
                  <table className="zk-table">
                    <thead><tr><th>Tarih</th><th>Çiftçi</th><th>Personel</th><th>Sınıflar</th><th>Net kg</th></tr></thead>
                    <tbody>
                      {vehiclePickups.map((p) => {
                        const f = farmers.find((x) => x.id === p.farmerId);
                        return (
                          <tr key={p.id}>
                            <td>{fmtDate(p.date)}{p.time ? ` · ${p.time}` : ''}</td>
                            <td>{f ? f.name : '—'}</td>
                            <td style={{ color: COLORS.inkSoft }}>{p.personnelName || '—'}</td>
                            <td style={{ fontSize: 11.5, color: COLORS.inkSoft }}>{(p.items || []).map((it) => it.grade).join(', ')}</td>
                            <td style={{ fontWeight: 600 }}>{fmtKg(p.netKg)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="zk-card">
                <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Teslimat geçmişi — kime götürdü</div>
                {vehicleDeliveries.length === 0 ? (
                  <div className="zk-empty">Bu araca bağlı teslimat kaydı yok.</div>
                ) : (
                  <table className="zk-table">
                    <thead><tr><th>Tarih</th><th>Alıcı</th><th>Sınıf</th><th>Kg</th><th>Tutar</th></tr></thead>
                    <tbody>
                      {vehicleDeliveries.map((s) => {
                        const b = buyers.find((x) => x.id === s.buyerId);
                        return (
                          <tr key={s.id}>
                            <td>{fmtDate(s.date)}</td>
                            <td>{b ? b.name : '—'}</td>
                            <td><span className="zk-badge zk-badge-blue">{s.grade || '—'}</span></td>
                            <td>{fmtKg(s.kg)}</td>
                            <td style={{ fontWeight: 600 }}>{fmtTL(s.amount)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {vehicleSubTab === 'maintenance' && <MaintenanceSection vehicleId={selectedVehicle.id} records={maintenance} setRecords={setMaintenance} />}
          {vehicleSubTab === 'fuel' && <FuelSection vehicleId={selectedVehicle.id} records={fuel} setRecords={setFuel} settings={settings} />}
          {vehicleSubTab === 'documents' && <DocumentsSection vehicleId={selectedVehicle.id} records={documents} setRecords={setDocuments} />}
          {vehicleSubTab === 'insurance' && <InsuranceDamageSection vehicleId={selectedVehicle.id} insurance={insurance} setInsurance={setInsurance} damages={damages} setDamages={setDamages} />}
          {vehicleSubTab === 'fines' && <FinesSection vehicleId={selectedVehicle.id} records={fines} setRecords={setFines} />}
          {vehicleSubTab === 'tires' && <TiresSection vehicleId={selectedVehicle.id} records={tires} setRecords={setTires} />}
          {vehicleSubTab === 'cost' && (
            <CostAnalysisSection
              vehicleId={selectedVehicle.id}
              maintenance={maintenance} fuel={fuel} fines={fines} insurance={insurance} damages={damages}
              vehiclePickups={vehiclePickups} vehicleDeliveries={vehicleDeliveries}
            />
          )}
        </div>
      )}

      {view === 'personnel' && !selectedPersonnel && (
        <div className="zk-card" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>Personel listesi</div>
            <button className="zk-btn zk-btn-gold" onClick={() => setShowAddPersonnel(true)}><Plus size={14} /> Personel ekle</button>
          </div>
          {personnel.length === 0 ? (
            <div className="zk-empty"><IdCard size={26} className="zk-empty-icon" /><br/>Henüz personel eklenmedi.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {personnel.map((p) => {
                const stat = personnelStats[p.id] || { count: 0, kg: 0, amount: 0 };
                return (
                  <div key={p.id} className="zk-farmer-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', flex: 1 }} onClick={() => setSelectedPersonnelId(p.id)}>
                      <div className="zk-avatar">{p.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{p.name}</div>
                        <div style={{ fontSize: 11.5, color: COLORS.inkSoft }}>
                          {p.role && `${p.role} · `}{p.phone || 'Telefon kayıtlı değil'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="zk-badge zk-badge-olive">{stat.count} alım</span>
                      <span className="zk-badge zk-badge-gold">{fmtKg(stat.kg)}</span>
                      <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 8px' }} onClick={() => setEditingPersonnel(p)}><Pencil size={12} /></button>
                      <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 8px' }} onClick={() => removePersonnel(p)}><Trash2 size={12} /></button>
                      <ChevronRight size={16} color={COLORS.inkSoft} style={{ cursor: 'pointer' }} onClick={() => setSelectedPersonnelId(p.id)} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {view === 'personnel' && selectedPersonnel && (
        <div style={{ marginTop: 16 }}>
          <button className="zk-btn zk-btn-secondary" style={{ marginBottom: 14 }} onClick={() => setSelectedPersonnelId('')}>← Personel listesine dön</button>
          <div className="zk-h1" style={{ fontSize: 20 }}>{selectedPersonnel.name}</div>
          <div className="zk-h1-sub">{selectedPersonnel.role || 'Görev belirtilmedi'}{selectedPersonnel.phone ? ` · ${selectedPersonnel.phone}` : ''}</div>

          <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 18 }}>
            <StatCard label="Toplam alım" value={personnelStats[selectedPersonnel.id]?.count || 0} icon={Package} />
            <StatCard label="Toplam kg" value={fmtKg(personnelStats[selectedPersonnel.id]?.kg || 0)} tone={COLORS.olive} />
            <StatCard label="Çiftçilere ödenen" value={fmtTL(personnelStats[selectedPersonnel.id]?.amount || 0)} tone={COLORS.gold} />
          </div>

          <div className="zk-card">
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Yaptığı alımlar</div>
            {personnelPickups.length === 0 ? (
              <div className="zk-empty">Bu personele bağlı alım kaydı yok.</div>
            ) : (
              <table className="zk-table">
                <thead><tr><th>Tarih</th><th>Çiftçi</th><th>Araç</th><th>Sınıflar</th><th>Net kg</th><th>Net ödeme</th></tr></thead>
                <tbody>
                  {personnelPickups.map((p) => {
                    const f = farmers.find((x) => x.id === p.farmerId);
                    return (
                      <tr key={p.id}>
                        <td>{fmtDate(p.date)}{p.time ? ` · ${p.time}` : ''}</td>
                        <td>{f ? f.name : '—'}</td>
                        <td style={{ color: COLORS.inkSoft }}>{p.vehiclePlaka || '—'}</td>
                        <td style={{ fontSize: 11.5, color: COLORS.inkSoft }}>{(p.items || []).map((it) => it.grade).join(', ')}</td>
                        <td style={{ fontWeight: 600 }}>{fmtKg(p.netKg)}</td>
                        <td>{fmtTL(p.netPayment)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {showAddVehicle && <AddVehicleModal onClose={() => setShowAddVehicle(false)} onSave={addVehicle} personnel={personnel} />}
      {showAddPersonnel && <AddPersonnelModal onClose={() => setShowAddPersonnel(false)} onSave={addPersonnel} />}
      {editingVehicle && <AddVehicleModal onClose={() => setEditingVehicle(null)} onSave={saveVehicleEdit} personnel={personnel} initialData={editingVehicle} />}
      {editingPersonnel && <AddPersonnelModal onClose={() => setEditingPersonnel(null)} onSave={savePersonnelEdit} initialData={editingPersonnel} />}
    </div>
  );
}

function LedgerTab({ farmers, purchases, payments, setPayments, selectedFarmerId, setSelectedFarmerId, onPrintReceipt, settings }) {
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [payType, setPayType] = useState('odeme');

  const farmer = farmers.find((f) => f.id === selectedFarmerId);

  const entries = useMemo(() => {
    if (!farmer) return [];
    const p = purchases.filter((x) => x.farmerId === farmer.id).map((x) => ({ type: 'purchase', date: x.date, createdAt: x.createdAt, amount: x.netPayment, data: x }));
    const pay = payments.filter((x) => x.farmerId === farmer.id).map((x) => ({ type: 'payment', date: x.date, createdAt: x.createdAt, amount: -x.amount, data: x }));
    return [...p, ...pay].sort((a, b) => a.createdAt - b.createdAt);
  }, [farmer, purchases, payments]);

  let running = 0;
  const withRunning = entries.map((e) => { running += e.amount; return { ...e, running }; });
  const balance = running;

  const addPayment = async () => {
    const amt = parseFloat(payAmount);
    if (!farmer || !amt || amt <= 0) return;
    const record = { id: uid(), farmerId: farmer.id, date: todayStr(), amount: amt, note: payNote, payType, createdAt: Date.now() };
    const next = [...payments, record];
    setPayments(next);
    await storageSet('zk:payments', next);
    setPayAmount(''); setPayNote('');
  };

  const removePayment = async (id) => {
    if (!window.confirm('Bu ödeme/avans kaydını silmek istediğinize emin misiniz?')) return;
    const next = payments.filter((p) => p.id !== id);
    setPayments(next);
    await storageSet('zk:payments', next);
  };

  if (!farmer) {
    return (
      <div>
        <div className="zk-h1">Cari hesap</div>
        <div className="zk-h1-sub">Görüntülemek için bir çiftçi seçin</div>
        <div className="zk-card">
          <select className="zk-select" value="" onChange={(e) => setSelectedFarmerId(e.target.value)}>
            <option value="">Çiftçi seçin...</option>
            {farmers.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="zk-h1">{farmer.name}</div>
          <div className="zk-h1-sub">Cari hesap özeti</div>
        </div>
        <select className="zk-select" style={{ width: 200 }} value={selectedFarmerId} onChange={(e) => setSelectedFarmerId(e.target.value)}>
          {farmers.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>

      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 18 }}>
        <StatCard label="Güncel bakiye" value={fmtTL(Math.abs(balance))} tone={balance > 0 ? COLORS.red : COLORS.olive} />
        <StatCard label="Durum" value={balance > 0 ? 'Ödenecek' : 'Kapalı'} />
        <StatCard label="Toplam işlem" value={entries.length} />
      </div>

      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Ödeme / avans ekle</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select className="zk-select" value={payType} onChange={(e) => setPayType(e.target.value)} style={{ maxWidth: 140 }}>
            <option value="odeme">Ödeme</option>
            <option value="avans">Avans</option>
          </select>
          <input className="zk-input" type="number" placeholder="Tutar (TL)" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} style={{ maxWidth: 160 }} />
          <input className="zk-input" placeholder="Not (opsiyonel)" value={payNote} onChange={(e) => setPayNote(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
          <button className="zk-btn zk-btn-primary" onClick={addPayment}>Ekle</button>
        </div>
      </div>

      <div className="zk-card">
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Hareketler</div>
        {withRunning.length === 0 ? (
          <div className="zk-empty">Henüz hareket yok.</div>
        ) : (
          <table className="zk-table">
            <thead><tr><th>Tarih</th><th>İşlem</th><th>Tutar</th><th>Bakiye</th><th></th></tr></thead>
            <tbody>
              {withRunning.slice().reverse().map((e, i) => (
                <tr key={i}>
                  <td>{fmtDate(e.date)}</td>
                  <td>
                    {e.type === 'purchase'
                      ? <span className="zk-badge zk-badge-olive">Alım · {fmtKg(e.data.netKg)}</span>
                      : <span className={`zk-badge ${e.data.payType === 'avans' ? 'zk-badge-blue' : 'zk-badge-gold'}`}>{e.data.payType === 'avans' ? 'Avans' : 'Ödeme'}{e.data.note ? ` · ${e.data.note}` : ''}</span>}
                  </td>
                  <td style={{ color: e.amount >= 0 ? COLORS.olive : COLORS.gold, fontWeight: 600 }}>
                    {e.amount >= 0 ? '+' : ''}{fmtTL(e.amount)}
                  </td>
                  <td style={{ fontWeight: 600 }}>{fmtTL(e.running)}</td>
                  <td>
                    {e.type === 'purchase' ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 9px' }} onClick={() => onPrintReceipt(e.data)}><Printer size={12} /></button>
                        {formatPhoneForWhatsApp(farmer.phone) && (
                          <a className="zk-btn" style={{ padding: '5px 9px', background: '#25D366', color: '#fff' }} href={`https://wa.me/${formatPhoneForWhatsApp(farmer.phone)}?text=${encodeURIComponent(buildWhatsAppReceiptText(e.data, farmer, settings))}`} target="_blank" rel="noopener noreferrer">
                            <MessageCircle size={12} />
                          </a>
                        )}
                      </div>
                    ) : (
                      <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 9px' }} onClick={() => removePayment(e.data.id)}><Trash2 size={12} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ReportsTab({ farmers, purchases, sales, buyers, expenses }) {
  const [range, setRange] = useState('month');
  const currentYear = new Date().getFullYear();
  const [yearA, setYearA] = useState(currentYear);
  const [yearB, setYearB] = useState(currentYear - 1);

  const filtered = useMemo(() => {
    const now = new Date();
    return purchases.filter((p) => {
      const d = new Date(p.date);
      if (range === 'today') return p.date === todayStr();
      if (range === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      return true;
    });
  }, [purchases, range]);

  const filteredSales = useMemo(() => {
    const now = new Date();
    return sales.filter((s) => {
      const d = new Date(s.date);
      if (range === 'today') return s.date === todayStr();
      if (range === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      return true;
    });
  }, [sales, range]);

  const filteredExpenses = useMemo(() => {
    const now = new Date();
    return expenses.filter((e) => {
      const d = new Date(e.date);
      if (range === 'today') return e.date === todayStr();
      if (range === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      return true;
    });
  }, [expenses, range]);

  const totalKg = filtered.reduce((s, p) => s + p.netKg, 0);
  const totalAmount = filtered.reduce((s, p) => s + p.amount, 0);
  const totalCommission = filtered.reduce((s, p) => s + p.commissionAmount, 0);
  const totalStopaj = filtered.reduce((s, p) => s + (p.stopajTutari || 0), 0);
  const totalPayable = filtered.reduce((s, p) => s + p.netPayment, 0);
  const totalSalesAmount = filteredSales.reduce((s, s2) => s + s2.amount, 0);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const estimatedProfit = totalCommission + totalSalesAmount - totalExpenses;

  const yearStats = (year) => {
    const yp = purchases.filter((p) => new Date(p.date).getFullYear() === year);
    const ys = sales.filter((s) => new Date(s.date).getFullYear() === year);
    const ye = expenses.filter((e) => new Date(e.date).getFullYear() === year);
    return {
      kg: yp.reduce((s, p) => s + p.netKg, 0),
      purchaseAmount: yp.reduce((s, p) => s + p.netPayment, 0),
      commission: yp.reduce((s, p) => s + p.commissionAmount, 0),
      salesAmount: ys.reduce((s, s2) => s + s2.amount, 0),
      expenseAmount: ye.reduce((s, e) => s + e.amount, 0),
      count: yp.length,
    };
  };
  const statsA = yearStats(parseInt(yearA, 10));
  const statsB = yearStats(parseInt(yearB, 10));
  const availableYears = useMemo(() => {
    const years = new Set([currentYear]);
    purchases.forEach((p) => years.add(new Date(p.date).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [purchases, currentYear]);

  const byFarmer = useMemo(() => {
    const map = {};
    filtered.forEach((p) => {
      if (!map[p.farmerId]) map[p.farmerId] = { kg: 0, amount: 0, count: 0 };
      map[p.farmerId].kg += p.netKg;
      map[p.farmerId].amount += p.netPayment;
      map[p.farmerId].count += 1;
    });
    return Object.entries(map).map(([farmerId, v]) => ({ farmerId, ...v })).sort((a, b) => b.kg - a.kg);
  }, [filtered]);

  const chartData = byFarmer.slice(0, 8).map((row) => {
    const f = farmers.find((x) => x.id === row.farmerId);
    return { name: f ? f.name.split(' ')[0] : '—', kg: Math.round(row.kg * 10) / 10 };
  });

  const byGrade = useMemo(() => {
    const map = {};
    filtered.forEach((p) => {
      (p.items || []).forEach((it) => {
        if (!map[it.grade]) map[it.grade] = { kg: 0, amount: 0 };
        map[it.grade].kg += it.kg;
        map[it.grade].amount += it.amount;
      });
    });
    return Object.entries(map).map(([grade, v]) => ({ grade, ...v })).sort((a, b) => b.kg - a.kg);
  }, [filtered]);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    const purchaseRows = filtered.map((p) => {
      const f = farmers.find((x) => x.id === p.farmerId);
      return {
        'Makbuz No': p.makbuzNo,
        'Tarih': p.date,
        'Çiftçi': f ? f.name : '',
        'TC No': f ? f.tcNo : '',
        'Net kg': p.netKg,
        'Tutar': p.amount,
        'Komisyon %': p.commissionRate,
        'Komisyon tutarı': p.commissionAmount,
        'Stopaj %': p.stopajOrani,
        'Stopaj tutarı': p.stopajTutari,
        'BAĞ-KUR tutarı': p.bagkurTutari || 0,
        'Net ödenen': p.netPayment,
      };
    });
    const wsPurchases = XLSX.utils.json_to_sheet(purchaseRows);
    XLSX.utils.book_append_sheet(wb, wsPurchases, 'Alimlar');

    const detailRows = [];
    filtered.forEach((p) => {
      const f = farmers.find((x) => x.id === p.farmerId);
      (p.items || []).forEach((it) => {
        detailRows.push({
          'Makbuz No': p.makbuzNo,
          'Tarih': p.date,
          'Çiftçi': f ? f.name : '',
          'Sınıf': it.grade,
          'Kg': it.kg,
          'Kg fiyatı': it.pricePerKg,
          'Tutar': it.amount,
        });
      });
    });
    const wsDetail = XLSX.utils.json_to_sheet(detailRows);
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Alim Detay (Sinif)');

    const salesRows = filteredSales.map((s) => {
      const b = buyers.find((x) => x.id === s.buyerId);
      return { 'Tarih': s.date, 'Alıcı': b ? b.name : '', 'Sınıf': s.grade || '', 'Kg': s.kg, 'Kg fiyatı': s.pricePerKg, 'Tutar': s.amount, 'Not': s.note || '' };
    });
    const wsSales = XLSX.utils.json_to_sheet(salesRows);
    XLSX.utils.book_append_sheet(wb, wsSales, 'Satislar');

    const summaryRows = byFarmer.map((row) => {
      const f = farmers.find((x) => x.id === row.farmerId);
      return { 'Çiftçi': f ? f.name : '', 'İşlem sayısı': row.count, 'Toplam kg': row.kg, 'Tutar': row.amount };
    });
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Ciftci Ozeti');

    const expenseRows = filteredExpenses.map((e) => ({ 'Tarih': e.date, 'Kategori': e.category, 'Tutar': e.amount, 'Not': e.note || '' }));
    const wsExpenses = XLSX.utils.json_to_sheet(expenseRows);
    XLSX.utils.book_append_sheet(wb, wsExpenses, 'Giderler');

    XLSX.writeFile(wb, `zeytin-rapor-${todayStr()}.xlsx`);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="zk-h1">Raporlar</div>
          <div className="zk-h1-sub">Toplam alım, satış ve kesinti özeti</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="zk-select" style={{ width: 130 }} value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="today">Bugün</option>
            <option value="month">Bu ay</option>
            <option value="all">Tümü</option>
          </select>
          <button className="zk-btn zk-btn-blue" onClick={exportExcel}><Download size={13} /> Excel</button>
        </div>
      </div>

      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 16 }}>
        <StatCard label="Toplam kg" value={fmtKg(totalKg)} />
        <StatCard label="Ürün tutarı" value={fmtTL(totalAmount)} />
        <StatCard label="Komisyon" value={fmtTL(totalCommission)} tone={COLORS.gold} />
        <StatCard label="Stopaj" value={fmtTL(totalStopaj)} tone={COLORS.blue} />
        <StatCard label="Çiftçilere ödenen" value={fmtTL(totalPayable)} tone={COLORS.olive} />
        <StatCard label="Satış tutarı" value={fmtTL(totalSalesAmount)} />
        <StatCard label="Giderler" value={fmtTL(totalExpenses)} tone={COLORS.red} />
        <StatCard label="Tahmini kâr" value={fmtTL(estimatedProfit)} tone={estimatedProfit >= 0 ? COLORS.olive : COLORS.red} />
      </div>
      <div style={{ fontSize: 11, color: COLORS.inkSoft, marginBottom: 16, marginTop: -8 }}>
        Tahmini kâr = komisyon geliri + satış tutarı − giderler (kaba bir tahmindir, muhasebe kaydı yerine geçmez).
      </div>

      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>Dönem karşılaştırma</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5 }}>
            <select className="zk-select" style={{ width: 100 }} value={yearA} onChange={(e) => setYearA(e.target.value)}>
              {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <span style={{ color: COLORS.inkSoft }}>vs</span>
            <select className="zk-select" style={{ width: 100 }} value={yearB} onChange={(e) => setYearB(e.target.value)}>
              {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <table className="zk-table">
          <thead><tr><th></th><th>{yearA}</th><th>{yearB}</th></tr></thead>
          <tbody>
            <tr><td>Alım sayısı</td><td>{statsA.count}</td><td>{statsB.count}</td></tr>
            <tr><td>Toplam kg</td><td>{fmtKg(statsA.kg)}</td><td>{fmtKg(statsB.kg)}</td></tr>
            <tr><td>Çiftçilere ödenen</td><td>{fmtTL(statsA.purchaseAmount)}</td><td>{fmtTL(statsB.purchaseAmount)}</td></tr>
            <tr><td>Komisyon geliri</td><td>{fmtTL(statsA.commission)}</td><td>{fmtTL(statsB.commission)}</td></tr>
            <tr><td>Satış tutarı</td><td>{fmtTL(statsA.salesAmount)}</td><td>{fmtTL(statsB.salesAmount)}</td></tr>
            <tr><td>Giderler</td><td>{fmtTL(statsA.expenseAmount)}</td><td>{fmtTL(statsB.expenseAmount)}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Çiftçi bazında kg dağılımı</div>
        {chartData.length === 0 ? (
          <div className="zk-empty">Bu aralıkta kayıt yok.</div>
        ) : (
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFEBDD" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: COLORS.inkSoft }} />
                <YAxis tick={{ fontSize: 10, fill: COLORS.inkSoft }} width={40} />
                <Tooltip formatter={(v) => [v + ' kg', 'Alım']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="kg" fill={COLORS.olive} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Sınıf / numara bazında toplam</div>
        {byGrade.length === 0 ? (
          <div className="zk-empty">Bu aralıkta kayıt yok.</div>
        ) : (
          <table className="zk-table">
            <thead><tr><th>Sınıf</th><th>Toplam kg</th><th>Tutar</th></tr></thead>
            <tbody>
              {byGrade.map((row) => (
                <tr key={row.grade}>
                  <td><span className="zk-badge zk-badge-blue">{row.grade}</span></td>
                  <td>{fmtKg(row.kg)}</td>
                  <td>{fmtTL(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="zk-card">
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Çiftçi bazında dağılım (tablo)</div>
        {byFarmer.length === 0 ? (
          <div className="zk-empty">Bu aralıkta kayıt yok.</div>
        ) : (
          <table className="zk-table">
            <thead><tr><th>Çiftçi</th><th>İşlem sayısı</th><th>Toplam kg</th><th>Tutar</th></tr></thead>
            <tbody>
              {byFarmer.map((row) => {
                const f = farmers.find((x) => x.id === row.farmerId);
                return (
                  <tr key={row.farmerId}>
                    <td>{f ? f.name : '—'}</td>
                    <td>{row.count}</td>
                    <td>{fmtKg(row.kg)}</td>
                    <td>{fmtTL(row.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function VarietyEditor({ variety, onChange, onRemove }) {
  const [newGradeName, setNewGradeName] = useState('');
  const [newGradePrice, setNewGradePrice] = useState('');

  const toggleHasGrades = () => onChange({ ...variety, hasGrades: !variety.hasGrades });
  const setSinglePrice = (price) => onChange({ ...variety, singlePrice: parseFloat(price) || 0 });
  const updateGradePrice = (gradeId, price) => onChange({ ...variety, grades: variety.grades.map((g) => (g.id === gradeId ? { ...g, price: parseFloat(price) || 0 } : g)) });
  const removeGradeRow = (gradeId) => onChange({ ...variety, grades: variety.grades.filter((g) => g.id !== gradeId) });
  const addGradeRow = () => {
    if (!newGradeName.trim()) return;
    onChange({ ...variety, grades: [...variety.grades, { id: uid(), name: newGradeName.trim(), price: parseFloat(newGradePrice) || 0 }] });
    setNewGradeName(''); setNewGradePrice('');
  };

  return (
    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 13.5 }}>{variety.name}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label className="zk-checkbox-row" style={{ fontSize: 11.5 }}>
            <input type="checkbox" checked={variety.hasGrades} onChange={toggleHasGrades} />
            Numaraya ayrılıyor
          </label>
          <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={onRemove}><X size={12} /></button>
        </div>
      </div>

      {!variety.hasGrades ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12.5, color: COLORS.inkSoft }}>Kg fiyatı</span>
          <input className="zk-input" type="number" value={variety.singlePrice || 0} onChange={(e) => setSinglePrice(e.target.value)} style={{ width: 100 }} />
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
            {variety.grades.map((g) => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1, fontSize: 12.5 }}>{g.name}</span>
                <input className="zk-input" type="number" value={g.price} onChange={(e) => updateGradePrice(g.id, e.target.value)} style={{ width: 85 }} />
                <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 7px' }} onClick={() => removeGradeRow(g.id)}><X size={11} /></button>
              </div>
            ))}
            {variety.grades.length === 0 && <div style={{ fontSize: 11.5, color: COLORS.inkSoft }}>Henüz numara eklenmedi.</div>}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="zk-input" value={newGradeName} onChange={(e) => setNewGradeName(e.target.value)} placeholder="örn. 1 Numara" style={{ fontSize: 12.5 }} />
            <input className="zk-input" type="number" value={newGradePrice} onChange={(e) => setNewGradePrice(e.target.value)} placeholder="Fiyat" style={{ width: 80 }} />
            <button className="zk-btn zk-btn-secondary" style={{ padding: '6px 10px' }} onClick={addGradeRow}><Plus size={12} /></button>
          </div>
        </>
      )}
    </div>
  );
}

function TagChipList({ items, onChange, placeholder }) {
  const [newItem, setNewItem] = useState('');
  const add = () => {
    if (!newItem.trim()) return;
    onChange([...items, newItem.trim()]);
    setNewItem('');
  };
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx));
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {items.map((item, i) => (
          <span key={i} className="zk-badge zk-badge-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            {item}
            <X size={10} style={{ cursor: 'pointer' }} onClick={() => remove(i)} />
          </span>
        ))}
        {items.length === 0 && <span style={{ fontSize: 12, color: COLORS.inkSoft }}>Henüz kategori yok.</span>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="zk-input" value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder={placeholder} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button className="zk-btn zk-btn-gold" onClick={add}><Plus size={13} /></button>
      </div>
    </div>
  );
}

function TaxRateList({ rates, onChange }) {
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');
  const add = () => {
    if (!name.trim() || rate === '') return;
    onChange([...rates, { id: uid(), name: name.trim(), rate: parseFloat(rate) || 0 }]);
    setName(''); setRate('');
  };
  const remove = (id) => onChange(rates.filter((r) => r.id !== id));
  return (
    <div>
      <table className="zk-table" style={{ marginBottom: 12 }}>
        <thead><tr><th>Ad</th><th>Oran (%)</th><th></th></tr></thead>
        <tbody>
          {rates.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>%{r.rate}</td>
              <td><button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => remove(r.id)}><Trash2 size={12} /></button></td>
            </tr>
          ))}
          {rates.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: COLORS.inkSoft, padding: 16 }}>Henüz vergi oranı yok.</td></tr>}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="zk-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ad (örn. KDV %8)" style={{ flex: 2 }} />
        <input className="zk-input" type="number" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Oran" style={{ flex: 1 }} />
        <button className="zk-btn zk-btn-gold" onClick={add}><Plus size={13} /></button>
      </div>
    </div>
  );
}

const ACCENT_PRESETS = ['#B3892B', '#3B5E73', '#A13D2E', '#5C6B44', '#7A4F9E', '#B34A6B'];

function SettingsTab({ settings, setSettings, priceList, setPriceList, onBackup, onRestore, restoreStatus }) {
  const [tab, setTab] = useState('genel');

  const [currencySymbol, setCurrencySymbol] = useState(settings.currencySymbol || '₺');
  const [dateFormat, setDateFormat] = useState(settings.dateFormat || 'DMY');
  const [defaultVatRate, setDefaultVatRate] = useState(settings.defaultVatRate ?? 20);
  const [defaultFuelPrice, setDefaultFuelPrice] = useState(settings.defaultFuelPrice ?? '');
  const [crateWeight, setCrateWeight] = useState(settings.crateWeight ?? 2);
  const [defaultCrateCount, setDefaultCrateCount] = useState(settings.defaultCrateCount ?? 5);
  const [defaultCommissionRate, setDefaultCommissionRate] = useState(settings.defaultCommissionRate ?? 3);
  const [defaultBagkurRate, setDefaultBagkurRate] = useState(settings.defaultBagkurRate ?? 1);
  const [defaultNoDeduction, setDefaultNoDeduction] = useState(settings.defaultNoDeduction ?? true);
  const [docWarningDays, setDocWarningDays] = useState(settings.docWarningDays ?? 30);
  const [cariRiskDays, setCariRiskDays] = useState(settings.cariRiskDays ?? 45);
  const [cariRiskWarningDays, setCariRiskWarningDays] = useState(settings.cariRiskWarningDays ?? 20);
  const [maintenanceWarningKm, setMaintenanceWarningKm] = useState(settings.maintenanceWarningKm ?? 500);

  const [logo, setLogo] = useState(settings.logo || '');
  const [businessName, setBusinessName] = useState(settings.businessName || '');
  const [address, setAddress] = useState(settings.address || '');
  const [phone, setPhone] = useState(settings.phone || '');
  const [taxNo, setTaxNo] = useState(settings.taxNo || '');
  const [taxOffice, setTaxOffice] = useState(settings.taxOffice || '');

  const [incomeCategories, setIncomeCategories] = useState(settings.incomeCategories && settings.incomeCategories.length > 0 ? settings.incomeCategories : INCOME_CATEGORIES);
  const [expenseCategories, setExpenseCategories] = useState(settings.expenseCategories && settings.expenseCategories.length > 0 ? settings.expenseCategories : EXPENSE_CATEGORIES);

  const [taxRates, setTaxRates] = useState(settings.taxRates || [
    { id: uid(), name: 'KDV %20', rate: 20 },
    { id: uid(), name: 'KDV %10', rate: 10 },
    { id: uid(), name: 'KDV %1', rate: 1 },
    { id: uid(), name: 'KDV %0 (İstisna)', rate: 0 },
  ]);

  const [theme, setTheme] = useState(settings.theme || 'light');
  const [accentColor, setAccentColor] = useState(settings.accentColor || '#B3892B');
  const [sidebarDensity, setSidebarDensity] = useState(settings.sidebarDensity || 'normal');
  const [fontSize, setFontSize] = useState(settings.fontSize || 'normal');

  const [newVarietyName, setNewVarietyName] = useState('');
  const [savedNote, setSavedNote] = useState('');

  const buildNext = () => ({
    currencySymbol, dateFormat,
    defaultVatRate: parseFloat(defaultVatRate) || 0,
    defaultFuelPrice: parseFloat(defaultFuelPrice) || 0,
    crateWeight: parseFloat(crateWeight) || 0,
    defaultCrateCount: Math.max(0, Math.min(7, parseInt(defaultCrateCount, 10) || 0)),
    defaultCommissionRate: parseFloat(defaultCommissionRate) || 0,
    defaultBagkurRate: parseFloat(defaultBagkurRate) || 0,
    defaultNoDeduction,
    docWarningDays: parseInt(docWarningDays, 10) || 30,
    cariRiskDays: parseInt(cariRiskDays, 10) || 45,
    cariRiskWarningDays: parseInt(cariRiskWarningDays, 10) || 20,
    maintenanceWarningKm: parseInt(maintenanceWarningKm, 10) || 500,
    logo, businessName, address, phone, taxNo, taxOffice,
    incomeCategories, expenseCategories, taxRates,
    theme, accentColor, sidebarDensity, fontSize,
    openingCashBalance: settings.openingCashBalance ?? 0,
  });

  const save = async () => {
    const next = buildNext();
    applyAppearance(next);
    setSettings(next);
    await storageSet('zk:settings', next);
    setSavedNote('Ayarlar kaydedildi.');
    setTimeout(() => setSavedNote(''), 2500);
  };

  const handleLogoUpload = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 200;
        let w = img.width, h = img.height;
        if (w > h && w > maxDim) { h = Math.round((h * maxDim) / w); w = maxDim; }
        else if (h > maxDim) { w = Math.round((w * maxDim) / h); h = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        setLogo(canvas.toDataURL('image/png'));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const updateVariety = async (updated) => {
    const next = priceList.map((v) => (v.id === updated.id ? updated : v));
    setPriceList(next);
    await storageSet('zk:priceList', next);
  };

  const removeVariety = async (id) => {
    if (!window.confirm('Bu türü ve tüm fiyat listesini silmek istediğinize emin misiniz?')) return;
    const next = priceList.filter((v) => v.id !== id);
    setPriceList(next);
    await storageSet('zk:priceList', next);
  };

  const addVariety = async () => {
    if (!newVarietyName.trim()) return;
    const next = [...priceList, { id: uid(), name: newVarietyName.trim(), hasGrades: true, singlePrice: 0, grades: [] }];
    setPriceList(next);
    await storageSet('zk:priceList', next);
    setNewVarietyName('');
  };

  const settingsTabs = [
    { key: 'genel', label: 'Genel' },
    { key: 'firma', label: 'Firma' },
    { key: 'fiyat', label: 'Fiyat Listesi' },
    { key: 'kategoriler', label: 'Kategoriler' },
    { key: 'vergi', label: 'Vergi' },
    { key: 'gorunum', label: 'Görünüm' },
    { key: 'yedek', label: 'Yedekleme' },
  ];

  return (
    <div>
      <div className="zk-h1">Ayarlar</div>
      <div className="zk-h1-sub">İşletme bilgileri, alım varsayılanları, kategoriler, vergi ve görünüm ayarları</div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
        {settingsTabs.map((t) => (
          <button key={t.key} className={`zk-btn ${tab === t.key ? 'zk-btn-primary' : 'zk-btn-secondary'}`} style={{ fontSize: 12 }} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 920 }}>
        {tab === 'genel' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="zk-card">
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Biçim</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 14 }}>
                <div>
                  <label className="zk-label">Para birimi sembolü</label>
                  <select className="zk-select" value={currencySymbol} onChange={(e) => setCurrencySymbol(e.target.value)}>
                    <option value="₺">₺ — Türk Lirası</option>
                    <option value="$">$ — Dolar</option>
                    <option value="€">€ — Euro</option>
                  </select>
                </div>
                <div>
                  <label className="zk-label">Tarih formatı</label>
                  <select className="zk-select" value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
                    <option value="DMY">GG.AA.YYYY (31.12.2026)</option>
                    <option value="YMD">YYYY-AA-GG (2026-12-31)</option>
                  </select>
                </div>
                <div>
                  <label className="zk-label">Varsayılan KDV oranı (%)</label>
                  <input className="zk-input" type="number" value={defaultVatRate} onChange={(e) => setDefaultVatRate(e.target.value)} placeholder="20" />
                </div>
                <div>
                  <label className="zk-label">Varsayılan yakıt fiyatı ({currencySymbol}/Lt)</label>
                  <input className="zk-input" type="number" value={defaultFuelPrice} onChange={(e) => setDefaultFuelPrice(e.target.value)} placeholder="örn. 45" />
                </div>
              </div>
              <div style={{ fontSize: 11, color: COLORS.inkSoft, marginTop: 10 }}>
                KDV oranı henüz ayrı bir fatura modülü olmadığı için şu an sadece Vergi sekmesindeki hızlı seçim listesinin varsayılanı olarak saklanır.
              </div>
            </div>

            <div className="zk-card">
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Kasa / dara</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 14 }}>
                <div>
                  <label className="zk-label">Kasa ağırlığı (kg)</label>
                  <input className="zk-input" type="number" value={crateWeight} onChange={(e) => setCrateWeight(e.target.value)} placeholder="2" />
                </div>
                <div>
                  <label className="zk-label">Varsayılan kasa sayısı (dara)</label>
                  <input className="zk-input" type="number" min="0" max="7" value={defaultCrateCount} onChange={(e) => setDefaultCrateCount(e.target.value)} placeholder="5" />
                </div>
              </div>
              <div style={{ fontSize: 11, color: COLORS.inkSoft, marginTop: 8 }}>
                Alım ekranında her satıra otomatik gelir ({defaultCrateCount || 0} kasa × {crateWeight || 0} kg = {((parseFloat(defaultCrateCount) || 0) * (parseFloat(crateWeight) || 0)).toFixed(1)} kg dara), orada değiştirilebilir.
              </div>
            </div>

            <div className="zk-card">
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>Alım varsayılanları</div>
              <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 14 }}>Yeni alım ekranı her açıldığında bu değerlerle başlar, siz orada değiştirebilirsiniz.</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 14 }}>
                <div>
                  <label className="zk-label">Varsayılan komisyon oranı (%)</label>
                  <input className="zk-input" type="number" value={defaultCommissionRate} onChange={(e) => setDefaultCommissionRate(e.target.value)} placeholder="3" />
                </div>
                <div>
                  <label className="zk-label">Varsayılan BAĞ-KUR oranı (%)</label>
                  <input className="zk-input" type="number" value={defaultBagkurRate} onChange={(e) => setDefaultBagkurRate(e.target.value)} placeholder="1" />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 10 }}>
                  <label className="zk-checkbox-row">
                    <input type="checkbox" checked={defaultNoDeduction} onChange={(e) => setDefaultNoDeduction(e.target.checked)} />
                    Kesintisiz hesaplama varsayılan açık gelsin
                  </label>
                </div>
              </div>
            </div>

            <div className="zk-card">
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>Bildirim eşikleri</div>
              <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 14 }}>Bildirim Merkezi ve AI Asistan'daki uyarıların kaç gün/km öncesinden tetikleneceğini belirler.</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 14 }}>
                <div>
                  <label className="zk-label">Evrak/sigorta uyarısı (gün kala)</label>
                  <input className="zk-input" type="number" value={docWarningDays} onChange={(e) => setDocWarningDays(e.target.value)} placeholder="30" />
                </div>
                <div>
                  <label className="zk-label">Cari risk — "yüksek" eşiği (gün)</label>
                  <input className="zk-input" type="number" value={cariRiskDays} onChange={(e) => setCariRiskDays(e.target.value)} placeholder="45" />
                </div>
                <div>
                  <label className="zk-label">Cari risk — "orta" eşiği (gün)</label>
                  <input className="zk-input" type="number" value={cariRiskWarningDays} onChange={(e) => setCariRiskWarningDays(e.target.value)} placeholder="20" />
                </div>
                <div>
                  <label className="zk-label">Bakım uyarısı (km kala)</label>
                  <input className="zk-input" type="number" value={maintenanceWarningKm} onChange={(e) => setMaintenanceWarningKm(e.target.value)} placeholder="500" />
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'firma' && (
          <div className="zk-card">
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Firma logosu</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              {logo ? (
                <img src={logo} alt="Logo" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', border: `1px solid ${COLORS.border}` }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: 8, border: `1px dashed ${COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.inkSoft, fontSize: 10 }}>Logo yok</div>
              )}
              <div>
                <label className="zk-btn zk-btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', marginRight: 8 }}>
                  <Upload size={13} /> Logo yükle
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { if (e.target.files[0]) handleLogoUpload(e.target.files[0]); e.target.value = ''; }} />
                </label>
                {logo && <button className="zk-btn zk-btn-secondary" onClick={() => setLogo('')}><Trash2 size={13} /> Logoyu kaldır</button>}
              </div>
            </div>
            <div style={{ fontSize: 11, color: COLORS.inkSoft, marginBottom: 20 }}>
              Logo; kenar çubuğunda ve müstahsil makbuzunda görünür. Otomatik olarak küçültülür.
            </div>

            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Firma bilgileri</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 14 }}>
              <div>
                <label className="zk-label">Firma / komisyoncu adı</label>
                <input className="zk-input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="örn. Ahmet Yılmaz Zeytin Komisyonculuğu" />
              </div>
              <div>
                <label className="zk-label">Telefon</label>
                <input className="zk-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0532 xxx xx xx" />
              </div>
              <div>
                <label className="zk-label">Vergi no</label>
                <input className="zk-input" value={taxNo} onChange={(e) => setTaxNo(e.target.value)} />
              </div>
              <div>
                <label className="zk-label">Vergi dairesi</label>
                <input className="zk-input" value={taxOffice} onChange={(e) => setTaxOffice(e.target.value)} placeholder="örn. Bergama V.D." />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="zk-label">Adres</label>
                <input className="zk-input" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {tab === 'fiyat' && (
          <div className="zk-card">
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>Zeytin türleri ve fiyat listesi (bu hafta)</div>
            <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 12 }}>Her tür için numaraya ayrılıp ayrılmadığını seçin. Yeni alım ekranında otomatik gelir.</div>
            {priceList.map((v) => (
              <VarietyEditor key={v.id} variety={v} onChange={updateVariety} onRemove={() => removeVariety(v.id)} />
            ))}
            {priceList.length === 0 && <div className="zk-empty">Henüz tür eklenmedi.</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <input className="zk-input" value={newVarietyName} onChange={(e) => setNewVarietyName(e.target.value)} placeholder="örn. Edremit" />
              <button className="zk-btn zk-btn-gold" onClick={addVariety}><Plus size={13} /> Tür ekle</button>
            </div>
          </div>
        )}

        {tab === 'kategoriler' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="zk-card">
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>💵 Gelir kategorileri</div>
              <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 12 }}>Kasa'da "Giriş" kaydederken kategori seçimi için kullanılır.</div>
              <TagChipList items={incomeCategories} onChange={setIncomeCategories} placeholder="örn. Hizmet Bedeli" />
            </div>
            <div className="zk-card">
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>💸 Gider kategorileri</div>
              <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 12 }}>Giderler ekranındaki kategori seçiminde kullanılır.</div>
              <TagChipList items={expenseCategories} onChange={setExpenseCategories} placeholder="örn. Ofis Gideri" />
            </div>
          </div>
        )}

        {tab === 'vergi' && (
          <div className="zk-card">
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>🧮 Vergi oranları</div>
            <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 14 }}>
              Farklı KDV dilimleri veya stopaj gibi hızlı seçim listeleri için kullanılır. "Varsayılan KDV Oranı" (Genel sekmesi) ilk açılışta öntanımlı değeri belirler.
            </div>
            <TaxRateList rates={taxRates} onChange={setTaxRates} />
          </div>
        )}

        {tab === 'gorunum' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="zk-card">
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Tema</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[
                  { key: 'dark', label: '🌙 Koyu' },
                  { key: 'light', label: '☀️ Açık' },
                  { key: 'navy', label: '🌌 Lacivert' },
                  { key: 'highContrast', label: '🔆 Yüksek Kontrast' },
                ].map((t) => (
                  <button
                    key={t.key}
                    className={`zk-btn ${theme === t.key ? 'zk-btn-primary' : 'zk-btn-secondary'}`}
                    onClick={() => setTheme(t.key)}
                  >
                    {t.label}{theme === t.key ? ' ✓' : ''}
                  </button>
                ))}
              </div>
            </div>

            <div className="zk-card">
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Vurgu rengi</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                {ACCENT_PRESETS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setAccentColor(c)}
                    style={{
                      width: 30, height: 30, borderRadius: '50%', background: c, cursor: 'pointer',
                      border: accentColor === c ? `3px solid ${COLORS.ink}` : '1px solid rgba(0,0,0,0.15)',
                    }}
                    aria-label={c}
                  />
                ))}
                <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} style={{ width: 34, height: 34, padding: 0, border: 'none', borderRadius: 6, cursor: 'pointer' }} />
              </div>
            </div>

            <div className="zk-card">
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Kenar çubuğu yoğunluğu</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={`zk-btn ${sidebarDensity === 'normal' ? 'zk-btn-primary' : 'zk-btn-secondary'}`} onClick={() => setSidebarDensity('normal')}>Normal</button>
                <button className={`zk-btn ${sidebarDensity === 'compact' ? 'zk-btn-primary' : 'zk-btn-secondary'}`} onClick={() => setSidebarDensity('compact')}>Kompakt</button>
              </div>
            </div>

            <div className="zk-card">
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>📏 Yazı boyutu</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={`zk-btn ${fontSize === 'small' ? 'zk-btn-primary' : 'zk-btn-secondary'}`} onClick={() => setFontSize('small')}>Küçük</button>
                <button className={`zk-btn ${fontSize === 'normal' ? 'zk-btn-primary' : 'zk-btn-secondary'}`} onClick={() => setFontSize('normal')}>Normal</button>
                <button className={`zk-btn ${fontSize === 'large' ? 'zk-btn-primary' : 'zk-btn-secondary'}`} onClick={() => setFontSize('large')}>Büyük</button>
              </div>
            </div>
          </div>
        )}

        {tab === 'yedek' && (
          <div className="zk-card">
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>Yedekleme</div>
            <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 14 }}>Tüm verileri (çiftçiler, alımlar, satışlar, giderler, ayarlar) tek bir dosyaya indirin veya daha önce indirdiğiniz bir yedeği geri yükleyin.</div>
            <button className="zk-btn zk-btn-primary" onClick={onBackup} style={{ marginBottom: 12 }}><Download size={14} /> Yedeği indir (.json)</button>
            <div>
              <label className="zk-btn zk-btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex' }}>
                <Upload size={14} /> Yedekten geri yükle
                <input
                  type="file"
                  accept="application/json"
                  style={{ display: 'none' }}
                  onChange={(e) => { if (e.target.files[0]) onRestore(e.target.files[0]); e.target.value = ''; }}
                />
              </label>
            </div>
            {restoreStatus && <div style={{ fontSize: 12, color: COLORS.olive, marginTop: 10 }}>{restoreStatus}</div>}
            <div style={{ fontSize: 11, color: COLORS.red, marginTop: 10 }}>Geri yükleme, o an ekrandaki tüm verilerin üzerine yazar — dikkatli kullanın.</div>
          </div>
        )}

        {tab !== 'fiyat' && tab !== 'yedek' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
            <button className="zk-btn zk-btn-primary" onClick={save}>Tüm ayarları kaydet</button>
            {savedNote && <span style={{ fontSize: 12, color: COLORS.olive }}>{savedNote}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function PrintArea({ purchase, farmer, settings }) {
  if (!purchase || !farmer) return <div id="zk-print-area" />;
  return (
    <div id="zk-print-area">
      <div style={{ fontFamily: "'Courier New', monospace", width: '100%', fontSize: 11, lineHeight: 1.5 }}>
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          {settings.logo && <img src={settings.logo} alt="Logo" style={{ maxWidth: 60, maxHeight: 60, marginBottom: 4 }} />}
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 14, fontWeight: 600 }}>{settings.businessName || 'Zeytin Komisyonculuğu'}</div>
          {settings.address && <div style={{ fontSize: 10 }}>{settings.address}</div>}
          {settings.phone && <div style={{ fontSize: 10 }}>Tel: {settings.phone}</div>}
          {settings.taxNo && <div style={{ fontSize: 10 }}>VKN: {settings.taxNo}{settings.taxOffice ? ` · ${settings.taxOffice}` : ''}</div>}
        </div>
        <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', marginBottom: 6, textAlign: 'center', fontWeight: 700 }}>
          MÜSTAHSİL MAKBUZU No: {purchase.makbuzNo}
        </div>
        <div>Tarih: {fmtDate(purchase.date)}{purchase.time ? ` · ${purchase.time}` : ''}</div>
        {purchase.personnelName && <div>Personel: {purchase.personnelName}</div>}
        <div>Satıcı: {farmer.name}</div>
        {farmer.tcNo && <div>TC No: {farmer.tcNo}</div>}
        {farmer.address && <div>Adres: {farmer.address}</div>}
        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
        <div style={{ fontWeight: 700, marginBottom: 2 }}>Ürün: Zeytin</div>
        <table style={{ width: '100%', marginTop: 4 }}>
          <tbody>
            {purchase.items && purchase.items.map((it) => (
              <tr key={it.id}>
                <td>{it.grade}</td>
                <td style={{ textAlign: 'right' }}>{fmtKg(it.kg)}</td>
                <td style={{ textAlign: 'right' }}>×{fmtTL(it.pricePerKg)}</td>
                <td style={{ textAlign: 'right' }}>{fmtTL(it.amount)}</td>
              </tr>
            ))}
            <tr style={{ borderTop: '1px dashed #000' }}>
              <td style={{ fontWeight: 700, paddingTop: 3 }}>Toplam</td>
              <td style={{ textAlign: 'right', fontWeight: 700, paddingTop: 3 }}>{fmtKg(purchase.netKg)}</td>
              <td></td>
              <td style={{ textAlign: 'right', fontWeight: 700, paddingTop: 3 }}>{fmtTL(purchase.amount)}</td>
            </tr>
          </tbody>
        </table>
        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
        <table style={{ width: '100%' }}>
          <tbody>
            {purchase.noDeduction ? (
              <tr><td>Kesintisiz</td><td style={{ textAlign: 'right' }}>—</td></tr>
            ) : (
              <>
                <tr><td>Komisyon (%{purchase.commissionRate})</td><td style={{ textAlign: 'right' }}>− {fmtTL(purchase.commissionAmount)}</td></tr>
                <tr><td>Stopaj (%{purchase.stopajOrani})</td><td style={{ textAlign: 'right' }}>− {fmtTL(purchase.stopajTutari)}</td></tr>
                {purchase.applyBagkur && <tr><td>BAĞ-KUR (%{purchase.bagkurRate})</td><td style={{ textAlign: 'right' }}>− {fmtTL(purchase.bagkurTutari)}</td></tr>}
              </>
            )}
            <tr style={{ borderTop: '1px solid #000' }}><td style={{ fontWeight: 700, paddingTop: 4 }}>ÖDENEN NET</td><td style={{ textAlign: 'right', fontWeight: 700, paddingTop: 4 }}>{fmtTL(purchase.netPayment)}</td></tr>
          </tbody>
        </table>
        {purchase.note && <div style={{ marginTop: 6 }}>Not: {purchase.note}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 26, fontSize: 10 }}>
          <div>Satıcı İmza<br/>........................</div>
          <div>Alıcı İmza<br/>........................</div>
        </div>
      </div>
    </div>
  );
}

// ---------- Sesli komut asistanı ----------

function parsePurchaseCommand(text, farmers, priceList) {
  const lower = text.toLowerCase().replace(/İ/g, 'i').replace(/I/g, 'ı');

  const kgMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:kilo|kg)/);
  const kg = kgMatch ? parseFloat(kgMatch[1].replace(',', '.')) : null;

  const priceMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*lira/);
  let price = priceMatch ? parseFloat(priceMatch[1].replace(',', '.')) : null;

  let farmer = farmers.find((f) => lower.includes(f.name.toLowerCase()));
  if (!farmer) {
    farmer = farmers.find((f) => {
      const first = f.name.toLowerCase().split(' ')[0];
      return first.length > 2 && lower.includes(first);
    });
  }

  let varietyLabel = null, matchedPrice = null;
  for (const v of priceList) {
    if (lower.includes(v.name.toLowerCase())) {
      if (v.hasGrades && v.grades.length > 0) {
        const g = v.grades.find((gr) => lower.includes(gr.name.toLowerCase()));
        if (g) { varietyLabel = `${v.name} · ${g.name}`; matchedPrice = g.price; }
        else { varietyLabel = `${v.name} · ${v.grades[0].name}`; matchedPrice = v.grades[0].price; }
      } else {
        varietyLabel = v.name; matchedPrice = v.singlePrice;
      }
      break;
    }
  }
  if (!price && matchedPrice) price = matchedPrice;

  if (!farmer) return { ok: false, message: 'Çiftçi adını anlayamadım. Örnek: "Mehmet\'ten 50 kilo Tirilye 1 numara 100 liradan al".' };
  if (!kg) return { ok: false, message: `${farmer.name} anladım ama kilo miktarını anlayamadım. "50 kilo" gibi net söyleyin.` };
  if (!varietyLabel) return { ok: false, message: 'Zeytin türünü/sınıfını anlayamadım. Fiyat listenizdeki bir tür adını (örn. Tirilye) söyleyin.' };
  if (!price) return { ok: false, message: 'Fiyatı anlayamadım. "100 liradan" gibi belirtin.' };

  return { ok: true, farmer, kg, price, varietyLabel };
}

function VoiceAssistant({ farmers, priceList, purchases, setPurchases }) {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Merhaba! Mikrofona basıp "Mehmet\'ten 50 kilo Tirilye 1 numara 100 liradan al" gibi bir alım komutu söyleyebilirsiniz.' },
  ]);
  const [pending, setPending] = useState(null);
  const [typedText, setTypedText] = useState('');
  const recognitionRef = useRef(null);
  const logEndRef = useRef(null);

  const speechSupported = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const handleCommand = (text) => {
    if (!text.trim()) return;
    setMessages((m) => [...m, { role: 'user', text }]);
    const result = parsePurchaseCommand(text, farmers, priceList);
    if (result.ok) {
      setPending(result);
      setMessages((m) => [...m, {
        role: 'assistant',
        text: `Anladığım: ${result.farmer.name} — ${result.varietyLabel} — ${fmtKg(result.kg)} — ${fmtTL(result.price)}/kg. Toplam ${fmtTL(result.kg * result.price)}. Kaydedeyim mi?`,
      }]);
    } else {
      setPending(null);
      setMessages((m) => [...m, { role: 'assistant', text: result.message }]);
    }
  };

  const startListening = () => {
    if (!speechSupported) {
      setMessages((m) => [...m, { role: 'assistant', text: 'Tarayıcınız sesli komutu desteklemiyor. Masaüstü Chrome veya Edge kullanın, ya da aşağıya yazabilirsiniz.' }]);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = 'tr-TR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (e) => {
      const text = e.results[0][0].transcript;
      handleCommand(text);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const confirmSave = async () => {
    if (!pending) return;
    const amount = pending.kg * pending.price;
    const record = {
      id: uid(),
      makbuzNo: purchases.length + 1,
      farmerId: pending.farmer.id,
      date: todayStr(),
      time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      personnelId: null, personnelName: '',
      vehicleId: null, vehiclePlaka: '',
      items: [{ id: uid(), grade: pending.varietyLabel, kg: pending.kg, pricePerKg: pending.price, amount }],
      netKg: pending.kg,
      noDeduction: true,
      commissionRate: 0, commissionAmount: 0,
      borsaTescilli: false, stopajOrani: 0, stopajTutari: 0,
      applyBagkur: false, bagkurRate: 0, bagkurTutari: 0,
      amount, netPayment: amount,
      note: 'Sesli komutla eklendi',
      createdAt: Date.now(),
    };
    const next = [...purchases, record];
    setPurchases(next);
    await storageSet('zk:purchases', next);
    setMessages((m) => [...m, { role: 'assistant', text: `Kaydedildi ✓ (Makbuz #${record.makbuzNo})` }]);
    setPending(null);
  };

  const cancelPending = () => {
    setPending(null);
    setMessages((m) => [...m, { role: 'assistant', text: 'İptal edildi.' }]);
  };

  const submitTyped = () => {
    handleCommand(typedText);
    setTypedText('');
  };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 150,
          width: 56, height: 56, borderRadius: '50%', border: 'none',
          background: COLORS.olive, color: '#fff', cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(43,42,37,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        aria-label="Sesli asistan"
      >
        {open ? <X size={22} /> : <Mic size={24} />}
      </button>

      {open && (
        <div style={{
          position: 'fixed', bottom: 86, right: 20, zIndex: 150,
          width: 340, maxWidth: 'calc(100vw - 40px)', maxHeight: '65vh',
          background: '#fff', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', border: `1px solid ${COLORS.border}`,
        }}>
          <div style={{ background: COLORS.olive, color: '#fff', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mic size={16} />
            <div style={{ fontSize: 13, fontWeight: 700 }}>Sesli Alım Asistanı</div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, background: COLORS.paper }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                background: m.role === 'user' ? COLORS.oliveSoft : '#fff',
                border: `1px solid ${COLORS.border}`,
                borderRadius: 10, padding: '8px 11px', fontSize: 12.5, maxWidth: '88%', lineHeight: 1.4,
              }}>
                {m.text}
              </div>
            ))}
            {pending && (
              <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-start' }}>
                <button className="zk-btn zk-btn-primary" style={{ fontSize: 11.5, padding: '6px 10px' }} onClick={confirmSave}>Evet, kaydet</button>
                <button className="zk-btn zk-btn-secondary" style={{ fontSize: 11.5, padding: '6px 10px' }} onClick={cancelPending}>İptal</button>
              </div>
            )}
            <div ref={logEndRef} />
          </div>

          <div style={{ padding: 10, borderTop: `1px solid ${COLORS.border}`, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={listening ? stopListening : startListening}
              style={{
                width: 38, height: 38, borderRadius: '50%', border: 'none', flexShrink: 0,
                background: listening ? COLORS.red : COLORS.gold, color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              aria-label={listening ? 'Dinlemeyi durdur' : 'Konuşmaya başla'}
            >
              {listening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <input
              className="zk-input"
              style={{ minHeight: 38, fontSize: 12.5, padding: '8px 10px' }}
              placeholder={listening ? 'Dinliyorum...' : 'Ya da buraya yazın...'}
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitTyped(); }}
            />
            <button
              onClick={submitTyped}
              style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', flexShrink: 0, background: COLORS.olive, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              aria-label="Gönder"
            >
              <Send size={15} />
            </button>
          </div>
          {!speechSupported && (
            <div style={{ fontSize: 10.5, color: COLORS.inkSoft, padding: '0 12px 10px', textAlign: 'center' }}>
              Sesli komut için masaüstü Chrome/Edge gerekir — burada yazarak da komut verebilirsiniz.
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ---------- Bildirim ve Hatırlatma Merkezi ----------

function NotificationCenter({ farmers, purchases, payments, documents, insurance, fines, maintenance, fuel, vehicles, reminders, setReminders, settings }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState('');

  const docWarningDays = settings.docWarningDays ?? 30;
  const cariRiskDays = settings.cariRiskDays ?? 45;
  const maintenanceWarningKm = settings.maintenanceWarningKm ?? 500;

  const alerts = useMemo(() => {
    const list = [];

    documents.forEach((d) => {
      const days = daysUntil(d.expiryDate);
      if (days !== null && days <= docWarningDays) {
        const v = vehicles.find((x) => x.id === d.vehicleId);
        list.push({
          severity: days < 0 ? 'kritik' : 'uyari', icon: FileText,
          title: `${d.docType} süresi ${days < 0 ? 'doldu' : 'yaklaşıyor'}`,
          detail: `${v ? v.plaka : 'Araç'} · ${days < 0 ? Math.abs(days) + ' gün önce doldu' : days + ' gün kaldı'}`,
        });
      }
    });

    insurance.forEach((i) => {
      const days = daysUntil(i.endDate);
      if (days !== null && days <= docWarningDays) {
        const v = vehicles.find((x) => x.id === i.vehicleId);
        list.push({
          severity: days < 0 ? 'kritik' : 'uyari', icon: ShieldAlert,
          title: `${i.policyType} poliçesi ${days < 0 ? 'doldu' : 'yaklaşıyor'}`,
          detail: `${v ? v.plaka : 'Araç'} · ${i.company}`,
        });
      }
    });

    fines.filter((f) => !f.paid).forEach((f) => {
      const v = vehicles.find((x) => x.id === f.vehicleId);
      list.push({ severity: 'uyari', icon: AlertTriangle, title: 'Ödenmemiş ceza', detail: `${v ? v.plaka : 'Araç'} · ${fmtTL(f.amount)}` });
    });

    farmers.forEach((f) => {
      const fp = purchases.filter((p) => p.farmerId === f.id);
      const fpay = payments.filter((p) => p.farmerId === f.id);
      const balance = fp.reduce((s, p) => s + p.netPayment, 0) - fpay.reduce((s, p) => s + p.amount, 0);
      const last = [...fp, ...fpay].sort((a, b) => b.createdAt - a.createdAt)[0];
      const daysSince = last ? Math.round((Date.now() - last.createdAt) / (1000 * 60 * 60 * 24)) : null;
      if (balance > 0 && daysSince !== null && daysSince > cariRiskDays) {
        list.push({ severity: 'kritik', icon: ShieldAlert, title: 'Yüksek cari risk', detail: `${f.name} · ${fmtTL(balance)} · ${daysSince} gündür hareket yok` });
      }
    });

    vehicles.forEach((v) => {
      const records = maintenance.filter((m) => m.vehicleId === v.id && m.km > 0).sort((a, b) => a.km - b.km);
      const fuelRecords = fuel.filter((r) => r.vehicleId === v.id && r.km > 0).sort((a, b) => b.km - a.km);
      const currentKm = fuelRecords[0]?.km || records[records.length - 1]?.km || 0;
      if (records.length >= 2) {
        const intervals = [];
        for (let i = 1; i < records.length; i++) intervals.push(records[i].km - records[i - 1].km);
        const avg = mean(intervals);
        const lastKm = records[records.length - 1].km;
        const remaining = avg - (currentKm - lastKm);
        if (remaining < maintenanceWarningKm) {
          list.push({ severity: remaining < 0 ? 'kritik' : 'uyari', icon: Wrench, title: 'Bakım zamanı yaklaştı', detail: `${v.plaka} · tahmini ${Math.round(remaining)} km kaldı` });
        }
      }
    });

    return list.sort((a, b) => (a.severity === 'kritik' ? 0 : 1) - (b.severity === 'kritik' ? 0 : 1));
  }, [farmers, purchases, payments, documents, insurance, fines, maintenance, fuel, vehicles, docWarningDays, cariRiskDays, maintenanceWarningKm]);

  const activeReminders = reminders.filter((r) => !r.done).sort((a, b) => a.date.localeCompare(b.date));
  const totalCount = alerts.length + activeReminders.length;

  const addReminder = async () => {
    if (!title.trim()) return;
    const r = { id: uid(), title: title.trim(), date, note: note.trim(), done: false, createdAt: Date.now() };
    const next = [...reminders, r];
    setReminders(next);
    await storageSet('zk:reminders', next);
    setTitle(''); setNote('');
  };

  const toggleDone = async (id) => {
    const next = reminders.map((r) => (r.id === id ? { ...r, done: !r.done } : r));
    setReminders(next);
    await storageSet('zk:reminders', next);
  };

  const removeReminder = async (id) => {
    if (!window.confirm('Bu hatırlatmayı silmek istediğinize emin misiniz?')) return;
    const next = reminders.filter((r) => r.id !== id);
    setReminders(next);
    await storageSet('zk:reminders', next);
  };

  return (
    <>
      <button className="zk-navbtn" onClick={() => setOpen(true)} style={{ position: 'relative' }}>
        <Bell size={16} /> Bildirimler
        {totalCount > 0 && (
          <span style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            background: COLORS.red, color: '#fff', fontSize: 10, fontWeight: 700,
            borderRadius: 20, padding: '1px 6px', minWidth: 16, textAlign: 'center',
          }}>
            {totalCount}
          </span>
        )}
      </button>

      {open && (
        <Modal title="Bildirim ve Hatırlatma Merkezi" onClose={() => setOpen(false)}>
          <div style={{ maxHeight: '55vh', overflowY: 'auto', marginBottom: 16 }}>
            {alerts.length === 0 && activeReminders.length === 0 ? (
              <div className="zk-empty">Her şey yolunda, aktif uyarı yok.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {alerts.map((a, i) => (
                  <div key={`a${i}`} style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 11px',
                    borderRadius: 8, background: a.severity === 'kritik' ? COLORS.redSoft : COLORS.goldSoft,
                  }}>
                    <a.icon size={15} color={a.severity === 'kritik' ? COLORS.red : COLORS.gold} style={{ marginTop: 1, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.ink }}>{a.title}</div>
                      <div style={{ fontSize: 11.5, color: COLORS.inkSoft }}>{a.detail}</div>
                    </div>
                  </div>
                ))}
                {activeReminders.map((r) => (
                  <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 11px', borderRadius: 8, background: COLORS.oliveSoft }}>
                    <ClockIcon size={15} color={COLORS.olive} style={{ marginTop: 1, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.ink }}>{r.title}</div>
                      <div style={{ fontSize: 11.5, color: COLORS.inkSoft }}>{fmtDate(r.date)}{r.note ? ` · ${r.note}` : ''}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="zk-btn zk-btn-secondary" style={{ padding: '3px 7px' }} onClick={() => toggleDone(r.id)} title="Tamamlandı işaretle">✓</button>
                      <button className="zk-btn zk-btn-secondary" style={{ padding: '3px 7px' }} onClick={() => removeReminder(r.id)}><X size={11} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 14 }}>
            <div className="zk-label" style={{ marginBottom: 8 }}>Yeni hatırlatma ekle</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              <input className="zk-input" placeholder="Başlık (örn. Ahmet'i ara)" style={{ flex: '2 1 160px' }} value={title} onChange={(e) => setTitle(e.target.value)} />
              <input className="zk-input" type="date" style={{ flex: '1 1 130px' }} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <input className="zk-input" placeholder="Not (opsiyonel)" style={{ marginBottom: 10 }} value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="zk-btn zk-btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={addReminder}>Ekle</button>
          </div>
        </Modal>
      )}
    </>
  );
}

export default function ZeytinDefteri() {
  const [tab, setTab] = useState('dashboard');
  const [userEmail, setUserEmail] = useState(currentUser.email || '');
  const [userBusinessName, setUserBusinessName] = useState(currentUser.businessName || '');
  const [farmers, setFarmers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [payments, setPayments] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [sales, setSales] = useState([]);
  const [settings, setSettings] = useState({});
  const [priceList, setPriceList] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [fuel, setFuel] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [insurance, setInsurance] = useState([]);
  const [damages, setDamages] = useState([]);
  const [fines, setFines] = useState([]);
  const [tires, setTires] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [cashEntries, setCashEntries] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [selectedFarmerId, setSelectedFarmerId] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [printTarget, setPrintTarget] = useState(null);
  const [restoreStatus, setRestoreStatus] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const [f, p, pay, b, s, set, pl, per, exp, cash, veh, maint, fl, docs, ins, dmg, fns, trs, rem] = await Promise.all([
        storageGet('zk:farmers'),
        storageGet('zk:purchases'),
        storageGet('zk:payments'),
        storageGet('zk:buyers'),
        storageGet('zk:sales'),
        storageGet('zk:settings'),
        storageGet('zk:priceList'),
        storageGet('zk:personnel'),
        storageGet('zk:expenses'),
        storageGet('zk:cashEntries'),
        storageGet('zk:vehicles'),
        storageGet('zk:vehicleMaintenance'),
        storageGet('zk:vehicleFuel'),
        storageGet('zk:vehicleDocuments'),
        storageGet('zk:vehicleInsurance'),
        storageGet('zk:vehicleDamage'),
        storageGet('zk:vehicleFines'),
        storageGet('zk:vehicleTires'),
        storageGet('zk:reminders'),
      ]);
      setFarmers(f || []); setPurchases(p || []); setPayments(pay || []);
      setBuyers(b || []); setSales(s || []); setSettings(set || {});
      applyAppearance(set || {});
      setPersonnel(per || []); setExpenses(exp || []); setCashEntries(cash || []);
      setVehicles(veh || []);
      setMaintenance(maint || []); setFuel(fl || []); setDocuments(docs || []);
      setInsurance(ins || []); setDamages(dmg || []); setFines(fns || []); setTires(trs || []);
      setReminders(rem || []);
      if (pl && pl.length > 0) {
        const normalized = pl.map((v) => ('grades' in v ? v : { id: v.id, name: v.name, hasGrades: false, singlePrice: v.price || 0, grades: [] }));
        setPriceList(normalized);
      } else {
        const defaults = [
          { id: uid(), name: 'Tirilye', hasGrades: true, singlePrice: 0, grades: [
            { id: uid(), name: '1 Numara', price: 100 },
            { id: uid(), name: '2 Numara', price: 90 },
            { id: uid(), name: '3 Numara', price: 80 },
            { id: uid(), name: '4 Numara', price: 70 },
          ] },
          { id: uid(), name: 'Edremit', hasGrades: true, singlePrice: 0, grades: [] },
          { id: uid(), name: 'Domat', hasGrades: true, singlePrice: 0, grades: [] },
          { id: uid(), name: 'Uslu', hasGrades: true, singlePrice: 0, grades: [] },
          { id: uid(), name: 'Aydın', hasGrades: true, singlePrice: 0, grades: [] },
          { id: uid(), name: 'Manzelin', hasGrades: true, singlePrice: 0, grades: [] },
          { id: uid(), name: 'Yağlık', hasGrades: false, singlePrice: 60, grades: [] },
        ];
        setPriceList(defaults);
        await storageSet('zk:priceList', defaults);
      }
      setLoaded(true);
    })();
  }, []);

  const handlePrintReceipt = (purchase) => {
    const farmer = farmers.find((f) => f.id === purchase.farmerId);
    setPrintTarget({ purchase, farmer });
    setTimeout(() => window.print(), 100);
  };

  const backupData = () => {
    const payload = {
      farmers, purchases, payments, buyers, sales, settings, priceList, personnel, expenses, cashEntries, vehicles,
      vehicleMaintenance: maintenance, vehicleFuel: fuel, vehicleDocuments: documents, vehicleInsurance: insurance,
      vehicleDamage: damages, vehicleFines: fines, vehicleTires: tires, reminders,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zeytin-defteri-yedek-${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const restoreData = async (file) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const keys = ['farmers', 'purchases', 'payments', 'buyers', 'sales', 'settings', 'priceList', 'personnel', 'expenses', 'cashEntries', 'vehicles', 'vehicleMaintenance', 'vehicleFuel', 'vehicleDocuments', 'vehicleInsurance', 'vehicleDamage', 'vehicleFines', 'vehicleTires', 'reminders'];
      for (const k of keys) {
        if (data[k] !== undefined) await storageSet(`zk:${k}`, data[k]);
      }
      setFarmers(data.farmers || []); setPurchases(data.purchases || []); setPayments(data.payments || []);
      setBuyers(data.buyers || []); setSales(data.sales || []); setSettings(data.settings || {});
      applyAppearance(data.settings || {});
      setPriceList(data.priceList || []); setPersonnel(data.personnel || []);
      setExpenses(data.expenses || []); setCashEntries(data.cashEntries || []);
      setVehicles(data.vehicles || []);
      setMaintenance(data.vehicleMaintenance || []); setFuel(data.vehicleFuel || []); setDocuments(data.vehicleDocuments || []);
      setInsurance(data.vehicleInsurance || []); setDamages(data.vehicleDamage || []); setFines(data.vehicleFines || []); setTires(data.vehicleTires || []);
      setReminders(data.reminders || []);
      setRestoreStatus('Yedek başarıyla geri yüklendi.');
    } catch (e) {
      setRestoreStatus('Dosya okunamadı, geçerli bir yedek dosyası seçin.');
    }
  };

  const navItems = [
    { key: 'dashboard', label: 'Pano', icon: LayoutDashboard },
    { key: 'farmers', label: 'Çiftçiler', icon: Users },
    { key: 'purchase', label: 'Alım', icon: ScaleIcon },
    { key: 'allPurchases', label: 'Tüm alımlar', icon: ListChecks },
    { key: 'warehouse', label: 'Depo & satış', icon: Warehouse },
    { key: 'fleet', label: 'Filo & personel', icon: Truck },
    { key: 'ai', label: 'AI Asistan', icon: Sparkles },
    { key: 'ledger', label: 'Cari hesap', icon: Wallet },
    { key: 'expenses', label: 'Giderler', icon: Receipt },
    { key: 'cash', label: 'Kasa', icon: Banknote },
    { key: 'reports', label: 'Raporlar', icon: FileBarChart },
    { key: 'settings', label: 'Ayarlar', icon: SettingsIcon },
  ];

  if (!loaded) {
    return <div className="zk-app"><GlobalStyle /><div style={{ padding: 40, fontSize: 13, color: COLORS.inkSoft }}>Yükleniyor...</div></div>;
  }

  const fontZoom = { small: 0.92, normal: 1, large: 1.08 }[settings.fontSize] || 1;

  return (
    <div className="zk-app" style={{ zoom: fontZoom }}>
      <GlobalStyle />
      <div className="zk-topbar">
        <button className="zk-topbar-btn" onClick={() => setSidebarOpen(true)} aria-label="Menüyü aç"><Menu size={20} /></button>
        <div className="zk-topbar-brand">Zeytin Defteri</div>
      </div>
      <div className={`zk-sidebar-overlay ${sidebarOpen ? 'zk-sidebar-open' : ''}`} onClick={() => setSidebarOpen(false)} />
      <div className="zk-shell">
        <div className={`zk-sidebar ${sidebarOpen ? 'zk-sidebar-open' : ''} ${settings.sidebarDensity === 'compact' ? 'zk-sidebar-compact' : ''}`}>
          <div className="zk-brand-row">
            {settings.logo ? (
              <img src={settings.logo} alt="Logo" style={{ width: 22, height: 22, borderRadius: 5, objectFit: 'cover' }} />
            ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 20c6-1 9-4 11-9 1.5-3.7 1-6.5-1-8.5-3 2-5 5-6 8-1.5 4-3 7-4 9.5Z" stroke="#D9C77E" strokeWidth="1.4" strokeLinejoin="round"/>
              <ellipse cx="9.3" cy="12.5" rx="1.5" ry="2.1" transform="rotate(-35 9.3 12.5)" fill="#D9C77E"/>
              <ellipse cx="12.6" cy="8.4" rx="1.3" ry="1.8" transform="rotate(-35 12.6 8.4)" fill="#D9C77E" opacity="0.85"/>
            </svg>
            )}
            <div className="zk-brand">Zeytin Defteri</div>
          </div>
          <div className="zk-brand-sub">Komisyon Yönetimi</div>
          <NotificationCenter
            farmers={farmers} purchases={purchases} payments={payments}
            documents={documents} insurance={insurance} fines={fines}
            maintenance={maintenance} fuel={fuel} vehicles={vehicles}
            reminders={reminders} setReminders={setReminders} settings={settings}
          />
          {navItems.map((item) => (
            <button key={item.key} className={`zk-navbtn ${tab === item.key ? 'active' : ''}`} onClick={() => { setTab(item.key); setSidebarOpen(false); }}>
              <item.icon size={16} /> {item.label}
            </button>
          ))}
          <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
            <div style={{ fontSize: 10.5, color: '#A9B896', padding: '0 11px', marginBottom: 2, wordBreak: 'break-all' }}>
              {userEmail}
            </div>
            {userBusinessName && (
              <div style={{ fontSize: 10, color: '#7C8A6C', padding: '0 11px', marginBottom: 8 }}>
                {userBusinessName}
              </div>
            )}
            <button className="zk-navbtn" onClick={() => supabase.auth.signOut()}>
              Çıkış yap
            </button>
          </div>
        </div>
        <div className="zk-main">
          {tab === 'dashboard' && <DashboardTab farmers={farmers} purchases={purchases} payments={payments} sales={sales} setTab={setTab} />}
          {tab === 'farmers' && <FarmersTab farmers={farmers} setFarmers={setFarmers} purchases={purchases} payments={payments} setTab={setTab} setSelectedFarmerId={setSelectedFarmerId} />}
          {tab === 'purchase' && <PurchaseTab farmers={farmers} setFarmers={setFarmers} purchases={purchases} setPurchases={setPurchases} onPrintReceipt={handlePrintReceipt} settings={settings} priceList={priceList} personnel={personnel} setPersonnel={setPersonnel} vehicles={vehicles} setVehicles={setVehicles} />}
          {tab === 'allPurchases' && <AllPurchasesTab farmers={farmers} purchases={purchases} setPurchases={setPurchases} personnel={personnel} onPrintReceipt={handlePrintReceipt} settings={settings} />}
          {tab === 'warehouse' && <WarehouseTab purchases={purchases} buyers={buyers} setBuyers={setBuyers} sales={sales} setSales={setSales} vehicles={vehicles} setVehicles={setVehicles} personnel={personnel} />}
          {tab === 'fleet' && <FleetTab vehicles={vehicles} setVehicles={setVehicles} personnel={personnel} setPersonnel={setPersonnel} purchases={purchases} sales={sales} farmers={farmers} buyers={buyers} maintenance={maintenance} setMaintenance={setMaintenance} fuel={fuel} setFuel={setFuel} documents={documents} setDocuments={setDocuments} insurance={insurance} setInsurance={setInsurance} damages={damages} setDamages={setDamages} fines={fines} setFines={setFines} tires={tires} setTires={setTires} settings={settings} />}
          {tab === 'ai' && <AiAssistantTab farmers={farmers} purchases={purchases} sales={sales} expenses={expenses} payments={payments} buyers={buyers} vehicles={vehicles} maintenance={maintenance} fuel={fuel} documents={documents} insurance={insurance} damages={damages} fines={fines} />}
          {tab === 'ledger' && <LedgerTab farmers={farmers} purchases={purchases} payments={payments} setPayments={setPayments} selectedFarmerId={selectedFarmerId} setSelectedFarmerId={setSelectedFarmerId} onPrintReceipt={handlePrintReceipt} settings={settings} />}
          {tab === 'expenses' && <ExpensesTab expenses={expenses} setExpenses={setExpenses} settings={settings} />}
          {tab === 'cash' && <CashTab settings={settings} setSettings={setSettings} payments={payments} expenses={expenses} cashEntries={cashEntries} setCashEntries={setCashEntries} farmers={farmers} />}
          {tab === 'reports' && <ReportsTab farmers={farmers} purchases={purchases} sales={sales} buyers={buyers} expenses={expenses} />}
          {tab === 'settings' && <SettingsTab settings={settings} setSettings={setSettings} priceList={priceList} setPriceList={setPriceList} onBackup={backupData} onRestore={restoreData} restoreStatus={restoreStatus} />}
        </div>
      </div>
      {printTarget && <PrintArea purchase={printTarget.purchase} farmer={printTarget.farmer} settings={settings} />}
      <VoiceAssistant farmers={farmers} priceList={priceList} purchases={purchases} setPurchases={setPurchases} />
    </div>
  );
}
