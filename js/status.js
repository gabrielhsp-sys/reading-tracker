// FR-04 status workflow, as a pure function so the form and the tests share it.
import { allowsYearRead, allowsGrade, allowsPriority } from './domain.js';

const filled = (v) => v !== null && v !== undefined && v !== '';

/**
 * Returns the reading after moving to newStatus.
 * - Leaving Want to read: priority is cleared; recommendedBy and notes are kept.
 * - yearRead / grade not allowed by the new status: cleared, and listed in
 *   cleared.needsConfirm so the interface can ask the user first.
 */
export function applyStatusChange(reading, newStatus) {
  const next = { ...reading, status: newStatus };
  const needsConfirm = [];
  if (!allowsPriority(newStatus)) next.priority = null;
  if (!allowsYearRead(newStatus)) {
    if (filled(reading.yearRead)) needsConfirm.push('yearRead');
    next.yearRead = null;
  }
  if (!allowsGrade(newStatus)) {
    if (filled(reading.grade)) needsConfirm.push('grade');
    next.grade = null;
  }
  return { reading: next, cleared: { needsConfirm } };
}

