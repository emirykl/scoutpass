# ScoutPass MVP — Yapılacaklar Listesi

Bu belge, ScoutPass'in Tether Developers Cup için çalışan MVP'sini üretme sırasıdır. Amaç çok sayıda yarım özellik değil, iki yerel uygulama örneği arasında çalışan tek bir uçtan uca akıştır:

> Oyuncu profili → yerel QVAC raporu → seçmeli Pears paylaşımı → deneme daveti → oyuncu kabulü → açık onaylı WDK testnet USD₮ seyahat desteği

## Mimari kararlar

- [x] Projeyi iki üst sınır altında tut: `frontend/` ve `backend/`.
- [x] `frontend/` yalnızca React/TypeScript kullanıcı arayüzünü, ekran durumlarını ve yerel çalışma zamanı ile iletişim katmanını içersin.
- [x] `backend/` merkezi bir web sunucusu olmasın; cihazda çalışan domain, use-case, QVAC, Pears, WDK ve yerel depolama kodunu içersin.
- [x] Oyuncu–scout iletişimi için REST, WebSocket, Socket.io, Firebase veya Supabase kullanma; tüm peer iletişimini Pears üzerinden kur.
- [x] QVAC, Pears ve WDK'yi adapter interface'lerinin arkasında tut; domain katmanı SDK import etmesin.
- [x] UI ile yerel runtime arasındaki sınırda tipli ve Zod ile doğrulanan komut/olay sözleşmeleri kullan.
- [x] Normal uygulama verisi ile cüzdan sırlarını kesin olarak ayır.
- [x] İlk MVP'de Autobase ekleme; yalnızca gerçek multi-writer ihtiyacı kanıtlanırsa değerlendir.
- [ ] Tüm zamanları ISO 8601 UTC olarak sakla, arayüzde kullanıcının yerel saatine dönüştür.
- [ ] Tek uygulamanın `player` ve `scout` rolleriyle iki ayrı yerel instance olarak çalışmasını sağla.

Planlanan dizin sınırları:

```text
scoutpass/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   │   ├── onboarding/
│   │   │   ├── player-profile/
│   │   │   ├── scout-report/
│   │   │   ├── sharing/
│   │   │   ├── connections/
│   │   │   ├── invitations/
│   │   │   └── wallet/
│   │   └── runtime/
│   └── tests/
├── backend/
│   ├── src/
│   │   ├── domain/
│   │   ├── application/
│   │   ├── contracts/
│   │   ├── infrastructure/
│   │   │   ├── qvac/
│   │   │   ├── pears/
│   │   │   ├── wdk/
│   │   │   └── storage/
│   │   ├── protocol/
│   │   └── runtime/
│   └── tests/
├── docs/
├── README.md
├── LICENSE
└── package.json
```

`docs/` ve kök yapı teslimat belgeleri içindir; uygulama kodunun tamamı `frontend/` ve `backend/` altında kalır.

## Faz 0 — Proje temeli ve SDK doğrulaması

- [x] Git deposunu başlat ve anlamlı ilk commit'i oluştur.
- [x] MIT lisansını ekle.
- [x] Root workspace, TypeScript, format, lint ve test komutlarını kur.
- [x] Desteklenen Node/Pear/Bare sürümlerini `.nvmrc` veya eşdeğer sürüm dosyasında sabitle.
- [x] `.gitignore` içine model dosyaları, build çıktıları, loglar, yerel veriler, seed phrase ve wallet secret yollarını ekle.
- [x] `.env.example` oluştur; içine hiçbir gerçek sır koyma.
- [x] Resmî QVAC, Pear ve WDK dokümanlarından kullanılacak sürüm ve platform uyumluluğunu doğrula.
- [x] Kurulan SDK sürümlerini lockfile ile sabitle.
- [x] Kullanmadan önce gerçek export ve metot imzalarını kurulu paketlerden doğrula.
- [x] macOS üzerinde QVAC modelinin minimum donanım/depolama gereksinimini kaydet.
- [x] Seçilen WDK zinciri, test ağı, USD₮ kontratı/asset tanımı ve faucet yöntemini resmî kaynakla doğrula.
- [x] Pear uygulamasının renderer–yerel runtime iletişim yöntemini resmî örnekle doğrula.
- [x] `npm run check` benzeri tek komutta typecheck, lint ve unit test çalıştır.

