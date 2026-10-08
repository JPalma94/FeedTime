import {
  createFeedingSession,
  finishFeedingSession,
  formatElapsedTimeSince,
  formatTime,
} from './feed-tracker.js';
import {
  addDoc,
  collection,
  db,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  startAfter,
} from './firebase.js';

const PAGE_SIZE = 50;
const buttons = [...document.querySelectorAll('.breast-button')];
const bathroomButtons = [...document.querySelectorAll('.bathroom-button')];
const logList = document.querySelector('#log-list');
const toast = document.querySelector('#toast');
const installButton = document.querySelector('#install-button');
const lastFeedTime = document.querySelector('#last-feed-time');
const loadOlderButton = document.querySelector('#load-older');

const activeSessions = new Map();
let latestEntries = [];
let olderEntries = [];
let olderCursor = null;
let hasMoreEntries = false;
let hasStartedPaging = false;
let isLoadingOlder = false;
let deferredInstallPrompt = null;
let toastTimer;

function createEntryElement(entry) {
  const item = document.createElement('article');
  item.className = `log-entry ${entry.type}`;

  const time = document.createElement('time');
  time.dateTime = entry.timestamp;
  time.textContent = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(entry.timestamp));

  const message = document.createElement('p');
  const messageText = entry.type === 'start'
    ? entry.message.replace(/\s+at \d{1,2}:\d{2}(?=\.)/, '')
    : entry.message;
  const messageParts = messageText.split(/(\b(?:left|right)\b|\b\d+\s+minutes?\b|\b\d{1,2}:\d{2}\b)/i);
  messageParts.forEach((part) => {
    if (/^(?:\b(?:left|right)\b|\b\d+\s+minutes?\b|\b\d{1,2}:\d{2}\b)$/i.test(part)) {
      const emphasized = document.createElement('strong');
      emphasized.textContent = part;
      message.append(emphasized);
    } else {
      message.append(document.createTextNode(part));
    }
  });

  const details = document.createElement('div');
  details.className = 'log-details';
  details.append(time, message);

  const deleteButton = document.createElement('button');
  deleteButton.className = 'delete-entry';
  deleteButton.type = 'button';
  deleteButton.setAttribute('aria-label', 'Delete log entry');
  deleteButton.title = 'Delete log entry';
  deleteButton.textContent = '×';
  deleteButton.addEventListener('click', async () => {
    if (!window.confirm('Delete this log entry? This cannot be undone.')) return;

    deleteButton.disabled = true;
    try {
      await deleteDoc(doc(db, 'entries', entry.id));
      latestEntries = latestEntries.filter((loadedEntry) => loadedEntry.id !== entry.id);
      olderEntries = olderEntries.filter((loadedEntry) => loadedEntry.id !== entry.id);
      renderLog();
      updateLastFeedTime();
    } catch (error) {
      console.error('Could not delete the Firestore log entry.', error);
      showToast('Could not delete the entry. Check your connection and try again.');
      deleteButton.disabled = false;
    }
  });

  item.append(details, deleteButton);
  return item;
}

function renderLog() {
  logList.replaceChildren();
  const loadedEntries = getLoadedEntries();

  if (loadedEntries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<span class="empty-icon" aria-hidden="true">✦</span><p>Your feeding entries will appear here.</p>';
    logList.append(empty);
    updateLoadOlderButton();
    updateLastFeedTime();
    return;
  }

  loadedEntries.forEach((entry) => logList.append(createEntryElement(entry)));
  updateLoadOlderButton();
  updateLastFeedTime();
}

function getLoadedEntries() {
  return [...new Map(
    [...latestEntries, ...olderEntries].map((entry) => [entry.id, entry]),
  ).values()].sort((first, second) => second.timestamp.localeCompare(first.timestamp));
}

function updateLoadOlderButton() {
  loadOlderButton.hidden = !hasMoreEntries;
  loadOlderButton.disabled = isLoadingOlder;
  loadOlderButton.textContent = isLoadingOlder ? 'Loading…' : 'Load older entries';
}

async function loadOlderEntries() {
  if (isLoadingOlder || !hasMoreEntries || !olderCursor) return;

  isLoadingOlder = true;
  hasStartedPaging = true;
  updateLoadOlderButton();

  try {
    const olderQuery = query(
      collection(db, 'entries'),
      orderBy('timestamp', 'desc'),
      startAfter(olderCursor),
      limit(PAGE_SIZE),
    );
    const snapshot = await getDocs(olderQuery);
    olderEntries = [
      ...olderEntries,
      ...snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })),
    ];
    if (snapshot.docs.length > 0) {
      olderCursor = snapshot.docs[snapshot.docs.length - 1];
    }
    hasMoreEntries = snapshot.docs.length === PAGE_SIZE;
    renderLog();
  } catch (error) {
    console.error('Could not load older Firestore entries.', error);
    showToast('Could not load older entries. Check your connection and try again.');
  } finally {
    isLoadingOlder = false;
    updateLoadOlderButton();
  }
}

