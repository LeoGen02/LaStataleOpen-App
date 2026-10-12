// Statale Open — service worker: l'app si apre anche senza rete e si aggiorna da sola.
// Solo i file dell'app passano da qui; le richieste al portale e a GitHub vanno sempre in rete.
var CACHE = "statale-open-v1.2.0";
var SHELL = ["./", "index.html", "app.css", "core.js", "app.js", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) { return cache.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// Prima la rete (così ogni modifica pubblicata arriva subito), poi la copia salvata se si è offline.
self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(request).then(function (response) {
    if (response.ok) {
      var copy = response.clone();
      caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
    }
    return response;
  }).catch(function () {
    return caches.match(request).then(function (cached) { return cached || caches.match("index.html"); });
  }));
});

// Tocco su una notifica: riapre l'app.
self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: "window" }).then(function (list) {
    for (var i = 0; i < list.length; i++) if ("focus" in list[i]) return list[i].focus();
    return self.clients.openWindow("./");
  }));
});