### Faz 0 çıkış kriteri

- [x] Temiz kurulumdan sonra bağımlılıklar yükleniyor.
- [x] Boş frontend ve yerel runtime birlikte başlıyor.
- [x] SDK adları veya metotları tahmin edilmemiş; kullanılan bütün entegrasyon kararlarının resmî kaynağı var.

## Faz 1 — Domain modelleri, kurallar ve yerel depolama

### Domain modelleri

- [x] `PlayerProfile` modelini oluştur; yaş sınırı 18+ olsun.
- [x] Kişisel futbol bilgileri, iletişim bilgileri ve nitel notları ayrı alt modeller yap.
- [x] Kaleci, defans, orta saha ve forvet için pozisyona özel performans modelleri oluştur.
- [x] Self-reported istatistik uyarısını domain/UI sözleşmesine ekle.
- [x] `ScoutReport` ve `ReportItem` modellerini prompttaki şemayla oluştur.
- [x] `ShareSelection` ve yalnızca seçili alanları taşıyan `SharedPlayerPackage` modellerini oluştur.
- [x] `ScoutingRelationship` ve ilişkiye özel public key/topic metadata modelini oluştur.
- [x] Bütün `ScoutPassEvent` union tiplerini ve ortak `BaseEvent` alanlarını oluştur.
- [x] `TryoutInvitation` modelini ve durum makinesini oluştur.
- [x] `WalletPublicMetadata`, `PaymentProposal` ve `PaymentReference` modellerini oluştur.
- [x] ID üretimini tek bir domain servisi üzerinden yap.
- [x] `schemaVersion` ve `protocolVersion` sabitlerini tanımla.

### Validation ve iş kuralları

- [x] Her kalıcı model için Zod şeması yaz.
- [x] UI → runtime komutları ve runtime → UI olayları için Zod şemaları yaz.
- [x] Yaş, yüzde, maç, dakika, kart ve pozisyona özel istatistik sınırlarını doğrula.
- [x] Para tutarını floating-point yerine güvenli decimal/minor-unit yaklaşımıyla doğrula.
- [x] Davet tarihi, bitiş saati ve son kullanım tarihinin tutarlılığını doğrula.
- [x] Davet durum geçişlerini yalnızca izin verilen geçişlerle sınırla.
- [x] Event ID ile tekrar işleme/deduplication kuralını oluştur.
- [x] Süresi geçmiş ve replay edilmiş olayları reddetme kuralını oluştur.

### Yerel storage

- [x] Repository interface'lerini domain/application tarafında tanımla.
- [x] Profil, rapor, paylaşım tercihleri, ilişkiler, alınan profiller, davetler ve ödeme referansları için repository oluştur.
- [x] Yapılandırılmış JSON veya SQLite kararını Pear/Bare uyumluluğunu test ederek ver.
- [x] Atomic write, bozuk veri ve migration stratejisi ekle.
- [x] Her rol/instance için ayrı veri dizini desteği ekle.
- [x] Seed phrase ve private key'lerin normal repository'lere yazılmasını teknik olarak engelle.
- [x] Hassas alanları maskeleyen merkezi logger oluştur.
- [x] Demo oyuncu verisini açıkça `demo` olarak işaretleyerek ekle.

### Faz 1 testleri ve çıkış kriteri

- [x] Pozisyona özel performans hesaplama testleri geçiyor.
- [x] Bütün schema validation testleri geçiyor.
- [x] Share-package sanitization testleri seçilmeyen hiçbir alanın sızmadığını kanıtlıyor.
- [x] Davet durum makinesi ve payment amount testleri geçiyor.
- [x] Uygulama kapatılıp açıldığında yerel kayıtlar geri yükleniyor.

## Faz 2 — Profil oluşturma ve QVAC yerel rapor üretimi

### Frontend profil akışı

