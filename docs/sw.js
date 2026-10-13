// Statale Open — service worker: l'app si apre anche senza rete e si aggiorna da sola.
// Solo i file dell'app passano da qui; le richieste al portale e a GitHub vanno sempre in rete.
var CACHE = "statale-open-v1.3.0";
var SHELL = ["./", "index.html", "app.css", "core.js", "app.js", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) { return cache.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// Prima la rete (così ogni modifica pubblicata arriva subito), ma senza aspettarla troppo: se la pagina non arriva entro
// 2,5 secondi (rete debole) si apre la copia salvata, e anche i suoi file vengono dalla copia, così app.js e core.js sono
// sempre della stessa versione; intanto la rete aggiorna la copia per l'apertura successiva. Offline, la copia.
var WAIT = 2500;
var savedPages = []; // schede aperte dalla copia salvata (FetchEvent.resultingClientId)
self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  var navigate = request.mode === "navigate";
  var network = fetch(request).then(function (response) {
    if (response.ok) {
      var copy = response.clone();
      return caches.open(CACHE).then(function (cache) { return cache.put(request, copy); }).then(function () { return response; }, function () { return response; });
    }
    return response;
  });
  // Anche quando risponde la copia, la rete finisce di aggiornarla.
  event.waitUntil(network.catch(function () { /* offline */ }));
  function saved() {
    return caches.match(request).then(function (cached) { return cached || (navigate ? caches.match("index.html") : undefined); });
  }
  // File di una pagina aperta dalla copia: dalla copia anche loro.
  if (!navigate && event.clientId && savedPages.indexOf(event.clientId) >= 0) {
    event.respondWith(saved().then(function (cached) { return cached || network; }));
    return;
  }
  event.respondWith(new Promise(function (resolve, reject) {
    var done = false, timer = null;
    function useSaved() {
      return saved().then(function (cached) {
        if (!cached || done) return false;
        done = true;
        if (navigate && event.resultingClientId) {
          savedPages.push(event.resultingClientId);
          if (savedPages.length > 20) savedPages.shift();
        }
        resolve(cached);
        return true;
      });
    }
    // Il limite vale per la pagina; i suoi file aspettano la rete (stessa versione della pagina) e usano la copia solo offline.
    if (navigate) timer = setTimeout(useSaved, WAIT);
    network.then(function (response) {
      clearTimeout(timer);
      if (!done) { done = true; resolve(response); }
    }, function (error) {
      clearTimeout(timer);
      useSaved().then(function (ok) { if (!ok && !done) { done = true; reject(error); } });
    });
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
