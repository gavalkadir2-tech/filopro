// ============================================================================
// SEFER YAKIT HESABI (Kurtarıcı / çekici / nakliye)
// ----------------------------------------------------------------------------
// Bu dosya app.js'in bir parçası olarak derlenir (esbuild, jsx -> React.createElement).
// app.js içindeki global yardımcıları kullanır: LS, uid, S, C, FG, StatCard, InfoBox,
// fmtTL, fmtDate, today, getSettings, saveSettings, fpToast, fpConfirm, RC.
//
// Hesap mantığı:
//   1) Rota: OSRM (router.project-osrm.org) -> yol geometrisi + her parçanın hızı
//   2) Rakım: Open-Meteo Elevation API -> rota ~100 m aralıklarla örneklenir
//   3) Her parça için tekerlek enerjisi: yuvarlanma + hava + rampa (+ şehir içi dur-kalk)
//   4) Araç kartındaki "boş 100 km tüketim" değeri, aynı aracın boş + düz yoldaki
//      enerjisine bölünerek kalibre edilir. Yani boş/düz yolda sonuç birebir kullanıcının
//      girdiği rakamı verir; yük ve rampa bunun üstüne fiziksel oranla eklenir.
//   5) Kaydedilen seferlere "gerçekleşen litre" girilirse araç bazında düzeltme
//      katsayısı otomatik hesaplanır.
// ============================================================================

const SF_G = 9.81;
const SF_CRR = 0.0075;          // kamyon lastiği yuvarlanma katsayısı
const SF_RHO = 1.2;             // hava yoğunluğu kg/m3
const SF_DUR_KALK = 0.2;        // şehir içi dur-kalk eşdeğer enerji (J / m / kg)
const SF_SABIT_PAY = 0.2;       // motor iç sürtünme + aksesuar: yükten bağımsız pay
const SF_SEHIR_HIZ = 50;        // bu hızın altı şehir içi sayılır (km/h)
const SF_MAX_HIZ = 85;          // ağır vasıta için hız tavanı (km/h)
const SF_REF_HIZ_DIS = 80;      // "şehir dışı 100 km" değerinin ölçüldüğü varsayılan hız
const SF_REF_HIZ_ICI = 35;      // "şehir içi 100 km" değerinin ölçüldüğü varsayılan hız
const SF_ROLANTI_LT_SAAT = 2.5; // ağır vasıta rölanti tüketimi
const SF_PTO_LT_SAAT = 6;       // vinç/ahtapot çalışırken varsayılan tüketim

const SF_KASA_TIPLERI = {
  kayar: { label: "Kayar kasa (platform)", cda: 5.6, yukluEk: 0.8 },
  sabit: { label: "Sabit platform", cda: 5.2, yukluEk: 0.8 },
  ahtapot: { label: "Çekici / ahtapot (arkadan çeker)", cda: 4.6, yukluEk: 0.5 },
  diger: { label: "Diğer", cda: 5.4, yukluEk: 0.6 },
};

const SF_YUK_HAZIR = [
  ["Otomobil", 1.4],
  ["SUV / Pikap", 2.2],
  ["Hafif ticari", 2.8],
  ["Minibüs", 4],
  ["Kamyonet", 5],
  ["Traktör", 4.5],
];

// ---------------------------------------------------------------- saf fonksiyonlar
function sfHaversine(a, b) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b[1] - a[1]) * r, dLng = (b[0] - a[0]) * r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Araç kartındaki alanları hesap parametrelerine çevirir. Eksikse null döner.
function sfAracParam(arac) {
  if (!arac) return null;
  const disi = +arac.bos100kmSehirDisi || 0;
  const ici = +arac.bos100kmSehirIci || (disi ? disi * 1.3 : 0);
  const bos = +arac.bosAgirlikTon || 0;
  if (!disi || !bos) return null;
  return {
    disi,
    ici,
    bosKg: bos * 1000,
    azamiKg: (+arac.azamiAgirlikTon || 0) * 1000,
    kasa: SF_KASA_TIPLERI[arac.kasaTipi] || SF_KASA_TIPLERI.diger,
    pto: +arac.ptoLtSaat || SF_PTO_LT_SAAT,
  };
}

function sfAero(cda, kmh) {
  const v = kmh / 3.6;
  return 0.5 * SF_RHO * cda * v * v; // N = J/m
}

