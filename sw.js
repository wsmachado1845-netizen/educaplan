// EducaPlan — Service Worker
// Cache simples do "app shell" para permitir abrir o app mesmo sem internet.
const CACHE_NAME = "educaplan-cache-v70";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// Estratégia: tenta a rede primeiro (pra sempre pegar a versão mais nova
// quando online), cai pro cache se estiver offline.
//
// v4.8 — duas correções importantes:
//
// 1) Só cuidamos dos arquivos DO PRÓPRIO APP. Chamadas para outros domínios
//    (API do Claude, Google Drive) passam direto. Antes elas também entravam
//    aqui e, quando falhavam, o service worker respondia com o index.html
//    guardado — com status 200. O app recebia uma página HTML no lugar da
//    resposta da API e concluía coisas erradas ("a conta não retornou nenhum
//    modelo") em vez de dizer que a rede tinha bloqueado a chamada.
//
// 2) O index.html só é servido como reserva para NAVEGAÇÃO (abrir o app sem
//    internet). Para os demais arquivos, se não houver cópia guardada, o erro
//    é o erro mesmo — devolver uma página HTML no lugar de um .png ou .json
//    só mascara o problema.
self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;

  var mesmaOrigem = false;
  try { mesmaOrigem = new URL(req.url).origin === self.location.origin; } catch (e) {}
  if (!mesmaOrigem) return;

  event.respondWith(
    fetch(req)
      .then(function (response) {
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(req, copy);
        });
        return response;
      })
      .catch(function () {
        return caches.match(req).then(function (cached) {
          if (cached) return cached;
          if (req.mode === "navigate") return caches.match("./index.html");
          return Response.error();
        });
      })
  );
});
