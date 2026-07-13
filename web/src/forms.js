// Tüm programlar TEK ve ortak analiz formunu kullanır (Google Sheet "Analysis Form").
// type: 'input' | 'textarea' | 'checklist'
// checklist seçenekleri Türkçe resmi program terimleridir; seçilenler "EVET" listesi olur.
//
// NOT: "Hangi Alanlar?" (Work Areas) bloğu sayfada "değişmeden otomatik gelmeli"
// olarak işaretlidir; bu yüzden kullanıcı alanı DEĞİLDİR — sunucu tarafında
// (generator.js) sabit blok olarak her projeye eklenir.

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
  'ISO 14064 – Karbon Ayak İzi Doğrulama', 'ISO 14067 – Ürün Karbon Ayak İzi', 'ISO 14046 – Su Ayak İzi',
  'GOTS – Global Organic Textile Standard', 'OCS – Organic Content Standard', 'RCS – Recycled Claim Standard',
  'GRS – Global Recycled Standard', 'SLCP – Social & Labor Convergence Program'
];

const f = (key, type, tr, en, ph = '', extra = {}) => ({ key, type, tr, en, ph, ...extra });

// ---- ORTAK ANALİZ FORMU (Google Sheet "Analysis Form") — 4 programın tamamı ----
const SHARED = [
  { labelTr: 'Firma Künyesi', labelEn: 'Company Profile', fields: [
    f('companyName', 'input', 'Firma Tam Adı', 'Company Full Name'),
    f('owners', 'input', 'Firma Sahibi ve Ortakları', 'Owner & Partners'),
    f('shares', 'input', 'Ortakların Hisse Oranları', 'Partner Share Ratios'),
    f('taxNo', 'input', 'Vergi / MERSİS / Sanayi Sicil No', 'Tax / MERSIS / Industry Reg. No'),
    f('foundingDate', 'input', 'Kuruluş Tarihi', 'Founding Date'),
    f('sectorNace', 'input', 'Sektör / NACE Kodu', 'Sector / NACE Code'),
    f('employees', 'input', 'Çalışan Sayısı', 'Employee Count'),
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
    f('projectScopeItems', 'checklist', 'Projenin Kapsamı (uygulanacak başlıklar)', 'Project Scope (applicable items)', '', { options: SCOPE_ITEMS }),
    f('needReasons', 'checklist', 'Projeye İhtiyaç Gerekçeleri / Problem Tanımı', 'Reasons for the Project / Problem Definition', '', { options: NEED_REASONS }),
    f('documents', 'checklist', 'Mevcut Belgeler', 'Existing Documents', '', { options: DOCUMENTS }),
  ]},
  { labelTr: 'Proje', labelEn: 'Project', fields: [
    f('mentor', 'input', 'Mentor Kuruluş / Kişi', 'Mentor', '', { default: 'Prof. Dr. Ece Ümmü Deveci' }),
    f('expectedResults', 'textarea', 'Program Kapsamında Beklenen Sonuçlar', 'Expected Results'),
    f('workToBeDone', 'textarea', 'Proje Kapsamında Yapılacak Çalışmalar', 'Work to Be Done'),
    f('workPackages', 'textarea', 'İş Paketleri (opsiyonel — boşsa programın varsayılan iş paketi kullanılır)', 'Work Packages (optional — defaults to program template)', 'İş Paketi 1 - Ay 1 - ... -> Çıktı: ...'),
    f('projectName', 'input', 'Projenin Adı', 'Project Name'),
    f('notes', 'textarea', 'Ek Notlar', 'Additional Notes'),
  ]},
];

export const FORMS = {
  'corporate-carbon': SHARED,
  'product-carbon': SHARED,
  'water-efficiency': SHARED,
  'water-carbon': SHARED
};

export function formFor(typeId) {
  return FORMS[typeId] || SHARED;
}
