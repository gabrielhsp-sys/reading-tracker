// Controlled values of the domain model (assignment, Section 4).
// Stored and displayed with exactly this spelling.

export const FORMS = [
  'Novel', 'Novella', 'Short Story', 'Short Story Collection', 'Play',
  'Essay', 'Treatise', 'Diary', 'Graphic Novel',
];
export const MODES = ['Prose', 'Drama', 'Poetry', 'Sequential Art'];
export const CONTENTS = ['Fiction', 'Non-fiction'];

export const STATUS = Object.freeze({
  WANT_TO_READ: 'Want to read',
  READING: 'Reading',
  PAUSED: 'Paused',
  READ: 'Read',
  ABANDONED: 'Abandoned',
});
export const STATUSES = Object.values(STATUS);
export const PRIORITIES = ['Low', 'Medium', 'High'];

/** Year read: required for Read, optional for Abandoned, empty otherwise. */
export function yearReadRule(status) {
  if (status === STATUS.READ) return 'required';
  if (status === STATUS.ABANDONED) return 'optional';
  return 'forbidden';
}

export function allowsYearRead(status) {
  return yearReadRule(status) !== 'forbidden';
}

export function allowsGrade(status) {
  return status === STATUS.READ || status === STATUS.ABANDONED;
}

export function allowsPriority(status) {
  return status === STATUS.WANT_TO_READ;
}
