export function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function createFeedingSession(breast, startedAt = new Date()) {
  if (!['L', 'R'].includes(breast)) {
    throw new Error('Breast must be L or R.');
  }

  return {
    breast,
    startedAt: new Date(startedAt),
    status: 'active',
  };
}

export function getDurationMinutes(startedAt, endedAt) {
  return Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));
}

export function finishFeedingSession(session, endedAt = new Date()) {
  if (!session || session.status !== 'active') {
    throw new Error('No active feeding session to finish.');
  }

  const finishedAt = new Date(endedAt);
  if (finishedAt < session.startedAt) {
    throw new Error('The end time cannot be before the start time.');
  }

  return {
    ...session,
    endedAt: finishedAt,
    durationMinutes: getDurationMinutes(session.startedAt, finishedAt),
    status: 'finished',
  };
}
