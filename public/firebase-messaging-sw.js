importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'YOUR_API_KEY',
  authDomain:        'YOUR_PROJECT.firebaseapp.com',
  projectId:         'YOUR_PROJECT',
  storageBucket:     'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId:             'YOUR_APP_ID',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  if (!title) return;
  self.registration.showNotification(title, {
    body:  body ?? '',
    icon:  '/favicon.ico',
    badge: '/favicon.ico',
    data:  payload.data,
  });
});
