import test from 'node:test';
import assert from 'node:assert/strict';
import { formFor } from '../../web/src/forms.js';
import {
  heuristicSuggestionsV2,
  mergeAnalysis,
  validateExtractionResult
} from '../src/services/analysis-import.js';

const fields = formFor('water-efficiency').flatMap((group) => group.fields);

test('rejects interviewer questions as field values', () => {
  const transcript = 'Danışman: Dış ticaret var mı?';
  const result = validateExtractionResult({
    items: [{ key: 'foreignTrade', value: 'Dış ticaret var mı?', evidence: 'Dış ticaret var mı?' }]
  }, fields, transcript);

  assert.deepEqual(result.extracted, {});
  assert.match(result.rejected[0], /question/);
});

test('does not mistake the Müşteri speaker label for a question', () => {
  const transcript = 'Müşteri: İhracat yapıyoruz.';
  const result = validateExtractionResult({
    items: [{ key: 'foreignTrade', value: 'İhracat yapıyoruz', evidence: transcript }]
  }, fields, transcript);

  assert.equal(result.extracted.foreignTrade, 'İhracat yapıyoruz');
});

test('uses cited answer lines while discarding cited question lines', () => {
  const transcript = 'Ne üretiyoruz?\nDokuma, fantezi kumaş ve gömleklik elbise üretiyoruz.';
  const lineMap = new Map([
    ['L0001', 'Ne üretiyoruz?'],
    ['L0002', 'Dokuma, fantezi kumaş ve gömleklik elbise üretiyoruz.']
  ]);
  const result = validateExtractionResult({
    items: [{
      key: 'products',
      value: 'Dokuma, fantezi kumaş ve gömleklik elbise',
      evidenceLineIds: ['L001', 'L002']
    }]
  }, fields, transcript, lineMap);

  assert.equal(result.extracted.products, 'Dokuma, fantezi kumaş ve gömleklik elbise');
  assert.equal(result.evidence.products, 'Dokuma, fantezi kumaş ve gömleklik elbise üretiyoruz.');
});

test('rejects invalid structured values even when evidence exists', () => {
  const transcript = 'Web sitemiz de şu anda yenileniyor.';
  const result = validateExtractionResult({
    items: [{ key: 'web', value: 'de', evidence: 'Web sitemiz de şu anda yenileniyor.' }]
  }, fields, transcript);

  assert.deepEqual(result.extracted, {});
  assert.match(result.rejected[0], /implausible/);
});

test('rejects a model value that adds details beyond its cited answer', () => {
  const transcript = 'Müşteri: Dokuma kumaş üretiyoruz.';
  const result = validateExtractionResult({
    items: [{
      key: 'products',
      value: 'Dokuma kumaş ve aylık 50 ton organik iplik üretiyoruz',
      evidence: transcript
    }]
  }, fields, transcript);

  assert.equal(result.extracted.products, undefined);
  assert.match(result.rejected[0], /adds details/);
});

test('accepts all narrative fields that were previously unsupported', () => {
  const transcript = [
    'Müşteri: Bizi önemli kılan düşük su tüketimli boyama prosesimizdir.',
    'Müşteri: Daha önce iki verimlilik projesi tamamladık.',
    'Müşteri: Beş kişilik bir Ar-Ge ekibimiz var.',
    'Müşteri: Kapalı devre su geri kazanımı uyguluyoruz.'
  ].join('\n');
  const items = [
    ['competitiveFactors', 'Düşük su tüketimli boyama prosesi', 'Bizi önemli kılan düşük su tüketimli boyama prosesimizdir.'],
    ['pastProjects', 'İki verimlilik projesi tamamlandı', 'Daha önce iki verimlilik projesi tamamladık.'],
    ['rdCapability', 'Beş kişilik Ar-Ge ekibi', 'Beş kişilik bir Ar-Ge ekibimiz var.'],
    ['ecoProduction', 'Kapalı devre su geri kazanımı', 'Kapalı devre su geri kazanımı uyguluyoruz.']
  ].map(([key, value, evidence]) => ({ key, value, evidence }));

  const result = validateExtractionResult({ items }, fields, transcript);
  assert.deepEqual(Object.keys(result.extracted), [
    'competitiveFactors', 'pastProjects', 'rdCapability', 'ecoProduction'
  ]);
  assert.deepEqual(result.rejected, []);
});

