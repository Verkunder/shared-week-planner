import type { EventCategory } from "@/app/(app)/profile/actions";

export type Interval = { start: Date; end: Date };

export type ParticipantSchedule = {
  userId: string;
  personalCategoryIds: Set<string>;
  events: {
    starts_at: string;
    ends_at: string;
    category_id: string | null;
  }[];
};

export function personalCategoryIds(categories: EventCategory[]): Set<string> {
  return new Set(categories.filter((c) => c.is_personal).map((c) => c.id));
}

function intersect(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const start = a[i].start > b[j].start ? a[i].start : b[j].start;
    const end = a[i].end < b[j].end ? a[i].end : b[j].end;
    if (start < end) out.push({ start: new Date(start), end: new Date(end) });
    if (a[i].end < b[j].end) i++;
    else j++;
  }
  return out;
}

function subtract(base: Interval[], cuts: Interval[]): Interval[] {
  const result: Interval[] = [];
  for (const b of base) {
    let segments: Interval[] = [{ start: b.start, end: b.end }];
    for (const cut of cuts) {
      const next: Interval[] = [];
      for (const seg of segments) {
        if (cut.end <= seg.start || cut.start >= seg.end) {
          next.push(seg);
          continue;
        }
        if (cut.start > seg.start) {
          next.push({ start: seg.start, end: cut.start });
        }
        if (cut.end < seg.end) {
          next.push({ start: cut.end, end: seg.end });
        }
      }
      segments = next;
      if (segments.length === 0) break;
    }
    result.push(...segments);
  }
  return result.filter((s) => s.end > s.start);
}

function mergeAndSort(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
  const out: Interval[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    const cur = sorted[i];
    if (cur.start <= last.end) {
      if (cur.end > last.end) last.end = cur.end;
    } else {
      out.push({ start: cur.start, end: cur.end });
    }
  }
  return out;
}

function clipToWindow(
  intervals: Interval[],
  from: Date,
  to: Date,
): Interval[] {
  const out: Interval[] = [];
  for (const i of intervals) {
    const s = i.start < from ? from : i.start;
    const e = i.end > to ? to : i.end;
    if (s < e) out.push({ start: new Date(s), end: new Date(e) });
  }
  return out;
}

function buildFreeWithinPersonal(
  schedule: ParticipantSchedule,
  from: Date,
  to: Date,
): Interval[] {
  const personalBlocks: Interval[] = [];
  const otherBlocks: Interval[] = [];
  for (const ev of schedule.events) {
    const seg: Interval = {
      start: new Date(ev.starts_at),
      end: new Date(ev.ends_at),
    };
    if (ev.category_id && schedule.personalCategoryIds.has(ev.category_id)) {
      personalBlocks.push(seg);
    } else {
      otherBlocks.push(seg);
    }
  }
  const personal = clipToWindow(mergeAndSort(personalBlocks), from, to);
  const others = clipToWindow(mergeAndSort(otherBlocks), from, to);
  return subtract(personal, others);
}

export function findCommonSlot(
  schedules: ParticipantSchedule[],
  durationMinutes: number,
  from: Date,
  to: Date,
): Interval | null {
  if (schedules.length === 0) return null;

  let common = buildFreeWithinPersonal(schedules[0], from, to);
  for (let i = 1; i < schedules.length; i++) {
    if (common.length === 0) return null;
    common = intersect(common, buildFreeWithinPersonal(schedules[i], from, to));
  }

  const minMs = durationMinutes * 60 * 1000;
  for (const slot of common) {
    if (slot.end.getTime() - slot.start.getTime() >= minMs) {
      return {
        start: new Date(slot.start),
        end: new Date(slot.start.getTime() + minMs),
      };
    }
  }
  return null;
}
