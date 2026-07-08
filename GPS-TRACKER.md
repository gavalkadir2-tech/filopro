# FiloPro GPS İzleme Modülü

**Canlı araç takip sistemi** — GPS konumu, rota geçmişi ve gerçek zamanlı hız izleme.

## 🎯 Özellikler

✅ **Canlı Konum Takibi** — Tüm araçların gerçek zamanlı konumunu harita üzerinde göster  
✅ **Rota Geçmişi** — Araçların giddiği yolun tam kaydını tutması  
✅ **Hız & Yön Bilgisi** — Her konum güncellemesinde hız ve pusula yönü  
✅ **Zaman Aralığı Filtrelemesi** — Geçmiş rota verilerini tarihe göre sorgula  
✅ **Multi-tenant** — Her şirketin kendi araç verisi izole  
✅ **Şartsız Offline** — GPS verileri sunucu olmadan da saklanabilir  

---

## 🔧 Kurulum

### 1. **Backend API Aktivasyonu**

Backend (`server/server.js`) zaten GPS API'larını içeriyor:

```bash
POST   /api/gps/update              # Konum güncellemesi gönder
GET    /api/gps/vehicles            # Tüm araçların canlı konumları
GET    /api/gps/route/:vehicleId    # Araç rota geçmişi
GET    /api/gps/route/:vehicleId/range  # Zaman aralığına göre rota
DELETE /api/gps/vehicle/:vehicleId  # Araç verilerini sil
```

**Örnek: Konum Güncellemesi Gönderme**

```javascript
const updateGpsLocation = async (vehicleId, lat, lng, speed = 0, heading = 0) => {
  const cfg = JSON.parse(localStorage.getItem('fp_sync_cfg') || '{}');
  
  const res = await fetch(`${cfg.url}/api/gps/update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.token}`
    },
    body: JSON.stringify({
      vehicleId,
      latitude: lat,
      longitude: lng,
      speed,
      heading
    })
  });
  
  return res.json();
};
```

### 2. **GPS İzleme Arayüzü (Harita)**

Repositoryde `gps-tracker.html` dosyası var — bu bağımsız bir sayfa:

```bash
# Tarayıcıda açın:
file:///path/to/filopro/gps-tracker.html
```

**veya internete deploy edin:**

```bash
# Render.com, Railway, GitHub Pages vb.
gps-tracker.html dosyasını sunun
```

---

## 📊 Veri Yapısı

### Canlı Konum Formatı

```json
{
  "vehicleId": "arac_001",
  "latitude": 38.7456,
  "longitude": 27.3820,
  "speed": 42.5,
  "heading": 125,
  "accuracy": 5.0,
  "timestamp": 1720428000000
}
```

### Sunucu Yanıtı (Araçlar Listesi)

```json
{
  "vehicles": [
    {
      "vehicleId": "Komatsu PC200",
      "location": {
        "lat": 38.7456,
        "lng": 27.3820,
        "speed": 42.5,
        "heading": 125,
        "accuracy": 5.0,
        "timestamp": 1720428000000
      },
      "lastUpdate": 1720428000000,
      "historyCount": 847
    }
  ],
  "serverTime": 1720428000000
}
```

---

## 🚀 Kullanım Senaryoları

### 1️⃣ **Mobile GPS Uygulaması (iOS/Android)**

Mobil uygulama her 30 saniyede bir konum gönderebilir:

```javascript
// React Native örneği (Expo Geolocation)
import * as Location from 'expo-location';

const startGpsTracking = async () => {
  Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, timeInterval: 30000 },
    async (location) => {
      await updateGpsLocation(
        'araç_001',
        location.coords.latitude,
        location.coords.longitude,
        location.coords.speed || 0,
        location.coords.heading || 0
      );
    }
  );
};
```

### 2️⃣ **IoT GPS Cihazı (Araçta)**

GPS izleme cihazı (ör. Quectel, uBlox) her dakika sunucuya konum POST eder:

```bash
curl -X POST http://filopro-sync.onrender.com/api/gps/update \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "vehicleId": "CAT-950H-001",
    "latitude": 38.7456,
    "longitude": 27.3820,
    "speed": 35.2,
    "heading": 90
  }'
```

### 3️⃣ **FiloPro Masaüstünde Takip**

