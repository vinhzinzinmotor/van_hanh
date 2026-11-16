// =========================================================================
// MẪU IN ĐƠN HÀNG — ZinZinMotor
// Vẽ HTML của 1 đơn theo "cấu hình mẫu in", thay cho đoạn mẫu viết cứng trong script.js
//
// AN TOÀN: script.js vẫn tự vẽ mẫu gốc như cũ, sau đó mới gọi window.MauIn.veDon(...).
// Nếu file này không nạp được, bị lỗi, hoặc trả về rỗng → script.js giữ nguyên mẫu gốc.
// Logic gom đơn / sắp vị trí kho / tính tổng / dễ vỡ / ghi log KHÔNG nằm ở đây và không đổi.
//
// GIAI ĐOẠN 1: mẫu mặc định = đúng mẫu đang dùng (kết quả giống từng ký tự).
// GIAI ĐOẠN 2: đọc mẫu từ Google Sheet MAU_IN_DON khi mở / tải lại trang.
//   - Ô BAT_MAU_TUY_CHINH chưa đánh dấu → dùng mẫu mặc định (= mẫu gốc)
//   - Sheet sai bất kỳ chỗ nào → bỏ cả mẫu sheet, dùng mẫu mặc định, ghi lỗi ra Console (F12)
//   - Mất mạng / Google lỗi → dùng mẫu đã lưu tạm trên máy từ lần trước (nếu có), không thì mẫu mặc định
// GIAI ĐOẠN 3: kiểu dáng (độ rộng, cỡ chữ, kiểu chữ, phông từng cột; khổ giấy, lề, đầu / chân đơn).
//   Mẫu tùy chỉnh tự sinh CSS riêng (thẻ <style id="mau-in-tuy-chinh">) chỉ áp vào khung có class
//   "mau-tuy-chinh", ưu tiên cao hơn các luật theo vị trí cột (nth-child) trong style.css.
//   style.css KHÔNG bị sửa. Mẫu mặc định không sinh CSS → kết quả giữ nguyên như cũ.
// GIAI ĐOẠN A (kích thước gói hàng): CHỈ mẫu tùy chỉnh — cột loại "ghi_chu" hiện KTGH (tên thùng, chưa có
//   thùng thì kích thước chuẩn), dòng "Thùng: X" (thùng lớn nhất của đơn) bên trái tổng tiền, mã QR mã đơn bên
//   trái mã đơn. Dữ liệu từ script_kich_thuoc.js, QR từ thu_vien_qr.js (2 file tự nạp bên dưới).
// GIAI ĐOẠN B: 2 cài đặt HIEN_QR, HIEN_THUNG trong sheet (bật / tắt mã QR, dòng "Thùng"). Sheet chưa có dòng
//   hoặc mẫu lưu tạm đời cũ → coi như BẬT (giống giai đoạn A). PHẢI giống apps_script/mau_in_don.gs.
// =========================================================================

