// =========================================================================
// SẮP XẾP TỜ ĐƠN LẤY HÀNG (ZinZinMotor) — file riêng, gắn vào trang Vận Hành
// - Đọc bảng điều khiển: tab SAP_XEP_DON (Google Sheet, CHỈ ĐỌC bằng khóa API) khi mở trang / F5.
// - script.js gọi window.SapXepDon.sapXep(donHangGrouped, thuTuCu) trong nút "TẠO MẪU IN ĐƠN"
//   → trả về MẢNG MÃ ĐƠN theo thứ tự mới (dùng cho CẢ vòng vẽ tờ đơn + vòng ghi LOG).
// - LƯỚI BẢO HIỂM: công tắc khẩn cấp BAT_SAP_XEP tắt / chưa có bảng / bảng lỗi / lỗi bất kỳ
//   → trả về ĐÚNG THỨ TỰ CŨ (như chưa có tính năng). Không bao giờ làm đứng nút Tạo mẫu in.
// - Mất mạng → dùng cài đặt đọc được LẦN TRƯỚC (lưu trên máy); máy chưa từng đọc → thứ tự cũ.
// - KHÔNG đổi thứ tự MÓN trong tờ đơn (script.js tự sắp A→Z như cũ) — SAP_MON_TRONG_DON để sau.
// Chi tiết thiết kế: GHI_CHEP_TIEN_TRINH.md mục 18.
// =========================================================================
(function () {
  "use strict";

  const TEN_TAB = "SAP_XEP_DON";
  const KHOA_LUU = "zzm_sap_xep_don_v1"; // cài đặt hợp lệ đọc được lần trước
  const VI_TRI_MAC_DINH_SCRIPT = "Chưa xếp vị trí"; // chữ script.js gán khi mã hàng không có vị trí

  // Danh sách chọn — PHẢI giống apps_script/sap_xep_don.gs
  const DS_CHON = {
    CAN_CU: ["mon_dau", "mon_thu_n", "mon_dau_co_vi_tri", "vi_tri_nho_nhat", "vi_tri_lon_nhat", "khu_chinh", "so_mon", "tong_so_luong", "ma_hang_dau", "hang_de_vo", "san"],
    CHIEU: ["tang", "giam"],
    CACH_SO: ["so_tu_nhien", "chu", "theo_danh_sach_uu_tien"],
    DON_KHONG_VI_TRI: ["cuoi", "dau"],
    VI_TRI_NHIEU: ["lay_phan_dau", "giu_nguyen"],
    SAP_MON_TRONG_DON: ["giu_nhu_cu", "so_tu_nhien"],
  };
  // Bộ mặc định trong code (dùng khi ô DUNG_MAC_DINH được tích) — giống MAC_DINH của Apps Script
  const MAC_DINH = {
    donKhongViTri: "cuoi",
    viTriNhieu: "lay_phan_dau",
    sapMon: "giu_nhu_cu",
    tieuChi: [{ canCu: "mon_dau_co_vi_tri", n: 0, chieu: "tang", cachSo: "so_tu_nhien" }],
    uuTien: [],
    khongViTri: ["CHƯA XẾP VỊ TRÍ"],
  };
  // Căn cứ trả về SỐ (so bằng phép trừ) — còn lại là chữ / vị trí kho (vị trí có thể "không có" = null)
  const CAN_CU_SO = { so_mon: 1, tong_so_luong: 1, hang_de_vo: 1 };

  // Trạng thái hiện tại (đọc bảng xong mới có)
  //   kieu: "dang_doc" | "tat" | "bat" | "loi" | "khong_doc_duoc"
  const trangThai = { kieu: "dang_doc", nguon: "", luc: 0, loi: [], ghiChu: [], cauHinh: null };

  // ── Tiện ích chuỗi ──
  const sach = function (v) { return v === null || v === undefined ? "" : String(v).replace(/\s+/g, " ").trim(); };
  const hoa = function (s) { return sach(s).toUpperCase(); };
  const laDung = function (v) { return v === true || hoa(v) === "TRUE"; };
  const soSanhChu = (function () {
    try { const c = new Intl.Collator("vi", { sensitivity: "base" }); return function (a, b) { return c.compare(a, b); }; }
    catch (e) { return function (a, b) { return a < b ? -1 : a > b ? 1 : 0; }; }
  })();
  // So SỐ TỰ NHIÊN: "VA-A3-9" < "VA-A3-13"; "05" = "5" (bằng nhau → giữ thứ tự dán)
  function soSanhTuNhien(a, b) {
    const ta = a.match(/\d+|\D+/g) || [], tb = b.match(/\d+|\D+/g) || [];
    for (let i = 0; i < Math.min(ta.length, tb.length); i++) {
      const x = ta[i], y = tb[i], xSo = /^\d/.test(x), ySo = /^\d/.test(y);
      let k;
      if (xSo && ySo) {
        const x2 = x.replace(/^0+(?=\d)/, ""), y2 = y.replace(/^0+(?=\d)/, "");
        k = x2.length !== y2.length ? x2.length - y2.length : (x2 < y2 ? -1 : x2 > y2 ? 1 : 0);
      } else if (xSo !== ySo) {
        k = xSo ? -1 : 1; // số đứng trước chữ
      } else {
        k = soSanhChu(x, y);
      }
      if (k) return k < 0 ? -1 : 1;
    }
    return ta.length - tb.length < 0 ? -1 : ta.length > tb.length ? 1 : 0;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ĐỌC BẢNG: values (mảng dòng từ API) → { bat, cauHinh, loi[], ghiChu[] }
  // Tìm theo CHỮ ở cột A (dời / chèn dòng không sao). Danh sách không giới hạn số dòng.
  // ─────────────────────────────────────────────────────────────────────────
  function phanTichBang(values) {
    const kq = { coBang: false, bat: false, dungMacDinh: false, cauHinh: null, loi: [], ghiChu: [] };
    if (!Array.isArray(values)) return kq;
    const dong = values.map(function (d) { return Array.isArray(d) ? d : []; });
    const viTri = {}; // nhãn cột A → chỉ số dòng (lần xuất hiện đầu)
    dong.forEach(function (d, i) { const k = hoa(d[0]); if (k && viTri[k] === undefined) viTri[k] = i; });
    if (viTri.BAT_SAP_XEP === undefined) return kq; // chưa có bảng điều khiển → như chưa có tính năng
    kq.coBang = true;
    kq.bat = laDung(dong[viTri.BAT_SAP_XEP][1]);
    if (!kq.bat) return kq; // công tắc khẩn cấp TẮT → không cần xét gì thêm
    kq.dungMacDinh = viTri.DUNG_MAC_DINH !== undefined && laDung(dong[viTri.DUNG_MAC_DINH][1]);
    if (kq.dungMacDinh) { kq.cauHinh = JSON.parse(JSON.stringify(MAC_DINH)); kq.ghiChu.push("đang dùng BỘ MẶC ĐỊNH (ô DUNG_MAC_DINH)"); return kq; }

    const loi = kq.loi;
    const layChon = function (nhan, ds, macDinh) {
      if (viTri[nhan] === undefined) return macDinh;
      const v = sach(dong[viTri[nhan]][1]).toLowerCase();
      if (!v) return macDinh;
      if (ds.indexOf(v) < 0) { loi.push(nhan + ' = "' + sach(dong[viTri[nhan]][1]) + '" không có trong danh sách chọn'); return macDinh; }
      return v;
    };
    const ch = {
      donKhongViTri: layChon("DON_KHONG_VI_TRI", DS_CHON.DON_KHONG_VI_TRI, MAC_DINH.donKhongViTri),
      viTriNhieu: layChon("VI_TRI_NHIEU", DS_CHON.VI_TRI_NHIEU, MAC_DINH.viTriNhieu),
      sapMon: layChon("SAP_MON_TRONG_DON", DS_CHON.SAP_MON_TRONG_DON, MAC_DINH.sapMon),
      tieuChi: [], uuTien: [], khongViTri: [],
    };
    if (ch.sapMon !== "giu_nhu_cu") kq.ghiChu.push("SAP_MON_TRONG_DON = so_tu_nhien CHƯA hỗ trợ — món trong tờ đơn vẫn xếp như cũ");

    // Tầng sắp: các dòng có cột A = 1 / 2 / 3 nằm sau dòng TIEU_CHI, trước DANH_SACH_UU_TIEN
    const iTc = viTri.TIEU_CHI;
    if (iTc === undefined) loi.push("không tìm thấy dòng TIEU_CHI");
    else {
      const het = viTri.DANH_SACH_UU_TIEN !== undefined && viTri.DANH_SACH_UU_TIEN > iTc ? viTri.DANH_SACH_UU_TIEN : dong.length;
      for (let i = iTc + 1; i < het; i++) {
        const d = dong[i], tang = sach(d[0]);
        if (!/^[123]$/.test(tang)) continue;
        const canCu = sach(d[1]).toLowerCase();
        if (!canCu) continue; // CAN_CU trống = tầng không dùng
        const ten = "Tầng " + tang;
        if (DS_CHON.CAN_CU.indexOf(canCu) < 0) { loi.push(ten + ': CAN_CU "' + sach(d[1]) + '" không có trong danh sách chọn'); continue; }
        const chieu = sach(d[3]).toLowerCase() || "tang";
        if (DS_CHON.CHIEU.indexOf(chieu) < 0) loi.push(ten + ': CHIEU "' + sach(d[3]) + '" không có trong danh sách chọn');
        const cachSo = sach(d[4]).toLowerCase() || "so_tu_nhien";
        if (DS_CHON.CACH_SO.indexOf(cachSo) < 0) loi.push(ten + ': CACH_SO "' + sach(d[4]) + '" không có trong danh sách chọn');
        let n = 0;
        if (canCu === "mon_thu_n") {
          const nChu = sach(d[2]);
          if (!/^\d+$/.test(nChu) || +nChu < 1) loi.push(ten + ": chọn mon_thu_n nhưng ô N " + (nChu ? '= "' + nChu + '" không phải số từ 1 trở lên' : "chưa ghi số"));
          else n = +nChu;
        }
        ch.tieuChi.push({ canCu: canCu, n: n, chieu: chieu, cachSo: cachSo });
      }
      if (!ch.tieuChi.length && !loi.length) loi.push("chưa có tầng sắp nào (CAN_CU của tầng 1–3 đều trống)");
    }
    // Danh sách ưu tiên: mọi dòng sau DANH_SACH_UU_TIEN tới trước COI_NHU_KHONG_VI_TRI (chỉ cột A, dòng trống bỏ qua)
    const iUt = viTri.DANH_SACH_UU_TIEN, iKvt = viTri.COI_NHU_KHONG_VI_TRI;
    if (iUt !== undefined) {
      const het = iKvt !== undefined && iKvt > iUt ? iKvt : dong.length;
      for (let i = iUt + 1; i < het; i++) { const v = hoa(dong[i][0]); if (v) ch.uuTien.push(v); }
    }
    // Coi như không có vị trí: mọi dòng sau COI_NHU_KHONG_VI_TRI tới hết bảng
    if (iKvt !== undefined) {
      for (let i = iKvt + 1; i < dong.length; i++) { const v = hoa(dong[i][0]); if (v) ch.khongViTri.push(v); }
    }
    if (ch.tieuChi.some(function (t) { return t.cachSo === "theo_danh_sach_uu_tien"; }) && !ch.uuTien.length)
      kq.ghiChu.push("chọn theo_danh_sach_uu_tien nhưng DANH_SACH_UU_TIEN trống — không ảnh hưởng");
    if (!loi.length) kq.cauHinh = ch;
    return kq;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SẮP: cauHinh + donHangGrouped + thứ tự cũ → thứ tự mới (sắp ỔN ĐỊNH: bằng nhau giữ thứ tự cũ)
  // ─────────────────────────────────────────────────────────────────────────
  function lamViTri(loc, ch) {
    let v = sach(loc);
    if (!v || v === VI_TRI_MAC_DINH_SCRIPT) return "";
    const vh = v.toUpperCase();
    if (ch.khongViTri.some(function (k) { return vh.indexOf(k) >= 0; })) return "";
    if (ch.viTriNhieu === "lay_phan_dau") v = sach(v.split(",")[0]);
    return v;
  }
  // Thứ tự món TRÊN TỜ IN — giống hệt đoạn sắp món trong script.js (A→Z tiếng Việt, trống / "Chưa xếp vị trí" xuống cuối)
  function monTheoToIn(items) {
    return items.map(function (it, i) { return { it: it, i: i }; }).sort(function (a, b) {
      const vA = a.it.loc === VI_TRI_MAC_DINH_SCRIPT || a.it.loc === "" ? "" : a.it.loc;
      const vB = b.it.loc === VI_TRI_MAC_DINH_SCRIPT || b.it.loc === "" ? "" : b.it.loc;
      if (vA === "" && vB === "") return a.i - b.i;
      if (vA === "") return 1;
      if (vB === "") return -1;
      return String(vA).localeCompare(String(vB), "vi") || a.i - b.i;
    }).map(function (x) { return x.it; });
  }
  function nhanSan(ma) {
    const m = sach(ma);
    if (/^\d{15,20}$/.test(m)) return "tiktok";
    if (/^\d{6}[0-9A-Z]{6,10}$/i.test(m)) return "shopee";
    return "khac";
  }
  function soSanhTheo(t, ch) {
    if (t.cachSo === "chu") return function (a, b) { return soSanhChu(hoa(a), hoa(b)); };
    if (t.cachSo === "theo_danh_sach_uu_tien") {
      const nhom = function (v) { const vh = hoa(v); for (let i = 0; i < ch.uuTien.length; i++) if (vh.indexOf(ch.uuTien[i]) === 0) return i; return ch.uuTien.length; };
      return function (a, b) { return (nhom(a) - nhom(b)) || soSanhTuNhien(hoa(a), hoa(b)); };
    }
    return function (a, b) { return soSanhTuNhien(hoa(a), hoa(b)); };
  }
  // Giá trị của 1 đơn theo 1 tầng: chuỗi / số; null = "không có vị trí" (luôn xuống cuối tầng đó)
  function giaTri(t, mon, viTri, idDon, ss) {
    switch (t.canCu) {
      case "mon_dau": return viTri[0] || null;
      case "mon_thu_n": return mon.length >= t.n ? viTri[t.n - 1] || null : null;
      case "mon_dau_co_vi_tri": return viTri.find(function (v) { return v; }) || null;
      case "vi_tri_nho_nhat":
      case "vi_tri_lon_nhat": {
        const co = viTri.filter(function (v) { return v; });
        if (!co.length) return null;
        return co.reduce(function (x, y) { const k = ss(x, y); return t.canCu === "vi_tri_nho_nhat" ? (k <= 0 ? x : y) : (k >= 0 ? x : y); });
      }
      case "khu_chinh": { // khu = phần trước dấu "-" đầu; khu nhiều món nhất; hòa → khu gặp trước trên tờ in
        const dem = {}, thuTu = [];
        viTri.forEach(function (v) { if (!v) return; const k = hoa(v.split("-")[0]); if (!k) return; if (!dem[k]) { dem[k] = 0; thuTu.push(k); } dem[k]++; });
        if (!thuTu.length) return null;
        return thuTu.reduce(function (x, y) { return dem[y] > dem[x] ? y : x; });
      }
      case "so_mon": return mon.length;
      case "tong_so_luong": return mon.reduce(function (s, it) { return s + (parseInt(it.qty, 10) || 0); }, 0);
      case "ma_hang_dau": return sach(mon[0] && mon[0].sku);
      case "hang_de_vo": return mon.some(function (it) { return it.hangDeVo === true; }) ? 1 : 0;
      case "san": return nhanSan(idDon);
    }
    return null;
  }
  function sapTheoCauHinh(ch, donHangGrouped, thuTuCu) {
    const bo = ch.tieuChi.map(function (t) { return soSanhTheo(t, ch); });
    const ds = thuTuCu.map(function (idDon, i) {
      const don = donHangGrouped[idDon] || { items: [] };
      const mon = monTheoToIn(Array.isArray(don.items) ? don.items : []);
      const viTri = mon.map(function (it) { return lamViTri(it.loc, ch); });
      return {
        id: idDon, i: i,
        coViTri: viTri.some(function (v) { return v; }),
        g: ch.tieuChi.map(function (t, j) { return giaTri(t, mon, viTri, idDon, bo[j]); }),
      };
    });
    const dauNhom = ch.donKhongViTri === "dau" ? -1 : 1;
    ds.sort(function (a, b) {
      if (a.coViTri !== b.coViTri) return a.coViTri ? -dauNhom : dauNhom; // đơn không món nào có vị trí → cuối (hoặc đầu)
      for (let j = 0; j < ch.tieuChi.length; j++) {
        const t = ch.tieuChi[j], x = a.g[j], y = b.g[j];
        if (x === null && y === null) continue;
        if (x === null) return 1; // không có giá trị → cuối tầng (cả khi giảm dần)
        if (y === null) return -1;
        let k = CAN_CU_SO[t.canCu] ? x - y : bo[j](String(x), String(y));
        if (t.chieu === "giam") k = -k;
        if (k) return k;
      }
      return a.i - b.i; // bằng nhau → giữ thứ tự dán (liền kề)
    });
    return ds.map(function (x) { return x.id; });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HÀM CHO script.js — luôn trả về 1 hoán vị của thuTuCu; nghi ngờ gì → thuTuCu
  // ─────────────────────────────────────────────────────────────────────────
  function sapXep(donHangGrouped, thuTuCu) {
    const cu = Array.isArray(thuTuCu) ? thuTuCu.slice() : Object.keys(donHangGrouped || {});
    try {
      if (trangThai.kieu !== "bat" || !trangThai.cauHinh) return cu;
      const moi = sapTheoCauHinh(trangThai.cauHinh, donHangGrouped, cu);
      // Kiểm: đúng là hoán vị (đủ mã, không thừa, không trùng)
      if (moi.length !== cu.length) return cu;
      const dem = {};
      cu.forEach(function (k) { dem[k] = (dem[k] || 0) + 1; });
      for (let i = 0; i < moi.length; i++) { if (!dem[moi[i]]) return cu; dem[moi[i]]--; }
      return moi;
    } catch (e) {
      console.warn("[SapXepDon] Lỗi khi sắp — dùng thứ tự cũ:", e);
      return cu;
    }
  }

  // ── Lưu / đọc cài đặt lần trước (trên máy này) ──
  function luuBan(kq) {
    try { localStorage.setItem(KHOA_LUU, JSON.stringify({ luc: Date.now(), bat: kq.bat, cauHinh: kq.cauHinh, ghiChu: kq.ghiChu })); } catch (e) { /* bỏ qua */ }
  }
  function docBan() {
    try { const b = JSON.parse(localStorage.getItem(KHOA_LUU) || "null"); return b && typeof b.luc === "number" ? b : null; } catch (e) { return null; }
  }
  function apKetQua(kq, nguon, luc) {
    trangThai.nguon = nguon; trangThai.luc = luc; trangThai.loi = kq.loi || []; trangThai.ghiChu = kq.ghiChu || [];
    trangThai.cauHinh = null;
    if (!kq.bat) trangThai.kieu = "tat";
    else if (trangThai.loi.length || !kq.cauHinh) trangThai.kieu = "loi";
    else { trangThai.kieu = "bat"; trangThai.cauHinh = kq.cauHinh; }
  }

  // ── Nhãn trạng thái: dòng nhỏ ngay dưới hàng nút TẠO MẪU IN ĐƠN (công tắc tắt → KHÔNG hiện gì) ──
  function gio(t) { const d = new Date(t), h = function (n) { return (n < 10 ? "0" : "") + n; }; return h(d.getHours()) + ":" + h(d.getMinutes()) + " " + h(d.getDate()) + "/" + h(d.getMonth() + 1); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function veNhan() {
    if (typeof document === "undefined") return;
    const nut = document.getElementById("nut-tao-in");
    if (!nut || !nut.parentNode) return;
    let el = document.getElementById("sxd-nhan");
    if (!el) {
      if (!document.getElementById("sxd-css")) {
        const st = document.createElement("style");
        st.id = "sxd-css";
        st.textContent = "#sxd-nhan{display:table;margin:6px 0 2px;font-size:12px;font-weight:600;border-radius:6px;padding:3px 8px;line-height:1.35;max-width:100%;box-sizing:border-box;white-space:normal;overflow-wrap:anywhere;cursor:default}" +
          "#sxd-nhan[hidden]{display:none}#sxd-nhan.sxd-bat{background:#e6f4ea;color:#0d5224;border:1px solid #a8dab5}" +
          "#sxd-nhan.sxd-luu{background:#fef7e0;color:#5c4400;border:1px solid #f0b400}#sxd-nhan.sxd-loi{background:#fce8e6;color:#b3261e;border:1px solid #d93025}" +
          "@media print{#sxd-nhan{display:none!important}}";
        document.head.appendChild(st);
      }
      el = document.createElement("span");
      el.id = "sxd-nhan";
      el.hidden = true;
      // Dòng RIÊNG ngay dưới hàng nút (không chen vào hàng nút → bố cục các nút giữ nguyên)
      const hang = (nut.closest && nut.closest(".actions-bar")) || nut;
      hang.parentNode.insertBefore(el, hang.nextSibling);
    }
    const tt = trangThai;
    el.className = ""; el.hidden = true; el.removeAttribute("title");
    if (tt.kieu === "bat") {
      const ghiChu = tt.ghiChu.length ? " — " + tt.ghiChu.join("; ") : "";
      if (tt.nguon === "ban_luu") {
        el.className = "sxd-luu";
        el.innerHTML = "🔀 Sắp tờ đơn theo vị trí kho (dùng cài đặt lưu lúc " + gio(tt.luc) + " — chưa đọc được bảng mới)";
      } else {
        el.className = "sxd-bat";
        el.innerHTML = "🔀 Sắp tờ đơn theo vị trí kho";
      }
      el.title = "Thứ tự tờ đơn sắp theo bảng điều khiển trên Google Sheet" + ghiChu;
      el.hidden = false;
    } else if (tt.kieu === "loi") {
      el.className = "sxd-loi";
      el.innerHTML = "⚠ Bảng điều khiển sắp tờ đơn có lỗi → đang in THỨ TỰ CŨ: " + esc(tt.loi.join("; "));
      el.hidden = false;
    }
  }

  // ── Đọc tab SAP_XEP_DON (chỉ đọc) khi mở trang / F5 ──
  function docLai() {
    const cfg = typeof C2_CONFIG !== "undefined" ? C2_CONFIG : null; // khai báo trong script.js
    trangThai.kieu = "dang_doc"; trangThai.cauHinh = null; // ĐANG ĐỌC → thứ tự cũ (an toàn: vừa tắt công tắc khẩn cấp + F5 thì không dùng bản lưu cũ)
    if (!cfg || !cfg.SPREADSHEET_ID || !cfg.API_KEY || typeof fetch !== "function") { dungBanLuu("thiếu cấu hình đọc sheet"); return Promise.resolve(); }
    const url = "https://sheets.googleapis.com/v4/spreadsheets/" + cfg.SPREADSHEET_ID + "/values/" + encodeURIComponent(TEN_TAB + "!A1:F500") +
      "?valueRenderOption=UNFORMATTED_VALUE&key=" + cfg.API_KEY;
    const hetGio = new Promise(function (_, tuChoi) { setTimeout(function () { tuChoi(new Error("quá 10 giây")); }, 10000); });
    return Promise.race([fetch(url), hetGio])
      .then(function (r) {
        if (r.status === 400) return { values: null }; // tab chưa có → như chưa có tính năng
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (d) {
        const kq = phanTichBang(d && d.values);
        if (!kq.coBang) { apKetQua({ bat: false }, "sheet", Date.now()); console.info("[SapXepDon] Chưa có bảng điều khiển — giữ thứ tự cũ."); }
        else {
          apKetQua(kq, "sheet", Date.now());
          if (trangThai.kieu !== "loi") luuBan(kq); // chỉ lưu cài đặt HỢP LỆ (gồm cả trạng thái TẮT)
          if (trangThai.kieu === "loi") console.warn("[SapXepDon] Bảng điều khiển có lỗi — dùng thứ tự cũ:", trangThai.loi);
          else console.info("[SapXepDon] Công tắc: " + (kq.bat ? "BẬT" : "TẮT"));
        }
        veNhan();
      })
      .catch(function (e) { dungBanLuu(e && e.message); });
  }
  function dungBanLuu(lyDo) {
    const b = docBan();
    if (b) {
      apKetQua({ bat: b.bat, cauHinh: b.cauHinh, loi: [], ghiChu: b.ghiChu || [] }, "ban_luu", b.luc);
      console.warn("[SapXepDon] Không đọc được bảng điều khiển (" + lyDo + ") — dùng cài đặt lưu lúc " + gio(b.luc));
    } else {
      trangThai.kieu = "khong_doc_duoc"; trangThai.cauHinh = null;
      console.warn("[SapXepDon] Không đọc được bảng điều khiển (" + lyDo + "), máy chưa có cài đặt lưu — giữ thứ tự cũ.");
    }
    veNhan();
  }

  window.SapXepDon = {
    sapXep: sapXep,
    docLai: docLai,
    trangThai: trangThai,
    // Cho bài kiểm thử (không dùng trong trang)
    _phanTichBang: phanTichBang,
    _sapTheoCauHinh: sapTheoCauHinh,
    _soSanhTuNhien: soSanhTuNhien,
  };

  if (typeof document !== "undefined" && document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { veNhan(); docLai(); });
  else { veNhan(); docLai(); }
})();
