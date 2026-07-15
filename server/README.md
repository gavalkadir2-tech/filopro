# FiloPro Senkron Sunucusu (Çok Kiracılı)

Her şirket (tenant) kendi izole verisine sahiptir; farklı şirketler birbirinin
verisini göremez. Bir şirket içinde birden fazla kullanıcı olabilir (yönetici +
ekip üyeleri) — aynı şirketteki herkes aynı veriyi görür ve senkronize eder.
Veritabanı gerekmez, düz JSON dosyalarında tutulur.

## ⚠️ Kalıcı Depolama — MongoDB Atlas (ücretsiz, önemle önerilir)

**Önemli:** Render'ın (ve çoğu ücretsiz PaaS'ın) ücretsiz planında disk
**kalıcı değildir** — servis her yeniden başladığında/uykuya dalıp
uyandığında yerel dosyalar (`data/` klasörü) **silinebilir**. Varsayılan
dosya-sistemi yöntemi, ücretsiz Render'da bu riski taşır.

**Çözüm — tamamen ücretsiz:** `.env` dosyasına `MONGODB_URI` ekleyin.
[MongoDB Atlas](https://cloud.mongodb.com)'ın **M0 planı** kalıcı ve
süresiz ücretsizdir (512MB, kredi kartı gerekmez) — kurulum adımları
`.env.example` dosyasında satır satır anlatılıyor.

Bu, MEVCUT hiçbir şeyi bozmaz: `MONGODB_URI` tanımlıysa veriler orada
saklanır (gerçekten kalıcı); tanımlı değilse sistem eskisi gibi dosya
sistemiyle çalışmaya devam eder. Zaten dosya sisteminde veriniz varsa,
`MONGODB_URI` eklediğinizde sıfırdan başlar — mevcut verinizi taşımak
isterseniz (Ayarlar → Veri Yönetimi'nden bir yedek alıp yeni kurulumda
geri yükleyerek) bize haber verin, yardımcı oluruz.

## Tek Şirket Modu (13 Temmuz 2026)

Bu sunucuyu **kendi şirketiniz için özel** kurduysanız (çoğu kurulumda durum
budur — genel bir SaaS ürünü olarak birden fazla müşteriye açmıyorsanız),
`.env` dosyasına `TEK_SIRKET_MODU=true` ekleyin.

Bunun etkisi: yeni şirket kaydı (hem normal kayıt hem Google ile kayıt) tümüyle
kapanır — giriş ekranındaki "Şirket Kaydı Oluştur" sekmesi bile görünmez olur.
Artık kimse (siz dahil, kazayla) ikinci bir şirket açamaz; herkesin bu tek
şirkete erişebilmesi için Ayarlar > Kullanıcı & Yetki'den eklenmesi gerekir.

Varsayılan (`TEK_SIRKET_MODU` boş/false) davranış değişmez: birden fazla
şirket aynı sunucuda kendi kendine kayıt olabilir — bu, ürünü SaaS olarak
birden fazla müşteriye sunmak isteyenler için korunmuştur.

## Gerçek Zamanlı Senkron (13 Temmuz 2026)

Ek kurulum **gerektirmez** — otomatik çalışır. Önceden cihazlar birbirini en
geç 45 saniyede bir (periyodik yoklama ile) görürdü; artık bir WebSocket
bağlantısı üzerinden, biri veri kaydettiği an diğer bağlı cihazlara **anında**
("değişiklik var, çek") sinyali gönderiliyor — pratikte 1 saniyenin altında.

Önemli teknik not: WebSocket üzerinden **sadece bir bildirim** gider, gerçek
veri hâlâ her zamanki güvenli `/api/sync/pull` ile çekilir ve sunucudaki
"son yazan kazanır" (timestamp bazlı) çakışma koruması aynen çalışmaya devam
eder — bu korumayı kaldırmadık, sadece herkesin birbirini çok daha hızlı
görmesini sağlayarak iki kişinin aynı kaydı aynı anda değiştirme ihtimalini
pratikte en aza indirdik. Bağlantı kopsa (ağ sorunu, Render ücretsiz planda
sunucunun uykuya geçmesi vb.) periyodik yoklama zaten yedek olarak devam
eder — hiçbir veri kaybı riski yoktur, sadece o an bildirim gecikir.

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

## Frontend: index.html + app.js (12 Temmuz 2026 mimari değişikliği)

**⚠️ Önemli değişiklik:** Frontend artık **iki dosyadan** oluşuyor —
`index.html` ve `app.js`. İkisi de **aynı klasörde** (repo kökünde, `sw.js`
ile birlikte) bulunmalıdır.

**Neden değişti?** Önceden `index.html` tek başına yeterliydi: React kodu
JSX olarak dosyanın içine gömülüydü ve **Babel Standalone** adlı bir
kütüphane, kullanıcının tarayıcısında, sayfa her açıldığında bu kodu
JavaScript'e çeviriyordu. Uygulama büyüdükçe (7.500+ satır) bu çeviri işlemi
her açılışta fark edilir bir gecikmeye ve tarayıcı konsolunda bir uyarıya
(“Babel deoptimised the styling…”) yol açmaya başladı.

Artık JSX kodu **önceden** (bu değişikliği yapan oturumda, esbuild ile) düz
JavaScript'e çevrilip `app.js` olarak kaydediliyor. `index.html` artık sadece
ince bir kabuk: kütüphaneleri (React, Recharts, vb.) yükler ve
`<script src="app.js"></script>` ile derlenmiş kodu çalıştırır. Babel
Standalone kütüphanesi tamamen kaldırıldı (birkaç MB'lık bir CDN indirmesi
daha az).

**Sizin için pratik sonucu:**
- Deploy ederken `index.html`, `app.js`, `sw.js` — üçünü de aynı yere
  koymanız gerekiyor (`server.js` ile karıştırmayın, o ayrı bir klasörde/
  serviste kalmaya devam ediyor).
- `sw.js`'in önbellek listesi de güncellendi (`filopro-v2`); bir kere daha
  sert yenileme (`Ctrl+Shift+R`) yapmanız faydalı olur.
- Bundan sonra kod değişikliği istediğinizde, ben (Claude) hem kaynak JSX
  dosyasını güncelleyip hem de güncel `app.js`'i yeniden derleyip
  ikisini birden teslim edeceğim — sizin ek bir şey yapmanıza gerek yok.

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

FiloPro'nun AI Asistan modülü (sohbet, arıza tahmini, maliyet projeksiyonu,
fiş/fatura fotoğrafı okuma) **Groq**'u kullanır — hızlı, açık modelleri
kredi kartı gerektirmeden, ücretsiz bir kotayla sunan bir sağlayıcı.