// segmentler: [{m: metre, dh: yükseklik farkı (m), hiz: km/h}]
// Dönüş: { litre, km, sure (sn), tirmanis, inis, sehirKm, maxEgim, detay: [...] }
function sfBacakHesapla(segmentler, p, yukKg) {
  const yuklu = yukKg > 0;
  const m = p.bosKg + yukKg;
  const cdaBos = p.kasa.cda;
  const cda = cdaBos + (yuklu ? p.kasa.yukluEk : 0);
  const eRefDis = p.bosKg * SF_G * SF_CRR + sfAero(cdaBos, SF_REF_HIZ_DIS);
  const eRefIci = p.bosKg * (SF_G * SF_CRR + SF_DUR_KALK) + sfAero(cdaBos, SF_REF_HIZ_ICI);
  let litre = 0, km = 0, sure = 0, tirmanis = 0, inis = 0, sehirKm = 0, maxEgim = 0;
  let ltRampa = 0, ltYuk = 0;
  for (const s of segmentler) {
    if (!(s.m > 0)) continue;
    const hiz = Math.max(5, Math.min(SF_MAX_HIZ, s.hiz || 60));
    const sehir = (s.hiz || 60) < SF_SEHIR_HIZ;
    const egim = s.dh / s.m;
    if (Math.abs(egim) > maxEgim && s.m >= 80) maxEgim = Math.abs(egim);
    if (s.dh > 0) tirmanis += s.dh; else inis -= s.dh;
    const taban = sehir ? p.ici : p.disi;
    const eRef = sehir ? eRefIci : eRefDis;
    const duz = (mm, cd) => mm * SF_G * SF_CRR + sfAero(cd, hiz) + (sehir ? mm * SF_DUR_KALK : 0);
    const e = duz(m, cda) + m * SF_G * egim;            // J/m, rampa dahil
    const lt = (s.m / 100000) * taban * (SF_SABIT_PAY + (1 - SF_SABIT_PAY) * Math.max(0, e) / eRef);
    // kalem ayrıştırma (bilgi amaçlı)
    const eDuzBos = duz(p.bosKg, cdaBos), eDuzYuk = duz(m, cda);
    const ltDuzBos = (s.m / 100000) * taban * (SF_SABIT_PAY + (1 - SF_SABIT_PAY) * eDuzBos / eRef);
    const ltDuzYuk = (s.m / 100000) * taban * (SF_SABIT_PAY + (1 - SF_SABIT_PAY) * eDuzYuk / eRef);
    ltYuk += ltDuzYuk - ltDuzBos;
    ltRampa += lt - ltDuzYuk;
    litre += lt;
    km += s.m / 1000;
    sure += s.m / (hiz / 3.6);
    if (sehir) sehirKm += s.m / 1000;
  }
  return { litre, km, sure, tirmanis, inis, sehirKm, maxEgim, ltRampa, ltYuk };
}

// Rota geometrisini (lng,lat) + OSRM hız bilgisini ~adim metrede bir örnekler.
function sfOrnekle(koordlar, hizlar, adim) {
  const cum = [0];
  for (let i = 1; i < koordlar.length; i++) cum.push(cum[i - 1] + sfHaversine(koordlar[i - 1], koordlar[i]));
  const toplam = cum[cum.length - 1];
  const noktalar = [];
  let j = 0;
  for (let d = 0; d <= toplam + 0.001; d += adim) {
    const dd = Math.min(d, toplam);
    while (j < cum.length - 2 && cum[j + 1] < dd) j++;
    const parca = cum[j + 1] - cum[j] || 1;
    const t = Math.max(0, Math.min(1, (dd - cum[j]) / parca));
    const a = koordlar[j], b = koordlar[j + 1] || a;
    noktalar.push({ d: dd, lng: a[0] + (b[0] - a[0]) * t, lat: a[1] + (b[1] - a[1]) * t, hiz: hizlar[j] || 60 });
    if (dd >= toplam) break;
  }
  if (noktalar.length && noktalar[noktalar.length - 1].d < toplam - 1) {
    const s = koordlar[koordlar.length - 1];
    noktalar.push({ d: toplam, lng: s[0], lat: s[1], hiz: hizlar[hizlar.length - 1] || 60 });
  }
  return { noktalar, toplam };
}

// DEM (90 m çözünürlük) gürültüsünü, köprü/viyadük ve yarma kaynaklı sahte iniş-çıkışları
// bastırmak için ~5 örneklik (yaklaşık 500 m) hareketli ortalama
function sfYumusat(h, yari = 2) {
  if (h.length < 3) return h.slice();
  return h.map((_, i) => {
    const a = Math.max(0, i - yari), b = Math.min(h.length - 1, i + yari);
    let t = 0;
    for (let k = a; k <= b; k++) t += h[k];
    return t / (b - a + 1);
  });
}
const SF_MAX_YOL_EGIM = 0.12; // karayolunda %12'yi aşan eğim DEM hatası kabul edilir

function sfSegmentler(noktalar, rakimlar) {
  const h = sfYumusat(rakimlar);
  const seg = [];
  for (let i = 1; i < noktalar.length; i++) {
    const m = noktalar[i].d - noktalar[i - 1].d;
    const dh = Math.max(-SF_MAX_YOL_EGIM * m, Math.min(SF_MAX_YOL_EGIM * m, h[i] - h[i - 1]));
    seg.push({ m, dh, hiz: noktalar[i - 1].hiz });
  }
  return seg;
}

// Araç için gerçekleşen/tahmin oranlarından düzeltme katsayısı (en az 2 kayıt)
function sfKalibrasyon(kayitlar, aracId) {
  const oranlar = kayitlar
    .filter((k) => k.aracId === aracId && +k.gercekLitre > 0 && +k.hamLitre > 0)
    .map((k) => +k.gercekLitre / +k.hamLitre)
    .sort((a, b) => a - b);
  if (oranlar.length < 2) return { katsayi: 1, adet: oranlar.length };
  const orta = oranlar.length % 2 ? oranlar[(oranlar.length - 1) / 2] : (oranlar[oranlar.length / 2 - 1] + oranlar[oranlar.length / 2]) / 2;
  return { katsayi: Math.max(0.7, Math.min(1.4, orta)), adet: oranlar.length };
}

