// =========================================================================
// BỘ ĐỌC MÃ QR — chạy ở luồng riêng để màn hình không giật
// Dùng ZXing WASM 3.1.6 (giấy phép MIT, chép từ dự án Kiểm Hàng Chụp Hình, thư mục vendor/).
// Dùng cho máy KHÔNG có bộ đọc sẵn của trình duyệt (iPhone, máy tính). Android dùng BarcodeDetector.
// =========================================================================
/* global ZXingWASM */
importScripts("vendor/zxing-reader.js");

ZXingWASM.prepareZXingModule({
  overrides: {
    locateFile: function (duongDan, tienTo) {
      return duongDan.endsWith(".wasm") ? "vendor/" + duongDan : tienTo + duongDan;
    },
  },
});

self.onmessage = function (su) {
  const d = su.data;
  ZXingWASM.readBarcodes(new ImageData(new Uint8ClampedArray(d.buffer), d.rong, d.cao), {
    formats: ["QRCode"],
    tryHarder: true,
    tryRotate: true,
    tryInvert: false,
    maxNumberOfSymbols: 1,
  }).then(function (kq) {
    const tot = kq.filter(function (k) { return k.isValid && k.text; })[0];
    self.postMessage({ id: d.id, text: tot ? tot.text : "" });
  }).catch(function () {
    self.postMessage({ id: d.id, text: "" });
  });
};