test('does not select checklist options mentioned only in a question', () => {
  const transcript = 'Danışman: ISO 14001 belgeniz var mı?';
  const model = validateExtractionResult({
    items: [{
      key: 'documents',
      value: ['ISO 14001 – Çevre Yönetim Sistemi'],
      evidence: 'ISO 14001 belgeniz var mı?'
    }]
  }, fields, transcript);
  const heuristic = validateExtractionResult(heuristicSuggestionsV2(transcript), fields, transcript);

  assert.deepEqual(model.extracted, {});
  assert.deepEqual(heuristic.extracted, {});
});

test('does not infer a project need from an ordinary customer mention', () => {
  const transcript = 'Müşteri: Yurt içinde düzenli müşterilerimiz var.';
  const result = validateExtractionResult(heuristicSuggestionsV2(transcript), fields, transcript);

  assert.equal(result.extracted.needReasons, undefined);
});

test('does not turn completed past work into future project scope', () => {
  const transcript = 'Müşteri: Daha önce iki enerji verimliliği projesini tamamladık.';
  const result = validateExtractionResult(heuristicSuggestionsV2(transcript), fields, transcript);

  assert.equal(result.extracted.projectScopeItems, undefined);
});

test('requires direct Ar-Ge evidence for Ar-Ge capability', () => {
  const transcript = 'Müşteri: Kurucularımız uzun yıllar arıtma sektöründe çalıştı.';
  const result = validateExtractionResult({
    items: [{
      key: 'rdCapability',
      value: 'Arıtma sektöründe deneyimli kurucular',
      evidence: 'Kurucularımız uzun yıllar arıtma sektöründe çalıştı.'
    }]
  }, fields, transcript);

  assert.equal(result.extracted.rdCapability, undefined);
  assert.match(result.rejected[0], /does not support/);
});

test('does not classify a customer-profile answer as current activities', () => {
  const transcript = 'Müşteri: Müşterilerimiz genellikle yurt içindeki üretim işletmeleri.';
  const result = validateExtractionResult({
    items: [{
      key: 'currentActivities',
      value: 'Yurt içindeki üretim işletmelerine hizmet veriyor.',
      evidence: 'Müşteri: Müşterilerimiz genellikle yurt içindeki üretim işletmeleri.'
    }]
  }, fields, transcript);

  assert.equal(result.extracted.currentActivities, undefined);
  assert.match(result.rejected[0], /does not support/);
});

test('captures an explicit negative foreign-trade answer', () => {
  const transcript = 'Danışman: Dış ticaret var mı?\nMüşteri: Hayır, dış ticaret yapmıyoruz.';
  const result = validateExtractionResult(heuristicSuggestionsV2(transcript), fields, transcript);

  assert.equal(result.extracted.foreignTrade, 'dış ticaret yapmıyoruz');
});

test('requires a numeric NACE code instead of inferred sector wording', () => {
  const transcript = 'Müşteri: Dokuma ve boyama alanında faaliyet gösteriyoruz.';
  const result = validateExtractionResult({
    items: [{
      key: 'sectorNace',
      value: 'Dokuma ve boyama',
      evidence: 'Dokuma ve boyama alanında faaliyet gösteriyoruz.'
    }]
  }, fields, transcript);

  assert.equal(result.extracted.sectorNace, undefined);
  assert.match(result.rejected[0], /does not support|implausible/);
});

test('accepts a directly stated NACE code', () => {
  const transcript = 'Müşteri: NACE kodumuz 13.20.';
  const result = validateExtractionResult({
    items: [{ key: 'sectorNace', value: '13.20', evidence: 'NACE kodumuz 13.20.' }]
  }, fields, transcript);

  assert.equal(result.extracted.sectorNace, '13.20');
});