- [ ] Welcome ekranında Player/Scout rol seçimini, gizlilik özetini ve testnet uyarısını göster.
- [ ] Oyuncu profil formunu React Hook Form + Zod ile oluştur.
- [ ] Seçilen pozisyona göre performans alanlarını dinamik göster.
- [ ] Taslak kaydetme ve profil tamamlama göstergesi ekle.
- [ ] Demo profili yükleme aksiyonu ekle ve demo olduğunu görünür tut.
- [ ] Rapor üretiminden önce QVAC'a gidecek yerel veri önizlemesini göster.

### QVAC adapter

- [ ] `LocalReportGenerator` interface'ini oluştur.
- [ ] QVAC adapter'ını resmî SDK ile uygula.
- [ ] Model bulunamadı, yükleniyor, hazır, hata ve unload durumlarını modelle.
- [ ] Prompt builder'ı saf fonksiyon olarak oluştur; oyuncu istatistiklerini pozisyona göre bağlamlandır.
- [ ] Prompt içinde JSON-only çıktı, etik sınırlar ve zorunlu disclaimer talimatını kullan.
- [ ] Model çıktısından olası markdown code fence'i güvenli biçimde ayıkla.
- [ ] JSON parse et ve `ScoutReport` Zod şemasıyla doğrula.
- [ ] Geçersiz çıktı için yalnızca bir yerel retry uygula.
- [ ] İkinci hata sonrası rapor uydurmadan açık hata göster.
- [ ] `generatedAt` ve gerçek `modelInfo` metadata'sını kaydet.
- [ ] Uygulama kapanırken model kaynaklarını serbest bırak.
- [ ] İnternet bağlantısı kapalıyken rapor üretimini doğrula.

### Rapor ekranı

- [ ] Özet, pozisyon profili, güçlü yanlar, gelişim alanları, oyun tarzı, sistemler ve scout sorularını göster.
- [ ] Kanıt ve confidence seviyelerini erişilebilir biçimde göster.
- [ ] Zorunlu “oyuncu tarafından sağlanan/doğrulanmamış veri” disclaimer'ını sabit göster.
- [ ] Raporu düzenleme ile yeniden üretme eylemlerini birbirinden ayır.
- [ ] Yükleme, model yok, model hatası ve geçersiz çıktı durumlarını tasarla.

### Faz 2 testleri ve çıkış kriteri

- [ ] QVAC response parsing integration testleri geçiyor.
- [ ] Geçerli, code-fenced, malformed ve schema-invalid çıktı fixture'ları test ediliyor.
- [ ] Gerçek QVAC modeli offline çalışarak geçerli bir rapor üretiyor.
- [ ] Hiçbir cloud AI paketi, endpoint'i veya API anahtarı yok.

## Faz 3 — Pears bağlantısı ve doğrulanmış test olayı

- [ ] `PeerTransport` interface'ini tanımla.
- [ ] Güncel `pear-runtime` yaklaşımıyla yerel networking runtime'ını kur.
- [ ] Hyperswarm ile ilişkiye özel topic/invite üretimini uygula.
- [ ] Invite bilgisinde yalnızca bağlantı kurmak için gerekli public metadata'yı taşı.
- [ ] Scout “Create scouting connection” ile tek ilişkiye özel invite oluşturabilsin.
- [ ] Oyuncu invite kodunu yapıştırabilsin; QR yalnızca zaman kalırsa eklensin.
- [ ] Bağlanıyor, bağlı, timeout, bulunamadı ve yeniden bağlanıyor durumlarını göster.
- [ ] İki instance arasında küçük, doğrulanmış bir test olayı gönder.
- [ ] Gelen byte sayısına katı payload limiti uygula.
- [ ] Mesajı işlemeden önce JSON/encoding, Zod schema, event type ve protocol version doğrula.
- [ ] Bilinmeyen event tipini, bozuk payload'ı ve oversized mesajı reddet.
- [ ] Event ID deduplication ve yerel append-only iletişim geçmişi ekle.
- [ ] Private key/topic secret değerlerini loglama.
- [ ] Bağlantı kesilip yeniden kurulduğunda durumun toparlanmasını sağla.

### Faz 3 çıkış kriteri

