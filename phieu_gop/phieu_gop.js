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
// KHÔNG đọc / ghi Google Sheet, KHÔNG đụng file nào của PDF trang vận hành.
// =========================================================================
(function () {
  "use strict";
  if (document.getElementById("pg-khung")) return;
  const CH = window.PHIEU_GOP_CAU_HINH || { tiLe: 0.8 };
  const D = window.DungPhieuGop;
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
    ["d", "v", "r"].forEach(function (k) { if (!so[k] || typeof so[k] !== "object") so[k] = {}; });
    const gioiHan = Date.now() - HAN;
    ["d", "v"].forEach(function (k) { Object.keys(so[k]).forEach(function (m) { if (so[k][m] < gioiHan) delete so[k][m]; }); });
    Object.keys(so.r).forEach(function (m) { so.r[m] = (so.r[m] || []).filter(function (t) { return t >= gioiHan; }); if (!so.r[m].length) delete so.r[m]; });
    return so;
  }
  function ghiSo() { try { localStorage.setItem(KHOA_SO, JSON.stringify(so)); } catch (er) { console.warn("[PhieuGop] Không lưu được sổ đã in:", er); } }
  window.addEventListener("storage", function (ev) { if (ev.key === KHOA_SO) { so = null; tinh(); } });

  // ---------------- Trạng thái ----------------
  const tt = { tep: [], loc: "khop", dangDung: false, pdfVua: null, gon: false };
  try { tt.gon = localStorage.getItem("zzm_phieu_gop_gon") === "1"; } catch (er) { /* bỏ qua */ }
  let ket = { don: [], trangThua: [], trangMoHo: [] };

  // ---------------- Giao diện ----------------
  const css = document.createElement("style");
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
    ".pg-hop h3{margin:0 0 8px;font-size:16px}.pg-hop p{margin:0 0 14px;color:#3c4043;line-height:1.45}",
    ".pg-hop .hang{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}",
    ".pg-hop .xanh{background:#1e8e3e;color:#fff;border-color:#1e8e3e}.pg-hop .do{color:#d93025;border-color:#d93025}",
    "@media (max-width:600px){.pg-td{display:none}.pg-the{grid-template-columns:30px 1fr;row-gap:6px}.pg-the .pg-giua{grid-column:2;text-align:left}" +
      ".pg-the .pg-giua .dau{display:inline;font-size:14px;margin-right:4px}.pg-the .pg-o.don-o{grid-column:2}.pg-nut-in{flex:1 1 100%;margin-left:0}.pg-phai{margin-left:0}}",
    "@media print{.pg-k,.pg-nen{display:none!important}}",
  ].join("\n");
  document.head.appendChild(css);

  const khung = document.createElement("div");
  khung.id = "pg-khung"; khung.className = "pg-k no-print" + (tt.gon ? " gon" : "");
  const chonTep = document.createElement("input"); chonTep.type = "file"; chonTep.accept = "application/pdf,.pdf"; chonTep.multiple = true; chonTep.hidden = true;
  khung.innerHTML =
    '<div class="pg-dau pg-thu-gon"><span class="pg-ten">🧾 Phiếu gộp</span><span id="pg-gon-tt"></span><span class="pg-phai"><button type="button" class="pg-nut" data-lam="gon">Mở rộng ▾</button></span></div>' +
    '<div class="pg-mo-rong">' +
      '<div class="pg-dau"><span class="pg-ten">🧾 Phiếu gộp <small>— phiếu đóng gói + tờ đơn trên 1 tờ</small></span>' +
        '<button type="button" class="pg-nut" data-lam="them">➕ Thêm file PDF</button>' +
        '<span class="pg-tt" id="pg-tt"></span>' +
        '<span class="pg-phai"><button type="button" class="pg-nut xam" data-lam="xoa-so" id="pg-xoa-so">🗑 Xóa sổ đã in</button><button type="button" class="pg-nut" data-lam="gon">Thu gọn ▴</button></span></div>' +
      '<div class="pg-tep" id="pg-tep"></div>' +
      '<div id="pg-bt"></div>' +
      '<div class="pg-loc" id="pg-loc"></div>' +
      '<div class="pg-ds" id="pg-ds"></div>' +
      '<div class="pg-dang" id="pg-dang" hidden></div>' +
      '<div class="pg-chan"><span class="pg-vua" id="pg-vua"></span><button type="button" class="pg-nut-in" id="pg-nut-in" data-lam="in"></button></div>' +
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
  }

  // ---------------- Vẽ ----------------
  function gio(t) { const d = new Date(t); return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function soTrang() { return tt.tep.reduce(function (s, t) { return s + t.trang.length; }, 0); }
  function ve() {
    const d = ket.don, khop = d.filter(function (x) { return x.loai === "khop"; }), thieu = d.filter(function (x) { return x.loai === "thieu"; });
    const dain = d.filter(function (x) { return x.loai === "dain"; });
    const nThua = ket.trangThua.length, nMoHo = ket.trangMoHo.length, nCan = thieu.length + nThua + nMoHo;
    const nSo = Object.keys(docSo().d).length;
    $("pg-tt").innerHTML = "📄 <b>" + soTrang() + " trang</b> · " + d.length + " tờ đơn" + '<span class="pg-chi">' + D.GIAY.W_MM + "×" + D.GIAY.H_MM + ' mm</span><span class="pg-chi">tờ đơn ' + Math.round(CH.tiLe * 100) + "%</span>";
    $("pg-xoa-so").textContent = "🗑 Xóa sổ đã in" + (nSo ? " (" + nSo + " mã)" : "");
    $("pg-xoa-so").hidden = !nSo;
    $("pg-tep").innerHTML = tt.tep.length ? "📎 " + tt.tep.map(function (t, i) { return "<span>" + esc(t.ten) + " · " + t.trang.length + ' trang<button type="button" data-lam="bo-tep" data-i="' + i + '" title="Bỏ file này">✕</button></span>'; }).join("") +
      (tt.tep.length > 1 ? '<button type="button" class="pg-nut nho" data-lam="bo-het">Bỏ hết file</button>' : "") : "";
    $("pg-gon-tt").innerHTML = '<span class="pg-chip">📄 ' + soTrang() + " trang · " + d.length + " tờ đơn</span> " +
      (khop.length ? '<span class="pg-chip xanh">🖨 Còn ' + khop.length + " đơn chưa in — Mở rộng để in</span> " : (d.length && !nCan && dain.length ? '<span class="pg-chip xanh">✅ Đã in xong</span> ' : "")) +
      (nCan ? '<span class="pg-chip do">⚠ ' + nCan + " cần xử lý</span>" : "");
    // khung bất thường / hướng dẫn
    let bt = "";
    if (!d.length) bt = '<div class="pg-bao">Chưa có tờ đơn — sang tab <b>Tạo Đơn Hàng</b> bấm <b>TẠO MẪU IN ĐƠN</b>. File PDF thả vào trước vẫn được giữ.</div>';
    else if (!tt.tep.length) bt = '<div class="pg-bao">Thả file PDF phiếu đóng gói Shopee / TikTok vào khung này (hoặc bấm <b>➕ Thêm file PDF</b>). Thả nhiều file một lúc được, các file được cộng dồn.</div>';
    else if (nCan) bt = '<div class="pg-bt"><h4>⛔ PHIÊN NÀY CÓ BẤT THƯỜNG — xử lý trước khi in phần lệch</h4><ul>' +
      (thieu.length ? "<li><b>" + thieu.length + "</b> tờ đơn KHÔNG có phiếu đóng gói — nếu phiếu nằm ở <b>file PDF khác</b>, bấm <b>➕ Thêm file PDF</b>; các file được cộng dồn</li>" : "") +
      (nThua ? "<li><b>" + nThua + "</b> phiếu đóng gói KHÔNG có tờ đơn lấy hàng</li>" : "") +
      (nMoHo ? "<li><b>" + nMoHo + "</b> trang phiếu có từ 2 mã đơn trở lên — không tự ghép được, kiểm tra lại</li>" : "") +
      "</ul>Các cặp <b>KHỚP</b> vẫn in an toàn bằng nút bên dưới. Bấm <b>⚠ Cần xử lý</b> để chỉ xem các trường hợp này.</div>";
    $("pg-bt").innerHTML = bt;
    const nut = function (l, ten, n, lop) { return '<button type="button" data-loc="' + l + '" class="' + (lop || "") + (tt.loc === l ? " dang" : "") + '">' + ten + '<span class="so">' + n + "</span></button>"; };
    $("pg-loc").innerHTML = nut("tat", "Tất cả", d.length + nThua + nMoHo) + nut("khop", "✓ Khớp — chưa in", khop.length, "l-xanh") + nut("can", "⚠ Cần xử lý", nCan, "l-do") +
      nut("thieu", "Thiếu phiếu đóng gói", thieu.length) + nut("thua", "Phiếu không có tờ đơn", nThua + nMoHo) + nut("dain", "🖨 Đã in", dain.length, "l-tim");
    // danh sách
    const copy = function (ma) { return ' <button type="button" class="pg-nut nho" style="padding:1px 7px;font-size:11px" data-lam="copy" data-ma="' + esc(ma) + '">📋 Copy</button>'; };
    const anhPhieu = function (n) { return n ? '<div class="pg-anh" style="background-image:url(' + n.trang.anh + ')"></div>' : '<div class="pg-anh">✕</div>'; };
    const theDon = function (x) {
      const n0 = x.nhan[0];
      const phieu = n0 ? '<div class="pg-o">' + anhPhieu(n0) + '<div><span class="pg-ma">' + esc(x.ma) + "</span>" + copy(x.ma) + '<div class="pg-mo">Trang ' + x.nhan.map(function (n) { return n.trang.p; }).join(", ") +
          (tt.tep.length > 1 ? " · " + esc(n0.tep.ten) : "") + "</div>" + (n0.trang.mvd ? '<div class="pg-mo">MVĐ: ' + esc(n0.trang.mvd) + "</div>" : "") + "</div></div>"
        : '<div class="pg-o"><div class="pg-anh">✕</div><span class="pg-trong">Chưa có trang PDF</span></div>';
      const giua = x.loai === "khop" ? '<div class="pg-giua k1"><span class="dau">✓</span>KHỚP' + (x.nhan.length > 1 ? "<br>" + x.nhan.length + " trang phiếu" : "") + "</div>"
        : x.loai === "dain" ? '<div class="pg-giua k3"><span class="dau">🖨</span>ĐÃ IN ' + gio(x.luc) + '<br><button type="button" class="pg-nut nho" style="margin-top:3px" data-lam="in-lai" data-ma="' + esc(x.ma) + '">↻ In lại</button></div>'
        : '<div class="pg-giua k2"><span class="dau">⚠</span>THIẾU PHIẾU</div>';
      const don = '<div class="pg-o don-o"><div class="pg-anh">🧾</div><div><span class="pg-ma">' + esc(x.ma) + "</span>" + copy(x.ma) + '<div class="pg-mo">Tờ ' + x.to + " · " + x.soMon + " món</div></div></div>";
      return '<div class="pg-the' + (x.loai === "dain" ? " da-in" : x.loai === "thieu" ? " lech" : "") + '"><span class="so-to">' + x.to + "</span>" + phieu + giua + don + "</div>";
    };
    const theTrang = function (t, moHo) {
      const ma = moHo ? t.ma.join(" · ") : (t.trang.cum.find(function (c) { return /^\d{6}[0-9A-Z]{8}$/.test(c) && /[A-Z]/.test(c.slice(6)); }) || t.trang.cum.find(function (c) { return /^\d{18}$/.test(c); }) || "");
      return '<div class="pg-the lech"><span class="so-to">–</span><div class="pg-o">' + anhPhieu(t) + "<div>" + (ma ? '<span class="pg-ma">' + esc(ma) + "</span>" + (moHo ? "" : copy(ma)) : '<span class="pg-trong">Không đọc được mã đơn</span>') +
        '<div class="pg-mo">Trang ' + t.trang.p + (tt.tep.length > 1 ? " · " + esc(t.tep.ten) : "") + "</div>" + (t.trang.mvd ? '<div class="pg-mo">MVĐ: ' + esc(t.trang.mvd) + "</div>" : "") + "</div></div>" +
        '<div class="pg-giua k2"><span class="dau">⚠</span>' + (moHo ? "TRANG CÓ<br>NHIỀU MÃ" : "KHÔNG CÓ<br>TỜ ĐƠN") + '</div><div class="pg-o don-o"><div class="pg-anh">✕</div><span class="pg-trong">Không có tờ đơn</span></div></div>';
    };
    let h = "";
    const l = tt.loc;
    d.forEach(function (x) { if (l === "tat" || l === x.loai || (l === "can" && x.loai === "thieu")) h += theDon(x); });
    if (l === "tat" || l === "can" || l === "thua") { ket.trangMoHo.forEach(function (t) { h += theTrang(t, true); }); ket.trangThua.forEach(function (t) { h += theTrang(t, false); }); }
    $("pg-ds").innerHTML = h ? '<div class="pg-td"><span>TỜ</span><span>PHIẾU ĐÓNG GÓI (PDF)</span><span></span><span>ĐƠN LẤY HÀNG (WEB)</span></div>' + h
      : '<div class="pg-rong">' + (d.length || tt.tep.length ? "Không có mục nào trong nhóm này." : "Chưa có dữ liệu.") + "</div>";
    // thanh in
    $("pg-vua").innerHTML = tt.pdfVua ? "📄 PDF vừa tạo: <b>" + tt.pdfVua.tongTo + ' tờ</b> <button type="button" class="pg-nut nho" data-lam="mo-lai">🖨 Mở lại</button><button type="button" class="pg-nut nho" data-lam="tai-ve">⬇ Tải về</button>' : "";
    const nTo = khop.reduce(function (s, x) { return s + Math.max(1, x.nhan.length); }, 0);
    $("pg-nut-in").innerHTML = "🖨 In " + khop.length + " PHIẾU GỘP<small>cặp khớp · khổ " + D.GIAY.W_MM + "×" + D.GIAY.H_MM + (nTo > khop.length ? " · ≥ " + nTo + " tờ" : "") + "</small>";
    $("pg-nut-in").disabled = !khop.length || tt.dangDung;
    const khongIn = [];
    if (thieu.length) khongIn.push("<b>" + thieu.length + "</b> thiếu phiếu");
    if (nThua + nMoHo) khongIn.push("<b>" + (nThua + nMoHo) + "</b> phiếu không có tờ đơn");
    $("pg-chan2").innerHTML = khongIn.length ? "<span>ⓘ Không in: " + khongIn.join(" · ") + ".</span>" : "";
  }

  // ---------------- Hộp thoại ----------------
  function hop(tieuDe, noiDung, cacNut) {
    const nen = document.createElement("div"); nen.className = "pg-nen";
    nen.innerHTML = '<div class="pg-hop" role="dialog"><h3>' + tieuDe + "</h3><p>" + noiDung + '</p><div class="hang"></div></div>';
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
    if (!nen) { nen = document.createElement("div"); nen.id = "pg-cho"; nen.className = "pg-nen"; nen.innerHTML = '<div class="pg-hop" role="status"><h3>🧾 Đang dựng phiếu gộp</h3><p id="pg-cho-chu"></p></div>'; document.body.appendChild(nen); }
    document.getElementById("pg-cho-chu").textContent = chu;
    return function () { nen.remove(); };
  }
  async function inDon(dsDon, laInLai) {
    if (tt.dangDung || !dsDon.length) return;
    tt.dangDung = true; ve();
    $("pg-dang").hidden = false;
    const batDau = Date.now();
    let dongCho = hopTienDo("⏳ Chuẩn bị " + dsDon.length + " phiếu…");
    try {
      const kq = await D.dung(dsDon, CH.tiLe, function (i, n) {
        const conLai = i ? Math.round((Date.now() - batDau) / i * (n - i) / 1000) : 0;
        const chu = "⏳ Đang dựng phiếu gộp " + i + "/" + n + "…" + (i && n - i ? " còn khoảng " + (conLai >= 60 ? Math.ceil(conLai / 60) + " phút" : conLai + " giây") : (i === n ? " đang ghép file…" : ""));
        $("pg-dang").textContent = chu; hopTienDo(chu);
      });
      dongCho(); dongCho = function () {};
      if (tt.pdfVua && tt.pdfVua.url) { try { URL.revokeObjectURL(tt.pdfVua.url); } catch (er) { /* bỏ qua */ } }
      const url = URL.createObjectURL(new Blob([kq.bytes], { type: "application/pdf" }));
      tt.pdfVua = { bytes: kq.bytes, tongTo: kq.tongTo, url: url };
      if (kq.loi.length) console.warn("[PhieuGop] Đơn có chữ bị tràn khi dựng:", kq.loi);
      const ma = dsDon.map(function (x) { return x.ma; });
      const vt = []; dsDon.forEach(function (x) { x.nhan.forEach(function (n) { vt.push(n.trang.vanTay); }); });
      const hoiDaIn = function () {
        hop("🖨 Đã in xong " + dsDon.length + " phiếu gộp (" + kq.tongTo + " tờ) chưa?",
          "Chỉ bấm <b>Đã in xong</b> khi giấy đã ra máy in. Nếu đã bấm <b>Hủy</b> trong hộp in, hoặc máy in lỗi, chọn <b>Chưa in</b>." +
          (kq.loi.length ? "<br><br>⚠ " + kq.loi.length + " đơn có nội dung dài, kiểm tra lại tờ in: " + esc(kq.loi.join(", ")) : ""),
          [{ chu: "Chưa in" }, { chu: "✓ Đã in xong", lop: "xanh", lam: function () {
            const s = docSo(), bay = Date.now();
            ma.forEach(function (m) { if (laInLai && s.d[m]) { (s.r[m] = s.r[m] || []).push(bay); } else s.d[m] = bay; });
            vt.forEach(function (v) { if (!s.v[v]) s.v[v] = bay; });
            ghiSo(); tinh();
          } }]);
      };
      hop("✅ Đã dựng xong " + dsDon.length + " phiếu gộp (" + kq.tongTo + " tờ)",
        "Bấm <b>🖨 Mở file in</b> → file PDF mở ở tab mới → in bằng máy in nhiệt (khổ 99×154 mm, tỉ lệ 100%). (" + Math.round((Date.now() - batDau) / 1000) + " giây)",
        [{ chu: "Để sau" }, { chu: "🖨 Mở file in", lop: "xanh", lam: function () { moPdf(url); hoiDaIn(); } }]);
    } catch (er) {
      console.error("[PhieuGop] Lỗi dựng phiếu gộp:", er);
      dongCho();
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
    if (lam === "bo-tep") { tt.tep.splice(+b.getAttribute("data-i"), 1); tinh(); return; }
    if (lam === "bo-het") { if (window.confirm("Bỏ hết " + tt.tep.length + " file PDF khỏi khung phiếu gộp?")) { tt.tep = []; tinh(); } return; }
    if (lam === "copy") { const m = b.getAttribute("data-ma"); try { navigator.clipboard.writeText(m); b.textContent = "✓ Đã copy"; setTimeout(function () { b.textContent = "📋 Copy"; }, 1200); } catch (er) { window.prompt("Copy mã:", m); } return; }
    if (lam === "xoa-so") {
      hop("🗑 Xóa sổ đã in của phiếu gộp?", "Xóa toàn bộ ghi nhớ các đơn đã in phiếu gộp <b>trên máy này</b>. Sau khi xóa, các đơn đó sẽ hiện lại là <b>chưa in</b>.",
        [{ chu: "Không xóa" }, { chu: "Xóa sổ", lop: "do", lam: function () { try { localStorage.removeItem(KHOA_SO); } catch (er) { /* bỏ qua */ } so = null; tinh(); } }]);
      return;
    }
    if (lam === "in") { inDon(ket.don.filter(function (x) { return x.loai === "khop"; }), false); return; }
    if (lam === "in-lai") { const x = ket.don.find(function (d) { return d.ma === b.getAttribute("data-ma"); }); if (x) inDon([x], true); return; }
    if (lam === "mo-lai" && tt.pdfVua) { moPdf(tt.pdfVua.url); return; }
    if (lam === "tai-ve" && tt.pdfVua) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([tt.pdfVua.bytes], { type: "application/pdf" })); a.download = "phieu_gop_" + new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-") + ".pdf"; a.click(); return; }
  });
  chonTep.addEventListener("change", function () { themTep(chonTep.files); });
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
