// Proje türüne göre analiz formu alanları.
// type: 'input' | 'textarea' | 'checklist'
// checklist seçenekleri Türkçe resmi program terimleridir; seçilenler "EVET" listesi olur.

const WORK_AREAS = [
  'KOBİ’lerin yeşil dönüşüme konusunda mevcut durumlarının belirlenmesi',
  'Boşluk analizi yapılarak iyileşme sağlanması planlanan başlıkların belirlenmesi',
  'Bu gereksinimlerin sağlanması için uygun çözümlerin geliştirilmesi',
  'Bu çözümlerin hayata geçirilmesine yönelik yol haritalarının oluşturulması',
  'Bu yol haritalarının uygulanmasında KOBİ’lere rehberlik yapılması'
];

const SCOPE_ITEMS = [
  'Mevcut Durum Analizi',
  'Veri Toplama ve Değerlendirme',
  'Boşluk Analizi ve İyileştirme Alanlarının Belirlenmesi',
  'Çözüm Önerileri ve Stratejik Planlama',
  'Karbon Ayak İzi Yönetimi',
  'Su Ayak İzi ve Yönetimi',
  'Enerji Verimliliği ve Yenilenebilir Enerji Kullanımı',
  'Atık Yönetimi ve Döngüsel Ekonomi Uygulamaları',
  'Ürün Yaşam Döngüsü Analizi (LCA)',
  'Yeşil Tedarik Zinciri Yönetimi',
  'Yeşil Lojistik ve Taşımacılık Optimizasyonu',
  'Dijital Karbon İzleme ve Raporlama Sistemleri',
  'Sınırda Karbon Vergisi ve Uluslararası Mevzuatlara Uyum (SKDM)',
  'Sürdürülebilir Ürün Sertifikasyonu ve Eko-Etiketleme',
  'Yeşil Finans ve ESG Raporlaması',
  'Çalışan Eğitimi ve Farkındalık Programları',
  'Sürdürülebilirlik Kültürü ve İç Yönetim Politikalarının Geliştirilmesi',
  'Sürekli İyileştirme ve Performans Takibi',
  'Yeşil İnovasyon ve Teknoloji Kullanımı'
];

const NEED_REASONS = [
  'Doğal Kaynakları Korumak', 'Çevre Bilincini Artırmak', 'Sürdürülebilir İş Modeli Oluşturmak',
  'Enerji Verimliliğini Artırma', 'İnovatif Ürün ve Hizmet Geliştirme', 'Toplumsal Katkı Sağlama',
  'Uluslararası Standartlara Uyum', 'Karbon Emisyonlarının Hesaplanması', 'Uzun Vadeli Stratejik Planlama',
  'Çevresel Etkiyi Azaltma', 'Kurumsal İmaj ve Marka Değeri', 'Regülasyonlara Uyum', 'Maliyet Avantajı',
  'Yenilik ve Rekabet Gücü', 'Paydaş Beklentileri', 'Kurumsal Sosyal Sorumluluk', 'Pazar Fırsatları', 'Risk Yönetimi'
];

const DOCUMENTS = [
  'Çevre Ruhsatı ve İzni', 'Atık Yönetim Planı', 'Atık Beyan Formu', 'Atık Su Deşarj İzinleri ve Kanal Bağlantı İzni',
  'Atık Su Analiz Sonuçları', 'Hava Emisyon Raporu', 'Gürültü Ölçüm Sonuçları', 'Koku Emisyon Ölçüm Sonuçları',
  'Acil Müdahale Planı', 'ISO 14001 – Çevre Yönetim Sistemi', 'ISO 50001 – Enerji Yönetim Sistemi',
  'ISO 14064 – Karbon Ayak İzi Doğrulama', 'ISO 14067 – Ürün Karbon Ayak İzi', 'ISO 14046 – Su Ayak İzi'
];

const f = (key, type, tr, en, ph = '', extra = {}) => ({ key, type, tr, en, ph, ...extra });