- [ ] Aynı makinede Player ve Scout instance'ları invite ile bağlanıyor.
- [ ] Doğrulanmış test olayı iki yönde gidiyor.
- [ ] Malformed, unknown, duplicate ve oversized olay testleri geçiyor.
- [ ] Player–Scout iletişiminde merkezi backend kullanılmıyor.

## Faz 4 — Gerçek seçmeli profil paylaşımı

- [ ] Paylaşım seçeneklerini varsayılan olarak yalnızca temel futbol profili, oyuncu özeti ve güçlü yanlar açık gelecek şekilde kur.
- [ ] İletişim, istatistik, gelişim alanları, oyun tarzı, coach notes ve scout questions seçeneklerini varsayılan kapalı tut.
- [ ] Seçimlerden yeni bir sanitized `SharedPlayerPackage` üret.
- [ ] Gönderilecek paketin birebir JSON/insan okunur önizlemesini göster.
- [ ] Paket boyutunu göndermeden önce hesapla ve limiti aşarsa engelle.
- [ ] Oyuncudan açık paylaşım onayı al.
- [ ] Gerçek paketi Pears üzerinden scout'a gönder.
- [ ] Scout alınan paketi schema ile doğrulayıp yerel olarak saklasın.
- [ ] Scout yalnızca paylaşılan alanları görebilsin.
- [ ] `PlayerProfileShared` ve `ProfileReceived` olaylarını ilişki geçmişine ekle.
- [ ] Aynı paketin tekrar gönderilmesini idempotent işle.

### Faz 4 çıkış kriteri

- [ ] Seçilmeyen hassas alanlar serialized payload içinde bulunmuyor.
- [ ] Player önizlemesi ile scout'un aldığı payload birebir uyuşuyor.
- [ ] İki instance arasında gerçek profil transfer integration testi geçiyor.

## Faz 5 — P2P deneme daveti

- [ ] Scout için paylaşılan oyuncu inceleme ekranını oluştur.
- [ ] Scout'un yerel ve paylaşılmayan özel değerlendirme notlarını ekle.
- [ ] Deneme daveti formundaki bütün zorunlu alanları uygula.
- [ ] Opsiyonel seyahat desteği tutarı ve asset bilgisini davete ekle.
- [ ] Taslak daveti göndermeden önce tam önizleme göster.
- [ ] `TryoutInvitationEvent` olayını Pears üzerinden gönder.
- [ ] Player daveti Received durumunda görsün.
- [ ] Accept, Decline ve Request clarification yanıtlarını uygula.
- [ ] Yanıtı `InvitationResponseEvent` olarak scout'a gönder.
- [ ] Draft, Sent, Received, Accepted, Declined, Expired ve Travel support sent durumlarını state machine ile yönet.
- [ ] Süresi geçmiş davetin kabul edilmesini engelle.
- [ ] Davet ve yanıt geçmişini iki tarafta yerel olarak sakla.

### Faz 5 çıkış kriteri

- [ ] Scout daveti gönderiyor, Player alıyor ve kabul yanıtı Scout'a ulaşıyor.
- [ ] Davet delivery integration testi ve bütün durum geçişi testleri geçiyor.
- [ ] Seyahat desteği yalnızca Accepted davet için başlatılabiliyor.

## Faz 6 — WDK self-custodial testnet cüzdanı

- [ ] `WalletGateway` interface'ini tanımla.
- [ ] Seçilen zincirin resmî WDK modülünü kur ve sürümünü sabitle.
- [ ] Player ve Scout için ayrı self-custodial wallet initialize/create akışı oluştur.
- [ ] Seed phrase/private key için platformun güvenli depolama seçeneğini uygula.
- [ ] Seed phrase'i log, analytics, error message, normal state veya repository'ye sokma.
- [ ] Gerekliyse seed phrase yedekleme ekranını yalnızca açık kullanıcı eylemiyle göster; ekran görüntüsü/log riskini belirt.
- [ ] Public receive address'i ve test balance'ı göster.
- [ ] Player'ın public receive address'ini ilişki içinde paylaşmasını açık onaya bağla.
- [ ] Network ve “Testnet only” etiketini bütün wallet/payment ekranlarında göster.
- [ ] Wallet initialization failure ve balance query failure durumlarını göster.
- [ ] Test faucet ile iki demo cüzdanını fonlama adımlarını belgeleyip doğrula.

