// =========================================================================
// DỮ LIỆU KÍCH THƯỚC GÓI HÀNG & THÙNG — ZinZinMotor
// Đọc 2 sheet trong bảng tính chính (chỉ ĐỌC, cùng khóa API với trang Vận Hành):
//   - KICH_THUOC_KIEN_HANG: mỗi mã hàng → kích thước chuẩn (Dài × Rộng × Cao) + tên thùng
//   - TONG_HOP_SIZE_THUNG : danh sách thùng; thùng ở dòng DƯỚI là thùng LỚN HƠN (quy ước chủ dự án);
//                           cột KT1, KT2, KT3 = kích thước thùng (in cạnh tên: "Thùng: [N3 20×10×10]")
// Tìm cột theo TÊN TIÊU ĐỀ (chèn / đổi chỗ cột trong sheet vẫn đúng), không theo chữ cái cột.
// Tra mã hàng: KHỚP CHÍNH XÁC cột "Mã hàng" (chỉ bỏ khoảng trắng đầu / cuối).
//
// AN TOÀN: file này chỉ cung cấp dữ liệu cho mẫu in tùy chỉnh (script_mau_in.js).
// Lỗi / chưa tải xong / thiếu file → mẫu in để trống phần kích thước & thùng, việc in vẫn bình thường.
// Dùng mẫu lưu tạm trên máy ngay khi mở trang, rồi đọc sheet để cập nhật.
// =========================================================================

