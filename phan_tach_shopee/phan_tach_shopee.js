// =========================================================================
// PHÂN TÁCH DỮ LIỆU SHOPEE (21/11) — file riêng, gắn vào nút "XỬ LÝ" (tab Phân Tách) của trang Vận Hành
//
// ĐÂY LÀ NƠI DUY NHẤT chứa cách đọc ô "product_info" của Shopee:
//   "[1] Product Name:…; Variation Name:…; Price: 189,000₫; Quantity: 1; SKU Reference No.: ABCx2; …"
//   → mỗi món: Mã SKU, SL, Giá, cảnh báo SKU sai dạng.
//
// - Đọc bảng điều khiển: tab PHAN_TACH_SHOPEE (Google Sheet, CHỈ ĐỌC bằng khóa API của script.js) khi mở trang / F5.
//   Nhãn SKU / số lượng / giá, dấu tách món, ký hiệu nhân (x), ký hiệu combo (+) — chủ dự án sửa TRỰC TIẾP trên sheet.
// - script.js gọi window.PhanTachShopee.chonKetQua(thongTin, monCu, maDon) cho TỪNG dòng Bảng 1:
//     · Công tắc BAT_FILE_MOI ☐ (hoặc chưa có tab / chưa từng đọc được) → trả về null = script.js dùng KẾT QUẢ CŨ.
//       File này vẫn chạy NGẦM để SO: khác kết quả cũ thì hiện khung báo (không đổi kết quả).
//     · ☑ → trả về kết quả của file này (script.js dùng). File này lỗi → trả về null (dùng code cũ) + khung báo rõ.
// - Mất mạng → dùng bảng điều khiển đọc được LẦN TRƯỚC (lưu trên máy); máy chưa từng đọc → ☐ + giá trị mặc định.
// - Ô trên sheet trống / sai → dùng giá trị mặc định cho ô đó + khung báo nêu rõ ô nào.
// - Giá trị mặc định = ĐÚNG Y code cũ trong script.js (splitProducts / grab / normPrice / resolveSku) — đã so trên dữ liệu thật.
// - KHÔNG gửi dữ liệu đơn đi đâu, KHÔNG ghi gì lên Google Sheet.
// =========================================================================
(function () {
  "use strict";

  const TEN_TAB = "PHAN_TACH_SHOPEE";
  const KHOA_LUU = "zzm_phan_tach_shopee_v1"; // bảng điều khiển đọc được lần trước

  // Giá trị mặc định — PHẢI giống code cũ trong script.js và MAC_DINH của apps_script/phan_tach_shopee.gs
  const MAC_DINH = {
    nhanSku: ["SKU Reference No."],
    nhanSoLuong: ["Quantity"],
    nhanGia: ["Price"],
    dauTachMon: "[số]",
    kyHieuNhan: "x",
    kyHieuCombo: "+",
  };
  // Nhãn cột A trên sheet → tên trong cấu hình
  const O_NHAN = { NHAN_SKU: "nhanSku", NHAN_SO_LUONG: "nhanSoLuong", NHAN_GIA: "nhanGia" };
  const O_CHU = { DAU_TACH_MON: "dauTachMon", KY_HIEU_NHAN: "kyHieuNhan", KY_HIEU_COMBO: "kyHieuCombo" };

  // Trạng thái hiện tại
  //   kieu: "dang_doc" (chưa đọc xong) | "da_doc" | "ban_luu" (mất mạng, dùng lần trước) | "mac_dinh" (chưa từng đọc)
  const trangThai = { kieu: "dang_doc", bat: false, coBang: false, loi: [], cauHinh: saoChep(MAC_DINH), luc: 0 };
  let bienDichSan = null; // regex đã dựng từ trangThai.cauHinh

  // ── Tiện ích ──
  function saoChep(o) { return JSON.parse(JSON.stringify(o)); }
  function sach(v) {
    let s = v === null || v === undefined ? "" : String(v);
    try { s = s.normalize("NFC"); } catch (e) { /* trình duyệt cũ */ }
    return s.trim();
  }
  function laDung(v) { return v === true || sach(v).toUpperCase() === "TRUE"; }
  // Thoát ký tự đặc biệt: chủ dự án ghi chữ thường trên sheet (vd "SKU Reference No.") — không cần biết regex
  function thoat(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  // ─────────────────────────────────────────────────────────────────────────
  // ĐỌC BẢNG: values (mảng dòng từ API, cột A:B) → { coBang, bat, cauHinh, loi[] }
  // Tìm theo CHỮ ở cột A (dời / chèn dòng không sao).
  // ─────────────────────────────────────────────────────────────────────────
  function phanTichBang(values) {
    const kq = { coBang: false, bat: false, cauHinh: saoChep(MAC_DINH), loi: [] };
    if (!Array.isArray(values)) return kq;
    const viTri = {};
    values.forEach(function (d, i) {
      if (!Array.isArray(d)) return;
      const k = sach(d[0]).toUpperCase();
      if (k && viTri[k] === undefined) viTri[k] = d;
    });
    if (!viTri.BAT_FILE_MOI) return kq; // chưa có bảng điều khiển → như chưa có tính năng (☐, mặc định)
    kq.coBang = true;
    kq.bat = laDung(viTri.BAT_FILE_MOI[1]);

    // Nhãn: nhiều tên thay thế ngăn bằng |
    Object.keys(O_NHAN).forEach(function (nhan) {
      const ten = O_NHAN[nhan];
      if (!viTri[nhan]) { kq.loi.push(nhan + ": thiếu dòng → dùng mặc định \"" + MAC_DINH[ten].join(" | ") + "\""); return; }
      const ds = sach(viTri[nhan][1]).split("|").map(function (x) { return x.trim(); }).filter(Boolean);
      if (!ds.length) { kq.loi.push(nhan + ": ô trống → dùng mặc định \"" + MAC_DINH[ten].join(" | ") + "\""); return; }
      kq.cauHinh[ten] = ds;
    });
    // Dấu tách món / ký hiệu
    Object.keys(O_CHU).forEach(function (nhan) {
      const ten = O_CHU[nhan];
      if (!viTri[nhan]) { kq.loi.push(nhan + ": thiếu dòng → dùng mặc định \"" + MAC_DINH[ten] + "\""); return; }
      const v = sach(viTri[nhan][1]);
      if (!v) { kq.loi.push(nhan + ": ô trống → dùng mặc định \"" + MAC_DINH[ten] + "\""); return; }
      if (ten === "dauTachMon" && (v.indexOf("số") < 0 || v.replace(/số/g, "").trim() === "")) {
        kq.loi.push(nhan + " = \"" + v + "\": phải có chữ \"số\" và ít nhất 1 ký hiệu khác (vd [số]) → dùng mặc định \"" + MAC_DINH[ten] + "\"");
        return;
      }
      kq.cauHinh[ten] = v;
    });
    if (kq.cauHinh.kyHieuNhan === kq.cauHinh.kyHieuCombo) {
      kq.loi.push("KY_HIEU_NHAN và KY_HIEU_COMBO trùng nhau → dùng mặc định cho cả hai");
      kq.cauHinh.kyHieuNhan = MAC_DINH.kyHieuNhan; kq.cauHinh.kyHieuCombo = MAC_DINH.kyHieuCombo;
    }
    return kq;
  }

  // Dựng regex từ cấu hình (giữ đúng y regex của code cũ khi dùng giá trị mặc định)
  function bienDich(ch) {
    const nhan = function (ds) { return new RegExp("(?:" + ds.map(thoat).join("|") + ")\\s*:\\s*([^;]*)", "i"); };
    const k = thoat(ch.kyHieuNhan);
    return {
      khoi: new RegExp(ch.dauTachMon.split("số").map(thoat).join("\\d+"), "g"), // "[số]" → /\[\d+\]/g
      sku: nhan(ch.nhanSku),
      soLuong: nhan(ch.nhanSoLuong),
      gia: nhan(ch.nhanGia),
      nhanTot: new RegExp("^(.*?)" + k + "([1-9]\\d*)$"), // "ABC123x2" → ABC123, SL ×2
      nhanSai: new RegExp(k + "(\\d*\\D*)$"), // có "x" nhưng sai dạng → cảnh báo
      combo: ch.kyHieuCombo,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // THUẬT TOÁN TÁCH — từng bước giống code cũ trong script.js
  // ─────────────────────────────────────────────────────────────────────────
  function tachMon(chuoi, bd) {
    if (!chuoi) return [];
    bd.khoi.lastIndex = 0;
    const khop = [...chuoi.matchAll(bd.khoi)];
    if (khop.length === 0) return [chuoi.trim()];
    const ds = [];
    for (let i = 0; i < khop.length; i++) {
      const dau = khop[i].index;
      const cuoi = khop[i + 1] ? khop[i + 1].index : chuoi.length;
      ds.push(chuoi.slice(dau, cuoi).trim());
    }
    return ds;
  }
  function lay(khoi, re) {
    const m = khoi.match(re);
    return m ? m[1].trim() : null;
  }
  function chuanGia(tho) {
    if (tho === null) return null;
    let s = String(tho).replace(/[^\d.,]/g, "");
    if (s === "") return null;
    s = s.replace(/,/g, "");
    return s;
  }
  function xetSku(skuTho, soLuong, bd) {
    const kq = { sku: skuTho, qty: soLuong, warn: false };
    if (skuTho && skuTho.indexOf(bd.combo) !== -1) return kq; // combo → giữ nguyên
    const tot = skuTho ? skuTho.match(bd.nhanTot) : null;
    if (tot) {
      kq.sku = tot[1].trim();
      kq.qty = parseInt(tot[2], 10) * soLuong;
      return kq;
    }
    const sai = skuTho ? skuTho.match(bd.nhanSai) : null;
    if (sai) {
      const duoi = sai[1];
      if (duoi === "" || /^0/.test(duoi) || /\D/.test(duoi)) kq.warn = true;
    }
    return kq;
  }
  // chuoi (ô product_info) → [{ sku, qty, price, warn }] — đúng định dạng script.js hiện lên Bảng 2
  // 21/11 (chủ dự án duyệt): KHÔNG ĐỌC ĐƯỢC SỐ LƯỢNG (không có nhãn số lượng / sau nhãn không có chữ số)
  //   → qty = "(thiếu SL)" (KHÔNG tự ghi 1 như code cũ) + warn = true (tô vàng) + thieuSL = true (khung đỏ + hộp thoại).
  //   qtyCu / warnCu = kết quả code cũ cho món này (tự ghi 1) — CHỈ dùng để so ☐ (không tính là "khác").
  const THIEU_SL = "(thiếu SL)";
  function tach(chuoi, bd) {
    bd = bd || layBienDich();
    const kq = [];
    tachMon(chuoi, bd).forEach(function (b) {
      if (!b) return;
      const skuTho = lay(b, bd.sku);
      const slTho = lay(b, bd.soLuong);
      const giaTho = lay(b, bd.gia);
      const gia = chuanGia(giaTho);
      const sl = slTho !== null ? parseInt(slTho.replace(/[^\d]/g, ""), 10) : NaN;
      const x = xetSku(skuTho, isNaN(sl) ? 1 : sl, bd);
      const mon = {
        sku: x.sku === "" || x.sku === null ? "(thiếu SKU)" : x.sku,
        qty: isNaN(x.qty) ? "(thiếu)" : x.qty,
        price: gia === null ? "(thiếu)" : gia,
        warn: x.warn,
      };
      if (isNaN(sl)) {
        Object.defineProperty(mon, "qtyCu", { value: mon.qty, enumerable: false });
        Object.defineProperty(mon, "warnCu", { value: mon.warn, enumerable: false });
        Object.defineProperty(mon, "thieuSL", { value: true, enumerable: false });
        mon.qty = THIEU_SL;
        mon.warn = true;
      }
      kq.push(mon);
    });
    return kq;
  }

  function layBienDich() {
    if (!bienDichSan) {
      try { bienDichSan = bienDich(trangThai.cauHinh); }
      catch (e) { console.warn("[PhanTachShopee] Cấu hình không dựng được — dùng mặc định:", e); trangThai.loi.push("bảng điều khiển không dùng được → dùng mặc định"); trangThai.cauHinh = saoChep(MAC_DINH); bienDichSan = bienDich(trangThai.cauHinh); }
    }
    return bienDichSan;
  }

  function hopLe(ds, chuoi) {
    if (!Array.isArray(ds)) return false;
    if (chuoi && ds.length === 0) return false; // code cũ luôn ra ≥ 1 món khi ô có chữ
    return ds.every(function (m) {
      return m && typeof m.sku === "string" && m.sku !== "" && typeof m.price === "string" && typeof m.warn === "boolean" &&
        ((typeof m.qty === "number" && isFinite(m.qty)) || m.qty === "(thiếu)" || m.qty === THIEU_SL);
    });
  }
  // So với code cũ. Món "thiếu SL" so bằng qtyCu / warnCu (code cũ tự ghi 1) — chỗ khác đó được báo riêng bằng khung đỏ, không tính "khác".
  function giongNhau(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      const q = b[i].thieuSL ? b[i].qtyCu : b[i].qty, w = b[i].thieuSL ? b[i].warnCu : b[i].warn;
      if (!a[i] || a[i].sku !== b[i].sku || a[i].qty !== q || a[i].price !== b[i].price || !!a[i].warn !== w) return false;
    }
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // KHUNG BÁO (1 khung / 1 lần bấm XỬ LÝ, ngay trên Bảng 2 — chỉ màn hình, không in)
  // ─────────────────────────────────────────────────────────────────────────
  let gom = null;
  function batDauGom() {
    if (gom) return;
    gom = { lech: [], lui: [], loiNgam: 0, thieuSL: [], dongThieuSL: [], dem: 0 }; // dem = số món đã qua (= số dòng Bảng 2)
    setTimeout(hienKhung, 0); // sau khi script.js vẽ xong Bảng 2
  }
  function danhSachDon(ds) {
    const duy = ds.filter(function (v, i, a) { return a.indexOf(v) === i; });
    const dau = duy.slice(0, 5).map(function (v) { return v || "(không mã đơn)"; }).join(", ");
    return duy.length > 5 ? dau + " … và " + (duy.length - 5) + " đơn khác" : dau;
  }
  function xoaKhung() { const k = document.getElementById("ptshp-khung"); if (k) k.remove(); }
  function themCss() {
    if (document.getElementById("ptshp-css")) return;
    const st = document.createElement("style");
    st.id = "ptshp-css";
    st.textContent =
      "#ptshp-khung{box-sizing:border-box;max-width:100%;margin:6px 0;padding:8px 34px 8px 10px;position:relative;background:#fff;color:#000;" +
      "font-size:13px;line-height:1.45;overflow-wrap:anywhere;border-radius:6px}" +
      "#ptshp-khung .ptshp-dong{margin:0 0 6px}#ptshp-khung .ptshp-dong:last-of-type{margin-bottom:0}" +
      "#ptshp-khung .ptshp-canh{border:2px solid #000;padding:6px 8px;border-radius:4px}" +
      "#ptshp-khung .ptshp-tin{border:1px dashed #555;padding:6px 8px;border-radius:4px}" +
      "#ptshp-khung b{font-weight:700}" +
      "#ptshp-khung .ptshp-do{background:#c0392b;color:#fff;border:3px solid #7b241c;padding:10px 12px;border-radius:6px;font-size:15px;line-height:1.5}" +
      "#ptshp-khung .ptshp-do .ptshp-tieu{display:block;font-size:18px;font-weight:800;letter-spacing:.3px;margin-bottom:4px}" +
      "#ptshp-dong-x{position:absolute;top:4px;right:4px;width:26px;height:26px;border:1px solid #999;background:#fff;color:#000;border-radius:4px;cursor:pointer;font-size:16px;line-height:1;padding:0}";
    document.head.appendChild(st);
  }
  function hienKhung() {
    const g = gom; gom = null;
    if (!g) return;
    const dong = [];
    if (g.thieuSL.length) {
      const bat = trangThai.bat === true;
      dong.push(["do", '<span class="ptshp-tieu">⛔ KHÔNG ĐỌC ĐƯỢC SỐ LƯỢNG Ở ' + g.thieuSL.length + " MÓN — KHÔNG ĐƯỢC IN</span>" +
        "Đơn: <b>" + danhSachDon(g.thieuSL) + "</b> (dòng tô vàng trên Bảng 2). " +
        (bat ? 'Ô SL đang ghi <b>"(thiếu SL)"</b>. ' : "Trang đang <b>TẠM GHI 1</b> — số này CHƯA CHẮC ĐÚNG. ") +
        "Mở đơn trên Shopee, <b>sửa đúng số lượng</b> rồi mới Tạo mẫu in. Nhiều đơn bị cùng lúc → dữ liệu Shopee có thể đã đổi định dạng → <b>BÁO QUẢN LÝ NGAY</b>."]);
    }
    if (g.lui.length) {
      dong.push(["canh", "⚠ <b>PHẦN PHÂN TÁCH MỚI BỊ LỖI</b> ở " + g.lui.length + " dòng (đơn " + danhSachDon(g.lui) +
        ") — trang tạm dùng <b>cách cũ</b> cho các dòng này. Kiểm tra kỹ Bảng 2 trước khi in và báo quản lý."]);
    }
    if (trangThai.loi.length) {
      dong.push(["canh", "⚠ <b>Bảng điều khiển phân tách (Google Sheet) có ô chưa hợp lệ</b> — đang dùng giá trị mặc định cho: " +
        trangThai.loi.map(laChu).join("; ") + ". Báo quản lý sửa lại."]);
    }
    if (g.lech.length) {
      dong.push(["tin", "ℹ Bản phân tách mới cho kết quả <b>khác</b> ở " + g.lech.length + " dòng (đơn " + danhSachDon(g.lech) +
        "). Trang vẫn dùng <b>kết quả cũ</b>. Hãy báo quản lý."]);
    }
    xoaKhung();
    if (!dong.length) return;
    let bang = null;
    try { bang = document.getElementById("than-bang-kq"); } catch (e) { /* bỏ qua */ }
    const hop = bang && bang.closest ? bang.closest(".scroll-container") : null;
    if (!hop || !hop.parentNode) { console.warn("[PhanTachShopee] Không tìm thấy chỗ đặt khung báo:", dong); return; }
    themCss();
    const k = document.createElement("div");
    k.id = "ptshp-khung";
    k.className = "no-print"; // chỉ màn hình — KHÔNG bao giờ lên giấy in
    k.setAttribute("role", "alert");
    k.innerHTML = dong.map(function (d) { return '<div class="ptshp-dong ptshp-' + d[0] + '">' + d[1] + "</div>"; }).join("") +
      '<button type="button" id="ptshp-dong-x" title="Đóng" aria-label="Đóng">×</button>';
    hop.parentNode.insertBefore(k, hop);
    document.getElementById("ptshp-dong-x").addEventListener("click", xoaKhung);
    if (g.thieuSL.length) {
      // Tô vàng đúng các dòng thiếu số lượng (☐: code cũ không tô; ☑: script.js đã tô — tô lại không sao). Chỉ màu, không đổi số.
      g.dongThieuSL.forEach(function (i) { const r = bang.rows[i]; if (r) r.classList.add("row-highlight-warn"); });
      try { k.scrollIntoView({ block: "nearest" }); } catch (e) { /* bỏ qua */ }
      // Hộp thoại bắt buộc bấm OK — người vận hành KHÔNG thể không thấy
      try {
        window.alert("⛔ KHÔNG ĐỌC ĐƯỢC SỐ LƯỢNG Ở " + g.thieuSL.length + " MÓN\n\nĐơn: " + danhSachDon(g.thieuSL) +
          "\n\n" + (trangThai.bat === true ? 'Ô số lượng đang ghi "(thiếu SL)".' : "Trang đang TẠM GHI 1 — CHƯA CHẮC ĐÚNG.") +
          "\nKHÔNG ĐƯỢC IN cho tới khi sửa đúng số lượng.\nNhiều đơn bị cùng lúc → BÁO QUẢN LÝ NGAY.");
      } catch (e) { /* bỏ qua */ }
    }
  }
  function laChu(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // ─────────────────────────────────────────────────────────────────────────
  // CHỖ script.js GỌI — 1 lần / 1 dòng Bảng 1
  //   monCu = các món code cũ vừa tách cho dòng này. Trả về null = giữ kết quả cũ; mảng = dùng mảng này.
  // ─────────────────────────────────────────────────────────────────────────
  function chonKetQua(chuoi, monCu, maDon) {
    batDauGom();
    const bat = trangThai.bat === true;
    const dauDong = gom.dem; // dòng Bảng 2 của món đầu dòng này
    let monMoi;
    try {
      monMoi = api.tach(chuoi);
      if (!hopLe(monMoi, chuoi)) throw new Error("kết quả không hợp lệ");
    } catch (e) {
      console.error("[PhanTachShopee] Lỗi khi tách đơn " + maDon + " — dùng kết quả cũ:", e);
      if (bat) gom.lui.push(maDon); else gom.loiNgam++;
      gom.dem += Array.isArray(monCu) ? monCu.length : 0;
      return null;
    }
    // Món không đọc được số lượng → khung đỏ + hộp thoại + tô vàng (CẢ ☐ lẫn ☑)
    // ☐: dùng món cũ (cùng số món, cùng thứ tự với monMoi khi giống nhau) · ☑: dùng monMoi
    const soMonDung = bat ? monMoi.length : (Array.isArray(monCu) ? monCu.length : 0);
    monMoi.forEach(function (m, i) {
      if (m.thieuSL && (bat || i < soMonDung)) { gom.thieuSL.push(maDon); gom.dongThieuSL.push(dauDong + i); }
    });
    gom.dem += soMonDung;
    const giong = giongNhau(monCu, monMoi);
    if (!bat) {
      if (!giong) { gom.lech.push(maDon); console.warn("[PhanTachShopee] Đơn " + maDon + " — cũ:", monCu, "mới:", monMoi); }
      return null;
    }
    if (!giong) console.info("[PhanTachShopee] Đơn " + maDon + " khác cách cũ (đang dùng file mới) — cũ:", monCu, "mới:", monMoi);
    return monMoi.map(function (m) { return { sku: m.sku, qty: m.qty, price: m.price, warn: m.warn }; });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ĐỌC BẢNG ĐIỀU KHIỂN KHI MỞ TRANG
  // ─────────────────────────────────────────────────────────────────────────
  function apDung(kq, kieu) {
    trangThai.kieu = kieu;
    trangThai.coBang = kq.coBang;
    trangThai.bat = kq.bat === true;
    trangThai.cauHinh = kq.cauHinh;
    trangThai.loi = kq.loi.slice();
    bienDichSan = null;
    try { layBienDich(); } catch (e) { /* layBienDich tự lùi mặc định */ }
    console.info("[PhanTachShopee] Bảng điều khiển: " + (trangThai.bat ? "☑ DÙNG FILE MỚI" : "☐ dùng code cũ (file mới chạy ngầm để so)") +
      " — nguồn: " + kieu + (trangThai.loi.length ? " — ô chưa hợp lệ: " + trangThai.loi.join("; ") : ""));
  }
  function luu(kq) { try { localStorage.setItem(KHOA_LUU, JSON.stringify({ kq: kq, luc: Date.now() })); } catch (e) { /* bỏ qua */ } }
  function docLuu() {
    try {
      const b = JSON.parse(localStorage.getItem(KHOA_LUU) || "null");
      if (!b || !b.kq || typeof b.kq.bat !== "boolean" || !b.kq.cauHinh) return null;
      // kiểm lại bản lưu (phòng bản lưu hỏng)
      const c = b.kq.cauHinh;
      const ds = function (v) { return Array.isArray(v) && v.length > 0 && v.every(function (x) { return typeof x === "string" && x; }); };
      const chu = function (v) { return typeof v === "string" && v; };
      if (!ds(c.nhanSku) || !ds(c.nhanSoLuong) || !ds(c.nhanGia) || !chu(c.dauTachMon) || !chu(c.kyHieuNhan) || !chu(c.kyHieuCombo)) return null;
      b.kq.loi = Array.isArray(b.kq.loi) ? b.kq.loi : [];
      return b;
    } catch (e) { return null; }
  }
  function dungBanLuu(lyDo) {
    const b = docLuu();
    console.warn("[PhanTachShopee] Không đọc được bảng điều khiển (" + lyDo + ")" + (b ? " — dùng bản lưu lần trước." : " — máy chưa từng đọc → ☐ + mặc định."));
    if (b) apDung(b.kq, "ban_luu");
    else apDung({ coBang: false, bat: false, cauHinh: saoChep(MAC_DINH), loi: [] }, "mac_dinh");
  }

  const api = {
    trangThai: trangThai,
    chonKetQua: chonKetQua,
    tach: function (chuoi) { return tach(chuoi, layBienDich()); },
    // cho bài kiểm thử
    _phanTichBang: phanTichBang,
    _bienDich: bienDich,
    _tachVoi: tach,
    _MAC_DINH: MAC_DINH,
  };
  window.PhanTachShopee = api;

  // Bấm XỬ LÝ → xóa khung báo cũ trước (pha bắt, chạy trước script.js)
  try {
    document.addEventListener("click", function (e) {
      const t = e.target;
      if (t && t.closest && t.closest("#nut-xu-ly")) xoaKhung();
    }, true);
  } catch (e) { /* bỏ qua */ }

  // Có bản lưu → dùng ngay trong lúc chờ đọc sheet (bấm XỬ LÝ sớm vẫn đúng như lần trước)
  const banLuuDau = docLuu();
  if (banLuuDau) { trangThai.coBang = banLuuDau.kq.coBang; trangThai.bat = banLuuDau.kq.bat; trangThai.cauHinh = banLuuDau.kq.cauHinh; trangThai.loi = banLuuDau.kq.loi.slice(); }

  try {
    const cfg = typeof C2_CONFIG !== "undefined" ? C2_CONFIG : null; // khai báo trong script.js (nạp trước file này)
    if (!cfg || !cfg.SPREADSHEET_ID || !cfg.API_KEY || typeof fetch !== "function") { dungBanLuu("thiếu cấu hình"); return; }
    const url = "https://sheets.googleapis.com/v4/spreadsheets/" + cfg.SPREADSHEET_ID + "/values/" + encodeURIComponent(TEN_TAB + "!A1:B40") +
      "?valueRenderOption=UNFORMATTED_VALUE&key=" + cfg.API_KEY;
    const hetGio = new Promise(function (_, tuChoi) { setTimeout(function () { tuChoi(new Error("quá 10 giây")); }, 10000); });
    Promise.race([fetch(url), hetGio])
      .then(function (r) {
        if (r.status === 400) return { values: [] }; // tab chưa có → như chưa có tính năng
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (d) {
        const kq = phanTichBang(d && d.values);
        luu(kq);
        apDung(kq, kq.coBang ? "da_doc" : "chua_co_bang");
      })
      .catch(function (e) { dungBanLuu(e && e.message); });
  } catch (e) {
    console.warn("[PhanTachShopee] Lỗi khi đọc bảng điều khiển:", e);
  }
})();
