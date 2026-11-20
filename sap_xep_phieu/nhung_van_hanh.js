// =========================================================================
// Ô "PHIẾU ĐÓNG GÓI (PDF)" — ĐỐI CHIẾU TỪNG CẶP phiếu đóng gói ↔ tờ đơn lấy hàng, gắn trong tab XEM ĐƠN HÀNG
// của trang Vận Hành (index.html chỉ thêm 1 dòng <script>). Bản 19/11 (theo hình mẫu chủ dự án duyệt):
//  • Từng cặp: ảnh thu nhỏ trang PDF (trái) ↔ thẻ tờ đơn (phải); xanh = khớp, đỏ = lệch (bên thiếu là ô khuyết),
//    vàng = kiểm lại, xám = đã in. Bộ lọc, nút Copy mã đơn, khung kết luận phiên.
//  • LUÔN ĐÚNG 2 nút in: ① tờ đơn lấy hàng (gọi CHÍNH nút "In đơn" có sẵn, tạm ẩn / tạm xếp lại tờ) và
//    ② phiếu đóng gói (PDF đã sắp xếp). 19/11 chiều: 2 nút đi THEO BỘ LỌC — in BÊN CÒN THIẾU của các cặp an toàn
//    trong bộ lọc đang chọn, bên còn lại theo ĐÚNG thứ tự xấp đã in (xem chonIn). Không còn "lượt in".
//  • SỔ ĐÃ IN (so_da_in.js, lưu trên máy): đơn / trang đã in KHÔNG BAO GIỜ bị tính "cần xử lý" và KHÔNG lọt vào lệnh in
//    nào nữa; in lại chỉ qua nút "In lại" có cảnh báo. 19/11 tối: sổ ghi riêng từng lần IN LẠI (viền tím, bộ lọc "↻ Đã in lại"),
//    bộ lọc "Đã in" / "Đã in lại" tích chọn nhiều cặp → 2 nút thành "In lại" (đúng thứ tự xấp), in lại nhiều (≥15 cặp / ≥20%) → cảnh báo thêm. In bằng nút "In đơn" gốc → sau khi đóng hộp in báo trùng + hỏi ghi sổ.
// Thứ tự tờ đơn lấy NGAY trên màn hình: các tờ trong vùng in #print-only-zone, mã ở dòng "📦 ĐƠN: …" (data-copy-text).
// AN TOÀN: không sửa hàm nào của script.js (chỉ BẤM nút In đơn có sẵn); chỉ chèn ô riêng (lớp no-print, tiền tố ssp-);
// thư viện PDF chỉ tải khi kéo PDF vào; mọi lỗi bị chặn trong file này — trang Vận Hành luôn chạy bình thường.
// =========================================================================
(function () {
  "use strict";
  try {
    const sheet3 = document.getElementById("sheet-3");
    const than = sheet3 && sheet3.querySelector(".sheet-body");
    const vungIn = document.getElementById("print-only-zone");
    if (!sheet3 || !than || !vungIn || document.getElementById("ssp-khung")) return;
    const goc = (document.currentScript && document.currentScript.src || "").replace(/[^/]*$/, ""); // thư mục sap_xep_phieu/

    const esc = function (s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
    };
    const kd = function (v) { return (v == null ? "" : String(v)).trim().replace(/\s+/g, "").toUpperCase(); };
    const gio = function (ts) {
      if (!ts) return "";
      const d = new Date(ts), h = function (n) { return (n < 10 ? "0" : "") + n; };
      const homNay = new Date().toDateString() === d.toDateString();
      return h(d.getHours()) + ":" + h(d.getMinutes()) + (homNay ? "" : " " + h(d.getDate()) + "/" + h(d.getMonth() + 1));
    };
    const ANH_RONG = 62; // bề rộng ảnh thu nhỏ trang PDF (px) — điện thoại dùng 44

    // ── CSS riêng (tiền tố ssp- để không đụng style.css) ──
    const css = document.createElement("style");
    css.id = "ssp-css";
    css.textContent = [
      // Tab Xem Đơn Hàng cao cố định = màn hình và CẮT phần tràn (style.css .sheet-content overflow:hidden) → ô KHÔNG được cao hơn
      // phần còn lại: đầu ô đứng yên, giữa tự cuộn (ssp-cuon), dải 2 nút in DÍNH ĐÁY ô (ssp-day) — luôn nhìn thấy.
      ".ssp-khung{margin:8px 12px 0;border:1px solid #c4c7cc;border-radius:10px;background:#f6f9fb;font-size:13px;color:#202124;overflow-wrap:anywhere;" +
        "flex:0 1 auto;min-height:0;max-height:78%;display:flex;flex-direction:column}",
      ".ssp-cuon{flex:1 1 auto;min-height:0;overflow:auto;padding:0 10px}",
      ".ssp-day{flex:none;padding:0 10px 5px;border-top:1px solid #dadce0;background:#f6f9fb;border-radius:0 0 10px 10px}",
      ".ssp-loc{position:sticky;top:0;z-index:1;background:#f6f9fb;padding:2px 0 6px}",
      ".ssp-khung.dang-keo{background:#d6ecf5;border-color:#0f6e8c;box-shadow:0 0 0 2px #0f6e8c inset}",
      ".ssp-hang{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 10px}",
      ".ssp-tieu-de{font-weight:700;white-space:nowrap}",
      ".ssp-nut{border:1px solid #b8bcc3;background:#fff;border-radius:6px;padding:6px 12px;font-weight:600;font-size:13px;cursor:pointer;white-space:nowrap;color:#202124;text-decoration:none;display:inline-block;font-family:inherit}",
      ".ssp-nut:disabled{opacity:.45;cursor:not-allowed}",
      ".ssp-tt{flex:1;min-width:180px;color:#5b6878}",
      ".ssp-tt b{color:#202124}",
      // Khung kết luận
      // Khung kết luận GỌN (19/11 khuya): 1 dòng mảnh — biểu tượng nhỏ, tiêu đề + nội dung nối liền
      ".ssp-kl{border-radius:8px;padding:4px 10px;margin-bottom:5px;display:flex;gap:8px;align-items:flex-start;line-height:1.4;font-size:12.5px}",
      ".ssp-kl .ssp-bt{font-size:15px;line-height:1.3}",
      ".ssp-kl b.ssp-kl-td{font-size:13.5px;display:inline;margin-right:4px}",
      ".ssp-kl:not(.loi) b.ssp-kl-td::after{content:' —';font-weight:400}",
      ".ssp-kl ul{margin:2px 0 0;padding-left:18px}",
      ".ssp-kl.loi{background:#fce8e6;border:2px solid #d93025;color:#7a1c14}",
      ".ssp-kl.tot{background:#e6f4ea;border:2px solid #1e8e3e;color:#0d5224}",
      ".ssp-kl.vang{background:#fef7e0;border:2px solid #f0b400;color:#5c4400}",
      ".ssp-kl.xam{background:#f1f3f4;border:2px solid #9aa0a6;color:#3c4043}",
      // Bộ lọc
      ".ssp-loc{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:2px}",
      ".ssp-loc button{border:1px solid #dadce0;background:#fff;border-radius:16px;padding:5px 11px;font-size:12.5px;cursor:pointer;font-family:inherit;color:#202124}",
      ".ssp-loc button .ssp-so{display:inline-block;min-width:18px;padding:0 6px;border-radius:9px;background:#f1f3f4;margin-left:4px;font-weight:700;text-align:center}",
      ".ssp-loc button.dang{background:#202124;color:#fff;border-color:#202124}",
      ".ssp-loc button.dang .ssp-so{background:#fff;color:#202124}",
      ".ssp-loc button.l-do .ssp-so{background:#d93025;color:#fff}",
      ".ssp-loc button.l-vang .ssp-so{background:#b06000;color:#fff}",
      ".ssp-loc button.l-xanh .ssp-so{background:#1e8e3e;color:#fff}",
      ".ssp-loc button.l-xam .ssp-so{background:#5f6368;color:#fff}",
      // Danh sách cặp
      ".ssp-ds{border:1px solid #e3e6ea;border-radius:8px;background:#fff;padding:6px;margin-bottom:8px}",
      ".ssp-dau{display:grid;grid-template-columns:40px minmax(0,1fr) 56px minmax(0,1fr);gap:8px;font-weight:700;color:#5f6368;font-size:11px;text-transform:uppercase;padding:2px 8px 6px}",
      ".ssp-cap{display:grid;grid-template-columns:40px minmax(0,1fr) 56px minmax(0,1fr);gap:8px;align-items:center;border:2px solid #dadce0;border-radius:10px;padding:7px;margin-bottom:7px}",
      ".ssp-cap.khop{border-color:#a8dab5;background:#f6fbf7}",
      ".ssp-cap.lech{border-color:#d93025;background:#fce8e6}",
      ".ssp-cap.nghi{border-color:#f0b400;background:#fef7e0}",
      ".ssp-cap.dain{border-color:#dadce0;background:#f1f3f4;opacity:.8}",
      ".ssp-stt{font-weight:700;text-align:center;color:#5f6368}",
      ".ssp-noi{text-align:center;font-size:20px;font-weight:700;line-height:1.1}",
      ".ssp-noi small{display:block;font-size:9.5px;font-weight:700;margin-top:2px}",
      ".ssp-cap.khop .ssp-noi{color:#1e8e3e}.ssp-cap.lech .ssp-noi{color:#d93025}.ssp-cap.nghi .ssp-noi{color:#b06000}.ssp-cap.dain .ssp-noi{color:#5f6368}",
      ".ssp-ben{display:flex;gap:8px;align-items:center;min-width:0}",
      ".ssp-anh-ds{display:flex;gap:4px;flex:none}",
      ".ssp-anh{width:" + ANH_RONG + "px;height:" + Math.round(ANH_RONG * 1.41) + "px;border:1px solid #bbb;background:#fff;border-radius:3px;cursor:zoom-in;display:block}",
      ".ssp-the{width:" + ANH_RONG + "px;height:" + Math.round(ANH_RONG * 1.41) + "px;flex:none;border:1px solid #bbb;background:#fff;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:22px;color:#5f6368}",
      ".ssp-chu{min-width:0;font-size:12.5px;line-height:1.45}",
      ".ssp-ma{font-family:Consolas,'Courier New',monospace;font-weight:700;font-size:13px;overflow-wrap:anywhere}",
      ".ssp-mo{color:#5f6368}",
      ".ssp-copy{border:1px solid #dadce0;background:#fff;border-radius:5px;padding:0 6px;font-size:11px;cursor:pointer;margin-left:4px;vertical-align:middle;color:#1a73e8;font-family:inherit;font-weight:400}",
      ".ssp-copy.da{background:#1e8e3e;color:#fff;border-color:#1e8e3e}",
      ".ssp-khuyet{flex:1;min-height:" + Math.round(ANH_RONG * 1.41) + "px;border:2px dashed #d93025;border-radius:6px;display:flex;align-items:center;justify-content:center;text-align:center;color:#d93025;font-weight:700;font-size:12.5px;padding:6px;background:#fff}",
      ".ssp-hd{grid-column:1/-1;background:#fff;border-left:4px solid #d93025;padding:5px 9px;font-size:12.5px;border-radius:4px;line-height:1.45}",
      ".ssp-cap.nghi .ssp-hd{border-left-color:#b06000}.ssp-cap.dain .ssp-hd,.ssp-cap.khop .ssp-hd{border-left-color:#9aa0a6}",
      ".ssp-hd .ssp-nut{padding:3px 9px;font-size:12px;margin:3px 4px 0 0}",
      ".ssp-trong{text-align:center;color:#5f6368;padding:16px}",
      // Thanh in
      // Dải nút in GỌN (19/11 khuya): 1 hàng — ô tích xếp chồng · PDF vừa tạo · 2 nút 1 dòng · hướng dẫn ⓘ 1 dòng · nhắc máy in nhỏ
      ".ssp-in{display:flex;flex-wrap:wrap;gap:5px 10px;align-items:center;padding-top:5px}",
      ".ssp-in label{font-size:12px;display:inline-flex;gap:5px;align-items:center;cursor:pointer;white-space:nowrap}",
      ".ssp-o-tich{display:flex;flex-direction:column;gap:0;line-height:1.2}",
      ".ssp-o-tich input{margin:0 2px 0 0;width:13px;height:13px}",
      ".ssp-hai-nut{display:contents}", // từng nút / dòng ⓘ tự xếp hàng như phần tử của dải (nút in ở lại hàng đầu, phần mảnh mới xuống hàng)
      ".ssp-nut-in{border:none;border-radius:7px;padding:6px 12px;font-size:13px;font-weight:700;cursor:pointer;color:#fff;background:#1e8e3e;display:inline-flex;flex-direction:row;align-items:baseline;gap:6px;line-height:1.25;white-space:nowrap;max-width:100%;min-width:0}",
      ".ssp-nut-in small{font-weight:400;font-size:11px;opacity:.95;overflow:hidden;text-overflow:ellipsis;max-width:190px;display:inline-block;vertical-align:bottom}",
      ".ssp-nut-in.don{background:#1a73e8}",
      ".ssp-nut-in:disabled{background:#9aa0a6;cursor:not-allowed}",
      ".ssp-tat-ca{background:none;border:none;color:#d93025;text-decoration:underline;cursor:pointer;font-size:12.5px;font-family:inherit;padding:2px 0}",
      ".ssp-ly-do{flex:1 1 260px;min-width:0;font-size:12px;color:#3c4043;background:#fff;border:1px dashed #9aa0a6;border-radius:6px;padding:3px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}",
      ".ssp-ly-do::before{content:'ⓘ ';color:#1a73e8;font-weight:700}",
      ".ssp-ly-do.mo{white-space:normal;flex-basis:100%}",
      ".ssp-ly-do:not(.mo) br,.ssp-ly-do.mo .ssp-ngat{display:none}",
      // Điện thoại (≤ 600px): nút in được xuống dòng, trải hết bề ngang — không tràn
      "@media (max-width:600px){.ssp-nut-in{white-space:normal;flex:1 1 100%;justify-content:center;flex-wrap:wrap;text-align:center}.ssp-nut-in small{max-width:none;white-space:normal}.ssp-in label,.ssp-nhac{white-space:normal}}",
      ".ssp-nhac{font-size:11px;color:#8a5a00;white-space:nowrap}",
      // Kết quả "PDF phiếu vừa tạo" = 1 dòng chữ nhỏ CÙNG HÀNG 2 nút in (19/11 khuya — không chiếm dòng riêng)
      ".ssp-ket-qua{display:inline-flex;flex-wrap:wrap;align-items:center;gap:4px 6px;font-size:12px;color:#3c4043}",
      ".ssp-ket-qua:empty{display:none}",
      ".ssp-ket-qua a{font-size:12px;padding:2px 8px;border:1px solid #dadce0;border-radius:6px;background:#fff;color:#1a73e8;text-decoration:none;white-space:nowrap;font-weight:600}",
      ".ssp-ket-qua a:hover{background:#e8f0fe}",
      // Hộp thoại + xem ảnh to
      ".ssp-phu{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px;z-index:99999}",
      ".ssp-hop{background:#fff;border-radius:12px;max-width:480px;width:100%;max-height:90vh;overflow:auto;padding:16px;border-top:6px solid #1a73e8;font-size:13.5px;color:#202124;line-height:1.5}",
      ".ssp-hop.loi{border-top-color:#d93025}.ssp-hop.vang{border-top-color:#f0b400}",
      ".ssp-hop h3{margin:0 0 8px;font-size:16px}",
      ".ssp-hop.loi h3{color:#d93025}",
      ".ssp-hop ul{margin:4px 0;padding-left:18px;max-height:200px;overflow:auto}",
      ".ssp-hop .ssp-hang-nut{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:12px}",
      ".ssp-hop .ssp-nut.chinh{background:#1a73e8;border-color:#1a73e8;color:#fff}",
      ".ssp-hop .ssp-nut.do{background:#d93025;border-color:#d93025;color:#fff}",
      ".ssp-hop .ssp-nut.xanh{background:#1e8e3e;border-color:#1e8e3e;color:#fff}",
      ".ssp-do-dam{background:#fce8e6;border:1px solid #d93025;border-radius:6px;padding:6px 9px;color:#7a1c14;margin:6px 0}",
      ".ssp-xem-to{background:#fff;border-radius:8px;padding:8px;max-width:100%;max-height:94vh;display:flex;flex-direction:column;font-size:13px;color:#202124}",
      ".ssp-xem-dau{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;padding-bottom:6px}",
      ".ssp-xem-dau .ssp-nut{padding:4px 10px}",
      ".ssp-xem-than{overflow:auto;min-height:0;flex:1 1 auto}",
      ".ssp-xem-than canvas{display:block;margin:0 auto;border:1px solid #ccc}",
      ".ssp-nut-in.do:not(:disabled){background:#d93025}",
      ".ssp-ma-nho{font-family:Consolas,'Courier New',monospace}",
      ".ssp-nhan-ma{font-family:inherit;font-weight:400;color:#5f6368;font-size:12px}",
      ".ssp-xoa-so{font-weight:400;font-size:12px;padding:4px 9px;color:#5f6368}",
      // IN LẠI (19/11 tối): màu TÍM — cặp đã in lại, bộ lọc, 2 nút In lại
      ".ssp-kl.tim{background:#f3e8fd;border:2px solid #8430ce;color:#4a1a73}",
      ".ssp-loc button.l-tim .ssp-so{background:#8430ce;color:#fff}",
      ".ssp-cap.lai{border-color:#8430ce;box-shadow:inset 5px 0 0 #8430ce;opacity:1}",
      ".ssp-cap.lai .ssp-hd{border-left-color:#8430ce}",
      ".ssp-lai-dong{color:#6a1fb0;font-weight:700}",
      ".ssp-chon-lai{display:inline-flex;align-items:center;gap:4px;font-weight:700;color:#6a1fb0;cursor:pointer;margin-right:8px;border:1px solid #c6a5ef;background:#faf5ff;border-radius:5px;padding:1px 7px}",
      ".ssp-nut-in.tim:not(:disabled){background:#8430ce}",
      ".ssp-tat-ca.tim{color:#6a1fb0}",
      // THU GỌN (19/11 tối): ô chỉ còn 1 dòng — tên ngắn + các con số chính + nút Mở rộng; mọi phần khác ẩn
      ".ssp-tom,.ssp-td-ngan{display:none}",
      // DANH SÁCH FILE PDF (cộng dồn nhiều file cho 1 lần in)
      ".ssp-file-goc{position:relative;display:inline-flex;min-width:0}",
      ".ssp-nut-file{max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      // File không khớp tờ đơn nào (có thể lạc từ phiên trước) / file lỗi → ĐỎ CHÓI (chủ dự án 19/11 khuya: cảnh báo phải thật mạnh)
      ".ssp-nut-file.f-canh{background:#d93025;border-color:#a50e0e;color:#fff;font-weight:700;box-shadow:0 0 0 2px #fce8e6}",
      ".ssp-nut-file.f-canh:hover{background:#b3261e}",
      ".ssp-ds-file{position:fixed;z-index:60;display:flex;flex-direction:column;gap:5px;padding:10px;background:#f6f9fb;border:1px solid #c4c7cc;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.25);overflow:auto;width:min(560px,calc(100vw - 16px))}",
      ".ssp-ds-file[hidden]{display:none!important}",
      ".ssp-bao-nhanh{position:fixed;z-index:61;background:#202124;color:#fff;font-size:12px;border-radius:8px;padding:6px 10px;max-width:min(420px,calc(100vw - 16px));box-shadow:0 4px 12px rgba(0,0,0,.25);pointer-events:none}",
      ".ssp-bao-nhanh[hidden]{display:none!important}",
      ".ssp-ds-file-dau{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:12px;color:#5f6368}",
      ".ssp-file{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;background:#fff;border:1px solid #dadce0;border-radius:8px;padding:5px 8px;font-size:12px}",
      ".ssp-file-ten{font-weight:600;color:#202124;min-width:0;overflow-wrap:anywhere;flex:1 1 180px}",
      ".ssp-file-so{color:#5f6368;white-space:nowrap}",
      ".ssp-file.f-cu{border:2px solid #d93025;background:#fce8e6}",
      ".ssp-file.f-loi{border-color:#d93025;background:#fce8e6}",
      ".ssp-file-canh{flex-basis:100%;color:#b3261e;font-weight:700}",
      ".ssp-file.f-loi .ssp-file-canh{color:#b3261e}",
      ".ssp-bo-file{border:1px solid #dadce0;background:#fff;border-radius:6px;padding:2px 8px;font-size:12px;cursor:pointer;color:#b3261e;font-weight:600;white-space:nowrap}",
      ".ssp-bo-file:hover{background:#fce8e6}",
      ".ssp-bao-file{font-size:12px;border-radius:6px;padding:4px 8px;background:#e8f0fe;color:#174ea6}",
      ".ssp-goi-y-them{font-size:12px;border-radius:6px;padding:5px 8px;background:#fef7e0;border:1px solid #f0b400;color:#5c4400}",
      ".ssp-khung.ssp-gon .ssp-file-goc,.ssp-khung.ssp-gon .ssp-ds-file{display:none!important}",
      ".ssp-khung.ssp-gon .ssp-cuon,.ssp-khung.ssp-gon .ssp-day,.ssp-khung.ssp-gon .ssp-tt,.ssp-khung.ssp-gon .ssp-xoa-so,.ssp-khung.ssp-gon .ssp-chon-pdf,.ssp-khung.ssp-gon .ssp-td-dai{display:none!important}",
      ".ssp-khung.ssp-gon .ssp-td-ngan{display:inline}",
      ".ssp-khung.ssp-gon .ssp-hang{padding:5px 10px;flex-wrap:nowrap}",
      ".ssp-khung.ssp-gon .ssp-tom{display:flex;flex:1;min-width:0;flex-wrap:wrap;gap:4px 6px;align-items:center}",
      ".ssp-tom span{border:1px solid #dadce0;background:#fff;border-radius:10px;padding:1px 8px;font-size:12px;font-weight:600;white-space:nowrap}",
      ".ssp-tom .t-xanh{border-color:#a8dab5;color:#0d5224}.ssp-tom .t-do{border-color:#d93025;color:#d93025;background:#fce8e6}",
      ".ssp-tom .t-vang{border-color:#f0b400;color:#5c4400;background:#fef7e0}.ssp-tom .t-tim{border-color:#8430ce;color:#6a1fb0;background:#faf5ff}",
      ".ssp-tom .t-xam{color:#5f6368}",
      // Bên nào được in lại thì bên đó viền tím + nhãn "↻ ĐÃ IN LẠI" (19/11 tối — tách rõ tờ đơn / phiếu)
      ".ssp-ben.ben-lai{outline:2px solid #8430ce;outline-offset:2px;border-radius:6px;background:#faf5ff}",
      ".ssp-chip-lai{display:inline-block;margin-top:3px;background:#8430ce;color:#fff;font-weight:700;font-size:11px;border-radius:4px;padding:1px 6px;font-family:inherit}",
      "@media (max-width:600px){",
      "  .ssp-khung{margin:8px 6px 0}",
      "  .ssp-dau{display:none}",
      "  .ssp-cap{grid-template-columns:24px minmax(0,1fr) 30px minmax(0,1fr);gap:5px;padding:6px}",
      "  .ssp-anh,.ssp-the{width:44px;height:62px}",
      "  .ssp-ben{flex-direction:column;align-items:flex-start;gap:4px}",
      "  .ssp-chu{font-size:11.5px}.ssp-ma{font-size:12px}",
      "  .ssp-noi{font-size:17px}",
      "  .ssp-khuyet{min-height:62px;font-size:11.5px;width:100%}",
      "  .ssp-nut-in{min-width:0;flex:1}",
      "  .ssp-tat-ca.tim{flex-basis:100%;text-align:left}",
      "  .ssp-khung.ssp-gon .ssp-hang{flex-wrap:wrap;justify-content:space-between}",
      "  .ssp-khung.ssp-gon .ssp-tom{order:3;flex-basis:100%}",
      "  .ssp-tom span{white-space:normal}",
      "}",
      "@media print{.ssp-khung,.ssp-phu{display:none!important}.ssp-an-in{display:none!important}}",
    ].join("\n");
    document.head.appendChild(css);

    // ── Khung ──
    const khung = document.createElement("section");
    khung.id = "ssp-khung";
    khung.className = "ssp-khung no-print";
    khung.setAttribute("aria-label", "Đối chiếu phiếu đóng gói PDF với tờ đơn lấy hàng");
    khung.innerHTML =
      '<div class="ssp-hang">' +
        '<span class="ssp-tieu-de"><span class="ssp-td-dai">📦 Phiếu đóng gói (PDF) — đối chiếu với tờ đơn lấy hàng</span><span class="ssp-td-ngan">📦 Phiếu đóng gói</span></span>' +
        '<span class="ssp-tom" id="ssp-tom"></span>' +
        '<label class="ssp-nut ssp-chon-pdf" title="Chọn file PDF phiếu của sàn — chọn nhiều file 1 lần, hoặc thêm từng file (các file được CỘNG DỒN)"><span id="ssp-chon-chu">📄 Chọn / kéo thả PDF</span><input type="file" id="ssp-file" accept="application/pdf,.pdf" multiple hidden></label>' +
        '<span class="ssp-file-goc" id="ssp-file-goc" hidden><button type="button" class="ssp-nut ssp-nut-file" id="ssp-nut-file" data-lam="mo-ds-file" aria-expanded="false" title="Xem danh sách file PDF đã đưa vào (bỏ file, bỏ hết)">📎</button></span>' +
        '<div class="ssp-ds-file" id="ssp-ds-file" hidden role="dialog" aria-label="Danh sách file PDF đã đưa vào"></div>' +
        '<div class="ssp-bao-nhanh" id="ssp-bao-nhanh" hidden></div>' +
        '<span class="ssp-tt" id="ssp-tt">Kéo file PDF phiếu của sàn (Shopee, TikTok…) vào ô này → đối chiếu từng cặp với tờ đơn bên dưới. File chỉ xử lý trên máy này.</span>' +
        '<button type="button" class="ssp-nut ssp-xoa-so" id="ssp-xoa-so" data-lam="xoa-so" hidden title="Xóa sổ ghi nhớ các đơn đã in trên máy này">🗑 Xóa sổ đã in</button>' +
        '<button type="button" class="ssp-nut" id="ssp-thu-gon" hidden>Thu gọn ▴</button>' +
      "</div>" +
      '<div class="ssp-cuon" id="ssp-cuon">' +
        '<div id="ssp-kl"></div>' +
        '<div id="ssp-vung-ds" hidden>' +
          '<div class="ssp-loc" id="ssp-loc"></div>' +
          '<div class="ssp-ds" id="ssp-ds"></div>' +
        "</div>" +
      "</div>" +
      '<div class="ssp-day" id="ssp-day" hidden>' +
          '<div class="ssp-in">' +
            '<div class="ssp-o-tich">' +
              '<label title="Thêm phiếu KHÔNG có tờ đơn (chưa in) vào CUỐI file phiếu khi bấm ②"><input type="checkbox" id="ssp-thua" checked> <span>Thêm phiếu <b>không có tờ đơn</b> vào cuối</span></label>' +
              '<label title="Bật khi 2 máy in xếp giấy ra ngược chiều nhau"><input type="checkbox" id="ssp-dao"> <span>Đảo ngược thứ tự phiếu</span></label>' +
              '<span class="ssp-nhac" title="Trong hộp in của trình duyệt, kiểm tra đúng tên máy in trước khi bấm In — trình duyệt hay nhớ máy in của lần trước.">⚠ Kiểm tra đúng <b>tên máy in</b> trong hộp in</span>' +
            "</div>" +
            '<span class="ssp-ket-qua" id="ssp-ket-qua"></span>' +
            '<div class="ssp-hai-nut" id="ssp-hai-nut"></div>' +
          "</div>" +
      "</div>";
    sheet3.insertBefore(khung, than);
    const $ = function (id) { return document.getElementById(id); };

    const tt = { file: [], trang: [], dangDoc: false, url: null, loc: "tat", xacNhan: new Set(), kq: null, io: null, chon: null, tatCa: false, chonLai: new Set(), chonLaiKq: null };
    let L = null;
    let dangInCuaToi = false; // true trong lúc chính ô này gọi lệnh in tờ đơn (để phân biệt với nút In đơn gốc / Ctrl+P)

    // Sổ đã in (so_da_in.js) — nạp ngay (file nhỏ) để canh nút In đơn gốc cả khi chưa kéo PDF
    const SO_RONG = { lamMoi: function () {}, don: function () { return 0; }, phieu: function () { return 0; }, vanTay: function () { return 0; }, cacMa: function () { return []; },
      viTriDon: function () { return 0; }, viTriPhieu: function () { return 0; }, soMuc: function () { return 0; }, choPhieu: function () { return []; },
      inLaiDon: function () { return []; }, inLaiPhieu: function () { return []; }, ghiInLai: function () {},
      ghiDon: function () {}, ghiPhieu: function () {}, xoaHet: function () {}, luuDuoc: function () { return false; } };
    const so = function () { return window.SoDaIn || SO_RONG; };
    function napScript(ten) {
      return new Promise(function (xong, loi) {
        const s = document.createElement("script");
        s.src = goc + ten;
        s.onload = function () { xong(); };
        s.onerror = function () { loi(new Error("Không tải được " + ten)); };
        document.head.appendChild(s);
      });
    }
    if (!window.SoDaIn) napScript("so_da_in.js").then(function () { tinh(); }).catch(function (e) { console.error("[SapXepPhieu]", e); });
    function napLoi() {
      if (window.SapXepPhieuLoi) { L = window.SapXepPhieuLoi; return Promise.resolve(); }
      return napScript("loi_sap_xep.js").then(function () { L = window.SapXepPhieuLoi; if (!L) throw new Error("lõi không khởi tạo"); });
    }

    // ── Tờ đơn trên màn hình (đúng thứ tự in) ──
    const maCuaBox = function (box) { const m = /📦 ĐƠN: ([^\n]*)/.exec(box.getAttribute("data-copy-text") || ""); return m ? m[1] : ""; };
    function thuTuToDon() {
      const ds = [], theo = {};
      Array.prototype.forEach.call(vungIn.querySelectorAll(".invoice-box"), function (box) {
        const hien = maCuaBox(box).trim(), k = kd(hien);
        if (!k) return;
        if (theo[k]) { theo[k].box.push(box); return; }
        const mon = box.querySelectorAll("table.inv-table tbody tr").length;
        theo[k] = { k: k, hien: hien, so: ds.length + 1, mon: mon, box: [box] };
        ds.push(theo[k]);
      });
      return { ds: ds, ma: ds.map(function (x) { return x.k; }), theo: theo };
    }
    // Mã hàng (MISA đã tải sẵn trên trang Vận Hành) → "mã đơn" là mã hàng / lỗi công thức thì KHÔNG dùng để ghép / ghi sổ
    let boMaHang = null, coMaHang = -1;
    function maDonLa(k) {
      const misa = window.MISA_DIRECTORY;
      if (misa && typeof misa === "object") {
        const n = Object.keys(misa).length;
        if (n !== coMaHang) { boMaHang = new Set(Object.keys(misa).map(kd)); coMaHang = n; }
      }
      return /^#/.test(k) || !!(boMaHang && boMaHang.has(k));
    }

    async function docFile(dsFile) {
      const ds = Array.prototype.slice.call(dsFile).filter(function (f) { return /\.pdf$/i.test(f.name) || f.type === "application/pdf"; });
      if (!ds.length) { $("ssp-tt").textContent = "Hãy chọn file PDF."; return; }
      tt.dangDoc = true;
      tinh();
      $("ssp-tt").innerHTML = "⏳ Đang đọc " + ds.length + " file PDF…";
      try {
        await napLoi();
        const kq = await L.docPdf(ds); // đọc XONG toàn bộ mới trả về
        // CỘNG DỒN vào các file đã có (19/11): file mới nối sau; trang GIỐNG HỆT trang đã có (cùng dấu vân tay) → bỏ qua
        const daCo = new Set(tt.trang.map(function (t) { return t.vt; }));
        const bao = [];
        kq.file.forEach(function (muc, fi) {
          const cuaFile = kq.trang.filter(function (t) { return t.f === fi; });
          const moi = cuaFile.filter(function (t) { return !t.vt || !daCo.has(t.vt); });
          if (cuaFile.length && !moi.length) { bao.push("📄 " + esc(muc.ten) + ": trùng hoàn toàn với file đã có → <b>bỏ qua</b>"); L.dongAnh([muc]); return; }
          const so = tt.file.length;
          tt.file.push(muc);
          moi.forEach(function (t) { t.f = so; daCo.add(t.vt); tt.trang.push(t); });
          if (moi.length < cuaFile.length) bao.push("📄 " + esc(muc.ten) + ": bỏ qua <b>" + (cuaFile.length - moi.length) + "</b> trang trùng với file đã có");
        });
        tt.baoFile = bao;
        tt.tatCa = false;
      } catch (e) {
        console.error("[SapXepPhieu] Không đọc được PDF:", e);
        tt.baoFile = ["Chưa tải được bộ đọc PDF — kiểm tra mạng rồi thử lại. Các file đã có vẫn giữ nguyên."];
      }
      tt.dangDoc = false;
      tinh();
    }

    // Vẽ ảnh thu nhỏ bị HỦY (bỏ file / vẽ lại khi đang vẽ dở) là bình thường — không báo lỗi
    function loiVeAnh(e) { if (e && e.name === "RenderingCancelledException") return; console.error("[SapXepPhieu] Không vẽ được ảnh trang:", e); }
    function boFile(fi) {
      const muc = tt.file[fi];
      if (!muc) return;
      L && L.dongAnh([muc]);
      tt.file.splice(fi, 1);
      tt.trang = tt.trang.filter(function (t) { return t.f !== fi; });
      tt.trang.forEach(function (t) { if (t.f > fi) t.f -= 1; });
      tt.baoFile = ["Đã bỏ file " + esc(muc.ten)];
      tt.tatCa = false;
      tinh();
    }
    function boHetFile() {
      L && L.dongAnh(tt.file);
      tt.file = []; tt.trang = []; tt.baoFile = []; tt.tatCa = false;
      $("ssp-tt").innerHTML = "Kéo file PDF phiếu của sàn (Shopee, TikTok…) vào ô này → đối chiếu từng cặp với tờ đơn bên dưới. File chỉ xử lý trên máy này.";
      tinh();
    }
    // Danh sách file đã đưa vào: số trang, số trang khớp tờ đơn hiện tại; file KHÔNG khớp tờ đơn nào → cảnh báo (có thể là file của phiên trước)
    function veDsFile(kq) {
      const hop = $("ssp-ds-file");
      $("ssp-chon-chu").textContent = tt.file.length ? "➕ Thêm file PDF" : "📄 Chọn / kéo thả PDF";
      baoNhanh();
      if (!tt.file.length) { $("ssp-file-goc").hidden = true; dongDsFile(); hop.innerHTML = ""; return; }
      const s = so(), coTo = kq && kq.td && kq.td.ds.length > 0;
      const khop = new Set();
      if (kq && kq.cap) kq.cap.forEach(function (x) { (x.ds || []).forEach(function (i) { khop.add(i); }); });
      let soCu = 0;
      const dong = tt.file.map(function (m, fi) {
        const cua = []; tt.trang.forEach(function (t, i) { if (t.f === fi) cua.push(i); });
        const nKhop = cua.filter(function (i) { return khop.has(i); }).length;
        const nDaIn = cua.filter(function (i) { return s.vanTay(tt.trang[i].vt); }).length;
        let lop = "", canh = "";
        if (m.loi) { lop = " f-loi"; canh = "✗ " + esc(m.loi); }
        else if (!cua.length) { lop = " f-loi"; canh = "✗ không có trang nào"; }
        else if (coTo && !nKhop) {
          lop = " f-cu"; soCu++;
          canh = nDaIn === cua.length ? "⚠ Không khớp tờ đơn nào của lần in hiện tại và ĐÃ IN XONG — có thể là file của phiên trước → nên bấm ✕ Bỏ file này"
            : "⚠ Không khớp tờ đơn nào của lần in hiện tại — có thể là file của phiên trước → kiểm tra rồi bấm ✕ Bỏ file này";
        }
        return '<div class="ssp-file' + lop + '"><span class="ssp-file-ten">📄 ' + esc(m.ten) + "</span>" +
          '<span class="ssp-file-so">' + cua.length + " trang" + (coTo ? " · khớp <b>" + nKhop + "</b>" : "") + (nDaIn ? " · đã in " + nDaIn : "") + "</span>" +
          '<button type="button" class="ssp-bo-file" data-lam="bo-file" data-fi="' + fi + '" title="Bỏ file này khỏi phiên đối chiếu">✕ Bỏ file này</button>' +
          (canh ? '<span class="ssp-file-canh">' + canh + "</span>" : "") + "</div>";
      });
      const soLoi = tt.file.filter(function (m, fi) { return m.loi || !tt.trang.some(function (t) { return t.f === fi; }); }).length;
      const nut = $("ssp-nut-file");
      $("ssp-file-goc").hidden = false;
      nut.classList.toggle("f-canh", !!(soCu || soLoi));
      nut.textContent = "📎 " + (tt.file.length === 1 ? tt.file[0].ten : tt.file.length + " file · " + tt.trang.length + " trang") +
        (soCu + soLoi ? " · ⚠" + (soCu + soLoi) : "") + (tt.moDsFile ? " ▴" : " ▾");
      nut.setAttribute("aria-expanded", tt.moDsFile ? "true" : "false");
      hop.innerHTML =
        '<div class="ssp-ds-file-dau"><b>' + tt.file.length + " file PDF · " + tt.trang.length + " trang</b> — các file được CỘNG DỒN, thứ tự đưa vào không quan trọng" +
          (soCu ? ' · <b style="color:#d93025">⚠ ' + soCu + " file không khớp lần in hiện tại</b>" : "") +
          (tt.file.length > 1 ? '<button type="button" class="ssp-bo-file" data-lam="bo-het-file">✕ Bỏ hết file</button>' : "") + "</div>" +
        dong.join("");
      if (tt.moDsFile) moDsFile(); else hop.hidden = true;
    }
    // Khung nổi: đặt ngay dưới nút 📎, không tràn màn hình, không đẩy bố cục
    function moDsFile() {
      const hop = $("ssp-ds-file"), r = $("ssp-nut-file").getBoundingClientRect();
      hop.hidden = false;
      const rong = hop.offsetWidth;
      hop.style.left = Math.max(8, Math.min(r.left, innerWidth - rong - 8)) + "px";
      hop.style.top = (r.bottom + 4) + "px";
      hop.style.maxHeight = Math.max(160, innerHeight - r.bottom - 16) + "px";
    }
    function dongDsFile() {
      tt.moDsFile = false;
      $("ssp-ds-file").hidden = true;
      const nut = $("ssp-nut-file");
      if (nut) { nut.setAttribute("aria-expanded", "false"); nut.textContent = nut.textContent.replace(/ ▴$/, " ▾"); }
    }
    // Thông báo THOÁNG (đã bỏ qua file trùng, đã bỏ file…) — hiện 5 giây cạnh nút 📎 rồi tự tắt, không chiếm dòng nào
    function baoNhanh() {
      if (!tt.baoFile || !tt.baoFile.length) return;
      const el = $("ssp-bao-nhanh"), moc = $("ssp-file-goc").hidden ? $("ssp-chon-chu") : $("ssp-nut-file");
      el.innerHTML = tt.baoFile.join("<br>");
      tt.baoFile = [];
      el.hidden = false;
      const r = moc.getBoundingClientRect();
      el.style.left = Math.max(8, Math.min(r.left, innerWidth - el.offsetWidth - 8)) + "px";
      el.style.top = (r.bottom + 4) + "px";
      clearTimeout(baoNhanh.h);
      baoNhanh.h = setTimeout(function () { el.hidden = true; }, 5000);
    }

    // ── PHÂN LOẠI ──
    // Cặp (theo tờ đơn): khop (chưa in bên nào) | mot (đã in 1 bên) | dain (đã in đủ 2 bên)
    //                    | thieu (không có phiếu) | nghi (dò dự phòng, chưa xác nhận) | lechcot (mã đơn là mã hàng / lỗi)
    // Phiếu không có tờ đơn: thua (chưa in) | thuadain (đã in — bỏ qua)
    const NHOM_CAN = { thieu: 1, nghi: 1, lechcot: 1, thua: 1 };
    const LECH = { thieu: 1, nghi: 1, lechcot: 1 }; // chỉ in khi bật "Vẫn in tất cả (kể cả lệch)"
    function phanLoai() {
      const s = so();
      s.lamMoi();
      const td = thuTuToDon();
      const kq = { td: td, cap: [], thua: [], g: null };
      if (!tt.trang.length || !td.ds.length || !L) return kq;
      const g = L.ghep(td.ma, tt.trang, maDonLa);
      kq.g = g;
      kq.cap = td.ds.map(function (x) {
        const ds = g.trangCua.get(x.k) || [];
        const daDon = s.don(x.k);
        let daPhieu = s.phieu(x.k);
        if (!daPhieu && ds.length && ds.every(function (i) { return s.vanTay(tt.trang[i].vt); })) daPhieu = s.vanTay(tt.trang[ds[0]].vt);
        const doChu = g.doChu.some(function (y) { return y.ma === x.k; });
        let loai;
        if (maDonLa(x.k)) loai = "lechcot";
        else if (daDon && daPhieu) loai = "dain";
        else if (daDon || daPhieu) loai = "mot";
        else if (!ds.length) loai = "thieu";
        else if (doChu && !tt.xacNhan.has(x.k)) loai = "nghi";
        else loai = "khop";
        return { k: x.k, hien: x.hien, so: x.so, mon: x.mon, box: x.box, ds: ds, daDon: daDon, daPhieu: daPhieu, doChu: doChu, loai: loai,
          laiD: s.inLaiDon(x.k), laiP: s.inLaiPhieu(x.k) };
      });
      const cacMaSo = s.cacMa().filter(function (k) { return !maDonLa(k); });
      // Từng trang không có tờ đơn → đọc mã đơn trên phiếu → GOM các trang CÙNG MÃ thành 1 mục (1 đơn nhiều trang = 1 dòng)
      const tungTrang = g.thua.map(function (x) { return { i: x.i, nhieu: null }; })
        .concat(g.nhieuMa.map(function (x) { return { i: x.i, nhieu: x.ma }; }))
        .sort(function (a, b) { return a.i - b.i; })
        .map(function (x) {
          const t = tt.trang[x.i];
          let maSo = "";
          for (let j = 0; j < cacMaSo.length; j++) { if (t.cum.has(cacMaSo[j])) { maSo = cacMaSo[j]; break; } }
          return { i: x.i, nhieu: x.nhieu, maSo: maSo, maHien: x.nhieu ? "" : maSo || t.oid || "", vd: t.vd || "" };
        });
      const theoMa = new Map(), nhomThua = [];
      tungTrang.forEach(function (x) {
        if (x.maHien && theoMa.has(x.maHien)) { const n = theoMa.get(x.maHien); n.ds.push(x.i); if (!n.vd && x.vd) n.vd = x.vd; if (!n.maSo && x.maSo) n.maSo = x.maSo; return; }
        const n = { i: x.i, ds: [x.i], nhieu: x.nhieu, maSo: x.maSo, maHien: x.maHien, vd: x.vd };
        if (x.maHien) theoMa.set(x.maHien, n); // KHÔNG đọc được mã → không gom (không đoán)
        nhomThua.push(n);
      });
      kq.thua = nhomThua.map(function (n) {
        const vtIn = n.ds.map(function (i) { return s.vanTay(tt.trang[i].vt); });
        const daIn = (n.maSo ? s.phieu(n.maSo) : 0) || (vtIn.every(Boolean) ? vtIn[0] : 0); // đã in đủ mọi trang của đơn
        // lịch sử in lại: khóa theo đơn + khóa cũ theo từng trang (sổ ghi trước khi gom) — gộp, bỏ trùng
        const laiP = [];
        [khoaSoThua(n)].concat(n.ds.map(function (i) { return "#vt:" + tt.trang[i].vt; })).forEach(function (k) {
          s.inLaiPhieu(k).forEach(function (g) { if (laiP.indexOf(g) < 0) laiP.push(g); });
        });
        return { i: n.i, ds: n.ds, nhieu: n.nhieu, maSo: n.maSo, maHien: n.maHien, vd: n.vd, daIn: daIn, daInDon: n.maSo ? s.don(n.maSo) : 0,
          loai: daIn ? "thuadain" : "thua", laiD: [], laiP: laiP.sort() };
      });
      return kq;
    }
    // Bộ lọc: [mã, chữ, màu số đếm, điều kiện]. Nhóm nào 0 dòng thì tự ẩn (trừ Tất cả).
    const LOC = [
      ["tat", "Tất cả", "", function () { return true; }],
      ["khop", "✓ Khớp — chưa in đủ", "l-xanh", function (x) { return x.loai === "khop" || x.loai === "mot"; }],
      ["mot", "½ In 1 bên", "l-vang", function (x) { return x.loai === "mot"; }],
      ["can", "⚠ Cần xử lý", "l-do", function (x) { return !!NHOM_CAN[x.loai]; }],
      ["thieu", "Thiếu phiếu đóng gói", "l-do", function (x) { return x.loai === "thieu"; }],
      ["thua", "Phiếu không có tờ đơn", "l-do", function (x) { return x.loai === "thua"; }],
      ["nghi", "Nghi ngờ — kiểm lại", "l-vang", function (x) { return x.loai === "nghi"; }],
      ["lechcot", "Mã hàng / lỗi Bảng 3", "l-do", function (x) { return x.loai === "lechcot"; }],
      ["dain", "🖨 Đã in", "l-xam", function (x) { return x.loai === "dain" || x.loai === "thuadain"; }],
      ["lai", "↻ Đã in lại", "l-tim", function (x) { return coLai(x); }],
      // 3 nhóm con TÁCH RỜI (cộng lại = "Đã in lại"): chỉ tờ đơn / chỉ phiếu / cả 2 bên
      ["laid", "↻ Chỉ in lại tờ đơn", "l-tim", function (x) { return !!(x.laiD && x.laiD.length && !(x.laiP && x.laiP.length)); }],
      ["laip", "↻ Chỉ in lại phiếu", "l-tim", function (x) { return !!(x.laiP && x.laiP.length && !(x.laiD && x.laiD.length)); }],
      ["lai2", "↻ In lại cả 2 bên", "l-tim", function (x) { return !!(x.laiD && x.laiD.length && x.laiP && x.laiP.length); }],
    ];
    const LOC_IN_LAI = { dain: 1, lai: 1, laid: 1, laip: 1, lai2: 1 }; // các bộ lọc mà 2 nút = 2 nút IN LẠI
    const tenLoc = function (m) { return (LOC.find(function (l) { return l[0] === m; }) || LOC[0])[1]; };
    // Nhãn tím đặt NGAY bên được in lại (phiếu: cột trái · tờ đơn: cột phải)
    const chipLai = function (ds) { return ds && ds.length ? '<div><span class="ssp-chip-lai">↻ ĐÃ IN LẠI ' + (ds.length > 1 ? ds.length + " lần · " : "") + ds.map(gio).join(", ") + "</span></div>" : ""; };
    const lopBen = function (ds) { return ds && ds.length ? "ssp-ben ben-lai" : "ssp-ben"; };
    // ── IN LẠI (19/11 tối) ── sổ ghi riêng từng lần in lại; bộ lọc "Đã in" / "Đã in lại": tích chọn → 2 nút thành "In lại"
    const coLai = function (x) { return !!((x.laiD && x.laiD.length) || (x.laiP && x.laiP.length)); };
    const khoaChon = function (x) { return x.so ? x.k : "#t" + x.i; };                         // khóa tích chọn trên màn hình
    const khoaSoThua = function (x) { return x.maSo || (x.maHien ? "#ma:" + x.maHien : "#vt:" + tt.trang[x.i].vt); }; // khóa ghi sổ in lại cho phiếu không có tờ đơn (theo ĐƠN)
    const choChonLai = function (x) { return x.so ? !!(x.daDon || (x.daPhieu && x.ds.length)) : x.loai === "thuadain"; };
    const LAI_NGUONG_CAP = 15, LAI_NGUONG_TL = 0.2; // cảnh báo khi phiên có từ 15 cặp hoặc từ 20% phiên phải in lại
    const dongLai = function (x) {
      const p = [];
      if (x.laiD && x.laiD.length) p.push("tờ đơn " + x.laiD.length + " lần (" + x.laiD.map(gio).join(", ") + ")");
      if (x.laiP && x.laiP.length) p.push("phiếu " + x.laiP.length + " lần (" + x.laiP.map(gio).join(", ") + ")");
      return p.length ? '<div class="ssp-lai-dong">↻ Đã in lại ' + p.join(" · ") + "</div>" : "";
    };
    const locHienTai = function () { return (LOC.find(function (l) { return l[0] === tt.loc; }) || LOC[0])[3]; };

    // ── VẼ ──
    function tinh() {
      try { veLai(); } catch (e) { console.error("[SapXepPhieu] Lỗi vẽ ô đối chiếu:", e); }
    }
    // Hiện / ẩn danh sách cặp + dải nút in. "Thu gọn" (lớp ssp-gon): CSS ẩn hết, chỉ còn dòng tóm tắt #ssp-tom.
    function hienDs(co) {
      $("ssp-vung-ds").hidden = !co || khung.classList.contains("ssp-gon");
      $("ssp-day").hidden = !co;
    }
    function veNutXoaSo() {
      const s = so(), b = $("ssp-xoa-so"), n = new Set(s.cacMa()).size;
      b.hidden = !s.soMuc();
      b.textContent = "🗑 Xóa sổ đã in" + (n ? " (" + n + " mã)" : "");
    }
    // Trang chưa có tờ đơn (vd vừa F5) nhưng sổ có đơn ĐÃ IN TỜ ĐƠN, CHƯA IN PHIẾU và phiếu có trong file PDF → in phiếu được ngay
    function phieuChoSauF5() {
      const s = so();
      if (!L || !tt.trang.length) return { dsK: [] };
      const cho = s.choPhieu().filter(function (k) { return !maDonLa(k); });
      if (!cho.length) return { dsK: [] };
      const g = L.ghep(cho, tt.trang, maDonLa);
      const dsK = cho.filter(function (k) { return (g.trangCua.get(k) || []).length; });
      return { dsK: dsK };
    }
    function veLai() {
      veNutXoaSo();
      if (tt.dangDoc) { boGon(); hienDs(false); $("ssp-kl").innerHTML = ""; $("ssp-thu-gon").hidden = true; dongDsFile(); return; }
      const kq = phanLoai();
      tt.kq = kq;
      try { veDsFile(kq); } catch (e) { console.error("[SapXepPhieu] Lỗi vẽ danh sách file:", e); }
      const td = kq.td, s = so();
      const klHtml = [];
      if (!tt.trang.length) {
        const daInTo = td.ds.filter(function (x) { return s.don(x.k); });
        if (daInTo.length) {
          klHtml.push('<div class="ssp-kl loi"><span class="ssp-bt">⛔</span><div><b class="ssp-kl-td">' + daInTo.length + "/" + td.ds.length +
            " tờ đơn đang có ĐÃ IN trước đó</b>Nút In đơn sẽ in TRÙNG các tờ này. Kéo PDF phiếu vào để in đúng phần chưa in: " +
            '<span class="ssp-ma">' + daInTo.slice(0, 10).map(function (x) { return "Tờ " + x.so + " " + esc(x.hien) + " (" + gio(s.don(x.k)) + ")"; }).join(" · ") + (daInTo.length > 10 ? " …" : "") + "</span></div></div>");
        }
        if (tt.file.length) {
          klHtml.push('<div class="ssp-kl loi"><span class="ssp-bt">⚠</span><div>' + tt.file.map(function (m) { return esc(m.ten) + ": " + esc(m.loi || "không có trang"); }).join(" · ") + "</div></div>");
        }
        $("ssp-kl").innerHTML = klHtml.join("");
        boGon(); hienDs(false); $("ssp-thu-gon").hidden = true;
        return;
      }
      const tenFile = tt.file.length > 1 ? tt.file.length + " file" : tt.file.map(function (m) { return esc(m.ten) + (m.loi ? " (✗ " + esc(m.loi) + ")" : ""); }).join(", ");
      $("ssp-tt").innerHTML = "📄 " + tenFile + " — <b>" + tt.trang.length + " trang</b> · <b>" + td.ds.length + "</b> tờ đơn";
      $("ssp-thu-gon").hidden = false;
      const tomTrang = "<span>📄 " + tt.trang.length + " trang · " + td.ds.length + " tờ</span>";
      if (!td.ds.length) {
        const f5 = phieuChoSauF5();
        if (f5.dsK.length) {
          // Đã in tờ đơn (vd rồi F5): KHÔNG cần Tạo mẫu in lại — chỉ cần PDF là in được phiếu đúng các đơn đã in, đúng thứ tự xấp
          klHtml.push('<div class="ssp-kl xam"><span class="ssp-bt">ℹ</span><div>Trang chưa có tờ đơn (vd vừa F5) — <b>không cần Tạo mẫu in lại</b>: bấm <b>② In PHIẾU ĐÓNG GÓI</b> bên dưới là in đúng phiếu của ' +
            f5.dsK.length + " đơn đã in tờ đơn (lúc " + gio(s.don(f5.dsK[0])) + "), đúng thứ tự xấp tờ đơn.</div></div>");
          $("ssp-kl").innerHTML = klHtml.join("");
          $("ssp-vung-ds").hidden = true; $("ssp-day").hidden = false;
          tt.f5 = f5;
          $("ssp-tom").innerHTML = tomTrang + '<span class="t-vang">② chờ in ' + f5.dsK.length + " phiếu — Mở rộng để in</span>";
          $("ssp-hai-nut").innerHTML =
            '<button type="button" class="ssp-nut-in don" disabled>🖨 ① In TỜ ĐƠN LẤY HÀNG<small>cần Tạo mẫu in trước</small></button>' +
            '<button type="button" class="ssp-nut-in" data-lam="in-phieu-f5">🏷 ② In ' + f5.dsK.length + " PHIẾU ĐÓNG GÓI<small>các đơn đã in tờ đơn · đúng thứ tự xấp · máy in giấy keo</small></button>" +
            '<div class="ssp-ly-do" title="Bấm để xem đủ / thu lại"><b>① xám:</b> trang chưa có tờ đơn — sang tab Tạo Đơn Hàng bấm <b>TẠO MẪU IN ĐƠN</b> nếu cần in tờ đơn.</div>';
          return;
        }
        klHtml.push('<div class="ssp-kl vang"><span class="ssp-bt">ℹ</span><div><b class="ssp-kl-td">Chưa có tờ đơn để đối chiếu</b>Sang tab Tạo Đơn Hàng bấm <b>TẠO MẪU IN ĐƠN</b> — ô này tự đối chiếu lại.</div></div>');
        $("ssp-kl").innerHTML = klHtml.join(""); hienDs(false);
        $("ssp-tom").innerHTML = tomTrang + '<span class="t-vang">Chưa có tờ đơn — Tạo mẫu in</span>';
        return;
      }
      const tatCa = kq.cap.concat(kq.thua);
      const dem = function (f) { return tatCa.filter(f).length; };
      const demLoai = function (l) { return tatCa.filter(function (x) { return x.loai === l; }).length; };
      const soCan = dem(LOC[3][3]);
      const soDaInCap = demLoai("dain"), soKhop = demLoai("khop"), soMot = demLoai("mot"), soThua = demLoai("thua"), soThuaDaIn = demLoai("thuadain");
      if (soMot) {
        klHtml.push('<div class="ssp-kl vang"><span class="ssp-bt">⏳</span><div><b class="ssp-kl-td">' + soMot + " cặp mới in 1 bên — in nốt bên còn lại</b>" +
          "Bấm nút <b>①</b> hoặc <b>②</b> ở đáy ô (bộ lọc <b>Khớp</b> hoặc <b>½ In 1 bên</b>). Bên còn lại in <b>đúng thứ tự xấp đã in</b> → 2 xấp ghép đôi được.</div></div>");
      }
      if (soCan) {
        const li = [];
        if (demLoai("thieu")) li.push("<li><b>" + demLoai("thieu") + "</b> tờ đơn KHÔNG có phiếu đóng gói — nếu phiếu nằm ở <b>file PDF khác</b> (sàn tách file), bấm <b>➕ Thêm file PDF</b>; các file được cộng dồn</li>");
        const trangThua = kq.thua.filter(function (x) { return x.loai === "thua"; }).reduce(function (a, x) { return a + x.ds.length; }, 0);
        if (soThua) li.push("<li><b>" + soThua + "</b> phiếu đóng gói KHÔNG có tờ đơn lấy hàng" + (trangThua > soThua ? " (" + trangThua + " trang — có đơn nhiều trang)" : "") + "</li>");
        if (demLoai("nghi")) li.push("<li><b>" + demLoai("nghi") + "</b> cặp nghi ngờ — cần nhìn lại bằng mắt</li>");
        if (demLoai("lechcot")) li.push("<li><b>" + demLoai("lechcot") + "</b> tờ có \"mã đơn\" là MÃ HÀNG / lỗi — Bảng 3 có thể lệch cột</li>");
        klHtml.push('<div class="ssp-kl loi"><span class="ssp-bt">⛔</span><div><b class="ssp-kl-td">PHIÊN NÀY CÓ BẤT THƯỜNG — xử lý trước khi in phần lệch</b><ul>' + li.join("") + "</ul>" +
          (soKhop + soMot ? "Các cặp <b>KHỚP</b> vẫn in an toàn bằng 2 nút bên dưới. " : "") +
          'Bấm <b>⚠ Cần xử lý</b> để chỉ xem các trường hợp này.</div></div>');
      } else if (!soKhop && !soMot && !soThua) {
        klHtml.push('<div class="ssp-kl tot"><span class="ssp-bt">✅</span><div><b class="ssp-kl-td">PHIÊN ĐÃ IN XONG — ' + soDaInCap + "/" + kq.cap.length + " cặp đã in đủ 2 bên</b>Không còn gì cần in.</div></div>");
      } else if (soDaInCap || soMot) {
        klHtml.push('<div class="ssp-kl tot"><span class="ssp-bt">✅</span><div><b class="ssp-kl-td">KHỚP — đã in đủ ' + soDaInCap + "/" + kq.cap.length + " cặp, còn " + (soKhop + soMot) + " cặp chưa in đủ</b>An toàn để in tiếp phần còn lại.</div></div>");
      } else {
        klHtml.push('<div class="ssp-kl tot"><span class="ssp-bt">✅</span><div><b class="ssp-kl-td">KHỚP HOÀN TOÀN — an toàn để in phiên này</b>' + kq.cap.length + "/" + kq.cap.length + " tờ đơn có phiếu đóng gói · không có phiếu thừa.</div></div>");
      }
      const dsLai = tatCa.filter(coLai);
      if (dsLai.length) {
        const nguong = dsLai.length >= LAI_NGUONG_CAP || dsLai.length >= tatCa.length * LAI_NGUONG_TL;
        klHtml.push('<div class="ssp-kl tim"><span class="ssp-bt">↻</span><div><b class="ssp-kl-td">Phiên này đã in lại ' + dsLai.length + " cặp</b>" +
          "Chỉ tờ đơn: <b>" + dsLai.filter(LOC.find(function (l) { return l[0] === "laid"; })[3]).length +
          "</b> · chỉ phiếu: <b>" + dsLai.filter(LOC.find(function (l) { return l[0] === "laip"; })[3]).length +
          "</b> · cả 2 bên: <b>" + dsLai.filter(LOC.find(function (l) { return l[0] === "lai2"; })[3]).length +
          "</b>. Bấm các bộ lọc <b>↻</b> để xem riêng từng nhóm — bên nào in lại có <b>viền tím + nhãn ↻ ĐÃ IN LẠI</b>; tờ in lại phải thay ĐÚNG CHỖ tờ cũ trong xấp." +
          (nguong ? '<br><b style="color:#d93025">⚠ In lại nhiều — nên kiểm tra nguyên nhân (máy in, giấy, chọn nhầm máy in, sai Bảng 3).</b>' : "") + "</div></div>");
      }
      if (soThuaDaIn) klHtml.push('<div class="ssp-kl xam"><span class="ssp-bt">🖨</span><div><b>' + soThuaDaIn + " phiếu trong file PDF đã in ở lượt trước</b> — bỏ qua, không in lại (lọc <b>Đã in</b> để xem).</div></div>");
      if (!s.luuDuoc()) klHtml.push('<div class="ssp-kl vang"><span class="ssp-bt">⚠</span><div>Trình duyệt này không cho lưu sổ "đã in" — sổ chỉ còn tới khi đóng trang.</div></div>');
      $("ssp-kl").innerHTML = klHtml.join("");
      hienDs(true);
      // Dòng tóm tắt khi Thu gọn: chỉ các con số chính
      const conIn = soKhop + soMot;
      $("ssp-tom").innerHTML = tomTrang +
        (conIn ? '<span class="t-xanh">🖨 Còn ' + conIn + " cặp chưa in đủ — Mở rộng để in</span>" : soCan ? "" : '<span class="t-xanh">✅ Đã in xong</span>') +
        (soCan ? '<span class="t-do">⚠ ' + soCan + " cần xử lý</span>" : "") +
        (soDaInCap ? '<span class="t-xam">Đã in ' + soDaInCap + "/" + kq.cap.length + "</span>" : "") +
        (dsLai.length ? '<span class="t-tim">↻ In lại ' + dsLai.length + "</span>" : "");

      // Bộ lọc (bộ lọc đang chọn hết dòng → về Tất cả)
      if (!LOC.some(function (l) { return l[0] === tt.loc; }) || (tt.loc !== "tat" && !dem(locHienTai()))) { tt.loc = "tat"; tt.tatCa = false; }
      $("ssp-loc").innerHTML = LOC.filter(function (l) { return l[0] === "tat" || dem(l[3]); }).map(function (l) {
        return '<button type="button" data-loc="' + l[0] + '" class="' + l[2] + (tt.loc === l[0] ? " dang" : "") + '">' + l[1] + '<span class="ssp-so">' + dem(l[3]) + "</span></button>";
      }).join("");

      // Danh sách cặp
      const locF = locHienTai();
      const nutCopy = function (m) { return '<button type="button" class="ssp-copy" data-copy="' + esc(m) + '" title="Copy">📋 Copy</button>'; };
      const anh = function (i) { return '<canvas class="ssp-anh" data-i="' + i + '" width="1" height="1" title="Bấm để xem to trang ' + (i + 1) + '"></canvas>'; };
      const nhanTrang = function (ds) { return L.dsTrang(ds, tt.trang, tt.file.length > 1); };
      const oChonLai = function (x) {
        if (!LOC_IN_LAI[tt.loc] || !choChonLai(x)) return "";
        const k = khoaChon(x);
        return '<label class="ssp-chon-lai"><input type="checkbox" data-chon="' + esc(k) + '"' + (tt.chonLai.has(k) ? " checked" : "") + "> Chọn in lại</label>";
      };
      const nutInLai = function (k) { return '<button type="button" class="ssp-nut" data-lam="in-lai" data-k="' + esc(k) + '">↻ In lại</button>'; };
      const hang = tatCa.filter(locF).map(function (x) {
        if (x.so) { // cặp theo tờ đơn
          const lop = x.loai === "khop" ? "khop" : x.loai === "nghi" || x.loai === "mot" ? "nghi" : x.loai === "dain" ? "dain" : "lech";
          const vd = x.ds.length ? tt.trang[x.ds[0]].vd : "";
          const trai = x.ds.length
            ? '<div class="' + lopBen(x.laiP) + '"><div class="ssp-anh-ds">' + x.ds.map(anh).join("") + '</div><div class="ssp-chu"><div class="ssp-ma">' + esc(x.hien) + nutCopy(x.hien) + '</div><div class="ssp-mo">Trang ' + nhanTrang(x.ds) +
              (x.ds.length > 1 ? " · <b>" + x.ds.length + " TỜ</b>" : "") + (x.daPhieu ? " · 🖨 in " + gio(x.daPhieu) : "") + "</div>" +
              (vd ? '<div class="ssp-mo">MVĐ: <span class="ssp-ma-nho">' + esc(vd) + "</span></div>" : "") + chipLai(x.laiP) + "</div></div>"
            : x.daPhieu ? '<div class="ssp-khuyet" style="border-color:#9aa0a6;color:#5f6368">Phiếu đã in lúc ' + gio(x.daPhieu) + " (không có trong file này)</div>"
            : '<div class="ssp-khuyet">✕ KHÔNG CÓ PHIẾU ĐÓNG GÓI trong file PDF</div>';
          const phai = '<div class="' + lopBen(x.laiD) + '"><div class="ssp-the">🧾</div><div class="ssp-chu"><div class="ssp-ma">' + esc(x.hien) + nutCopy(x.hien) + '</div><div class="ssp-mo">Tờ ' + x.so +
            (x.mon ? " · " + x.mon + " món" : "") + (x.daDon ? " · 🖨 in " + gio(x.daDon) : "") + "</div>" + chipLai(x.laiD) + "</div></div>";
          const noi = { khop: "✓<small>" + (x.ds.length > 1 ? "KHỚP · " + x.ds.length + " TỜ" : "KHỚP") + "</small>", nghi: "?<small>KIỂM LẠI</small>", dain: "🖨<small>ĐÃ IN</small>",
            mot: "½<small>IN 1 BÊN</small>" }[x.loai] || "✕<small>LỆCH</small>";
          let hd = "";
          if (x.loai === "thieu") hd = "<b>Cách xử lý:</b> tải lại PDF có đơn này, hoặc kiểm tra đơn đã bị sàn hủy → bỏ khỏi Bảng 3 rồi Tạo mẫu in lại.";
          if (x.loai === "lechcot") hd = "<b>\"Mã đơn\" này là MÃ HÀNG / lỗi công thức</b> — Bảng 3 có thể bị lệch cột. Kiểm tra Bảng 3 rồi Tạo mẫu in lại.";
          if (x.loai === "nghi") hd = "<b>Nhìn lại:</b> mã trên phiếu bị in tách khoảng trắng nên hệ thống nhận gần đúng — bấm ảnh phiếu xem to cho chắc. " +
            '<button type="button" class="ssp-nut" data-lam="xac-nhan" data-k="' + esc(x.k) + '">✓ Đúng, đã kiểm</button>';
          if (x.loai === "mot") hd = (x.daDon
            ? "<b>Đã in tờ đơn lúc " + gio(x.daDon) + ", chưa in phiếu</b> → bấm <b>② In phiếu</b> ở đáy ô." + (x.ds.length ? "" : ' <span style="color:#d93025">Phiếu của đơn này KHÔNG có trong file PDF đang mở — kéo đúng file vào.</span>')
            : "<b>Đã in phiếu lúc " + gio(x.daPhieu) + ", chưa in tờ đơn</b> → bấm <b>① In tờ đơn</b> ở đáy ô.") + " " + nutInLai(x.k);
          if (x.loai === "dain") hd = "Đã in đủ: tờ đơn " + gio(x.daDon) + " · phiếu " + gio(x.daPhieu) + ". " + nutInLai(x.k);
          hd = oChonLai(x) + hd;
          return '<div class="ssp-cap ' + lop + (coLai(x) ? " lai" : "") + '"><span class="ssp-stt">' + x.so + "</span>" + trai + '<span class="ssp-noi">' + noi + "</span>" + phai +
            (hd ? '<div class="ssp-hd">' + hd + "</div>" : "") + "</div>";
        }
        // phiếu không có tờ đơn — hiện mã đơn + mã vận đơn đọc được trên phiếu (Copy được)
        const da = x.loai === "thuadain";
        const maTxt = x.nhieu ? "Có nhiều mã: " + x.nhieu.map(function (k) { return esc(k); }).join(", ")
          : x.maHien ? '<span class="ssp-nhan-ma">Mã đơn:</span> ' + esc(x.maHien) + nutCopy(x.maHien)
          : '<span style="color:#d93025">(không đọc được mã đơn trên phiếu — bấm ảnh để xem to)</span>';
        const nhieuTrang = x.ds.length > 1 ? ' · <b>' + x.ds.length + " trang (cùng 1 đơn)</b>" : "";
        const trai = '<div class="' + lopBen(x.laiP) + '"><div class="ssp-anh-ds">' + x.ds.map(anh).join("") + '</div><div class="ssp-chu"><div class="ssp-ma">' + maTxt + "</div>" +
          (x.vd ? '<div class="ssp-ma"><span class="ssp-nhan-ma">MVĐ:</span> ' + esc(x.vd) + nutCopy(x.vd) + "</div>" : "") +
          '<div class="ssp-mo">Trang ' + nhanTrang(x.ds) + nhieuTrang + (da ? " · 🖨 in " + gio(x.daIn) : "") + "</div>" + chipLai(x.laiP) + "</div></div>";
        const phai = da ? '<div class="ssp-khuyet" style="border-color:#9aa0a6;color:#5f6368">Đã in ở lượt trước — bỏ qua</div>' : '<div class="ssp-khuyet">✕ KHÔNG CÓ TỜ ĐƠN LẤY HÀNG</div>';
        let hd = da
          ? "Phiếu này <b>đã in lúc " + gio(x.daIn) + "</b>" + (x.maSo ? " (đơn " + esc(x.maSo) + ")" : "") + " — không in lại. " +
            '<button type="button" class="ssp-nut" data-lam="in-lai-trang" data-i="' + x.i + '">↻ In lại phiếu này' + (x.ds.length > 1 ? " (" + x.ds.length + " trang)" : "") + "</button>"
          : "<b>Cách xử lý:</b> đơn còn giao → thêm vào Bảng 3 rồi Tạo mẫu in lại; đơn đã hủy → phiếu này nằm <b>cuối xấp</b> (nếu ô tích bên dưới đang bật), rút ra khi kẹp. " +
            "Muốn in riêng các phiếu này: chọn bộ lọc <b>Phiếu không có tờ đơn</b> rồi bấm ②." +
            (x.daInDon ? "<br>Tờ đơn của đơn này <b>đã in lúc " + gio(x.daInDon) + "</b>, phiếu chưa in." : "");
        hd = oChonLai(x) + hd;
        return '<div class="ssp-cap ' + (da ? "dain" : "lech") + (coLai(x) ? " lai" : "") + '"><span class="ssp-stt">—</span>' + trai + '<span class="ssp-noi">' + (da ? "🖨<small>ĐÃ IN</small>" : "✕<small>LỆCH</small>") + "</span>" + phai +
          '<div class="ssp-hd">' + hd + "</div></div>";
      });
      $("ssp-ds").innerHTML = (hang.length ? '<div class="ssp-dau"><span>Tờ</span><span>Phiếu đóng gói (PDF)</span><span></span><span>Đơn lấy hàng (web)</span></div>' + hang.join("") : '<div class="ssp-trong">Không có trường hợp nào.</div>');
      veAnhKhiThay();
      veNut(kq);
    }

    // ── 2 NÚT IN THEO BỘ LỌC — MỘT LUẬT CHO MỌI BỘ LỌC ──
    // Mỗi nút in BÊN CÒN THIẾU của các cặp AN TOÀN nằm trong bộ lọc đang chọn:
    //  • An toàn = khop + mot (đã in 1 bên). Bật "Vẫn in tất cả (kể cả lệch)" (chỉ ở Tất cả / Cần xử lý) → thêm thieu, nghi, lechcot.
    //  • Thứ tự: cặp ĐÃ in bên kia → đúng thứ tự xấp đã in (giờ in, vị trí); cặp chưa in bên nào → thứ tự tờ đơn, xếp sau.
    //  • ② kèm phiếu không có tờ đơn (chưa in) ở CUỐI khi ô tích bật. Bộ lọc "Phiếu không có tờ đơn": ② in riêng các phiếu đó.
    const theoXap = function (gioIn, viTri) {
      return function (a, b) {
        const ta = gioIn(a.k), tb = gioIn(b.k);
        if (ta && tb) return (ta - tb) || (viTri(a.k) - viTri(b.k)) || (a.so - b.so);
        if (ta) return -1;
        if (tb) return 1;
        return a.so - b.so;
      };
    };
    function chonIn(kq) {
      const s = so(), loc = tt.loc, f = locHienTai();
      const tatCa = !!tt.tatCa && (loc === "tat" || loc === "can");
      const coSo = kq.cap.filter(function (x) { return f(x) && (x.loai === "khop" || x.loai === "mot" || (tatCa && LECH[x.loai])); });
      const don = coSo.filter(function (x) { return !x.daDon; }).sort(theoXap(s.phieu, s.viTriPhieu));
      const phieu = coSo.filter(function (x) { return !x.daPhieu && x.ds.length; }).sort(theoXap(s.don, s.viTriDon));
      const thuaChua = kq.thua.filter(function (x) { return x.loai === "thua"; });
      const thuaIn = loc === "thua" ? thuaChua : phieu.length && $("ssp-thua").checked && loc !== "dain" ? thuaChua : [];
      return { coSo: coSo, don: don, phieu: phieu, thuaIn: thuaIn, tatCa: tatCa, khongPhieu: coSo.filter(function (x) { return !x.daPhieu && !x.ds.length; }) };
    }
    function lyDoXam(c, ben) {
      const loc = tt.loc;
      if (loc === "thua") return ben === "don" ? "Phiếu không có tờ đơn → <b>không có tờ đơn để in</b>. Muốn có tờ: thêm đơn vào Bảng 3 rồi Tạo mẫu in lại." : "Các phiếu này đã in hết.";
      if (loc === "dain") return "Các cặp này đã in đủ. Muốn in lại (kẹt giấy, máy in hư…): bấm <b>↻ In lại</b> ở từng cặp.";
      if (!c.tatCa && { can: 1, thieu: 1, nghi: 1, lechcot: 1 }[loc]) return {
        can: "Danh sách này để <b>kiểm tra</b> — không in từ đây. Xử lý từng loại bằng các bộ lọc bên trên, hoặc bấm <b>Vẫn in tất cả (kể cả lệch)</b>.",
        thieu: "Tờ đơn không có phiếu → <b>không giao được</b> và làm 2 xấp lệch. Tải lại PDF có đơn này, hoặc bỏ đơn khỏi Bảng 3 rồi Tạo mẫu in lại.",
        nghi: "Bấm ảnh phiếu xem to, đúng thì bấm <b>✓ Đúng, đã kiểm</b> ở từng cặp → cặp chuyển sang <b>Khớp</b> và in được.",
        lechcot: "\"Mã đơn\" là mã hàng / lỗi công thức → sửa Bảng 3 rồi Tạo mẫu in lại.",
      }[loc];
      if (!c.coSo.length) return "Không có cặp nào cần in trong bộ lọc này.";
      if (ben === "don") return "Tờ đơn của các cặp này <b>đã in hết</b>" + (c.phieu.length ? " — bấm ② để in phiếu còn lại." : ".");
      if (c.khongPhieu.length) return c.khongPhieu.length + " cặp đã in tờ đơn nhưng <b>phiếu không có trong file PDF đang mở</b> — kéo đúng file vào.";
      return "Phiếu của các cặp này <b>đã in hết</b>" + (c.don.length ? " — bấm ① để in tờ đơn còn lại." : ".");
    }
    function veNut(kq) {
      const c = chonIn(kq);
      tt.chon = c;
      if (LOC_IN_LAI[tt.loc]) { veNutInLai(kq); return; }
      const s = so();
      const dn = c.don.length, pn = c.phieu.length + c.thuaIn.length;
      const pham = c.tatCa ? "TẤT CẢ (kể cả lệch)" : "cặp khớp";
      const notD = c.don.filter(function (x) { return x.daPhieu; }), notP = c.phieu.filter(function (x) { return x.daDon; });
      const nhoD = notD.length ? notD.length + " tờ in nốt (theo xấp phiếu in lúc " + gio(notD[0].daPhieu) + ")" + (dn > notD.length ? " + " + (dn - notD.length) + " mới" : "") : pham;
      const nhoP = tt.loc === "thua" ? "in riêng — không có tờ đơn đi kèm"
        : (notP.length ? notP.length + " phiếu in nốt (theo xấp tờ đơn in lúc " + gio(notP[0].daDon) + ")" + (c.phieu.length > notP.length ? " + " + (c.phieu.length - notP.length) + " mới" : "") : pham) +
          (c.thuaIn.length ? " + " + c.thuaIn.length + " phiếu không có tờ đơn ở cuối" : "");
      const h = [];
      h.push('<button type="button" class="ssp-nut-in don' + (c.tatCa ? " do" : "") + '" data-lam="in-don"' + (dn ? "" : " disabled") + ">🖨 ① In " + dn + " TỜ ĐƠN LẤY HÀNG<small>" + (dn ? nhoD + " · " : "") + "máy in giấy thường</small></button>");
      h.push('<button type="button" class="ssp-nut-in' + (c.tatCa ? " do" : "") + '" data-lam="in-phieu"' + (pn ? "" : " disabled") + ">🏷 ② In " + pn + " PHIẾU ĐÓNG GÓI<small>" + (pn ? nhoP + " · " : "") + "máy in giấy keo</small></button>");
      // Nút xám → nói rõ vì sao + cách làm
      const ly = [];
      if (!dn) ly.push("<b>① xám:</b> " + lyDoXam(c, "don"));
      if (!pn) ly.push("<b>② xám:</b> " + lyDoXam(c, "phieu"));
      else if (c.khongPhieu.length) ly.push("⚠ " + c.khongPhieu.length + " cặp đã in tờ đơn nhưng phiếu không có trong file PDF đang mở — không nằm trong nút ②.");
      // Những gì trong bộ lọc này KHÔNG nằm trong 2 nút
      const f = locHienTai(), coSo = new Set(c.coSo), thuaIn = new Set(c.thuaIn), ngoai = {};
      const TEN = { dain: "đã in đủ", thieu: "thiếu phiếu", nghi: "nghi ngờ", lechcot: "lỗi Bảng 3", thua: "phiếu không có tờ đơn", thuadain: "phiếu đã in" };
      kq.cap.concat(kq.thua).forEach(function (x) {
        if (!f(x) || coSo.has(x) || thuaIn.has(x)) return;
        if (x.loai === "mot" || x.loai === "khop") return;
        ngoai[x.loai] = (ngoai[x.loai] || 0) + 1;
      });
      const dsNgoai = Object.keys(ngoai).map(function (l) { return "<b>" + ngoai[l] + "</b> " + TEN[l]; });
      if (dsNgoai.length && (dn || pn)) ly.push("Không in trong 2 nút: " + dsNgoai.join(" · ") + ".");
      // In tất cả (kể cả lệch) — chỉ ở Tất cả / Cần xử lý, khi phiên có cặp lệch
      const coLech = kq.cap.some(function (x) { return LECH[x.loai]; });
      if ((tt.loc === "tat" || tt.loc === "can") && coLech) {
        h.push(c.tatCa
          ? '<button type="button" class="ssp-tat-ca" data-lam="bo-tat-ca">↩ Quay về chỉ in cặp khớp</button>'
          : '<button type="button" class="ssp-tat-ca" data-lam="tat-ca">⚠ Vẫn in tất cả (kể cả lệch)</button>');
      }
      if (c.tatCa) ly.unshift('<b style="color:#d93025">⛔ ĐANG IN TẤT CẢ (kể cả lệch)</b> — 2 xấp sẽ lệch ở các cặp thiếu phiếu, khi kẹp phải dò mã.');
      $("ssp-hai-nut").innerHTML = h.join("") + (ly.length ? '<div class="ssp-ly-do" title="Bấm để xem đủ / thu lại">' + ly.join('<span class="ssp-ngat"> · </span><br>') + "</div>" : "");
      ganTitleNut();
    }

    // ── 2 NÚT Ở BỘ LỌC "Đã in" / "Đã in lại" = 2 nút IN LẠI các mục đã tích chọn (đúng thứ tự xấp đã in) ──
    function chonInLai(kq) {
      const s = so(), f = locHienTai();
      const sel = kq.cap.concat(kq.thua).filter(function (x) { return f(x) && choChonLai(x) && tt.chonLai.has(khoaChon(x)); });
      const cap = sel.filter(function (x) { return x.so; });
      return {
        sel: sel,
        don: cap.filter(function (x) { return x.daDon; }).sort(theoXap(s.don, s.viTriDon)),
        phieu: cap.filter(function (x) { return x.daPhieu && x.ds.length; }).sort(theoXap(s.phieu, s.viTriPhieu)),
        thua: sel.filter(function (x) { return !x.so; }).sort(function (a, b) { return (a.daIn - b.daIn) || (a.i - b.i); }),
      };
    }
    // Nút in 1 dòng: chú thích nhỏ có thể bị rút gọn → đặt title = toàn bộ chữ của nút
    function ganTitleNut() { Array.prototype.forEach.call($("ssp-hai-nut").querySelectorAll(".ssp-nut-in"), function (b) { b.title = b.textContent.replace(/\s+/g, " ").trim(); }); }
    function veNutInLai(kq) {
      const c = chonInLai(kq);
      tt.chonLaiKq = c;
      const f = locHienTai();
      const coThe = kq.cap.concat(kq.thua).filter(function (x) { return f(x) && choChonLai(x); });
      const dn = c.don.length, pn = c.phieu.length + c.thua.length;
      const h = [];
      h.push('<button type="button" class="ssp-nut-in tim" data-lam="lai-don"' + (dn ? "" : " disabled") + ">↻ ① In lại " + dn + " TỜ ĐƠN LẤY HÀNG<small>" + (dn ? "đúng thứ tự xấp đã in · " : "") + "máy in giấy thường</small></button>");
      h.push('<button type="button" class="ssp-nut-in tim" data-lam="lai-phieu"' + (pn ? "" : " disabled") + ">↻ ② In lại " + pn + " PHIẾU ĐÓNG GÓI<small>" + (pn ? "đúng thứ tự xấp đã in · " : "") + "máy in giấy keo</small></button>");
      if (coThe.length) h.push(c.sel.length
        ? '<button type="button" class="ssp-tat-ca tim" data-lam="bo-chon">☐ Bỏ chọn (' + c.sel.length + ")</button>"
        : '<button type="button" class="ssp-tat-ca tim" data-lam="chon-het">☑ Chọn hết trong bộ lọc (' + coThe.length + ")</button>");
      const ly = [];
      if (!c.sel.length) ly.push("<b>Đang ở bộ lọc " + tenLoc(tt.loc) + ":</b> tích ô <b>Chọn in lại</b> ở các cặp có tờ bị hỏng (hoặc <b>Chọn hết</b>) → 2 nút thành <b>In lại</b>. " +
        "Chỉ in lại khi tờ cũ hỏng (kẹt giấy, rách, máy in lỗi…) và đã bỏ tờ cũ.");
      else {
        if (!dn) ly.push("<b>① xám:</b> các mục đã chọn chưa in tờ đơn lần nào" + (c.thua.length ? " (phiếu không có tờ đơn thì không có tờ để in)" : "") + ".");
        if (!pn) ly.push("<b>② xám:</b> các mục đã chọn chưa in phiếu, hoặc phiếu không có trong file PDF đang mở.");
      }
      $("ssp-hai-nut").innerHTML = h.join("") + (ly.length ? '<div class="ssp-ly-do" title="Bấm để xem đủ / thu lại">' + ly.join('<span class="ssp-ngat"> · </span><br>') + "</div>" : "");
      ganTitleNut();
    }
    // Cảnh báo IN LẠI NHIỀU: tính cả lần này, phiên có từ 15 cặp hoặc từ 20% phiên phải in lại → hỏi thêm 1 lần
    function kiemNguong(dsKhoa, lam) {
      const kq = tt.kq, tatCa = kq.cap.concat(kq.thua), tong = tatCa.length;
      const da = new Set();
      tatCa.forEach(function (x) { if (coLai(x)) da.add(khoaChon(x)); });
      dsKhoa.forEach(function (k) { da.add(k); });
      const n = da.size;
      if (n < LAI_NGUONG_CAP && n < tong * LAI_NGUONG_TL) { lam(); return; }
      hop({
        tieuDe: "⚠ Đang in lại NHIỀU — " + n + "/" + tong + " cặp của phiên", lop: "loi",
        noiDung: "Tính cả lần này, phiên đã có <b>" + n + "</b> cặp phải in lại (cảnh báo từ " + LAI_NGUONG_CAP + " cặp hoặc từ " + Math.round(LAI_NGUONG_TL * 100) + "% phiên)." +
          '<div class="ssp-do-dam">In lại nhiều thường do <b>máy in kẹt giấy / hết mực, chọn nhầm máy in, hoặc sai Bảng 3</b>. Nên kiểm tra nguyên nhân trước — không thì sẽ phải in lại tiếp.</div>' +
          "Đã kiểm tra và vẫn muốn in lại?",
        nut: [{ chu: "Thôi — kiểm tra trước" }, { chu: "Đã kiểm tra — vẫn in lại", lop: "do", lam: lam }],
      });
    }
    function inLaiToDon(dsCap) {
      const dsK = dsCap.map(function (x) { return x.k; });
      inToDon(dsK, false, function () { so().ghiInLai(dsK, "d"); tt.chonLai.clear(); });
    }
    function inLaiPhieu(dsCap, dsThua) {
      const daCo = new Set();
      let nhom = dsCap.map(function (x) { return x.ds.filter(function (i) { if (daCo.has(i)) return false; daCo.add(i); return true; }); }).filter(function (g) { return g.length; });
      if ($("ssp-dao").checked) nhom = nhom.reverse();
      const thuTu = [].concat.apply([], nhom).concat([].concat.apply([], dsThua.map(function (x) { return x.ds; })).filter(function (i) { if (daCo.has(i)) return false; daCo.add(i); return true; }));
      if (!thuTu.length) return;
      inPhieu(thuTu, "IN LẠI " + (dsCap.length + dsThua.length) + " phiếu", function () {
        so().ghiInLai(dsCap.map(function (x) { return x.k; }).concat(dsThua.map(khoaSoThua)), "p");
        tt.chonLai.clear();
      });
    }

    // Ảnh thu nhỏ: chỉ vẽ khi cuộn tới (đỡ nặng với phiên 100 đơn)
    function veAnhKhiThay() {
      if (tt.io) tt.io.disconnect();
      const ve = function (cv) {
        if (cv.getAttribute("data-xong")) return;
        cv.setAttribute("data-xong", "1");
        const t = tt.trang[+cv.getAttribute("data-i")];
        if (!t || !L) return;
        const rong = cv.getBoundingClientRect().width || ANH_RONG;
        L.veAnh(tt.file[t.f], t.p, cv, Math.round(rong)).catch(loiVeAnh);
      };
      const ds = $("ssp-ds").querySelectorAll("canvas.ssp-anh");
      if (!("IntersectionObserver" in window)) { Array.prototype.forEach.call(ds, ve); return; }
      tt.io = new IntersectionObserver(function (muc) {
        muc.forEach(function (m) { if (m.isIntersecting) { tt.io.unobserve(m.target); ve(m.target); } });
      }, { root: $("ssp-cuon"), rootMargin: "300px" });
      Array.prototype.forEach.call(ds, function (cv) { tt.io.observe(cv); });
    }

    // ── Hộp thoại (thay confirm/alert của trình duyệt) ──
    function hop(o) {
      const phu = document.createElement("div");
      phu.className = "ssp-phu no-print";
      phu.innerHTML = '<div class="ssp-hop ' + (o.lop || "") + '" role="dialog"><h3>' + o.tieuDe + "</h3><div>" + (o.noiDung || "") + '</div><div class="ssp-hang-nut"></div></div>';
      const hang = phu.querySelector(".ssp-hang-nut");
      const dong = function () { phu.remove(); };
      (o.nut || []).forEach(function (n) {
        const b = document.createElement("button");
        b.type = "button"; b.className = "ssp-nut " + (n.lop || ""); b.innerHTML = n.chu;
        b.addEventListener("click", function () { if (!n.giuMo) dong(); if (n.lam) n.lam(); });
        hang.appendChild(b);
      });
      document.body.appendChild(phu);
      const dau = hang.firstElementChild; if (dau) dau.focus(); // nút AN TOÀN (Thôi / Chưa in) được chọn sẵn — lỡ bấm Enter không ghi sổ
      return dong;
    }
    const dsMaHtml = function (ds, f) { return "<ul>" + ds.slice(0, 40).map(f).join("") + (ds.length > 40 ? "<li>… và " + (ds.length - 40) + " mục nữa</li>" : "") + "</ul>"; };

    // ── IN TỜ ĐƠN: tạm ẩn các tờ ngoài danh sách (+ tạm XẾP LẠI đúng thứ tự cần in nếu khác thứ tự trên trang)
    //    → bấm CHÍNH nút In đơn có sẵn → trả lại nguyên trạng. dsK = mã ĐÚNG THỨ TỰ in. ghiSo=false: in lại (không ghi sổ).
    let dangXep = false; // true lúc tạm xếp lại tờ đơn → bỏ qua "tờ đơn thay đổi"
    function inToDon(dsK, ghiSo, khiXong) {
      const can = new Set(dsK), an = [];
      const td = thuTuToDon();
      Array.prototype.forEach.call(vungIn.querySelectorAll(".invoice-box"), function (b) {
        if (!can.has(kd(maCuaBox(b)))) { b.classList.add("ssp-an-in"); an.push(b); }
      });
      // Thứ tự cần in khác thứ tự trên trang (vd in nốt tờ theo xấp phiếu đã in) → tạm xếp lại
      const moi = [];
      dsK.forEach(function (k) { if (td.theo[k]) td.theo[k].box.forEach(function (b) { moi.push(b); }); });
      const dangCo = Array.prototype.filter.call(vungIn.querySelectorAll(".invoice-box"), function (b) { return can.has(kd(maCuaBox(b))); });
      const canXep = moi.some(function (b, i) { return b !== dangCo[i]; }) && moi.every(function (b) { return b.parentNode === vungIn; });
      const nutGoc = canXep ? Array.prototype.slice.call(vungIn.childNodes) : null;
      dangInCuaToi = true;
      try {
        if (canXep) { dangXep = true; moi.forEach(function (b) { vungIn.appendChild(b); }); }
        const nut = document.getElementById("nut-in-don");
        if (nut) nut.click(); else window.print();
      } catch (e) {
        console.error("[SapXepPhieu] Lỗi khi in tờ đơn:", e);
      } finally {
        an.forEach(function (b) { b.classList.remove("ssp-an-in"); });
        if (nutGoc) { nutGoc.forEach(function (n) { vungIn.appendChild(n); }); Promise.resolve().then(function () { dangXep = false; }); }
      }
      // Cờ dangInCuaToi chỉ tắt khi nhân viên trả lời → sự kiện "in xong" đến chậm cũng không bị tưởng là nút In đơn gốc
      hop({
        tieuDe: "🖨 Đã in xong " + dsK.length + " tờ đơn lấy hàng chưa?",
        noiDung: "Chỉ bấm <b>Đã in xong</b> khi giấy đã ra máy in. Nếu đã bấm <b>Hủy</b> trong hộp in, hoặc máy in lỗi, chọn <b>Chưa in</b>.",
        nut: [{ chu: "Chưa in / đã hủy", lam: function () { dangInCuaToi = false; } },
          { chu: "✓ Đã in xong", lop: "xanh", lam: function () { dangInCuaToi = false; if (ghiSo !== false) so().ghiDon(dsK.filter(function (k) { return !maDonLa(k); })); if (khiXong) khiXong(); tinh(); } }],
      });
    }

    // ── IN PHIẾU: tạo PDF đúng thứ tự (chép NGUYÊN trang) → mở thẳng hộp in; không được thì mở tab mới ──
    async function inPhieu(thuTuTrang, moTa, khiXong) {
      if (!thuTuTrang.length) return;
      // Mở bằng file:/// → Chrome CHẶN mở thẳng hộp in của PDF (khác nguồn) → mở tab mới NGAY lúc bấm (tránh bị chặn cửa sổ bật lên)
      const quaFile = location.protocol === "file:";
      const cuaSo = quaFile ? window.open("", "_blank") : null;
      const dongCho = hop({ tieuDe: "⏳ Đang tạo PDF phiếu…", noiDung: thuTuTrang.length + " trang" });
      let url = null;
      try {
        const moi = await L.taoPdf(tt.file, tt.trang, thuTuTrang);
        if (tt.url) URL.revokeObjectURL(tt.url);
        url = tt.url = URL.createObjectURL(new Blob([moi.bytes], { type: "application/pdf" }));
      } catch (e) {
        console.error("[SapXepPhieu] Không tạo được PDF:", e);
        dongCho();
        if (cuaSo) cuaSo.close();
        hop({ tieuDe: "Không tạo được file PDF phiếu", lop: "loi", noiDung: "Thử lại, hoặc dùng trang Sắp xếp phiếu riêng.", nut: [{ chu: "Đóng" }] });
        return;
      }
      dongCho();
      const ten = (tt.file.length === 1 ? tt.file[0].ten.replace(/\.pdf$/i, "") : "phieu_dong_goi") + "_DA_SAP_XEP.pdf";
      $("ssp-ket-qua").title = "PDF phiếu vừa tạo: " + thuTuTrang.length + " trang (" + moTa + ")";
      $("ssp-ket-qua").innerHTML = '📄 PDF vừa tạo: <b>' + thuTuTrang.length + " trang</b>" +
        '<a href="' + url + '" target="_blank" rel="noopener" title="Mở lại PDF phiếu để in">🖨 Mở lại</a><a href="' + url + '" download="' + esc(ten) + '" title="Tải file PDF phiếu về máy">⬇ Tải về</a>';
      const vanTayIn = thuTuTrang.map(function (i) { return tt.trang[i].vt; });
      // Mở thẳng hộp in bằng khung ẩn (web https); file:/// → đưa PDF sang tab đã mở sẵn
      let moDuoc = false, daMoTab = false;
      dangInCuaToi = true; // phòng trình duyệt báo "in xong" cho cả trang chính
      if (cuaSo) { try { cuaSo.location.href = url; daMoTab = true; } catch (e) { console.warn("[SapXepPhieu] Không mở được tab PDF:", e); } }
      if (!quaFile) try {
        let f = document.getElementById("ssp-khung-in");
        if (f) f.remove();
        f = document.createElement("iframe");
        f.id = "ssp-khung-in";
        f.setAttribute("aria-hidden", "true");
        f.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none";
        await new Promise(function (xong) {
          f.onload = function () {
            setTimeout(function () {
              try { f.contentWindow.focus(); f.contentWindow.print(); moDuoc = true; } catch (e) { console.warn("[SapXepPhieu] Không mở thẳng được hộp in PDF:", e); }
              xong();
            }, 400);
          };
          setTimeout(xong, 8000);
          f.src = url;
          document.body.appendChild(f);
        });
      } catch (e) { console.warn("[SapXepPhieu] Không mở thẳng được hộp in PDF:", e); }
      hop({
        tieuDe: "🏷 Đã in xong " + thuTuTrang.length + " trang phiếu đóng gói chưa?",
        noiDung: (moDuoc ? "" : daMoTab ? '<div class="ssp-kl vang" style="margin:0 0 6px">PDF phiếu đã mở ở <b>TAB MỚI</b> — sang tab đó bấm <b>Ctrl+P</b> (hoặc nút in) để in, rồi quay lại đây trả lời.</div>'
          : '<div class="ssp-do-dam">Trình duyệt không mở thẳng được hộp in — bấm <b>Mở PDF ở tab mới</b> rồi in ở đó.</div>') +
          "Chỉ bấm <b>Đã in xong</b> khi giấy đã ra máy in. Nếu đã bấm <b>Hủy</b> hoặc máy in lỗi, chọn <b>Chưa in</b>.",
        nut: [
          { chu: "Mở PDF ở tab mới", giuMo: true, lam: function () { window.open(url, "_blank"); } },
          { chu: "Chưa in / đã hủy", lam: function () { dangInCuaToi = false; } },
          { chu: "✓ Đã in xong", lop: "xanh", lam: function () { dangInCuaToi = false; if (khiXong) khiXong(vanTayIn); tinh(); } },
        ],
      });
    }

    // Thứ tự trang phiếu cho danh sách mã đơn dsK (ĐÚNG THỨ TỰ in) + các phiếu không có tờ đơn thuaIn ở CUỐI.
    // coPhieu = mã có phiếu, theo thứ tự logic (để ghi vị trí vào sổ); "Đảo ngược" chỉ đảo thứ tự trang khi in.
    function trangChoDs(dsK, thuaIn) {
      const td = tt.kq ? tt.kq.td : { ma: [] };
      const hop1 = td.ma.slice(); dsK.forEach(function (k) { if (hop1.indexOf(k) < 0) hop1.push(k); });
      const g = L.ghep(hop1, tt.trang, maDonLa);
      const daCo = new Set(), nhom = [], coPhieu = [], khongCo = [];
      dsK.forEach(function (k) {
        const ds = (g.trangCua.get(k) || []).filter(function (i) { return !daCo.has(i); });
        if (ds.length) { ds.forEach(function (i) { daCo.add(i); }); nhom.push(ds); coPhieu.push(k); } else khongCo.push(k);
      });
      if ($("ssp-dao").checked) nhom.reverse();
      const thuTu = [].concat.apply([], nhom);
      let soThua = 0;
      const maThua = []; // mã đơn đọc được trên phiếu không có tờ đơn → ghi sổ (sau này thêm vào Bảng 3 thì biết đã in phiếu + vị trí trong xấp)
      (thuaIn || []).forEach(function (x) {
        const moi = (x.ds || [x.i]).filter(function (i) { return !daCo.has(i); });
        if (!moi.length) return;
        moi.forEach(function (i) { daCo.add(i); thuTu.push(i); });
        soThua++;
        const m = x.nhieu ? "" : x.maSo || x.maHien || tt.trang[x.i].oid || "";
        if (m && coPhieu.indexOf(m) < 0 && maThua.indexOf(m) < 0) maThua.push(m);
      });
      return { thuTu: thuTu, coPhieu: coPhieu, maThua: maThua, khongCo: khongCo, soThua: soThua };
    }
    function inPhieuChoDs(dsK, thuaIn, moTa) {
      const r = trangChoDs(dsK, thuaIn);
      if (!r.thuTu.length) return;
      inPhieu(r.thuTu, moTa + (r.soThua ? " + " + r.soThua + " phiếu không có tờ đơn ở cuối" : ""), function (vt) {
        so().ghiPhieu(r.coPhieu.concat(r.maThua).filter(function (k) { return !maDonLa(k); }), vt);
      });
    }

    // ── Các nút ──
    function bam(lam, el) {
      if (lam === "mo-ds-file") { if (tt.moDsFile) dongDsFile(); else { tt.moDsFile = true; tinh(); } return; }
      if (lam === "bo-file") { boFile(+el.getAttribute("data-fi")); return; }
      if (lam === "bo-het-file") { if (window.confirm("Bỏ hết " + tt.file.length + " file PDF khỏi ô đối chiếu?")) boHetFile(); return; }
      tinh(); // đối chiếu lại với tờ đơn đang có ngay lúc bấm
      const kq = tt.kq, s = so(), c = tt.chon;
      const capCua = function (k) { return kq.cap.find(function (x) { return x.k === k; }); };
      if (lam === "in-don") {
        if (!c || !c.don.length) return;
        inToDon(c.don.map(function (x) { return x.k; }));
      } else if (lam === "in-phieu") {
        if (!c || !(c.phieu.length + c.thuaIn.length)) return;
        inPhieuChoDs(c.phieu.map(function (x) { return x.k; }), c.thuaIn, c.phieu.length + " đơn");
      } else if (lam === "in-phieu-f5") {
        const f5 = phieuChoSauF5();
        if (f5.dsK.length) inPhieuChoDs(f5.dsK, [], f5.dsK.length + " đơn đã in tờ đơn");
      } else if (lam === "tat-ca") {
        const lech = kq.cap.filter(function (x) { return LECH[x.loai]; });
        hop({
          tieuDe: "⛔ In TẤT CẢ — kể cả " + lech.length + " cặp đang LỆCH", lop: "loi",
          noiDung: "Các cặp lệch:" +
            dsMaHtml(lech, function (x) { return "<li>Tờ " + x.so + " " + esc(x.hien) + " — " + ({ thieu: "không có phiếu", nghi: "nghi ngờ", lechcot: "mã hàng / lỗi" }[x.loai] || "") + "</li>"; }) +
            '<div class="ssp-do-dam"><b>Tờ đơn không có phiếu sẽ làm 2 xấp lệch vị trí — phải dò mã khi kẹp.</b></div>' +
            "Nên xử lý trước (thêm / bỏ đơn trong Bảng 3 rồi Tạo mẫu in lại). Vẫn in thì 2 nút ①② sẽ chuyển sang chế độ <b>in tất cả</b> (nút đỏ).",
          nut: [{ chu: "← Quay lại xử lý", lam: function () { tt.loc = "can"; tt.tatCa = false; tinh(); } },
            { chu: "Vẫn in tất cả", lop: "do", lam: function () { tt.tatCa = true; tinh(); } }],
        });
      } else if (lam === "bo-tat-ca") {
        tt.tatCa = false; tinh();
      } else if (lam === "xac-nhan") {
        tt.xacNhan.add(el.getAttribute("data-k")); tinh();
      } else if (lam === "in-lai") {
        const x = capCua(el.getAttribute("data-k")); if (!x) return;
        const nut = [{ chu: "Thôi" }];
        if (x.daDon) nut.push({ chu: "In lại tờ đơn", lop: "do", lam: function () { kiemNguong([x.k], function () { inLaiToDon([x]); }); } });
        if (x.daPhieu && x.ds.length) nut.push({ chu: "In lại phiếu", lop: "do", lam: function () { kiemNguong([x.k], function () { inLaiPhieu([x], []); }); } });
        hop({
          tieuDe: "⛔ Đơn " + esc(x.hien) + " ĐÃ IN", lop: "loi",
          noiDung: (x.daDon ? "Tờ đơn in lúc <b>" + gio(x.daDon) + "</b>. " : "") + (x.daPhieu ? "Phiếu in lúc <b>" + gio(x.daPhieu) + "</b>." : "") + dongLai(x) +
            '<div class="ssp-do-dam">In lại sẽ có <b>2 tờ giống nhau</b>. Chỉ in lại khi tờ cũ bị hỏng (kẹt giấy, rách, máy in lỗi…) và đã bỏ tờ cũ. Tờ in lại đặt vào ĐÚNG CHỖ tờ cũ trong xấp.</div>',
          nut: nut,
        });
      } else if (lam === "in-lai-trang") {
        const i = +el.getAttribute("data-i"), x = kq.thua.find(function (y) { return y.i === i; }); if (!x) return;
        hop({
          tieuDe: "⛔ Phiếu " + (x.maHien ? "đơn " + esc(x.maHien) + " — " : "") + "trang " + L.dsTrang(x.ds, tt.trang, tt.file.length > 1) + " ĐÃ IN lúc " + gio(x.daIn), lop: "loi",
          noiDung: dongLai(x) + '<div class="ssp-do-dam">In lại sẽ có <b>2 phiếu giống nhau</b>. Chỉ in lại khi phiếu cũ bị hỏng và đã bỏ phiếu cũ.</div>',
          nut: [{ chu: "Thôi" }, { chu: "In lại phiếu", lop: "do", lam: function () { kiemNguong([khoaChon(x)], function () { inLaiPhieu([], [x]); }); } }],
        });
      } else if (lam === "chon-het") {
        const f = locHienTai();
        kq.cap.concat(kq.thua).forEach(function (x) { if (f(x) && choChonLai(x)) tt.chonLai.add(khoaChon(x)); });
        tinh();
      } else if (lam === "bo-chon") {
        tt.chonLai.clear(); tinh();
      } else if (lam === "lai-don" || lam === "lai-phieu") {
        const cl = tt.chonLaiKq; if (!cl) return;
        const laDon = lam === "lai-don";
        const ds = laDon ? cl.don : cl.phieu.concat(cl.thua);
        if (!ds.length) return;
        hop({
          tieuDe: "↻ In lại " + ds.length + (laDon ? " TỜ ĐƠN LẤY HÀNG" : " PHIẾU ĐÓNG GÓI"), lop: "loi",
          noiDung: "Các mục sẽ in lại (đúng thứ tự xấp đã in):" +
            dsMaHtml(ds, function (x) { return "<li>" + (x.so ? "Tờ " + x.so + " " + esc(x.hien) : "Phiếu trang " + L.dsTrang(x.ds, tt.trang, tt.file.length > 1) + (x.maHien ? " " + esc(x.maHien) : "")) + "</li>"; }) +
            '<div class="ssp-do-dam">In lại sẽ có <b>2 tờ giống nhau</b>. Chỉ in lại khi tờ cũ hỏng và <b>đã bỏ tờ cũ</b>. Tờ in lại đặt vào ĐÚNG CHỖ tờ cũ trong xấp.</div>' +
            "Sau khi in, các cặp này hiện <b>viền tím ↻</b> và nằm trong bộ lọc <b>↻ Đã in lại</b>.",
          nut: [{ chu: "Thôi" }, { chu: "↻ In lại", lop: "do", lam: function () {
            kiemNguong(ds.map(khoaChon), function () { if (laDon) inLaiToDon(cl.don); else inLaiPhieu(cl.phieu, cl.thua); });
          } }],
        });
      } else if (lam === "xoa-so") {
        const n = new Set(s.cacMa()).size;
        hop({
          tieuDe: "🗑 Xóa sổ đã in trên máy này?", lop: "loi",
          noiDung: "Sổ đang nhớ <b>" + n + "</b> mã đơn đã in (tờ đơn / phiếu) trong 7 ngày qua trên máy này." +
            '<div class="ssp-do-dam"><b>Xóa thì hệ thống KHÔNG còn chặn in trùng các đơn đã in trước đó</b> — mọi cặp sẽ hiện là CHƯA IN, bấm in là in lại từ đầu.</div>' +
            "Chỉ xóa khi chắc chắn: ví dụ đang thử nghiệm, hoặc các xấp đã in trước đó đã kẹp xong hết.",
          nut: [{ chu: "Thôi" }, { chu: "🗑 Xóa sổ", lop: "do", lam: function () { s.xoaHet(); tt.tatCa = false; tinh(); } }],
        });
      }
    }

    // ── Sự kiện ──
    // Tờ đơn thay đổi (bấm Tạo mẫu in lại) → tự đối chiếu lại
    new MutationObserver(function () { if (!tt.dangDoc && !dangXep) tinh(); }).observe(vungIn, { childList: true });
    $("ssp-file").addEventListener("change", function (e) { if (e.target.files.length) docFile(e.target.files); e.target.value = ""; });
    ["dragenter", "dragover"].forEach(function (s) { khung.addEventListener(s, function (e) { e.preventDefault(); khung.classList.add("dang-keo"); }); });
    ["dragleave", "drop"].forEach(function (s) { khung.addEventListener(s, function (e) { e.preventDefault(); khung.classList.remove("dang-keo"); }); });
    khung.addEventListener("drop", function (e) { if (e.dataTransfer && e.dataTransfer.files.length) docFile(e.dataTransfer.files); });
    // Thu gọn chỉ có nghĩa khi đã có PDF — chưa có (đang đọc / lỗi đọc) thì luôn mở để thấy thông báo
    function boGon() { if (khung.classList.contains("ssp-gon")) { khung.classList.remove("ssp-gon"); $("ssp-thu-gon").textContent = "Thu gọn ▴"; } }
    document.addEventListener("click", function (e) {
      if (tt.moDsFile && !e.target.closest("#ssp-ds-file,#ssp-nut-file")) dongDsFile();
    }, true);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && tt.moDsFile) dongDsFile(); });
    window.addEventListener("resize", function () { if (tt.moDsFile) dongDsFile(); });
    than.addEventListener("scroll", function () { if (tt.moDsFile) dongDsFile(); }, true);
    $("ssp-thu-gon").addEventListener("click", function () {
      dongDsFile();
      const gon = khung.classList.toggle("ssp-gon");
      this.textContent = gon ? "Mở rộng ▾" : "Thu gọn ▴";
      tinh();
    });
    khung.addEventListener("click", function (e) {
      const loc = e.target.closest("[data-loc]");
      if (loc) { tt.loc = loc.getAttribute("data-loc"); tt.tatCa = false; tt.chonLai.clear(); tinh(); return; }
      const ch = e.target.closest("input[data-chon]");
      if (ch) { const k = ch.getAttribute("data-chon"); if (ch.checked) tt.chonLai.add(k); else tt.chonLai.delete(k); tinh(); return; }
      const cp = e.target.closest(".ssp-copy");
      if (cp) { saoChep(cp.getAttribute("data-copy"), cp); return; }
      const cv = e.target.closest("canvas.ssp-anh");
      if (cv) { xemTo(+cv.getAttribute("data-i")); return; }
      const lyDo = e.target.closest(".ssp-ly-do");
      if (lyDo && !e.target.closest("button,a,input")) { lyDo.classList.toggle("mo"); return; }
      const b = e.target.closest("[data-lam]");
      if (b && !b.disabled) bam(b.getAttribute("data-lam"), b);
    });
    $("ssp-dao").addEventListener("change", tinh);
    $("ssp-thua").addEventListener("change", tinh);

    function saoChep(chu, nut) {
      const xong = function () { nut.textContent = "✓ Đã copy"; nut.classList.add("da"); setTimeout(function () { nut.textContent = "📋 Copy"; nut.classList.remove("da"); }, 1500); };
      const duPhong = function () {
        try {
          const o = document.createElement("textarea");
          o.value = chu; o.setAttribute("readonly", ""); o.style.cssText = "position:fixed;left:-9999px;top:0";
          document.body.appendChild(o); o.select(); document.execCommand("copy"); o.remove(); xong();
        } catch (e) { console.error("[SapXepPhieu] Không copy được:", e); }
      };
      try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(chu).then(xong, duPhong); else duPhong(); } catch (e) { duPhong(); }
    }
    // Xem to 1 trang: rộng gần hết màn hình, có mã đơn / mã vận đơn đọc được (Copy) + nút Phóng to ×2
    function xemTo(i) {
      const t = tt.trang[i]; if (!t || !L) return;
      const phu = document.createElement("div");
      phu.className = "ssp-phu no-print";
      const nutCopy = function (m) { return '<button type="button" class="ssp-copy" data-copy="' + esc(m) + '">📋 Copy</button>'; };
      phu.innerHTML = '<div class="ssp-xem-to"><div class="ssp-xem-dau">' +
        "<b>Trang " + (i + 1) + "</b>" +
        (t.oid ? '<span class="ssp-ma">Mã đơn: ' + esc(t.oid) + nutCopy(t.oid) + "</span>" : "") +
        (t.vd ? '<span class="ssp-ma">MVĐ: ' + esc(t.vd) + nutCopy(t.vd) + "</span>" : "") +
        '<button type="button" class="ssp-nut" data-to="1">🔍 Phóng to</button><button type="button" class="ssp-nut" data-dong="1">✕ Đóng</button></div>' +
        '<div class="ssp-xem-than"><canvas></canvas></div></div>';
      const cv = phu.querySelector("canvas");
      const coBan = Math.min(760, window.innerWidth - 48);
      let to = false;
      const ve = function () {
        L.veAnh(tt.file[t.f], t.p, cv, Math.round(to ? coBan * 2 : coBan)).catch(loiVeAnh);
      };
      phu.addEventListener("click", function (e) {
        if (e.target === phu || e.target.closest("[data-dong]")) { phu.remove(); return; }
        const cp = e.target.closest(".ssp-copy");
        if (cp) { saoChep(cp.getAttribute("data-copy"), cp); return; }
        const nt = e.target.closest("[data-to]");
        if (nt) { to = !to; nt.textContent = to ? "🔍 Thu nhỏ" : "🔍 Phóng to"; ve(); }
      });
      document.body.appendChild(phu);
      ve();
    }

    // ── Canh nút "In đơn" gốc / Ctrl+P: in tờ đơn KHÔNG qua ô này → báo trùng + hỏi ghi sổ ──
    window.addEventListener("afterprint", function () {
      if (dangInCuaToi) return;
      setTimeout(function () {
        try {
          const td = thuTuToDon();
          if (!td.ds.length) return;
          const s = so(); s.lamMoi();
          const trung = td.ds.filter(function (x) { return s.don(x.k); });
          const moi = td.ds.filter(function (x) { return !s.don(x.k) && !maDonLa(x.k); });
          hop({
            tieuDe: "🖨 Vừa in " + td.ds.length + " tờ đơn bằng nút In đơn", lop: trung.length ? "loi" : "",
            noiDung: (trung.length ? '<div class="ssp-do-dam"><b>⛔ ' + trung.length + " tờ ĐÃ IN TRƯỚC ĐÓ — bị TRÙNG, rút ra trước khi kẹp:</b>" +
                dsMaHtml(trung, function (x) { return "<li>Tờ " + x.so + ": " + esc(x.hien) + " (đã in " + gio(s.don(x.k)) + ")</li>"; }) + "</div>" : "") +
              (moi.length ? "Ghi nhận <b>" + moi.length + "</b> tờ vừa in vào sổ đã in? (để sau này không in trùng; nút ② sẽ in phiếu đúng các đơn này). Nếu đã bấm <b>Hủy</b> trong hộp in, chọn <b>Không</b>." : ""),
            nut: moi.length ? [{ chu: "Không — chưa in / đã hủy" }, { chu: "✓ Đã in — ghi nhận", lop: "xanh", lam: function () {
              const dsK = moi.map(function (x) { return x.k; });
              s.ghiDon(dsK); // đúng thứ tự tờ trên trang = thứ tự xấp vừa in
              tinh();
            } }] : [{ chu: "Đã hiểu", lop: "do" }],
          });
        } catch (e) { console.error("[SapXepPhieu] Lỗi kiểm tra sau khi in:", e); }
      }, 0);
    });

    // ── Hỏi lại khi rời trang lúc đang có tờ đơn / PDF (F5, đóng tab, bấm nút sang trang khác) ──
    window.addEventListener("beforeunload", function (e) {
      if (tt.trang.length || vungIn.querySelector(".invoice-box")) { e.preventDefault(); e.returnValue = ""; return ""; }
    });

    tinh();
  } catch (e) {
    console.error("[SapXepPhieu] Không gắn được ô phiếu đóng gói (trang Vận Hành vẫn chạy bình thường):", e);
  }
})();