test('rejects generic trade wording but accepts explicit export evidence', () => {
  const vagueTranscript = 'Müşteri: Altı ülkeye dair çalışmalarımız var.';
  const vague = validateExtractionResult({
    items: [{ key: 'foreignTrade', value: 'Altı ülkeye çalışmalar var', evidence: vagueTranscript }]
  }, fields, vagueTranscript);
  const explicitTranscript = 'Müşteri: Polonya ve Belçika’ya ihracat yapıyoruz.';
  const explicit = validateExtractionResult({
    items: [{ key: 'foreignTrade', value: 'İhracat yapıyoruz', evidence: explicitTranscript }]
  }, fields, explicitTranscript);

  assert.equal(vague.extracted.foreignTrade, undefined);
  assert.equal(explicit.extracted.foreignTrade, 'İhracat yapıyoruz');
});

test('requires concrete facility evidence for locations', () => {
  const operationalTranscript = 'Müşteri: Kendi yerimizde dokuyor, boyamayı dışarıda yaptırıyoruz.';
  const operational = validateExtractionResult({
    items: [{ key: 'locations', value: 'Kendi yerimiz ve dışarıdaki boyahane', evidence: operationalTranscript }]
  }, fields, operationalTranscript);
  const concreteTranscript = 'Müşteri: Bursa OSB’de 5.000 metrekare fabrikamız var.';
  const concrete = validateExtractionResult({
    items: [{ key: 'locations', value: 'Bursa OSB, 5.000 m² fabrika', evidence: concreteTranscript }]
  }, fields, concreteTranscript);

  assert.equal(operational.extracted.locations, undefined);
  assert.equal(concrete.extracted.locations, 'Bursa OSB, 5.000 m² fabrika');
});

test('does not turn an unrelated production fragment into an address', () => {
  const transcript = 'Müşteri: Boya ve apre işlemlerini fason yaptırıyoruz.';
  const result = validateExtractionResult({
    items: [{ key: 'address', value: 'Boya ve apre', evidence: transcript }]
  }, fields, transcript);

  assert.equal(result.extracted.address, undefined);
  assert.match(result.rejected[0], /does not support/);
});

test('accepts checklist options supported by a declarative customer answer', () => {
  const transcript = 'Müşteri: ISO 14001 belgemiz var.';
  const result = validateExtractionResult({
    items: [{
      key: 'documents',
      value: ['ISO 14001 – Çevre Yönetim Sistemi'],
      evidence: 'ISO 14001 belgemiz var.'
    }]
  }, fields, transcript);

  assert.deepEqual(result.extracted.documents, ['ISO 14001 – Çevre Yönetim Sistemi']);
});

test('normalizes local-model keyed items and respects checklist negation', () => {
  const transcript = 'Müşteri: ISO 14001 belgemiz var ancak ISO 14046 belgemiz henüz yok.';
  const result = validateExtractionResult({
    items: [{
      documents: ['ISO 14001 belgemiz var'],
      evidence: 'Müşteri: ISO 14001 belgemiz var ancak ISO 14046 belgemiz henüz yok.'
    }]
  }, fields, transcript);

  assert.deepEqual(result.extracted.documents, ['ISO 14001 – Çevre Yönetim Sistemi']);
  assert.deepEqual(result.rejected, []);
});

test('recognizes conversational founding dates and customer ranges conservatively', () => {
  const transcript = "Şirketimiz 2021'de kuruldu. Yıllık ortalamada 10-20 müşteriye hizmet veriyoruz.";
  const result = validateExtractionResult(heuristicSuggestionsV2(transcript), fields, transcript);

  assert.equal(result.extracted.foundingDate, '2021');
  assert.equal(result.extracted.customerCount, '10-20');
});

test('fill-empty merge preserves reviewed values while overwrite replaces them', () => {
  const current = { web: 'www.example.com' };
  const extracted = { web: 'www.new.example.com', employees: '42' };

  assert.deepEqual(mergeAnalysis({ current, extracted, mode: 'fill-empty' }).analysis, {
    web: 'www.example.com', employees: '42'
  });
  assert.deepEqual(mergeAnalysis({ current, extracted, mode: 'overwrite' }).analysis, {
    web: 'www.new.example.com', employees: '42'
  });
});
