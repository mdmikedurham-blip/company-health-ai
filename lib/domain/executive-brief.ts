import type { BoardPrepStatus } from "./primitives";

export interface BriefWin {
  title: string;
  detail: string;
}

export interface BoardPrepItem {
  title: string;
  status: BoardPrepStatus;
  detail: string;
}

export interface BoardMeetingPrep {
  date: string;
  daysUntil: number;
  items: BoardPrepItem[];
}

/**
 * Daily CEO briefing — composed from HealthScore, Insights, Risks, and Recommendations.
 */
export interface ExecutiveBrief {
  date: string;
  generatedAt: string;
  summary: string;
  highlights: string[];
  topWins: BriefWin[];
  boardMeeting: BoardMeetingPrep;
}
