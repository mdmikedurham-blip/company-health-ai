/**
 * Money helpers for Value Navigator — always ranges, never false precision.
 */

import type { MoneyRange } from "@/lib/domain/value-navigator";

export function moneyRange(low: number, high: number): MoneyRange {
  const a = Math.max(0, Math.round(low));
  const b = Math.max(0, Math.round(high));
  return {
    low: Math.min(a, b),
    high: Math.max(a, b),
    currency: "USD",
  };
}

export function mid(range: MoneyRange): number {
  return (range.low + range.high) / 2;
}

export function valueGap(current: MoneyRange, potential: MoneyRange): MoneyRange {
  return moneyRange(potential.low - current.high, potential.high - current.low);
}

export function formatUsdRange(range: MoneyRange): string {
  const fmt = (n: number) => {
    if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  };
  if (range.low === range.high) return fmt(range.low);
  return `${fmt(range.low)} – ${fmt(range.high)}`;
}

export function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function asRatio(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (Math.abs(value) <= 1.5) return value;
  return value / 100;
}
