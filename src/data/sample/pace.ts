import type { PaceDataset, PaceEntry } from '../types';

// Fictional drivers and numbers, chosen to exercise the edge cases in DESIGN.md:
// suffixes (Jr.), lowercase particles (van), car 00, a tie, both markers, an exclusion.
const field: PaceEntry[] = [
  { carNumber: '8', firstName: 'Tomas', lastName: 'Reyes', markerTokens: [], paceScore: 30.412 },
  { carNumber: '00', firstName: 'Dale', lastName: 'Whitcomb Jr.', markerTokens: [], paceScore: 30.448 },
  { carNumber: '17', firstName: 'Kenji', lastName: 'Arlo', markerTokens: [], paceScore: 30.471 },
  { carNumber: '41', firstName: 'Marcus', lastName: 'van Doorn', markerTokens: ['#'], paceScore: 30.471 },
  { carNumber: '3', firstName: 'Bryce', lastName: 'Holloway', markerTokens: [], paceScore: 30.503 },
  { carNumber: '22', firstName: 'Luis', lastName: 'Ortega', markerTokens: [], paceScore: 30.519 },
  { carNumber: '6', firstName: 'Cody', lastName: 'Pruitt', markerTokens: ['(i)'], paceScore: 30.538 },
  { carNumber: '54', firstName: 'Ethan', lastName: 'Marsh', markerTokens: [], paceScore: 30.561 },
  { carNumber: '11', firstName: 'Ray', lastName: 'Castellano', markerTokens: [], paceScore: 30.574 },
  { carNumber: '99', firstName: 'Jordan', lastName: 'Bell', markerTokens: ['#'], paceScore: 30.602 },
  { carNumber: '48', firstName: 'Nate', lastName: 'Kessler', markerTokens: [], paceScore: 30.633 },
  { carNumber: '1', firstName: 'Wes', lastName: 'Garrity', markerTokens: [], paceScore: 30.381, excluded: 'diffuser damage' },
];

const definition = 'Pace score: avg green-flag lap, adjusted to fresh tires';

export const samplePace: Record<string, PaceDataset> = {
  cup: {
    race: { seriesId: 'cup', raceName: 'Sample 400', venue: 'Charlotte Motor Speedway', year: 2026, totalLaps: 267, stageLaps: [80, 85, 102] },
    lapFrom: 1,
    lapTo: 167,
    live: true,
    flag: 'green',
    // Sample cautions on laps 46-51 and 121-127, to show the lap bar's colors.
    lapFlags: Array.from({ length: 167 }, (_, i) => ((i >= 45 && i <= 50) || (i >= 120 && i <= 126) ? 'yellow' : 'green')),
    metricDefinition: definition,
    entries: field,
    source: 'sample',
  },
  oreilly: {
    race: { seriesId: 'oreilly', raceName: 'Sample 300', venue: 'Charlotte Motor Speedway', year: 2026, totalLaps: 200, stageLaps: [45, 45, 110] },
    lapFrom: 1,
    lapTo: 200,
    live: false,
    metricDefinition: definition,
    entries: field.map((e) => ({ ...e, paceScore: e.paceScore + 0.62 })),
    source: 'sample',
  },
  craftsman: {
    race: { seriesId: 'craftsman', raceName: 'Sample 200', venue: 'Charlotte Motor Speedway', year: 2026, totalLaps: 134, stageLaps: [30, 30, 74] },
    lapFrom: 61,
    lapTo: 134,
    live: false,
    metricDefinition: definition,
    entries: field.map((e) => ({ ...e, paceScore: e.paceScore + 1.05 })),
    source: 'sample',
  },
};