(function () {
  const CAU_HINH = {
    SPREADSHEET_ID: "1Ro4FLShWGRQHilJ7m4RSmsfTp65QXpvJNfAjVjCLvrc",
    API_KEY: "AIzaSyANYGSIIawi6NyiSlWoWNVRJvUh1K_rqqw",
    SHEET_KICH_THUOC: "KICH_THUOC_KIEN_HANG",
    SHEET_THUNG: "TONG_HOP_SIZE_THUNG",
    SO_DONG_TIM_TIEU_DE: 10, // tiêu đề nằm trong 10 dòng đầu (hiện tại: dòng 2)
    THOI_GIAN_CHO: 15000, // ms
  };
  // Tên tiêu đề cột cần tìm (so sánh không phân biệt hoa thường, gộp khoảng trắng thừa)
  const TIEU_DE = {
    MA: "mã hàng",
    DAI: "kt1 d (chuẩn)",
    RONG: "kt2 r (chuẩn)",
    CAO: "kt3 c (chuẩn)",
    THUNG: "tên thùng",
  };
  const KHOA_BO_NHO_TAM = "zzm_kich_thuoc_tam";
  const TEN_SU_KIEN = "kichthuoc:capnhat"; // báo cho trang khác biết dữ liệu vừa có / vừa đổi

  // theoMa: { "mã hàng": [tênThùng, "D×R×C"] } — chỉ giữ mã có ít nhất 1 thông tin
  // thuTuThung: { "N1": 2, ... } — số càng lớn = thùng càng lớn
  // kichThuocThung: { "N3": "20×10×10" } — chỉ thùng có đủ 3 số đo
  let duLieu = { theoMa: {}, thuTuThung: {}, kichThuocThung: {} };
  // Để kiểm tra nhanh trong Console: gõ KichThuoc.trangThai
  const trangThai = { nguon: "chua_co", soMa: 0, soThung: 0, loi: [], luc: null };

  const chuanTieuDe = function (v) {
    return String(v == null ? "" : v).normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
  };
  const chuoi = function (v) {
    return v == null ? "" : String(v).trim();
  };
  // Số đo hợp lệ: số > 0 (chấp nhận "10", "10,5", "10.5"); giữ nguyên cách viết trong sheet để in
  const soDo = function (v) {
    const s = chuoi(v);
    const n = Number(s.replace(",", "."));
    return s !== "" && isFinite(n) && n > 0 ? s : "";
  };

  function timCot(dongTieuDe, ten) {
    for (let i = 0; i < dongTieuDe.length; i++) if (chuanTieuDe(dongTieuDe[i]) === ten) return i;
    return -1;
  }

  // Bảng giá trị 2 sheet → dữ liệu tra cứu. Sai cấu trúc → ném lỗi (giữ dữ liệu cũ)
  function phanTich(bangKichThuoc, bangThung) {
    // ── Thứ tự thùng ──
    const tdThung = (bangThung || [])[0] || [];
    const cotTenThung = timCot(tdThung, TIEU_DE.THUNG);
    if (cotTenThung < 0) throw new Error("Sheet " + CAU_HINH.SHEET_THUNG + " không có cột tiêu đề 'TÊN THÙNG' ở dòng 1");
    const thuTuThung = {};
    let soThung = 0;
    bangThung.slice(1).forEach(function (dong) {
      const ten = chuoi(dong[cotTenThung]);
      if (ten && !Object.prototype.hasOwnProperty.call(thuTuThung, ten)) thuTuThung[ten] = ++soThung;
    });
    // Kích thước từng thùng (cột KT1, KT2, KT3 ở dòng 1). Thiếu cột / thiếu số → bỏ qua, vẫn in tên thùng như cũ
    const cotKt = [timCot(tdThung, "kt1"), timCot(tdThung, "kt2"), timCot(tdThung, "kt3")];
    const kichThuocThung = {};
    if (cotKt.every(function (c) { return c >= 0; })) {
      bangThung.slice(1).forEach(function (dong) {
        const ten = chuoi(dong[cotTenThung]);
        const a = soDo(dong[cotKt[0]]), b = soDo(dong[cotKt[1]]), c = soDo(dong[cotKt[2]]);
        if (ten && a && b && c && !Object.prototype.hasOwnProperty.call(kichThuocThung, ten)) kichThuocThung[ten] = a + "×" + b + "×" + c;
      });
    } else {
      console.warn("[KichThuoc] Sheet " + CAU_HINH.SHEET_THUNG + " thiếu cột KT1 / KT2 / KT3 → dòng Thùng chỉ in tên thùng");
    }

    // ── Kích thước theo mã ──
    let dongTd = -1;
    for (let i = 0; i < Math.min(CAU_HINH.SO_DONG_TIM_TIEU_DE, bangKichThuoc.length); i++) {
      if (timCot(bangKichThuoc[i] || [], TIEU_DE.MA) >= 0) { dongTd = i; break; }
    }
    if (dongTd < 0) throw new Error("Sheet " + CAU_HINH.SHEET_KICH_THUOC + " không có cột tiêu đề 'Mã hàng'");
    const td = bangKichThuoc[dongTd];
    const cot = {};
    Object.keys(TIEU_DE).forEach(function (k) {
      cot[k] = timCot(td, TIEU_DE[k]);
    });
    const thieu = Object.keys(cot).filter(function (k) { return cot[k] < 0; });
    if (thieu.length) {
      throw new Error("Sheet " + CAU_HINH.SHEET_KICH_THUOC + " thiếu cột tiêu đề: " +
        thieu.map(function (k) { return "'" + TIEU_DE[k] + "'"; }).join(", "));
    }
    const theoMa = {};
    let soMa = 0, soTrung = 0;
    for (let i = dongTd + 1; i < bangKichThuoc.length; i++) {
      const d = bangKichThuoc[i] || [];
      const ma = chuoi(d[cot.MA]);
      if (!ma) continue;
      if (Object.prototype.hasOwnProperty.call(theoMa, ma)) { soTrung++; continue; } // trùng mã → giữ dòng đầu tiên
      const dai = soDo(d[cot.DAI]), rong = soDo(d[cot.RONG]), cao = soDo(d[cot.CAO]);
      const kichThuoc = dai && rong && cao ? dai + "×" + rong + "×" + cao : "";
      const thung = chuoi(d[cot.THUNG]);
      if (thung || kichThuoc) { theoMa[ma] = [thung, kichThuoc]; soMa++; }
      else theoMa[ma] = null; // có mã nhưng chưa có dữ liệu → đánh dấu để vẫn tính trùng đúng
    }
    Object.keys(theoMa).forEach(function (k) { if (theoMa[k] === null) delete theoMa[k]; });
    if (soTrung) console.warn("[KichThuoc] Sheet " + CAU_HINH.SHEET_KICH_THUOC + " có " + soTrung + " dòng trùng mã hàng — dùng dòng đầu tiên");
    return { theoMa: theoMa, thuTuThung: thuTuThung, kichThuocThung: kichThuocThung, soMa: soMa, soThung: soThung };
  }

  function apDung(d, nguon) {
    duLieu = { theoMa: d.theoMa, thuTuThung: d.thuTuThung, kichThuocThung: d.kichThuocThung || {} };
    trangThai.nguon = nguon;
    trangThai.soMa = Object.keys(d.theoMa).length;
    trangThai.soThung = Object.keys(d.thuTuThung).length;
    trangThai.luc = new Date().toISOString();
    try {
      window.dispatchEvent(new Event(TEN_SU_KIEN));
    } catch (e) {
      // trình duyệt quá cũ → bỏ qua, không ảnh hưởng in
    }
  }

  // Dữ liệu lưu tạm phải đúng dạng mới dùng (tránh dữ liệu hỏng làm lỗi khi vẽ đơn)
  function hopLe(d) {
    if (!d || typeof d.theoMa !== "object" || typeof d.thuTuThung !== "object" || !d.theoMa || !d.thuTuThung) return false;
    for (const k in d.theoMa) {
      const v = d.theoMa[k];
      if (!Array.isArray(v) || v.length !== 2 || typeof v[0] !== "string" || typeof v[1] !== "string") return false;
    }
    for (const k in d.thuTuThung) if (typeof d.thuTuThung[k] !== "number") return false;
    // kichThuocThung: bản lưu tạm đời cũ không có → vẫn dùng được (in tên thùng, đọc sheet xong có kích thước)
    if (d.kichThuocThung !== undefined) {
      if (!d.kichThuocThung || typeof d.kichThuocThung !== "object") return false;
      for (const k in d.kichThuocThung) if (typeof d.kichThuocThung[k] !== "string") return false;
    }
    return true;
  }

  function docBoNhoTam() {
    try {
      const d = JSON.parse(localStorage.getItem(KHOA_BO_NHO_TAM));
      return hopLe(d) ? d : null;
    } catch (e) {
      return null;
    }
  }

  function ghiBoNhoTam(d) {
    try {
      localStorage.setItem(KHOA_BO_NHO_TAM, JSON.stringify({ theoMa: d.theoMa, thuTuThung: d.thuTuThung, kichThuocThung: d.kichThuocThung || {} }));
    } catch (e) {
      // bộ nhớ máy đầy / bị chặn → lần sau mở trang phải chờ đọc sheet, không ảnh hưởng in
    }
  }

  async function taiTuSheet() {
    const url = "https://sheets.googleapis.com/v4/spreadsheets/" + CAU_HINH.SPREADSHEET_ID + "/values:batchGet?ranges=" +
      encodeURIComponent(CAU_HINH.SHEET_KICH_THUOC) + "&ranges=" + encodeURIComponent(CAU_HINH.SHEET_THUNG) +
      "&valueRenderOption=FORMATTED_VALUE&key=" + CAU_HINH.API_KEY;
    const huy = typeof AbortController === "function" ? new AbortController() : null;
    const henGio = setTimeout(function () { if (huy) huy.abort(); }, CAU_HINH.THOI_GIAN_CHO);
    try {
      const resp = await fetch(url, huy ? { signal: huy.signal } : undefined);
      if (!resp.ok) throw new Error("Mã lỗi " + resp.status);
      const kq = await resp.json();
      const vung = kq.valueRanges || [];
      const d = phanTich((vung[0] && vung[0].values) || [], (vung[1] && vung[1].values) || []);
      trangThai.loi = [];
      apDung(d, "sheet");
      ghiBoNhoTam(d);
    } catch (e) {
      trangThai.loi = [e.message];
      console.warn("[KichThuoc] Không đọc được dữ liệu kích thước (" + e.message + ") → dùng " +
        (trangThai.nguon === "bo_nho_tam" ? "dữ liệu lưu tạm trên máy" : "dữ liệu trống (mẫu in để trống phần kích thước)"));
    } finally {
      clearTimeout(henGio);
    }
  }

  // ── TRA CỨU (mẫu in gọi) ──
  // { thung, kichThuoc } của 1 mã — không có dữ liệu → null
  function traMa(sku) {
    const v = duLieu.theoMa[chuoi(sku)];
    return v ? { thung: v[0], kichThuoc: v[1] } : null;
  }

  // Nội dung cột KTGH: có thùng → tên thùng; chưa có thùng → kích thước; không có → ""
  function noiDungKtgh(sku) {
    const v = traMa(sku);
    if (!v) return "";
    return v.thung || v.kichThuoc;
  }

  // Thùng lớn nhất của 1 đơn (theo thứ tự dòng sheet TONG_HOP_SIZE_THUNG). Tên thùng không có
  // trong danh sách → không tính. Không mã nào có thùng → ""
  function thungLonNhat(dsSku) {
    let tot = "", hang = 0;
    (dsSku || []).forEach(function (sku) {
      const v = traMa(sku);
      if (!v || !v.thung) return;
      const h = duLieu.thuTuThung[v.thung] || 0;
      if (h > hang) { hang = h; tot = v.thung; }
    });
    return tot;
  }

  // Kích thước của 1 thùng (KT1×KT2×KT3 theo sheet TONG_HOP_SIZE_THUNG, đúng thứ tự trong sheet). Không có → ""
  function kichThuocThung(ten) {
    const v = duLieu.kichThuocThung[chuoi(ten)];
    return typeof v === "string" ? v : "";
  }

  // ── KHỞI ĐỘNG ──
  const tam = docBoNhoTam();
  if (tam) apDung(tam, "bo_nho_tam");
  taiTuSheet();

  window.KichThuoc = {
    traMa: traMa,
    noiDungKtgh: noiDungKtgh,
    thungLonNhat: thungLonNhat,
    kichThuocThung: kichThuocThung,
    trangThai: trangThai,
    TEN_SU_KIEN: TEN_SU_KIEN,
    phanTich: phanTich, // dùng khi kiểm thử
  };
})();
