// =========================================================================
// CẦU DAO "PDF TRANG VẬN HÀNH" (20/11) — thay cho dòng <script src="sap_xep_phieu/nhung_van_hanh.js"> trong index.html
// - Đọc công tắc bí mật BAT_PDF_VAN_HANH (tab SAP_XEP_DON, Google Sheet — CHỈ ĐỌC bằng khóa API của script.js) khi mở / F5.
// - ☑ BẬT  → nạp NGUYÊN VẸN nhung_van_hanh.js (file được bảo vệ, KHÔNG sửa chữ nào) → mọi thứ chạy y hệt trước.
// - ☐ TẮT / chưa có dòng công tắc / tab không có → KHÔNG nạp gì → trang Vận Hành như thời chưa có tính năng (không ô, không CSS,
//   không hỏi gì khi In đơn / F5).
// - Mất mạng → dùng trạng thái đọc được LẦN TRƯỚC (lưu trên máy); máy chưa từng đọc → TẮT.
// - File này KHÔNG hiện gì lên giao diện; mọi lỗi chỉ ghi F12 (console.warn) — trang Vận Hành luôn chạy bình thường.
// =========================================================================
(function () {
  "use strict";
  const KHOA_LUU = "zzm_cong_tac_pdf_v1";
  const NHAN = "BAT_PDF_VAN_HANH";
  // Thư mục chứa file này (sap_xep_phieu/) → nạp nhung_van_hanh.js cạnh nó (để nó tự tìm so_da_in.js, loi_sap_xep.js đúng chỗ)
  const thuMuc = ((document.currentScript && document.currentScript.src) || "").replace(/[^/]*$/, "");
  let daNap = false;

  function luu(bat) { try { localStorage.setItem(KHOA_LUU, JSON.stringify({ bat: bat === true, luc: Date.now() })); } catch (e) { /* bỏ qua */ } }
  function docLuu() { try { const b = JSON.parse(localStorage.getItem(KHOA_LUU) || "null"); return b && typeof b.bat === "boolean" ? b : null; } catch (e) { return null; } }

  // 24/11 tối (chủ dự án): chữ trong ô 📦 TO HƠN cho người thị lực kém — CHỈ giao diện. KHÔNG sửa nhung_van_hanh.js (file bảo vệ):
  // sau khi ô nạp xong, chép khối CSS của ô (#ssp-css) thành 1 khối MỚI chỉ đổi cỡ chữ px × TANG_CHU, đặt SAU khối gốc (đè cỡ chữ).
  // Lỗi / không thấy khối gốc → bỏ qua (ô vẫn chạy y như cũ).
  const TANG_CHU = 1.15;
  function phongChuPdf() {
    try {
      const goc = document.getElementById("ssp-css");
      if (!goc || document.getElementById("ssp-css-chu-to")) return;
      const to = document.createElement("style");
      to.id = "ssp-css-chu-to";
      // CHỈ màn hình máy tính (> 600px — điện thoại giữ nguyên, không tràn); CHỈ các quy tắc ngoài cùng; BỎ QUA các dòng đã chốt GỌN 1 dòng
      // (dải 2 nút in ①②, "PDF vừa tạo", dòng đầu ô / nút 📎, khung kết luận) để bố cục gọn không vỡ.
      const BO_QUA = /ssp-day|ssp-nut-in|ssp-in\b|ssp-vua|ssp-tt|ssp-nut-file|ssp-kl|ssp-tom|ssp-td-ngan/;
      const ra = []; let sau = 0;
      goc.textContent.split("\n").forEach(function (dong) {
        const mo = (dong.match(/{/g) || []).length, dong2 = (dong.match(/}/g) || []).length;
        if (sau === 0 && /font-size/.test(dong) && !/^\s*@/.test(dong) && mo === dong2 && !BO_QUA.test(dong.split("{")[0]))
          ra.push(dong.replace(/font-size:\s*([\d.]+)px/g, function (_, n) { return "font-size:" + (Math.round(n * TANG_CHU * 10) / 10) + "px"; }));
        sau += mo - dong2;
      });
      to.textContent = "@media (min-width:601px){\n" + ra.join("\n") + "\n}";
      goc.parentNode.insertBefore(to, goc.nextSibling);
    } catch (e) { console.warn("[CauDaoPdf] Không phóng chữ được (bỏ qua):", e); }
  }
  function napPdf(nguon) {
    if (daNap || document.getElementById("ssp-khung")) return;
    daNap = true;
    const s = document.createElement("script");
    s.src = thuMuc + "nhung_van_hanh.js";
    s.onerror = function () { console.warn("[CauDaoPdf] Không nạp được nhung_van_hanh.js"); };
    s.onload = phongChuPdf; // chữ to hơn (chỉ giao diện)
    document.body.appendChild(s);
    console.info("[CauDaoPdf] Công tắc PDF trang vận hành: BẬT (" + nguon + ") → đã nạp ô phiếu đóng gói.");
  }
  function quyetDinh(bat, nguon) {
    if (bat === true) phieuGop.then(function (pg) {
      if (pg) console.info("[CauDaoPdf] BAT_PDF_VAN_HANH đang BẬT nhưng PHIẾU GỘP đang BẬT → KHÔNG nạp ô phiếu đóng gói (chỉ 1 chế độ).");
      else napPdf(nguon);
    });
    else console.info("[CauDaoPdf] Công tắc PDF trang vận hành: TẮT (" + nguon + ") → không nạp gì.");
  }
  function dungBanLuu(lyDo) {
    const b = docLuu();
    console.warn("[CauDaoPdf] Không đọc được công tắc (" + lyDo + ")" + (b ? " — dùng trạng thái lưu lần trước." : " — máy chưa từng đọc → TẮT."));
    quyetDinh(b ? b.bat : false, b ? "bản lưu" : "chưa từng đọc");
  }

  // 23/11 — PHIẾU GỘP: 2 chế độ KHÔNG chạy cùng lúc. BAT_PHIEU_GOP (tab PHIEU_GOP) ☑ → KHÔNG nạp ô phiếu đóng gói.
  // Tab không có → coi như TẮT (y như trước). Lỗi mạng → trạng thái phiếu gộp lưu lần trước trên máy; chưa từng đọc → TẮT.
  function docPhieuGop() {
    const daLuu = function () { try { const b = JSON.parse(localStorage.getItem("zzm_cong_tac_phieu_gop_v1") || "null"); return !!(b && b.bat === true); } catch (e) { return false; } };
    try {
      const cfg = typeof C2_CONFIG !== "undefined" ? C2_CONFIG : null;
      if (!cfg || !cfg.SPREADSHEET_ID || !cfg.API_KEY || typeof fetch !== "function") return Promise.resolve(daLuu());
      const url = "https://sheets.googleapis.com/v4/spreadsheets/" + cfg.SPREADSHEET_ID + "/values/" + encodeURIComponent("PHIEU_GOP!A1:B40") +
        "?valueRenderOption=UNFORMATTED_VALUE&key=" + cfg.API_KEY;
      const hetGio = new Promise(function (_, tuChoi) { setTimeout(function () { tuChoi(new Error("quá 10 giây")); }, 10000); });
      return Promise.race([fetch(url), hetGio])
        .then(function (r) { if (r.status === 400) return { values: [] }; if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(function (d) {
          const dong = ((d && d.values) || []).find(function (x) { return Array.isArray(x) && String(x[0] == null ? "" : x[0]).trim().toUpperCase() === "BAT_PHIEU_GOP"; });
          return !!dong && (dong[1] === true || String(dong[1]).trim().toUpperCase() === "TRUE");
        })
        .catch(function () { return daLuu(); });
    } catch (e) { return Promise.resolve(false); }
  }
  const phieuGop = docPhieuGop(); // đọc SONG SONG với công tắc PDF → không làm chậm thêm
  try {
    const cfg = typeof C2_CONFIG !== "undefined" ? C2_CONFIG : null; // khai báo trong script.js (nạp trước file này)
    if (!cfg || !cfg.SPREADSHEET_ID || !cfg.API_KEY || typeof fetch !== "function") { dungBanLuu("thiếu cấu hình"); return; }
    const url = "https://sheets.googleapis.com/v4/spreadsheets/" + cfg.SPREADSHEET_ID + "/values/" + encodeURIComponent("SAP_XEP_DON!A1:B40") +
      "?valueRenderOption=UNFORMATTED_VALUE&key=" + cfg.API_KEY;
    const hetGio = new Promise(function (_, tuChoi) { setTimeout(function () { tuChoi(new Error("quá 10 giây")); }, 10000); });
    Promise.race([fetch(url), hetGio])
      .then(function (r) {
        if (r.status === 400) return { values: [] }; // tab không có → như chưa có tính năng
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (d) {
        const dong = ((d && d.values) || []).find(function (x) { return Array.isArray(x) && String(x[0] == null ? "" : x[0]).trim().toUpperCase() === NHAN; });
        const bat = !!dong && (dong[1] === true || String(dong[1]).trim().toUpperCase() === "TRUE");
        luu(bat); // đọc được bảng → lưu (kể cả TẮT / chưa có dòng = TẮT)
        quyetDinh(bat, dong ? "Google Sheet" : "chưa có dòng " + NHAN);
      })
      .catch(function (e) { dungBanLuu(e && e.message); });
  } catch (e) {
    console.warn("[CauDaoPdf] Lỗi:", e);
  }
})();