**⚠️ 12 Temmuz 2026 güncellemesi:** Daha önce kullanılan `llama-3.3-70b-versatile`
ve `llama-3.1-8b-instant` modelleri Groq tarafından **17 Haziran 2026'da
kullanımdan kaldırıldı (deprecated)**. Sunucu artık varsayılan olarak
`openai/gpt-oss-120b` / `openai/gpt-oss-20b` kullanıyor. Modeller zamanla
değişebildiği için, ileride benzer bir sorun yaşarsanız güncel liste için
[console.groq.com/docs/models](https://console.groq.com/docs/models) adresine
bakın. Daha önce Ayarlar'dan elle bir model seçtiyseniz ve o model artık
kaldırıldıysa, sunucu bunu otomatik olarak fark edip güncel varsayılana
döner (hata vermez).

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

### Fiş/Fatura Fotoğrafından Otomatik Veri Okuma (görü/vision)

Yakıt Yönetimi'nde "📷 Fişi Fotoğrafla / Tara" ile bir yakıt fişinin
fotoğrafını çekip, tutar/tarih/istasyon bilgilerinin otomatik okunmasını
sağlayabilirsiniz. Bu özellik, metin sohbetinden **farklı ve ayrı** bir
model kullanır (`qwen/qwen3.6-27b`) çünkü Groq'taki metin modelleri resim
kabul etmez.

**⚠️ Bu özellik deneyseldir:** `qwen/qwen3.6-27b`, bu yazı itibarıyla
Groq'ta "önizleme" (preview) statüsündedir — üretim ortamı için garanti
verilmez ve okuma bazen eksik/hatalı olabilir. Bu yüzden okunan veri
**hiçbir zaman otomatik kaydedilmez**; her zaman forma önceden doldurulmuş
hâlde gelir ve siz kontrol edip "Kaydet"e basmadan hiçbir şey işlenmez.

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

## Tarayıcı Push Bildirimleri (opsiyonel)

Sekme kapalıyken bile, kritik uyarıların (sigorta/muayene süresi dolan,
vadesi geçen fatura, kritik stok) günlük özetini işletim sisteminin
bildirim merkezinde gösterir. Aynı 00:00 zamanlayıcısını (iç veya
cron-job.org üzerinden dış tetikleyici) kullanır — ayrıca bir kurulum
gerekmez, e-posta yedeğiyle aynı anda tetiklenir.

**Kurulum:**

1. Sunucuyu kurduğunuz makinede/terminalde bir kereye mahsus:
   ```
   npx web-push generate-vapid-keys
   ```
2. Çıkan "Public Key" ve "Private Key" değerlerini `.env` dosyasına
   `VAPID_PUBLIC_KEY` ve `VAPID_PRIVATE_KEY` olarak yazın.
3. Sunucuyu yeniden başlatın/deploy edin.
4. FiloPro içinde Ayarlar → Bildirimler bölümünden "Tarayıcı Bildirimlerini
   Aç" düğmesine basıp tarayıcı izni verin (her cihaz/tarayıcı ayrı ayrı
   açmalıdır — bildirimler o cihaza özeldir).

