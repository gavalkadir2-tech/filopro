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

## Yapay Zeka Asistanı (opsiyonel, ücretsiz)

FiloPro'nun AI Asistan modülü (sohbet, arıza tahmini, maliyet projeksiyonu)
**Groq**'u kullanır — hızlı, açık modelleri (Llama 3.3 70B / 3.1 8B) kredi
kartı gerektirmeden, ücretsiz bir kotayla sunan bir sağlayıcı.

**Artık API anahtarını `.env` dosyasına yazmanıza gerek yok** — FiloPro
uygulamasının içinden, **Ayarlar → ☁️ Senkronizasyon → 🤖 Yapay Zeka
Ayarları** bölümünden (yönetici hesabıyla) girip yönetebilirsiniz:

1. [console.groq.com](https://console.groq.com) üzerinden ücretsiz bir API
   anahtarı alın (`gsk_...`).
2. FiloPro'da Ayarlar → Senkronizasyon → Yapay Zeka Ayarları'na gidin.
3. Anahtarı yapıştırın, istediğiniz modeli ve günlük istek limitini seçin,
   **Kaydet**'e basın.

Anahtar, sunucuda şirketinize özel olarak (`data/tenants/<id>.ai.json`
içinde) saklanır — tarayıcıya asla gönderilmez.

**Alternatif — tüm şirketler için ortak/varsayılan anahtar:** İsterseniz
`.env` dosyasına da `GROQ_API_KEY=gsk_...` ekleyebilirsiniz; bu, hiçbir
şirket kendi anahtarını girmediyse yedek olarak kullanılır (ör. ürünü
birden fazla müşteriye SaaS olarak sunuyorsanız, kendi anahtarınızla
başlangıç kotası sağlamak için kullanışlıdır).

Hiçbir anahtar tanımlı değilse sadece AI modülü çalışmaz, senkronizasyon ve
diğer tüm özellikler normal şekilde çalışmaya devam eder.

## Günlük Otomatik Yedek E-postası (opsiyonel)

Sunucu, her gece **00:00'da (Europe/Istanbul)**, yedek e-postası tanımlı olan
her şirketin verisini otomatik olarak JSON dosyası halinde e-posta ekiyle
gönderir. Gönderilen dosya, FiloPro'nun kendi "Yedek Al" özelliğiyle aynı
formattadır ve Ayarlar → Veri Yönetimi → Geri Yükleme'den doğrudan geri
yüklenebilir.

**Kurulum:**

1. `.env` dosyasına `SMTP_USER` ve `SMTP_PASS` girin (Gmail için:
   [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   üzerinden bir "Uygulama Şifresi" oluşturun — normal Gmail şifreniz
   çalışmaz, önce hesabınızda 2 Adımlı Doğrulama açık olmalı). Detaylı
   talimat `.env.example` içinde.
2. Sunucuyu yeniden başlatın/deploy edin.
3. FiloPro içinde Ayarlar → Senkronizasyon bölümünden yedek e-posta
   adresinizi girip kaydedin (yönetici hesabıyla). İsterseniz "Şimdi Test
   Yedeği Gönder" ile beklemeden deneyebilirsiniz.

SMTP bilgileri boş bırakılırsa bu özellik sessizce devre dışı kalır; senkron
ve diğer her şey normal çalışmaya devam eder.

**⚠️ Render.com ücretsiz plan — dış tetikleyici ZORUNLU:** Render'ın
ücretsiz Web Service planı, ~15 dakika trafik almazsa servisi uyku moduna
alır. Uykudaki bir servis, kendi iç saatiyle gece yarısı zamanlayıcıyı
(cron) çalıştıramaz — bu yüzden ücretsiz planda **iç zamanlayıcıya
güvenmeyin**, aşağıdaki ücretsiz dış tetikleyiciyi mutlaka kurun:

1. `.env` dosyasına rastgele bir `BACKUP_CRON_SECRET` değeri girin:
   ```
   node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
   ```
2. [cron-job.org](https://cron-job.org) üzerinde ücretsiz bir hesap açın,
   "Create cronjob" ile yeni bir görev oluşturun:
   - **URL:** `https://<render-servisiniz>.onrender.com/api/backup/run-daily?secret=<BACKUP_CRON_SECRET değeriniz>`
   - **Schedule:** Her gün, saat `00:05` (00:00 yerine 5 dakika sonrasını
     seçmek, Render'ın "uyanma" gecikmesi için pay bırakır) —
     **Time zone: Europe/Istanbul** olarak ayarlamayı unutmayın.
   - Kaydedin. cron-job.org artık her gece bu adresi çağırıp Render
     servisinizi uyandıracak ve yedekleme tetiklenecektir.
3. İsterseniz cron-job.org'daki "Execute now" ile hemen bir kez deneyin;
   dönen yanıt `{"ok":true,"gonderildi":N,...}` şeklinde olmalı.

Sunucunuz ileride ücretli/always-on bir plana geçerse, `.env`'deki iç
zamanlayıcı (`cron.schedule`) zaten otomatik olarak da çalışmaya devam eder;
dış tetikleyiciyi kapatmanıza gerek yoktur, ikisi çakışmaz (aynı gün içinde
zaten gönderilmiş bir şirkete tekrar e-posta gitmez).

## Mimari Notlar

- `data/users.json` — tüm kullanıcılar (hangi şirkete ait, rolü, bcrypt ile
  hash'lenmiş şifresi).
- `data/tenants/<tenantId>.json` — o şirkete ait tüm FiloPro tabloları
  (araçlar, bakımlar, personel, vb.).
- `data/tenants/<tenantId>.backup.json` — o şirketin yedek e-postası ayarı.
- Şifreler bcrypt ile hash'lenir, asla düz metin saklanmaz.
- Kullanıcı adları **platform genelinde benzersizdir** (iki farklı şirket aynı
  kullanıcı adını kullanamaz).
- Çakışma çözümü "son yazan kazanır" (last-write-wins) — **kayıt (satır) bazındadır**,
  tablo bazında değil. Aynı şirketteki iki kullanıcı aynı modülün *farklı*
  kayıtlarını aynı anda çevrimdışı düzenleyip senkronize ederse, ikisi de
  korunur (birbirini ezmez); yalnızca aynı kaydı aynı anda düzenlerlerse en
  son senkronize edilen kazanır. Küçük ekipler için pratikte gayet güvenlidir.
- `data/` klasörü düzenli yedeklenmeye değerdir.