// ---------------------------------------------------------------- ağ çağrıları
async function sfRotaAl(a, b) {
  const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson&annotations=distance,duration`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Rota servisi yanıt vermedi (" + r.status + ")");
  const j = await r.json();
  if (j.code !== "Ok" || !j.routes || !j.routes.length) throw new Error("Bu iki nokta arasında rota bulunamadı.");
  const rota = j.routes[0];
  const koordlar = rota.geometry.coordinates;
  const ann = (rota.legs[0] && rota.legs[0].annotation) || {};
  const hizlar = (ann.distance || []).map((d, i) => {
    const t = (ann.duration || [])[i];
    return t > 0 ? (d / t) * 3.6 : 60;
  });
  return { koordlar, hizlar, mesafe: rota.distance, sure: rota.duration };
}

async function sfRakimAl(noktalar) {
  const sonuc = new Array(noktalar.length);
  const parcalar = [];
  for (let i = 0; i < noktalar.length; i += 100) parcalar.push(i);
  const isle = async (bas) => {
    const dilim = noktalar.slice(bas, bas + 100);
    const lat = dilim.map((n) => n.lat.toFixed(5)).join(",");
    const lng = dilim.map((n) => n.lng.toFixed(5)).join(",");
    const r = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
    if (!r.ok) throw new Error("Rakım servisi yanıt vermedi (" + r.status + ")");
    const j = await r.json();
    (j.elevation || []).forEach((h, k) => { sonuc[bas + k] = h; });
  };
  for (let i = 0; i < parcalar.length; i += 3) {
    await Promise.all(parcalar.slice(i, i + 3).map(isle));
  }
  for (let i = 0; i < sonuc.length; i++) if (typeof sonuc[i] !== "number") sonuc[i] = i > 0 ? sonuc[i - 1] : 0;
  return sonuc;
}

async function sfAdresAra(q) {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=tr&accept-language=tr&q=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error("Adres araması başarısız");
  return (await r.json()).map((x) => ({ ad: x.display_name, lat: +x.lat, lng: +x.lon }));
}

async function sfTersAdres(lat, lng) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=16&accept-language=tr&lat=${lat}&lon=${lng}`);
    const j = await r.json();
    return (j.display_name || "").split(",").slice(0, 3).join(",").trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

// Bir bacağı uçtan uca hesaplar (rota + rakım + fizik)
async function sfBacakTam(a, b, p, yukKg) {
  const rota = await sfRotaAl(a, b);
  const adim = Math.max(100, rota.mesafe / 1000);
  const { noktalar } = sfOrnekle(rota.koordlar, rota.hizlar, adim);
  let rakimlar, rakimHata = null;
  try { rakimlar = await sfRakimAl(noktalar); } catch (e) { rakimlar = noktalar.map(() => 0); rakimHata = e.message; }
  const sonuc = sfBacakHesapla(sfSegmentler(noktalar, rakimlar), p, yukKg);
  return { ...sonuc, koordlar: rota.koordlar, profil: noktalar.map((n, i) => ({ km: +(n.d / 1000).toFixed(2), h: Math.round(rakimlar[i]) })), rakimHata };
}

