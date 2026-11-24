// =========================================================================
// TRANG "🎨 MẪU PHIẾU GỘP" (24/11 — bước 4). Chỉnh cài đặt in phiếu gộp RIÊNG cho giấy nhiệt 99×154 và A4.
// - ĐỌC tab PHIEU_GOP bằng khóa API (chỉ đọc), phân tích bằng ĐÚNG hàm của phiếu gộp (DungPhieuGop.phanTichBang).
// - "Về mặc định" = điền lại các ô của loại giấy ĐANG CHỈNH theo cột MẶC ĐỊNH trên Google Sheet (chưa lưu).
// - LƯU qua Apps Script "Phieu Gop ZZM" (mật khẩu admin): chỉ gửi giá trị 2 loại giấy + ngưỡng A4.
//   KHÔNG đọc / hiện / gửi công tắc BAT_PHIEU_GOP; KHÔNG sửa được cột MẶC ĐỊNH (Apps Script cũng không bao giờ ghi 2 thứ này).
// - Xem trước = ĐÚNG phần dựng phiếu gộp (DungPhieuGop.xemTruoc) với 1 đơn mẫu (dữ liệu giả).
// =========================================================================
(function () {
  "use strict";
  const D = window.DungPhieuGop;
  const ID_BANG_TINH = "1Ro4FLShWGRQHilJ7m4RSmsfTp65QXpvJNfAjVjCLvrc";
  const KHOA_API = "AIzaSyANYGSIIawi6NyiSlWoWNVRJvUh1K_rqqw"; // khóa chỉ đọc, giống script.js
  // Địa chỉ ứng dụng web Apps Script "Phieu Gop ZZM" (chủ dự án triển khai rồi dán vào đây). Trống = chưa lưu được.
  const URL_LUU = window.__PG_URL_LUU_THU || "https://script.google.com/macros/s/AKfycbwSRRMGMrzBUMw6EuLy-XccYqY2vQAytMGbgy8jEhOraHYx9Ghab_dP_jPbKgsHLV_O/exec"; // __PG_URL_LUU_THU: chỉ bài kiểm thử dùng
  const KHOA_TEN_NGUOI = "zzm_ten_nhan_vien";
  const TEN_GIAY = { nhiet: "Giấy nhiệt 99×154", a4: "A4" };
  const DONG = [["ma", "Mã hàng"], ["sl", "Số lượng"], ["viTri", "Vị trí kho"], ["ktgh", "KTGH"], ["ten", "Tên sản phẩm"]];
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  const sao = function (o) { return JSON.parse(JSON.stringify(o)); };
  const giongNhau = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };
  if (!D || typeof D.xemTruoc !== "function") { document.body.insertAdjacentHTML("afterbegin", '<div style="padding:16px;color:#a50e0e">Không nạp được phần dựng phiếu gộp — tải lại trang (F5).</div>'); return; }

  // ── ĐƠN MẪU (dữ liệu giả) để xem trước — tên / vị trí / KTGH giả lập riêng trên trang này ──
  const MON_MAU = [
    ["90754-GC8-003", "1", "A-C1H3-12", "N1", "PHỐT CAO SU BÁNH TRƯỚC SH20 SH23 SH24 20X32X5 VN"],
    ["95002-80000", "2", "A-C2H4-06", "N1", "KẸP ỐNG XẢ CĂN NỐI LEAD17 LEAD22 SH20 SH23 SH24 VIS15 VIS21 SHM20 WAL17 WAL24 WRSX19 BLADE17 VN"],
    ["17236-KVB-900", "1", "A-C3H4-03", "N1", "NÚT XẢ LỌC GIÓ SHM20 WAL17 WAL24 WRSX19 VN"],
    ["40530-K2P-V71", "3", "A-C7", "N3", "SÊN WN X V3 V4 ABS DID 428 VIX4-120LE VN"],
    ["37211K27V01", "1", "B-C3", "27×22×12", "MICA ĐỒNG HỒ AB13"],
    ["64500KTM970ZM", "1", "FU5-C2H4-03", "", "NẠ LỚN FUT05 XANH DƯƠNG *B206M*"],
    ["86831-K12-V40ZA", "2", "B-A5-02", "N2", "CHỮ NỔI LEAD17 LEAD22 ĐỎ *NHA76M* VN"],
    ["23801-K56-NJ0", "1", "A-C7", "N2", "NHÔNG WN 15T VN"],
    ["83611-K2T-V00ZA", "1", "LE1-C4H3-01", "55×20×7", "NHỰA NHÁM ỐP GÁC CHÂN SAU LEAD22 TRÁI ĐEN VN"],
    ["81145-K59-A70ZA", "1", "VA2-C1H2-01", "N1", "NẮP KHẨN CẤP VA160 VA18 ĐEN *NH1* VN"],
  ];
  window.MISA_DIRECTORY = {}; const KT_MAU = {};
  MON_MAU.forEach(function (m) { window.MISA_DIRECTORY[m[0]] = { name: m[4], loc: m[2], hangDeVo: false }; KT_MAU[m[0]] = m[3]; });
  window.KichThuoc = { noiDungKtgh: function (sku) { return KT_MAU[sku] || ""; }, thungLonNhat: function () { return "N3"; }, kichThuocThung: function () { return "20×10×10"; } };
  function donMau(soMon) {
    const ds = MON_MAU.slice(0, soMon);
    const chu = "📦 ĐƠN: 261117HS2NXHDP\n🚚 VĐ: SPXVN06663195109B\n━━━━━━━━━━━━━━━━━━━━\n" + ds.map(function (m) { return "[" + m[2] + "] " + m[0] + " x" + m[1]; }).join("\n") +
      "\n━━━━━━━━━━━━━━━━━━━━\n💰 Tổng: 2.575.400 đ\n⚠️ Có Hàng Dễ Vỡ";
    const box = document.createElement("div"); box.className = "invoice-box"; box.setAttribute("data-copy-text", chu);
    box.innerHTML = '<div class="invoice-head"><div><b>Mã Vận Đơn:</b> SPXVN06663195109B</div><div><span class="oid-value">ĐƠN HÀNG: 261117HS2NXHDP</span></div></div>' +
      '<table class="inv-table"><thead><tr><th>SL</th><th>Mã SKU</th><th>Tên Sản Phẩm</th><th>Vị Trí Kho</th><th>Ghi Chú</th></tr></thead><tbody>' +
      ds.map(function (m) { return "<tr><td>" + m[1] + '</td><td class="i-sku">' + esc(m[0]) + "</td><td>" + esc(m[4]) + "</td><td>" + esc(m[2]) + "</td><td></td></tr>"; }).join("") +
      '</tbody></table><div class="canh-bao-de-vo">⚠️ Lưu ý: Có Hàng Dễ Vỡ</div><div class="inv-total">Total Price:<span class="num">2.575.400</span></div>';
    return { ma: "261117HS2NXHDP", vd: "SPXVN06663195109B", box: box, skus: ds.map(function (m) { return m[0]; }), soSp: ds.reduce(function (s, m) { return s + (+m[1]); }, 0) };
  }

  // ── Trạng thái ──
  let kq = D.phanTichBang([]);             // kết quả đọc bảng (gồm md = cột MẶC ĐỊNH)
  let bo = { nhiet: sao(kq.nhiet), a4: sao(kq.a4) }, chung = { nguongA4: kq.nguongA4 };
  let daLuu = sao(bo), daLuuChung = sao(chung), capNhatCu = "", choLuu = false, kho = "nhiet", ch = bo.nhiet;
  try { $("nguoi").value = localStorage.getItem(KHOA_TEN_NGUOI) || ""; } catch (er) { /* bỏ qua */ }

  function bao(lop, html) { const b = $("bao"); b.className = lop || ""; b.innerHTML = html || ""; }

  // ── ① bảng chữ ──
  $("bang-chu").innerHTML = DONG.map(function (d) {
    return "<tr><td>" + d[1] + '</td><td><span class="so"><button type="button" data-buoc="' + d[0] + '.co:-0.5" aria-label="Giảm cỡ">−</button><input data-o="' + d[0] + '.co" inputmode="decimal" aria-label="Cỡ chữ ' + d[1] + '"><button type="button" data-buoc="' + d[0] + '.co:0.5" aria-label="Tăng cỡ">+</button></span></td>' +
      '<td><input type="checkbox" data-o="' + d[0] + '.dam" aria-label="In đậm ' + d[1] + '"></td><td><select data-o="' + d[0] + '.phong" aria-label="Phông ' + d[1] + '">' +
      D.PHONG_HOP_LE.map(function (p) { return '<option style="font-family:\'' + p + '\'">' + p + "</option>"; }).join("") + "</select></td></tr>";
  }).join("");

  function nap() { // đổ giá trị của giấy đang chỉnh → các ô
    document.querySelectorAll("[data-o]").forEach(function (el) { const k = el.getAttribute("data-o").split("."), v = ch[k[0]][k[1]]; if (el.type === "checkbox") el.checked = v; else el.value = v; });
    ["khoanhTron", "duongKe", "hienKtgh"].forEach(function (k) { $(k).checked = ch[k]; });
    $("nhanTong").value = ch.nhanTong; $("tl").value = ch.tl; $("nguongA4").value = chung.nguongA4;
    document.querySelectorAll("#dongThung input").forEach(function (r) { r.checked = r.value === ch.dongThung; r.parentNode.classList.toggle("dang", r.checked); });
    document.querySelectorAll(".ten-giay").forEach(function (x) { x.textContent = TEN_GIAY[kho]; });
    document.querySelectorAll("[data-kho]").forEach(function (x) { x.classList.toggle("dang", x.getAttribute("data-kho") === kho); });
    $("chep").textContent = "⧉ Chép sang " + (kho === "a4" ? "giấy nhiệt" : "A4");
    $("ve-md").textContent = "↺ Về mặc định — " + TEN_GIAY[kho];
  }
  const GIOI_HAN = { co: [6, 30], tl: [50, 100], nguongA4: [2, 20] };
  function kep(k, v) { return Math.min(GIOI_HAN[k][1], Math.max(GIOI_HAN[k][0], v)); }

  document.addEventListener("input", function (ev) {
    const el = ev.target;
    if (el.hasAttribute("data-o")) {
      const k = el.getAttribute("data-o").split(".");
      if (el.type === "checkbox") ch[k[0]].dam = el.checked;
      else if (k[1] === "co") { const n = parseFloat(String(el.value).replace(",", ".")); if (isFinite(n) && n >= 6 && n <= 30) ch[k[0]].co = Math.round(n * 10) / 10; }
      else ch[k[0]][k[1]] = el.value;
    } else if (["khoanhTron", "duongKe", "hienKtgh"].indexOf(el.id) >= 0) ch[el.id] = el.checked;
    else if (el.id === "nhanTong") ch.nhanTong = el.value;
    else if (el.id === "tl") { const m = parseInt(el.value, 10); if (isFinite(m) && m >= 50 && m <= 100) ch.tl = m; }
    else if (el.id === "nguongA4") { const m2 = parseInt(el.value, 10); if (isFinite(m2) && m2 >= 2 && m2 <= 20) chung.nguongA4 = m2; }
    else return;
    ve();
  });
  document.addEventListener("change", function (ev) {
    const el = ev.target;
    if (el.name === "dt") { ch.dongThung = el.value; nap(); ve(); return; }
    if (el.hasAttribute("data-o") || ["tl", "nguongA4"].indexOf(el.id) >= 0) nap(); // ô gõ sai → hiện lại giá trị đang dùng
    if (el.id === "nguoi") { try { localStorage.setItem(KHOA_TEN_NGUOI, el.value.trim()); } catch (er) { /* bỏ qua */ } }
  });
  document.addEventListener("click", function (ev) {
    const b = ev.target.closest("[data-buoc]");
    if (b) {
      const p = b.getAttribute("data-buoc").split(":"), k = p[0].split("."), buoc = parseFloat(p[1]);
      if (k.length === 2) ch[k[0]].co = kep("co", Math.round((ch[k[0]].co + buoc) * 10) / 10);
      else if (k[0] === "nguongA4") chung.nguongA4 = kep("nguongA4", chung.nguongA4 + buoc);
      else ch[k[0]] = kep(k[0], ch[k[0]] + buoc);
      nap(); ve(); return;
    }
    const t = ev.target.closest("[data-kho]");
    if (t) { kho = t.getAttribute("data-kho"); ch = bo[kho]; nap(); ve(); }
  });
  // Về mặc định: CHỈ giấy đang chỉnh, theo cột MẶC ĐỊNH trên Google Sheet (chưa lưu)
  $("ve-md").addEventListener("click", function () { bo[kho] = sao(kq.md[kho]); ch = bo[kho]; nap(); ve(); });
  $("chep").addEventListener("click", function () { bo[kho === "a4" ? "nhiet" : "a4"] = sao(ch); nap(); ve(); });

  // ── Tóm tắt thay đổi bằng lời ──
  function thayDoi() {
    const tat = [], ten = { ma: "Mã hàng", sl: "Số lượng", viTri: "Vị trí kho", ktgh: "KTGH", ten: "Tên sản phẩm" };
    ["nhiet", "a4"].forEach(function (g) {
      const a = daLuu[g], b = bo[g], p = TEN_GIAY[g] + " · ";
      DONG.forEach(function (d) { const x = a[d[0]], y = b[d[0]];
        if (x.co !== y.co) tat.push(p + ten[d[0]] + ": cỡ " + x.co + " → " + y.co);
        if (x.dam !== y.dam) tat.push(p + ten[d[0]] + ": " + (y.dam ? "in đậm" : "bỏ in đậm"));
        if (x.phong !== y.phong) tat.push(p + ten[d[0]] + ": phông " + x.phong + " → " + y.phong); });
      if (a.khoanhTron !== b.khoanhTron) tat.push(p + (b.khoanhTron ? "Bật" : "Tắt") + " khoanh tròn số lượng");
      if (a.duongKe !== b.duongKe) tat.push(p + (b.duongKe ? "Bật" : "Tắt") + " đường kẻ ngăn");
      if (a.hienKtgh !== b.hienKtgh) tat.push(p + (b.hienKtgh ? "Hiện" : "Ẩn") + " KTGH");
      if (a.nhanTong !== b.nhanTong) tat.push(p + 'Nhãn tổng tiền: "' + a.nhanTong + '" → "' + b.nhanTong + '"');
      if (a.dongThung !== b.dongThung) tat.push(p + "Dòng Thùng: " + { ten_kt: "tên + kích thước", ten: "chỉ tên", an: "ẩn" }[b.dongThung]);
      if (a.tl !== b.tl) tat.push(p + "Tỉ lệ đầu / chân tờ: " + a.tl + "% → " + b.tl + "%");
    });
    if (daLuuChung.nguongA4 !== chung.nguongA4) tat.push("Chung · Gợi ý A4 khi cần từ " + daLuuChung.nguongA4 + " → " + chung.nguongA4 + " tờ");
    return tat;
  }
  function loiNhap() { // kiểm trước khi lưu (Apps Script kiểm lại lần nữa)
    for (const g of ["nhiet", "a4"]) { const t = String(bo[g].nhanTong || "").trim(); if (!t || t.length > 30 || /^[=+\-@]/.test(t)) return TEN_GIAY[g] + ": chữ nhãn tổng tiền phải có 1–30 ký tự, không bắt đầu bằng = + - @"; }
    return "";
  }

  // ── Xem trước (ĐÚNG phần dựng phiếu gộp) ──
  function ve() {
    const a4 = kho === "a4";
    const khung = $("giay-khung");
    let r;
    try { r = D.xemTruoc(khung, donMau(a4 ? 10 : 4), ch, kho, 297, 420); } catch (er) { console.error("[MauPhieuGop] Lỗi xem trước:", er); khung.textContent = "Không dựng được xem trước."; return; }
    const to = r.to, rong = khung.clientWidth - 24, tlXem = Math.min(1.6, rong / to.offsetWidth);
    to.style.transform = "scale(" + tlXem + ")";
    khung.style.height = (to.offsetHeight * tlXem + 24) + "px";
    $("ghi-xem").textContent = (a4 ? "A4 — đơn mẫu 10 mã (dữ liệu giả): nhãn lật ngang cỡ gốc, danh sách 2 cột." : "Giấy nhiệt 99×154 — đơn mẫu 4 mã (dữ liệu giả).") +
      (r.soTo > 1 ? " Đơn mẫu cần " + r.soTo + " tờ (đang xem tờ 1)." : "");
    const tat = thayDoi();
    $("doi").innerHTML = tat.length ? "<b>Sẽ thay đổi " + tat.length + " điểm:</b><ul><li>" + tat.map(esc).join("</li><li>") + "</li></ul>" : "Chưa thay đổi gì.";
    $("luu").disabled = !tat.length || !choLuu;
  }
  window.addEventListener("resize", function () { clearTimeout(ve.hen); ve.hen = setTimeout(ve, 150); });
  window.addEventListener("beforeunload", function (ev) { if (thayDoi().length) { ev.preventDefault(); ev.returnValue = ""; } });

  // ── Đọc bảng điều khiển ──
  async function doc() {
    bao("vang", "⏳ Đang đọc bảng điều khiển PHIEU_GOP…");
    try {
      const url = "https://sheets.googleapis.com/v4/spreadsheets/" + ID_BANG_TINH + "/values/" + encodeURIComponent("PHIEU_GOP!A1:H60") + "?valueRenderOption=UNFORMATTED_VALUE&key=" + KHOA_API;
      const r = await fetch(url, { cache: "no-store" });
      if (r.status === 400) { choLuu = false; bao("do", "⚠ Chưa có tab <b>PHIEU_GOP</b> trên Google Sheet — đang xem bằng cài đặt mặc định, chưa lưu được."); ve(); return; }
      if (!r.ok) throw new Error("HTTP " + r.status);
      const ds = (await r.json()).values || [];
      kq = D.phanTichBang(ds);
      bo = { nhiet: sao(kq.nhiet), a4: sao(kq.a4) }; chung = { nguongA4: kq.nguongA4 };
      daLuu = sao(bo); daLuuChung = sao(chung); capNhatCu = kq.capNhat; ch = bo[kho];
      const daNangCap = ds.some(function (d) { return String(d && d[0]).trim().toUpperCase() === "CHU_GIAY_NHIET"; });
      choLuu = daNangCap;
      if (!daNangCap) bao("vang", "⚠ Bảng PHIEU_GOP <b>chưa nâng cấp</b> lên bố cục mới — đang xem bằng cài đặt mặc định, chưa lưu được. (Người quản trị chạy <b>nangCapBangPhieuGop</b> trong Apps Script \"Phieu Gop ZZM\".)");
      else if (kq.canhBao.length) bao("vang", "⚠ Một số ô trên Google Sheet sai nên đang dùng mặc định:<br>• " + kq.canhBao.map(esc).join("<br>• ") + "<br>Lưu từ trang này sẽ ghi lại giá trị đúng.");
      else bao("", "");
      nap(); ve();
    } catch (er) {
      console.error("[MauPhieuGop] Không đọc được bảng:", er);
      choLuu = false; bao("do", "⚠ Không đọc được bảng điều khiển (kiểm tra mạng rồi bấm F5). Đang xem bằng cài đặt mặc định, chưa lưu được."); nap(); ve();
    }
  }

  // ── Lưu ──
  function ketQua(lop, chu) { const k = $("ket-qua"); k.className = lop || ""; k.innerHTML = chu || ""; }
  async function luu(ghiDe) {
    const loi = loiNhap(); if (loi) { ketQua("do", "⚠ " + esc(loi)); return; }
    if (!URL_LUU) { ketQua("do", "⚠ Chưa cài địa chỉ lưu: Apps Script \"Phieu Gop ZZM\" chưa được triển khai thành ứng dụng web (báo người quản trị)."); return; }
    const mk = $("mk").value, nguoi = $("nguoi").value.trim();
    if (!nguoi) { ketQua("do", "⚠ Nhập tên người lưu."); $("nguoi").focus(); return; }
    if (!mk) { ketQua("do", "⚠ Nhập mật khẩu admin."); $("mk").focus(); return; }
    $("luu").disabled = true; ketQua("", "⏳ Đang lưu…");
    const caiDat = { nhiet: sao(bo.nhiet), a4: sao(bo.a4), nguongA4: chung.nguongA4 };
    caiDat.nhiet.nhanTong = caiDat.nhiet.nhanTong.trim(); caiDat.a4.nhanTong = caiDat.a4.nhanTong.trim();
    try {
      const huy = new AbortController(); const hen = setTimeout(function () { huy.abort(); }, 30000);
      const r = await fetch(URL_LUU, { method: "POST", body: JSON.stringify({ hanh_dong: "luu_cai_dat", mat_khau: mk, nguoi: nguoi, cap_nhat_cu: capNhatCu, ghi_de: ghiDe === true, cai_dat: caiDat }), signal: huy.signal });
      clearTimeout(hen);
      const tl = await r.json();
      if (tl.ok) {
        daLuu = sao(bo); daLuuChung = sao(chung); capNhatCu = tl.cap_nhat || capNhatCu; $("mk").value = "";
        ketQua("xanh", "✅ Đã lưu (" + esc(tl.cap_nhat || "") + "). Các máy bấm F5 trang Vận Hành để dùng mẫu mới.");
        ve(); setTimeout(doc, 1500); return;
      }
      if (tl.xung_dot) {
        ketQua("do", "⚠ " + esc(tl.loi) + ' <button type="button" class="nut" id="ghi-de">Vẫn lưu đè</button> <button type="button" class="nut" id="tai-lai">Tải lại bản mới</button>');
        $("ghi-de").onclick = function () { luu(true); };
        $("tai-lai").onclick = function () { daLuu = sao(bo); doc(); ketQua("", ""); };
      } else ketQua("do", "⚠ Chưa lưu được: " + esc(tl.loi || "lỗi không rõ"));
    } catch (er) {
      console.error("[MauPhieuGop] Lỗi lưu:", er);
      ketQua("do", "⚠ Chưa lưu được (mạng chậm / mất mạng). Kiểm tra mạng rồi bấm Lưu lại.");
    }
    ve();
  }
  $("luu").addEventListener("click", function () { luu(false); });

  nap(); ve(); doc();
  window.MauPhieuGop = { _tt: function () { return { bo: bo, chung: chung, kho: kho, kq: kq, choLuu: choLuu, capNhatCu: capNhatCu }; } };
})();
