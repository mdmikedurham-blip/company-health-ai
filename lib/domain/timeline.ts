import type { DimensionId, TimelineEventId, TimelineEventType } from "./primitives";

export interface TimelineEvent {
  id: TimelineEventId;
  date: string;
  month: string;
  type: TimelineEventType;
  title: string;
  description: string;
  scoreBefore?: number;
  scoreAfter?: number;
  dimensionId?: DimensionId;
  dimension?: string;
  whyHealthChanged?: string;
}
