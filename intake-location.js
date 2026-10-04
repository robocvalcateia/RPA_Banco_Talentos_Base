import { readFileSync } from 'node:fs';
const norm = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const states = JSON.parse(readFileSync(new URL('./resources/geography/estados.json', import.meta.url)));
const cities = JSON.parse(readFileSync(new URL('./resources/geography/municipios.json', import.meta.url))).map(c => ({ ...c, uf: states.find(s => s.codigo_uf === c.codigo_uf).uf, key: norm(c.nome) })).sort((a, b) => b.key.length - a.key.length);
const addressPatterns = cities.map(c => ({ city: c, pattern: new RegExp(`(?:^| )${c.key} (?:${c.uf.toLowerCase()}|${norm(states.find(s => s.uf === c.uf).nome)})(?= |$)`) }));
export function stateInfo(value) { return states.find(s => norm(s.uf) === norm(value) || norm(s.nome) === norm(value)); }
export function normalizePlace(city, state) {
  const info = stateInfo(state);
  if (['rj', 'sp'].includes(norm(city)) && norm(city) === norm(info?.uf)) city = info.nome;
  return { city: String(city || '').trim(), state: info?.nome || String(state || '').trim() };
}
function resolve(city, state) {
  const place = normalizePlace(city, state), uf = stateInfo(place.state)?.uf;
  if (!place.city || !uf) return null;
  return cities.find(c => c.uf === uf && c.key === norm(place.city)) || null;
}
export function consultantLocation(cv) {
  const address = cv.endereco;
  const structured = address && typeof address === 'object' ? address : {};
  const city = cv.city || cv.cidade || cv.municipio || structured.city || structured.cidade || structured.municipio;
  const state = cv.state || cv.estado || cv.uf || structured.state || structured.estado || structured.uf;
  if (city || state) return resolve(city, state);
  if (typeof address !== 'string') return null;
  const text = norm(address);
  if (text === 'rj rj') return resolve('RJ', 'RJ');
  if (text === 'sp sp') return resolve('SP', 'SP');
  // Use the registered address only: former client/project locations are not residence.
  const matches = addressPatterns.filter(item => item.pattern.test(text)).map(item => item.city);
  if (!matches.length) return null;
  // Longer names absorb embedded names such as Santa Bárbara d'Oeste.
  const longest = matches[0];
  return matches.some(c => c.codigo_ibge !== longest.codigo_ibge && !longest.key.endsWith(c.key)) ? null : longest;
}
export function haversineKm(a, b) {
  const rad = x => x * Math.PI / 180;
  const v = Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, v)));
}
export const withinRadius = distance => Number.isFinite(distance) && distance <= 100;
export function locationEligibility(cv, fields) {
  if (!['presencial', 'hibrido'].includes(norm(fields.workModel))) return { status: 'not_required', allowed: true, distanceKm: null, detail: 'Sem limite geográfico para trabalho remoto.' };
  const target = resolve(fields.city, fields.state), candidate = consultantLocation(cv);
  if (!target || !candidate) return { status: 'unknown', allowed: false, distanceKm: null, detail: !target ? 'Localização da oportunidade a confirmar.' : 'Localização do consultor a confirmar.' };
  const distanceKm = haversineKm(target, candidate);
  return { status: withinRadius(distanceKm) ? 'within' : 'outside', allowed: withinRadius(distanceKm), distanceKm,
    city: candidate.nome, state: candidate.uf, detail: `${candidate.nome}/${candidate.uf} · ${distanceKm.toFixed(1).replace('.', ',')} km em linha reta entre sedes municipais · limite 100 km.` };
}
