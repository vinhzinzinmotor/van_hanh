// =========================================================================
// CẦU DAO "PHIẾU GỘP" (23/11) — 1 tờ in = nhãn sàn (PDF Shopee / TikTok) + tờ đơn lấy hàng
// - Đọc tab PHIEU_GOP (Google Sheet — CHỈ ĐỌC bằng khóa API của script.js) khi mở / F5:
//     BAT_PHIEU_GOP ☑ → nạp phieu_gop/dung_phieu.js + phieu_gop/phieu_gop.js (khung "🧾 Phiếu gộp" ở tab Xem Đơn Hàng)
//     BAT_PHIEU_GOP ☐ / chưa có dòng / chưa có tab → KHÔNG nạp gì → trang Vận Hành y như chưa có tính năng.
//     TL_PHIEU_GOP  → tỉ lệ thu tờ đơn (%), 50–100, sai / trống → 80.
// - Mất mạng → trạng thái đọc được LẦN TRƯỚC (lưu trên máy, khóa zzm_cong_tac_phieu_gop_v1 — cau_dao_pdf.js cũng đọc khóa này
//   để KHÔNG nạp ô 📦 khi phiếu gộp đang bật); máy chưa từng đọc → TẮT.
// - File này KHÔNG hiện gì lên giao diện; lỗi chỉ ghi F12 — trang Vận Hành luôn chạy bình thường.
// =========================================================================
(function () {
  "use strict";
  const KHOA_LUU = "zzm_cong_tac_phieu_gop_v1";
  const TL_MAC_DINH = 80;
  const thuMuc = ((document.currentScript && document.currentScript.src) || "").replace(/[^/]*$/, "");
  let daNap = false;

  function chuanTl(v) { const n = Number(String(v == null ? "" : v).replace(",", ".")); return isFinite(n) && n >= 50 && n <= 100 ? n : TL_MAC_DINH; }
  function luu(bat, tl) { try { localStorage.setItem(KHOA_LUU, JSON.stringify({ bat: bat === true, tl: tl, luc: Date.now() })); } catch (e) { /* bỏ qua */ } }
  function docLuu() { try { const b = JSON.parse(localStorage.getItem(KHOA_LUU) || "null"); return b && typeof b.bat === "boolean" ? b : null; } catch (e) { return null; } }

  function nap(tl, nguon) {
    if (daNap || document.getElementById("pg-khung")) return;
    daNap = true;
    window.PHIEU_GOP_CAU_HINH = { tiLe: tl / 100, nguon: nguon };
    ["dung_phieu.js", "phieu_gop.js"].forEach(function (ten) {
      const s = document.createElement("script");
      s.src = thuMuc + ten;
      s.async = false; // nạp đúng thứ tự
      s.onerror = function () { console.warn("[PhieuGop] Không nạp được " + ten); };
      document.body.appendChild(s);
    });
    console.info("[PhieuGop] Công tắc phiếu gộp: BẬT (" + nguon + ", tờ đơn " + tl + "%) → đã nạp khung phiếu gộp.");
  }
  function quyetDinh(bat, tl, nguon) {
    if (bat === true) nap(tl, nguon);
    else console.info("[PhieuGop] Công tắc phiếu gộp: TẮT (" + nguon + ") → không nạp gì.");
  }
  function dungBanLuu(lyDo) {
    const b = docLuu();
    console.warn("[PhieuGop] Không đọc được công tắc (" + lyDo + ")" + (b ? " — dùng trạng thái lưu lần trước." : " — máy chưa từng đọc → TẮT."));
    quyetDinh(b ? b.bat : false, b ? chuanTl(b.tl) : TL_MAC_DINH, b ? "bản lưu" : "chưa từng đọc");
  }

  try {
    const cfg = typeof C2_CONFIG !== "undefined" ? C2_CONFIG : null; // khai báo trong script.js (nạp trước file này)
    if (!cfg || !cfg.SPREADSHEET_ID || !cfg.API_KEY || typeof fetch !== "function") { dungBanLuu("thiếu cấu hình"); return; }
    const url = "https://sheets.googleapis.com/v4/spreadsheets/" + cfg.SPREADSHEET_ID + "/values/" + encodeURIComponent("PHIEU_GOP!A1:B40") +
      "?valueRenderOption=UNFORMATTED_VALUE&key=" + cfg.API_KEY;
    const hetGio = new Promise(function (_, tuChoi) { setTimeout(function () { tuChoi(new Error("quá 10 giây")); }, 10000); });
    Promise.race([fetch(url), hetGio])
      .then(function (r) {
        if (r.status === 400) return { values: [] }; // chưa có tab → như chưa có tính năng
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (d) {
        const ds = (d && d.values) || [];
        const tim = function (nhan) { return ds.find(function (x) { return Array.isArray(x) && String(x[0] == null ? "" : x[0]).trim().toUpperCase() === nhan; }); };
        const dong = tim("BAT_PHIEU_GOP"), dongTl = tim("TL_PHIEU_GOP");
        const bat = !!dong && (dong[1] === true || String(dong[1]).trim().toUpperCase() === "TRUE");
        const tl = chuanTl(dongTl ? dongTl[1] : "");
        luu(bat, tl); // đọc được bảng → lưu (kể cả TẮT / chưa có dòng = TẮT)
        quyetDinh(bat, tl, dong ? "Google Sheet" : "chưa có dòng BAT_PHIEU_GOP");
      })
      .catch(function (e) { dungBanLuu(e && e.message); });
  } catch (e) {
    console.warn("[PhieuGop] Lỗi:", e);
  }
})();
