// =========================================================================
// Lưu giao diện trên máy để web app mở nhanh / cài được lên điện thoại.
// PHẠM VI: chỉ thư mục phan_hoi/ — KHÔNG đụng trang Vận Hành, Kiểm Hàng.
// Dữ liệu Google (đơn, kích thước, nộp phản hồi) KHÔNG đi qua bộ nhớ này.
// Mỗi lần sửa file trong phan_hoi/ phải TĂNG số phiên bản dưới đây.
// =========================================================================
const TEN_BO_NHO = "phan-hoi-kt-v3";
const CAC_FILE = ["./", "index.html", "app.js", "cau_hinh.js", "styles.css", "manifest.webmanifest",
  "icon-180.png", "icon-192.png", "icon-512.png", "may_quet_qr_worker.js", "vendor/zxing-reader.js", "vendor/zxing_reader.wasm"];

self.addEventListener("install", function (su) {
  su.waitUntil(caches.open(TEN_BO_NHO).then(function (b) { return b.addAll(CAC_FILE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (su) {
  su.waitUntil(caches.keys().then(function (ds) {
    return Promise.all(ds.filter(function (t) { return t.indexOf("phan-hoi-kt-") === 0 && t !== TEN_BO_NHO; }).map(function (t) { return caches.delete(t); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (su) {
  const yc = su.request;
  const url = new URL(yc.url);
  if (yc.method !== "GET" || url.origin !== self.location.origin) return; // Google, Apps Script: đi thẳng mạng
  // Có mạng thì luôn lấy bản mới (sửa code là có hiệu lực ngay); mất mạng mới dùng bản đã lưu
  su.respondWith(fetch(yc).then(function (ph) {
    if (ph.ok) { const sao = ph.clone(); caches.open(TEN_BO_NHO).then(function (b) { b.put(yc, sao); }); }
    return ph;
  }).catch(function () {
    return caches.match(yc, { ignoreSearch: true });
  }));
});
