# FeedTime

A lightweight, installable PWA for recording baby feeding times. Feeding and bathroom entries and in-progress feeding sessions are stored in the shared `feedtime` Firebase Firestore database and synced live between users. Firestore's persistent local cache keeps previously loaded data available offline and supports multiple tabs on a device. Bathroom log writes can sync after reconnecting; starting or finishing a feeding needs a connection because it uses a Firestore transaction to keep both users' session state consistent.

## Firebase setup

The app uses the Firebase web configuration in `firebase.js`. Web API keys identify the Firebase project; they are not database access controls. Firestore security rules control access.

To enable the app:

1. In the Firebase Console for project `feedtime`, create a Firestore database.
2. In Firestore **Rules**, publish the rules from `firestore.rules`.
3. Enable GitHub Pages for the repository and open the published site.

**Important:** These rules intentionally allow anyone on the internet to read, add, change, or delete the app's Firestore data. A private or unlisted GitHub Pages URL does not restrict database access. Do not store sensitive information in this database. For private data, add Firebase Authentication and restrict the rules to signed-in users.

## Run locally

```sh
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## Verify

```sh
npm test
npm run check
```