Ana `index.html` dosyasına harita paneli eklenebilir (`gps-tracker.html` yükleme iframe'de):

```html
<!-- Ana panelde eklenebilir -->
<iframe src="gps-tracker.html" style="width:100%; height:600px; border:none;"></iframe>
```

---

## 📍 Harita Özellikleri

| Özellik | Açıklama |
|---------|----------|
| 🟢 Yeşil İşaretçi | Aktif araç (konum verisi mevcut) |
| 🟠 Turuncu İşaretçi | Seçili araç (rota gösteriliyor) |
| 🔴 Kırmızı İşaretçi | Çevrimdışı araç |
| 🛣️ Kesikli Çizgi | Rota geçmişi (seçili araç için) |
| 📊 Sol Panel | Araçlar listesi + canlı bilgi |

---

## 🔐 Güvenlik

- **JWT Token Gerekli**: Tüm GPS uç noktaları yetkilendirme ister
- **Multi-tenant İzolasyon**: Her şirketin sadece kendi araçlarını görmesi
- **Rate Limiting**: Konum güncellemelerine 1000 req/15min limiti
- **JSON Dosya Depolama**: Veritabanı gerektirmez, yedekleme basit

---

## 🧪 Test Etme

### Test Konum Verisi Gönderme

```bash
# 1. Sunucuya giriş yap
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"123456"}' \
  # TOKEN al

# 2. GPS güncellemesi gönder
curl -X POST http://localhost:3001/api/gps/update \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "vehicleId":"TEST-001",
    "latitude":38.7456,
    "longitude":27.3820,
    "speed":45.5,
    "heading":90
  }'

# 3. Araçları listele
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3001/api/gps/vehicles
```

---

## 📡 Entegrasyon Örneği (Node.js Backend)

Eğer kendi backend'iniz varsa, GPS verilerini FiloPro'ya gönderebilirsiniz:

```javascript
const forwardGpsToFiloPro = async (vehicleId, coords, filoProToken) => {
  const response = await fetch('https://your-filopro-server.com/api/gps/update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${filoProToken}`
    },
    body: JSON.stringify({
      vehicleId,
      latitude: coords.lat,
      longitude: coords.lng,
      speed: coords.speed,
      heading: coords.heading
    })
  });
  
  if (!response.ok) {
    console.error('GPS güncellemesi başarısız:', await response.text());
  }
};
```

---

## 📞 API Referansı

### `POST /api/gps/update`
Araç konumunu güncelle

**Request:**
```json
{
  "vehicleId": "string",
  "latitude": "number",
  "longitude": "number",
  "speed": "number (opsiyonel)",
  "heading": "number (opsiyonel)",
  "accuracy": "number (opsiyonel)"
}
```

**Response:**
```json
{
  "ok": true,
  "timestamp": 1720428000000
}
```

---

### `GET /api/gps/vehicles`
Tüm araçların canlı konumlarını al

**Response:**
```json
{
  "vehicles": [...],
  "serverTime": 1720428000000
}
```

---

### `GET /api/gps/route/:vehicleId`
Araçın tam rota geçmişini al

**Response:**
```json
{
  "vehicleId": "string",
  "currentLocation": {...},
  "route": [
    {"lat": 38.7456, "lng": 27.3820, "speed": 42, "heading": 90, "timestamp": 1720428000000},
    ...
  ],
  "lastUpdate": 1720428000000
}
```

---

### `GET /api/gps/route/:vehicleId/range?start=1720420000000&end=1720430000000`
Zaman aralığına göre rota sorgula

**Query Parametreleri:**
- `start`: Unix timestamp (ms) — başlangıç zamanı
- `end`: Unix timestamp (ms) — bitiş zamanı

---

## 🛠️ Troubleshooting

**P: "Token gerekli" hatası alıyorum**
> A: Sunucuya bağlıyken `Authorization: Bearer YOUR_TOKEN` header'ı eklediğinizden emin olun

**P: GPS verileri görmüyorum**
> A: Önce konum güncellemesi gönderdiğinizden emin olun (`/api/gps/update`). Sunucu `data/gps/` klasöründe JSON dosyaları oluşturuyor.

**P: Harita boş gösteriliyor**
> A: Tarayıcı konsolunda hataları kontrol edin (F12). OpenStreetMap'e erişiminiz olduğundan emin olun.

---

## 📈 İleri Özellikler (Gelecek)

- [ ] WebSocket canlı güncellemeler
- [ ] Jeo-fencing (bölge uyarıları)
- [ ] Sürüş davranışı analizi (hızlı gidiş, tümsek, vb.)
- [ ] Benzin tüketim tahminlemesi
- [ ] Araç arızası otomatik tespiti
- [ ] Rota optimizasyonu

---

**Versiyon:** 1.0  
**Son Güncelleme:** 2026-07-08  
**Bakım:** gavalkadir2-tech
