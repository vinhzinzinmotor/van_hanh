// =========================================================================
// PHẢN HỒI KÍCH THƯỚC GÓI HÀNG — ZinZinMotor
// Nhân viên quét QR trên đơn (camera điện thoại / máy bắn) hoặc gõ vài ký tự mã đơn
// → thấy các mã hàng trong đơn + thùng / kích thước / khối lượng đang có
// → sửa mã bị sai (hoặc chỉ ghi chú) → Nộp.
//
// ĐỌC (chỉ đọc, khóa API): sheet LOG (đơn đã tạo mẫu in 45 ngày gần nhất, lấy lần tạo mẫu in GẦN NHẤT
//   của mỗi đơn), KICH_THUOC_KIEN_HANG, TONG_HOP_SIZE_THUNG — tìm cột theo TÊN TIÊU ĐỀ.
// GHI: chỉ qua Apps Script "Phan Hoi Kich Thuoc ZZM" → GHI THÊM vào sheet PHAN_HOI_KICH_THUOC.
//   KHÔNG sửa dữ liệu chính. Người quản lý xem rồi tự cập nhật.
// Khớp mã hàng CHÍNH XÁC cột "Mã hàng" (chỉ bỏ khoảng trắng đầu / cuối) — giống mẫu in.
// =========================================================================

