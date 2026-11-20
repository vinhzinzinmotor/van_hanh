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

  function napPdf(nguon) {
    if (daNap || document.getElementById("ssp-khung")) return;
    daNap = true;
    const s = document.createElement("script");
    s.src = thuMuc + "nhung_van_hanh.js";
    s.onerror = function () { console.warn("[CauDaoPdf] Không nạp được nhung_van_hanh.js"); };
    document.body.appendChild(s);
    console.info("[CauDaoPdf] Công tắc PDF trang vận hành: BẬT (" + nguon + ") → đã nạp ô phiếu đóng gói.");
  }
  function quyetDinh(bat, nguon) {
    if (bat === true) napPdf(nguon);
    else console.info("[CauDaoPdf] Công tắc PDF trang vận hành: TẮT (" + nguon + ") → không nạp gì.");
  }
  function dungBanLuu(lyDo) {
    const b = docLuu();
    console.warn("[CauDaoPdf] Không đọc được công tắc (" + lyDo + ")" + (b ? " — dùng trạng thái lưu lần trước." : " — máy chưa từng đọc → TẮT."));
    quyetDinh(b ? b.bat : false, b ? "bản lưu" : "chưa từng đọc");
  }

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