### Faz 6 çıkış kriteri

- [ ] İki instance farklı wallet address üretiyor/yüklüyor.
- [ ] Yeniden başlatmada güvenli wallet erişimi çalışıyor.
- [ ] Test balance gerçek ağdan okunuyor.
- [ ] Hiçbir secret source control, log veya normal app DB içinde değil.

## Faz 7 — İncelenen ve açıkça onaylanan test USD₮ ödemesi

- [ ] Ödemeyi yalnızca kabul edilmiş davete bağla.
- [ ] Scout payment review ekranında invitation, network, asset, destination, amount ve fee bilgilerini göster.
- [ ] Player address'ini P2P ilişkisi ve davetle ilişkilendirerek doğrula.
- [ ] Aynı davet için duplicate payment attempt kontrolü ekle.
- [ ] `TravelSupportProposedEvent` olayını oluştur ve sakla.
- [ ] Kullanıcı açıkça Confirm and sign demeden transaction hazırlama/imzalama/gönderme.
- [ ] WDK ile test USD₮ transaction'ını hazırla, imzala ve yayınla.
- [ ] Pending, confirmed, rejected ve failed durumlarını gerçek sonuçtan göster.
- [ ] Transaction identifier/hash bilgisini iki tarafta göster.
- [ ] `TravelSupportSentEvent` olayını Pears üzerinden Player'a gönder.
- [ ] Player gelen ödemeyi davetle ilişkilendirilmiş olarak görsün.
- [ ] Insufficient balance, user rejection, RPC/indexer error ve timeout durumlarını göster.
- [ ] Ödemeyi escrow, doğrulama, ücret veya işe alım garantisi olarak sunma.

### Faz 7 çıkış kriteri

- [ ] Scout gerçek WDK testnet transaction'ını açık onayla gönderiyor.
- [ ] Player transaction durumunu ve identifier'ı görüyor.
- [ ] Transaction preparation integration testi ve duplicate prevention testi geçiyor.
- [ ] Fake success/demo transaction fallback bulunmuyor.

## Faz 8 — Ekranları tek ürün akışında birleştirme

- [ ] Player dashboard: profil tamamlanması, son rapor, bağlantı, davet ve ödeme özeti.
- [ ] Scout dashboard: bağlantılar, alınan profiller, davetler ve destek geçmişi.
- [ ] Bağlantı durumunu ilgili bütün ekranlarda görünür tut.
- [ ] Activity timeline'ı domain olaylarından üret.
- [ ] Settings: QVAC model durumu, Pears durumu, wallet network, yerel veri temizleme ve sanitize debug export.
- [ ] Yerel veriyi temizleme öncesinde kapsamı gösterip açık onay al.
- [ ] Klavye erişilebilirliği, focus state, form label ve temel kontrast kontrollerini tamamla.
- [ ] Wallet jargonunu azalt; futbol operasyonları odaklı metinler kullan.
- [ ] Dark navy/neutral, profesyonel scouting görsel sistemini uygula.
- [ ] Dar masaüstü penceresinde temel responsive davranışı doğrula.

## Faz 9 — Güvenlik, hata yönetimi ve kalite kapısı

- [ ] `docs/threat-model.md` oluştur.
- [ ] Malicious P2P payload, oversized message, fake scout identity, self-reported data, oversharing, secret exposure, replay, duplicate payment ve corrupted storage tehditlerini işle.
- [ ] Scout/club kimliğinin MVP'de doğrulanmadığını görünür biçimde belirt.
- [ ] Merkezi error mapping ile kullanıcıya teknik sır sızdırmayan açıklamalar göster.
- [ ] QVAC model yok/yükleme/invalid output hatalarını manuel test et.
- [ ] Pear not found/timeout/malformed/reconnect durumlarını manuel test et.
- [ ] WDK init/insufficient balance/reject/pending/failure durumlarını manuel test et.
- [ ] Uygulamada cloud AI, telemetry veya izinsiz dış endpoint olmadığını dependency ve source audit ile doğrula.
- [ ] Dependency vulnerability ve license kontrolü yap; bulunan riskleri belgeleyip çöz.
- [ ] Secret scan çalıştır.
- [ ] Production build içinde demo secret, seed veya debug log bulunmadığını doğrula.
- [ ] İki temiz instance ile baştan sona smoke test çalıştır.