SMTP gibi, VAPID anahtarları boş bırakılırsa bu özellik sessizce devre dışı
kalır; senkron ve diğer her şey normal çalışmaya devam eder. Ayrıca e-posta
yedeğinden bağımsızdır — sadece push, sadece e-posta, ya da ikisi birden
etkinleştirilebilir.

**⚠️ Önemli — eksik olan `sw.js` dosyası:** Push bildirimlerinin (ve genel
olarak offline desteğin) çalışması için `index.html` ile **aynı klasörde**
bir `sw.js` (service worker) dosyası bulunması gerekir. Bu proje daha önce
bu dosyayı içermiyordu; eklenen `sw.js` dosyasını index.html'inizle aynı
dizine (repo kökü) koyduğunuzdan emin olun.

## Google ile Giriş (opsiyonel)

Kullanıcılar, kullanıcı adı/şifre yerine (veya buna ek olarak) Google
hesaplarıyla giriş yapabilir/kaydolabilir.

**Kurulum:**

1. [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
   adresinde ücretsiz bir "OAuth client ID" (Web application) oluşturun.
2. "Authorized JavaScript origins" alanına FiloPro'yu açtığınız adresi ekleyin.
3. Oluşan İstemci Kimliğini `.env` dosyasına `GOOGLE_CLIENT_ID` olarak yapıştırın
   (İstemci Gizli Anahtarı — Client Secret — gerekmez).
4. Sunucuyu yeniden başlatın/deploy edin.

**Nasıl çalışır:**
- Giriş ekranında "Google ile Giriş Yap" butonu görünür.
- Google e-postanızla eşleşen bir FiloPro hesabı varsa doğrudan giriş yapılır
  (2FA açıksa yine kod istenir).
- Eşleşen hesap yoksa, "Google ile Kaydol" akışına yönlendirilip yeni bir
  şirket oluşturabilirsiniz — bu hesabın şifresi olmaz, yalnızca Google ile
  giriş yapılabilir (Ayarlar → Hesabım'dan istenirse sonradan bir şifre de
  eklenebilir).
- Mevcut (şifreli) bir hesap, Ayarlar → Hesabım'dan Google hesabını
  bağlayıp/kaldırabilir.

`GOOGLE_CLIENT_ID` boş bırakılırsa bu özellik sessizce devre dışı kalır;
kullanıcı adı/şifre ile giriş etkilenmez.

## İki Faktörlü Doğrulama (2FA)

Ek kurulum **gerektirmez** — otplib (TOTP) sunucuya dahildir. Ayarlar →
Güvenlik → "İki Faktörlü Doğrulama (2FA) — Sunucu Hesabı" bölümünden her
kullanıcı kendi hesabı için ayrı ayrı açabilir: Google Authenticator,
Microsoft Authenticator veya Authy gibi bir uygulamayla kurulum anahtarını
manuel girip 6 haneli kodu doğrular. Açıldıktan sonra sunucuya her girişte
şifreye ek olarak bu kod istenir.

Bu, Ayarlar → Güvenlik'teki "Şifreli Giriş Ekranı" (cihaz kilidi) ile
**karıştırılmamalıdır** — o sadece bu cihazdaki uygulamayı kilitler, 2FA ise
sunucudaki gerçek hesap girişini korur.

## Salt Okunur Rolü

Kullanıcı & Yetki modülünde artık bir **"Salt Okunur"** rolü var — muhasebeci,
yatırımcı veya denetçi gibi birine, hiçbir veriyi değiştiremeyeceği ama her
şeyi görebileceği bir erişim vermek için. Bu rol, uygulamanın tüm veri
yazma işlemlerinin geçtiği tek bir merkezi noktada (`LS.set`) engellenir —
yani tek tek her ekran/buton için ayrı bir kısıtlama yazılmasına gerek
kalmadan, **hiçbir modülde** (araç, personel, fatura, iş emri, vb.) ekleme/
düzenleme/silme yapılamaz; sadece görüntüleme, arama ve dışa aktarma (Excel/
PDF) çalışır.

## Mimari Notlar

- **`MONGODB_URI` tanımlıysa:** tüm veri MongoDB'de iki koleksiyonda tutulur —
  `meta` (kullanıcılar) ve `tenants` (şirket başına bir doküman: iş verisi +
  AI/yedek/push ayarları bir arada). Sunucu başlarken tamamını belleğe önceden
  yükler; okumalar bellekten anında yapılır, yazmalar hem belleğe hem arka
  planda MongoDB'ye gider.
- **`MONGODB_URI` tanımlı değilse** (varsayılan), aşağıdaki dosyalar kullanılır:
  - `data/users.json` — tüm kullanıcılar (hangi şirkete ait, rolü, bcrypt ile
    hash'lenmiş şifresi, 2FA sırrı varsa).
  - `data/tenants/<tenantId>.json` — o şirkete ait tüm FiloPro tabloları
    (araçlar, bakımlar, personel, vb.).
  - `data/tenants/<tenantId>.backup.json` — o şirketin yedek e-postası ayarı.
  - `data/tenants/<tenantId>.push.json` — o şirketteki cihazların push abonelikleri.
- Şifreler bcrypt ile hash'lenir, asla düz metin saklanmaz.
- Kullanıcı adları **platform genelinde benzersizdir** (iki farklı şirket aynı
  kullanıcı adını kullanamaz).
- Çakışma çözümü "son yazan kazanır" (last-write-wins) — **kayıt (satır) bazındadır**,
  tablo bazında değil. Aynı şirketteki iki kullanıcı aynı modülün *farklı*
  kayıtlarını aynı anda çevrimdışı düzenleyip senkronize ederse, ikisi de
  korunur (birbirini ezmez); yalnızca aynı kaydı aynı anda düzenlerlerse en
  son senkronize edilen kazanır. Küçük ekipler için pratikte gayet güvenlidir.
- `data/` klasörü düzenli yedeklenmeye değerdir.
