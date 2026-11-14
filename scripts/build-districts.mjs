#!/usr/bin/env node
/**
 * Generates client/public/data/districts.json with ILLUSTRATIVE resource values.
 *
 * Solar values follow the published tiers (MNRE Solar Atlas + Solargis long-term averages):
 *   Excellent > 6.0 kWh/m²/day, Very good 5.5–6.0, Good 5.0–5.5, Low < 4.5 (cloudy north-east).
 * Monthly shapes give a monsoon dip (Jun–Sep) for monsoon regions and a winter dip for Himalayan districts.
 * Every district is written with illustrative:true. Run `npm run import:nasa` after dropping NASA POWER
 * climatology CSVs into /data-raw to replace these with real values (illustrative:false).
 *
 * Usage: node scripts/build-districts.mjs
 * Note: this overwrites districts.json. If you edited districts.json by hand, edit this file instead or skip it.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../client/public/data/districts.json');

// Monthly shape templates (relative to annual mean, normalised below).
const GHI_SHAPES = {
  monsoon: [1.02, 1.12, 1.2, 1.22, 1.18, 0.92, 0.78, 0.8, 0.9, 1.0, 0.97, 0.94],
  desert: [0.84, 0.95, 1.07, 1.15, 1.18, 1.12, 0.98, 0.94, 1.02, 0.99, 0.9, 0.82],
  gangetic: [0.72, 0.9, 1.1, 1.25, 1.28, 1.14, 0.96, 0.94, 0.98, 0.98, 0.86, 0.72],
  himalaya_cold: [0.68, 0.8, 0.95, 1.08, 1.18, 1.24, 1.2, 1.12, 1.08, 0.96, 0.82, 0.68],
  himalaya_monsoon: [0.7, 0.84, 1.06, 1.24, 1.3, 1.16, 0.88, 0.86, 0.98, 1.05, 0.88, 0.72],
  northeast: [0.94, 1.06, 1.18, 1.2, 1.1, 0.9, 0.86, 0.92, 0.88, 0.96, 0.98, 0.92],
  west_coast: [1.08, 1.18, 1.26, 1.26, 1.16, 0.74, 0.62, 0.7, 0.88, 1.02, 1.04, 1.02],
  tn_coast: [1.0, 1.14, 1.24, 1.22, 1.14, 1.0, 0.96, 0.98, 1.0, 0.88, 0.7, 0.74],
  island: [1.12, 1.2, 1.24, 1.18, 0.96, 0.8, 0.8, 0.84, 0.88, 0.94, 0.98, 1.06],
};
const WIND_SHAPES = {
  sw_monsoon: [0.74, 0.74, 0.78, 0.88, 1.12, 1.42, 1.48, 1.36, 1.06, 0.74, 0.78, 0.86],
  coastal: [0.98, 0.92, 0.9, 0.98, 1.12, 1.16, 1.12, 1.06, 0.96, 0.88, 0.94, 0.98],
  plains: [0.86, 0.94, 1.04, 1.12, 1.2, 1.22, 1.08, 0.96, 0.88, 0.82, 0.88, 0.92],
  mountain: [0.86, 0.94, 1.08, 1.18, 1.16, 1.06, 0.98, 0.96, 0.98, 1.0, 0.92, 0.86],
};
const norm = (a) => {
  const m = a.reduce((s, x) => s + x, 0) / a.length;
  return a.map((x) => x / m);
};
const r2 = (x) => Math.round(x * 100) / 100;

// name, state, category, lat, lon, ghiAnnual, ghiShape, windAnnual, windShape, hydro, biomass, geothermal, grid, diesel, pop, kWh per capita per year, hydroRegime
const D = [
  ['Leh', 'Ladakh', 'border', 34.16, 77.58, 6.3, 'himalaya_cold', 4.6, 'mountain', 'low', 'none', 'potential', 'weak', 'high', 150000, 700, 'snowmelt'],
  ['Kargil', 'Ladakh', 'border', 34.56, 76.13, 6.1, 'himalaya_cold', 4.2, 'mountain', 'med', 'none', 'none', 'weak', 'high', 160000, 550, 'snowmelt'],
  ['Srinagar', 'Jammu & Kashmir', 'border', 34.08, 74.8, 4.8, 'himalaya_monsoon', 3.4, 'mountain', 'med', 'low', 'none', 'weak', 'med', 1500000, 1100, 'snowmelt'],
  ['Lahaul & Spiti', 'Himachal Pradesh', 'border', 32.57, 77.03, 5.6, 'himalaya_cold', 4.4, 'mountain', 'med', 'none', 'none', 'offgrid', 'high', 33000, 650, 'snowmelt'],
  ['Shimla', 'Himachal Pradesh', 'border', 31.1, 77.17, 5.0, 'himalaya_monsoon', 3.5, 'mountain', 'high', 'low', 'none', 'good', 'low', 880000, 1200, 'snowmelt'],
  ['Chamoli', 'Uttarakhand', 'border', 30.41, 79.32, 5.0, 'himalaya_monsoon', 3.3, 'mountain', 'high', 'low', 'potential', 'weak', 'med', 410000, 700, 'snowmelt'],
  ['Pithoragarh', 'Uttarakhand', 'border', 29.58, 80.22, 4.9, 'himalaya_monsoon', 3.2, 'mountain', 'high', 'low', 'none', 'weak', 'med', 500000, 650, 'snowmelt'],
  ['Tawang', 'Arunachal Pradesh', 'border', 27.59, 91.86, 4.2, 'northeast', 3.4, 'mountain', 'high', 'low', 'none', 'weak', 'high', 56000, 500, 'monsoon'],
  ['North Sikkim', 'Sikkim', 'border', 27.51, 88.53, 4.3, 'northeast', 3.3, 'mountain', 'high', 'low', 'potential', 'weak', 'high', 48000, 550, 'snowmelt'],
  ['Darjeeling', 'West Bengal', 'border', 27.04, 88.26, 4.4, 'northeast', 3.2, 'mountain', 'med', 'med', 'none', 'weak', 'med', 1700000, 650, 'monsoon'],
  ['Amritsar', 'Punjab', 'border', 31.63, 74.87, 4.9, 'gangetic', 3.6, 'plains', 'none', 'high', 'none', 'good', 'low', 2800000, 1400, 'monsoon'],
  ['Ferozepur', 'Punjab', 'border', 30.92, 74.61, 5.0, 'gangetic', 3.8, 'plains', 'none', 'high', 'none', 'good', 'low', 1100000, 1300, 'monsoon'],
  ['Jaisalmer', 'Rajasthan', 'desert', 26.92, 70.91, 6.25, 'desert', 6.1, 'sw_monsoon', 'none', 'low', 'none', 'weak', 'med', 780000, 600, 'monsoon'],
  ['Barmer', 'Rajasthan', 'desert', 25.75, 71.39, 6.2, 'desert', 5.6, 'sw_monsoon', 'none', 'low', 'none', 'weak', 'med', 2900000, 600, 'monsoon'],
  ['Jodhpur', 'Rajasthan', 'desert', 26.24, 73.02, 6.15, 'desert', 5.1, 'sw_monsoon', 'none', 'low', 'none', 'good', 'low', 4300000, 900, 'monsoon'],
  ['Bikaner', 'Rajasthan', 'desert', 28.02, 73.31, 6.1, 'desert', 5.0, 'plains', 'none', 'low', 'none', 'good', 'low', 2900000, 800, 'monsoon'],
  ['Kutch', 'Gujarat', 'desert', 23.24, 69.67, 6.05, 'desert', 6.5, 'sw_monsoon', 'none', 'low', 'none', 'weak', 'med', 2400000, 1100, 'monsoon'],
  ['Anantapur', 'Andhra Pradesh', 'desert', 14.68, 77.6, 5.85, 'monsoon', 5.8, 'sw_monsoon', 'none', 'med', 'none', 'good', 'low', 2500000, 900, 'monsoon'],
  ['Rewa', 'Madhya Pradesh', 'desert', 24.53, 81.3, 5.3, 'gangetic', 3.8, 'plains', 'low', 'med', 'none', 'good', 'low', 2000000, 700, 'monsoon'],
  ['Tirunelveli', 'Tamil Nadu', 'wind', 8.71, 77.76, 5.4, 'tn_coast', 7.2, 'sw_monsoon', 'low', 'med', 'none', 'good', 'low', 1700000, 1100, 'monsoon'],
  ['Tumakuru', 'Karnataka', 'wind', 13.34, 77.1, 5.65, 'monsoon', 6.3, 'sw_monsoon', 'none', 'med', 'none', 'good', 'low', 2900000, 900, 'monsoon'],
  ['Surat', 'Gujarat', 'wind', 21.17, 72.83, 5.3, 'west_coast', 5.0, 'coastal', 'none', 'med', 'none', 'good', 'low', 7500000, 1900, 'monsoon'],
  ['Visakhapatnam', 'Andhra Pradesh', 'wind', 17.69, 83.22, 5.1, 'monsoon', 5.0, 'coastal', 'low', 'med', 'none', 'good', 'low', 2100000, 1400, 'monsoon'],
  ['Chennai', 'Tamil Nadu', 'wind', 13.08, 80.27, 5.2, 'tn_coast', 5.2, 'coastal', 'none', 'low', 'none', 'good', 'low', 7500000, 1800, 'monsoon'],
  ['Mumbai', 'Maharashtra', 'wind', 19.08, 72.88, 5.0, 'west_coast', 4.8, 'coastal', 'none', 'low', 'none', 'good', 'low', 13500000, 1300, 'monsoon'],
  ['Idukki', 'Kerala', 'hydro', 9.85, 76.97, 4.9, 'west_coast', 3.6, 'mountain', 'high', 'med', 'none', 'weak', 'med', 1100000, 700, 'monsoon'],
  ['Wayanad', 'Kerala', 'hydro', 11.61, 76.08, 4.85, 'west_coast', 3.4, 'mountain', 'med', 'med', 'none', 'weak', 'med', 850000, 650, 'monsoon'],
  ['East Khasi Hills', 'Meghalaya', 'hydro', 25.58, 91.89, 4.2, 'northeast', 3.3, 'mountain', 'high', 'med', 'none', 'weak', 'med', 950000, 600, 'monsoon'],
  ['Aizawl', 'Mizoram', 'hydro', 23.73, 92.72, 4.35, 'northeast', 3.1, 'mountain', 'med', 'med', 'none', 'weak', 'med', 450000, 550, 'monsoon'],
  ['South 24 Parganas', 'West Bengal', 'flood', 22.53, 88.33, 4.75, 'monsoon', 4.5, 'coastal', 'none', 'med', 'none', 'weak', 'med', 9000000, 500, 'monsoon'],
  ['Supaul', 'Bihar', 'flood', 26.12, 86.6, 4.75, 'gangetic', 3.4, 'plains', 'low', 'med', 'none', 'weak', 'med', 2800000, 300, 'monsoon'],
  ['Kolkata', 'West Bengal', 'flood', 22.57, 88.36, 4.7, 'monsoon', 3.6, 'coastal', 'none', 'low', 'none', 'good', 'low', 4500000, 1500, 'monsoon'],
  ['Dibrugarh', 'Assam', 'flood', 27.47, 94.91, 4.1, 'northeast', 2.9, 'plains', 'low', 'med', 'none', 'weak', 'med', 1450000, 450, 'monsoon'],
  ['Kamrup Metropolitan', 'Assam', 'flood', 26.14, 91.74, 4.4, 'northeast', 3.0, 'plains', 'low', 'low', 'none', 'good', 'low', 1500000, 900, 'monsoon'],
  ['Gadchiroli', 'Maharashtra', 'tribal', 20.18, 80.0, 5.1, 'monsoon', 3.4, 'plains', 'low', 'high', 'none', 'weak', 'med', 1200000, 400, 'monsoon'],
  ['Kalahandi', 'Odisha', 'tribal', 19.91, 83.17, 5.0, 'monsoon', 3.5, 'plains', 'low', 'med', 'none', 'weak', 'med', 1750000, 350, 'monsoon'],
  ['Bastar', 'Chhattisgarh', 'tribal', 19.08, 82.02, 5.05, 'monsoon', 3.3, 'plains', 'med', 'high', 'none', 'weak', 'med', 950000, 400, 'monsoon'],
  ['Ranchi', 'Jharkhand', 'tribal', 23.34, 85.31, 4.95, 'monsoon', 3.6, 'plains', 'low', 'med', 'none', 'good', 'low', 3500000, 800, 'monsoon'],
  ['South Andaman', 'Andaman & Nicobar Islands', 'island', 11.62, 92.73, 4.9, 'island', 5.0, 'coastal', 'low', 'med', 'none', 'offgrid', 'high', 270000, 800, 'monsoon'],
  ['Lakshadweep', 'Lakshadweep', 'island', 10.57, 72.64, 5.3, 'island', 6.0, 'coastal', 'none', 'low', 'none', 'offgrid', 'high', 70000, 650, 'monsoon'],
  ['Delhi', 'Delhi', 'demand', 28.61, 77.21, 5.0, 'gangetic', 3.6, 'plains', 'none', 'low', 'none', 'good', 'low', 22000000, 1600, 'monsoon'],
  ['Pune', 'Maharashtra', 'demand', 18.52, 73.86, 5.4, 'west_coast', 4.0, 'sw_monsoon', 'low', 'med', 'none', 'good', 'low', 11500000, 1300, 'monsoon'],
  ['Nagpur', 'Maharashtra', 'demand', 21.15, 79.09, 5.3, 'monsoon', 3.6, 'plains', 'none', 'med', 'none', 'good', 'low', 5300000, 1200, 'monsoon'],
  ['Lucknow', 'Uttar Pradesh', 'demand', 26.85, 80.95, 4.95, 'gangetic', 3.4, 'plains', 'none', 'med', 'none', 'good', 'low', 5400000, 1000, 'monsoon'],
  ['Varanasi', 'Uttar Pradesh', 'demand', 25.32, 82.97, 5.0, 'gangetic', 3.4, 'plains', 'none', 'med', 'none', 'good', 'low', 4200000, 800, 'monsoon'],
  ['Patna', 'Bihar', 'demand', 25.59, 85.14, 4.85, 'gangetic', 3.4, 'plains', 'none', 'med', 'none', 'good', 'low', 7000000, 600, 'monsoon'],
  ['Khordha', 'Odisha', 'demand', 20.3, 85.82, 5.0, 'monsoon', 4.0, 'coastal', 'none', 'med', 'none', 'good', 'low', 2600000, 1200, 'monsoon'],
  ['Indore', 'Madhya Pradesh', 'demand', 22.72, 75.86, 5.45, 'monsoon', 4.2, 'sw_monsoon', 'none', 'med', 'none', 'good', 'low', 4000000, 1300, 'monsoon'],
  ['Bengaluru Urban', 'Karnataka', 'demand', 12.97, 77.59, 5.4, 'monsoon', 4.6, 'sw_monsoon', 'none', 'low', 'none', 'good', 'low', 13500000, 1600, 'monsoon'],
  ['Hyderabad', 'Telangana', 'demand', 17.39, 78.49, 5.45, 'monsoon', 4.2, 'sw_monsoon', 'none', 'low', 'none', 'good', 'low', 4500000, 1900, 'monsoon'],
];

const slug = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const districts = D.map(([name, state, category, lat, lon, ghi, ghiShape, wind, windShape, hydro, biomass, geo, grid, diesel, pop, percap, hydroRegime]) => {
  const g = norm(GHI_SHAPES[ghiShape]).map((f) => r2(ghi * f));
  const w = norm(WIND_SHAPES[windShape]).map((f) => r2(wind * f));
  return {
    id: slug(name),
    name,
    state,
    category,
    lat,
    lon,
    population_est: pop,
    demand_mwh_yr_est: Math.round((pop * percap) / 1000),
    ghi_monthly: g,
    wind50m_monthly: w,
    small_hydro_potential: hydro,
    biomass_potential: biomass,
    geothermal_potential: geo,
    grid_access: grid,
    diesel_dependence: diesel,
    hydro_regime: hydroRegime,
    sources: {
      ghi: 'Illustrative tier: MNRE Solar Atlas + Solargis long-term averages (via InfraLens). Replace with NASA POWER ALLSKY_SFC_SW_DWN.',
      wind: 'Illustrative estimate at 50 m. Replace with NASA POWER WS50M.',
      potentials: 'Illustrative qualitative tiers (small hydro, biomass, geothermal). Verify locally.',
      population: 'Approximate projection from Census 2011; illustrative.',
      demand: 'Estimate: population × assumed per-capita consumption; illustrative.',
    },
    illustrative: true,
  };
});

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(districts, null, 2) + '\n');
console.log(`Wrote ${districts.length} districts to ${out}`);