function updateLastFeedTime() {
  if (activeSessions.size > 0) {
    lastFeedTime.textContent = 'A feed is in progress';
    return;
  }

  const lastCompletedFeed = getLoadedEntries().find((entry) => entry.type === 'finish');
  if (lastCompletedFeed) {
    lastFeedTime.textContent = formatElapsedTimeSince(new Date(lastCompletedFeed.timestamp));
    return;
  }

  lastFeedTime.textContent = hasMoreEntries
    ? 'Load older entries to find the last feed'
    : 'No completed feeds yet';
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('show');
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 4200);
}

function updateButton(button, session) {
  const isActive = Boolean(session);
  button.classList.toggle('is-active', isActive);
  button.setAttribute('aria-pressed', String(isActive));
  button.querySelector('.button-status').textContent = isActive ? 'Tap to finish' : 'Tap to start';
}

async function addEntry(entry) {
  await addDoc(collection(db, 'entries'), entry);
}

async function handleBreastClick(event) {
  const button = event.currentTarget;
  const breast = button.dataset.breast;
  const now = new Date();
  button.disabled = true;

  try {
    const message = await runTransaction(db, async (transaction) => {
      const sessionRef = doc(db, 'activeSessions', breast);
      const sessionSnapshot = await transaction.get(sessionRef);

      if (sessionSnapshot.exists()) {
        const activeSession = createFeedingSession(
          breast,
          new Date(sessionSnapshot.data().startedAt),
        );
        const finishedSession = finishFeedingSession(activeSession, now);
        const duration = finishedSession.durationMinutes;
        const durationText = duration === 1 ? '1 minute' : `${duration} minutes`;
        const message = `Feeding finished on the ${breast === 'L' ? 'left' : 'right'} breast. It lasted ${durationText}.`;

        transaction.delete(sessionRef);
        transaction.set(doc(collection(db, 'entries')), {
          type: 'finish',
          breast,
          message,
          timestamp: now.toISOString(),
          durationMinutes: duration,
        });
        return message;
      }

      const session = createFeedingSession(breast, now);
      const message = `Feeding started on the ${breast === 'L' ? 'left' : 'right'} breast.`;

      transaction.set(sessionRef, { startedAt: session.startedAt.toISOString() });
      transaction.set(doc(collection(db, 'entries')), {
        type: 'start',
        breast,
        message,
        timestamp: now.toISOString(),
      });
      return message;
    });
    showToast(message);
  } catch (error) {
    console.error('Could not update the feeding session in Firestore.', error);
    showToast('Could not save the feeding session. Check your connection and Firestore setup.');
  } finally {
    button.disabled = false;
  }
}

async function handleBathroomClick(event) {
  const activity = event.currentTarget.dataset.activity;
  const now = new Date();
  const message = `${activity === 'pee' ? 'Pee' : 'Poop'} recorded at ${formatTime(now)}.`;

  try {
    await addEntry({
      type: activity,
      message,
      timestamp: now.toISOString(),
    });
    showToast(message);
  } catch (error) {
    console.error('Could not save the activity in Firestore.', error);
    showToast('Could not save the activity. Check your connection and Firestore setup.');
  }
}

buttons.forEach((button) => button.addEventListener('click', handleBreastClick));
bathroomButtons.forEach((button) => button.addEventListener('click', handleBathroomClick));
loadOlderButton.addEventListener('click', loadOlderEntries);

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;

  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  if (choice.outcome === 'accepted') {
    installButton.hidden = true;
  }
  deferredInstallPrompt = null;
});

window.addEventListener('appinstalled', () => {
  installButton.hidden = true;
  deferredInstallPrompt = null;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // The app still works normally when service workers are unavailable.
    });
  });
}

onSnapshot(
  query(collection(db, 'entries'), orderBy('timestamp', 'desc'), limit(PAGE_SIZE)),
  (snapshot) => {
    const previousLatestEntries = latestEntries;
    latestEntries = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
    if (snapshot.docs.length > 0 && !hasStartedPaging) {
      olderCursor = snapshot.docs[snapshot.docs.length - 1];
    }
    if (hasStartedPaging) {
      const latestIds = new Set(latestEntries.map((entry) => entry.id));
      const olderIds = new Set(olderEntries.map((entry) => entry.id));
      olderEntries.push(...previousLatestEntries.filter((entry) =>
        !latestIds.has(entry.id) && !olderIds.has(entry.id),
      ));
    }
    hasMoreEntries = snapshot.docs.length === PAGE_SIZE || olderEntries.length > 0;
    renderLog();
  },
  (error) => {
    console.error('Could not load the Firestore log.', error);
    showToast('Could not load the shared log. Check your connection and Firestore setup.');
  },
);

onSnapshot(
  collection(db, 'activeSessions'),
  (snapshot) => {
    activeSessions.clear();
    snapshot.forEach((sessionSnapshot) => {
      const breast = sessionSnapshot.id;
      if (!['L', 'R'].includes(breast)) return;
      const startedAt = new Date(sessionSnapshot.data().startedAt);
      if (!Number.isFinite(startedAt.getTime())) return;
      activeSessions.set(breast, createFeedingSession(breast, startedAt));
    });
    buttons.forEach((button) => {
      updateButton(button, activeSessions.get(button.dataset.breast));
    });
    updateLastFeedTime();
  },
  (error) => {
    console.error('Could not load active feeding sessions from Firestore.', error);
    showToast('Could not load feeding sessions. Check your connection and Firestore setup.');
  },
);

window.setInterval(updateLastFeedTime, 60_000);
renderLog();
