// =========================================================================
// PHIẾU GỘP — KHUNG "🧾 Phiếu gộp" ở tab Xem Đơn Hàng (23/11). Chỉ được nạp khi BAT_PHIEU_GOP ☑ (cau_dao_phieu_gop.js).
// Giao diện GIỐNG ô 📦 PDF trang vận hành (chủ dự án duyệt trang mẫu v2): thanh đầu · khung đỏ bất thường · bộ lọc ·
// thẻ TỜ | phiếu | ✓ KHỚP | tờ đơn · thanh in · hộp "Đã in xong … chưa?" · Thu gọn.
// - Tờ đơn = các tờ trong vùng in #print-only-zone do nút "Tạo mẫu in" tạo (mẫu đang dùng), mã đơn ở dòng "📦 ĐƠN: …"
//   (data-copy-text). Thứ tự in = thứ tự tờ đơn.
// - Ghép: mã đơn trùng NGUYÊN 1 cụm chữ trên trang PDF; trang trùng ≥ 2 mã → không nhận (cần xử lý); không trùng → phiếu
//   không có tờ đơn. Trang trùng nhau giữa các file (cùng vân tay) → chỉ tính 1 lần.
// - Sổ "đã in" RIÊNG (localStorage zzm_phieu_gop_so_v1, 7 ngày, trên chính máy này): mã đơn + vân tay trang.
// - Nút "In đơn hàng" cũ: hỏi lại trước khi in tờ đơn rời (bắt sự kiện từ ngoài — KHÔNG sửa script.js).
// - 24/11 (bước 3): ĐƠN DÀI → in KHỔ A4 (máy in giấy). Đo nhanh số tờ 99×154 của từng đơn (DungPhieuGop.demTo); danh sách hàng
//   cần ≥ NGUONG_A4 tờ → nhãn "📄 Đơn dài — nên in A4" + bộ lọc "📄 Nên in A4". Người dùng TỰ tích ô "In A4" ở từng đơn → đơn đó rời
//   xấp 99×154, in bằng nút "🖨 In … PHIẾU A4". Sổ đã in DÙNG CHUNG (in A4 rồi thì không in 99×154 nữa và ngược lại).
// - 24/11 (chủ dự án duyệt): CẢNH BÁO LỆCH như ô 📦 — (1) file PDF không khớp tờ đơn nào của lần in → dòng file ĐỎ CHÓI;
//   (2) bấm In khi phiên còn lệch → hộp XÁC NHẬN liệt kê phiếu không có tờ đơn / tờ đơn thiếu phiếu / file không khớp
//   ("← Quay lại xử lý" | "Vẫn in N phiếu khớp"); (3) khung thu gọn vẫn hiện DẢI ĐỎ khi còn lệch.
// - 24/11 chiều (chủ dự án duyệt): nút "⏹ Dừng" trong hộp đang dựng (không in, không ghi sổ, giữ file + kết quả);
//   IN LẠI NHIỀU phiếu: bộ lọc "🖨 Đã in" có ô "Chọn in lại" + Chọn hết / Bỏ chọn → nút "↻ In lại N phiếu" (cảnh báo 2 tờ giống nhau,
//   ≥ 15 phiếu cảnh báo đậm) → ghi sổ IN LẠI, giờ in lần đầu giữ nguyên; chọn lẫn A4 + giấy nhiệt → in giấy nhiệt trước, A4 lượt sau.
// - 24/11 tối (chủ dự án): sổ ghi thêm KHỔ đã in (s.k: "nhiet" | "a4") → thẻ ĐÃ IN hiện khổ (🧾 99×154 / 📄 A4) + số lần IN LẠI
//   + giờ in lại gần nhất; bộ lọc "↻ Đã in lại"; mỗi thẻ đã in có ô chọn KHỔ IN LẠI (mặc định = khổ đã in); in lại nhiều tách
//   2 nút theo khổ ("↻ In lại N phiếu 99×154" / "↻ In lại M phiếu A4").
// KHÔNG đọc / ghi Google Sheet, KHÔNG đụng file nào của PDF trang vận hành.
// =========================================================================
(function () {
  "use strict";
  if (document.getElementById("pg-khung")) return;
  const CH = window.PHIEU_GOP_CAU_HINH || { tiLe: 0.8 };
  const NGUONG_A4 = CH.nguongA4 >= 2 ? CH.nguongA4 : 2;
  const D = window.DungPhieuGop;
  const THU_MUC = ((document.currentScript && document.currentScript.src) || "").replace(/[^/]*$/, "") || "phieu_gop/"; // để mở trang 🎨 Mẫu phiếu gộp
  const sheet3 = document.getElementById("sheet-3");
  const vungIn = document.getElementById("print-only-zone");
  const invoiceArea = document.getElementById("invoiceArea");
  if (!sheet3 || !vungIn || !invoiceArea || !D) { console.warn("[PhieuGop] Thiếu thành phần trang — không dựng khung."); return; }

  // ---------------- Sổ đã in ----------------
  const KHOA_SO = "zzm_phieu_gop_so_v1", HAN = 7 * 24 * 3600 * 1000;
  let so = null;
  function docSo() {
    if (so) return so;
    try { so = JSON.parse(localStorage.getItem(KHOA_SO) || "null"); } catch (er) { so = null; }
    if (!so || typeof so !== "object") so = {};
    ["d", "v", "r", "k"].forEach(function (k) { if (!so[k] || typeof so[k] !== "object") so[k] = {}; }); // k: khổ đã in (24/11)
    const gioiHan = Date.now() - HAN;
    ["d", "v"].forEach(function (k) { Object.keys(so[k]).forEach(function (m) { if (so[k][m] < gioiHan) delete so[k][m]; }); });
    Object.keys(so.k).forEach(function (m) { if (!so.d[m]) delete so.k[m]; });
    Object.keys(so.r).forEach(function (m) { so.r[m] = (so.r[m] || []).filter(function (t) { return t >= gioiHan; }); if (!so.r[m].length) delete so.r[m]; });
    return so;
  }
  function ghiSo() { try { localStorage.setItem(KHOA_SO, JSON.stringify(so)); } catch (er) { console.warn("[PhieuGop] Không lưu được sổ đã in:", er); } }
  window.addEventListener("storage", function (ev) { if (ev.key === KHOA_SO) { so = null; tinh(); } });

  // ---------------- Trạng thái ----------------
  const tt = { tep: [], loc: "khop", dangDung: false, pdfVua: null, gon: false, a4: new Set(), dem: new Map(), lanDem: 0, chonLai: new Set(), huy: false, khoLai: new Map() };
  // KHỔ: đã in bằng khổ nào (sổ) · in lại khổ nào (người dùng chọn, mặc định = khổ đã in)
  function khoDaIn(ma) { const k = docSo().k[ma]; return k === "a4" || k === "nhiet" ? k : (tt.a4.has(ma) ? "a4" : "nhiet"); }
  function khoLai(ma) { return tt.khoLai.get(ma) || khoDaIn(ma); }
  function soLanLai(ma) { return (docSo().r[ma] || []).length; }
  const TEN_KHO = { nhiet: "🧾 99×154", a4: "📄 A4" };
  try { tt.gon = localStorage.getItem("zzm_phieu_gop_gon") === "1"; } catch (er) { /* bỏ qua */ }
  let ket = { don: [], trangThua: [], trangMoHo: [] };

  // ---------------- Giao diện ----------------
  const css = document.createElement("style");
  // 24/11 tối (chủ dự án): chữ trong khung + hộp thoại TO HƠN cho người thị lực kém — mọi cỡ chữ px × TANG_CHU (chỉ giao diện)
  const TANG_CHU = 1.15;
  css.textContent = [
    ".pg-k{margin:8px 12px 0;border:1px solid #c4c7cc;border-radius:10px;background:#f6f9fb;font-size:13px;color:#202124;overflow-wrap:anywhere}",
    ".pg-k.dang-keo{background:#d6ecf5;border-color:#0f6e8c;box-shadow:0 0 0 2px #0f6e8c inset}",
    ".pg-dau{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 10px}",
    ".pg-ten{font-weight:700;font-size:13.5px}.pg-ten small{font-weight:400;color:#5f6368}",
    ".pg-nut{border:1px solid #b8bcc3;background:#fff;border-radius:6px;padding:6px 12px;font-weight:600;font-size:13px;cursor:pointer;white-space:nowrap;color:#202124;font-family:inherit}",
    ".pg-nut.nho{padding:3px 9px;font-size:12px;font-weight:500}.pg-nut.xam{color:#5f6368;font-weight:500}.pg-nut:disabled{opacity:.5;cursor:not-allowed}",
    ".pg-tt{color:#5f6368;font-size:12.5px}.pg-tt b{color:#202124}",
    ".pg-phai{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap}",
    ".pg-chip{display:inline-block;border:1px solid #dadce0;background:#fff;border-radius:12px;padding:1px 8px;font-size:12px}",
    ".pg-chip.xanh{color:#137333;border-color:#a8dab5;background:#e6f4ea}.pg-chip.do{color:#c5221f;border-color:#f6aea9;background:#fce8e6}",
    ".pg-chi{display:inline-block;border:1px solid #dadce0;border-radius:12px;padding:0 7px;font-size:11.5px;background:#fff;color:#3c4043;margin-left:2px}",
    ".pg-tep{margin:0 10px 6px;font-size:12px;display:flex;flex-wrap:wrap;gap:4px 6px;align-items:center}",
    ".pg-tep span{background:#fff;border:1px solid #dadce0;border-radius:6px;padding:1px 4px 1px 8px;display:inline-flex;gap:4px;align-items:center}",
    ".pg-tep button{border:none;background:none;cursor:pointer;color:#d93025;font-size:13px;padding:0 4px}",
    // 24/11: file không khớp tờ đơn nào của lần in → ĐỎ CHÓI (giống ô 📦)
    ".pg-tep span.f-canh{background:#d93025;border-color:#a50e0e;color:#fff;font-weight:700;box-shadow:0 0 0 2px #fce8e6}",
    ".pg-tep span.f-canh button{color:#fff}",
    ".pg-tep span.f-canh-chu{flex:1 1 100%;color:#c5221f;font-weight:700;background:none;border:none;padding:0}",
    ".pg-gon-do{flex:1 1 100%;background:#d93025;color:#fff;font-weight:700;border-radius:8px;padding:6px 10px;font-size:13px}",
    ".pg-hop .lech{margin:0 0 12px;padding:8px 12px;border:1.5px solid #d93025;background:#fce8e6;border-radius:8px;color:#3c4043;font-size:13px;max-height:45vh;overflow:auto}",
    ".pg-hop .lech b.td{color:#c5221f}.pg-hop .lech ul{margin:4px 0 8px;padding-left:20px}.pg-hop .lech code{font-family:Consolas,monospace;font-weight:700}",
    ".pg-bt{margin:0 10px 8px;border:1.5px solid #d93025;background:#fce8e6;border-radius:8px;padding:8px 12px;color:#3c4043}",
    ".pg-bt h4{margin:0 0 4px;color:#c5221f;font-size:13.5px}.pg-bt ul{margin:0 0 4px;padding-left:20px}",
    ".pg-bao{margin:0 10px 8px;border:1px solid #dadce0;background:#fff;border-radius:8px;padding:8px 12px;color:#3c4043}",
    ".pg-loc{display:flex;flex-wrap:wrap;gap:6px;padding:0 10px 6px}",
    ".pg-loc button{border:1px solid #dadce0;background:#fff;border-radius:16px;padding:5px 11px;font-size:12.5px;cursor:pointer;font-family:inherit;color:#202124}",
    ".pg-loc button .so{display:inline-block;min-width:18px;padding:0 6px;border-radius:9px;background:#f1f3f4;margin-left:4px;font-weight:700;text-align:center}",
    ".pg-loc button.dang{background:#202124;color:#fff;border-color:#202124}.pg-loc button.dang .so{background:#fff;color:#202124}",
    ".pg-loc .l-xanh .so{background:#1e8e3e;color:#fff}.pg-loc .l-do .so{background:#d93025;color:#fff}.pg-loc .l-tim .so{background:#8430ce;color:#fff}",
    ".pg-ds{margin:0 10px;background:#fff;border:1px solid #e0e3e7;border-radius:8px;max-height:46vh;overflow:auto}",
    ".pg-td{display:grid;grid-template-columns:44px 1fr 96px 1fr;gap:8px;padding:6px 12px;font-size:11px;font-weight:700;color:#5f6368;position:sticky;top:0;background:#fff;z-index:1}",
    ".pg-the{display:grid;grid-template-columns:44px 1fr 96px 1fr;gap:8px;align-items:center;margin:6px 8px;border:2px solid #a8dab5;border-radius:10px;background:#fbfefb;padding:8px 6px}",
    ".pg-the.lech{border-color:#f6aea9;background:#fffafa}.pg-the.da-in{border-color:#d7aefb;background:#fdf9ff}",
    ".pg-the .so-to{text-align:center;font-size:15px;font-weight:600}",
    ".pg-o{display:flex;gap:10px;align-items:center;min-width:0}",
    ".pg-anh{flex:none;width:44px;height:62px;border:1px solid #dadce0;border-radius:4px;background:#fff center/contain no-repeat;display:flex;align-items:center;justify-content:center;font-size:20px}",
    ".pg-ma{font-family:Consolas,monospace;font-weight:700;font-size:12.5px}.pg-mo{color:#5f6368;font-size:12px;margin-top:2px}",
    ".pg-giua{text-align:center;font-size:11px;font-weight:700;line-height:1.3}.pg-giua .dau{font-size:20px;display:block}",
    ".pg-giua.k1{color:#1e8e3e}.pg-giua.k2{color:#d93025}.pg-giua.k3{color:#8430ce}.pg-trong{color:#9aa0a6;font-size:12px;font-style:italic}",
    ".pg-rong{padding:14px;text-align:center;color:#5f6368}",
    ".pg-chan{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:8px 10px}",
    ".pg-vua{font-size:12px;color:#3c4043;display:flex;gap:6px;align-items:center;flex-wrap:wrap}",
    ".pg-nut-in{border:none;border-radius:7px;padding:7px 14px;font-size:13px;font-weight:700;cursor:pointer;color:#fff;background:#1e8e3e;font-family:inherit;margin-left:auto}",
    ".pg-nut-in small{font-weight:400;font-size:11px;opacity:.95;margin-left:4px}.pg-nut-in:disabled{background:#9aa0a6;cursor:not-allowed}",
    ".pg-chan2{padding:0 10px 8px;display:flex;flex-wrap:wrap;gap:8px;font-size:12px}",
    ".pg-chan2 span{border:1px dashed #b8bcc3;border-radius:6px;padding:3px 8px;color:#3c4043}",
    ".pg-dang{padding:0 10px 8px;color:#1a73e8;font-weight:600}",
    ".pg-k.gon .pg-mo-rong{display:none}.pg-k:not(.gon) .pg-thu-gon{display:none}",
    ".pg-nen{position:fixed;inset:0;background:rgba(32,33,36,.55);display:flex;align-items:center;justify-content:center;padding:16px;z-index:100000}",
    ".pg-hop{background:#fff;border-radius:12px;max-width:440px;width:100%;padding:18px;box-shadow:0 8px 30px rgba(0,0,0,.25);font-size:14px;color:#202124}",
    ".pg-hop h3{margin:0 0 8px;font-size:16px}.pg-hop p,.pg-hop .pg-nd{margin:0 0 14px;color:#3c4043;line-height:1.45}",
    ".pg-hop .hang{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}",
    ".pg-hop .xanh{background:#1e8e3e;color:#fff;border-color:#1e8e3e}.pg-hop .do{color:#d93025;border-color:#d93025}",
    "@media (max-width:600px){.pg-td{display:none}.pg-the{grid-template-columns:30px 1fr;row-gap:6px}.pg-the .pg-giua{grid-column:2;text-align:left}" +
      ".pg-the .pg-giua .dau{display:inline;font-size:14px;margin-right:4px}.pg-the .pg-o.don-o{grid-column:2}.pg-nut-in{flex:1 1 100%;margin-left:0}.pg-phai{margin-left:0}}",
    ".pg-a4{display:inline-flex;align-items:center;gap:4px;margin-top:4px;font-size:12px;font-weight:600;color:#1a73e8;cursor:pointer;white-space:nowrap}",
    ".pg-a4 input{width:15px;height:15px;margin:0;cursor:pointer}",
    // 24/11 tối (chủ dự án): đơn NÊN IN A4 nổi bật — thẻ viền + nền XANH DƯƠNG (khác thẻ khớp xanh lá), nhãn gợi ý nền xanh chữ trắng
    ".pg-goi-y{display:inline-block;margin-top:3px;border:1px solid #1a73e8;color:#fff;background:#1a73e8;border-radius:6px;padding:2px 7px;font-size:11.5px;font-weight:700;line-height:1.3}",
    ".pg-the.goi-y-a4{border-color:#1a73e8;background:#e8f0fe}",
    ".pg-the.chon-a4{border-color:#1a73e8;border-width:3px;background:#d2e3fc}",
    ".pg-the.goi-y-a4 .pg-giua.k1,.pg-the.chon-a4 .pg-giua.k1{color:#1a73e8}",
    ".pg-loc .l-xanh-duong .so{background:#1a73e8;color:#fff}",
    ".pg-nut-in.a4{background:#1a73e8;margin-left:0}",
    ".pg-nut-in.lai{background:#8430ce;margin-left:0}",
    ".pg-lai{display:inline-flex;align-items:center;gap:4px;margin-top:4px;font-size:12px;font-weight:600;color:#8430ce;cursor:pointer;white-space:nowrap}",
    ".pg-lai input{width:15px;height:15px;margin:0;cursor:pointer}.pg-the.chon-lai{border-color:#8430ce;background:#f6efff}",
    ".pg-loc .pg-chon{border-style:dashed}",
    ".pg-kho{display:inline-block;margin-top:3px;border-radius:6px;padding:1px 6px;font-size:11px;font-weight:700;border:1px solid #5f6368;color:#3c4043;background:#fff}",
    ".pg-kho.a4{border-color:#1a73e8;color:#1a73e8;background:#e8f0fe}",
    ".pg-da-lai{display:inline-block;margin-top:3px;border-radius:6px;padding:1px 6px;font-size:11px;font-weight:700;color:#fff;background:#8430ce}",
    ".pg-the.da-in-lai{border-color:#8430ce;border-width:3px}",
    ".pg-kho-lai{margin-top:4px;font-size:12px;color:#3c4043}.pg-kho-lai select{font:inherit;font-size:12px;padding:1px 2px;border:1px solid #c4c7cc;border-radius:5px}",
    "@media (max-width:600px){.pg-nut-in.lai{flex:1 1 100%}}",
    "@media (max-width:600px){.pg-nut-in.a4{flex:1 1 100%}}",
    "@media print{.pg-k,.pg-nen{display:none!important}}",
  ].join("\n").replace(/font-size:\s*([\d.]+)px/g, function (_, n) { return "font-size:" + (Math.round(n * TANG_CHU * 10) / 10) + "px"; });
  document.head.appendChild(css);

  const khung = document.createElement("div");
  khung.id = "pg-khung"; khung.className = "pg-k no-print" + (tt.gon ? " gon" : "");
  const chonTep = document.createElement("input"); chonTep.type = "file"; chonTep.accept = "application/pdf,.pdf"; chonTep.multiple = true; chonTep.hidden = true;
  khung.innerHTML =
    '<div class="pg-dau pg-thu-gon"><span class="pg-ten">🧾 Phiếu gộp</span><span id="pg-gon-tt"></span><span class="pg-phai"><button type="button" class="pg-nut" data-lam="gon">Mở rộng ▾</button></span></div>' +
    '<div class="pg-mo-rong">' +
      '<div class="pg-dau"><span class="pg-ten">🧾 Phiếu gộp <small>— phiếu đóng gói + tờ đơn trên 1 tờ</small></span>' +
        '<button type="button" class="pg-nut" data-lam="them">➕ Thêm file PDF</button>' +
        '<button type="button" class="pg-nut" data-lam="mau" title="Chỉnh cỡ chữ, phông, cách in phiếu gộp (mở tab mới)">🎨 Mẫu phiếu gộp</button>' +
        '<span class="pg-tt" id="pg-tt"></span>' +
        '<span class="pg-phai"><button type="button" class="pg-nut xam" data-lam="xoa-so" id="pg-xoa-so">🗑 Xóa sổ đã in</button><button type="button" class="pg-nut" data-lam="gon">Thu gọn ▴</button></span></div>' +
      '<div class="pg-tep" id="pg-tep"></div>' +
      '<div id="pg-bt"></div>' +
      '<div class="pg-loc" id="pg-loc"></div>' +
      '<div class="pg-ds" id="pg-ds"></div>' +
      '<div class="pg-dang" id="pg-dang" hidden></div>' +
      '<div class="pg-chan"><span class="pg-vua" id="pg-vua"></span><button type="button" class="pg-nut-in lai" id="pg-nut-lai" data-lam="in-lai-nhieu" data-kho="nhiet" hidden></button><button type="button" class="pg-nut-in lai" id="pg-nut-lai-a4" data-lam="in-lai-nhieu" data-kho="a4" hidden></button><button type="button" class="pg-nut-in a4" id="pg-nut-a4" data-lam="in-a4" hidden></button><button type="button" class="pg-nut-in" id="pg-nut-in" data-lam="in"></button></div>' +
      '<div class="pg-chan2" id="pg-chan2"></div>' +
    "</div>";
  khung.appendChild(chonTep);
  invoiceArea.parentNode.insertBefore(khung, invoiceArea);
  const $ = function (id) { return document.getElementById(id); };

  // ---------------- Tờ đơn trên màn hình ----------------
  function docToDon() {
    const ds = [];
    vungIn.querySelectorAll(".invoice-box").forEach(function (box) {
      const chu = box.getAttribute("data-copy-text") || "";
      const m = chu.match(/ĐƠN:\s*(\S+)/); if (!m) return;
      // 24/11: MVĐ chỉ lấy trên CÙNG dòng (trước đây \s* nuốt xuống dòng → MVĐ trống thì lấy nhầm đường kẻ "━━━" dòng sau)
      const vd = (chu.match(/VĐ:[ \t]*(\S*)/) || [])[1] || "";
      const skus = [], soSp = { n: 0 };
      chu.split("\n").forEach(function (dong) {
        // 24/11: SL = phần sau " x" CUỐI (giữ được cả "(thiếu SL)" có dấu cách — trước đây dòng đó bị bỏ sót)
        const x = dong.match(/^(?:\[[^\]]*\]\s*)?(\S.*)\s+x(\S.*?)\s*$/);
        if (x && !/^(📦|🚚|💰|⚠)/.test(dong)) { skus.push(x[1].trim()); soSp.n += parseInt(x[2], 10) || 0; }
      });
      ds.push({ ma: m[1].trim(), vd: vd, box: box, skus: skus, soSp: soSp.n, soMon: skus.length });
    });
    return ds;
  }

  // ---------------- Ghép ----------------
  function tinh() {
    const dsDon = docToDon();
    const maDon = new Map(); dsDon.forEach(function (d, i) { d.to = i + 1; d.nhan = []; maDon.set(d.ma.toUpperCase(), d); });
    const daThay = new Set(), thua = [], moHo = [];
    tt.tep.forEach(function (tep) {
      tep.trang.forEach(function (tr) {
        if (daThay.has(tr.vanTay)) return; daThay.add(tr.vanTay);
        const trung = tr.cum.filter(function (c) { return maDon.has(c); });
        if (trung.length === 1) maDon.get(trung[0]).nhan.push({ tep: tep, trang: tr });
        else if (trung.length > 1) moHo.push({ tep: tep, trang: tr, ma: trung });
        else thua.push({ tep: tep, trang: tr });
      });
    });
    const s = docSo();
    dsDon.forEach(function (d) {
      const daIn = s.d[d.ma] || (d.nhan.length && d.nhan.every(function (n) { return s.v[n.trang.vanTay]; }) ? Math.max.apply(null, d.nhan.map(function (n) { return s.v[n.trang.vanTay]; })) : 0);
      d.luc = daIn || 0;
      d.loai = d.nhan.length === 0 ? "thieu" : (daIn ? "dain" : "khop");
    });
    ket = { don: dsDon, trangThua: thua, trangMoHo: moHo };
    ve();
    capNhatDem();
  }

  // ---------------- Đo số tờ 99×154 → gợi ý in A4 (24/11) ----------------
  // Chạy NỀN từng nhóm 8 đơn (không làm đứng trang); kết quả nhớ theo mã đơn + danh sách mã + số trang nhãn + tỉ lệ.
  function khoaDem(x) { return x.skus.join("|") + "#" + x.nhan.length + "#" + CH.tiLe; }
  function soToDs(x) { const k = tt.dem.get(x.ma); return k && k.khoa === khoaDem(x) ? k.toDoDs : 0; }
  function goiYA4(x) { return soToDs(x) >= NGUONG_A4; }
  function capNhatDem() {
    if (typeof D.demTo !== "function") return;
    const can = ket.don.filter(function (x) { return x.loai !== "thieu" && x.nhan.length && !(tt.dem.has(x.ma) && tt.dem.get(x.ma).khoa === khoaDem(x)); });
    if (!can.length) return;
    const lan = ++tt.lanDem;
    (async function () {
      for (let i = 0; i < can.length;) {
        await new Promise(function (ok) { setTimeout(ok, tt.dangDung ? 400 : 0); });
        if (lan !== tt.lanDem) return;      // đã có lần tính mới hơn
        if (tt.dangDung) continue;           // đang dựng phiếu (dùng chung khung dựng) → chờ
        const nhom = can.slice(i, i + 8); i += 8;
        try {
          D.demTo(nhom, CH.tiLe).forEach(function (k) { const x = nhom.find(function (y) { return y.ma === k.ma; }); if (x) tt.dem.set(k.ma, { khoa: khoaDem(x), toDoDs: k.toDoDs }); });
        } catch (er) { console.warn("[PhieuGop] Lỗi đo số tờ:", er); }
      }
      if (lan === tt.lanDem) ve();
    })();
  }

  // ---------------- Lệch (24/11) ----------------
  function vanTayKhop() { const v = new Set(); ket.don.forEach(function (d) { d.nhan.forEach(function (n) { v.add(n.trang.vanTay); }); }); return v; }
  function soKhopTep(t) { const v = vanTayKhop(); return t.trang.filter(function (tr) { return v.has(tr.vanTay); }).length; }
  // file KHÔNG có trang nào khớp tờ đơn của lần in (chỉ xét khi đã có tờ đơn); file lỗi / trống cũng tính
  function tepKhongKhop() { if (!ket.don.length) return []; const v = vanTayKhop(); return tt.tep.filter(function (t) { return !t.trang.some(function (tr) { return v.has(tr.vanTay); }); }); }
  function moTaLech(nThieu, nThua, nTep) {
    const ds = [];
    if (nThua) ds.push(nThua + " phiếu không có tờ đơn");
    if (nThieu) ds.push(nThieu + " tờ đơn thiếu phiếu");
    if (nTep) ds.push(nTep + " file không khớp");
    return ds.join(" · ");
  }
  function maCuaTrang(t) {
    return t.trang.cum.find(function (c) { return /^\d{6}[0-9A-Z]{8}$/.test(c) && /[A-Z]/.test(c.slice(6)); }) || t.trang.cum.find(function (c) { return /^\d{18}$/.test(c); }) || "";
  }
  // Bấm In khi phiên còn lệch → BẮT BUỘC xác nhận (chủ dự án 24/11: phiếu không có tờ đơn KHÔNG được in mà không ai biết)
  function xacNhanIn(soIn, tenPhieu, lam) {
    const thieu = ket.don.filter(function (x) { return x.loai === "thieu"; }), tepLech = tepKhongKhop();
    const thua = ket.trangThua, moHo = ket.trangMoHo;
    if (!thieu.length && !thua.length && !moHo.length && !tepLech.length) { lam(); return; }
    const toiDa = 15;
    const ds = function (mang, chu) { return "<ul>" + mang.slice(0, toiDa).map(function (x) { return "<li>" + chu(x) + "</li>"; }).join("") + (mang.length > toiDa ? "<li>… và " + (mang.length - toiDa) + " mục khác</li>" : "") + "</ul>"; };
    let h = '<div class="lech">';
    if (thua.length || moHo.length) h += '<b class="td">⛔ ' + (thua.length + moHo.length) + " phiếu đóng gói KHÔNG có tờ đơn — sẽ KHÔNG được in:</b>" +
      ds(moHo.map(function (t) { return { t: t, nhieu: true }; }).concat(thua.map(function (t) { return { t: t }; })), function (x) {
        const ma = x.nhieu ? x.t.ma.join(" · ") : maCuaTrang(x.t);
        return (ma ? "<code>" + esc(ma) + "</code>" : "<i>không đọc được mã đơn</i>") + " — trang " + x.t.trang.p + (tt.tep.length > 1 ? " · " + esc(x.t.tep.ten) : "") + (x.nhieu ? " (trang có nhiều mã)" : "");
      });
    if (thieu.length) h += '<b class="td">⛔ ' + thieu.length + " tờ đơn KHÔNG có phiếu đóng gói — sẽ KHÔNG được in:</b>" + ds(thieu, function (x) { return "<code>" + esc(x.ma) + "</code> — tờ " + x.to; });
    if (tepLech.length) h += '<b class="td">⚠ ' + tepLech.length + " file PDF không khớp tờ đơn nào (có thể là file phiên trước):</b>" + ds(tepLech, function (t) { return esc(t.ten); });
    h += "</div>";
    hop("⛔ PHIÊN CÒN LỆCH — kiểm tra trước khi in",
      h + "Chỉ <b>" + soIn + " " + tenPhieu + "</b> khớp được in. Các đơn ở trên phải xử lý riêng (thêm đơn vào Bảng 3 rồi Tạo mẫu in lại, hoặc thêm file PDF còn thiếu) — <b>không thì sẽ bị sót đơn</b>.",
      [{ chu: "← Quay lại xử lý", lam: function () { tt.loc = "can"; ve(); } },
        { chu: "Vẫn in " + soIn + " " + tenPhieu + " khớp", lop: "do", lam: lam }]);
  }

  // ---------------- Vẽ ----------------
  function gio(t) { const d = new Date(t); return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function soTrang() { return tt.tep.reduce(function (s, t) { return s + t.trang.length; }, 0); }
  function ve() {
    const d = ket.don, khop = d.filter(function (x) { return x.loai === "khop"; }), thieu = d.filter(function (x) { return x.loai === "thieu"; });
    const dain = d.filter(function (x) { return x.loai === "dain"; }), daLai = dain.filter(function (x) { return soLanLai(x.ma) > 0; });
    const khopA4 = khop.filter(function (x) { return tt.a4.has(x.ma); }), khopNhiet = khop.filter(function (x) { return !tt.a4.has(x.ma); });
    const nhomA4 = khop.filter(function (x) { return goiYA4(x) || tt.a4.has(x.ma); }), goiYChuaChon = khop.filter(function (x) { return goiYA4(x) && !tt.a4.has(x.ma); });
    const nThua = ket.trangThua.length, nMoHo = ket.trangMoHo.length, nCan = thieu.length + nThua + nMoHo;
    const tepLech = tepKhongKhop(), nTepLech = tepLech.length;
    const nSo = Object.keys(docSo().d).length;
    $("pg-tt").innerHTML = "📄 <b>" + soTrang() + " trang</b> · " + d.length + " tờ đơn" + '<span class="pg-chi">' + D.GIAY.W_MM + "×" + D.GIAY.H_MM + ' mm</span><span class="pg-chi">tờ đơn ' + Math.round(CH.tiLe * 100) + "%</span>";
    $("pg-xoa-so").textContent = "🗑 Xóa sổ đã in" + (nSo ? " (" + nSo + " mã)" : "");
    $("pg-xoa-so").hidden = !nSo;
    $("pg-tep").innerHTML = tt.tep.length ? "📎 " + tt.tep.map(function (t, i) {
        const lech = tepLech.indexOf(t) >= 0;
        return "<span" + (lech ? ' class="f-canh" title="Không khớp tờ đơn nào của lần in hiện tại"' : "") + ">" + (lech ? "⚠ " : "") + esc(t.ten) + " · " + t.trang.length + " trang" +
          (d.length ? " · khớp " + soKhopTep(t) : "") + '<button type="button" data-lam="bo-tep" data-i="' + i + '" title="Bỏ file này">✕</button></span>';
      }).join("") +
      (tt.tep.length > 1 ? '<button type="button" class="pg-nut nho" data-lam="bo-het">Bỏ hết file</button>' : "") +
      (nTepLech ? '<span class="f-canh-chu">⚠ ' + nTepLech + " file không khớp tờ đơn nào của lần in hiện tại — có thể là file của phiên trước → kiểm tra rồi bấm ✕ để bỏ file</span>" : "") : "";
    $("pg-gon-tt").innerHTML = '<span class="pg-chip">📄 ' + soTrang() + " trang · " + d.length + " tờ đơn</span> " +
      (khop.length ? '<span class="pg-chip xanh">🖨 Còn ' + khop.length + " đơn chưa in — Mở rộng để in</span> " : (d.length && !nCan && dain.length ? '<span class="pg-chip xanh">✅ Đã in xong</span> ' : "")) +
      (nCan ? '<span class="pg-chip do">⚠ ' + nCan + " cần xử lý</span>" : "") +
      (d.length && tt.tep.length && (nCan || nTepLech) ? '<span class="pg-gon-do">⛔ PHIÊN CÒN LỆCH: ' + moTaLech(thieu.length, nThua + nMoHo, nTepLech) + " — bấm <b>Mở rộng</b> để xử lý trước khi in</span>" : "");
    // khung bất thường / hướng dẫn
    let bt = "";
    if (!d.length) bt = '<div class="pg-bao">Chưa có tờ đơn — sang tab <b>Tạo Đơn Hàng</b> bấm <b>TẠO MẪU IN ĐƠN</b>. File PDF thả vào trước vẫn được giữ.</div>';
    else if (!tt.tep.length) bt = '<div class="pg-bao">Thả file PDF phiếu đóng gói Shopee / TikTok vào khung này (hoặc bấm <b>➕ Thêm file PDF</b>). Thả nhiều file một lúc được, các file được cộng dồn.</div>';
    else if (nCan || nTepLech) bt = '<div class="pg-bt"><h4>⛔ PHIÊN NÀY CÓ BẤT THƯỜNG — xử lý trước khi in phần lệch</h4><ul>' +
      (nTepLech ? "<li><b>" + nTepLech + "</b> file PDF KHÔNG khớp tờ đơn nào của lần in hiện tại (dòng file tô đỏ) — có thể là file của phiên trước</li>" : "") +
      (thieu.length ? "<li><b>" + thieu.length + "</b> tờ đơn KHÔNG có phiếu đóng gói — nếu phiếu nằm ở <b>file PDF khác</b>, bấm <b>➕ Thêm file PDF</b>; các file được cộng dồn</li>" : "") +
      (nThua ? "<li><b>" + nThua + "</b> phiếu đóng gói KHÔNG có tờ đơn lấy hàng</li>" : "") +
      (nMoHo ? "<li><b>" + nMoHo + "</b> trang phiếu có từ 2 mã đơn trở lên — không tự ghép được, kiểm tra lại</li>" : "") +
      "</ul>Các cặp <b>KHỚP</b> vẫn in an toàn bằng nút bên dưới. Bấm <b>⚠ Cần xử lý</b> để chỉ xem các trường hợp này.</div>";
    $("pg-bt").innerHTML = bt;
    const nut = function (l, ten, n, lop) { return '<button type="button" data-loc="' + l + '" class="' + (lop || "") + (tt.loc === l ? " dang" : "") + '">' + ten + '<span class="so">' + n + "</span></button>"; };
    $("pg-loc").innerHTML = nut("tat", "Tất cả", d.length + nThua + nMoHo) + nut("khop", "✓ Khớp — chưa in", khop.length, "l-xanh") + nut("can", "⚠ Cần xử lý", nCan, "l-do") +
      nut("thieu", "Thiếu phiếu đóng gói", thieu.length) + nut("thua", "Phiếu không có tờ đơn", nThua + nMoHo) + nut("dain", "🖨 Đã in", dain.length, "l-tim") +
      (nhomA4.length || tt.loc === "a4" ? nut("a4", "📄 Nên in A4", nhomA4.length, "l-xanh-duong") : "") +
      (daLai.length || tt.loc === "lai" ? nut("lai", "↻ Đã in lại", daLai.length, "l-tim") : "") +
      ((tt.loc === "dain" || tt.loc === "lai") && dain.length ? '<button type="button" class="pg-chon" data-lam="chon-het-lai">☑ Chọn hết in lại</button>' + (tt.chonLai.size ? '<button type="button" class="pg-chon" data-lam="bo-chon-lai">☐ Bỏ chọn</button>' : "") : "");
    // danh sách
    const copy = function (ma) { return ' <button type="button" class="pg-nut nho" style="padding:1px 7px;font-size:11px" data-lam="copy" data-ma="' + esc(ma) + '">📋 Copy</button>'; };
    const anhPhieu = function (n) { return n ? '<div class="pg-anh" style="background-image:url(' + n.trang.anh + ')"></div>' : '<div class="pg-anh">✕</div>'; };
    const theDon = function (x) {
      const n0 = x.nhan[0];
      const phieu = n0 ? '<div class="pg-o">' + anhPhieu(n0) + '<div><span class="pg-ma">' + esc(x.ma) + "</span>" + copy(x.ma) + '<div class="pg-mo">Trang ' + x.nhan.map(function (n) { return n.trang.p; }).join(", ") +
          (tt.tep.length > 1 ? " · " + esc(n0.tep.ten) : "") + "</div>" + (n0.trang.mvd ? '<div class="pg-mo">MVĐ: ' + esc(n0.trang.mvd) + "</div>" : "") + "</div></div>"
        : '<div class="pg-o"><div class="pg-anh">✕</div><span class="pg-trong">Chưa có trang PDF</span></div>';
      const giua = x.loai === "khop" ? '<div class="pg-giua k1"><span class="dau">✓</span>KHỚP' + (x.nhan.length > 1 ? "<br>" + x.nhan.length + " trang phiếu" : "") +
          (goiYA4(x) ? '<br><span class="pg-goi-y">📄 Đơn dài (' + soToDs(x) + " tờ) — nên in A4</span>" : "") +
          '<br><label class="pg-a4"><input type="checkbox" data-a4="' + esc(x.ma) + '"' + (tt.a4.has(x.ma) ? " checked" : "") + "> In A4</label></div>"
        : x.loai === "dain" ? (function () {
            const kd = khoDaIn(x.ma), kl = khoLai(x.ma), lai = docSo().r[x.ma] || [];
            return '<div class="pg-giua k3"><span class="dau">🖨</span>ĐÃ IN ' + gio(x.luc) + '<br><span class="pg-kho' + (kd === "a4" ? " a4" : "") + '" title="Khổ giấy đã in">' + TEN_KHO[kd] + "</span>" +
              (lai.length ? '<br><span class="pg-da-lai" title="Số lần in lại · giờ in lại gần nhất">↻ In lại ' + lai.length + " lần · " + gio(lai[lai.length - 1]) + "</span>" : "") +
              '<div class="pg-kho-lai">In lại khổ: <select data-kho-lai="' + esc(x.ma) + '"><option value="nhiet"' + (kl === "nhiet" ? " selected" : "") + ">🧾 99×154</option><option value=\"a4\"" + (kl === "a4" ? " selected" : "") + ">📄 A4</option></select></div>" +
              '<button type="button" class="pg-nut nho" style="margin-top:3px" data-lam="in-lai" data-ma="' + esc(x.ma) + '">↻ In lại</button>' +
              '<br><label class="pg-lai"><input type="checkbox" data-lai="' + esc(x.ma) + '"' + (tt.chonLai.has(x.ma) ? " checked" : "") + "> Chọn in lại</label></div>";
          })()
        : '<div class="pg-giua k2"><span class="dau">⚠</span>THIẾU PHIẾU</div>';
      const don = '<div class="pg-o don-o"><div class="pg-anh">🧾</div><div><span class="pg-ma">' + esc(x.ma) + "</span>" + copy(x.ma) + '<div class="pg-mo">Tờ ' + x.to + " · " + x.soMon + " món</div></div></div>";
      return '<div class="pg-the' + (x.loai === "dain" ? " da-in" + (soLanLai(x.ma) ? " da-in-lai" : "") + (tt.chonLai.has(x.ma) ? " chon-lai" : "") : x.loai === "thieu" ? " lech" : tt.a4.has(x.ma) ? " chon-a4" : (x.loai === "khop" && goiYA4(x) ? " goi-y-a4" : "")) + '"><span class="so-to">' + x.to + "</span>" + phieu + giua + don + "</div>";
    };
    const theTrang = function (t, moHo) {
      const ma = moHo ? t.ma.join(" · ") : (t.trang.cum.find(function (c) { return /^\d{6}[0-9A-Z]{8}$/.test(c) && /[A-Z]/.test(c.slice(6)); }) || t.trang.cum.find(function (c) { return /^\d{18}$/.test(c); }) || "");
      return '<div class="pg-the lech"><span class="so-to">–</span><div class="pg-o">' + anhPhieu(t) + "<div>" + (ma ? '<span class="pg-ma">' + esc(ma) + "</span>" + (moHo ? "" : copy(ma)) : '<span class="pg-trong">Không đọc được mã đơn</span>') +
        '<div class="pg-mo">Trang ' + t.trang.p + (tt.tep.length > 1 ? " · " + esc(t.tep.ten) : "") + "</div>" + (t.trang.mvd ? '<div class="pg-mo">MVĐ: ' + esc(t.trang.mvd) + "</div>" : "") + "</div></div>" +
        '<div class="pg-giua k2"><span class="dau">⚠</span>' + (moHo ? "TRANG CÓ<br>NHIỀU MÃ" : "KHÔNG CÓ<br>TỜ ĐƠN") + '</div><div class="pg-o don-o"><div class="pg-anh">✕</div><span class="pg-trong">Không có tờ đơn</span></div></div>';
    };
    let h = "";
    const l = tt.loc;
    d.forEach(function (x) { if (l === "tat" || l === x.loai || (l === "can" && x.loai === "thieu") || (l === "a4" && x.loai === "khop" && (goiYA4(x) || tt.a4.has(x.ma))) || (l === "lai" && x.loai === "dain" && soLanLai(x.ma) > 0)) h += theDon(x); });
    if (l === "tat" || l === "can" || l === "thua") { ket.trangMoHo.forEach(function (t) { h += theTrang(t, true); }); ket.trangThua.forEach(function (t) { h += theTrang(t, false); }); }
    $("pg-ds").innerHTML = h ? '<div class="pg-td"><span>TỜ</span><span>PHIẾU ĐÓNG GÓI (PDF)</span><span></span><span>ĐƠN LẤY HÀNG (WEB)</span></div>' + h
      : '<div class="pg-rong">' + (d.length || tt.tep.length ? "Không có mục nào trong nhóm này." : "Chưa có dữ liệu.") + "</div>";
    // thanh in
    $("pg-vua").innerHTML = tt.pdfVua ? "📄 PDF vừa tạo: <b>" + tt.pdfVua.tongTo + ' tờ</b> <button type="button" class="pg-nut nho" data-lam="mo-lai">🖨 Mở lại</button><button type="button" class="pg-nut nho" data-lam="tai-ve">⬇ Tải về</button>' : "";
    const nTo = khopNhiet.reduce(function (s, x) { return s + Math.max(1, x.nhan.length); }, 0);
    $("pg-nut-in").innerHTML = "🖨 In " + khopNhiet.length + " PHIẾU GỘP<small>cặp khớp · khổ " + D.GIAY.W_MM + "×" + D.GIAY.H_MM + (nTo > khopNhiet.length ? " · ≥ " + nTo + " tờ" : "") + "</small>";
    $("pg-nut-in").disabled = !khopNhiet.length || tt.dangDung;
    // chỉ giữ lựa chọn in lại của đơn đang ĐÃ IN
    Array.from(tt.chonLai).forEach(function (m) { if (!dain.some(function (x) { return x.ma === m; })) tt.chonLai.delete(m); });
    const laiNhiet = Array.from(tt.chonLai).filter(function (m) { return khoLai(m) === "nhiet"; }).length, laiA4 = tt.chonLai.size - laiNhiet;
    $("pg-nut-lai").hidden = !laiNhiet; $("pg-nut-lai").innerHTML = "↻ In lại " + laiNhiet + " phiếu 99×154<small>máy in nhiệt</small>"; $("pg-nut-lai").disabled = !laiNhiet || tt.dangDung;
    $("pg-nut-lai-a4").hidden = !laiA4; $("pg-nut-lai-a4").innerHTML = "↻ In lại " + laiA4 + " phiếu A4<small>máy in giấy A4</small>"; $("pg-nut-lai-a4").disabled = !laiA4 || tt.dangDung;
    $("pg-nut-a4").hidden = !khopA4.length;
    $("pg-nut-a4").innerHTML = "🖨 In " + khopA4.length + " PHIẾU A4<small>đơn dài · máy in giấy A4</small>";
    $("pg-nut-a4").disabled = !khopA4.length || tt.dangDung;
    const khongIn = [];
    if (thieu.length) khongIn.push("<b>" + thieu.length + "</b> thiếu phiếu");
    if (nThua + nMoHo) khongIn.push("<b>" + (nThua + nMoHo) + "</b> phiếu không có tờ đơn");
    $("pg-chan2").innerHTML = (khongIn.length ? "<span>ⓘ Không in: " + khongIn.join(" · ") + ".</span>" : "") +
      (goiYChuaChon.length ? "<span>📄 <b>" + goiYChuaChon.length + "</b> đơn dài nên in A4 — tích ô <b>In A4</b> ở đơn đó (bộ lọc <b>📄 Nên in A4</b>).</span>" : "") +
      (khopA4.length ? "<span>📄 Đã chọn in A4: <b>" + khopA4.length + "</b> đơn — KHÔNG nằm trong xấp " + D.GIAY.W_MM + "×" + D.GIAY.H_MM + ".</span>" : "");
  }

  // ---------------- Hộp thoại ----------------
  function hop(tieuDe, noiDung, cacNut) {
    const nen = document.createElement("div"); nen.className = "pg-nen";
    nen.innerHTML = '<div class="pg-hop" role="dialog"><h3>' + tieuDe + '</h3><div class="pg-nd">' + noiDung + '</div><div class="hang"></div></div>'; // 24/11: khối (chứa được danh sách)
    const hang = nen.querySelector(".hang");
    cacNut.forEach(function (n) {
      const b = document.createElement("button"); b.type = "button"; b.className = "pg-nut " + (n.lop || ""); b.textContent = n.chu;
      b.addEventListener("click", function () { nen.remove(); if (n.lam) n.lam(); });
      hang.appendChild(b);
    });
    document.body.appendChild(nen);
    const cuoi = hang.lastChild; if (cuoi) cuoi.focus();
  }

  // ---------------- Thêm / bỏ file ----------------
  async function themTep(files) {
    const ds = Array.from(files || []).filter(function (f) { return /\.pdf$/i.test(f.name) || f.type === "application/pdf"; });
    if (!ds.length) return;
    $("pg-dang").hidden = false;
    try {
      for (let i = 0; i < ds.length; i++) {
        const f = ds[i];
        if (tt.tep.some(function (t) { return t.ten === f.name && t.kichThuoc === f.size; })) continue;
        const bytes = new Uint8Array(await f.arrayBuffer());
        const kq = await D.docPdf(bytes, f.name, function (p, n) { $("pg-dang").textContent = "⏳ Đang đọc " + f.name + " — trang " + p + "/" + n + "…"; });
        kq.kichThuoc = f.size;
        tt.tep.push(kq);
      }
    } catch (er) {
      console.error("[PhieuGop] Lỗi đọc PDF:", er);
      hop("⚠ Không đọc được file PDF", "Kiểm tra lại file (đúng file PDF phiếu đóng gói tải từ sàn) và kết nối mạng, rồi thử lại.", [{ chu: "Đóng" }]);
    } finally {
      $("pg-dang").hidden = true; tinh();
    }
  }

  // ---------------- In ----------------
  // 23/11 tối: KHÔNG mở tab trống trước rồi ghi chữ vào (Chrome không chuyển tab đó sang PDF được → kẹt "Đang dựng 38/38").
  // Dựng xong → hộp thoại có nút "🖨 Mở file in": người dùng bấm = được phép mở tab mới → PDF hiện ngay.
  function moPdf(url) {
    const w = window.open(url, "_blank");
    if (!w) hop("⚠ Trình duyệt chặn mở tab mới", "Bấm <b>🖨 Mở lại</b> ở thanh dưới khung phiếu gộp để mở file in (hoặc cho phép cửa sổ bật lên cho trang này).", [{ chu: "Đóng" }]);
    return !!w;
  }
  function hopTienDo(chu) { // hộp chờ (không có nút) — cập nhật chữ trong lúc dựng
    let nen = document.getElementById("pg-cho");
    if (!nen) {
      nen = document.createElement("div"); nen.id = "pg-cho"; nen.className = "pg-nen";
      nen.innerHTML = '<div class="pg-hop" role="status"><h3>🧾 Đang dựng phiếu gộp</h3><p id="pg-cho-chu"></p><div class="hang"><button type="button" class="pg-nut do" id="pg-dung-lai">⏹ Dừng</button></div></div>';
      document.body.appendChild(nen);
      document.getElementById("pg-dung-lai").addEventListener("click", function () { tt.huy = true; this.disabled = true; this.textContent = "⏳ Đang dừng…"; });
    }
    document.getElementById("pg-cho-chu").textContent = chu;
    return function () { nen.remove(); };
  }
  async function inDon(dsDon, laInLai, tenKho) {
    const laA4 = tenKho === "a4", tenPhieu = laA4 ? "phiếu A4" : "phiếu gộp";
    if (tt.dangDung || !dsDon.length) return;
    tt.dangDung = true; tt.huy = false; ve();
    $("pg-dang").hidden = false;
    const batDau = Date.now();
    let dongCho = hopTienDo("⏳ Chuẩn bị " + dsDon.length + " phiếu…");
    try {
      const kq = await D.dung(dsDon, CH.tiLe, function (i, n) {
        const conLai = i ? Math.round((Date.now() - batDau) / i * (n - i) / 1000) : 0;
        const chu = "⏳ Đang dựng " + tenPhieu + " " + i + "/" + n + "…" + (i && n - i ? " còn khoảng " + (conLai >= 60 ? Math.ceil(conLai / 60) + " phút" : conLai + " giây") : (i === n ? " đang ghép file…" : ""));
        $("pg-dang").textContent = chu; hopTienDo(chu);
      }, laA4 ? "a4" : "nhiet", function () { return tt.huy; });
      dongCho(); dongCho = function () {};
      if (tt.pdfVua && tt.pdfVua.url) { try { URL.revokeObjectURL(tt.pdfVua.url); } catch (er) { /* bỏ qua */ } }
      const url = URL.createObjectURL(new Blob([kq.bytes], { type: "application/pdf" }));
      tt.pdfVua = { bytes: kq.bytes, tongTo: kq.tongTo, url: url };
      if (kq.loi.length) console.warn("[PhieuGop] Đơn có chữ bị tràn khi dựng:", kq.loi);
      const ma = dsDon.map(function (x) { return x.ma; });
      const vt = []; dsDon.forEach(function (x) { x.nhan.forEach(function (n) { vt.push(n.trang.vanTay); }); });
      const hoiDaIn = function () {
        hop("🖨 Đã in xong " + dsDon.length + " " + tenPhieu + " (" + kq.tongTo + " tờ) chưa?",
          "Chỉ bấm <b>Đã in xong</b> khi giấy đã ra máy in. Nếu đã bấm <b>Hủy</b> trong hộp in, hoặc máy in lỗi, chọn <b>Chưa in</b>." +
          (kq.loi.length ? "<br><br>⚠ " + kq.loi.length + " đơn có nội dung dài, kiểm tra lại tờ in: " + esc(kq.loi.join(", ")) : ""),
          [{ chu: "Chưa in" }, { chu: "✓ Đã in xong", lop: "xanh", lam: function () {
            const s = docSo(), bay = Date.now();
            ma.forEach(function (m) { if (laInLai && s.d[m]) { (s.r[m] = s.r[m] || []).push(bay); } else { s.d[m] = bay; s.k[m] = laA4 ? "a4" : "nhiet"; } tt.chonLai.delete(m); });
            vt.forEach(function (v) { if (!s.v[v]) s.v[v] = bay; });
            ghiSo(); tinh();
          } }]);
      };
      hop("✅ Đã dựng xong " + dsDon.length + " " + tenPhieu + " (" + kq.tongTo + " tờ)",
        "Bấm <b>🖨 Mở file in</b> → file PDF mở ở tab mới → " + (laA4 ? "in bằng <b>máy in giấy A4</b> (khổ A4, tỉ lệ 100%)" : "in bằng máy in nhiệt (khổ 99×154 mm, tỉ lệ 100%)") + ". (" + Math.round((Date.now() - batDau) / 1000) + " giây)",
        [{ chu: "Để sau" }, { chu: "🖨 Mở file in", lop: "xanh", lam: function () { moPdf(url); hoiDaIn(); } }]);
    } catch (er) {
      dongCho();
      if (er && er.daDung) { hop("⏹ Đã dừng", "Chưa tạo file in, <b>chưa ghi sổ đã in</b>. File PDF và kết quả ghép vẫn giữ nguyên — bấm In lại khi sẵn sàng.", [{ chu: "Đóng" }]); return; }
      console.error("[PhieuGop] Lỗi dựng phiếu gộp:", er);
      hop("⚠ Chưa dựng được phiếu gộp", "Kiểm tra kết nối mạng rồi bấm in lại. Nếu vẫn lỗi, tải lại trang (F5) và thả lại file PDF.", [{ chu: "Đóng" }]);
    } finally {
      tt.dangDung = false; $("pg-dang").hidden = true; ve();
    }
  }

  // ---------------- Sự kiện ----------------
  khung.addEventListener("click", function (ev) {
    const b = ev.target.closest("[data-lam],[data-loc]"); if (!b || !khung.contains(b)) return;
    if (b.hasAttribute("data-loc")) { tt.loc = b.getAttribute("data-loc"); ve(); return; }
    const lam = b.getAttribute("data-lam");
    if (lam === "gon") { tt.gon = !tt.gon; khung.classList.toggle("gon", tt.gon); try { localStorage.setItem("zzm_phieu_gop_gon", tt.gon ? "1" : "0"); } catch (er) { /* bỏ qua */ } return; }
    if (lam === "them") { chonTep.value = ""; chonTep.click(); return; }
    if (lam === "mau") { window.open(THU_MUC + "thiet_ke_phieu_gop.html", "_blank"); return; } // tab MỚI → không mất file / kết quả đang làm
    if (lam === "bo-tep") { tt.tep.splice(+b.getAttribute("data-i"), 1); tinh(); return; }
    if (lam === "bo-het") { if (window.confirm("Bỏ hết " + tt.tep.length + " file PDF khỏi khung phiếu gộp?")) { tt.tep = []; tinh(); } return; }
    if (lam === "copy") { const m = b.getAttribute("data-ma"); try { navigator.clipboard.writeText(m); b.textContent = "✓ Đã copy"; setTimeout(function () { b.textContent = "📋 Copy"; }, 1200); } catch (er) { window.prompt("Copy mã:", m); } return; }
    if (lam === "xoa-so") {
      hop("🗑 Xóa sổ đã in của phiếu gộp?", "Xóa toàn bộ ghi nhớ các đơn đã in phiếu gộp <b>trên máy này</b>. Sau khi xóa, các đơn đó sẽ hiện lại là <b>chưa in</b>.",
        [{ chu: "Không xóa" }, { chu: "Xóa sổ", lop: "do", lam: function () { try { localStorage.removeItem(KHOA_SO); } catch (er) { /* bỏ qua */ } so = null; tinh(); } }]);
      return;
    }
    if (lam === "in") { const ds = ket.don.filter(function (x) { return x.loai === "khop" && !tt.a4.has(x.ma); }); xacNhanIn(ds.length, "phiếu gộp", function () { inDon(ds, false, "nhiet"); }); return; }
    if (lam === "in-a4") { const ds = ket.don.filter(function (x) { return x.loai === "khop" && tt.a4.has(x.ma); }); xacNhanIn(ds.length, "phiếu A4", function () { inDon(ds, false, "a4"); }); return; }
    if (lam === "chon-het-lai") { ket.don.forEach(function (x) { if (x.loai === "dain" && (tt.loc !== "lai" || soLanLai(x.ma) > 0)) tt.chonLai.add(x.ma); }); ve(); return; }
    if (lam === "bo-chon-lai") { tt.chonLai.clear(); ve(); return; }
    if (lam === "in-lai-nhieu") { inLaiNhieu(b.getAttribute("data-kho")); return; }
    if (lam === "in-lai") { const x = ket.don.find(function (d) { return d.ma === b.getAttribute("data-ma"); }); if (x) inDon([x], true, khoLai(x.ma)); return; } // khổ = ô "In lại khổ" của thẻ (mặc định khổ đã in)
    if (lam === "mo-lai" && tt.pdfVua) { moPdf(tt.pdfVua.url); return; }
    if (lam === "tai-ve" && tt.pdfVua) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([tt.pdfVua.bytes], { type: "application/pdf" })); a.download = "phieu_gop_" + new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-") + ".pdf"; a.click(); return; }
  });
  chonTep.addEventListener("change", function () { themTep(chonTep.files); });
  // IN LẠI NHIỀU phiếu đã in (24/11 chiều)
  function inLaiNhieu(kho) {
    const ds = ket.don.filter(function (x) { return x.loai === "dain" && tt.chonLai.has(x.ma); });
    const laA4 = kho === "a4", lan = ds.filter(function (x) { return khoLai(x.ma) === (laA4 ? "a4" : "nhiet"); }), tenPhieu = laA4 ? "phiếu A4" : "phiếu gộp";
    if (!lan.length) return;
    const nhieu = lan.length >= 15;
    hop("↻ In lại " + lan.length + " " + tenPhieu + "?",
      '<div class="lech"' + (nhieu ? "" : ' style="border-color:#8430ce;background:#f6efff"') + "><b class=\"td\"" + (nhieu ? "" : ' style="color:#6a1fb0"') + ">" +
        (nhieu ? "⛔ IN LẠI NHIỀU (" + lan.length + " phiếu) — thường do máy in kẹt giấy / hết giấy / chọn nhầm máy in. Kiểm tra nguyên nhân trước!" : "In lại sẽ có 2 tờ giống nhau.") + "</b>" +
        "<ul>" + lan.slice(0, 15).map(function (x) { const n = soLanLai(x.ma); return "<li><code>" + esc(x.ma) + "</code> — tờ " + x.to + " · in lúc " + gio(x.luc) + (n ? " · <b>đã in lại " + n + " lần</b>" : "") + "</li>"; }).join("") + (lan.length > 15 ? "<li>… và " + (lan.length - 15) + " phiếu khác</li>" : "") + "</ul></div>" +
        "Chỉ in lại khi tờ cũ <b>bị hỏng</b> (kẹt giấy, rách, mờ…) và <b>đã bỏ tờ cũ</b>.",
      [{ chu: "Không in" }, { chu: "↻ In lại " + lan.length + " " + tenPhieu, lop: "do", lam: function () { inDon(lan, true, laA4 ? "a4" : "nhiet"); } }]);
  }
  // chọn khổ IN LẠI của 1 phiếu đã in (24/11 tối)
  khung.addEventListener("change", function (ev) {
    const o = ev.target; if (!o || !o.matches || !o.matches("select[data-kho-lai]")) return;
    const ma = o.getAttribute("data-kho-lai"); if (o.value === khoDaIn(ma)) tt.khoLai.delete(ma); else tt.khoLai.set(ma, o.value);
    ve();
  });
  // ô tích "Chọn in lại" (24/11 chiều)
  khung.addEventListener("change", function (ev) {
    const o = ev.target; if (!o || !o.matches || !o.matches("input[data-lai]")) return;
    const ma = o.getAttribute("data-lai"); if (o.checked) tt.chonLai.add(ma); else tt.chonLai.delete(ma);
    ve();
  });
  // ô tích "In A4" từng đơn (24/11)
  khung.addEventListener("change", function (ev) {
    const o = ev.target; if (!o || !o.matches || !o.matches("input[data-a4]")) return;
    const ma = o.getAttribute("data-a4"); if (o.checked) tt.a4.add(ma); else tt.a4.delete(ma);
    ve();
  });
  ["dragenter", "dragover"].forEach(function (k) { khung.addEventListener(k, function (ev) { if (ev.dataTransfer && Array.from(ev.dataTransfer.types || []).indexOf("Files") >= 0) { ev.preventDefault(); khung.classList.add("dang-keo"); } }); });
  ["dragleave", "drop"].forEach(function (k) { khung.addEventListener(k, function (ev) { if (k === "dragleave" && khung.contains(ev.relatedTarget)) return; khung.classList.remove("dang-keo"); }); });
  khung.addEventListener("drop", function (ev) { if (ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files.length) { ev.preventDefault(); themTep(ev.dataTransfer.files); } });

  // Nút "In đơn hàng" cũ: hỏi lại (bắt sự kiện trước script.js — không sửa script.js)
  const nutInDon = document.getElementById("nut-in-don");
  let choPhepInRoi = false;
  if (nutInDon) nutInDon.addEventListener("click", function (ev) {
    if (choPhepInRoi) { choPhepInRoi = false; return; }
    if (vungIn.innerHTML.trim() === "") return; // chưa tạo mẫu in → để script.js nhắc như cũ
    ev.preventDefault(); ev.stopImmediatePropagation();
    hop("⚠ Đang bật Phiếu gộp", "Bạn có chắc muốn in <b>tờ đơn rời</b>? Tờ đơn đã nằm trong phiếu gộp — in thêm tờ rời dễ bị trùng.",
      [{ chu: "Không in" }, { chu: "Vẫn in tờ đơn rời", lop: "do", lam: function () { choPhepInRoi = true; nutInDon.click(); } }]);
  }, true);

  // Tạo mẫu in lại → tính lại (file PDF vẫn giữ)
  let hen = null;
  new MutationObserver(function () { clearTimeout(hen); hen = setTimeout(tinh, 150); }).observe(vungIn, { childList: true });

  window.PhieuGop = { tinh: tinh, _tt: tt, _ket: function () { return ket; } };
  tinh();
})();
