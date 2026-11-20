// =========================================================================
// SỔ "ĐÃ IN" — ghi nhớ mã đơn nào đã in TỜ ĐƠN LẤY HÀNG / PHIẾU ĐÓNG GÓI lúc mấy giờ, ở VỊ TRÍ thứ mấy trong xấp,
// để KHÔNG BAO GIỜ in trùng và in bên còn lại ĐÚNG THỨ TỰ xấp đã in.
// Lưu trong bộ nhớ của trình duyệt trên CHÍNH MÁY TÍNH ĐÓ (localStorage) → F5 / đóng mở trang / tắt máy vẫn còn.
// Tự xóa mục quá 7 ngày. Không gửi đi đâu, không dùng Google Sheet.
// Lưu ý: mỗi trình duyệt + mỗi địa chỉ trang (file:/// hay web) là 1 sổ riêng.
// Cấu trúc: { d: {MÃ: giờ in tờ đơn}, di: {MÃ: vị trí trong xấp tờ đơn},
//             p: {MÃ: giờ in phiếu},  pi: {MÃ: vị trí trong xấp phiếu},
//             v: {VÂN_TAY_TRANG: giờ in},
//             r: {MÃ: {d: [giờ in lại tờ đơn…], p: [giờ in lại phiếu…]}} }  ← 19/11 tối: sổ IN LẠI (không đụng giờ / vị trí lần đầu)
// Thứ tự 1 xấp = (giờ in, vị trí) → bên còn lại in theo đúng thứ tự đó, kể cả khi đã F5 / Tạo mẫu in lại khác thứ tự.
// 19/11 chiều: bỏ "lượt in" (cacLuot) — sổ đời trước tự chuyển sang (vị trí lấy từ thứ tự của lượt).
// =========================================================================
(function () {
  "use strict";
  if (window.SoDaIn) return;
  const KHOA = "ssp_so_da_in_v1";
  const HAN_MS = 7 * 24 * 60 * 60 * 1000;
  let bo = null;        // bản trong bộ nhớ
  let luuDuoc = true;   // false = trình duyệt không cho lưu (chế độ ẩn danh chặn, đầy bộ nhớ…) → chỉ nhớ tới khi đóng trang

  function doc() {
    if (bo) return bo;
    let tho = null;
    try { tho = JSON.parse(localStorage.getItem(KHOA) || "null"); } catch (e) { tho = null; }
    bo = tho && typeof tho === "object" ? tho : {};
    ["d", "di", "p", "pi", "v", "r"].forEach(function (k) { if (!bo[k] || typeof bo[k] !== "object") bo[k] = {}; });
    // Sổ đời trước: lượt in (1 lượt "luot" hoặc nhiều lượt "cacLuot") → lấy VỊ TRÍ của từng mã theo thứ tự lượt
    const cu = [].concat(Array.isArray(bo.cacLuot) ? bo.cacLuot : [], bo.luot ? [bo.luot] : []);
    cu.forEach(function (l) {
      if (!l || !Array.isArray(l.ds)) return;
      l.ds.forEach(function (m, i) {
        if (l.don && bo.d[m] && bo.di[m] == null) bo.di[m] = i;
        if (l.phieu && bo.p[m] && bo.pi[m] == null) bo.pi[m] = i;
      });
    });
    delete bo.cacLuot; delete bo.luot;
    const han = Date.now() - HAN_MS;
    ["d", "p", "v"].forEach(function (k) {
      Object.keys(bo[k]).forEach(function (m) { if (!(bo[k][m] > han)) delete bo[k][m]; });
    });
    Object.keys(bo.r).forEach(function (m) {
      const x = bo.r[m];
      if (!x || typeof x !== "object") { delete bo.r[m]; return; }
      ["d", "p"].forEach(function (b) { x[b] = (Array.isArray(x[b]) ? x[b] : []).filter(function (t) { return t > han; }); if (!x[b].length) delete x[b]; });
      if (!x.d && !x.p) delete bo.r[m];
    });
    Object.keys(bo.di).forEach(function (m) { if (!bo.d[m]) delete bo.di[m]; });
    Object.keys(bo.pi).forEach(function (m) { if (!bo.p[m]) delete bo.pi[m]; });
    return bo;
  }
  function ghi() {
    try { localStorage.setItem(KHOA, JSON.stringify(bo)); luuDuoc = true; }
    catch (e) { luuDuoc = false; console.error("[SoDaIn] Không lưu được sổ đã in vào máy:", e); }
  }
  const ds = function (a) { return Array.prototype.filter.call(a || [], function (x) { return !!x; }); };

  window.SoDaIn = {
    lamMoi: function () { bo = null; doc(); },                    // đọc lại từ máy (tab khác vừa ghi)
    don: function (ma) { return doc().d[ma] || 0; },               // giờ in tờ đơn (0 = chưa in)
    phieu: function (ma) { return doc().p[ma] || 0; },             // giờ in phiếu (0 = chưa in)
    viTriDon: function (ma) { return doc().di[ma] || 0; },         // vị trí trong xấp tờ đơn đã in
    viTriPhieu: function (ma) { return doc().pi[ma] || 0; },       // vị trí trong xấp phiếu đã in
    vanTay: function (vt) { return vt ? doc().v[vt] || 0 : 0; },   // giờ in trang có vân tay này
    inLaiDon: function (ma) { const x = doc().r[ma]; return x && x.d ? x.d.slice() : []; },     // các giờ in lại tờ đơn
    inLaiPhieu: function (ma) { const x = doc().r[ma]; return x && x.p ? x.p.slice() : []; },   // các giờ in lại phiếu
    // Ghi 1 lần in lại cho các mã (ben "d" = tờ đơn, "p" = phiếu). KHÔNG đổi giờ / vị trí lần in đầu.
    ghiInLai: function (dsMa, ben) {
      if (ben !== "d" && ben !== "p") return;
      const b = doc(), t = Date.now();
      ds(dsMa).forEach(function (m) { const x = b.r[m] || (b.r[m] = {}); (x[ben] || (x[ben] = [])).push(t); });
      ghi();
    },
    cacMa: function () { const b = doc(); return Object.keys(b.d).concat(Object.keys(b.p)); },
    soMuc: function () { const b = doc(); return Object.keys(b.d).length + Object.keys(b.p).length + Object.keys(b.v).length; },
    // Mã đã in tờ đơn nhưng CHƯA in phiếu — theo đúng thứ tự xấp tờ đơn (cho trường hợp chưa có tờ đơn trên màn hình)
    choPhieu: function () {
      const b = doc();
      return Object.keys(b.d).filter(function (m) { return !b.p[m]; })
        .sort(function (x, y) { return (b.d[x] - b.d[y]) || ((b.di[x] || 0) - (b.di[y] || 0)); });
    },
    // dsMa ĐÚNG THỨ TỰ xấp vừa in → nhớ cả vị trí. Mã đã có trong sổ (in lại) thì GIỮ giờ + vị trí cũ.
    ghiDon: function (dsMa) {
      const b = doc(), t = Date.now();
      ds(dsMa).forEach(function (m, i) { if (!b.d[m]) { b.d[m] = t; b.di[m] = i; } });
      ghi();
    },
    ghiPhieu: function (dsMa, dsVanTay) {
      const b = doc(), t = Date.now();
      ds(dsMa).forEach(function (m, i) { if (!b.p[m]) { b.p[m] = t; b.pi[m] = i; } });
      ds(dsVanTay).forEach(function (v) { if (!b.v[v]) b.v[v] = t; });
      ghi();
    },
    // Xóa TOÀN BỘ sổ trên máy này (nút "Xóa sổ đã in")
    xoaHet: function () {
      try { localStorage.removeItem(KHOA); } catch (e) { console.error("[SoDaIn] Không xóa được sổ:", e); }
      bo = null; doc();
    },
    luuDuoc: function () { doc(); return luuDuoc; },
  };
  // Tab khác (cùng máy) vừa ghi sổ → đọc lại
  window.addEventListener("storage", function (e) { if (e.key === KHOA) bo = null; });
})();