const sfFmtSure = (sn) => {
  const dk = Math.round(sn / 60);
  return dk >= 60 ? `${Math.floor(dk / 60)} sa ${dk % 60} dk` : `${dk} dk`;
};
const sfFmtLt = (x) => (+x || 0).toLocaleString("tr-TR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

// ---------------------------------------------------------------- bileşenler
function SfNoktaSecici({ etiket, renk, deger, onChange, aktif, onAktif }) {
  const [q, setQ] = useState("");
  const [sonuclar, setSonuclar] = useState([]);
  const [araniyor, setAraniyor] = useState(false);
  const ara = async () => {
    if (!q.trim()) return;
    setAraniyor(true);
    try {
      const s = await sfAdresAra(q.trim());
      setSonuclar(s);
      if (!s.length) fpToast("Adres bulunamadı. Haritadan işaretleyebilirsiniz.", "error");
    } catch (e) { fpToast(e.message, "error"); }
    setAraniyor(false);
  };
  return (
    <div style={{ border: `1px solid ${aktif ? renk : C.border}`, borderRadius: 10, padding: 12, marginBottom: 10, background: aktif ? hexA(renk, 0.06) : "transparent" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: renk, display: "inline-block" }} />
        <strong style={{ color: C.white, fontSize: 13 }}>{etiket}</strong>
        <button style={{ ...S.btnO, marginLeft: "auto", fontSize: 11, padding: "4px 10px", borderColor: aktif ? renk : C.border, color: aktif ? renk : C.muted }} onClick={onAktif}>
          {aktif ? "📍 Haritaya tıklayın" : "📍 Haritadan seç"}
        </button>
      </div>
      {deger ? (
        <div style={{ fontSize: 12, color: C.text, marginBottom: 8, display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ flex: 1 }}>{deger.ad}</span>
          <button style={{ ...S.btnO, fontSize: 11, padding: "2px 8px" }} onClick={() => onChange(null)}>✕</button>
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 6 }}>
        <input style={{ ...S.inp, flex: 1 }} value={q} placeholder="Adres / mahalle / yer adı ara..." onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ara()} />
        <button style={S.btnO} onClick={ara} disabled={araniyor}>{araniyor ? "…" : "Ara"}</button>
      </div>
      {sonuclar.length > 0 && (
        <div style={{ marginTop: 6, maxHeight: 160, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 8 }}>
          {sonuclar.map((s, i) => (
            <div key={i} style={{ padding: "7px 10px", fontSize: 12, cursor: "pointer", borderBottom: `1px solid ${C.border}`, color: C.text }}
              onClick={() => { onChange({ ad: s.ad.split(",").slice(0, 3).join(","), lat: s.lat, lng: s.lng }); setSonuclar([]); setQ(""); }}>
              {s.ad}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const SF_RENK = { garaj: "#3b82f6", alis: "#ef4444", teslim: "#22c55e" };

function SfHarita({ noktalar, bacaklar, aktifNokta, onTikla }) {
  const kutu = useRef(null), harita = useRef(null), katman = useRef(null), tikRef = useRef(onTikla);
  tikRef.current = onTikla;
  useEffect(() => {
    if (!window.L || !kutu.current || harita.current) return;
    const m = L.map(kutu.current).setView([38.918, 27.84], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 19 }).addTo(m);
    katman.current = L.layerGroup().addTo(m);
    m.on("click", (e) => tikRef.current && tikRef.current(e.latlng.lat, e.latlng.lng));
    harita.current = m;
    setTimeout(() => m.invalidateSize(), 200);
    return () => { m.remove(); harita.current = null; };
  }, []);
  useEffect(() => {
    const m = harita.current, g = katman.current;
    if (!m || !g) return;
    g.clearLayers();
    const sinir = [];
    (bacaklar || []).forEach((b) => {
      if (!b.koordlar) return;
      const ll = b.koordlar.map((c) => [c[1], c[0]]);
      L.polyline(ll, { color: b.yuklu ? "#f59e0b" : "#3b82f6", weight: 5, opacity: 0.85, dashArray: b.yuklu ? null : "8 6" }).addTo(g);
      ll.forEach((p) => sinir.push(p));
    });
    Object.entries(noktalar).forEach(([k, n]) => {
      if (!n) return;
      L.circleMarker([n.lat, n.lng], { radius: 9, color: "#fff", weight: 2, fillColor: SF_RENK[k], fillOpacity: 1 }).bindTooltip(n.ad).addTo(g);
      sinir.push([n.lat, n.lng]);
    });
    if (sinir.length > 1) m.fitBounds(sinir, { padding: [30, 30] });
    else if (sinir.length === 1) m.setView(sinir[0], 13);
  }, [noktalar, bacaklar]);
  return (
    <div style={{ position: "relative" }}>
      <div ref={kutu} style={{ height: 380, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}`, cursor: aktifNokta ? "crosshair" : "grab" }} />
      {!window.L && <div style={{ padding: 20, color: C.muted, fontSize: 13 }}>Harita kütüphanesi yüklenemedi; adres aramasıyla devam edebilirsiniz.</div>}
      <div style={{ display: "flex", gap: 14, fontSize: 11, color: C.muted, marginTop: 6, flexWrap: "wrap" }}>
        <span><span style={{ color: "#3b82f6" }}>━ ━</span> Boş gidiş/dönüş</span>
        <span><span style={{ color: "#f59e0b" }}>━━━</span> Yüklü</span>
      </div>
    </div>
  );
}

function SeferYakitHesabi() {
  const ayar = getSettings();
  const [araclar] = useState(() => LS.get("araclar").filter((a) => a.durum !== "hurda"));
  const [kayitlar, setKayitlar] = useState(() => LS.get("seferYakitHesaplari"));
  const uygunlar = araclar.filter((a) => sfAracParam(a));
  const [aracId, setAracId] = useState(() => (uygunlar[0] || araclar[0] || {}).id || "");
  const [noktalar, setNoktalar] = useState(() => ({ garaj: ayar.seferGaraj || null, alis: null, teslim: null }));
  const [aktifNokta, setAktifNokta] = useState(null);
  const [yukTon, setYukTon] = useState(1.4);
  const [garajaDonus, setGarajaDonus] = useState(true);
  const [vincDk, setVincDk] = useState(20);
  const [beklemeDk, setBeklemeDk] = useState(15);
  const [litreFiyat, setLitreFiyat] = useState(ayar.varsayilanYakitFiyat || "");
  const [otoyol, setOtoyol] = useState("");
  const [sofor, setSofor] = useState("");
  const [karYuzde, setKarYuzde] = useState(30);
  const [kalibrasyonUygula, setKalibrasyonUygula] = useState(true);
  const [aciklama, setAciklama] = useState("");
  const [sonuc, setSonuc] = useState(null);
  const [hesaplaniyor, setHesaplaniyor] = useState(false);
  const [hata, setHata] = useState("");

  const arac = araclar.find((a) => a.id === aracId);
  const p = sfAracParam(arac);
  const kal = sfKalibrasyon(kayitlar, aracId);
  const katsayi = kalibrasyonUygula ? kal.katsayi : 1;

  const noktaAyarla = (k, v) => { setNoktalar((n) => ({ ...n, [k]: v })); setSonuc(null); };
  const haritaTik = async (lat, lng) => {
    if (!aktifNokta) return;
    const k = aktifNokta;
    setAktifNokta(null);
    noktaAyarla(k, { ad: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng });
    const ad = await sfTersAdres(lat, lng);
    setNoktalar((n) => (n[k] && n[k].lat === lat ? { ...n, [k]: { ...n[k], ad } } : n));
  };
  const garajKaydet = () => {
    if (!noktalar.garaj) return;
    saveSettings({ ...getSettings(), seferGaraj: noktalar.garaj });
    fpToast("Garaj konumu varsayılan olarak kaydedildi.", "success");
  };

  const hesapla = async () => {
    setHata("");
    if (!p) { setHata("Seçilen aracın yakıt parametreleri eksik. Araçlar sekmesinden aracı düzenleyip 'Boş 100 km tüketim' ve 'Boş ağırlık' alanlarını doldurun."); return; }
    if (!noktalar.alis || !noktalar.teslim) { setHata("Alış (olay yeri) ve teslim noktasını seçin."); return; }
    const yukKg = (+yukTon || 0) * 1000;
    const plan = [];
    if (noktalar.garaj) plan.push({ ad: "Garaj → Olay yeri", a: noktalar.garaj, b: noktalar.alis, yuklu: false });
    plan.push({ ad: "Olay yeri → Teslim", a: noktalar.alis, b: noktalar.teslim, yuklu: true });
    if (garajaDonus && noktalar.garaj) plan.push({ ad: "Teslim → Garaj", a: noktalar.teslim, b: noktalar.garaj, yuklu: false });
    setHesaplaniyor(true);
    try {
      const bacaklar = [];
      for (const b of plan) {
        const r = await sfBacakTam(b.a, b.b, p, b.yuklu ? yukKg : 0);
        bacaklar.push({ ...b, ...r });
      }
      setSonuc({ bacaklar, yukKg, zaman: Date.now() });
    } catch (e) {
      setHata(e.message || "Hesaplama başarısız. İnternet bağlantınızı kontrol edin.");
    }
    setHesaplaniyor(false);
  };

  // Toplamlar: rota sonucu + parametre değişiklikleri anlık yansısın diye burada hesaplanır
  const ozet = useMemo(() => {
    if (!sonuc || !p) return null;
    const yolLt = sonuc.bacaklar.reduce((s, b) => s + b.litre, 0);
    const ptoLt = ((+vincDk || 0) / 60) * p.pto;
    const rolantiLt = ((+beklemeDk || 0) / 60) * SF_ROLANTI_LT_SAAT;
    const hamLitre = yolLt + ptoLt + rolantiLt;
    const litre = hamLitre * katsayi;
    const fiyat = +litreFiyat || 0;
    const yakitTL = litre * fiyat;
    const ekTL = (+otoyol || 0) + (+sofor || 0);
    const maliyet = yakitTL + ekTL;
    const teklif = maliyet * (1 + (+karYuzde || 0) / 100);
    const km = sonuc.bacaklar.reduce((s, b) => s + b.km, 0);
    const sure = sonuc.bacaklar.reduce((s, b) => s + b.sure, 0) + ((+vincDk || 0) + (+beklemeDk || 0)) * 60;
    const ltRampa = sonuc.bacaklar.reduce((s, b) => s + b.ltRampa, 0);
    const ltYuk = sonuc.bacaklar.reduce((s, b) => s + b.ltYuk, 0);
    return { yolLt, ptoLt, rolantiLt, hamLitre, litre, yakitTL, ekTL, maliyet, teklif, km, sure, ltRampa, ltYuk, lt100: km > 0 ? (yolLt * katsayi) / km * 100 : 0 };
  }, [sonuc, p, vincDk, beklemeDk, katsayi, litreFiyat, otoyol, sofor, karYuzde]);

  const asiriYuk = p && p.azamiKg > 0 && p.bosKg + (+yukTon || 0) * 1000 > p.azamiKg;

  const kaydet = () => {
    if (!sonuc || !ozet) return;
    const kayit = {
      id: uid(), tarih: today(), aracId, aracAd: arac ? `${arac.ad} (${arac.plaka})` : "",
      garaj: noktalar.garaj, alis: noktalar.alis, teslim: noktalar.teslim, garajaDonus,
      yukTon: +yukTon || 0, vincDk: +vincDk || 0, beklemeDk: +beklemeDk || 0,
      km: +ozet.km.toFixed(1), hamLitre: +ozet.hamLitre.toFixed(2), litre: +ozet.litre.toFixed(2),
      litreFiyat: +litreFiyat || 0, yakitTL: Math.round(ozet.yakitTL), ekTL: ozet.ekTL,
      maliyet: Math.round(ozet.maliyet), karYuzde: +karYuzde || 0, teklif: Math.round(ozet.teklif),
      aciklama, gercekLitre: null,
    };
    const yeni = [kayit, ...kayitlar];
    LS.set("seferYakitHesaplari", yeni);
    setKayitlar(yeni);
    fpToast("Sefer hesabı kaydedildi.", "success");
  };
  const gercekGir = (id, v) => {
    const yeni = kayitlar.map((k) => (k.id === id ? { ...k, gercekLitre: v === "" ? null : +v } : k));
    LS.set("seferYakitHesaplari", yeni);
    setKayitlar(yeni);
  };
  const sil = async (id) => {
    if (!(await fpConfirm("Bu sefer hesabı silinsin mi?"))) return;
    const yeni = kayitlar.filter((k) => k.id !== id);
    LS.set("seferYakitHesaplari", yeni);
    setKayitlar(yeni);
  };

  const teklifMetni = () => {
    if (!ozet) return "";
    const f = getSettings().firmaAdi || "";
    return [
      `🚨 ${f ? f + " — " : ""}Kurtarma / Taşıma Teklifi`,
      `📍 Alış: ${noktalar.alis ? noktalar.alis.ad : ""}`,
      `🏁 Teslim: ${noktalar.teslim ? noktalar.teslim.ad : ""}`,
      `🚗 Taşınacak: ${(+yukTon || 0).toLocaleString("tr-TR")} ton`,
      `🛣️ Toplam yol: ${ozet.km.toFixed(0)} km`,
      `💰 Teklif tutarı: ${fmtTL(ozet.teklif)}`,
    ].join("\n");
  };

  const profil = useMemo(() => {
    if (!sonuc) return [];
    let ofset = 0;
    const out = [];
    sonuc.bacaklar.forEach((b) => {
      b.profil.forEach((n, i) => { if (i % 2 === 0 || i === b.profil.length - 1) out.push({ km: +(ofset + n.km).toFixed(1), h: n.h }); });
      ofset += b.km;
    });
    return out;
  }, [sonuc]);

  const Grafik = RC.LineChart && RC.ResponsiveContainer;

  return (
    <div>
      <InfoBox color={C.blue}>
        Araç, yük ve güzergâh seçin; rota üzerindeki rampalar, yük, şehir içi/dışı yol ve vinç kullanımı hesaba katılarak yakıt (lt) ve maliyet (TL) hesaplanır.
        Hesap, araç kartındaki <strong>boş 100 km tüketim</strong> değerine göre kalibre edilir. Sefer sonrası gerçek litreyi girdikçe tahminler o araca göre kendini düzeltir.
      </InfoBox>

      <div style={S.g2}>
        <div>
          <div style={S.card} className="fp-card">
            <div style={{ fontWeight: 700, color: C.white, marginBottom: 12 }}>🚛 Araç ve Yük</div>
            <FG label="Araç">
              <select style={S.sel} value={aracId} onChange={(e) => { setAracId(e.target.value); setSonuc(null); }}>
                {araclar.length === 0 && <option value="">— Araç yok —</option>}
                {araclar.map((a) => (
                  <option key={a.id} value={a.id}>{a.ad} ({a.plaka}){sfAracParam(a) ? "" : " — parametre eksik"}</option>
                ))}
              </select>
            </FG>
            {arac && !p && (
              <div style={{ fontSize: 12, color: C.orange, marginBottom: 10 }}>
                ⚠️ Bu aracın yakıt parametreleri girilmemiş. Araçlar sekmesinde aracı düzenleyip "Sefer Yakıt Hesabı Parametreleri" bölümünü doldurun.
              </div>
            )}
            {p && (
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.7 }}>
                Boş: şehir dışı <strong style={{ color: C.text }}>{sfFmtLt(p.disi)} lt/100km</strong> · şehir içi <strong style={{ color: C.text }}>{sfFmtLt(p.ici)}</strong>
                {" · "}boş ağırlık <strong style={{ color: C.text }}>{(p.bosKg / 1000).toLocaleString("tr-TR")} t</strong> · {p.kasa.label}
              </div>
            )}
            <FG label="Taşınacak aracın ağırlığı (ton)">
              <input type="number" step="0.1" min="0" style={S.inp} value={yukTon} onChange={(e) => setYukTon(e.target.value)} />
            </FG>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: -6, marginBottom: 12 }}>
              {SF_YUK_HAZIR.map(([ad, t]) => (
                <button key={ad} style={{ ...S.btnO, fontSize: 11, padding: "4px 9px", borderColor: +yukTon === t ? C.accent : C.border, color: +yukTon === t ? C.accent : C.muted }} onClick={() => setYukTon(t)}>
                  {ad} {t.toLocaleString("tr-TR")} t
                </button>
              ))}
            </div>
            {asiriYuk && <div style={{ fontSize: 12, color: C.red, marginBottom: 10 }}>⛔ Toplam ağırlık aracın azami yüklü ağırlığını aşıyor ({(p.azamiKg / 1000).toLocaleString("tr-TR")} t).</div>}
            <div style={S.g2}>
              <FG label="Vinç / ahtapot çalışma (dk)">
                <input type="number" min="0" style={S.inp} value={vincDk} onChange={(e) => setVincDk(e.target.value)} />
              </FG>
              <FG label="Rölantide bekleme (dk)">
                <input type="number" min="0" style={S.inp} value={beklemeDk} onChange={(e) => setBeklemeDk(e.target.value)} />
              </FG>
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: C.text, cursor: "pointer" }}>
              <input type="checkbox" checked={garajaDonus} onChange={(e) => { setGarajaDonus(e.target.checked); setSonuc(null); }} />
              Teslimden sonra garaja dönüş dahil (boş)
            </label>
          </div>

          <div style={S.card} className="fp-card">
            <div style={{ fontWeight: 700, color: C.white, marginBottom: 12 }}>🗺️ Güzergâh</div>
            <SfNoktaSecici etiket="Çıkış (garaj)" renk={SF_RENK.garaj} deger={noktalar.garaj} onChange={(v) => noktaAyarla("garaj", v)} aktif={aktifNokta === "garaj"} onAktif={() => setAktifNokta(aktifNokta === "garaj" ? null : "garaj")} />
            {noktalar.garaj && (!ayar.seferGaraj || ayar.seferGaraj.lat !== noktalar.garaj.lat) && (
              <button style={{ ...S.btnO, fontSize: 11, marginTop: -4, marginBottom: 10 }} onClick={garajKaydet}>💾 Bu konumu varsayılan garaj yap</button>
            )}
            <SfNoktaSecici etiket="Alış (olay yeri)" renk={SF_RENK.alis} deger={noktalar.alis} onChange={(v) => noktaAyarla("alis", v)} aktif={aktifNokta === "alis"} onAktif={() => setAktifNokta(aktifNokta === "alis" ? null : "alis")} />
            <SfNoktaSecici etiket="Teslim noktası" renk={SF_RENK.teslim} deger={noktalar.teslim} onChange={(v) => noktaAyarla("teslim", v)} aktif={aktifNokta === "teslim"} onAktif={() => setAktifNokta(aktifNokta === "teslim" ? null : "teslim")} />
          </div>

          <div style={S.card} className="fp-card">
            <div style={{ fontWeight: 700, color: C.white, marginBottom: 12 }}>💰 Fiyat</div>
            <div style={S.g2}>
              <FG label="Motorin litre fiyatı (₺)">
                <input type="number" step="0.01" style={S.inp} value={litreFiyat} onChange={(e) => setLitreFiyat(e.target.value)} placeholder="Örn: 47,50" />
              </FG>
              <FG label="Kâr marjı (%)">
                <input type="number" style={S.inp} value={karYuzde} onChange={(e) => setKarYuzde(e.target.value)} />
              </FG>
            </div>
            <div style={S.g2}>
              <FG label="Otoyol / köprü (₺)">
                <input type="number" style={S.inp} value={otoyol} onChange={(e) => setOtoyol(e.target.value)} placeholder="0" />
              </FG>
              <FG label="Şoför / personel (₺)">
                <input type="number" style={S.inp} value={sofor} onChange={(e) => setSofor(e.target.value)} placeholder="0" />
              </FG>
            </div>
            {kal.adet >= 2 && (
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: C.text, cursor: "pointer", marginBottom: 10 }}>
                <input type="checkbox" checked={kalibrasyonUygula} onChange={(e) => setKalibrasyonUygula(e.target.checked)} />
                Gerçek seferlerden düzeltme katsayısını uygula (×{kal.katsayi.toFixed(2)}, {kal.adet} sefer)
              </label>
            )}
            {hata && <div style={{ color: C.red, fontSize: 13, marginBottom: 10 }}>{hata}</div>}
            <button style={{ ...S.btn(), width: "100%", padding: "12px 16px", fontSize: 15 }} onClick={hesapla} disabled={hesaplaniyor}>
              {hesaplaniyor ? "⏳ Rota ve rampalar hesaplanıyor…" : "⛽ Yakıtı Hesapla"}
            </button>
          </div>
        </div>

        <div>
          <div style={S.card} className="fp-card">
            <SfHarita noktalar={noktalar} bacaklar={sonuc ? sonuc.bacaklar : null} aktifNokta={aktifNokta} onTikla={haritaTik} />
          </div>

          {ozet && (
            <div style={S.card} className="fp-card">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(115px,1fr))", gap: 10, marginBottom: 14 }}>
                <StatCard color={C.accent} icon="⛽" value={`${sfFmtLt(ozet.litre)} lt`} label="Toplam yakıt" sub={`${sfFmtLt(ozet.lt100)} lt/100km ortalama`} />
                <StatCard color={C.red} icon="₺" value={fmtTL(ozet.yakitTL)} label="Yakıt maliyeti" sub={litreFiyat ? `${(+litreFiyat).toLocaleString("tr-TR")} ₺/lt` : "Litre fiyatı girin"} />
                <StatCard color={C.blue} icon="🛣️" value={`${ozet.km.toFixed(0)} km`} label="Toplam yol" sub={sfFmtSure(ozet.sure)} />
                <StatCard color={C.green} icon="🧾" value={fmtTL(ozet.teklif)} label="Önerilen teklif" sub={`Maliyet ${fmtTL(ozet.maliyet)} + %${+karYuzde || 0}`} />
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={S.tbl}>
                  <thead>
                    <tr>
                      <th style={S.th}>Bacak</th><th style={S.th}>Durum</th><th style={S.th}>Km</th><th style={S.th}>Süre</th>
                      <th style={S.th}>Tırmanış</th><th style={S.th}>Maks. eğim</th><th style={S.th}>Litre</th><th style={S.th}>TL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sonuc.bacaklar.map((b, i) => (
                      <tr key={i}>
                        <td style={S.td}>{b.ad}</td>
                        <td style={S.td}>{b.yuklu ? `🟧 Yüklü (${(+yukTon).toLocaleString("tr-TR")} t)` : "🟦 Boş"}</td>
                        <td style={S.td}>{b.km.toFixed(1)}</td>
                        <td style={S.td}>{sfFmtSure(b.sure)}</td>
                        <td style={S.td}>↗ {Math.round(b.tirmanis)} m · ↘ {Math.round(b.inis)} m</td>
                        <td style={S.td}>%{(b.maxEgim * 100).toFixed(1)}</td>
                        <td style={S.td}>{sfFmtLt(b.litre * katsayi)}</td>
                        <td style={S.td}>{fmtTL(b.litre * katsayi * (+litreFiyat || 0))}</td>
                      </tr>
                    ))}
                    {ozet.ptoLt > 0 && (
                      <tr><td style={S.td} colSpan={6}>🏗️ Vinç / ahtapot ({vincDk} dk × {sfFmtLt(p.pto)} lt/saat)</td><td style={S.td}>{sfFmtLt(ozet.ptoLt * katsayi)}</td><td style={S.td}>{fmtTL(ozet.ptoLt * katsayi * (+litreFiyat || 0))}</td></tr>
                    )}
                    {ozet.rolantiLt > 0 && (
                      <tr><td style={S.td} colSpan={6}>⏱️ Rölanti bekleme ({beklemeDk} dk)</td><td style={S.td}>{sfFmtLt(ozet.rolantiLt * katsayi)}</td><td style={S.td}>{fmtTL(ozet.rolantiLt * katsayi * (+litreFiyat || 0))}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ fontSize: 12, color: C.muted, marginTop: 10, lineHeight: 1.7 }}>
                Yükün getirdiği ek yakıt: <strong style={{ color: C.text }}>{sfFmtLt(ozet.ltYuk * katsayi)} lt</strong>
                {" · "}Rampaların net etkisi: <strong style={{ color: C.text }}>{ozet.ltRampa >= 0 ? "+" : ""}{sfFmtLt(ozet.ltRampa * katsayi)} lt</strong>
                {sonuc.bacaklar.some((b) => b.rakimHata) && <div style={{ color: C.orange }}>⚠️ Rakım verisi alınamadı; rampalar hesaba katılmadan düz yol varsayıldı.</div>}
              </div>

              {Grafik && profil.length > 2 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Yükseklik profili (m)</div>
                  <RC.ResponsiveContainer width="100%" height={160}>
                    <RC.LineChart data={profil} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <RC.CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                      <RC.XAxis dataKey="km" tick={{ fill: C.muted, fontSize: 10 }} unit=" km" minTickGap={30} />
                      <RC.YAxis tick={{ fill: C.muted, fontSize: 10 }} domain={["dataMin - 20", "dataMax + 20"]} />
                      <RC.Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, fontSize: 12 }} formatter={(v) => [`${v} m`, "Rakım"]} labelFormatter={(l) => `${l} km`} />
                      <RC.Line type="monotone" dataKey="h" stroke={C.accent} dot={false} strokeWidth={2} />
                    </RC.LineChart>
                  </RC.ResponsiveContainer>
                </div>
              )}

              <FG label="Not (opsiyonel)">
                <input style={S.inp} value={aciklama} onChange={(e) => setAciklama(e.target.value)} placeholder="Müşteri, plaka, iş emri no..." />
              </FG>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={S.btn(C.green)} onClick={kaydet}>💾 Seferi Kaydet</button>
                <button style={S.btnO} onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(teklifMetni())}`, "_blank")}>💬 Teklifi WhatsApp ile Gönder</button>
                <button style={S.btnO} onClick={() => { try { navigator.clipboard.writeText(teklifMetni()); fpToast("Teklif metni kopyalandı.", "success"); } catch { fpToast("Kopyalanamadı.", "error"); } }}>📋 Kopyala</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={S.card} className="fp-card">
        <div style={{ fontWeight: 700, color: C.white, marginBottom: 6 }}>📒 Kayıtlı Sefer Hesapları</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>
          Sefer bittikten sonra gerçekte harcanan litreyi girin. Bir araç için en az 2 sefer girildiğinde tahminler o aracın gerçek tüketimine göre otomatik düzeltilir.
        </div>
        {kayitlar.length === 0 ? (
          <div style={{ color: C.muted, fontSize: 13 }}>Henüz kayıtlı sefer yok.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={S.tbl}>
              <thead>
                <tr>
                  <th style={S.th}>Tarih</th><th style={S.th}>Araç</th><th style={S.th}>Güzergâh</th><th style={S.th}>Yük</th><th style={S.th}>Km</th>
                  <th style={S.th}>Tahmin (lt)</th><th style={S.th}>Gerçek (lt)</th><th style={S.th}>Sapma</th><th style={S.th}>Teklif</th><th style={S.th}></th>
                </tr>
              </thead>
              <tbody>
                {kayitlar.slice(0, 200).map((k) => {
                  const sapma = k.gercekLitre > 0 && k.litre > 0 ? ((k.gercekLitre - k.litre) / k.litre) * 100 : null;
                  return (
                    <tr key={k.id}>
                      <td style={S.td}>{fmtDate(k.tarih)}</td>
                      <td style={S.td}>{k.aracAd}</td>
                      <td style={{ ...S.td, maxWidth: 260, fontSize: 12 }}>{(k.alis && k.alis.ad) || "—"} → {(k.teslim && k.teslim.ad) || "—"}{k.aciklama ? <div style={{ color: C.muted }}>{k.aciklama}</div> : null}</td>
                      <td style={S.td}>{(+k.yukTon).toLocaleString("tr-TR")} t</td>
                      <td style={S.td}>{k.km}</td>
                      <td style={S.td}>{sfFmtLt(k.litre)}</td>
                      <td style={S.td}>
                        <input type="number" step="0.1" style={{ ...S.inp, width: 90, padding: "5px 8px" }} defaultValue={k.gercekLitre == null ? "" : k.gercekLitre} onBlur={(e) => gercekGir(k.id, e.target.value)} placeholder="—" />
                      </td>
                      <td style={{ ...S.td, color: sapma == null ? C.muted : Math.abs(sapma) <= 10 ? C.green : C.orange }}>{sapma == null ? "—" : `${sapma > 0 ? "+" : ""}${sapma.toFixed(0)}%`}</td>
                      <td style={S.td}>{fmtTL(k.teklif)}</td>
                      <td style={S.td}><button style={{ ...S.btnO, fontSize: 11, padding: "3px 8px", color: C.red }} onClick={() => sil(k.id)}>Sil</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
