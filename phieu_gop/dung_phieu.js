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
  // 24/11 (bước 3): 2 KHỔ — nhiet = giấy in nhiệt 99×154 (nhãn XOAY ngang ở nửa trên) · a4 = giấy A4 máy in giấy cho ĐƠN DÀI
  //   (nhãn KHÔNG xoay, gần đúng cỡ gốc ở trên; danh sách bên dưới; cùng cài đặt chữ). le = chừa mép giấy, ngang = lề trái/phải nội dung.
  const KHO = {
    nhiet: { ten: GIAY_W_MM + "×" + GIAY_H_MM, w: GIAY_W_MM, h: GIAY_H_MM, le: LE_MM, ngang: 3, xoay: true },
    // 24/11 (chủ dự án xem mẫu): A4 cũng LẬT NGANG nhãn (tối đa 100% = đúng cỡ gốc, canh giữa) + danh sách CHIA 2 CỘT
    a4: { ten: "A4", w: 210, h: 297, le: 8, ngang: 10, xoay: true, tlMax: 1, cot: 2 },
  };

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
    // 25/11 (chủ dự án): TỰ THU NHỎ chữ danh sách cho đơn dài để VỪA 1 TỜ. Mặc định trong code = TẮT (bảng chưa nâng cấp → y như cũ).
    // Mọi chữ danh sách thu CÙNG tỉ lệ; từng chữ không nhỏ hơn "sàn đáy" của nó; chạm sàn vẫn không vừa → giữ 100%, sang tờ 2 / gợi ý A4.
    tuCo: false,
    minMa: 10, minSl: 12, minViTri: 10, minKtgh: 8, minTen: 8,
  };
  const KHOA_MIN = { ma: "minMa", sl: "minSl", viTri: "minViTri", ktgh: "minKtgh", ten: "minTen" };
  // ── 24/11 (bước 4): CÀI ĐẶT RIÊNG từng loại giấy, đọc từ tab PHIEU_GOP (cau_dao_phieu_gop.js đọc sẵn → PHIEU_GOP_CAU_HINH.bang).
  //    LƯỚI AN TOÀN 3 TẦNG cho TỪNG Ô: ô cài đặt hợp lệ → ô MẶC ĐỊNH trên Sheet hợp lệ → số trong code (CAU_HINH_MAC_DINH).
  //    Danh sách hợp lệ PHẢI giống apps_script/phieu_gop.gs.
  const PHONG_HOP_LE = ["Arial", "Segoe UI", "Tahoma", "Verdana", "Times New Roman", "Courier New"];
  const DONG_THUNG_HOP_LE = ["ten_kt", "ten", "an"];
  const DONG_CHU = [["MA_HANG", "ma"], ["SO_LUONG", "sl"], ["VI_TRI", "viTri"], ["KTGH", "ktgh"], ["TEN_SP", "ten"]];
  const KHOI_CHU = { nhiet: "CHU_GIAY_NHIET", a4: "CHU_A4" };
  const MD_CODE = Object.assign(JSON.parse(JSON.stringify(CAU_HINH_MAC_DINH)), { tl: 80 });
  const ktCo = function (v) { const n = Number(String(v == null ? "" : v).replace(",", ".")); return String(v).trim() !== "" && isFinite(n) && n >= 6 && n <= 30 ? Math.round(n * 10) / 10 : null; };
  const ktTl = function (v) { const n = Number(String(v == null ? "" : v).replace(",", ".")); return String(v).trim() !== "" && isFinite(n) && n >= 50 && n <= 100 && Math.floor(n) === n ? n : null; };
  const ktNguong = function (v) { const n = Number(String(v == null ? "" : v).replace(",", ".")); return String(v).trim() !== "" && isFinite(n) && n >= 2 && n <= 20 && Math.floor(n) === n ? n : null; };
  const ktO = function (v) { if (v === true || v === false) return v; const t = String(v == null ? "" : v).trim().toUpperCase(); return t === "TRUE" ? true : t === "FALSE" ? false : null; };
  const ktChu = function (v) { const t = String(v == null ? "" : v).trim(); return t && t.length <= 30 && !/^[=+\-@]/.test(t) ? t : null; };
  const ktTrong = function (ds) { return function (v) { const t = String(v == null ? "" : v).trim(); return ds.indexOf(t) >= 0 ? t : null; }; };
  // values = mảng dòng của tab PHIEU_GOP (A:H). → { nhiet, a4, nguongA4, md: { nhiet, a4, nguongA4 }, capNhat, canhBao: [...] }
  function phanTichBang(values) {
    let bang = Array.isArray(values) ? values : [];
    const ten = function (d) { return String(d && d[0] != null ? d[0] : "").trim().toUpperCase(); };
    // Bố cục MỚI = dòng tiêu đề "CÀI ĐẶT" có chữ "A4" ở cột C. Bố cục CŨ (23/11): cột C là GHI CHÚ → CHỈ đọc cột B.
    const moi = bang.some(function (d) { return ten(d) === "CÀI ĐẶT" && String(d && d[2] != null ? d[2] : "").trim().toUpperCase() === "A4"; });
    if (!moi) bang = bang.map(function (d) { return Array.isArray(d) ? [d[0], d[1]] : d; });
    const tim = function (nhan) { return bang.find(function (d) { return ten(d) === nhan; }) || null; };
    const canhBao = [];
    // chọn giá trị: ô → ô mặc định → code; ghi cảnh báo khi ô có chữ mà sai
    const chon = function (kiem, o, oMd, code, moTa) {
      const a = kiem(o); if (a !== null) return { v: a, md: kiem(oMd) !== null ? kiem(oMd) : code };
      if (o !== undefined && o !== null && String(o).trim() !== "") canhBao.push(moTa + " sai (\"" + String(o).slice(0, 30) + "\") → dùng mặc định");
      const b = kiem(oMd); return { v: b !== null ? b : code, md: b !== null ? b : code };
    };
    const kq = { nhiet: {}, a4: {}, md: { nhiet: {}, a4: {} }, canhBao: canhBao };
    const DON = [["TL_PHIEU_GOP", "tl", ktTl], ["NHAN_TONG_TIEN", "nhanTong", ktChu], ["DONG_THUNG", "dongThung", ktTrong(DONG_THUNG_HOP_LE)],
      ["KHOANH_TRON_SL", "khoanhTron", ktO], ["DUONG_KE", "duongKe", ktO], ["HIEN_KTGH", "hienKtgh", ktO],
      ["TU_CO_CHU", "tuCo", ktO], ["CO_MIN_MA_HANG", "minMa", ktCo], ["CO_MIN_SO_LUONG", "minSl", ktCo], ["CO_MIN_VI_TRI", "minViTri", ktCo],
      ["CO_MIN_KTGH", "minKtgh", ktCo], ["CO_MIN_TEN_SP", "minTen", ktCo]];
    ["nhiet", "a4"].forEach(function (g, gi) {
      DON.forEach(function (x) {
        const d = tim(x[0]) || [];
        // TL_PHIEU_GOP bố cục cũ (chỉ cột B) → A4 theo giấy nhiệt
        const o = x[1] === "tl" && gi === 1 && (d[2] === undefined || d[2] === "") ? d[1] : d[1 + gi];
        const c = chon(x[2], o, d[3 + gi], MD_CODE[x[1]], (gi ? "A4" : "Giấy nhiệt") + " · " + x[0]);
        kq[g][x[1]] = c.v; kq.md[g][x[1]] = c.md;
      });
      const dau = bang.findIndex(function (d) { return ten(d) === KHOI_CHU[g]; });
      DONG_CHU.forEach(function (x) {
        let d = [];
        if (dau >= 0) for (let i = dau + 1; i < Math.min(bang.length, dau + 12); i++) { if (ten(bang[i]) === x[0]) { d = bang[i]; break; } if (/^CHU_/.test(ten(bang[i]))) break; }
        const code = MD_CODE[x[1]], moTa = (gi ? "A4" : "Giấy nhiệt") + " · " + x[0];
        const co = chon(ktCo, d[1], d[4], code.co, moTa + " cỡ chữ"), dam = chon(ktO, d[2], d[5], code.dam, moTa + " đậm"), ph = chon(ktTrong(PHONG_HOP_LE), d[3], d[6], code.phong, moTa + " phông");
        kq[g][x[1]] = { co: co.v, dam: dam.v, phong: ph.v };
        kq.md[g][x[1]] = { co: co.md, dam: dam.md, phong: ph.md };
      });
    });
    const dn = tim("NGUONG_A4") || [];
    const n = chon(ktNguong, dn[1], dn[3], 2, "NGUONG_A4"); kq.nguongA4 = n.v; kq.md.nguongA4 = n.md;
    const cn = tim("CAP_NHAT"); kq.capNhat = cn && cn[1] != null ? String(cn[1]) : "";
    kq.coTuCo = moi && !!tim("TU_CO_CHU"); // 25/11: bảng đã nâng cấp (Apps Script code 3) → trang 🎨 mới cho lưu phần tự thu nhỏ
    return kq;
  }
  // Cài đặt đang dùng (đọc 1 lần khi nạp file): bảng chưa nâng cấp / không đọc được → mọi ô theo code
  const CAI_DAT = (function () {
    try { return phanTichBang((window.PHIEU_GOP_CAU_HINH && window.PHIEU_GOP_CAU_HINH.bang) || []); } catch (er) { console.warn("[PhieuGop] Lỗi đọc cài đặt — dùng mặc định:", er); return phanTichBang([]); }
  })();
  if (CAI_DAT.canhBao.length) console.warn("[PhieuGop] Bảng PHIEU_GOP có ô sai (đã dùng mặc định):", CAI_DAT.canhBao);
  let K_HIEN = CAI_DAT.nhiet; // cài đặt của loại giấy ĐANG dựng (đặt ở đầu dung / demTo / xemTruoc)
  // Mã vận đơn hợp lệ (đọc từ mã vạch / QR trên nhãn): Shopee SPXVN…, TikTok / GHN… VN…
  // 24/11 chiều: thêm MVĐ TOÀN SỐ 10–16 chữ số (TikTok có đơn vị vận chuyển dùng mã 12 số, vd 862784076606 — mã vạch = QR).
  //   Mã đơn TikTok 18 số nằm ngoài khoảng này; mã EAN13 cố định của phiếu Shopee không phải Code128 / QR nên không bị lấy.
  const MAU_MVD = /^(SPXVN\d{8,}[A-Z]?|VN[A-Z]{2,4}\d{8,}[A-Z]?|\d{10,16})$/;
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
  function cssTo(tl, nhanCaoPt, kho) {
    kho = kho || KHO.nhiet;
    return "#pg-dung{position:fixed;left:-30000px;top:0;width:" + kho.w + "mm;background:#fff;color:#000;font-size:11px;" +
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}\n" +
      phamViCss(CSS_IN_GOC, "#pg-dung") +
      "#pg-dung .btn-copy-don{display:none!important}\n" +
      "#pg-dung .pg-to{width:" + kho.w + "mm;height:" + kho.h + "mm;position:relative;overflow:hidden;box-sizing:border-box;background:#fff}\n" +
      "#pg-dung .pg-cho-nhan{height:" + nhanCaoPt.toFixed(2) + "pt;border-bottom:1px dashed #000;box-sizing:border-box}\n" +
      "#pg-dung .pg-vung{position:absolute;left:0;right:0;padding:0 " + kho.ngang + "mm;box-sizing:border-box;overflow:hidden}\n" +
      "#pg-dung .pg-vung .invoice-box{transform:scale(" + tl + ");transform-origin:0 0;width:" + ((kho.w - 2 * kho.ngang) / tl).toFixed(2) + "mm!important;" +
      "padding:2mm 0 0!important;margin:0!important;border:none!important;box-shadow:none!important;box-sizing:border-box}\n" +
      "#pg-dung .pg-dau-to{display:flex;justify-content:space-between;align-items:center;gap:4px;font-weight:700;font-size:15px;border:2px solid #000;" +
      "padding:1px 6px;margin-bottom:4px;white-space:nowrap}\n" +
      "#pg-dung .pg-dau-to span:first-child{overflow:hidden}\n#pg-dung .pg-dau-to .pg-so-to{font-size:19px}\n" +
      "#pg-dung .pg-chan{position:absolute;left:" + kho.ngang + "mm;right:" + kho.ngang + "mm;bottom:" + kho.le + "mm;display:flex;gap:2mm;align-items:flex-end;border-top:1px solid #000;" +
      "padding-top:1mm;box-sizing:border-box}\n" +
      "#pg-dung .pg-trai{flex:1;min-width:0;position:relative}\n" +
      "#pg-dung .pg-trai-in{transform:scale(" + tl + ");transform-origin:0 0;width:" + (100 / tl).toFixed(3) + "%}\n" +
      "#pg-dung .pg-trai-in>*{margin-top:0!important}\n" +
      "#pg-dung .pg-trai-in .inv-total{text-align:left!important}\n" +
      "#pg-dung .pg-thung{font-weight:700;font-size:13px;margin:2px 0}\n" +
      "#pg-dung .pg-con-tiep{font-weight:700;font-size:12px}\n#pg-dung .pg-het-don{font-weight:700;font-size:11px;margin-top:1mm}\n" +
      "#pg-dung .pg-qr{width:" + QR_MM + "mm;height:" + QR_MM + "mm;flex:none}\n#pg-dung .pg-qr svg{width:100%;height:100%;display:block}\n" +
      cssDanhSach(tl, K_HIEN);
  }
  // Chữ: chỉ độ đậm 400 / 700 (800 → Chrome chọn "Arial Black" không có chữ Việt); phông dự phòng Arial
  function kieuChu(o) {
    return "font-size:" + o.co + "px;font-weight:" + (o.dam ? 700 : 400) + ";font-family:'" + String(o.phong).replace(/'/g, "") + "',Arial,sans-serif";
  }
  function cssDanhSach(tl, K) {
    const p = function (v) { return (v * tl).toFixed(1) + "px"; };
    const f = K.thu > 0 && K.thu < 1 ? K.thu : 1; // 25/11: tỉ lệ tự thu nhỏ của đơn đang dựng → khoảng cách danh sách thu theo
    const mm = function (v) { return (v * f).toFixed(2) + "mm"; };
    return "#pg-dung .pgd-khung{padding-top:1.5mm;box-sizing:border-box}\n" +
      "#pg-dung .pgd-khung .pg-dau-to{font-size:12px}\n#pg-dung .pgd-khung .pg-dau-to .pg-so-to{font-size:15px}\n" +
      // Đầu đơn = mẫu in × tl, 1 dòng: MVĐ · MĐH · [TỜ 1/N]
      "#pg-dung .pgd-dau-don{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;column-gap:6px;row-gap:1px;" +
      "border-bottom:2px solid #000;padding-bottom:" + p(3) + ";margin-bottom:" + p(2) + "}\n" +
      "#pg-dung .pgd-dau-don .pgd-mvd{font-size:" + p(14) + ";white-space:nowrap}\n#pg-dung .pgd-dau-don .pgd-mvd b{font-weight:700}\n" +
      "#pg-dung .pgd-dau-don .pgd-mdh{font-size:" + p(14) + ";font-weight:700;white-space:nowrap}\n" +
      "#pg-dung .pgd-dau-don .pgd-so-to-dau{font-size:" + p(14) + ";font-weight:700;border:2px solid #000;padding:0 4px;white-space:nowrap}\n" +
      // Danh sách: mỗi mã 2 dòng
      "#pg-dung .pgd-mon{display:grid;grid-template-columns:" + mm(9) + " 1fr;column-gap:" + mm(2.5) + ";align-items:center;padding:" + mm(0.6) + " 0;" +
      (K.duongKe ? "border-bottom:1px solid #000;" : "") + "}\n" +
      "#pg-dung .pgd-mon .pgd-sl{" + kieuChu(K.sl) + ";text-align:center;line-height:1}\n" +
      "#pg-dung .pgd-mon .pgd-tron{display:inline-flex;align-items:center;justify-content:center;min-width:" + Math.round(K.sl.co * 1.55) + "px;height:" +
      Math.round(K.sl.co * 1.55) + "px;padding:0 2px;border:1.5px solid #000;border-radius:999px;box-sizing:border-box}\n" +
      "#pg-dung .pgd-mon .pgd-nd{min-width:0}\n" +
      "#pg-dung .pgd-mon .pgd-d1{display:flex;align-items:baseline;column-gap:" + mm(5) + ";flex-wrap:wrap;line-height:1.08}\n" +
      "#pg-dung .pgd-mon .pgd-ma{" + kieuChu(K.ma) + ";overflow-wrap:anywhere}\n" +
      "#pg-dung .pgd-mon .pgd-vt{" + kieuChu(K.viTri) + ";overflow-wrap:anywhere}\n" +
      "#pg-dung .pgd-mon .pgd-kt{margin-left:auto;padding-left:2mm;" + kieuChu(K.ktgh) + ";white-space:nowrap}\n" +
      "#pg-dung .pgd-mon .pgd-d2{" + kieuChu(K.ten) + ";line-height:1.12;margin-top:0.15mm}\n" +
      // Chân tờ: Thùng (trái) + Tổng tiền (phải) cùng 1 dòng
      // 24/11 (chủ dự án): chân tờ = "Thùng: …  |  ▼ 1/2 (còn tiếp) / ■ 2/2 (hết đơn)  |  Tổng tiền: …" trên MỌI tờ (lưới 3 cột)
      "#pg-dung .pgd-hang-tong{display:grid;grid-template-columns:1fr auto 1fr;align-items:baseline;column-gap:3mm}\n" +
      "#pg-dung .pgd-hang-tong>:first-child{justify-self:start}\n" +
      "#pg-dung .pgd-hang-tong .inv-total{justify-self:end;margin:0!important;text-align:right!important;white-space:nowrap}\n" +
      "#pg-dung .pgd-hang-tong .pg-thung{margin:0}\n" +
      "#pg-dung .pgd-to-chi{justify-self:center;font-weight:700;font-size:16px;white-space:nowrap}\n" +
      // tờ 2 trở đi: 1 dòng gọn "MĐH: … · tờ 2/3" thay dải có khung
      "#pg-dung .pgd-dau-nho{display:flex;justify-content:space-between;gap:6px;font-size:" + p(14) + ";font-weight:700;white-space:nowrap;" +
      "border-bottom:2px solid #000;padding-bottom:" + p(2) + ";margin-bottom:" + p(2) + "}\n" +
      // A4: 2 cột — cột trái đầy rồi mới sang cột phải; vạch dọc ngăn 2 cột
      "#pg-dung .pgd-ds.hai-cot{display:flex;gap:0;align-items:flex-start}\n" +
      "#pg-dung .pgd-ds.hai-cot .pgd-cot{flex:1 1 0;min-width:0}\n" +
      "#pg-dung .pgd-ds.hai-cot .pgd-cot+.pgd-cot{border-left:1px solid #000;margin-left:3mm;padding-left:3mm}\n";
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function e(tag, cls, html) { const x = document.createElement(tag); if (cls) x.className = cls; if (html != null) x.innerHTML = html; return x; }
  function qrSvg(ma) {
    if (typeof qrcode !== "function") return "";
    const q = qrcode(0, "M"); q.addData(String(ma)); q.make(); return q.createSvgTag({ cellSize: 2, margin: 0, scalable: true });
  }
  function dongThung(skus) {
    try {
      const K = K_HIEN;
      if (!window.KichThuoc || K.dongThung === "an") return "";
      const th = window.KichThuoc.thungLonNhat(skus); if (!th) return "";
      if (K.dongThung === "ten") return '<div class="pg-thung">Thùng: ' + esc(th) + "</div>";
      const kt = window.KichThuoc.kichThuocThung(th);
      return '<div class="pg-thung">Thùng: [' + esc(th) + (kt ? " " + esc(kt) : "") + "]</div>";
    } catch (er) { return ""; }
  }
  function ktgh(sku) {
    try { return K_HIEN.hienKtgh && window.KichThuoc ? window.KichThuoc.noiDungKtgh(sku) || "" : ""; } catch (er) { return ""; }
  }
  // 1 khối mã hàng (2 dòng)
  function khoiMon(it) {
    const K = K_HIEN;
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
  function chiaDon(goc, don, tl, nhanCaoPt, kho) {
    kho = kho || KHO.nhiet;
    const LE_PX = kho.le * 96 / 25.4;
    const K = K_HIEN;
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
      // 24/11 (chủ dự án): MỌI tờ có chân ĐẦY ĐỦ — Dễ vỡ (nếu có) + "Thùng | ▼ x/N hoặc ■ N/N | Tổng tiền" (bỏ dòng CÒN TIẾP / HẾT ĐƠN)
      function datChan(c) {
        c.trai.innerHTML = "";
        const vo = e("div", "pg-trai-in");
        let daThem = false;
        cuoi.map(function (x) { return x.cloneNode(true); }).forEach(function (x) {
          const tong = doiNhanTong(x);
          if (!daThem && tong) {
            const hang = e("div", "pgd-hang-tong", (thung || "<span></span>") + '<span class="pgd-to-chi"></span>');
            if (tong === x) { hang.appendChild(x); vo.appendChild(hang); }
            else { tong.parentNode.insertBefore(hang, tong); hang.appendChild(tong); vo.appendChild(x); }
            daThem = true; return;
          }
          vo.appendChild(x);
        });
        if (!daThem) vo.insertAdjacentHTML("beforeend", '<div class="pgd-hang-tong">' + (thung || "<span></span>") + '<span class="pgd-to-chi"></span><span></span></div>');
        c.trai.appendChild(vo);
        c.trai.style.height = (vo.getBoundingClientRect().height) + "px";
        c.vung.style.bottom = (c.chan.offsetHeight + 2 + LE_PX) + "px";
      }
      function toMoi() {
        const coNhan = cacTo.length < don.soNhan, dauTien = cacTo.length === 0;
        const to = e("div", "pg-to"); if (coNhan) to.appendChild(e("div", "pg-cho-nhan"));
        const chan = e("div", "pg-chan"), trai = e("div", "pg-trai"); chan.appendChild(trai); to.appendChild(chan);
        const vung = e("div", "pg-vung"); vung.style.top = coNhan ? nhanCaoPt.toFixed(2) + "pt" : kho.le + "mm"; to.appendChild(vung);
        const box = e("div", "pgd-khung"); vung.appendChild(box);
        // tờ đầu: "TỜ 1/N" nằm cuối dòng đầu đơn; tờ sau: 1 dòng GỌN "MĐH: … · tờ x/N" (chủ dự án 24/11)
        const dauTo = e("div", "pgd-dau-nho", "<span>MĐH: " + esc(don.ma) + '</span><span class="pg-so-to">tờ 8/8</span>');
        if (dauTien || !coNhieu) dauTo.style.display = "none";
        box.appendChild(dauTo);
        if (dauTien) box.appendChild(e("div", "pgd-dau-don", '<div class="pgd-mvd"><b>MVĐ:</b> ' + esc(don.vd) + '</div><div class="pgd-mdh">MĐH: ' +
          esc(don.ma) + "</div>" + (coNhieu ? '<div class="pgd-so-to-dau">TỜ 1/8</div>' : "")));
        const soCot = kho.cot || 1;
        const ds = e("div", "pgd-ds" + (soCot > 1 ? " hai-cot" : "")); box.appendChild(ds);
        const cot = []; for (let k = 0; k < soCot; k++) cot.push(soCot > 1 ? ds.appendChild(e("div", "pgd-cot")) : ds);
        goc.appendChild(to);
        const c = { to: to, vung: vung, box: box, ds: ds, cot: cot, iCot: 0, dauTo: dauTo, trai: trai, chan: chan };
        datChan(c); cacTo.push(c);
        return c;
      }
      function tran(c) { return c.box.getBoundingClientRect().height > c.vung.getBoundingClientRect().height - 1; }
      function soMon(c) { return c.cot.reduce(function (s, k) { return s + k.children.length; }, 0); }
      // đặt 1 khối vào tờ c: cột hiện tại tràn → sang cột kế; hết cột → tờ mới. Trả về tờ đang dùng.
      function datMon(c, kh) {
        for (;;) {
          c.cot[c.iCot].appendChild(kh);
          if (!tran(c) || soMon(c) === 1) return c;
          c.cot[c.iCot].removeChild(kh);
          if (c.iCot < c.cot.length - 1) { c.iCot++; continue; }
          c = toMoi();
        }
      }
      function layCuoi(c) { // lấy khối CUỐI (cột phải trước) — dùng khi chân tờ cuối không đủ chỗ
        for (let k = c.cot.length - 1; k >= 0; k--) { const kh = c.cot[k].lastChild; if (kh) { c.cot[k].removeChild(kh); c.iCot = k; return kh; } }
        return null;
      }
      let c = toMoi();
      dsMon.forEach(function (it) { c = datMon(c, khoiMon(it)); });
      while (cacTo.length < don.soNhan) toMoi();
      let L = cacTo[cacTo.length - 1];
      if (tran(L) && soMon(L)) {
        const doi = [];
        while (tran(L) && soMon(L) > 0) doi.unshift(layCuoi(L));
        let M = toMoi(); doi.forEach(function (r) { M = datMon(M, r); }); L = M;
      }
      // 2 cột: tờ CUỐI chia đều 2 cột (cột trái ≥ cột phải, thứ tự đọc giữ nguyên: hết cột trái rồi sang cột phải)
      // 25/11 SỬA LỖI (chủ dự án in A4 tỉ lệ 100 → mã cuối cột trái bị chân tờ che): bản cũ dồn HẾT sang cột trái rồi chuyển dần
      //   sang phải → cột trái có thể DÀI HƠN chỗ trống (mã cột phải ngắn hơn) mà không đo lại. Nay chỉ CHUYỂN từ cuối cột trái sang
      //   đầu cột phải (cột trái chỉ NGẮN đi — luôn vừa như lúc đặt), chuyển xong mà cột phải tràn → trả lại, dừng.
      if (L.cot.length === 2) {
        const ct = L.cot[0], cp = L.cot[1];
        while (ct.children.length > 1) {
          const kh = ct.lastChild, hk = kh.getBoundingClientRect().height;
          if (ct.getBoundingClientRect().height - hk < cp.getBoundingClientRect().height + hk) break;
          cp.insertBefore(kh, cp.firstChild);
          if (tran(L)) { ct.appendChild(kh); break; }
        }
      }
      const N = cacTo.length;
      cacTo.forEach(function (x, i) {
        if (N > 1) {
          if (i > 0) { x.dauTo.style.display = ""; x.dauTo.querySelector(".pg-so-to").textContent = "tờ " + (i + 1) + "/" + N; }
          else { const sd = x.box.querySelector(".pgd-so-to-dau"); if (sd) sd.textContent = "TỜ 1/" + N; }
          const chi = x.trai.querySelector(".pgd-to-chi"); if (chi) chi.textContent = (i < N - 1 ? "▼ " : "■ ") + (i + 1) + "/" + N; // ▼ còn tiếp · ■ hết đơn
        }
      });
      // Số tờ DO DANH SÁCH HÀNG (tờ cuối còn món) — dùng cho gợi ý in A4 (bước 3); tờ chỉ chứa trang nhãn thứ 2+ không tính
      let toDoDs = 0; cacTo.forEach(function (x, i) { if (soMon(x)) toDoDs = i + 1; });
      // lỗi: còn tràn, HOẶC số mã trong danh sách khác số mã trên tờ đơn (không để mất mã nào)
      const loi = cacTo.some(function (x) { return tran(x); }) || dsMon.length !== don.skus.length;
      return { cacTo: cacTo, N: N, loi: loi, toDoDs: toDoDs };
    }
    let kq = chia(false);
    if (kq.N > 1) { kq.cacTo.forEach(function (x) { x.to.remove(); }); kq = chia(true); }
    return kq;
  }

  // ---------------------------------------------------------------------------------------------------
  // 25/11 (chủ dự án) — TỰ THU NHỎ CHỮ DANH SÁCH cho đơn dài, bật / tắt bằng TU_CO_CHU (Sheet PHIEU_GOP / trang 🎨).
  //   Đơn VỪA các tờ có nhãn ở 100% → giữ nguyên (đơn ngắn không đổi gì). Không vừa → thử 95%, 90%… cho MỌI chữ danh sách
  //   (cùng tỉ lệ, khoảng cách thu theo); từng chữ không nhỏ hơn "sàn đáy" CO_MIN_… của nó. Tỉ lệ ĐẦU TIÊN vừa → dùng.
  //   Mọi chữ chạm sàn mà vẫn không vừa → QUAY VỀ 100% (sang tờ 2 / gợi ý A4 như trước). Đo thật, không đếm số mã.
  function kThu(K, s) { // bản cài đặt có chữ danh sách thu tỉ lệ s; sàn đáy lớn hơn cỡ đang dùng → giữ cỡ đang dùng (không phóng to)
    const k2 = JSON.parse(JSON.stringify(K));
    DONG_CHU.forEach(function (x) {
      const o = k2[x[1]], san = Math.min(Number(K[KHOA_MIN[x[1]]]) || o.co, o.co);
      o.co = Math.max(san, Math.round(o.co * s * 10) / 10);
    });
    k2.thu = s;
    return k2;
  }
  function tiLeThap(K) { // tỉ lệ nhỏ nhất còn có ích = lúc MỌI chữ đã chạm sàn đáy
    let s = 1;
    DONG_CHU.forEach(function (x) { const o = K[x[1]], san = Math.min(Number(K[KHOA_MIN[x[1]]]) || o.co, o.co); s = Math.min(s, san / o.co); });
    return Math.max(0.3, s);
  }
  // Như chiaDon + tự thu nhỏ. datCss(): ghi lại CSS dựng tờ theo K_HIEN hiện tại. Vừa ở tỉ lệ nào thì ĐỂ NGUYÊN K_HIEN + CSS đó
  // cho bước chụp ảnh (nơi gọi tự đặt lại K_HIEN gốc trước đơn kế tiếp). Trả thêm kq.thu (1 = không thu).
  function chiaDonTuCo(goc, don, tl, nhanCaoPt, kho, datCss) {
    const K0 = K_HIEN;
    let kq = chiaDon(goc, don, tl, nhanCaoPt, kho); kq.thu = 1;
    const soToNhan = Math.max(1, don.soNhan || 1);
    if (!K0.tuCo || kq.N <= soToNhan) return kq;
    const thap = tiLeThap(K0);
    const lechMa = layDanhSach(don.box).length !== (don.skus || []).length; // lỗi lệch số mã không do cỡ chữ → không cản việc thu
    if (thap >= 0.999) return kq;
    const buoc = [];
    for (let s = 0.95; s > thap + 0.001; s = Math.round((s - 0.05) * 100) / 100) buoc.push(s);
    buoc.push(Math.round(thap * 1000) / 1000);
    for (let i = 0; i < buoc.length; i++) {
      kq.cacTo.forEach(function (x) { x.to.remove(); });
      K_HIEN = kThu(K0, buoc[i]); datCss();
      kq = chiaDon(goc, don, tl, nhanCaoPt, kho); kq.thu = buoc[i];
      if (kq.N <= soToNhan && (!kq.loi || lechMa)) return kq;
    }
    kq.cacTo.forEach(function (x) { x.to.remove(); });
    K_HIEN = K0; datCss();
    kq = chiaDon(goc, don, tl, nhanCaoPt, kho); kq.thu = 1;
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
        if (m.vach[0] === String(don.ma || "").trim()) return "";                    // mã đọc được chính là MÃ ĐƠN → không phải MVĐ
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

  // Vị trí nhãn sàn trên 1 tờ theo khổ: cắt lề trắng (vùng có nội dung của cả file) → tỉ lệ + chiều cao phần nhãn.
  //   nhiet: XOAY 90° cho vừa bề ngang 99 mm (≈65%) · a4: KHÔNG xoay, tối đa 100% (gần đúng cỡ gốc), canh giữa ở trên.
  function hinhNhan(don, kho) {
    const W = kho.w * MM, H = kho.h * MM, LE = kho.le * MM;
    const t0 = don.nhan[0], hop = t0.tep.hop || { l: 0, r: t0.trang.w, t: 0, bt: t0.trang.h };
    const bb = { left: Math.max(0, hop.l - LE_NHAN), right: Math.min(t0.trang.w, hop.r + LE_NHAN),
      bottom: Math.max(0, t0.trang.h - hop.bt - LE_NHAN), top: Math.min(t0.trang.h, t0.trang.h - hop.t + LE_NHAN) };
    const bw = bb.right - bb.left, bh = bb.top - bb.bottom;
    if (kho.xoay) {
      const tl = Math.min(kho.tlMax || Infinity, (W - 2 * LE) / bh), cao = LE + bw * tl;
      return { bb: bb, tl: tl, nhanCao: cao, x: (W - bh * tl) / 2 + bh * tl, y: H - cao, xoay: true }; // canh giữa bề ngang
    }
    const tl = Math.min(1, (W - 2 * LE) / bw, (H * 0.6) / bh), cao = LE + bh * tl;
    return { bb: bb, tl: tl, nhanCao: cao, x: (W - bw * tl) / 2, y: H - cao, xoay: false };
  }
  function laMvdThat(v) { v = String(v || "").trim(); return /[0-9A-Za-z]/.test(v) ? v : ""; } // "━━━" / trống = KHÔNG có MVĐ

  // dsDon: [{ ma, vd, box, skus, soSp, nhan: [{ tep, trang }] }] theo ĐÚNG thứ tự in. tl: tỉ lệ thu đầu/chân tờ (0,5–1).
  // tenKho: "nhiet" (mặc định, 99×154) | "a4" (24/11 — đơn dài).
  // → { bytes (PDF), soTo: [số tờ từng đơn], tongTo, loi: [mã đơn tràn chữ / thiếu mã], toDoDs: [số tờ do danh sách], dienMvd: [{ma, mvd}] }
  async function dung(dsDon, tl, khiTienDo, tenKho, hoiDung) {
    const kiemDung = function () { if (typeof hoiDung === "function" && hoiDung()) { const er = new Error("Người dùng bấm Dừng"); er.daDung = true; throw er; } }; // 24/11: nút ⏹ Dừng
    await napThuVien();
    if (typeof window.html2canvas !== "function") throw new Error("Thiếu thư viện chụp ảnh (html2canvas) — tải lại trang");
    const kho = KHO[tenKho] || KHO.nhiet;
    K_HIEN = CAI_DAT[tenKho === "a4" ? "a4" : "nhiet"];
    tl = K_HIEN.tl ? K_HIEN.tl / 100 : tl;
    const K_GOC = K_HIEN; // 25/11: tự thu nhỏ có thể đổi K_HIEN cho 1 đơn → đặt lại đầu mỗi đơn
    const thuDon = []; // tỉ lệ chữ danh sách từng đơn (1 = 100%)
    const W = kho.w * MM, H = kho.h * MM;
    const L = window.PDFLib;
    const doc = await L.PDFDocument.create();
    const daNapTep = new Map();
    const layTep = async function (tep) { if (!daNapTep.has(tep)) daNapTep.set(tep, await L.PDFDocument.load(tep.bytes.slice())); return daNapTep.get(tep); };
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
        kiemDung();
        const don = dsDon[i];
        const hn = hinhNhan(don, kho);
        K_HIEN = K_GOC;
        const datCss = function () { kieu.textContent = cssTo(tl, hn.nhanCao, kho); };
        datCss();
        goc.innerHTML = "";
        let vd = laMvdThat(don.vd);
        if (!vd) { vd = await layMvd(don, moPdfDoc); if (vd) dienMvd.push({ ma: don.ma, mvd: vd }); }
        const kq = chiaDonTuCo(goc, { ma: don.ma, vd: vd, box: don.box, skus: don.skus, soSp: don.soSp, soNhan: don.nhan.length }, tl, hn.nhanCao, kho, datCss);
        thuDon.push(kq.thu);
        if (kq.loi) loi.push(don.ma);
        toDoDs.push(kq.toDoDs);
        for (let j = 0; j < kq.cacTo.length; j++) {
          kiemDung();
          // ignoreElements: html2canvas mặc định chép CẢ trang (Bảng 1–3, mọi tờ đơn…) mỗi lần chụp → càng nhiều đơn càng chậm.
          // Chỉ giữ khung dựng #pg-dung + thẻ style/link (bỏ các khối khác ngay dưới <body>).
          // Tờ có nhãn: KHÔNG chụp phần trên (chỉ là nền trắng chờ nhãn) → ảnh nhỏ hơn, file nhẹ, dựng nhanh hơn.
          const elTo = kq.cacTo[j].to, r = elTo.getBoundingClientRect();
          const catTren = j < don.nhan.length ? Math.max(0, hn.nhanCao * 96 / 72 - 2) : 0; // px CSS (giữ lại đường kẻ đứt ngăn 2 phần)
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
          const trang = doc.addPage([W, H]);
          trang.drawImage(anh, { x: 0, y: 0, width: W, height: H * (r.height - catTren) / r.height });
          if (j < don.nhan.length) {
            const n = don.nhan[j];
            const nguon = await layTep(n.tep);
            const nhan = await doc.embedPage(nguon.getPage(n.trang.p - 1), hn.bb);
            trang.drawPage(nhan, hn.xoay ? { x: hn.x, y: hn.y, xScale: hn.tl, yScale: hn.tl, rotate: L.degrees(90) }
              : { x: hn.x, y: hn.y, xScale: hn.tl, yScale: hn.tl });
          }
          cv.width = cv.height = 0;
        }
        soTo.push(kq.N); tongTo += kq.N;
        if (khiTienDo) khiTienDo(i + 1, dsDon.length);
        await new Promise(function (ok) { setTimeout(ok, 0); }); // nhường trình duyệt vẽ lại tiến độ → trang không "đứng hình"
      }
      kiemDung();
      const bytes = await doc.save({ useObjectStreams: false });
      return { bytes: bytes, soTo: soTo, tongTo: tongTo, loi: loi, toDoDs: toDoDs, dienMvd: dienMvd, thu: thuDon };
    } finally {
      K_HIEN = K_GOC;
      goc.remove(); kieu.remove();
      pdfDoc.forEach(function (p) { p.then(function (d) { d.destroy(); }).catch(function () {}); });
    }
  }

  // 24/11 (bước 3): ĐO NHANH số tờ khổ 99×154 của từng đơn (chỉ xếp chữ, KHÔNG chụp ảnh, KHÔNG đọc mã vạch) → gợi ý in A4.
  // MVĐ trống → dùng chuỗi dài tạm để đo (tờ in thật sẽ được tự điền). → [{ ma, toDoDs, soTo }]
  function demTo(dsDon, tl) {
    const kho = KHO.nhiet, ra = [];
    K_HIEN = CAI_DAT.nhiet; tl = K_HIEN.tl ? K_HIEN.tl / 100 : tl;
    const goc = e("div"); goc.id = "pg-dung";
    const kieu = document.createElement("style");
    document.head.appendChild(kieu); document.body.appendChild(goc);
    try {
      dsDon.forEach(function (don) {
        if (!don.nhan || !don.nhan.length) return;
        try {
          const hn = hinhNhan(don, kho);
          K_HIEN = CAI_DAT.nhiet;
          const datCss = function () { kieu.textContent = cssTo(tl, hn.nhanCao, kho); };
          datCss();
          goc.innerHTML = "";
          const kq = chiaDonTuCo(goc, { ma: don.ma, vd: laMvdThat(don.vd) || "SPXVN00000000000B", box: don.box, skus: don.skus, soSp: don.soSp, soNhan: don.nhan.length }, tl, hn.nhanCao, kho, datCss);
          ra.push({ ma: don.ma, toDoDs: kq.toDoDs, soTo: kq.N, thu: kq.thu });
        } catch (er) { console.warn("[PhieuGop] Không đo được số tờ đơn " + don.ma + ":", er); }
      });
    } finally { K_HIEN = CAI_DAT.nhiet; goc.remove(); kieu.remove(); }
    return ra;
  }

  // khung: phần tử chứa · don: { ma, vd, box (invoice-box mẫu), skus, soSp } · caiDat: 1 bộ cài đặt giấy · tenKho · nhanW/nhanH: khổ nhãn (điểm)
  // → tờ ĐẦU TIÊN được đặt trong khung (id "pg-dung" để dùng chung CSS), nửa nhãn là ô xám ghi "NHÃN SÀN".
  function xemTruoc(khung, don, caiDat, tenKho, nhanW, nhanH) {
    const kho = KHO[tenKho] || KHO.nhiet;
    K_HIEN = caiDat;
    const nhanGia = { nhan: [{ tep: { hop: null }, trang: { w: nhanW || 297, h: nhanH || 420 } }] };
    const hn = hinhNhan(nhanGia, kho);
    khung.innerHTML = "";
    const kieu = document.createElement("style");
    const datCss = function () { kieu.textContent = cssTo(caiDat.tl / 100, hn.nhanCao, kho) + THEM_XEM; };
    const THEM_XEM = "#pg-dung{position:relative!important;left:0!important}\n" +
      "#pg-dung .pg-cho-nhan{background:repeating-linear-gradient(45deg,#f8f9fa 0 6px,#eef0f2 6px 12px);display:flex;align-items:center;justify-content:center;color:#5f6368;font:700 13px Arial,sans-serif;text-align:center}\n";
    datCss();
    const goc = e("div"); goc.id = "pg-dung";
    khung.appendChild(kieu); khung.appendChild(goc);
    const kq = chiaDonTuCo(goc, { ma: don.ma, vd: don.vd, box: don.box, skus: don.skus, soSp: don.soSp, soNhan: 1 }, caiDat.tl / 100, hn.nhanCao, kho, datCss);
    kq.cacTo.slice(1).forEach(function (x) { x.to.remove(); });
    const nhan = goc.querySelector(".pg-cho-nhan"); if (nhan) nhan.innerHTML = "NHÃN SÀN<br>(phiếu đóng gói gốc, lật ngang, " + Math.round(hn.tl * 100) + "%)";
    K_HIEN = CAI_DAT.nhiet;
    return { soTo: kq.N, to: goc.querySelector(".pg-to"), thu: kq.thu };
  }

  window.DungPhieuGop = { napThuVien: napThuVien, docPdf: docPdf, dung: dung, demTo: demTo, xemTruoc: xemTruoc, phanTichBang: phanTichBang, CAI_DAT: CAI_DAT,
    PHONG_HOP_LE: PHONG_HOP_LE, DONG_THUNG_HOP_LE: DONG_THUNG_HOP_LE, GIAY: { W_MM: GIAY_W_MM, H_MM: GIAY_H_MM }, KHO: KHO,
    CAU_HINH_MAC_DINH: CAU_HINH_MAC_DINH, _cssInGoc: CSS_IN_GOC, _ghepDong: ghepDong, _vanTay: vanTay, _layDanhSach: layDanhSach, _layMvd: layMvd };
})();