(function () {
  "use strict";

  const CFG = window.CAU_HINH_PHAN_HOI || {};
  const SO_DONG_MOT_LAN = 30000; // đọc LOG từ cuối lên, mỗi lần 30.000 dòng (~48 ngày hiện nay)
  const SO_LAN_DOC_TOI_DA = 4;
  const CM_TOI_DA = 300;
  const GRAM_TOI_DA = 100000;
  const KHOA_TEN = "zzm_ten_nhan_vien"; // dùng chung tên với trang Vận Hành / Kiểm Hàng
  const TIEU_DE_KT = { MA: "mã hàng", TEN: "tên hàng", DAI: "kt1 d (chuẩn)", RONG: "kt2 r (chuẩn)", CAO: "kt3 c (chuẩn)", KL: "kl gram (chuẩn)", THUNG: "tên thùng" };

  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  };
  const chuoi = function (v) { return v == null ? "" : String(v).trim(); };
  const khoaDon = function (v) { return chuoi(v).replace(/\s+/g, "").toUpperCase(); };
  const chuanTieuDe = function (v) { return chuoi(v).normalize("NFC").toLowerCase().replace(/\s+/g, " "); };
  // Chữ tiếng Việt có dấu → máy quét đang gõ qua bộ gõ tiếng Việt (Unikey) → mã bị biến đổi
  const coDauTiengViet = function (s) { return /[À-ỹĐđ]/.test(s.normalize("NFC")); };

  // ── TRẠNG THÁI ──
  const duLieu = { donTheoKhoa: new Map(), dsKhoa: [], ktTheoMa: new Map(), dsThung: [], daTai: false, luc: null };
  let donMo = null; // { khoa, ma, vd, luc, hang: [{ sku, sl }] }
  let maGui = ""; // mã chống nộp trùng khi bấm Nộp lại sau lỗi mạng
  let dangNop = false;
  let chonGoiY = -1;

  function thongBao(chu) {
    const t = $("thong-bao");
    t.textContent = chu;
    t.hidden = false;
    clearTimeout(thongBao.h);
    thongBao.h = setTimeout(function () { t.hidden = true; }, 3500);
  }

  // ── TÊN NGƯỜI NỘP ──
  function docTen() { try { return localStorage.getItem(KHOA_TEN) || ""; } catch (e) { return ""; } }
  function veTen() { $("ten-nguoi").textContent = docTen() || "Nhập tên"; }
  function moHopTen() { $("o-ten").value = docTen(); $("hop-ten").hidden = false; $("o-ten").focus(); }
  $("nut-nguoi").addEventListener("click", moHopTen);
  $("form-ten").addEventListener("submit", function (e) {
    e.preventDefault();
    const ten = chuoi($("o-ten").value).replace(/[<>]/g, "").slice(0, 60);
    if (!ten) { $("o-ten").focus(); return; }
    try { localStorage.setItem(KHOA_TEN, ten); } catch (er) { /* không lưu được thì vẫn dùng cho phiên này */ }
    $("hop-ten").hidden = true;
    veTen();
    if (!docTen()) $("ten-nguoi").textContent = ten;
    $("ten-nguoi").dataset.ten = ten;
  });
  function tenNguoiNop() { return docTen() || $("ten-nguoi").dataset.ten || ""; }

  // ── ĐỌC SHEET ──
  async function layJson(url, ms) {
    const huy = new AbortController();
    const hen = setTimeout(function () { huy.abort(); }, ms || 30000);
    try {
      const r = await fetch(url, { signal: huy.signal, cache: "no-store" });
      if (!r.ok) throw new Error("Mã lỗi " + r.status);
      return await r.json();
    } finally {
      clearTimeout(hen);
    }
  }
  const goc = function () { return "https://sheets.googleapis.com/v4/spreadsheets/" + CFG.SPREADSHEET_ID; };

  // Đơn trong LOG: cột A phiên, B vận đơn, C mã đơn, D mã hàng, E số lượng, H thời gian (ISO)
  async function taiDon() {
    const meta = await layJson(goc() + "?fields=sheets.properties(title,gridProperties.rowCount)&key=" + CFG.API_KEY);
    const log = (meta.sheets || []).find(function (s) { return s.properties.title === "LOG"; });
    if (!log) throw new Error("Không thấy sheet LOG");
    const cuoi = log.properties.gridProperties.rowCount;
    const moc = new Date(Date.now() - (CFG.SO_NGAY_TIM_DON || 45) * 86400000).toISOString();
    const theoKhoa = new Map(); // khoa → Map(phien → { luc, ma, vd, hang })
    let den = cuoi;
    for (let lan = 0; lan < SO_LAN_DOC_TOI_DA && den >= 2; lan++) {
      const tu = Math.max(2, den - SO_DONG_MOT_LAN + 1);
      const kq = await layJson(goc() + "/values:batchGet?ranges=" + encodeURIComponent("LOG!A" + tu + ":E" + den) +
        "&ranges=" + encodeURIComponent("LOG!H" + tu + ":H" + den) + "&valueRenderOption=FORMATTED_VALUE&key=" + CFG.API_KEY, 45000);
      const ae = (kq.valueRanges[0] && kq.valueRanges[0].values) || [];
      const h = (kq.valueRanges[1] && kq.valueRanges[1].values) || [];
      let cuNhat = null;
      for (let i = 0; i < ae.length; i++) {
        const d = ae[i] || [];
        const luc = chuoi((h[i] || [])[0]);
        if (!luc) continue;
        if (!cuNhat || luc < cuNhat) cuNhat = luc;
        if (luc < moc) continue;
        const ma = chuoi(d[2]);
        const khoa = khoaDon(ma);
        if (!khoa) continue;
        const phien = chuoi(d[0]) || "?";
        if (!theoKhoa.has(khoa)) theoKhoa.set(khoa, new Map());
        const cacPhien = theoKhoa.get(khoa);
        if (!cacPhien.has(phien)) cacPhien.set(phien, { luc: luc, ma: ma, vd: "", hang: [] });
        const p = cacPhien.get(phien);
        if (luc > p.luc) p.luc = luc;
        if (!p.vd && chuoi(d[1])) p.vd = chuoi(d[1]);
        const sku = chuoi(d[3]);
        if (sku) p.hang.push({ sku: sku, sl: chuoi(d[4]) });
      }
      // Đã đọc tới trước mốc 45 ngày → đủ
      if (cuNhat && cuNhat < moc) break;
      den = tu - 1;
    }
    const donTheoKhoa = new Map();
    theoKhoa.forEach(function (cacPhien, khoa) {
      let moiNhat = null;
      cacPhien.forEach(function (p) { if (!moiNhat || p.luc > moiNhat.luc) moiNhat = p; });
      if (!moiNhat || !moiNhat.hang.length) return;
      // Cùng 1 mã hàng nhiều dòng trong đơn → gộp 1 thẻ, cộng số lượng (để không nộp trùng)
      const gop = [];
      moiNhat.hang.forEach(function (h) {
        const co = gop.find(function (x) { return x.sku === h.sku; });
        if (!co) { gop.push({ sku: h.sku, sl: h.sl }); return; }
        const a = Number(co.sl), b = Number(h.sl);
        co.sl = isFinite(a) && isFinite(b) && co.sl !== "" && h.sl !== "" ? String(a + b) : co.sl + " + " + h.sl;
      });
      donTheoKhoa.set(khoa, { khoa: khoa, ma: moiNhat.ma, vd: moiNhat.vd, luc: moiNhat.luc, hang: gop });
    });
    duLieu.donTheoKhoa = donTheoKhoa;
    duLieu.dsKhoa = Array.from(donTheoKhoa.keys()).sort(function (a, b) {
      return donTheoKhoa.get(b).luc < donTheoKhoa.get(a).luc ? -1 : 1; // đơn mới nhất lên đầu
    });
  }

  // Số thứ tự cột (0 = A) → chữ cái cột
  function chuCot(i) { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }

  // Đọc 2 bước để nhẹ cho điện thoại: (1) 10 dòng đầu tìm tiêu đề → (2) chỉ 7 cột cần dùng
  async function taiKichThuoc() {
    const dau = await layJson(goc() + "/values/" + encodeURIComponent("KICH_THUOC_KIEN_HANG!1:10") + "?valueRenderOption=FORMATTED_VALUE&key=" + CFG.API_KEY);
    const tren = dau.values || [];
    let dongTd = -1;
    for (let i = 0; i < tren.length; i++) {
      if ((tren[i] || []).some(function (o) { return chuanTieuDe(o) === TIEU_DE_KT.MA; })) { dongTd = i; break; }
    }
    if (dongTd < 0) throw new Error("Sheet KICH_THUOC_KIEN_HANG không có cột 'Mã hàng'");
    const td = tren[dongTd].map(chuanTieuDe);
    const viTri = {};
    Object.keys(TIEU_DE_KT).forEach(function (k) { viTri[k] = td.indexOf(TIEU_DE_KT[k]); });
    const thieu = Object.keys(viTri).filter(function (k) { return viTri[k] < 0; });
    if (thieu.length) throw new Error("Sheet KICH_THUOC_KIEN_HANG thiếu cột: " + thieu.map(function (k) { return TIEU_DE_KT[k]; }).join(", "));
    const khoa = Object.keys(TIEU_DE_KT);
    const dongDau = dongTd + 2; // dòng dữ liệu đầu tiên (đánh số từ 1)
    const kq = await layJson(goc() + "/values:batchGet?" + khoa.map(function (k) {
      return "ranges=" + encodeURIComponent("KICH_THUOC_KIEN_HANG!" + chuCot(viTri[k]) + dongDau + ":" + chuCot(viTri[k]));
    }).join("&") + "&ranges=" + encodeURIComponent("TONG_HOP_SIZE_THUNG!1:200") + "&valueRenderOption=FORMATTED_VALUE&key=" + CFG.API_KEY, 45000);
    const cotDl = {};
    khoa.forEach(function (k, i) { cotDl[k] = (kq.valueRanges[i] && kq.valueRanges[i].values) || []; });
    const thung = (kq.valueRanges[khoa.length] && kq.valueRanges[khoa.length].values) || [];
    const o = function (k, i) { return chuoi((cotDl[k][i] || [])[0]); };
    const map = new Map();
    for (let i = 0; i < cotDl.MA.length; i++) {
      const ma = o("MA", i);
      if (!ma || map.has(ma)) continue; // trùng mã → giữ dòng đầu (giống mẫu in)
      map.set(ma, { ten: o("TEN", i), d: o("DAI", i), r: o("RONG", i), c: o("CAO", i), kl: o("KL", i), thung: o("THUNG", i) });
    }
    const tdThung = (thung[0] || []).map(chuanTieuDe);
    const cotThung = tdThung.indexOf("tên thùng");
    if (cotThung < 0) throw new Error("Sheet TONG_HOP_SIZE_THUNG không có cột 'TÊN THÙNG'");
    const ds = [];
    thung.slice(1).forEach(function (d) { const t = chuoi((d || [])[cotThung]); if (t && ds.indexOf(t) < 0) ds.push(t); });
    duLieu.ktTheoMa = map;
    duLieu.dsThung = ds;
  }

  async function taiDuLieu() {
    const tt = $("trang-thai");
    tt.className = "trang-thai";
    tt.textContent = "Đang tải danh sách đơn " + (CFG.SO_NGAY_TIM_DON || 45) + " ngày gần nhất…";
    try {
      await Promise.all([taiDon(), taiKichThuoc()]);
      duLieu.daTai = true;
      duLieu.luc = new Date();
      tt.innerHTML = "✓ " + duLieu.donTheoKhoa.size.toLocaleString("vi-VN") + " đơn (" + (CFG.SO_NGAY_TIM_DON || 45) + " ngày) · tải lúc " +
        duLieu.luc.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) + ' <button type="button" id="nut-tai-lai">Tải lại</button>';
      $("nut-tai-lai").addEventListener("click", taiDuLieu);
      if ($("o-tim").value) xuLyNhap(false);
    } catch (e) {
      console.error("[PhanHoi] Không tải được dữ liệu:", e);
      tt.className = "trang-thai loi";
      tt.innerHTML = "Không tải được dữ liệu (kiểm tra mạng). " + '<button type="button" id="nut-tai-lai">Thử lại</button>';
      $("nut-tai-lai").addEventListener("click", taiDuLieu);
    }
  }

  // ── TÌM ĐƠN ──
  function baoLoiTim(chu) { $("loi-tim").textContent = chu; $("loi-tim").hidden = !chu; }

  function xuLyNhap(laEnter) {
    const tho = $("o-tim").value;
    baoLoiTim("");
    if (coDauTiengViet(tho)) {
      $("goi-y").hidden = true;
      baoLoiTim("Mã có dấu tiếng Việt — bộ gõ tiếng Việt (Unikey) đang bật. Hãy tắt bộ gõ rồi quét / gõ lại.");
      return;
    }
    const q = khoaDon(tho);
    if (!duLieu.daTai) { if (laEnter && q) baoLoiTim("Đang tải danh sách đơn, chờ một chút rồi thử lại."); return; }
    if (laEnter && duLieu.donTheoKhoa.has(q)) { moDon(q); return; }
    if (laEnter) {
      const li = $("goi-y").querySelectorAll("li[data-khoa]");
      if (!$("goi-y").hidden && li[chonGoiY]) { moDon(li[chonGoiY].dataset.khoa); return; }
      if (q) baoLoiTim("Không tìm thấy đơn \"" + tho.trim() + "\" trong " + (CFG.SO_NGAY_TIM_DON || 45) + " ngày gần nhất.");
      return;
    }
    if (q.length < 3) { $("goi-y").hidden = true; return; }
    const kq = [];
    for (let i = 0; i < duLieu.dsKhoa.length && kq.length < 8; i++) {
      const k = duLieu.dsKhoa[i];
      const don = duLieu.donTheoKhoa.get(k);
      if (k.indexOf(q) >= 0 || (don.vd && khoaDon(don.vd).indexOf(q) >= 0)) kq.push(k);
    }
    chonGoiY = kq.length ? 0 : -1;
    $("goi-y").innerHTML = kq.length ? kq.map(function (k, i) {
      const don = duLieu.donTheoKhoa.get(k);
      const vt = k.indexOf(q);
      const maHien = vt >= 0 ? esc(k.slice(0, vt)) + "<mark>" + esc(k.slice(vt, vt + q.length)) + "</mark>" + esc(k.slice(vt + q.length)) : esc(k);
      return '<li data-khoa="' + esc(k) + '" aria-selected="' + (i === 0) + '"><b>' + maHien + "</b><small>" + don.hang.length + " mã · " + hienLuc(don.luc) + "</small></li>";
    }).join("") : '<li><small>Không có đơn nào chứa "' + esc(q) + '"</small></li>';
    $("goi-y").hidden = false;
  }

  function hienLuc(iso) {
    const d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  $("o-tim").addEventListener("input", function () { xuLyNhap(false); });
  $("o-tim").addEventListener("keydown", function (e) {
    const li = Array.prototype.slice.call($("goi-y").querySelectorAll("li[data-khoa]"));
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && li.length) {
      e.preventDefault();
      chonGoiY = (chonGoiY + (e.key === "ArrowDown" ? 1 : -1) + li.length) % li.length;
      li.forEach(function (x, i) { x.setAttribute("aria-selected", i === chonGoiY); });
    } else if (e.key === "Enter") {
      e.preventDefault();
      xuLyNhap(true);
    }
  });
  $("goi-y").addEventListener("click", function (e) {
    const li = e.target.closest("li[data-khoa]");
    if (li) moDon(li.dataset.khoa);
  });

  // ── SỐ ĐO ──
  // "" → null; số > 0, tối đa 1 chữ số thập phân ("10", "10,5", "10.5") → Number; sai → NaN
  function docSo(v) {
    const s = chuoi(v).replace(",", ".");
    if (s === "") return null;
    if (!/^\d+(\.\d)?$/.test(s)) return NaN;
    const n = Number(s);
    return n > 0 ? n : NaN;
  }
  const hienSo = function (n) { return n == null ? "" : String(n).replace(".", ","); };

  // ── MỞ ĐƠN ──
  function moDon(khoa) {
    const don = duLieu.donTheoKhoa.get(khoa);
    if (!don) return;
    if (donMo && coThayDoi() && !dangNop) {
      if (!window.confirm("Đơn đang mở có mã đã sửa nhưng chưa nộp. Bỏ các sửa đó để mở đơn khác?")) return;
    }
    donMo = don;
    maGui = "";
    $("goi-y").hidden = true;
    baoLoiTim("");
    $("o-tim").value = don.ma;
    $("ket-qua").hidden = true;
    $("tt-don").innerHTML = "<span>Đơn <b>" + esc(don.ma) + "</b></span>" + (don.vd ? "<span>Vận đơn " + esc(don.vd) + "</span>" : "") +
      "<span>In lúc " + hienLuc(don.luc) + "</span><span>" + don.hang.length + " mã</span>";
    const tuyChon = function (chon) {
      const ds = duLieu.dsThung.slice();
      if (chon && ds.indexOf(chon) < 0) ds.push(chon); // thùng lạ đang có trong sheet → vẫn hiện để giữ nguyên
      return '<option value="">— Chưa có thùng —</option>' + ds.map(function (t) {
        return "<option" + (t === chon ? " selected" : "") + ">" + esc(t) + "</option>";
      }).join("");
    };
    $("ds-hang").innerHTML = don.hang.map(function (h, i) {
      const kt = duLieu.ktTheoMa.get(h.sku);
      const cu = kt || { ten: "", d: "", r: "", c: "", kl: "", thung: "" };
      const ktCu = cu.d && cu.r && cu.c ? cu.d + "×" + cu.r + "×" + cu.c + " cm" : "";
      return '<div class="mon" data-i="' + i + '">' +
        '<div class="mon-dau"><span class="mon-ma">' + esc(h.sku) + '</span><span class="mon-sl">SL ' + esc(h.sl) + "</span></div>" +
        '<div class="mon-ten">' + (kt ? esc(cu.ten) : "<i>Mã chưa có trong sheet kích thước</i>") + "</div>" +
        '<div class="hien-tai">Đang in: ' + (cu.thung ? "Thùng <b>" + esc(cu.thung) + "</b>" : '<span class="trong">chưa có thùng</span>') + " · " +
          (ktCu ? "<b>" + esc(ktCu) + "</b>" : '<span class="trong">chưa có kích thước</span>') + " · " +
          (cu.kl ? "<b>" + esc(cu.kl) + " g</b>" : '<span class="trong">chưa có khối lượng</span>') + "</div>" +
        '<div class="o-nhap">' +
          '<label>Thùng đúng<select data-k="thung">' + tuyChon(cu.thung) + "</select></label>" +
          '<label class="rong">Dài × Rộng × Cao (cm)<span class="kt3">' +
            '<input data-k="d" inputmode="decimal" value="' + esc(cu.d) + '" aria-label="Dài (cm)"><span>×</span>' +
            '<input data-k="r" inputmode="decimal" value="' + esc(cu.r) + '" aria-label="Rộng (cm)"><span>×</span>' +
            '<input data-k="c" inputmode="decimal" value="' + esc(cu.c) + '" aria-label="Cao (cm)"></span></label>' +
          '<label>Khối lượng (gram)<input data-k="kl" inputmode="decimal" value="' + esc(cu.kl) + '" aria-label="Khối lượng (gram)"></label>' +
          '<label class="ghi-chu">Ghi chú<input data-k="gc" maxlength="200" placeholder="Ví dụ: sai kích thước, chưa đo lại được"></label>' +
        "</div>" +
        '<p class="mon-loi" hidden></p></div>';
    }).join("");
    $("khu-don").hidden = false;
    $("chan").hidden = false;
    capNhatDem();
    $("khu-don").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Đọc 1 thẻ mã hàng → { doi, loi, dong } (dong = dữ liệu gửi đi nếu có sửa)
  function docThe(the) {
    const h = donMo.hang[+the.dataset.i];
    const cu = duLieu.ktTheoMa.get(h.sku) || { ten: "", d: "", r: "", c: "", kl: "", thung: "" };
    const g = function (k) { return the.querySelector('[data-k="' + k + '"]').value; };
    const thungMoi = chuoi(g("thung"));
    const d = docSo(g("d")), r = docSo(g("r")), c = docSo(g("c")), kl = docSo(g("kl"));
    const gc = chuoi(g("gc")).replace(/[<>]/g, "");
    const loi = [];
    const soLuongTrong = [d, r, c].filter(function (x) { return x === null; }).length;
    if ([d, r, c].some(function (x) { return x !== null && (isNaN(x) || x > CM_TOI_DA); }) || (soLuongTrong > 0 && soLuongTrong < 3)) {
      loi.push("Kích thước: nhập đủ 3 số Dài, Rộng, Cao (lớn hơn 0, tối đa " + CM_TOI_DA + " cm, tối đa 1 số lẻ)");
    }
    if (kl !== null && (isNaN(kl) || kl > GRAM_TOI_DA)) loi.push("Khối lượng: số gram lớn hơn 0, tối đa " + GRAM_TOI_DA.toLocaleString("vi-VN"));
    const dCu = docSo(cu.d), rCu = docSo(cu.r), cCu = docSo(cu.c), klCu = docSo(cu.kl);
    const coKtCu = [dCu, rCu, cCu].every(function (x) { return typeof x === "number" && !isNaN(x); });
    if (coKtCu && soLuongTrong === 3) loi.push("Không xóa kích thước đang có. Sai mà chưa đo lại được thì ghi chú.");
    if (typeof klCu === "number" && !isNaN(klCu) && kl === null) loi.push("Không xóa khối lượng đang có. Sai mà chưa đo lại được thì ghi chú.");
    const ktKhac = soLuongTrong === 0 && !(coKtCu && d === dCu && r === rCu && c === cCu);
    const klKhac = typeof kl === "number" && !isNaN(kl) && kl !== klCu;
    const doi = thungMoi !== cu.thung || ktKhac || klKhac || gc !== "";
    return {
      doi: doi, loi: loi,
      dong: {
        ma_hang: h.sku, ten_hang: cu.ten,
        thung_cu: cu.thung, thung_moi: thungMoi,
        d_cu: cu.d, r_cu: cu.r, c_cu: cu.c, kl_cu: cu.kl,
        d_moi: soLuongTrong === 0 ? d : null, r_moi: soLuongTrong === 0 ? r : null, c_moi: soLuongTrong === 0 ? c : null,
        kl_moi: typeof kl === "number" && !isNaN(kl) ? kl : null,
        ghi_chu: gc,
      },
    };
  }

  function cacThe() { return Array.prototype.slice.call($("ds-hang").querySelectorAll(".mon")); }
  function coThayDoi() { return donMo ? cacThe().some(function (t) { return docThe(t).doi; }) : false; }

  function capNhatDem() {
    let soDoi = 0, soLoi = 0;
    cacThe().forEach(function (the) {
      const kq = docThe(the);
      the.classList.toggle("da-sua", kq.doi);
      the.classList.toggle("co-loi", kq.loi.length > 0);
      const p = the.querySelector(".mon-loi");
      p.hidden = !kq.loi.length;
      p.textContent = kq.loi.join(" · ");
      if (kq.doi) soDoi++;
      if (kq.loi.length) soLoi++;
    });
    $("dem-sua").textContent = soLoi ? soLoi + " mã nhập chưa đúng" : soDoi ? soDoi + " mã có sửa" : "Chưa sửa mã nào";
    $("nut-nop").disabled = dangNop || soDoi === 0 || soLoi > 0;
    $("nut-nop").textContent = dangNop ? "Đang nộp…" : soDoi ? "Nộp (" + soDoi + ")" : "Nộp";
  }

  $("ds-hang").addEventListener("input", function () { maGui = ""; capNhatDem(); });
  $("ds-hang").addEventListener("change", function () { maGui = ""; capNhatDem(); });

  function dongDon() {
    donMo = null;
    maGui = "";
    $("khu-don").hidden = true;
    $("chan").hidden = true;
    $("ds-hang").innerHTML = "";
    $("o-tim").value = "";
  }
  $("nut-huy").addEventListener("click", function () {
    if (coThayDoi() && !window.confirm("Có mã đã sửa nhưng chưa nộp. Bỏ các sửa đó?")) return;
    dongDon();
    $("o-tim").focus();
  });

  // ── NỘP ──
  function taoMaGui() {
    const ngau = window.crypto && crypto.getRandomValues ? Array.from(crypto.getRandomValues(new Uint8Array(8))).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("") : String(Math.random()).slice(2);
    return Date.now().toString(36) + "-" + ngau;
  }

  async function nop() {
    if (dangNop || !donMo) return;
    const ten = tenNguoiNop();
    if (!ten) { moHopTen(); return; }
    if (!CFG.URL_NOP) { ketQua("Chưa cài địa chỉ nộp phản hồi (người quản lý cần triển khai Apps Script). Phản hồi chưa được gửi.", true); return; }
    const ds = cacThe().map(docThe);
    if (ds.some(function (x) { return x.loi.length; })) { capNhatDem(); return; }
    const dong = ds.filter(function (x) { return x.doi; }).map(function (x) { return x.dong; });
    if (!dong.length) return;
    if (!maGui) maGui = taoMaGui();
    const duLieuGui = { hanh_dong: "nop", ma_gui: maGui, nguoi: ten, ma_don: donMo.ma, ma_van_don: donMo.vd, dong: dong };
    dangNop = true;
    capNhatDem();
    const huy = new AbortController();
    const hen = setTimeout(function () { huy.abort(); }, 45000);
    try {
      // Gửi dạng chữ thường (text/plain) → không phát sinh bước kiểm tra CORS trước
      const r = await fetch(CFG.URL_NOP, { method: "POST", body: JSON.stringify(duLieuGui), signal: huy.signal });
      if (!r.ok) throw new Error("Mã lỗi " + r.status);
      const kq = await r.json();
      if (!kq || !kq.ok) {
        console.error("[PhanHoi] Nộp không thành công:", kq);
        ketQua("Chưa nộp được: " + (kq && kq.loi ? kq.loi : "máy chủ báo lỗi") + ". Sửa lại rồi bấm Nộp.", true);
        return;
      }
      const maDon = donMo.ma, so = dong.length;
      dangNop = false;
      dongDon();
      ketQua("✓ Đã nộp " + so + " mã của đơn " + maDon + (kq.trung ? " (đã nhận từ lần bấm trước)" : "") + ". Quét đơn tiếp theo.", false);
      if (navigator.vibrate) navigator.vibrate(60);
      $("o-tim").focus();
    } catch (e) {
      console.error("[PhanHoi] Lỗi mạng khi nộp:", e);
      ketQua("Mất kết nối khi nộp — chưa chắc đã gửi được. Kiểm tra mạng rồi bấm Nộp lại (không bị ghi trùng).", true);
    } finally {
      clearTimeout(hen);
      dangNop = false;
      if (donMo) capNhatDem();
    }
  }
  $("nut-nop").addEventListener("click", nop);

  function ketQua(chu, laLoi) {
    const p = $("ket-qua");
    p.textContent = chu;
    p.className = "ket-qua" + (laLoi ? " loi" : "");
    p.hidden = false;
    p.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  window.addEventListener("beforeunload", function (e) {
    if (coThayDoi()) { e.preventDefault(); e.returnValue = ""; }
  });

  // =========================================================================
  // CAMERA QUÉT QR — Android: bộ đọc sẵn của trình duyệt (BarcodeDetector); máy khác: ZXing ở luồng riêng
  // =========================================================================
  const cam = { mo: false, luong: null, ram: null, den: false, phien: 0, boDocSan: null, worker: null, cho: {}, so: 0, canvas: document.createElement("canvas"), ctx: null, lanSai: { ma: "", lan: 0, luc: 0 } };

  async function khoiTaoBoDoc() {
    if (cam.boDocSan || cam.worker) return;
    try {
      if ("BarcodeDetector" in window) {
        const coSan = await window.BarcodeDetector.getSupportedFormats();
        if (coSan.indexOf("qr_code") >= 0) { cam.boDocSan = new window.BarcodeDetector({ formats: ["qr_code"] }); return; }
      }
    } catch (e) { /* không dùng được bộ đọc sẵn → dùng ZXing */ }
    cam.worker = new Worker("may_quet_qr_worker.js");
    cam.worker.onmessage = function (su) {
      const ham = cam.cho[su.data.id];
      delete cam.cho[su.data.id];
      if (ham) ham(su.data.text);
    };
  }

  // Chỉ đọc vùng vuông giữa khung hình (đúng khung ngắm) → nhanh, không đọc nhầm mã khác
  function docKhung() {
    const v = $("video");
    const w = v.videoWidth, h = v.videoHeight;
    if (!w || !h) return Promise.resolve("");
    const canh = Math.round(Math.min(w, h) * 0.75);
    const ra = Math.min(canh, 720);
    if (cam.canvas.width !== ra) { cam.canvas.width = ra; cam.canvas.height = ra; }
    if (!cam.ctx) cam.ctx = cam.canvas.getContext("2d", { willReadFrequently: true });
    cam.ctx.drawImage(v, (w - canh) / 2, (h - canh) / 2, canh, canh, 0, 0, ra, ra);
    if (cam.boDocSan) {
      return cam.boDocSan.detect(cam.canvas).then(function (ds) { return ds.length ? ds[0].rawValue : ""; });
    }
    const anh = cam.ctx.getImageData(0, 0, ra, ra);
    return new Promise(function (xong) {
      const id = ++cam.so;
      cam.cho[id] = xong;
      cam.worker.postMessage({ id: id, buffer: anh.data.buffer, rong: ra, cao: ra }, [anh.data.buffer]);
    });
  }

  function nhayKhung(kq) {
    const el = $("camera");
    el.setAttribute("data-kq", kq);
    clearTimeout(nhayKhung.h);
    nhayKhung.h = setTimeout(function () { el.removeAttribute("data-kq"); }, 700);
  }

  // Mã QR có sẵn kiểm tra lỗi nên 1 lần đọc là đủ; chỉ nhận khi mã đơn có trong danh sách
  function xetMa(tho) {
    const khoa = khoaDon(tho);
    if (!khoa) return;
    if (duLieu.donTheoKhoa.has(khoa)) {
      nhayKhung("tot");
      if (navigator.vibrate) navigator.vibrate(80);
      dongCamera();
      $("o-tim").value = duLieu.donTheoKhoa.get(khoa).ma;
      moDon(khoa);
      return;
    }
    const bayGio = performance.now();
    const ls = cam.lanSai;
    if (ls.ma === khoa && bayGio - ls.luc < 1500) ls.lan++; else { ls.ma = khoa; ls.lan = 1; }
    ls.luc = bayGio;
    if (ls.lan === 2) {
      nhayKhung("loi");
      $("camera-chu").textContent = duLieu.daTai
        ? "Mã \"" + tho.slice(0, 40) + "\" không có trong đơn " + (CFG.SO_NGAY_TIM_DON || 45) + " ngày gần nhất"
        : "Đang tải danh sách đơn, chờ một chút…";
    }
  }

  function vong(phien) {
    if (!cam.mo || phien !== cam.phien) return;
    docKhung().then(function (ma) { if (cam.mo && phien === cam.phien && ma) xetMa(ma); })
      .catch(function () { /* bỏ khung lỗi */ })
      .then(function () { if (cam.mo && phien === cam.phien) setTimeout(function () { requestAnimationFrame(function () { vong(phien); }); }, 60); });
  }

  function dungLuong() {
    cam.phien++;
    if (cam.luong) cam.luong.getTracks().forEach(function (t) { t.stop(); });
    cam.luong = null;
    cam.ram = null;
    cam.den = false;
    $("video").srcObject = null;
  }

  async function moLuong() {
    const luong = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } });
    if (!cam.mo) { luong.getTracks().forEach(function (t) { t.stop(); }); return; }
    cam.luong = luong;
    cam.ram = luong.getVideoTracks()[0];
    $("video").srcObject = luong;
    await $("video").play();
    const kn = cam.ram.getCapabilities ? cam.ram.getCapabilities() : {};
    $("nut-den").hidden = !kn.torch;
    $("nut-den").textContent = "🔦 Đèn";
    if (kn.focusMode && kn.focusMode.indexOf("continuous") >= 0) {
      try { await cam.ram.applyConstraints({ advanced: [{ focusMode: "continuous" }] }); } catch (e) { /* bỏ qua */ }
    }
    cam.phien++;
    vong(cam.phien);
  }

  async function moCamera() {
    $("camera-chu").textContent = "Đưa mã QR trên đơn vào giữa khung";
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      thongBao(location.protocol === "file:" ? "Camera chỉ dùng được khi mở trang qua địa chỉ https (trên mạng)." : "Trình duyệt này không mở được camera.");
      return;
    }
    cam.mo = true;
    $("camera").hidden = false;
    try {
      await khoiTaoBoDoc();
      await moLuong();
    } catch (e) {
      console.error("[PhanHoi] Không mở được camera:", e);
      cam.mo = false;
      dungLuong();
      $("camera").hidden = true;
      thongBao(location.protocol === "file:" ? "Camera chỉ dùng được khi mở trang qua địa chỉ https (trên mạng)."
        : "Không mở được camera. Hãy cho phép dùng camera trong cài đặt trình duyệt rồi thử lại.");
    }
  }

  function dongCamera() {
    cam.mo = false;
    dungLuong();
    $("camera").hidden = true;
  }

  $("nut-cam").addEventListener("click", function () { this.blur(); if (cam.mo) dongCamera(); else moCamera(); });
  $("nut-dong-cam").addEventListener("click", dongCamera);
  $("nut-den").addEventListener("click", function () {
    if (!cam.ram) return;
    const moi = !cam.den;
    cam.ram.applyConstraints({ advanced: [{ torch: moi }] }).then(function () {
      cam.den = moi;
      $("nut-den").textContent = moi ? "🔦 Tắt đèn" : "🔦 Đèn";
    }).catch(function () { /* máy không hỗ trợ */ });
  });
  // Rời app thì tắt camera (tiết kiệm pin), quay lại thì mở lại
  document.addEventListener("visibilitychange", function () {
    if (!cam.mo) return;
    if (document.visibilityState === "hidden") dungLuong();
    else moLuong().catch(function () { dongCamera(); });
  });

  // ── KHỞI ĐỘNG ──
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    navigator.serviceWorker.register("sw.js").catch(function (e) { console.warn("[PhanHoi] Không đăng ký được bộ nhớ app:", e); });
  }
  veTen();
  if (!docTen()) moHopTen();
  taiDuLieu();
})();
