// Sanctioning bodies shown in the top-right switcher. Each series profile belongs to one.
export const BODIES = [
  { id: 'nascar', name: 'NASCAR', available: true },
  { id: 'imsa', name: 'IMSA', available: false }, // 2027 bonus target (DESIGN.md)
] as const;
export type BodyId = (typeof BODIES)[number]['id'];
