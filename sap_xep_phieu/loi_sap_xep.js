// =========================================================================
// LÕI SẮP XẾP PHIẾU ĐÓNG GÓI — dùng CHUNG cho trang sap_xep_phieu/ và ô trong tab Xem Đơn Hàng (trang Vận Hành)
// → 2 nơi luôn cùng 1 thuật toán. Không đụng giao diện, không đọc/ghi sheet.
// NGUYÊN TẮC BẤT BIẾN: chỉ đổi THỨ TỰ trang; mỗi trang chép NGUYÊN VẸN (pdf-lib copyPages), không vẽ lại.
// =========================================================================
(function () {
  "use strict";
  if (window.SapXepPhieuLoi) return;
  const URL_PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  const URL_PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const URL_PDFLIB = "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js";
  const khoaDon = function (v) { return (v == null ? "" : String(v)).trim().replace(/\s+/g, "").toUpperCase(); };

  // Nạp thư viện khi cần (trang Vận Hành không phải tải sẵn 1,9 MB lúc mở)
  function napScript(url) {
    return new Promise(function (xong, loi) {
      const s = document.createElement("script");
      s.src = url;
      s.onload = function () { xong(); };
      s.onerror = function () { loi(new Error("Không tải được " + url)); };
      document.head.appendChild(s);
    });
  }
  let dangNap = null;
  function taiThuVien() {
    if (window.pdfjsLib && window.PDFLib) return Promise.resolve();
    if (!dangNap) {
      dangNap = Promise.all([window.pdfjsLib ? null : napScript(URL_PDFJS), window.PDFLib ? null : napScript(URL_PDFLIB)])
        .catch(function (e) { dangNap = null; throw e; });
    }
    return dangNap;
  }

  // Ghép các mẩu chữ của pdf.js thành dòng như mắt đọc: mẩu sát nhau cùng dòng → nối liền, cách xa / khác dòng → khoảng trắng
  function ghepDong(items) {
    let s = "", truoc = null;
    items.forEach(function (it) {
      const str = it.str || "";
      if (!str) { if (it.hasEOL) { s += " "; truoc = null; } return; }
      if (truoc && it.transform && truoc.transform) {
        const cungDong = Math.abs(it.transform[5] - truoc.transform[5]) < Math.max(1, Math.abs(truoc.transform[3]) * 0.3);
        const khe = it.transform[4] - (truoc.transform[4] + (truoc.width || 0));
        s += cungDong && khe >= -1 && khe < Math.max(1, Math.abs(truoc.transform[0]) * 0.15) ? "" : " ";
      } else if (truoc) s += " ";
      s += str;
      truoc = it;
      if (it.hasEOL) { s += " "; truoc = null; }
    });
    return s;
  }

  // Dấu vân tay của trang: băm FNV-1a 2 lượt (2 hạt khác nhau) của chữ trên trang + độ dài → chuỗi ngắn. Trang không có chữ → "".
  function vanTay(chu) {
    if (!chu) return "";
    let a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995;
    for (let i = 0; i < chu.length; i++) {
      const c = chu.charCodeAt(i);
      a = Math.imul(a ^ c, 16777619) >>> 0;
      b = Math.imul(b ^ c, 2246822519) >>> 0;
    }
    return a.toString(36) + b.toString(36) + chu.length.toString(36);
  }

  // Vẽ ẢNH THU NHỎ 1 trang PDF lên canvas (rộng `rong` px trên màn hình). Mở lại file từ bytes, giữ để vẽ các trang khác.
  async function veAnh(muc, p, canvas, rong) {
    await taiThuVien();
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL_PDFJS_WORKER;
    if (!muc._pdf) muc._pdf = pdfjsLib.getDocument({ data: muc.bytes.slice() }).promise;
    const page = await (await muc._pdf).getPage(p + 1);
    const tile = Math.min(2, window.devicePixelRatio || 1);
    const goc = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: (rong * tile) / goc.width });
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    canvas.style.width = rong + "px";
    canvas.style.height = Math.round(vp.height / tile) + "px";
    await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
  }
  // Giải phóng các file đã mở để vẽ ảnh (khi chọn file PDF khác)
  function dongAnh(dsMuc) {
    (dsMuc || []).forEach(function (m) {
      if (m && m._pdf) { m._pdf.then(function (d) { d.destroy(); }).catch(function () {}); m._pdf = null; }
    });
  }

  // Đọc các file PDF → { file: [{ten, bytes, soTrang, loi}], trang: [{f, p, chu, oid, dong, vt, cum}] }
  // Đọc XONG toàn bộ mới trả về (không bao giờ có kết quả nửa chừng).
  async function docPdf(dsFile) {
    await taiThuVien();
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL_PDFJS_WORKER;
    const file = [], trang = [];
    for (let fi = 0; fi < dsFile.length; fi++) {
      const f = dsFile[fi];
      const muc = { ten: f.name, bytes: null, soTrang: 0, loi: "" };
      file.push(muc);
      try {
        muc.bytes = new Uint8Array(await f.arrayBuffer());
        const pdf = await pdfjsLib.getDocument({ data: muc.bytes.slice() }).promise; // bản sao: pdf.js chiếm bộ nhớ gốc
        muc.soTrang = pdf.numPages;
        let coChu = 0;
        for (let p = 1; p <= pdf.numPages; p++) {
          const tc = await (await pdf.getPage(p)).getTextContent();
          const chu = tc.items.map(function (it) { return it.str || ""; }).join("").replace(/\s+/g, "").toUpperCase();
          const dong = ghepDong(tc.items).toUpperCase();
          // Mã đơn in trên phiếu — CHỈ để HIỂN THỊ / Copy ở trang không khớp (KHÔNG dùng để ghép):
          // TikTok: sau chữ "Order ID"; Shopee: mã 14 ký tự (6 số ngày + 8 chữ/số, có ít nhất 1 chữ cái), lấy khi trang có ĐÚNG 1 mã như vậy
          const oid = (dong.match(/ORDER\s*ID\s*:?\s*([0-9A-Z]{8,})/) || [])[1] || maShopee(dong);
          // Mã vận đơn (Shopee SPXVN…, TikTok/GHN… VNGH…) — chỉ để hiển thị
          const vd = (dong.match(/(?<![A-Z0-9])(SPXVN\d+[A-Z]?|VN[A-Z]{2,4}\d{8,}[A-Z]?)(?![A-Z0-9])/) || [])[1] || "";
          if (chu) coChu++;
          // cum: các cụm chữ NGUYÊN VẸN trên trang (mã đơn phải trùng nguyên 1 cụm, không trùng 1 đoạn bên trong)
          // vt: "dấu vân tay" của trang (rút gọn từ toàn bộ chữ) — để sổ ĐÃ IN nhận ra trang đã in kể cả khi không đọc được mã
          trang.push({ f: fi, p: p - 1, chu: chu, oid: oid, vd: vd, dong: dong, vt: vanTay(chu), cum: new Set(dong.match(/[A-Z0-9]+(?:-[A-Z0-9]+)*/g) || []) });
        }
        if (!coChu) muc.loi = "file ảnh chụp — không đọc được chữ";
        await pdf.destroy();
      } catch (e) {
        console.error("[SapXep] Không đọc được PDF:", f.name, e);
        muc.loi = "không mở được file (hỏng hoặc có mật khẩu)";
      }
    }
    return { file: file, trang: trang };
  }

  function maShopee(dong) {
    const gap = {};
    (dong.match(/(?<![A-Z0-9-])\d{6}[0-9A-Z]{8}(?![A-Z0-9-])/g) || []).forEach(function (m) { if (/[A-Z]/.test(m)) gap[m] = 1; });
    const ds = Object.keys(gap);
    return ds.length === 1 ? ds[0] : "";
  }

  // Mã cho phép khoảng trắng chen giữa các ký tự, nhưng 2 đầu phải là RANH GIỚI (không dính chữ / số / gạch nối khác)
  // → "5872 3609 1803 7637 40" nhận được; 14 số đầu của 1 mã 18 số thì KHÔNG.
  const boNhoRegex = new Map();
  function maTachKhoang(k) {
    if (!boNhoRegex.has(k)) boNhoRegex.set(k, new RegExp("(?<![A-Z0-9-])" + k.split("").map(function (c) { return c.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&"); }).join("\\s*") + "(?![A-Z0-9-])"));
    return boNhoRegex.get(k);
  }

  // GHÉP TRANG ↔ ĐƠN — dùng chính danh sách mã đơn của lần in làm "chìa khóa", KHÔNG phụ thuộc bố cục phiếu:
  //  (1) Trang có 1 CỤM CHỮ NGUYÊN VẸN trùng đúng 1 mã đơn hợp lệ → nhận.
  //  (2) Không có → DÒ DỰ PHÒNG (mã ≥ 10 ký tự, có thể in tách khoảng, 2 đầu là ranh giới) → nhận + đánh dấu "kiểm lại".
  //  Trùng ≥ 2 mã → không nhận. Không trùng → trang KHÔNG KHỚP (19/11: bỏ hẳn việc "đoán trang nối tiếp theo đơn trang trước"
  //  vì với phiếu Shopee (không có chữ "Order ID") phiếu của đơn khác bị gán NHẦM vào đơn đứng trước — 2 nhãn 2 khách 1 đơn).
  //  maDonLa(k) = true → "mã đơn" là mã hàng / lỗi công thức → KHÔNG dùng để ghép.
  function ghep(dsMa, trang, maDonLa) {
    const la = maDonLa || function () { return false; };
    const hopLe = dsMa.filter(function (k) { return !la(k); });
    const trangCua = new Map(); dsMa.forEach(function (k) { trangCua.set(k, []); });
    const thua = [], nhieuMa = [], noiTiep = [], doChu = [];
    trang.forEach(function (t, i) {
      let gap = hopLe.filter(function (k) { return t.cum.has(k); });
      let theoDoChu = false;
      if (!gap.length && t.chu) {
        gap = hopLe.filter(function (k) { return k.length >= 10 && t.chu.indexOf(k) >= 0 && maTachKhoang(k).test(t.dong); });
        theoDoChu = gap.length === 1;
      }
      if (gap.length === 1) { trangCua.get(gap[0]).push(i); if (theoDoChu) doChu.push({ i: i, ma: gap[0] }); return; }
      if (gap.length > 1) { nhieuMa.push({ i: i, ma: gap }); return; }
      thua.push({ i: i, ma: t.oid });
    });
    const soKhop = dsMa.filter(function (k) { return trangCua.get(k).length; }).length;
    return { trangCua: trangCua, thua: thua, nhieuMa: nhieuMa, noiTiep: noiTiep, doChu: doChu, soKhop: soKhop, maLa: dsMa.filter(la) };
  }

  // Thứ tự trang mới theo thứ tự tờ đơn: [{k, so (tờ đơn số), ds (trang)}], thuTuTrang, trangLe (không khớp)
  function sapThuTu(dsMa, g, daoNguoc, themThua) {
    const thuTuDon = daoNguoc ? dsMa.slice().reverse() : dsMa.slice();
    const thuTuTrang = [], hang = [];
    thuTuDon.forEach(function (k) {
      const ds = g.trangCua.get(k);
      ds.forEach(function (i) { thuTuTrang.push(i); });
      hang.push({ k: k, so: dsMa.indexOf(k) + 1, ds: ds });
    });
    const trangLe = g.thua.map(function (x) { return x.i; }).concat(g.nhieuMa.map(function (x) { return x.i; })).sort(function (a, b) { return a - b; });
    if (themThua) trangLe.forEach(function (i) { thuTuTrang.push(i); });
    return { thuTuTrang: thuTuTrang, hang: hang, trangLe: trangLe };
  }

  // Tạo PDF mới: chép NGUYÊN từng trang theo thuTuTrang → Uint8Array
  async function taoPdf(file, trang, thuTuTrang) {
    await taiThuVien();
    const moi = await PDFLib.PDFDocument.create();
    const banSao = new Map();
    for (let fi = 0; fi < file.length; fi++) {
      if (!file[fi].bytes || file[fi].loi) continue;
      const can = thuTuTrang.filter(function (i) { return trang[i].f === fi; });
      if (!can.length) continue;
      const nguon = await PDFLib.PDFDocument.load(file[fi].bytes, { ignoreEncryption: true, parseSpeed: Infinity }); // đọc liền một mạch (như save bên dưới)
      const chi = Array.from(new Set(can.map(function (i) { return trang[i].p; })));
      const ban = await moi.copyPages(nguon, chi);
      chi.forEach(function (p, j) { banSao.set(fi + ":" + p, ban[j]); });
    }
    thuTuTrang.forEach(function (i) { // mỗi trang gốc chỉ có mặt 1 lần trong thứ tự mới
      const tr = banSao.get(trang[i].f + ":" + trang[i].p);
      if (tr) moi.addPage(tr);
    });
    // objectsPerTick: Infinity → ghi liền một mạch, KHÔNG nghỉ giữa chừng (trang nằm sau tab PDF mới bị Chrome làm chậm
    // các nhịp nghỉ → 72 trang mất ~33 giây). Chỉ ảnh hưởng tốc độ, nội dung file không đổi.
    return { bytes: await moi.save({ objectsPerTick: Infinity }), soTrang: moi.getPageCount() };
  }

  // Nhãn trang: [3,4,5,9] → "4–6, 10" (thêm "F2-" khi nhiều file)
  function dsTrang(ds, trang, nhieuFile) {
    const nhan = function (i) { const t = trang[i]; return (nhieuFile ? "F" + (t.f + 1) + "-" : "") + (t.p + 1); };
    const doan = []; let bd = null, tr = null;
    ds.forEach(function (i) {
      if (bd !== null && i === tr + 1 && trang[i].f === trang[tr].f) { tr = i; return; }
      if (bd !== null) doan.push(bd === tr ? nhan(bd) : nhan(bd) + "–" + nhan(tr));
      bd = tr = i;
    });
    if (bd !== null) doan.push(bd === tr ? nhan(bd) : nhan(bd) + "–" + nhan(tr));
    return doan.join(", ");
  }

  window.SapXepPhieuLoi = { khoaDon: khoaDon, taiThuVien: taiThuVien, ghepDong: ghepDong, docPdf: docPdf, ghep: ghep, sapThuTu: sapThuTu, taoPdf: taoPdf, dsTrang: dsTrang,
    vanTay: vanTay, veAnh: veAnh, dongAnh: dongAnh };
})();