// ---- TÜBİTAK 1831 (Genel) — standart 30 alanlı form ----
const TUBITAK_1831 = [
  { labelTr: 'Firma Künyesi', labelEn: 'Company Profile', fields: [
    f('companyName', 'input', 'Firma Tam Adı', 'Company Full Name'),
    f('owners', 'input', 'Firma Sahibi ve Ortakları', 'Owner & Partners'),
    f('shares', 'input', 'Ortakların Hisse Oranları', 'Partner Share Ratios'),
    f('taxNo', 'input', 'Vergi No', 'Tax No'),
    f('foundingDate', 'input', 'Kuruluş Tarihi', 'Founding Date'),
    f('sectorNace', 'input', 'Sektör / NACE Kodu', 'Sector / NACE Code'),
    f('address', 'textarea', 'Adres', 'Address'),
    f('locations', 'textarea', 'Faaliyet Lokasyonları, Birimleri ve Alan (m²)', 'Locations, Units & Area (m²)'),
  ]},
  { labelTr: 'İletişim', labelEn: 'Contact', fields: [
    f('phone', 'input', 'Telefon', 'Phone'),
    f('web', 'input', 'Web Adresi', 'Website'),
    f('email', 'input', 'E-posta', 'E-mail'),
  ]},
  { labelTr: 'Faaliyet ve Deneyim', labelEn: 'Activities & Experience', fields: [
    f('products', 'textarea', 'Ürünler ve Markalar', 'Products & Brands'),
    f('suppliers', 'textarea', 'Tedarikçiler', 'Suppliers'),
    f('foundingStory', 'textarea', 'İşletmenin Kuruluş Hikâyesi', 'Founding Story'),
    f('currentActivities', 'textarea', 'Mevcut Faaliyetleri', 'Current Activities'),
    f('foreignTrade', 'input', 'Dış Ticaret Yapma Durumu', 'Foreign Trade Status'),
    f('foreignCountries', 'input', 'Dış Ticaret Yapılan Ülkeler', 'Export Countries'),
    f('customerCount', 'input', 'Yıllık Ortalama Müşteri Sayısı', 'Avg. Annual Customers'),
    f('competitiveFactors', 'textarea', 'Firmayı Önemli Kılan Faktörler', 'Competitive Factors'),
    f('pastProjects', 'textarea', 'Geçmiş Proje Tecrübeleri', 'Past Project Experience'),
    f('rdCapability', 'textarea', 'Ar-Ge Yetkinliği ve Proje Geçmişi', 'R&D Capability & History'),
    f('ecoProduction', 'textarea', 'Çevre Dostu Üretim Süreci / Çalışmaları', 'Eco-friendly Production'),
    f('personnel', 'textarea', 'Personel Sayıları (Ar-Ge/Üretim/Diğer; cinsiyet ve eğitim)', 'Personnel (R&D/Production/Other; gender & education)'),
  ]},
  { labelTr: 'Proje Seçimleri', labelEn: 'Project Selections', fields: [
    f('workAreas', 'checklist', 'Hangi Alanlarda Proje Yürütülecek?', 'Which Work Areas?', '', { options: WORK_AREAS }),
    f('projectScopeItems', 'checklist', 'Projenin Kapsamı (uygulanacak başlıklar)', 'Project Scope (applicable items)', '', { options: SCOPE_ITEMS }),
    f('needReasons', 'checklist', 'Projeye İhtiyaç Gerekçeleri / Problem Tanımı', 'Reasons for the Project / Problem Definition', '', { options: NEED_REASONS }),
    f('documents', 'checklist', 'Mevcut Belgeler', 'Existing Documents', '', { options: DOCUMENTS }),
  ]},
  { labelTr: 'Proje', labelEn: 'Project', fields: [
    f('mentor', 'input', 'Mentor Kuruluş / Kişi', 'Mentor', '', { default: 'Prof. Dr. Ece Ümmü Deveci' }),
    f('expectedResults', 'textarea', 'Program Kapsamında Beklenen Sonuçlar', 'Expected Results'),
    f('workToBeDone', 'textarea', 'Proje Kapsamında Yapılacak Çalışmalar', 'Work to Be Done'),
    f('workPackages', 'textarea', 'İş Paketleri (Tablo)', 'Work Packages (Table)', 'İş Paketi 1 - Ay 1 - ... -> Çıktı: ...'),
    f('projectName', 'input', 'Projenin Adı', 'Project Name'),
    f('notes', 'textarea', 'Ek Notlar', 'Additional Notes'),
  ]},
];

