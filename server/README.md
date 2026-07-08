# FiloPro Senkron Sunucusu (Çok Kiracılı)

Her şirket (tenant) kendi izole verisine sahiptir; farklı şirketler birbirinin
verisini göremez. Bir şirket içinde birden fazla kullanıcı olabilir (yönetici +
ekip üyeleri) — aynı şirketteki herkes aynı veriyi görür ve senkronize eder.
Veritabanı gerekmez, düz JSON dosyalarında tutulur.

## Yerelde Çalıştırma

```bash
cd server
npm install
cp .env.example .env
```

`.env` içine rastgele bir JWT anahtarı yapıştırın:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# çıktıyı .env dosyasındaki JWT_SECRET satırına yapıştırın
```

Çalıştırın:

```bash
npm start
```

Sunucu `http://localhost:3001` adresinde ayağa kalkar.

## Dağıtım (Deployment)

Bu backend statik değildir, **GitHub Pages'te çalışmaz**. Ücretsiz/uygun seçenekler:

- **Render.com** — "Web Service" oluşturun, repoyu bağlayın, **Root Directory: `server`**,
  Build Command: `npm install`, Start Command: `npm start`. Environment sekmesinden
  `JWT_SECRET` değişkenini ekleyin.
- **Railway.app** — benzer şekilde repo bağlayıp `JWT_SECRET` ortam değişkenini girin.

Deploy sonrası size bir URL verilir (ör. `https://filopro-sync-xxxx.onrender.com`).

## Nasıl Kullanılır

1. **Yeni şirket kaydı:** FiloPro uygulamasında Ayarlar → Senkronizasyon →
   "Şirket Kaydı Oluştur" ile şirket adı + kullanıcı adı + şifre girilir.
   Bu ilk kullanıcı otomatik **yönetici (admin)** olur ve yeni, boş, izole bir
   şirket veri alanı oluşturulur.
2. **Ekip üyesi ekleme:** Yönetici, Senkronizasyon sekmesindeki "Ekip Üyeleri"
   panelinden kullanıcı adı/şifre girip yeni bir üye ekleyebilir (yönetici ya
   da normal kullanıcı rolüyle). Bu üye kendi kullanıcı adı/şifresiyle giriş
   yapar ama **aynı şirket verisini** görür.
3. **Farklı bir şirket:** Başka bir müşteri/şirket için tekrar "Şirket Kaydı
   Oluştur" ile ayrı bir kayıt açılır — bu şirketin verisi öncekinden tamamen
   izoledir.

## Mimari Notlar

- `data/users.json` — tüm kullanıcılar (hangi şirkete ait, rolü, bcrypt ile
  hash'lenmiş şifresi).
- `data/tenants/<tenantId>.json` — o şirkete ait tüm FiloPro tabloları
  (araçlar, bakımlar, personel, vb.).
- Şifreler bcrypt ile hash'lenir, asla düz metin saklanmaz.
- Kullanıcı adları **platform genelinde benzersizdir** (iki farklı şirket aynı
  kullanıcı adını kullanamaz).
- Çakışma çözümü "son yazan kazanır" (last-write-wins) — tablo bazında, kayıt
  bazında değil. Aynı şirketteki iki kullanıcı aynı modülü aynı anda çevrimdışı
  düzenleyip senkronize ederse, en son senkronize edilen değişiklik geçerli
  olur. Küçük ekipler için pratikte yeterlidir.
- `data/` klasörü düzenli yedeklenmeye değerdir.