## Faz 10 — Yarışma teslimatı

- [ ] `README.md`: problem, çözüm, üç stack'in gerçek kullanımı ve ekran görüntüleri.
- [ ] Yalnızca gerçekten çalıştırılmış kurulum komutlarını README'ye yaz.
- [ ] QVAC model kurulumu ve offline doğrulama adımlarını yaz.
- [ ] Pear CLI ile iki instance başlatma adımlarını yaz.
- [ ] WDK testnet/faucet kurulumunu ve gerçek para kullanılmaması uyarısını yaz.
- [ ] Kullanılan bütün dış servis, API, model ve pre-built bileşenleri listele.
- [ ] `docs/architecture.md` içinde container/component ve veri akışı diyagramlarını ekle.
- [ ] `docs/privacy.md` içinde hangi verinin nerede kaldığını ve neyin paylaşıldığını açıkla.
- [ ] `docs/demo-script.md` içinde üç dakikalık zamanlanmış demo senaryosu oluştur.
- [ ] `docs/manual-test-checklist.md` oluştur ve iki temiz makine/instance üzerinde işaretle.
- [ ] Mevcut MVP sınırlamalarını ve gelecek yol haritasını dürüstçe yaz.
- [ ] Public GitHub repo, lisans, görünür commit geçmişi ve DoraHacks bağlantılarını doğrula.
- [ ] En fazla üç dakikalık unlisted YouTube demo videosunu kaydet.
- [ ] Videoda QVAC offline üretim, Pears P2P transfer ve WDK testnet transaction kanıtını göster.
- [ ] Canlı sunum için yedek testnet fonu, önceden indirilmiş model ve temiz demo verisi hazırla.

## MVP kesin kabul testi

Aşağıdaki test tek oturumda, fake entegrasyon veya cloud AI olmadan tamamlanmadan MVP bitmiş sayılmaz:

- [ ] Player instance açılır ve 18+ oyuncu profili oluşturulur/yüklenir.
- [ ] QVAC cihazda geçerli ve şemadan geçen rapor üretir.
- [ ] Player yalnızca seçtiği rapor bölümlerini önizler.
- [ ] Scout instance ilişkiye özel Pears invite üretir.
- [ ] Player invite ile bağlanır ve açıkça paylaşımı onaylar.
- [ ] Scout gerçek seçili paketi alır ve yerel olarak görüntüler.
- [ ] Scout P2P deneme daveti gönderir.
- [ ] Player daveti kabul eder; Scout kabul olayını alır.
- [ ] Scout kabul edilen davet için WDK ödeme özetini inceler.
- [ ] Scout açıkça imzalar ve gerçek test USD₮ transaction'ı gönderir.
- [ ] Player transaction identifier ve durumunu görür.
- [ ] Uygulama kapanıp açıldığında güvenli yerel geçmiş geri gelir.
- [ ] Repo ve çalışan uygulamada cloud AI bağımlılığı yoktur.

## Kapsam dışı — MVP tamamlanana kadar yapılmayacaklar

- [ ] Video analizi veya otomatik highlight üretimi yapma.
- [ ] Public oyuncu pazaryeri, sosyal akış veya genel chat yapma.
- [ ] Kulüp/scout kimlik doğrulaması varmış gibi davranma.
- [ ] Gerçek para veya mainnet ödeme kullanma.
- [ ] Escrow, tryout fee, betting, token veya recruitment guarantee ekleme.
- [ ] Takvim entegrasyonu, bildirim servisi veya public profil linki ekleme.
- [ ] Tüm kabul testi çalışmadan görsel mikro animasyonlara öncelik verme.

## Çalışma kuralı

Her faz şu sırayla tamamlanır: domain/use-case → adapter → UI → otomatik test → iki-instance manuel kanıt. Bir fazın çıkış kriterleri geçmeden sonraki büyük entegrasyona başlanmaz. Entegrasyon sorunlarında fake/mock başarı üretmek yerine gerçek hata görünür tutulur.
