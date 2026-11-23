// =========================================================================
// PHIẾU GỘP — PHẦN DỰNG FILE IN (23/11). Chỉ được nạp khi công tắc BAT_PHIEU_GOP ☑ (xem cau_dao_phieu_gop.js).
// 1 tờ giấy in nhiệt 99 × 154 mm:
//   • Nửa trên = trang nhãn sàn GỐC (PDF Shopee / TikTok) xoay ngang 90°, thu cho vừa bề ngang (chừa 2 mm mép giấy).
//     Nhúng NGUYÊN trang bằng pdf-lib embedPage (nét vẽ gốc — mã vạch / QR giữ nguyên), chỉ cắt phần LỀ TRẮNG quanh nội dung.
//   • Nửa dưới = tờ đơn lấy hàng của ĐÚNG đơn đó (lấy từ tờ đơn nút "Tạo mẫu in" vừa tạo). Từ 23/11 tối (bước 2, chủ dự án
//     duyệt hình mẫu): đầu tờ "MVĐ · MĐH · [TỜ 1/N]" 1 dòng; phần hàng = DANH SÁCH (mỗi mã 2 dòng căn trái: SL | Mã · Vị trí · KTGH /
//     Tên) thay bảng; chân tờ = phần sau bảng của tờ đơn gốc thu theo TL_PHIEU_GOP, "Thùng" + "Tổng tiền" cùng 1 dòng. KHÔNG QR.
//   • MVĐ trống → tự điền từ MÃ VẠCH + QR trên nhãn (cả 2 trùng nhau mới điền) — thư viện ZXing nhúng sẵn thu_vien_ma_vach.js.
//   • Đơn dài → tờ tiếp (dải "TIẾP THEO — ĐƠN … TỜ x/N", "▼ CÒN TIẾP", "■ HẾT ĐƠN"); phiếu sàn nhiều trang → mỗi trang 1 tờ.
//   • Tờ đơn được chụp thành ảnh (html2canvas — trang Vận Hành đã nạp sẵn 1.4.1) rồi ghép với nhãn vào 1 file PDF.
// KHÔNG đọc / ghi Google Sheet, KHÔNG gọi file nào của PDF trang vận hành (sap_xep_phieu/).
// =========================================================================
(function () {
  "use strict";
  if (window.DungPhieuGop) return;

  const URL_PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  const URL_PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const URL_PDFLIB = "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js";
  const MM = 72 / 25.4;
  const GIAY_W_MM = 99, GIAY_H_MM = 154;          // giấy in nhiệt thật (chủ dự án đo 23/11)
  const GIAY_W = GIAY_W_MM * MM, GIAY_H = GIAY_H_MM * MM;
  const LE_MM = 2;                                 // chừa mép giấy (chủ dự án chốt 2 mm)
  const LE_NHAN = 2;                               // điểm chừa quanh vùng có nội dung khi cắt lề trắng của nhãn
  const QR_MM = 10;                                // QR mã đơn (chủ dự án chốt 10 mm)
  const DPI = 400;                                 // độ nét ảnh tờ đơn — 23/11 tối chủ dự án hạ 600 → 400 dpi để thử tốc độ (vẫn gấp đôi máy in nhiệt 203 dpi)
  const CHAT_LUONG_JPEG = 0.92;                    // ảnh tờ đơn JPEG (chữ đen trên nền trắng ở 600 dpi — không thấy vết nén khi in nhiệt)
  const RONG_TO_DON_MM = GIAY_W_MM - 6;            // bề ngang tờ đơn sau khi thu (lề trái/phải 3 mm)

  // ── 23/11 tối (máy nhà, chủ dự án duyệt hình mẫu bản 4): phần hàng = DANH SÁCH thay BẢNG.
  //    Mỗi mã 2 dòng căn trái: cột SL riêng | dòng 1: Mã hàng · (cách 5 mm) · Vị trí · KTGH sát phải | dòng 2: Tên.
  //    Đầu tờ "MVĐ: … MĐH: … [TỜ 1/N]" 1 dòng; chân tờ "Thùng: …" + "Tổng tiền: …" chung 1 dòng.
  //    Đây là cài đặt MẶC ĐỊNH — bước 4 sẽ đọc thêm từ tab PHIEU_GOP (trang 🎨 Mẫu phiếu gộp).
  const CAU_HINH_MAC_DINH = {
    ma:    { co: 13,   dam: true,  phong: "Arial" },     // Mã hàng
    sl:    { co: 15,   dam: true,  phong: "Arial" },     // Số lượng
    viTri: { co: 12,   dam: true,  phong: "Segoe UI" },  // Vị trí kho
    ktgh:  { co: 10.5, dam: true,  phong: "Segoe UI" },  // KTGH
    ten:   { co: 9.5,  dam: false, phong: "Segoe UI" },  // Tên sản phẩm
    khoanhTron: true,        // SL > 1 khoanh tròn
    duongKe: true,           // đường kẻ ngăn giữa các mã
    hienKtgh: true,          // hiện KTGH (tên thùng → D×R×C → trống)
    nhanTong: "Tổng tiền:",  // chữ nhãn tổng tiền (thay "Total Price:" của mẫu — chỉ trên phiếu gộp)
    dongThung: "ten_kt",     // ten_kt = "Thùng: [N3 20×10×10]" · ten = "Thùng: N3" · an = ẩn
  };
  // Mã vận đơn hợp lệ (đọc từ mã vạch / QR trên nhãn): Shopee SPXVN…, TikTok / GHN… VN…
  const MAU_MVD = /^(SPXVN\d{8,}[A-Z]?|VN[A-Z]{2,4}\d{8,}[A-Z]?)$/;
  const URL_MA_VACH = (function () { // thư viện đọc mã (ZXing nhúng sẵn) — cùng thư mục với file này
    const s = document.currentScript && document.currentScript.src;
    return s ? s.replace(/[^/]*$/, "") + "thu_vien_ma_vach.js" : "phieu_gop/thu_vien_ma_vach.js";
  })();

  // ── Quy tắc in của tờ đơn: CHÉP NGUYÊN khối @media print THỨ NHẤT trong style.css (mở bằng file:/// trình duyệt
  //    không cho đọc style.css bằng JavaScript). Bài kiểm thu_phieu_gop.mjs so khối này với style.css — lệch là báo.
  const CSS_IN_GOC = "@page { size: A6; margin: 5mm; scale: 80; } body { margin: 0; padding: 0; background: #fff; color: #000; font-size: 11px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } .modal-overlay, .gs-tab-bar { display: none !important; } .no-print, .cell-actions, .table-panel th:last-child { display: none !important; } #print-only-zone { display: block !important; width: 100%; } .page-break { page-break-after: always; break-after: page; } .invoice-box { border: none !important; padding: 10px !important; margin-bottom: 15px; background: #fff !important; color: #000 !important; box-sizing: border-box; width: 100%; } .invoice-head { display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid #111; padding-bottom: 5px; color: #000 !important; } .invoice-head .oid-value { font-weight: 800; font-size: 16px; } table.inv-table { width: 100%; border-collapse: collapse; background: #fff !important; color: #000 !important; } table.inv-table th { border: 2px solid #111 !important; padding: 6px !important; background: #ffffff !important; color: #000 !important; font-weight: normal !important; } table.inv-table td { border: 1px solid #111 !important; padding: 6px !important; background: #fff !important; color: #000 !important; } table.inv-table th:nth-child(1), table.inv-table td:nth-child(1), table.inv-table th:nth-child(2), table.inv-table td:nth-child(2), table.inv-table th:nth-child(4), table.inv-table td:nth-child(4) { width: 1%; white-space: nowrap; } table.inv-table th:nth-child(5), table.inv-table td:nth-child(5) { width: 5%; min-width: 30px; } table.inv-table th:nth-child(3), table.inv-table td:nth-child(3) { width: auto; font-size: 11px; word-break: break-word; } table.inv-table th:nth-child(2), table.inv-table td.i-sku { font-size: 15px !important; font-weight: bold !important; font-family: \"Arial\", sans-serif; } table.inv-table th:nth-child(4), table.inv-table td:nth-child(4) { font-size: 15px; font-weight: normal !important; } table.inv-table th:nth-child(1), table.inv-table td:nth-child(1) { font-size: 20px !important; font-weight: bold; text-align: center; } .circle-qty { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border: 2px solid #000; border-radius: 50%; font-size: 15px; font-weight: normal !important; } .inv-total { text-align: right; margin-top: 10px; font-weight: bold; font-size: 14px; color: #000 !important; } .inv-total .num { font-size: 16px; margin-left: 5px; }";

  // ---------------------------------------------------------------------------------------------------
  // Nạp thư viện PDF (cùng phiên bản PDF trang vận hành) — chỉ nạp khi cần
  let dangNap = null;
  function napScript(url) {
    return new Promise(function (ok, loi) {
      const s = document.createElement("script"); s.src = url; s.onload = ok;
      s.onerror = function () { loi(new Error("Không tải được thư viện PDF (kiểm tra mạng)")); };
      document.head.appendChild(s);
    });
  }
  function napThuVien() {
    if (window.pdfjsLib && window.PDFLib) return Promise.resolve();
    if (!dangNap) {
      dangNap = Promise.all([window.pdfjsLib ? null : napScript(URL_PDFJS), window.PDFLib ? null : napScript(URL_PDFLIB)])
        .then(function () { window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL_PDFJS_WORKER; })
        .catch(function (e) { dangNap = null; throw e; });
    }
    return dangNap;
  }

  // ---------------------------------------------------------------------------------------------------
  // Đọc 1 file PDF nhãn: chữ từng trang (ghép mẩu chữ thành dòng), cụm chữ để ghép mã đơn, vân tay trang, ảnh nhỏ,
  // vùng có nội dung (gộp mọi trang) để cắt lề trắng.
  function ghepDong(items) {
    const ds = items.filter(function (x) { return x.str && x.str.trim(); }).map(function (x) {
      return { s: x.str, x: x.transform[4], y: x.transform[5], w: x.width || 0, h: Math.abs(x.transform[3]) || 8 };
    });
    ds.sort(function (a, b) { return Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x - b.x; });
    const dong = []; let cur = null;
    ds.forEach(function (m) {
      if (!cur || Math.abs(m.y - cur.y) > Math.max(2, m.h * 0.35)) { cur = { y: m.y, ds: [] }; dong.push(cur); }
      cur.ds.push(m);
    });
    return dong.map(function (d) {
      d.ds.sort(function (a, b) { return a.x - b.x; });
      let s = "", cuoi = null;
      d.ds.forEach(function (m) { if (cuoi !== null && m.x - cuoi > Math.max(1.5, m.h * 0.2)) s += " "; s += m.s; cuoi = m.x + m.w; });
      return s;
    }).join("\n");
  }
  function vanTay(chu) { // 2 lần FNV-1a 32 bit trên chữ đã bỏ khoảng trắng → chuỗi ngắn
    const s = chu.replace(/\s+/g, "");
    let a = 0x811c9dc5, b = 0x01000193 ^ s.length;
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 16777619) >>> 0; b = Math.imul(b ^ c, 2246822519) >>> 0; }
    return a.toString(36) + b.toString(36);
  }
  async function docPdf(bytes, ten, khiTienDo) {
    await napThuVien();
    const pdf = await window.pdfjsLib.getDocument({ data: bytes.slice() }).promise;
    const trang = []; let hop = null;
    for (let p = 1; p <= pdf.numPages; p++) {
      const pg = await pdf.getPage(p);
      const vp1 = pg.getViewport({ scale: 1 });
      const TL = 1.5, vp = pg.getViewport({ scale: TL });
      const cv = document.createElement("canvas"); cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
      const cx = cv.getContext("2d", { willReadFrequently: true }); cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height);
      await pg.render({ canvasContext: cx, viewport: vp }).promise;
      const dt = cx.getImageData(0, 0, cv.width, cv.height).data;
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
        const k = (y * cv.width + x) * 4; if (dt[k] < 235 || dt[k + 1] < 235 || dt[k + 2] < 235) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 >= 0) {
        const b = { l: x0 / TL, r: (x1 + 1) / TL, t: y0 / TL, bt: (y1 + 1) / TL };
        hop = hop ? { l: Math.min(hop.l, b.l), r: Math.max(hop.r, b.r), t: Math.min(hop.t, b.t), bt: Math.max(hop.bt, b.bt) } : b;
      }
      // ảnh nhỏ cho danh sách
      const nho = document.createElement("canvas"); const tn = 120 / cv.width; nho.width = 120; nho.height = Math.round(cv.height * tn);
      nho.getContext("2d").drawImage(cv, 0, 0, nho.width, nho.height);
      const tc = await pg.getTextContent();
      const chu = ghepDong(tc.items);
      const cum = Array.from(new Set(chu.toUpperCase().match(/[A-Z0-9]+(?:-[A-Z0-9]+)*/g) || []));
      const mvd = (chu.match(/\b(SPXVN\w{6,}|VNGH\w{6,}|GHN\w{6,}|VTP\w{6,}|JNT\w{6,}|\d{12,14})\b/) || [])[1] || "";
      trang.push({ p: p, w: vp1.width, h: vp1.height, cum: cum, vanTay: vanTay(chu), anh: nho.toDataURL("image/jpeg", 0.7), mvd: mvd });
      if (khiTienDo) khiTienDo(p, pdf.numPages);
    }
    try { pdf.destroy(); } catch (e) { /* bỏ qua */ }
    return { ten: ten, bytes: bytes, trang: trang, hop: hop };
  }

  // ---------------------------------------------------------------------------------------------------
  // Dựng tờ (HTML ẩn ngoài màn hình) → chụp ảnh → ghép PDF
  function phamViCss(css, goc) { // thêm "#goc " trước mọi bộ chọn của khối quy tắc in (để KHÔNG ảnh hưởng màn hình)
    return css.replace(/@page\s*{[^}]*}/g, "").replace(/([^{}]+){([^{}]*)}/g, function (_, chon, khai) {
      const ds = chon.split(",").map(function (c) { c = c.trim(); if (!c) return ""; if (/^(html|body)$/i.test(c)) return goc; return goc + " " + c; }).filter(Boolean);
      return ds.length ? ds.join(",") + "{" + khai + "}\n" : "";
    });
  }
  function cssTo(tl, nhanCaoPt) {
    return "#pg-dung{position:fixed;left:-30000px;top:0;width:" + GIAY_W_MM + "mm;background:#fff;color:#000;font-size:11px;" +
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}\n" +
      phamViCss(CSS_IN_GOC, "#pg-dung") +
      "#pg-dung .btn-copy-don{display:none!important}\n" +
      "#pg-dung .pg-to{width:" + GIAY_W_MM + "mm;height:" + GIAY_H_MM + "mm;position:relative;overflow:hidden;box-sizing:border-box;background:#fff}\n" +
      "#pg-dung .pg-cho-nhan{height:" + nhanCaoPt.toFixed(2) + "pt;border-bottom:1px dashed #000;box-sizing:border-box}\n" +
      "#pg-dung .pg-vung{position:absolute;left:0;right:0;padding:0 3mm;box-sizing:border-box;overflow:hidden}\n" +
      "#pg-dung .pg-vung .invoice-box{transform:scale(" + tl + ");transform-origin:0 0;width:" + (RONG_TO_DON_MM / tl).toFixed(2) + "mm!important;" +
      "padding:2mm 0 0!important;margin:0!important;border:none!important;box-shadow:none!important;box-sizing:border-box}\n" +
      "#pg-dung .pg-dau-to{display:flex;justify-content:space-between;align-items:center;gap:4px;font-weight:700;font-size:15px;border:2px solid #000;" +
      "padding:1px 6px;margin-bottom:4px;white-space:nowrap}\n" +
      "#pg-dung .pg-dau-to span:first-child{overflow:hidden}\n#pg-dung .pg-dau-to .pg-so-to{font-size:19px}\n" +
      "#pg-dung .pg-chan{position:absolute;left:3mm;right:3mm;bottom:" + LE_MM + "mm;display:flex;gap:2mm;align-items:flex-end;border-top:1px solid #000;" +
      "padding-top:1mm;box-sizing:border-box}\n" +
      "#pg-dung .pg-trai{flex:1;min-width:0;position:relative}\n" +
      "#pg-dung .pg-trai-in{transform:scale(" + tl + ");transform-origin:0 0;width:" + (100 / tl).toFixed(3) + "%}\n" +
      "#pg-dung .pg-trai-in>*{margin-top:0!important}\n" +
      "#pg-dung .pg-trai-in .inv-total{text-align:left!important}\n" +
      "#pg-dung .pg-thung{font-weight:700;font-size:13px;margin:2px 0}\n" +
      "#pg-dung .pg-con-tiep{font-weight:700;font-size:12px}\n#pg-dung .pg-het-don{font-weight:700;font-size:11px;margin-top:1mm}\n" +
      "#pg-dung .pg-qr{width:" + QR_MM + "mm;height:" + QR_MM + "mm;flex:none}\n#pg-dung .pg-qr svg{width:100%;height:100%;display:block}\n" +
      cssDanhSach(tl, CAU_HINH_MAC_DINH);
  }
  // Chữ: chỉ độ đậm 400 / 700 (800 → Chrome chọn "Arial Black" không có chữ Việt); phông dự phòng Arial
  function kieuChu(o) {
    return "font-size:" + o.co + "px;font-weight:" + (o.dam ? 700 : 400) + ";font-family:'" + String(o.phong).replace(/'/g, "") + "',Arial,sans-serif";
  }
  function cssDanhSach(tl, K) {
    const p = function (v) { return (v * tl).toFixed(1) + "px"; };
    return "#pg-dung .pgd-khung{padding-top:1.5mm;box-sizing:border-box}\n" +
      "#pg-dung .pgd-khung .pg-dau-to{font-size:12px}\n#pg-dung .pgd-khung .pg-dau-to .pg-so-to{font-size:15px}\n" +
      // Đầu đơn = mẫu in × tl, 1 dòng: MVĐ · MĐH · [TỜ 1/N]
      "#pg-dung .pgd-dau-don{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;column-gap:6px;row-gap:1px;" +
      "border-bottom:2px solid #000;padding-bottom:" + p(3) + ";margin-bottom:" + p(2) + "}\n" +
      "#pg-dung .pgd-dau-don .pgd-mvd{font-size:" + p(14) + ";white-space:nowrap}\n#pg-dung .pgd-dau-don .pgd-mvd b{font-weight:700}\n" +
      "#pg-dung .pgd-dau-don .pgd-mdh{font-size:" + p(14) + ";font-weight:700;white-space:nowrap}\n" +
      "#pg-dung .pgd-dau-don .pgd-so-to-dau{font-size:" + p(14) + ";font-weight:700;border:2px solid #000;padding:0 4px;white-space:nowrap}\n" +
      // Danh sách: mỗi mã 2 dòng
      "#pg-dung .pgd-mon{display:grid;grid-template-columns:9mm 1fr;column-gap:2.5mm;align-items:center;padding:0.6mm 0;" +
      (K.duongKe ? "border-bottom:1px solid #000;" : "") + "}\n" +
      "#pg-dung .pgd-mon .pgd-sl{" + kieuChu(K.sl) + ";text-align:center;line-height:1}\n" +
      "#pg-dung .pgd-mon .pgd-tron{display:inline-flex;align-items:center;justify-content:center;min-width:" + Math.round(K.sl.co * 1.55) + "px;height:" +
      Math.round(K.sl.co * 1.55) + "px;padding:0 2px;border:1.5px solid #000;border-radius:999px;box-sizing:border-box}\n" +
      "#pg-dung .pgd-mon .pgd-nd{min-width:0}\n" +
      "#pg-dung .pgd-mon .pgd-d1{display:flex;align-items:baseline;column-gap:5mm;flex-wrap:wrap;line-height:1.08}\n" +
      "#pg-dung .pgd-mon .pgd-ma{" + kieuChu(K.ma) + ";overflow-wrap:anywhere}\n" +
      "#pg-dung .pgd-mon .pgd-vt{" + kieuChu(K.viTri) + ";overflow-wrap:anywhere}\n" +
      "#pg-dung .pgd-mon .pgd-kt{margin-left:auto;padding-left:2mm;" + kieuChu(K.ktgh) + ";white-space:nowrap}\n" +
      "#pg-dung .pgd-mon .pgd-d2{" + kieuChu(K.ten) + ";line-height:1.12;margin-top:0.15mm}\n" +
      // Chân tờ: Thùng (trái) + Tổng tiền (phải) cùng 1 dòng
      "#pg-dung .pgd-hang-tong{display:flex;justify-content:space-between;align-items:baseline;gap:3mm;flex-wrap:wrap}\n" +
      "#pg-dung .pgd-hang-tong .inv-total{margin-left:auto!important;margin-top:0!important}\n" +
      "#pg-dung .pgd-hang-tong .pg-thung{margin:0}\n";
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function e(tag, cls, html) { const x = document.createElement(tag); if (cls) x.className = cls; if (html != null) x.innerHTML = html; return x; }
  function qrSvg(ma) {
    if (typeof qrcode !== "function") return "";
    const q = qrcode(0, "M"); q.addData(String(ma)); q.make(); return q.createSvgTag({ cellSize: 2, margin: 0, scalable: true });
  }
  function dongThung(skus) {
    try {
      const K = CAU_HINH_MAC_DINH;
      if (!window.KichThuoc || K.dongThung === "an") return "";
      const th = window.KichThuoc.thungLonNhat(skus); if (!th) return "";
      if (K.dongThung === "ten") return '<div class="pg-thung">Thùng: ' + esc(th) + "</div>";
      const kt = window.KichThuoc.kichThuocThung(th);
      return '<div class="pg-thung">Thùng: [' + esc(th) + (kt ? " " + esc(kt) : "") + "]</div>";
    } catch (er) { return ""; }
  }
  function ktgh(sku) {
    try { return CAU_HINH_MAC_DINH.hienKtgh && window.KichThuoc ? window.KichThuoc.noiDungKtgh(sku) || "" : ""; } catch (er) { return ""; }
  }
  // 1 khối mã hàng (2 dòng)
  function khoiMon(it) {
    const K = CAU_HINH_MAC_DINH;
    const q = String(it.qty);
    const sl = parseInt(q, 10) > 1 && K.khoanhTron ? '<span class="pgd-tron">' + esc(q) + "</span>" : esc(q);
    const kt = ktgh(it.sku);
    return e("div", "pgd-mon", '<div class="pgd-sl">' + sl + '</div><div class="pgd-nd"><div class="pgd-d1"><span class="pgd-ma">' + esc(it.sku) +
      '</span><span class="pgd-vt">' + esc(it.loc) + "</span>" + (kt ? '<span class="pgd-kt">' + esc(kt) + "</span>" : "") +
      '</div><div class="pgd-d2">' + esc(it.name) + "</div></div>");
  }
  // Danh sách hàng của 1 tờ đơn — ĐÚNG thứ tự trên tờ đơn (dòng "[vị trí] mã xSL" trong data-copy-text do script.js tạo,
  // sau khi đã sắp vị trí A→Z). Tên + vị trí lấy từ MISA_DIRECTORY — CÙNG nguồn nút "Tạo mẫu in" dùng.
  function layDanhSach(box) {
    const chu = (box && box.getAttribute("data-copy-text")) || "";
    const misa = window.MISA_DIRECTORY || {};
    const ds = [];
    chu.split("\n").forEach(function (dong) {
      if (/^(📦|🚚|💰|⚠|━)/.test(dong)) return;
      const x = dong.match(/^(?:\[([^\]]*)\]\s*)?(\S.*)\s+x(\S.*?)\s*$/); // SL = phần sau " x" CUỐI (giữ cả "(thiếu SL)")
      if (!x) return;
      const sku = x[2].trim(), m = misa[sku];
      ds.push({ sku: sku, qty: x[3].trim(), loc: (x[1] || "").trim() || (m && m.loc) || "Chưa xếp vị trí", name: (m && m.name) || "Sản phẩm zzm" });
    });
    return ds;
  }

  // don = { ma, vd, box (invoice-box gốc trên màn hình), skus:[...], soSp, soNhan (số trang nhãn) } → các tờ HTML trong goc
  // 23/11 tối: phần hàng = DANH SÁCH (khoiMon) thay bảng; đầu tờ tự dựng "MVĐ · MĐH · [TỜ 1/N]"; chân tờ = phần sau bảng của
  // tờ đơn gốc (Dễ vỡ / tổng tiền…) thu theo tl, "Thùng" + "Tổng tiền" cùng 1 dòng, nhãn tổng tiền = CAU_HINH.nhanTong.
  function chiaDon(goc, don, tl, nhanCaoPt) {
    const LE_PX = LE_MM * 96 / 25.4;
    const K = CAU_HINH_MAC_DINH;
    const ban = don.box.cloneNode(true);
    ban.querySelectorAll(".btn-copy-don,.mi-qr,.mi-thung").forEach(function (x) { x.remove(); }); // bỏ QR + Thùng của mẫu in
    const bang = ban.querySelector("table.inv-table");
    const dsMon = layDanhSach(don.box);
    // phần cuối đơn (Dễ vỡ / tổng tiền / chân đơn…) = mọi khối nằm SAU bảng
    const cuoi = []; let k = bang ? bang.nextElementSibling : null;
    while (k) { cuoi.push(k); k = k.nextElementSibling; }
    const thung = dongThung(don.skus);
    const tongSp = don.soSp;
    // đổi chữ nhãn tổng tiền trên BẢN CHÉP (giữ nguyên con số)
    function doiNhanTong(el) {
      const tong = el.classList && el.classList.contains("inv-total") ? el : (el.querySelector ? el.querySelector(".inv-total") : null);
      if (!tong) return null;
      for (let n = tong.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3 && n.nodeValue.trim()) { n.nodeValue = K.nhanTong; break; }
      }
      return tong;
    }

    function chia(coNhieu) {
      const cacTo = [];
      function datChan(c, cuoiCung) {
        c.trai.innerHTML = "";
        if (cuoiCung) {
          const vo = e("div", "pg-trai-in");
          let daThem = false;
          cuoi.map(function (x) { return x.cloneNode(true); }).forEach(function (x) {
            const tong = doiNhanTong(x);
            if (!daThem && tong) {
              // "Thùng" (trái) + "Tổng tiền" (phải) chung 1 dòng
              const hang = e("div", "pgd-hang-tong", thung);
              if (tong === x) { hang.appendChild(x); vo.appendChild(hang); }
              else { tong.parentNode.insertBefore(hang, tong); hang.appendChild(tong); vo.appendChild(x); }
              daThem = true; return;
            }
            vo.appendChild(x);
          });
          if (thung && !daThem) vo.insertAdjacentHTML("beforeend", thung);
          if (coNhieu) vo.appendChild(e("div", "pg-het-don", "■ HẾT ĐƠN — " + don.skus.length + " mã · " + tongSp + " sản phẩm"));
          c.trai.appendChild(vo);
          c.trai.style.height = (vo.getBoundingClientRect().height) + "px";
        } else {
          c.trai.style.height = "";
          c.trai.appendChild(e("div", "pg-con-tiep", "▼ CÒN TIẾP — XEM TỜ SAU ▼"));
        }
        c.vung.style.bottom = (c.chan.offsetHeight + 2 + LE_PX) + "px";
      }
      function toMoi() {
        const coNhan = cacTo.length < don.soNhan, dauTien = cacTo.length === 0;
        const to = e("div", "pg-to"); if (coNhan) to.appendChild(e("div", "pg-cho-nhan"));
        const chan = e("div", "pg-chan"), trai = e("div", "pg-trai"); chan.appendChild(trai); to.appendChild(chan);
        const vung = e("div", "pg-vung"); vung.style.top = coNhan ? nhanCaoPt.toFixed(2) + "pt" : LE_MM + "mm"; to.appendChild(vung);
        const box = e("div", "pgd-khung"); vung.appendChild(box);
        // tờ đầu: KHÔNG có dải riêng ("TỜ 1/N" nằm cuối dòng đầu đơn); tờ sau: dải "TIẾP THEO — ĐƠN … TỜ x/N"
        const dauTo = e("div", "pg-dau-to", "<span>TIẾP THEO — ĐƠN " + esc(don.ma) + '</span><span class="pg-so-to">TỜ 8/8</span>');
        if (dauTien || !coNhieu) dauTo.style.display = "none";
        box.appendChild(dauTo);
        if (dauTien) box.appendChild(e("div", "pgd-dau-don", '<div class="pgd-mvd"><b>MVĐ:</b> ' + esc(don.vd) + '</div><div class="pgd-mdh">MĐH: ' +
          esc(don.ma) + "</div>" + (coNhieu ? '<div class="pgd-so-to-dau">TỜ 1/8</div>' : "")));
        const ds = e("div", "pgd-ds"); box.appendChild(ds);
        goc.appendChild(to);
        const c = { to: to, vung: vung, box: box, ds: ds, dauTo: dauTo, trai: trai, chan: chan };
        datChan(c, false); cacTo.push(c);
        return c;
      }
      function tran(c) { return c.box.getBoundingClientRect().height > c.vung.getBoundingClientRect().height - 1; }
      let c = toMoi();
      dsMon.forEach(function (it) {
        const kh = khoiMon(it);
        c.ds.appendChild(kh);
        if (tran(c) && c.ds.children.length > 1) { c.ds.removeChild(kh); c = toMoi(); c.ds.appendChild(kh); }
      });
      while (cacTo.length < don.soNhan) toMoi();
      let L = cacTo[cacTo.length - 1]; datChan(L, true);
      if (tran(L) && L.ds.children.length) {
        const doi = [];
        while (tran(L) && L.ds.children.length > 0) { const r = L.ds.lastChild; L.ds.removeChild(r); doi.unshift(r); }
        datChan(L, false); const M = toMoi(); doi.forEach(function (r) { M.ds.appendChild(r); }); datChan(M, true); L = M;
      }
      const N = cacTo.length;
      cacTo.forEach(function (x, i) {
        if (N > 1) {
          if (i > 0) { x.dauTo.style.display = ""; x.dauTo.querySelector(".pg-so-to").textContent = "TỜ " + (i + 1) + "/" + N; }
          else { const sd = x.box.querySelector(".pgd-so-to-dau"); if (sd) sd.textContent = "TỜ 1/" + N; }
        }
        if (i < N - 1) { const ct = x.trai.querySelector(".pg-con-tiep"); if (ct) ct.textContent = "▼ CÒN TIẾP — XEM TỜ " + (i + 2) + "/" + N + " ▼"; }
      });
      // Số tờ DO DANH SÁCH HÀNG (tờ cuối còn món) — dùng cho gợi ý in A4 (bước 3); tờ chỉ chứa trang nhãn thứ 2+ không tính
      let toDoDs = 0; cacTo.forEach(function (x, i) { if (x.ds.children.length) toDoDs = i + 1; });
      // lỗi: còn tràn, HOẶC số mã trong danh sách khác số mã trên tờ đơn (không để mất mã nào)
      const loi = cacTo.some(function (x) { return tran(x); }) || dsMon.length !== don.skus.length;
      return { cacTo: cacTo, N: N, loi: loi, toDoDs: toDoDs };
    }
    let kq = chia(false);
    if (kq.N > 1) { kq.cacTo.forEach(function (x) { x.to.remove(); }); kq = chia(true); }
    return kq;
  }

  // ---------------------------------------------------------------------------------------------------
  // TỰ ĐIỀN MÃ VẬN ĐƠN CÒN TRỐNG (23/11 tối, chủ dự án chốt) — đọc MÃ VẠCH (Code128) + QR trên các trang nhãn của đơn:
  //   (1) điền khi mã vạch và QR đều đọc được, TRÙNG nhau, đúng dạng MVĐ (SPXVN… / VN…);
  //   (2) đơn nhiều trang nhãn → mọi trang CÓ mã phải cùng 1 MVĐ (trang không có mã = trang phụ, bỏ qua);
  //   (3) chữ MVĐ đọc được trên phiếu (nếu có) mà KHÁC → để trống;  (4) chỉ đọc cho đơn đang trống MVĐ.
  //   Có nghi ngờ / lỗi / không nạp được thư viện → để TRỐNG (thà trống còn hơn in sai). Chỉ in lên phiếu gộp —
  //   KHÔNG ghi vào Bảng 3 / LOG / kiểm hàng.
  let dangNapMaVach = null;
  function napMaVach() {
    if (!dangNapMaVach) {
      dangNapMaVach = (window.ZXingWASM ? Promise.resolve() : napScript(URL_MA_VACH)).then(function () {
        if (!window.ZXingWASM || !window.ZXING_WASM_B64) throw new Error("Thiếu thư viện đọc mã");
        const nhiPhan = Uint8Array.from(atob(window.ZXING_WASM_B64), function (c) { return c.charCodeAt(0); });
        return window.ZXingWASM.prepareZXingModule({ overrides: { wasmBinary: nhiPhan.buffer }, fireImmediately: true });
      }).catch(function (er) { dangNapMaVach = null; throw er; });
    }
    return dangNapMaVach;
  }
  async function docMaTrang(pdf, soTrang) { // → { vach: [MVĐ…], qr: [MVĐ…] } (đã lọc đúng dạng, bỏ trùng)
    const pg = await pdf.getPage(soTrang), vp = pg.getViewport({ scale: 3 });
    const cv = document.createElement("canvas"); cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
    const cx = cv.getContext("2d", { willReadFrequently: true }); cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height);
    await pg.render({ canvasContext: cx, viewport: vp }).promise;
    const ds = await window.ZXingWASM.readBarcodes(cx.getImageData(0, 0, cv.width, cv.height),
      { formats: ["Code128", "QRCode"], tryHarder: true, tryRotate: true, maxNumberOfSymbols: 10 });
    cv.width = cv.height = 0;
    const lay = function (loai) {
      return Array.from(new Set(ds.filter(function (m) { return m.isValid && m.format === loai && MAU_MVD.test(String(m.text).trim()); })
        .map(function (m) { return String(m.text).trim(); })));
    };
    return { vach: lay("Code128"), qr: lay("QRCode") };
  }
  async function layMvd(don, moPdf) {
    try {
      await napMaVach();
      let mvd = "";
      for (let i = 0; i < don.nhan.length; i++) {
        const n = don.nhan[i];
        const m = await docMaTrang(await moPdf(n.tep), n.trang.p);
        if (!m.vach.length && !m.qr.length) continue;                               // trang phụ — không có mã
        if (m.vach.length !== 1 || m.qr.length !== 1 || m.vach[0] !== m.qr[0]) return ""; // thiếu 1 loại / lệch / nhiều mã
        if (mvd && mvd !== m.vach[0]) return "";                                    // các trang nhãn khác MVĐ
        mvd = m.vach[0];
        const chu = String(n.trang.mvd || "").trim();                               // MVĐ đọc từ CHỮ trên phiếu (nếu có)
        if (chu && MAU_MVD.test(chu) && chu !== mvd) return "";
      }
      return mvd;
    } catch (er) {
      console.warn("[PhieuGop] Không đọc được mã vận đơn từ mã vạch/QR — để trống:", er);
      return "";
    }
  }

  // dsDon: [{ ma, box, skus, soSp, nhan: [{ tep, p }] }] theo ĐÚNG thứ tự in. tl: tỉ lệ thu tờ đơn (0,5–1).
  // → { bytes (PDF), soTo: [số tờ của từng đơn], tongTo, loi: [mã đơn bị tràn chữ] }
  async function dung(dsDon, tl, khiTienDo) {
    await napThuVien();
    if (typeof window.html2canvas !== "function") throw new Error("Thiếu thư viện chụp ảnh (html2canvas) — tải lại trang");
    const L = window.PDFLib;
    const doc = await L.PDFDocument.create();
    const daNapTep = new Map();
    const layTep = async function (tep) { if (!daNapTep.has(tep)) daNapTep.set(tep, await L.PDFDocument.load(tep.bytes.slice())); return daNapTep.get(tep); };
    const LE = LE_MM * MM;
    const soTo = [], loi = [], toDoDs = [], dienMvd = [];
    let tongTo = 0;
    const pdfDoc = new Map(); // pdf.js của từng file nhãn — chỉ mở khi cần đọc mã vạch
    const moPdfDoc = async function (tep) {
      if (!pdfDoc.has(tep)) pdfDoc.set(tep, window.pdfjsLib.getDocument({ data: tep.bytes.slice() }).promise);
      return pdfDoc.get(tep);
    };
    const goc = e("div"); goc.id = "pg-dung";
    const kieu = document.createElement("style");
    document.head.appendChild(kieu); document.body.appendChild(goc);
    try {
      for (let i = 0; i < dsDon.length; i++) {
        const don = dsDon[i];
        // khổ nhãn của trang đầu → tỉ lệ + chiều cao nửa trên (mọi trang của 1 file dùng chung vùng có nội dung)
        const t0 = don.nhan[0], hop = t0.tep.hop || { l: 0, r: t0.trang.w, t: 0, bt: t0.trang.h };
        const bb = { left: Math.max(0, hop.l - LE_NHAN), right: Math.min(t0.trang.w, hop.r + LE_NHAN),
          bottom: Math.max(0, t0.trang.h - hop.bt - LE_NHAN), top: Math.min(t0.trang.h, t0.trang.h - hop.t + LE_NHAN) };
        const bw = bb.right - bb.left, bh = bb.top - bb.bottom;
        const tlNhan = (GIAY_W - 2 * LE) / bh, nhanCao = LE + bw * tlNhan;
        kieu.textContent = cssTo(tl, nhanCao);
        goc.innerHTML = "";
        let vd = String(don.vd || "").trim();
        if (!/[0-9A-Za-z]/.test(vd)) vd = ""; // không có chữ / số (vd đường kẻ "━━━") = TRỐNG
        if (!vd) { vd = await layMvd(don, moPdfDoc); if (vd) dienMvd.push({ ma: don.ma, mvd: vd }); }
        const kq = chiaDon(goc, { ma: don.ma, vd: vd, box: don.box, skus: don.skus, soSp: don.soSp, soNhan: don.nhan.length }, tl, nhanCao);
        if (kq.loi) loi.push(don.ma);
        toDoDs.push(kq.toDoDs);
        for (let j = 0; j < kq.cacTo.length; j++) {
          // ignoreElements: html2canvas mặc định chép CẢ trang (Bảng 1–3, mọi tờ đơn…) mỗi lần chụp → càng nhiều đơn càng chậm.
          // Chỉ giữ khung dựng #pg-dung + thẻ style/link (bỏ các khối khác ngay dưới <body>).
          // Tờ có nhãn: KHÔNG chụp nửa trên (chỉ là nền trắng chờ nhãn) → ảnh nhỏ gần một nửa, file nhẹ, dựng nhanh hơn.
          const elTo = kq.cacTo[j].to, r = elTo.getBoundingClientRect();
          const catTren = j < don.nhan.length ? Math.max(0, nhanCao * 96 / 72 - 2) : 0; // px CSS (giữ lại đường kẻ đứt ngăn 2 nửa)
          const cv = await window.html2canvas(elTo, { scale: DPI / 96, backgroundColor: "#ffffff", logging: false, useCORS: true,
            ignoreElements: function (el) { return el.parentNode === document.body && el !== goc && el.tagName !== "STYLE" && el.tagName !== "LINK"; } });
          // cắt bỏ phần trắng phía trên NGAY TRÊN ẢNH (tùy chọn cắt x/y của html2canvas sai với khung nằm ngoài màn hình → mất tờ đơn)
          let cvRa = cv;
          if (catTren > 0) {
            const tren = Math.round(cv.height * catTren / r.height);
            cvRa = document.createElement("canvas"); cvRa.width = cv.width; cvRa.height = cv.height - tren;
            const cx2 = cvRa.getContext("2d"); cx2.fillStyle = "#fff"; cx2.fillRect(0, 0, cvRa.width, cvRa.height);
            cx2.drawImage(cv, 0, tren, cv.width, cvRa.height, 0, 0, cvRa.width, cvRa.height);
          }
          // 23/11 tối: JPEG chất lượng cao thay PNG — pdf-lib chép thẳng JPEG (không giải nén / nén lại như PNG) → nhanh gấp nhiều lần
          const jpg = await new Promise(function (ok) { cvRa.toBlob(ok, "image/jpeg", CHAT_LUONG_JPEG); });
          if (cvRa !== cv) cvRa.width = cvRa.height = 0;
          const anh = await doc.embedJpg(new Uint8Array(await jpg.arrayBuffer()));
          const trang = doc.addPage([GIAY_W, GIAY_H]);
          const caoAnh = GIAY_H * (r.height - catTren) / r.height;
          trang.drawImage(anh, { x: 0, y: 0, width: GIAY_W, height: caoAnh });
          if (j < don.nhan.length) {
            const n = don.nhan[j];
            const nguon = await layTep(n.tep);
            const nhan = await doc.embedPage(nguon.getPage(n.trang.p - 1), bb);
            trang.drawPage(nhan, { x: LE + bh * tlNhan, y: GIAY_H - nhanCao, xScale: tlNhan, yScale: tlNhan, rotate: L.degrees(90) });
          }
          cv.width = cv.height = 0;
        }
        soTo.push(kq.N); tongTo += kq.N;
        if (khiTienDo) khiTienDo(i + 1, dsDon.length);
        await new Promise(function (ok) { setTimeout(ok, 0); }); // nhường trình duyệt vẽ lại tiến độ → trang không "đứng hình"
      }
      const bytes = await doc.save({ useObjectStreams: false });
      return { bytes: bytes, soTo: soTo, tongTo: tongTo, loi: loi, toDoDs: toDoDs, dienMvd: dienMvd };
    } finally {
      goc.remove(); kieu.remove();
      pdfDoc.forEach(function (p) { p.then(function (d) { d.destroy(); }).catch(function () {}); });
    }
  }

  window.DungPhieuGop = { napThuVien: napThuVien, docPdf: docPdf, dung: dung, GIAY: { W_MM: GIAY_W_MM, H_MM: GIAY_H_MM }, CAU_HINH_MAC_DINH: CAU_HINH_MAC_DINH,
    _cssInGoc: CSS_IN_GOC, _ghepDong: ghepDong, _vanTay: vanTay, _layDanhSach: layDanhSach, _layMvd: layMvd };
})();
