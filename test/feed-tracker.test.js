import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createFeedingSession,
  finishFeedingSession,
  formatTime,
  getDurationMinutes,
} from '../feed-tracker.js';

test('formatTime renders a 24-hour time', () => {
  assert.equal(formatTime(new Date('2026-10-08T08:05:00')), '08:05');
});

test('starting a breast session records the start time', () => {
  const started = createFeedingSession('L', new Date('2026-10-08T08:05:00'));

  assert.deepEqual(started, {
    breast: 'L',
    startedAt: new Date('2026-10-08T08:05:00'),
    status: 'active',
  });
});

test('finishing a session calculates duration and returns a summary', () => {
  const active = createFeedingSession('R', new Date('2026-10-08T08:05:00Z'));
  const finished = finishFeedingSession(active, new Date('2026-10-08T08:37:00Z'));

  assert.equal(finished.status, 'finished');
  assert.equal(finished.durationMinutes, 32);
  assert.equal(finished.endedAt.toISOString(), '2026-10-08T08:37:00.000Z');
  assert.equal(getDurationMinutes(active.startedAt, finished.endedAt), 32);
});

test('finishing without an active session is rejected', () => {
  assert.throws(
    () => finishFeedingSession(null, new Date('2026-10-08T08:37:00')),
    /No active feeding session/,
  );
});
