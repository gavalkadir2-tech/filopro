// Araç Ekle/Düzenle modalına eklenen "Sefer Yakıt Hesabı Parametreleri" bölümü.
// AraclarListesi içinde r = form, i = setForm olarak geçer; derlenip app.js'te
// "Sigorta Bitiş" satırından hemen önceye eklenir.
const __AracYakitParametreleri = (
  <div style={{ border: `1px dashed ${C.border}`, borderRadius: 10, padding: "12px 14px 2px", marginBottom: 16 }}>
    <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 4 }}>⛽ Sefer Yakıt Hesabı Parametreleri</div>
    <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>Kurtarıcı/nakliye seferlerinde yakıt ve maliyet hesabı için. Boş 100 km tüketim ve boş ağırlık zorunlu, diğerleri opsiyonel.</div>
    <div style={S.g2}>
      <FG label="Boş 100 km tüketim — şehir dışı (lt)">
        <input type="number" step="0.1" style={S.inp} value={r.bos100kmSehirDisi || ""} onChange={(d) => i((b) => ({ ...b, bos100kmSehirDisi: +d.target.value || null }))} placeholder="Örn: 22" />
      </FG>
      <FG label="Boş 100 km tüketim — şehir içi (lt, opsiyonel)">
        <input type="number" step="0.1" style={S.inp} value={r.bos100kmSehirIci || ""} onChange={(d) => i((b) => ({ ...b, bos100kmSehirIci: +d.target.value || null }))} placeholder="Boşsa şehir dışı × 1,3" />
      </FG>
    </div>
    <div style={S.g2}>
      <FG label="Boş ağırlık (ton, ruhsattan)">
        <input type="number" step="0.01" style={S.inp} value={r.bosAgirlikTon || ""} onChange={(d) => i((b) => ({ ...b, bosAgirlikTon: +d.target.value || null }))} placeholder="Örn: 7,2" />
      </FG>
      <FG label="Azami yüklü ağırlık (ton, opsiyonel)">
        <input type="number" step="0.01" style={S.inp} value={r.azamiAgirlikTon || ""} onChange={(d) => i((b) => ({ ...b, azamiAgirlikTon: +d.target.value || null }))} placeholder="Örn: 12" />
      </FG>
    </div>
    <div style={S.g2}>
      <FG label="Kasa tipi">
        <select style={S.sel} value={r.kasaTipi || ""} onChange={(d) => i((b) => ({ ...b, kasaTipi: d.target.value }))}>
          <option value="">— Seçiniz —</option>
          <option value="kayar">Kayar kasa (platform)</option>
          <option value="sabit">Sabit platform</option>
          <option value="ahtapot">Çekici / ahtapot</option>
          <option value="diger">Diğer</option>
        </select>
      </FG>
      <FG label="Vinç/ahtapot çalışırken (lt/saat, opsiyonel)">
        <input type="number" step="0.1" style={S.inp} value={r.ptoLtSaat || ""} onChange={(d) => i((b) => ({ ...b, ptoLtSaat: +d.target.value || null }))} placeholder="Boşsa 6 lt/saat" />
      </FG>
    </div>
  </div>
);
