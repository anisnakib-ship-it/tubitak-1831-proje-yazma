/**
 * TÜBİTAK 1831 proje türleri (programlar) — Google Sheet "PROMPTS-WORK
 * PACKAGES-CONTENT LENGTS" ile birebir 4 program.
 *
 * Her program Obsidian vault'unda kendi klasörüne sahiptir:
 *   knowledge/<folder>/00-index.md + section-01..13.md + scope.md + work-package.md
 * Ortak notlar: knowledge/_global/
 *
 * Tüm programlar AYNI 13 soruluk iskeleti ve AYNI analiz formunu paylaşır;
 * bölüm uzunlukları yalnızca sayfanın "CONTENT LENGTS" sekmesinden gelir
 * (section notlarının frontmatter'ındaki maxChars/targetWords).
 *
 * questionCount: her programda 13 soru. months/workPackages: programa özgü.
 */
export const TEMPLATES = [
  {
    id: 'corporate-carbon',
    folder: 'corporate-carbon',
    labelTr: 'Kurumsal Karbon Ayak İzi',
    labelEn: 'Corporate Carbon Footprint',
    descTr: 'ISO 14064-1 kapsamında kurumsal karbon ayak izi hesaplama ve yeşil dönüşüm yol haritası',
    descEn: 'Corporate carbon footprint (ISO 14064-1) calculation and green transformation roadmap',
    months: 6,
    workPackages: 4,
    questionCount: 13
  },
  {
    id: 'product-carbon',
    folder: 'product-carbon',
    labelTr: 'Ürün Karbon Ayak İzi',
    labelEn: 'Product Carbon Footprint',
    descTr: 'ISO 14067 kapsamında ürün karbon ayak izi (yaşam döngüsü) hesaplama ve ürün bazlı yol haritası',
    descEn: 'Product carbon footprint (ISO 14067 / life cycle) calculation and product-based roadmap',
    months: 6,
    workPackages: 4,
    questionCount: 13
  },
  {
    id: 'water-efficiency',
    folder: 'water-efficiency',
    labelTr: 'Su Verimliliği / Mavi Sertifika',
    labelEn: 'Water Efficiency / Blue Certificate',
    descTr: 'Su Verimliliği Yönetmeliği ve Mavi Sertifika hazırlığı (karbon terimi yok)',
    descEn: 'Water Efficiency Regulation and Blue Certificate readiness (no carbon terms)',
    months: 4,
    workPackages: 4,
    questionCount: 13
  },
  {
    id: 'water-carbon',
    folder: 'water-carbon',
    labelTr: 'Su Verimliliği + Kurumsal Karbon',
    labelEn: 'Water Efficiency + Corporate Carbon',
    descTr: 'Su Verimliliği / Mavi Sertifika + 2025 Kurumsal Karbon Ayak İzi (birleşik)',
    descEn: 'Water Efficiency / Blue Certificate + 2025 Corporate Carbon Footprint (combined)',
    months: 4,
    workPackages: 4,
    questionCount: 13
  }
];

export const DEFAULT_TEMPLATE_ID = 'corporate-carbon';
export const getTemplate = (id) => TEMPLATES.find((t) => t.id === id) || null;
