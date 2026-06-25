/**
 * Proje türleri (programlar) — ARTIK VERİTABANINDAN okunur (`programs` tablosu).
 *
 * Eskiden burada sabit bir TEMPLATES dizisi vardı; programlar artık platform
 * içindeki Yönetim ekranından düzenlendiği için tek kaynak veritabanıdır.
 * Bu modül, generator/route'ların beklediği camelCase "template" biçimine
 * eşler (labelTr, months, workPackages, questionCount ...).
 */
import { getProgramBySlug, Knowledge } from './services/knowledge.js';

export const DEFAULT_TEMPLATE_ID = 'corporate-carbon';

/** Bir program satırını eski "template" biçimine dönüştürür. */
function toTemplate(p) {
  if (!p) return null;
  return {
    id: p.slug,
    folder: p.slug,            // geriye dönük uyumluluk (artık dosya yok)
    labelTr: p.label_tr,
    labelEn: p.label_en,
    descTr: p.desc_tr,
    descEn: p.desc_en,
    months: p.months,
    workPackages: p.work_packages,
    questionCount: p.question_count
  };
}

export function getTemplates() {
  return Knowledge.listPrograms().filter((p) => p.active).map(toTemplate);
}

export function getTemplate(id) {
  return toTemplate(getProgramBySlug(id));
}