(function () {
  // ── NGUỒN MẪU — cùng bảng tính & khóa với sheet MISA (C2_CONFIG trong script.js) ──
  const SHEET_CONFIG = {
    SPREADSHEET_ID: "1Ro4FLShWGRQHilJ7m4RSmsfTp65QXpvJNfAjVjCLvrc",
    API_KEY: "AIzaSyANYGSIIawi6NyiSlWoWNVRJvUh1K_rqqw",
    SHEET_NAME: "MAU_IN_DON",
    VUNG: "A1:I40",
    THOI_GIAN_CHO: 8000, // ms — quá thời gian thì bỏ, dùng mẫu đang có
  };
  const KHOA_BO_NHO_TAM = "zzm_mau_in_tam";
  const ID_THE_CSS = "mau-in-tuy-chinh";

  // ── NẠP 2 FILE PHỤ của mẫu tùy chỉnh (cùng thư mục với file này) ──
  //   thu_vien_qr.js       : thư viện vẽ mã QR mã đơn
  //   script_kich_thuoc.js : dữ liệu kích thước gói hàng & thùng (cột KTGH, dòng "Thùng:")
  // Nạp từ đây để KHÔNG phải sửa index.html. Thiếu file / nạp lỗi → mẫu in để trống phần tương ứng.
  (function napFilePhu() {
    if (typeof document === "undefined" || !document.head) return;
    const thuMuc = document.currentScript && document.currentScript.src
      ? document.currentScript.src.replace(/[^/]*$/, "")
      : "";
    ["thu_vien_qr.js", "script_kich_thuoc.js"].forEach(function (ten) {
      if (document.querySelector('script[data-mau-in-phu="' + ten + '"]')) return;
      const the = document.createElement("script");
      the.src = thuMuc + ten;
      the.async = false; // nạp đúng thứ tự
      the.setAttribute("data-mau-in-phu", ten);
      the.onerror = function () {
        console.warn("[MauIn] Không nạp được " + ten + " → mẫu in để trống phần tương ứng");
      };
      document.head.appendChild(the);
    });
  })();

  // Danh sách hợp lệ — PHẢI giống apps_script/mau_in_don.gs
  const LOAI_COT = ["so_luong", "sku", "ten", "vi_tri", "ghi_chu"];
  const CAN_LE_HOP_LE = ["trai", "giua", "phai"];
  const KHO_GIAY = ["A6", "A5", "A4"];
  const KIEU_CHU = ["dam", "thuong"];
  const PHONG = ["Arial", "Tahoma", "Verdana", "Times New Roman", "Courier New", "Consolas"];

  // Giá trị mặc định của các cài đặt chung thêm ở giai đoạn 3 (= kiểu dáng hiện tại trong style.css)
  // hienQr / hienThung (giai đoạn B): sheet chưa có dòng → coi như BẬT (giống giai đoạn A)
  const TRANG_MAC_DINH = { khoGiay: "A6", leMm: 5, coChuMaDon: 16, hienTongTien: true, chanDon: "", hienQr: true, hienThung: true };

  // ── MẪU MẶC ĐỊNH = mẫu in hiện tại trong script.js ──
  const MAU_MAC_DINH = {
    phienBan: 1,
    dauDon: {
      nhanMaVanDon: "Mã Vận Đơn:",
      nhanMaDon: "ĐƠN HÀNG:",
    },
    // Thứ tự trong mảng = thứ tự cột khi in
    cot: [
      { loai: "so_luong", tieuDe: "SL", canLe: "giua" },
      { loai: "sku", tieuDe: "Mã SKU", canLe: null },
      { loai: "ten", tieuDe: "Tên Sản Phẩm", canLe: null },
      { loai: "vi_tri", tieuDe: "Vị Trí Kho", canLe: null },
      { loai: "ghi_chu", tieuDe: "Ghi Chú", canLe: null },
    ],
    khoanhTronSoLuong: true, // Số lượng > 1 thì khoanh tròn
    nhanTongTien: "Total Price:",
  };

  // ── KIỂU DÁNG MẶC ĐỊNH THEO LOẠI CỘT — chép chính xác từ style.css
  //   màn hình: dòng 292–298 (mọi ô: white-space pre-wrap), 316–318 (td.i-sku: phông Arial), 436–459
  //   khi in:   dòng 698–753
  // Mỗi mục: { rong, minRong, xuongDong, coChu, dam: {th, td}, phong: {th, td}, ngatTu, canGiua }
  // Không có mục = không có luật (trình duyệt tự xử lý: chữ kế thừa, tiêu đề đậm trên màn hình…)
  // Đã đo đối chiếu từng ô trên trang thật (cỡ chữ, đậm, phông, xuống dòng, căn lề, độ rộng pixel).
  const KIEU_MAC_DINH = {
    man_hinh: {
      so_luong: { rong: "1%", xuongDong: false },
      sku: { rong: "1%", xuongDong: false, coChu: 15, dam: { th: true, td: true }, phong: { th: null, td: "Arial" } },
      ten: { rong: "auto" },
      vi_tri: { rong: "1%", xuongDong: false },
      ghi_chu: { rong: "15%", minRong: "60px" },
    },
    in: {
      so_luong: { rong: "1%", xuongDong: false, coChu: 20, dam: { th: false, td: true }, canGiua: true },
      sku: { rong: "1%", xuongDong: false, coChu: 15, dam: { th: true, td: true }, phong: { th: "Arial", td: "Arial" } },
      ten: { rong: "auto", coChu: 11, ngatTu: true },
      vi_tri: { rong: "1%", xuongDong: false, coChu: 15, dam: { th: false, td: false } },
      ghi_chu: { rong: "5%", minRong: "30px" },
    },
  };
  // Tiêu đề cột: trên màn hình trình duyệt tự in đậm; khi in style.css đặt thường (font-weight: normal !important)
  const TIEU_DE_DAM_MAC_DINH = { man_hinh: true, in: false };

  let mauHienTai = MAU_MAC_DINH;
  // Để kiểm tra nhanh trong Console: gõ MauIn.trangThai
  const trangThai = { nguon: "mac_dinh", phienBan: null, loi: [], luc: null };

  const CAN_LE = { trai: "left", giua: "center", phai: "right" };

  // Nhãn / tiêu đề do admin đặt → chống chèn mã (mẫu mặc định không có ký tự đặc biệt nên kết quả không đổi)
  function esc(chuoi) {
    return String(chuoi)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Thuộc tính của 1 ô dữ liệu: căn lề + class riêng cho cột SKU (style.css đang dựa vào class i-sku).
  // Mẫu tùy chỉnh thêm class "mi-<loại cột>" để CSS riêng bám theo cột chứ không theo vị trí.
  function thuocTinhO(cot, tuyChinh) {
    const canLe = CAN_LE[cot.canLe] ? ' style="text-align:' + CAN_LE[cot.canLe] + ';"' : "";
    const cacLop = [];
    if (cot.loai === "sku") cacLop.push("i-sku");
    if (tuyChinh) cacLop.push("mi-" + cot.loai);
    return canLe + (cacLop.length ? ' class="' + cacLop.join(" ") + '"' : "");
  }

  // ── PHẦN THÊM CỦA MẪU TÙY CHỈNH: KTGH, thùng lớn nhất, mã QR ──
  // Mỗi hàm tự bắt lỗi: lỗi / thiếu dữ liệu / thiếu file phụ → trả "" (để trống), không bao giờ làm hỏng đơn.

  // Cột KTGH: có thùng → tên thùng; chưa có thùng → kích thước chuẩn D×R×C; không có → ""
  function ktgh(sku) {
    try {
      return typeof window !== "undefined" && window.KichThuoc ? window.KichThuoc.noiDungKtgh(sku) || "" : "";
    } catch (e) {
      console.error("[MauIn] Lỗi tra kích thước — để trống:", e);
      return "";
    }
  }

  // Thùng lớn nhất trong các mã của đơn (thùng ở dòng dưới trong sheet TONG_HOP_SIZE_THUNG là lớn hơn)
  function thungCuaDon(items) {
    try {
      if (typeof window === "undefined" || !window.KichThuoc) return "";
      return window.KichThuoc.thungLonNhat(items.map(function (it) { return it.sku; })) || "";
    } catch (e) {
      console.error("[MauIn] Lỗi chọn thùng — để trống:", e);
      return "";
    }
  }

  // Mã QR của mã đơn (ảnh vector đen trắng, kích thước đặt trong CSS)
  function maQr(noiDung) {
    try {
      if (!noiDung || typeof qrcode !== "function") return "";
      const qr = qrcode(0, "M");
      qr.addData(String(noiDung));
      qr.make();
      const svg = qr.createSvgTag({ cellSize: 1, margin: 2, scalable: true });
      return '<img class="mi-qr" alt="" src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '">';
    } catch (e) {
      console.error("[MauIn] Lỗi vẽ mã QR — bỏ mã QR:", e);
      return "";
    }
  }

  // Nội dung của 1 ô dữ liệu theo loại cột
  function giaTriO(cot, it, mau) {
    switch (cot.loai) {
      case "so_luong":
        return mau.khoanhTronSoLuong && parseInt(it.qty) > 1
          ? `<span class="circle-qty">${it.qty}</span>`
          : `${it.qty}`;
      case "sku":
        return `${it.sku}`;
      case "ten":
        return `${it.name}`;
      case "vi_tri":
        return `${it.loc}`;
      case "ghi_chu":
        // Mẫu tùy chỉnh: cột này hiện KTGH (tên thùng / kích thước chuẩn). Mẫu gốc: để trống như cũ
        return mau.tuyChinh ? esc(ktgh(it.sku)) : "";
      default:
        throw new Error("Loại cột không hợp lệ: " + cot.loai);
    }
  }

  // ctx = { idDon, don, total, canhBaoDeVo, copyText } — đều do script.js tính sẵn
  function veDon(ctx, mauRieng) {
    const mau = mauRieng || mauHienTai;
    const tc = !!mau.tuyChinh; // mẫu tùy chỉnh (từ sheet, công tắc bật) — mẫu mặc định giữ nguyên HTML cũ
    const don = ctx.don;

    let html = `
      <div class="invoice-box${tc ? " mau-tuy-chinh" : ""}" data-copy-text="${ctx.copyText.replace(/"/g, "&quot;")}">
        <div class="invoice-head">
          <div><b>${esc(mau.dauDon.nhanMaVanDon)}</b> ${don.vandon}</div>
          <div style="display:flex;align-items:center;gap:10px;">
            ${tc && mau.trang.hienQr !== false ? maQr(ctx.idDon) : ""}<span class="oid-value">${esc(mau.dauDon.nhanMaDon)} ${ctx.idDon}</span>
            <button class="btn-copy-don" onclick="copyDonHang(this)">📋 Copy</button>
          </div>
        </div>
        <table class="inv-table">
          <thead><tr>` +
      mau.cot.map(function (cot) {
        return "<th" + (tc ? ' class="mi-' + cot.loai + '"' : "") + ">" + esc(cot.tieuDe) + "</th>";
      }).join("") +
      `</tr></thead>
          <tbody>`;

    don.items.forEach(function (it) {
      html += "<tr>" +
        mau.cot.map(function (cot) {
          return "<td" + thuocTinhO(cot, tc) + ">" + giaTriO(cot, it, mau) + "</td>";
        }).join("") +
        "</tr>";
    });

    const hienTong = !tc || mau.trang.hienTongTien;
    const dongTong = hienTong
      ? `<div class="inv-total">${esc(mau.nhanTongTien)}<span class="num">${ctx.total.toLocaleString("vi-VN")}</span></div>`
      : "";
    // Mẫu tùy chỉnh: "Thùng: X" cùng hàng, bên TRÁI tổng tiền. Không có thùng → giữ nguyên như cũ
    const thung = tc && mau.trang.hienThung !== false ? thungCuaDon(don.items) : "";
    html += `</tbody></table>
        ${ctx.canhBaoDeVo}
        ` + (thung
      ? `<div class="mi-chan-tong"><span class="mi-thung">Thùng:<b>${esc(thung)}</b></span>${dongTong}</div>`
      : dongTong) +
      (tc && mau.trang.chanDon ? `<div class="mi-chan-don">${esc(mau.trang.chanDon)}</div>` : "") + `
      </div>`;

    return html;
  }

  // =========================================================================
  // SINH CSS RIÊNG CHO MẪU TÙY CHỈNH
  // Với MỌI cột đều đặt đủ các thuộc tính mà style.css đang đặt theo vị trí (nth-child), kèm !important
  // và độ ưu tiên cao hơn → kiểu dáng đi theo LOẠI cột, đổi thứ tự / ẩn cột không bị lệch.
  // =========================================================================
  function luatCot(cot, cheDo, la) {
    const md = KIEU_MAC_DINH[cheDo][cot.loai] || {};
    const p = [];
    // Độ rộng & xuống dòng (mọi ô bảng trong style.css mặc định white-space: pre-wrap)
    if (cot.doRong === "vua") {
      p.push("width:1%", "white-space:nowrap", "min-width:auto");
    } else if (cot.doRong) {
      p.push("width:" + cot.doRong, "white-space:pre-wrap", "min-width:auto");
    } else {
      p.push("width:" + (md.rong || "auto"), "white-space:" + (md.xuongDong === false ? "nowrap" : "pre-wrap"), "min-width:" + (md.minRong || "auto"));
    }
    // Cỡ chữ
    p.push("font-size:" + (cot.coChu ? cot.coChu + "px" : md.coChu ? md.coChu + "px" : "inherit"));
    // Kiểu chữ (đậm / thường)
    let dam;
    if (cot.kieuChu) dam = cot.kieuChu === "dam";
    else if (md.dam) dam = md.dam[la];
    else dam = la === "th" ? TIEU_DE_DAM_MAC_DINH[cheDo] : false;
    p.push("font-weight:" + (dam ? "bold" : "normal"));
    // Phông
    const phong = cot.phong || (md.phong ? md.phong[la] : null);
    p.push("font-family:" + (phong ? '"' + phong + '", sans-serif' : "inherit"));
    // Ngắt từ
    p.push("word-break:" + (md.ngatTu && !cot.doRong ? "break-word" : "normal"));
    // Căn lề: ô dữ liệu theo CAN_LE (không đặt = "start" như mặc định); tiêu đề căn giữa như mặc định trình duyệt
    if (la === "td") p.push("text-align:" + (CAN_LE[cot.canLe] || (md.canGiua ? "center" : "start")));
    else p.push("text-align:center");
    return p.map(function (x) { return x + " !important"; }).join(";");
  }

  function sinhCss(mau) {
    const chon = function (la, loai) { return ".invoice-box.mau-tuy-chinh table.inv-table " + la + ".mi-" + loai; };
    const khoi = function (cheDo) {
      return mau.cot.map(function (cot) {
        return chon("th", cot.loai) + "{" + luatCot(cot, cheDo, "th") + "}\n" +
          chon("td", cot.loai) + "{" + luatCot(cot, cheDo, "td") + "}";
      }).join("\n") + "\n" +
        ".invoice-box.mau-tuy-chinh .invoice-head .oid-value{font-size:" + mau.trang.coChuMaDon + "px !important}\n" +
        ".invoice-box.mau-tuy-chinh .mi-chan-don{margin-top:8px;text-align:center;font-size:12px;white-space:pre-line}\n" +
        // Mã QR bên trái mã đơn · dòng "Thùng: X" bên trái tổng tiền — chỉ đen trắng, không tô màu
        ".invoice-box.mau-tuy-chinh .mi-qr{width:14mm;height:14mm;display:block;flex:none}\n" +
        ".invoice-box.mau-tuy-chinh .mi-chan-tong{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-top:10px}\n" +
        ".invoice-box.mau-tuy-chinh .mi-chan-tong .inv-total{margin-top:0 !important;margin-left:auto}\n" +
        ".invoice-box.mau-tuy-chinh .mi-thung{font-weight:bold;font-size:16px;color:#000;background:#fff;white-space:nowrap}\n" +
        ".invoice-box.mau-tuy-chinh .mi-thung b{font-size:20px;border:2px solid #000;border-radius:4px;padding:1px 8px;margin-left:6px}";
    };
    return "/* Mẫu in tùy chỉnh — sinh tự động từ sheet " + SHEET_CONFIG.SHEET_NAME + " (phiên bản " + mau.phienBan + ") */\n" +
      "@media screen {\n" + khoi("man_hinh") + "\n}\n" +
      "@media print {\n" + khoi("in") + "\n}\n" +
      "@page { size: " + mau.trang.khoGiay + "; margin: " + mau.trang.leMm + "mm; }\n";
  }

  // Gắn / gỡ thẻ CSS riêng trên trang (không có document — ví dụ khi kiểm thử — thì bỏ qua)
  function capNhatCss(mau) {
    if (typeof document === "undefined" || !document.head) return;
    let the = document.getElementById(ID_THE_CSS);
    if (!mau.tuyChinh) {
      if (the) the.remove();
      return;
    }
    if (!the) {
      the = document.createElement("style");
      the.id = ID_THE_CSS;
      document.head.appendChild(the); // đặt sau style.css → @page của mẫu tùy chỉnh được ưu tiên
    }
    the.textContent = sinhCss(mau);
  }

  // =========================================================================
  // ĐỌC MẪU TỪ GOOGLE SHEET
  // =========================================================================

  // "15" / "15px" / 15 → 15 ; ô trống → null ; chữ lạ → giữ nguyên để kiểm tra báo lỗi
  function soHoacTrong(v) {
    if (v === "" || v == null) return null;
    if (typeof v === "number") return v;
    const m = /^\s*(\d+(?:\.\d+)?)\s*(px|mm)?\s*$/i.exec(String(v));
    return m ? Number(m[1]) : v;
  }

  // Độ rộng: "vua" / "15%" ; ô gõ 15% bị Google tự đổi thành số 0.15 → đổi lại "15%"
  function doRongTuSheet(v) {
    if (v === "" || v == null) return null;
    if (typeof v === "number") return Math.round(v <= 1 ? v * 100 : v) + "%";
    return String(v).trim().toLowerCase().replace(/\s+/g, "");
  }

  function chuHoacTrong(v) {
    if (v === "" || v == null) return null;
    return typeof v === "string" ? v.trim() : v;
  }

  // Bảng giá trị thô của sheet (2 chiều) → đối tượng mẫu. Tìm theo chữ ở cột A, không phụ thuộc số dòng.
  // Sheet đời cũ (chưa có cài đặt giai đoạn 3) → các mục mới lấy giá trị mặc định = kiểu dáng hiện tại.
  function phanTichSheet(bang) {
    const theoKhoa = {};
    let dongTieuDeCot = -1;
    (bang || []).forEach(function (dong, i) {
      const khoa = dong && typeof dong[0] === "string" ? dong[0].trim() : "";
      if (khoa === "THU_TU") dongTieuDeCot = i;
      else if (khoa && dongTieuDeCot < 0) theoKhoa[khoa] = dong[1];
    });

    const cot = [];
    if (dongTieuDeCot >= 0) {
      for (let i = dongTieuDeCot + 1; i < bang.length; i++) {
        const d = bang[i] || [];
        if (d.length === 0 || d.every(function (o) { return o === "" || o == null; })) break; // hết bảng cột
        cot.push({
          thuTu: d[0],
          loai: typeof d[1] === "string" ? d[1].trim() : d[1],
          tieuDe: typeof d[2] === "number" ? String(d[2]) : d[2],
          hien: d[3],
          canLe: chuHoacTrong(d[4]),
          doRong: doRongTuSheet(d[5]),
          coChu: soHoacTrong(d[6]),
          kieuChu: chuHoacTrong(d[7]),
          phong: chuHoacTrong(d[8]),
        });
      }
    }
    // Sắp theo THU_TU nếu tất cả đều là số (bằng nhau thì giữ thứ tự dòng); không thì giữ thứ tự dòng trong sheet
    if (cot.every(function (c) { return typeof c.thuTu === "number" && isFinite(c.thuTu); })) {
      cot.sort(function (a, b) { return a.thuTu - b.thuTu; });
    }

    const chu = function (v) { return typeof v === "number" ? String(v) : v; };
    const coKhoa = function (k) { return Object.prototype.hasOwnProperty.call(theoKhoa, k); };
    return {
      bat: theoKhoa.BAT_MAU_TUY_CHINH,
      dauDon: { nhanMaVanDon: chu(theoKhoa.NHAN_MA_VAN_DON), nhanMaDon: chu(theoKhoa.NHAN_MA_DON) },
      nhanTongTien: chu(theoKhoa.NHAN_TONG_TIEN),
      khoanhTronSoLuong: theoKhoa.KHOANH_TRON_SL,
      phienBan: theoKhoa.PHIEN_BAN,
      trang: {
        khoGiay: coKhoa("KHO_GIAY") ? chuHoacTrong(theoKhoa.KHO_GIAY) : TRANG_MAC_DINH.khoGiay,
        leMm: coKhoa("LE_GIAY_MM") ? soHoacTrong(theoKhoa.LE_GIAY_MM) : TRANG_MAC_DINH.leMm,
        coChuMaDon: coKhoa("CO_CHU_MA_DON") ? soHoacTrong(theoKhoa.CO_CHU_MA_DON) : TRANG_MAC_DINH.coChuMaDon,
        hienTongTien: coKhoa("HIEN_TONG_TIEN") ? theoKhoa.HIEN_TONG_TIEN : TRANG_MAC_DINH.hienTongTien,
        chanDon: coKhoa("CHAN_DON") ? (theoKhoa.CHAN_DON == null ? "" : chu(theoKhoa.CHAN_DON)) : TRANG_MAC_DINH.chanDon,
        hienQr: coKhoa("HIEN_QR") ? theoKhoa.HIEN_QR : TRANG_MAC_DINH.hienQr,
        hienThung: coKhoa("HIEN_THUNG") ? theoKhoa.HIEN_THUNG : TRANG_MAC_DINH.hienThung,
      },
      cot: cot,
    };
  }

  // Kiểm tra mẫu hợp lệ — trả về danh sách lỗi (rỗng = hợp lệ). PHẢI giống apps_script/mau_in_don.gs
  function kiemTraMau(mau) {
    const loi = [];
    const chuoiNgan = function (v, ten, toiDa) {
      if (typeof v !== "string" || v.length === 0 || v.length > toiDa) loi.push(ten + " phải là chữ, 1–" + toiDa + " ký tự");
      else if (/[<>]/.test(v)) loi.push(ten + " không được chứa ký tự < >");
    };
    const soTrongKhoang = function (v, ten, nho, lon) {
      if (typeof v !== "number" || !isFinite(v) || v < nho || v > lon) loi.push(ten + " phải là số từ " + nho + " đến " + lon);
    };
    if (!mau || typeof mau !== "object") return ["Mẫu không hợp lệ"];
    if (typeof mau.bat !== "boolean") loi.push("BAT_MAU_TUY_CHINH phải là ô đánh dấu ☑/☐");
    if (!mau.dauDon || typeof mau.dauDon !== "object") loi.push("Thiếu phần đầu đơn");
    else {
      chuoiNgan(mau.dauDon.nhanMaVanDon, "NHAN_MA_VAN_DON", 60);
      chuoiNgan(mau.dauDon.nhanMaDon, "NHAN_MA_DON", 60);
    }
    chuoiNgan(mau.nhanTongTien, "NHAN_TONG_TIEN", 60);
    if (typeof mau.khoanhTronSoLuong !== "boolean") loi.push("KHOANH_TRON_SL phải là ô đánh dấu ☑/☐");
    const t = mau.trang;
    if (!t || typeof t !== "object") loi.push("Thiếu cài đặt trang");
    else {
      if (KHO_GIAY.indexOf(t.khoGiay) < 0) loi.push("KHO_GIAY phải là một trong " + KHO_GIAY.join(", "));
      soTrongKhoang(t.leMm, "LE_GIAY_MM", 0, 30);
      soTrongKhoang(t.coChuMaDon, "CO_CHU_MA_DON", 8, 40);
      if (typeof t.hienTongTien !== "boolean") loi.push("HIEN_TONG_TIEN phải là ô đánh dấu ☑/☐");
      if (typeof t.chanDon !== "string" || t.chanDon.length > 200) loi.push("CHAN_DON tối đa 200 ký tự");
      else if (/[<>]/.test(t.chanDon)) loi.push("CHAN_DON không được chứa ký tự < >");
      if (typeof t.hienQr !== "boolean") loi.push("HIEN_QR phải là ô đánh dấu ☑/☐");
      if (typeof t.hienThung !== "boolean") loi.push("HIEN_THUNG phải là ô đánh dấu ☑/☐");
    }
    if (!Array.isArray(mau.cot) || mau.cot.length === 0 || mau.cot.length > 12) {
      loi.push("Phải có 1–12 cột");
    } else {
      const daCo = {};
      mau.cot.forEach(function (c, i) {
        const ten = "Cột " + (i + 1);
        if (!c || LOAI_COT.indexOf(c.loai) < 0) loi.push(ten + ": LOAI_COT phải là một trong " + LOAI_COT.join(", "));
        else if (daCo[c.loai]) loi.push(ten + ": LOAI_COT '" + c.loai + "' bị trùng");
        else daCo[c.loai] = true;
        if (c) {
          chuoiNgan(c.tieuDe, ten + ": TIEU_DE", 40);
          if (typeof c.hien !== "boolean") loi.push(ten + ": HIEN phải là ô đánh dấu ☑/☐");
          if (c.canLe !== null && CAN_LE_HOP_LE.indexOf(c.canLe) < 0) loi.push(ten + ": CAN_LE phải để trống hoặc là " + CAN_LE_HOP_LE.join(", "));
          if (c.doRong !== null) {
            const m = /^(\d{1,3})%$/.exec(c.doRong);
            if (c.doRong !== "vua" && !(m && Number(m[1]) >= 1 && Number(m[1]) <= 100)) loi.push(ten + ": DO_RONG phải để trống, 'vua', hoặc số % từ 1% đến 100%");
          }
          if (c.coChu !== null) soTrongKhoang(c.coChu, ten + ": CO_CHU", 6, 48);
          if (c.kieuChu !== null && KIEU_CHU.indexOf(c.kieuChu) < 0) loi.push(ten + ": KIEU_CHU phải để trống hoặc là " + KIEU_CHU.join(", "));
          if (c.phong !== null && PHONG.indexOf(c.phong) < 0) loi.push(ten + ": PHONG phải để trống hoặc là " + PHONG.join(", "));
        }
      });
      if (!mau.cot.some(function (c) { return c && c.hien === true; })) loi.push("Phải hiện ít nhất 1 cột");
    }
    return loi;
  }

  // Mẫu sheet (đã hợp lệ) → mẫu dùng để vẽ: chỉ giữ các cột đang HIỆN
  function mauDeVe(mau) {
    return {
      tuyChinh: true,
      phienBan: mau.phienBan,
      dauDon: { nhanMaVanDon: mau.dauDon.nhanMaVanDon, nhanMaDon: mau.dauDon.nhanMaDon },
      cot: mau.cot.filter(function (c) { return c.hien; }).map(function (c) {
        return { loai: c.loai, tieuDe: c.tieuDe, canLe: c.canLe, doRong: c.doRong, coChu: c.coChu, kieuChu: c.kieuChu, phong: c.phong };
      }),
      khoanhTronSoLuong: mau.khoanhTronSoLuong,
      nhanTongTien: mau.nhanTongTien,
      trang: {
        khoGiay: mau.trang.khoGiay, leMm: mau.trang.leMm, coChuMaDon: mau.trang.coChuMaDon,
        hienTongTien: mau.trang.hienTongTien, chanDon: mau.trang.chanDon,
        hienQr: mau.trang.hienQr, hienThung: mau.trang.hienThung,
      },
    };
  }

  // Mẫu lưu tạm từ phiên bản cũ (chưa có hienQr / hienThung) → bổ sung giá trị mặc định (BẬT) như khi đọc sheet
  function boSungMacDinh(mau) {
    if (mau && mau.trang && typeof mau.trang === "object") {
      if (mau.trang.hienQr === undefined) mau.trang.hienQr = TRANG_MAC_DINH.hienQr;
      if (mau.trang.hienThung === undefined) mau.trang.hienThung = TRANG_MAC_DINH.hienThung;
    }
    return mau;
  }

  // Áp dụng 1 mẫu đọc được (từ sheet hoặc bộ nhớ tạm). Trả về true nếu hợp lệ
  function apDung(mau, nguon) {
    const loi = kiemTraMau(mau);
    trangThai.luc = new Date().toISOString();
    if (loi.length) {
      mauHienTai = MAU_MAC_DINH;
      trangThai.nguon = "mac_dinh";
      trangThai.phienBan = null;
      trangThai.loi = loi;
      console.error("[MauIn] Mẫu trong sheet " + SHEET_CONFIG.SHEET_NAME + " KHÔNG hợp lệ → dùng mẫu gốc. Lỗi:\n - " + loi.join("\n - "));
    } else {
      trangThai.loi = [];
      trangThai.phienBan = mau.phienBan == null ? null : mau.phienBan;
      if (mau.bat) {
        mauHienTai = mauDeVe(mau);
        trangThai.nguon = nguon;
      } else {
        mauHienTai = MAU_MAC_DINH; // công tắc tắt → mẫu gốc
        trangThai.nguon = "mac_dinh";
      }
    }
    capNhatCss(mauHienTai);
    return loi.length === 0;
  }

  function docBoNhoTam() {
    try {
      return boSungMacDinh(JSON.parse(localStorage.getItem(KHOA_BO_NHO_TAM)));
    } catch (e) {
      return null;
    }
  }

  function ghiBoNhoTam(mau) {
    try {
      localStorage.setItem(KHOA_BO_NHO_TAM, JSON.stringify(mau));
    } catch (e) {
      // Bộ nhớ máy không ghi được → lần sau mất mạng sẽ dùng mẫu mặc định, không ảnh hưởng in
    }
  }

  async function taiTuSheet() {
    const url = "https://sheets.googleapis.com/v4/spreadsheets/" + SHEET_CONFIG.SPREADSHEET_ID +
      "/values/" + encodeURIComponent(SHEET_CONFIG.SHEET_NAME + "!" + SHEET_CONFIG.VUNG) +
      "?valueRenderOption=UNFORMATTED_VALUE&key=" + SHEET_CONFIG.API_KEY;
    const huy = typeof AbortController === "function" ? new AbortController() : null;
    const henGio = setTimeout(function () { if (huy) huy.abort(); }, SHEET_CONFIG.THOI_GIAN_CHO);
    try {
      const resp = await fetch(url, huy ? { signal: huy.signal } : undefined);
      if (!resp.ok) throw new Error("Mã lỗi " + resp.status);
      const duLieu = await resp.json();
      const mau = phanTichSheet(duLieu.values);
      if (apDung(mau, "sheet")) ghiBoNhoTam(mau);
    } catch (e) {
      // Mất mạng / Google lỗi → giữ mẫu đang dùng (bộ nhớ tạm hoặc mặc định)
      console.warn("[MauIn] Không đọc được sheet " + SHEET_CONFIG.SHEET_NAME + " (" + e.message + ") → dùng " +
        (trangThai.nguon === "bo_nho_tam" ? "mẫu lưu tạm trên máy" : "mẫu gốc"));
    } finally {
      clearTimeout(henGio);
    }
  }

  // ── KHỞI ĐỘNG: dùng ngay mẫu lưu tạm (nếu có), rồi đọc sheet để cập nhật ──
  const tam = docBoNhoTam();
  if (tam) apDung(tam, "bo_nho_tam");
  taiTuSheet();

  window.MauIn = {
    veDon: veDon,
    MAU_MAC_DINH: MAU_MAC_DINH,
    trangThai: trangThai,
    // Dùng cho trang Thiết kế mẫu in (giai đoạn 4) — chỉ đọc, không đổi cách trang Vận Hành chạy
    phanTichSheet: phanTichSheet,
    kiemTraMau: kiemTraMau,
    mauDeVe: mauDeVe,
    sinhCss: sinhCss,
    SHEET_CONFIG: SHEET_CONFIG,
    KIEU_MAC_DINH: KIEU_MAC_DINH,
    TRANG_MAC_DINH: TRANG_MAC_DINH,
    DS: { LOAI_COT: LOAI_COT, CAN_LE: CAN_LE_HOP_LE, KHO_GIAY: KHO_GIAY, KIEU_CHU: KIEU_CHU, PHONG: PHONG },
  };
})();