// ---- Su Verimliliği / Mavi Sertifika ----
const WATER = [
  { labelTr: 'Firma Künyesi', labelEn: 'Company Profile', fields: [
    f('companyName', 'input', 'İşletmenin Adı', 'Company Name'),
    f('foundingDate', 'input', 'Kuruluş Tarihi', 'Founding Date'),
    f('sectorNace', 'input', 'Sektör / NACE Kodu', 'Sector / NACE Code'),
    f('taxNo', 'input', 'Vergi / MERSİS / Sanayi Sicil No', 'Tax / MERSIS / Industry Reg. No'),
    f('address', 'textarea', 'Adres ve Lokasyon (OSB/Endüstri Bölgesi vb.)', 'Address & Location'),
    f('employees', 'input', 'Çalışan Sayısı', 'Employee Count'),
    f('products', 'textarea', 'Üretilen Ürünler ve NACE Üretim Miktarları', 'Products & Production Volumes'),
  ]},
  { labelTr: 'Su ve Atıksu Verileri', labelEn: 'Water & Wastewater Data', fields: [
    f('waterSources', 'textarea', 'Su Kaynakları ve Kullanım Durumu (YAS, YÜS, şebeke, yağmur, gri su…)', 'Water Sources'),
    f('waterWithdrawal', 'textarea', 'Yıllık Su Çekim ve Tüketim Miktarları (m³/yıl; endüstriyel/evsel/diğer)', 'Annual Withdrawal & Consumption'),
    f('wastewater', 'textarea', 'Atıksu Miktarları, Karakterizasyonu, Arıtma ve Geri Kazanım', 'Wastewater, Treatment & Recovery'),
    f('rainGreyWater', 'textarea', 'Yağmur Suyu Hasadı / Gri Su / Geleneksel Olmayan Kaynaklar', 'Rainwater / Greywater / Non-conventional'),
    f('landscape', 'textarea', 'Peyzaj/Yeşil Alan ve Sulama Bilgileri (m², kaynak, yöntem)', 'Landscape & Irrigation'),
  ]},
  { labelTr: 'Mevcut Durum ve Belgeler', labelEn: 'Current State & Certificates', fields: [
    f('waterRegulationStatus', 'input', 'Su Verimliliği Yönetmeliği Kapsamı (Zorunlu/Gönüllü)', 'Water Regulation Scope'),
    f('certificates', 'textarea', 'Belgeler (ISO 14001 / 46001 / 14046, geçerlilik tarihleri)', 'Certificates'),
    f('waterTechniques', 'textarea', 'Uygulanan Su Verimliliği Teknikleri ve Endüstriyel Simbiyoz', 'Applied Water-Efficiency Techniques'),
    f('waterTraining', 'textarea', 'Su Verimliliği Eğitim ve Farkındalık Çalışmaları', 'Training & Awareness'),
    f('projection', 'textarea', '5 Yıllık Büyüme ve Su İhtiyacı Projeksiyonları', '5-Year Growth & Water Projection'),
  ]},
  { labelTr: 'Ekip, Hedefler ve İş Paketleri', labelEn: 'Team, Targets & Work Packages', fields: [
    f('waterTeam', 'textarea', 'Su Verimliliği Ekibi (lider, eğitim sorumlusu, yardımcı personel)', 'Water-Efficiency Team'),
    f('waterTargets', 'textarea', 'Su Verimliliği Hedefleri (performans + süreç; 5 yıllık)', 'Water-Efficiency Targets'),
    f('workToBeDone', 'textarea', 'Proje Kapsamında Yapılacak Çalışmalar', 'Work to Be Done'),
    f('workPackages', 'textarea', 'İş Paketleri (Tablo)', 'Work Packages (Table)', 'İş Paketi 1 - Ay 1 - ... -> Çıktı: ...'),
    f('notes', 'textarea', 'Ek Notlar', 'Additional Notes'),
  ]},
];

// ---- Su Verimliliği + Kurumsal Karbon (birleşik) = su formu + karbon faaliyet verileri ----
const WATER_CARBON = [
  ...WATER.slice(0, 3),
  { labelTr: 'Kurumsal Karbon Bileşeni', labelEn: 'Corporate Carbon Component', fields: [
    f('carbonActivityData', 'textarea', '2025 Faaliyet Verileri (elektrik, yakıt, hammadde, atık, lojistik, hizmet alımı)', '2025 Activity Data'),
    f('carbonScopes', 'textarea', 'Kapsam 1/2/3 Emisyon Kaynakları ve Mevcut Veri Durumu', 'Scope 1/2/3 Sources & Data Status'),
  ]},
  ...WATER.slice(3),
];

export const FORMS = {
  'tubitak-1831': TUBITAK_1831,
  'water-blue': WATER,
  'water-carbon': WATER_CARBON
};

export function formFor(typeId) {
  return FORMS[typeId] || TUBITAK_1831;
}
