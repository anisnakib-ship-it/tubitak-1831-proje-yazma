/**
 * TÜBİTAK 1831 proje türleri (şablonlar).
 * Her tür, Obsidian vault'unda kendi klasörüne sahiptir:
 *   knowledge/<folder>/00-index.md + section-01..13.md (+ intro/scope notu)
 * Ortak notlar: knowledge/_global/
 */
export const TEMPLATES = [
  {
    id: 'corporate-carbon',
    folder: 'corporate-carbon',
    labelTr: 'Kurumsal Karbon Ayak İzi',
    labelEn: 'Corporate Carbon Footprint',
    descTr: 'ISO 14064-1, Kapsam 1/2/3, kurumsal sera gazı envanteri',
    descEn: 'ISO 14064-1, Scope 1/2/3, corporate GHG inventory',
    months: 6,
    workPackages: 5
  },
  {
    id: 'product-carbon',
    folder: 'product-carbon',
    labelTr: 'Ürün Karbon Ayak İzi',
    labelEn: 'Product Carbon Footprint',
    descTr: 'ISO 14067, yaşam döngüsü, işlevsel birim (Kapsam yok)',
    descEn: 'ISO 14067, life-cycle, functional unit (no Scopes)',
    months: 6,
    workPackages: 5
  },
  {
    id: 'water-blue',
    folder: 'water-blue-cert',
    labelTr: 'Su Verimliliği / Mavi Sertifika',
    labelEn: 'Water Efficiency / Blue Certificate',
    descTr: 'Su Verimliliği Yönetmeliği, Mavi Sertifika (karbon terimi yok)',
    descEn: 'Water Efficiency Regulation, Blue Certificate (no carbon terms)',
    months: 4,
    workPackages: 4
  },
  {
    id: 'water-carbon',
    folder: 'water-carbon',
    labelTr: 'Su Verimliliği + Kurumsal Karbon',
    labelEn: 'Water Efficiency + Corporate Carbon',
    descTr: 'Su Verimliliği/Mavi Sertifika + 2025 Kurumsal Karbon Ayak İzi',
    descEn: 'Water Efficiency/Blue Certificate + 2025 Corporate Carbon Footprint',
    months: 4,
    workPackages: 4
  }
];

export const DEFAULT_TEMPLATE_ID = 'corporate-carbon';
export const getTemplate = (id) => TEMPLATES.find((t) => t.id === id) || null;
