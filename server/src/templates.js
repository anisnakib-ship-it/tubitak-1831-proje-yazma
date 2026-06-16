/**
 * TÜBİTAK 1831 proje türleri (şablonlar).
 * Her tür, Obsidian vault'unda kendi klasörüne sahiptir:
 *   knowledge/<folder>/00-index.md + section-01..N.md (+ scope notu)
 * Ortak notlar: knowledge/_global/
 *
 * questionCount: o türde sorulacak bölüm/soru sayısı (1831 standardı = 21).
 */
export const TEMPLATES = [
  {
    id: 'tubitak-1831',
    folder: 'tubitak-1831',
    labelTr: 'TÜBİTAK 1831 (Genel)',
    labelEn: 'TÜBİTAK 1831 (General)',
    descTr: 'Standart 1831 Yeşil İnovasyon proje formu (21 soru, kapsam seçmeli)',
    descEn: 'Standard 1831 green-innovation project form (21 questions, scope checklist)',
    months: 4,
    workPackages: 4,
    questionCount: 21
  },
  {
    id: 'water-blue',
    folder: 'water-blue-cert',
    labelTr: 'Su Verimliliği / Mavi Sertifika',
    labelEn: 'Water Efficiency / Blue Certificate',
    descTr: 'Su Verimliliği Yönetmeliği, Mavi Sertifika (karbon terimi yok)',
    descEn: 'Water Efficiency Regulation, Blue Certificate (no carbon terms)',
    months: 4,
    workPackages: 4,
    questionCount: 13
  },
  {
    id: 'water-carbon',
    folder: 'water-carbon',
    labelTr: 'Su Verimliliği + Kurumsal Karbon',
    labelEn: 'Water Efficiency + Corporate Carbon',
    descTr: 'Su Verimliliği/Mavi Sertifika + 2025 Kurumsal Karbon Ayak İzi',
    descEn: 'Water Efficiency/Blue Certificate + 2025 Corporate Carbon Footprint',
    months: 4,
    workPackages: 4,
    questionCount: 13
  }
];

export const DEFAULT_TEMPLATE_ID = 'tubitak-1831';
export const getTemplate = (id) => TEMPLATES.find((t) => t.id === id) || null;
