// Tüm 4 program TEK ve ortak analiz formunu kullanır — Google Sheet "analysis form"
// sekmesiyle BİREBİR. type: 'input' | 'textarea'
//
// NOT: "Hangi Alanlar?" (Which Work Areas?) bloğu sayfada "değişmeden otomatik
// gelmeli; tüm projelerde aynı" olarak işaretlidir; bu yüzden kullanıcı alanı
// DEĞİLDİR — sunucu tarafında (generator.js → FIXED_WORK_AREAS) sabit blok olarak
// her projeye eklenir.

const f = (key, type, tr, en, ph = '', extra = {}) => ({ key, type, tr, en, ph, ...extra });

// ---- ORTAK ANALİZ FORMU (Sheet "analysis form") — 4 programın tamamı ----
const SHARED = [
  { labelTr: 'Firma Künyesi', labelEn: 'Company Profile', fields: [
    f('companyName', 'input', 'Firma Adı', 'Company Name'),
    f('sectorNace', 'input', 'NACE Kodu', 'NACE Code'),
    f('area', 'input', 'Şehir / Lokasyon', 'City / Location'),
    f('foundingDate', 'input', 'Kuruluş Tarihi', 'Founding Date'),
    f('locations', 'textarea', 'Adresler, Birimler ve Alan (m²)', 'Addresses, Units & Area (m²)'),
  ]},
  { labelTr: 'Faaliyet ve Deneyim', labelEn: 'Activities & Experience', fields: [
    f('products', 'textarea', 'Ürünler ve Markalar', 'Products & Brands'),
    f('foundingStory', 'textarea', 'Kuruluş Hikâyesi', 'Founding Story'),
    f('currentActivities', 'textarea', 'Mevcut Faaliyetler', 'Current Activities'),
    f('foreignTrade', 'textarea', 'Dış Ticaret Durumu ve İhracat Ülkeleri', 'Foreign Trade Status and Export Countries'),
    f('customers', 'textarea', 'Müşteriler', 'Customers'),
    f('competitiveFactors', 'textarea', 'Firmayı Önemli Kılan Faktörler', 'Competitive Factors'),
    f('pastProjects', 'textarea', 'Geçmiş Proje Tecrübeleri', 'Past Project Experience'),
    f('documents', 'textarea', 'Mevcut Belgeler', 'Existing Documents'),
  ]},
  { labelTr: 'Proje', labelEn: 'Project', fields: [
    f('projectName', 'input', 'Projenin Adı', 'Project Name'),
    f('mentor', 'input', 'Mentor', 'Mentor', '', { default: 'Prof. Dr. Ece Ümmü Deveci' }),
    f('projectScope', 'textarea', 'Projenin Kapsamı', 'Project Scope'),
    f('needReasons', 'textarea', 'Projenin Gerekçeleri', 'Reasons for the Project'),
    f('expectedResults', 'textarea', 'Beklenen Sonuçlar', 'Expected Results'),
    f('workToBeDone', 'textarea', 'Yapılacak Çalışmalar', 'Work to Be Done'),
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
