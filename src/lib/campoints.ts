// Shared client/server constants for the Campoints program.
export const POINTS_PER_NAIRA = 10; // 10 Campoints = ₦1
export const MIN_CASHOUT_POINTS = 10_000; // ₦1,000
export const MIN_AIRTIME_POINTS = 1_000; // ₦100

export const NETWORKS = ["MTN", "Glo", "Airtel", "9mobile"] as const;
export type Network = (typeof NETWORKS)[number];

export function pointsToNaira(points: number) {
  return Math.floor(points / POINTS_PER_NAIRA);
}
export function nairaToPoints(naira: number) {
  return naira * POINTS_PER_NAIRA;
}
export function formatPoints(n: number) {
  return n.toLocaleString();
}
