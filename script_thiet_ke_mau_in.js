// =========================================================================
// THIẾT KẾ MẪU IN — ZinZinMotor (trang thiet_ke_mau_in.html)
//
// - Đọc mẫu đang dùng từ sheet MAU_IN_DON (chỉ đọc, qua khóa API giống trang Vận Hành)
// - Mọi chỉnh sửa là NHÁP trên máy, có Hoàn tác / Làm lại
// - Bản in thử vẽ bằng đúng window.MauIn.veDon + sinhCss (script_mau_in.js) và style.css của trang Vận Hành
// - "In thử 1 đơn": in nháp ra giấy thật, KHÔNG lưu
// - "Lưu & áp dụng": gửi Apps Script "Mau In Don ZZM" kèm mật khẩu admin (Apps Script tự kiểm tra lại hợp lệ)
// - Lịch sử: đọc sheet MAU_IN_LICH_SU, mở bản cũ dưới dạng nháp
//
// Trang này KHÔNG đụng tới luồng xử lý của trang Vận Hành.
// =========================================================================

(function () {
  "use strict";

  if (!window.MauIn || typeof window.MauIn.veDon !== "function" || !window.MauIn.SHEET_CONFIG) {
    document.body.insertAdjacentHTML("afterbegin", '<p class="bang-tin loi">Không nạp được bộ vẽ mẫu in (script_mau_in.js). Tải lại trang (F5).</p>');
    return;
  }
  const MauIn = window.MauIn;
  const CFG = MauIn.SHEET_CONFIG;

  // Ứng dụng web Apps Script "Mau In Don ZZM" — chỉ lưu mẫu in, bắt buộc mật khẩu admin
  const URL_LUU_MAU = "https://script.google.com/macros/s/AKfycbwPtA3W_BYj0SyOHXAr_8LWFi9GkIQ0qTCdW4GhcZMFFWuu13qvZTKIu5PQ26B3rVDx0w/exec";
  const SHEET_LICH_SU = "MAU_IN_LICH_SU";
  const KHOA_TEN_NGUOI = "zzm_ten_nhan_vien"; // tên đang dùng ở trang Vận Hành (chỉ đọc)

  const KHO = { A6: [105, 148], A5: [148, 210], A4: [210, 297] };
  const PX_MOI_MM = 96 / 25.4;
  // Loại cột "ghi_chu" (tên nội bộ giữ nguyên) = cột KTGH: tên thùng / kích thước chuẩn (giai đoạn A)
  const TEN_LOAI = { so_luong: "Số lượng", sku: "Mã SKU", ten: "Tên sản phẩm", vi_tri: "Vị trí kho", ghi_chu: "Kích thước (KTGH)" };
  const TEN_CAN = { trai: "Trái", giua: "Giữa", phai: "Phải" };

  // Đơn mẫu để xem thử / in thử (số liệu do chủ dự án cung cấp)
  const DON_MAU = {
    vandon: "SPXVN066101471197",
    maDon: "2607072UCPWWBM",
    items: [
      { sku: "06430-K44-V80", name: "BỐ THẮNG SAU AB20 AB22 VA125 K2V LEAD VIS15 VIS21 SHM20 VN", loc: "A-01", qty: "1", price: 10000 },
      { sku: "06430-KPH-900", name: "BỐ THẮNG SAU FUT14 FUT18 WAL17 WAL24 WRSX19 BLADE17 VN", loc: "A-01-K2-C15-H006", qty: "2", price: 20000 },
      { sku: "12361-035-001", name: "NẮP CHE LƯỚI LỌC NHỚT AB20 VA17 VA18 ADV PCX LEAD14 LEAD17 SH18 SHM14 VIS15 VA125 K2V VN", loc: "B-05", qty: "1", price: 30000 },
      { sku: "64350-K56-V50ZC", name: "ỐP MẶT NẠ TRƯỚC WN V2 PHẢI ĐEN NHÁM (BẢN ĐEN BẠC VÀNG ĐỒNG 2019 ABS) (BẢN ĐEN XANH 2019) (BẢN ĐEN CAM 2019) (BẢN ĐEN VÀNG ĐỒNG 2020 ABS) *NHA76M* VN", loc: "C-11", qty: "3", price: 40000 },
    ],
  };

  // ── Định dạng KHI IN của style.css (khối @media print, dòng 650–779 + nút Copy dòng 813–817) ──
  // Trên màn hình trình duyệt không áp khối @media print, nên bản in thử chép lại các luật này
  // để thấy đúng như khi in. Nút "In thử" thì dùng thẳng style.css, không dùng bản chép này.
  // style.css đổi phần in → phải chép lại ở đây.
  const CSS_GIA_LAP_IN = [
    "body{margin:0;padding:0;background:#fff;color:#000;font-size:11px;}",
    ".invoice-box{border:none !important;padding:10px !important;margin-bottom:15px;background:#fff !important;color:#000 !important;box-sizing:border-box;width:100%;}",
    ".invoice-head{display:flex;justify-content:space-between;margin-bottom:10px;border-bottom:1px solid #111;padding-bottom:5px;color:#000 !important;}",
    ".invoice-head .oid-value{font-weight:800;font-size:16px;}",
    "table.inv-table{width:100%;border-collapse:collapse;background:#fff !important;color:#000 !important;}",
    "table.inv-table th{border:2px solid #111 !important;padding:6px !important;background:#ffffff !important;color:#000 !important;font-weight:normal !important;}",
    "table.inv-table td{border:1px solid #111 !important;padding:6px !important;background:#fff !important;color:#000 !important;}",
    "table.inv-table th:nth-child(1),table.inv-table td:nth-child(1),table.inv-table th:nth-child(2),table.inv-table td:nth-child(2),table.inv-table th:nth-child(4),table.inv-table td:nth-child(4){width:1%;white-space:nowrap;}",
    "table.inv-table th:nth-child(5),table.inv-table td:nth-child(5){width:5%;min-width:30px;}",
    "table.inv-table th:nth-child(3),table.inv-table td:nth-child(3){width:auto;font-size:11px;word-break:break-word;}",
    'table.inv-table th:nth-child(2),table.inv-table td.i-sku{font-size:15px !important;font-weight:bold !important;font-family:"Arial",sans-serif;}',
    "table.inv-table th:nth-child(4),table.inv-table td:nth-child(4){font-size:15px;font-weight:normal !important;}",
    "table.inv-table th:nth-child(1),table.inv-table td:nth-child(1){font-size:20px !important;font-weight:bold;text-align:center;}",
    ".circle-qty{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border:2px solid #000;border-radius:50%;font-size:15px;font-weight:normal !important;}",
    ".inv-total{text-align:right;margin-top:10px;font-weight:bold;font-size:14px;color:#000 !important;}",
    ".inv-total .num{font-size:16px;margin-left:5px;}",
    ".btn-copy-don{display:none !important;}",
  ].join("\n");

  // Chỉ dùng trong khung xem thử (không có khi in thật)
  const CSS_XEM_THU = [
    "html,body{height:auto !important;overflow:hidden !important;background:#fff !important;}",
    "#giay{position:relative;background:#fff;box-sizing:border-box;}",
    ".vung-le{position:absolute;border:1px dashed rgba(15,110,140,.35);pointer-events:none;}",
    ".dau-ngat-trang{position:absolute;left:0;right:0;border-top:1.5px dashed #c2410c;pointer-events:none;}",
    ".dau-ngat-trang span{position:absolute;right:4px;top:-9px;background:#fff;color:#c2410c;font:600 10px 'Segoe UI',sans-serif;padding:0 4px;}",
    "table.inv-table th,table.inv-table td,.invoice-head,.inv-total,.mi-chan-don{cursor:pointer;}",
    ".cot-dang-chon{box-shadow:inset 0 0 0 999px rgba(15,110,140,.10);}",
    "@keyframes chop{0%{outline:3px solid #f2b705}100%{outline:3px solid rgba(242,183,5,0)}}",
    ".vua-doi{animation:chop 1.1s ease-out;outline-offset:-1px;}",
    "@media (prefers-reduced-motion: reduce){.vua-doi{animation:none;outline:2px solid #f2b705;}}",
  ].join("\n");

  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  };
  const sach = function (s) { return String(s).replace(/[<>]/g, ""); }; // Apps Script không nhận < >

  // ── KIỂU MẶC ĐỊNH KHI IN CỦA TỪNG LOẠI CỘT (để hiện "Mặc định: …" cho người dùng) ──
  function mdCot(loai) {
    const k = MauIn.KIEU_MAC_DINH.in[loai] || {};
    return {
      co: k.coChu || 11, // không có luật riêng → theo cỡ chữ chung khi in (11px)
      dam: k.dam ? k.dam.td : false,
      can: k.canGiua ? "giua" : "trai",
      phong: k.phong ? k.phong.td : null,
      rong: k.rong === "auto" ? "tự động" : k.xuongDong === false ? "vừa chữ" : k.rong,
    };
  }

  // Đưa mẫu về đúng dạng lưu (giống mauDeLuu trong Apps Script), thứ tự khóa cố định để so sánh được
  function chuanHoa(m) {
    const t = m.trang || {};
    const trong = function (v) { return v === undefined || v === "" ? null : v; };
    const macDinh = function (v, khoa) { return v === undefined ? MauIn.TRANG_MAC_DINH[khoa] : v; };
    return {
      bat: m.bat,
      dauDon: { nhanMaVanDon: m.dauDon.nhanMaVanDon, nhanMaDon: m.dauDon.nhanMaDon },
      cot: m.cot.map(function (c) {
        return {
          loai: c.loai, tieuDe: c.tieuDe, hien: c.hien, canLe: trong(c.canLe), doRong: trong(c.doRong),
          coChu: trong(c.coChu), kieuChu: trong(c.kieuChu), phong: trong(c.phong),
        };
      }),
      khoanhTronSoLuong: m.khoanhTronSoLuong,
      nhanTongTien: m.nhanTongTien,
      // Bản lưu đời cũ thiếu mục nào (phiên bản 1 chưa có cài đặt trang; trước GĐ B chưa có hienQr / hienThung)
      // → lấy giá trị mặc định, giống cách trang Vận Hành đọc sheet đời cũ
      trang: {
        khoGiay: macDinh(t.khoGiay, "khoGiay"), leMm: macDinh(t.leMm, "leMm"), coChuMaDon: macDinh(t.coChuMaDon, "coChuMaDon"),
        hienTongTien: macDinh(t.hienTongTien, "hienTongTien"), chanDon: macDinh(t.chanDon, "chanDon"),
        hienQr: macDinh(t.hienQr, "hienQr"), hienThung: macDinh(t.hienThung, "hienThung"),
      },
    };
  }

  // Mẫu gốc = mẫu in viết sẵn trong hệ thống, công tắc tắt
  function mauGoc() {
    const g = MauIn.MAU_MAC_DINH;
    return chuanHoa({
      bat: false,
      dauDon: g.dauDon,
      cot: g.cot.map(function (c) {
        return { loai: c.loai, tieuDe: c.tieuDe, hien: true, canLe: c.canLe, doRong: null, coChu: null, kieuChu: null, phong: null };
      }),
      khoanhTronSoLuong: g.khoanhTronSoLuong,
      nhanTongTien: g.nhanTongTien,
      trang: MauIn.TRANG_MAC_DINH,
    });
  }

  // ── TRẠNG THÁI ──
  let nhap = mauGoc(); // mẫu đang chỉnh
  let banDau = JSON.stringify(nhap); // mẫu đang dùng (lúc tải / lần lưu gần nhất)
  let dangDung = { daTai: false, phienBan: null, bat: false, capNhat: "" };
  let cotChon = "sku";
  const lichSuThaoTac = []; // các bước để Hoàn tác
  const lamLaiThaoTac = []; // các bước vừa hoàn tác, để Làm lại
  let nhomDangMo = null; // kéo thanh trượt / gõ chữ liên tục = 1 bước hoàn tác
  let doiCuoi = null; // chỗ vừa đổi → chớp vàng trên bản in thử
  let docXem = null; // tài liệu trong khung xem thử

  const cot = function (loai) { return nhap.cot.find(function (c) { return c.loai === loai; }); };

  function ghiLai(cho) {
    lichSuThaoTac.push(JSON.stringify(nhap));
    if (lichSuThaoTac.length > 200) lichSuThaoTac.shift();
    lamLaiThaoTac.length = 0; // làm thao tác mới thì không còn gì để "làm lại"
    doiCuoi = cho || null;
  }
  // Mọi chỉnh sửa → bật mẫu tùy chỉnh (lưu xong trang Vận Hành sẽ in theo mẫu này)
  function doi(cho, fn) {
    nhomDangMo = null;
    ghiLai(cho);
    fn();
    nhap.bat = true;
    veLai();
  }
  function doiGop(nhom, cho, fn) {
    if (nhomDangMo !== nhom) { ghiLai(cho); nhomDangMo = nhom; } else doiCuoi = cho;
    fn();
    nhap.bat = true;
    veLai();
  }
  function thayNhap(m, cho) {
    nhomDangMo = null;
    ghiLai(cho);
    nhap = chuanHoa(m);
    veLai();
  }
  document.addEventListener("change", function () { nhomDangMo = null; }, true);

  // Mẫu dùng để vẽ = đúng thứ trang Vận Hành sẽ in nếu lưu nháp này
  function mauVe(m) {
    return m.bat ? MauIn.mauDeVe(Object.assign({}, m, { phienBan: "nháp" })) : MauIn.MAU_MAC_DINH;
  }
  function trangVe(mv) {
    return mv.tuyChinh ? mv.trang : MauIn.TRANG_MAC_DINH;
  }

  // ── ĐƠN MẪU: gom / sắp / tổng / dễ vỡ / copy — giống hệt nút "Tạo mẫu in" trong script.js ──
  function ctxDonMau() {
    const items = DON_MAU.items.map(function (x) { return Object.assign({}, x); });
    items.sort(function (a, b) {
      const vA = a.loc === "Chưa xếp vị trí" || a.loc === "" ? "" : a.loc;
      const vB = b.loc === "Chưa xếp vị trí" || b.loc === "" ? "" : b.loc;
      if (vA === "" && vB === "") return 0;
      if (vA === "") return 1;
      if (vB === "") return -1;
      return vA.localeCompare(vB, "vi");
    });
    const total = items.reduce(function (s, it) { return s + it.price * (parseInt(it.qty, 10) || 0); }, 0);
    const coDeVo = $("mau-de-vo").checked;
    let copyText = "📦 ĐƠN: " + DON_MAU.maDon + "\n🚚 VĐ: " + DON_MAU.vandon + "\n━━━━━━━━━━━━━━━━━━━━\n";
    items.forEach(function (it) {
      copyText += (it.loc && it.loc !== "Chưa xếp vị trí" ? "[" + it.loc + "] " : "") + it.sku + " x" + it.qty + "\n";
    });
    copyText += "━━━━━━━━━━━━━━━━━━━━\n💰 Tổng: " + total.toLocaleString("vi-VN") + " đ";
    if (coDeVo) copyText += "\n⚠️ Có Hàng Dễ Vỡ";
    return {
      idDon: DON_MAU.maDon,
      don: { vandon: DON_MAU.vandon, items: items },
      total: total,
      canhBaoDeVo: coDeVo ? '<div class="canh-bao-de-vo">⚠️ Lưu ý: Có Hàng Dễ Vỡ</div>' : "",
      copyText: copyText,
    };
  }

  // Lấy phần "@media print { … }" trong CSS sinh tự động → dùng như luật thường trong khung xem thử
  function khoiIn(css) {
    const dau = css.indexOf("@media print {\n");
    const cuoi = css.indexOf("\n}\n@page");
    return dau >= 0 && cuoi > dau ? css.slice(dau + 15, cuoi) : "";
  }

  // =========================================================================
  // VẼ BẢNG ĐIỀU KHIỂN
  // =========================================================================
  function veKhoGiay() {
    $("kho-giay").innerHTML = Object.keys(KHO).map(function (k) {
      const w = KHO[k][0], h = KHO[k][1];
      return '<button type="button" data-kho="' + k + '" aria-pressed="' + (nhap.trang.khoGiay === k) + '"><span class="to-nho" style="width:' + w / 7 + "px;height:" + h / 7 + 'px"></span><b>' + k + "</b><small>" + w + " × " + h + " mm</small></button>";
    }).join("");
    const md = MauIn.TRANG_MAC_DINH.leMm;
    $("le-giay").value = nhap.trang.leMm;
    $("le-giay-gt").textContent = nhap.trang.leMm + " mm";
    $("moc-le-gt").value = md;
    const laMd = nhap.trang.leMm === md;
    $("le-md-chu").innerHTML = laMd ? "✓ Đang dùng lề mặc định (" + md + " mm)" : "Mặc định: <b>" + md + " mm</b>";
    $("le-md").disabled = laMd;
  }

  function veDsCot() {
    $("ds-cot").innerHTML = nhap.cot.map(function (c, i) {
      return '<li draggable="true" data-loai="' + c.loai + '" class="' + (c.loai === cotChon ? "dang-chon" : "") + (c.hien ? "" : " an") + '">' +
        '<span class="tay-keo" title="Kéo để đổi thứ tự" aria-hidden="true">⠿</span>' +
        '<button type="button" class="mat" data-an="' + c.loai + '" aria-label="' + (c.hien ? "Ẩn" : "Hiện") + " cột " + esc(c.tieuDe) + '" title="' + (c.hien ? "Đang hiện — bấm để ẩn" : "Đang ẩn — bấm để hiện") + '">' + (c.hien ? "👁" : "◌") + "</button>" +
        '<input class="ten-cot" data-ten="' + c.loai + '" value="' + esc(c.tieuDe) + '" maxlength="40" aria-label="Tiêu đề cột ' + TEN_LOAI[c.loai] + '"' +
          (c.loai === "ghi_chu" && c.tieuDe !== "KTGH" ? ' title="Gợi ý: đặt tiêu đề KTGH cho cột kích thước"' : "") + ">" +
        (c.loai === "ghi_chu" && c.tieuDe !== "KTGH" ? '<button type="button" class="nut-md" data-dat-ktgh="1" title="Đổi tiêu đề cột này thành KTGH">Đặt KTGH</button>' : "") +
        '<span class="loai-cot">' + TEN_LOAI[c.loai] + "</span>" +
        '<button type="button" class="nut-nho" data-len="' + c.loai + '" aria-label="Đưa lên"' + (i === 0 ? " disabled" : "") + ">↑</button>" +
        '<button type="button" class="nut-nho" data-xuong="' + c.loai + '" aria-label="Đưa xuống"' + (i === nhap.cot.length - 1 ? " disabled" : "") + ">↓</button>" +
        "</li>";
    }).join("");
  }

  function nhomChon(id, ds, giaTri, khoa) {
    $(id).innerHTML = ds.map(function (x) {
      return '<button type="button" data-' + khoa + '="' + x[0] + '" aria-pressed="' + (giaTri === x[0]) + '">' + x[1] + "</button>";
    }).join("");
  }

  function veChuCot() {
    const c = cot(cotChon), md = mdCot(cotChon);
    $("tieu-de-chu").textContent = "Chữ của cột “" + c.tieuDe + "”";
    const co = c.coChu || md.co;
    $("co-chu").value = co;
    $("co-chu-gt").textContent = co + " px";
    $("moc-co-chu-gt").value = md.co;
    $("co-chu-md-chu").innerHTML = c.coChu ? "Mặc định: <b>" + md.co + " px</b>" : "✓ Đang dùng cỡ mặc định (" + md.co + " px)";
    $("co-md").disabled = !c.coChu;
    $("co-tru").disabled = co <= 6;
    $("co-cong").disabled = co >= 48;

    nhomChon("kieu-chu", [["md", "Mặc định <small>(" + (md.dam ? "đậm" : "thường") + ")</small>"], ["dam", "<b>Đậm</b>"], ["thuong", "Thường"]], c.kieuChu || "md", "kieu");
    nhomChon("can-le", [["md", "Mặc định <small>(" + TEN_CAN[md.can].toLowerCase() + ")</small>"], ["trai", "Trái"], ["giua", "Giữa"], ["phai", "Phải"]], c.canLe || "md", "can");
    const rong = c.doRong == null ? "md" : c.doRong === "vua" ? "vua" : "pt";
    nhomChon("do-rong", [["md", "Mặc định <small>(" + md.rong + ")</small>"], ["vua", "Vừa chữ"], ["pt", "Tùy chọn %"]], rong, "rong");
    $("dong-phan-tram").hidden = rong !== "pt";
    if (rong === "pt") {
      $("phan-tram").value = parseInt(c.doRong, 10);
      $("phan-tram-gt").textContent = c.doRong;
    }

    const phongMd = md.phong ? '"' + md.phong + '", sans-serif' : "'Segoe UI', system-ui, sans-serif";
    $("ds-phong").innerHTML = [null].concat(MauIn.DS.PHONG).map(function (p) {
      const chon = (c.phong || null) === p;
      const fam = p ? "'" + p + "', sans-serif" : phongMd;
      const ten = p || "Mặc định (" + (md.phong || "phông hệ thống") + ")";
      return '<button type="button" data-phong="' + (p || "") + '" aria-pressed="' + chon + '"><span class="mau-chu" style="font-family:' + fam.replace(/"/g, "'") + '">0O 83500</span><small>' + ten + "</small></button>";
    }).join("");
  }

  function veDauChan() {
    const dat = function (id, v) { if (document.activeElement !== $(id)) $(id).value = v; };
    dat("nhan-vd", nhap.dauDon.nhanMaVanDon);
    dat("nhan-md", nhap.dauDon.nhanMaDon);
    dat("nhan-tong", nhap.nhanTongTien);
    dat("chan-don", nhap.trang.chanDon);
    const md = MauIn.TRANG_MAC_DINH.coChuMaDon;
    $("co-ma-don").value = nhap.trang.coChuMaDon;
    $("co-ma-don-gt").textContent = nhap.trang.coChuMaDon + " px";
    $("moc-ma-don-gt").value = md;
    const laMd = nhap.trang.coChuMaDon === md;
    $("co-ma-don-md-chu").innerHTML = laMd ? "✓ Đang dùng cỡ mặc định (" + md + " px)" : "Mặc định: <b>" + md + " px</b>";
    $("co-ma-don-md").disabled = laMd;
    $("hien-tong").checked = nhap.trang.hienTongTien;
    $("khoanh-tron").checked = nhap.khoanhTronSoLuong;
    $("hien-qr").checked = nhap.trang.hienQr;
    $("hien-thung").checked = nhap.trang.hienThung;
    $("dem-chan-don").textContent = nhap.trang.chanDon.length + " / 200";
  }

  // =========================================================================
  // BẢN IN THỬ (khung riêng, nạp style.css giống trang Vận Hành)
  // =========================================================================
  function khoiTaoKhungXem() {
    const khung = $("khung-xem-thu");
    khung.addEventListener("load", function () {
      try {
        docXem = khung.contentDocument;
      } catch (e) {
        docXem = null;
      }
      if (!docXem || !docXem.getElementById("giay")) {
        docXem = null;
        bangTin("Trình duyệt chặn khung xem thử — bản in thử không hiện được. Vẫn có thể bấm “In thử 1 đơn”.", true);
        return;
      }
      docXem.addEventListener("click", bamTrenBanIn);
      veXemThu();
    });
    khung.srcdoc = '<!doctype html><html lang="vi"><head><meta charset="utf-8"><link rel="stylesheet" href="style.css">' +
      '<style id="gia-lap-in">' + CSS_GIA_LAP_IN + '</style><style id="mau-in-tuy-chinh"></style><style>' + CSS_XEM_THU + "</style></head>" +
      '<body><div id="giay"></div></body></html>';
  }

  function veXemThu() {
    if (!docXem) return;
    const mv = mauVe(nhap);
    const tr = trangVe(mv);
    const w = KHO[tr.khoGiay][0], h = KHO[tr.khoGiay][1], le = tr.leMm;
    docXem.getElementById("mau-in-tuy-chinh").textContent = mv.tuyChinh ? khoiIn(MauIn.sinhCss(mv)) : "";
    const giay = docXem.getElementById("giay");
    giay.style.cssText = "width:" + w + "mm;min-height:" + h + "mm;padding:" + le + "mm";
    giay.innerHTML = '<span class="vung-le" style="inset:' + le + 'mm"></span>' + MauIn.veDon(ctxDonMau(), mv);

    // Ước tính chỗ sang tờ mới
    const hop = giay.querySelector(".invoice-box");
    const caoTrang = (h - 2 * le) * PX_MOI_MM;
    const caoDon = hop ? hop.getBoundingClientRect().height : 0;
    const soTo = caoTrang > 0 ? Math.max(1, Math.ceil((caoDon - 0.5) / caoTrang)) : 1;
    for (let k = 1; k < soTo; k++) {
      const vach = docXem.createElement("div");
      vach.className = "dau-ngat-trang";
      vach.style.top = le * PX_MOI_MM + k * caoTrang + "px";
      vach.innerHTML = "<span>↓ hết tờ " + k + ", sang tờ " + (k + 1) + "</span>";
      giay.appendChild(vach);
    }
    // Bảng rộng hơn phần in được (trong lề) → cột bên phải bị cắt khi in, chỉnh lề không cứu được
    const bang = giay.querySelector("table.inv-table");
    const mepPhai = giay.getBoundingClientRect().right - le * PX_MOI_MM;
    const duRong = bang ? Math.round(bang.getBoundingClientRect().right - mepPhai) : 0;
    const canhBao = [];
    if (duRong > 0) {
      canhBao.push("⚠️ Bảng rộng hơn phần in được của tờ " + tr.khoGiay + " khoảng " + Math.round(duRong / PX_MOI_MM) +
        " mm — phần bên phải sẽ bị CẮT MẤT khi in (tăng lề không giúp được, còn cắt nhiều hơn). Cách sửa: bấm cột không xuống dòng (Mã SKU, Vị Trí Kho) → Độ rộng “Tùy chọn %”, giảm cỡ chữ, ẩn bớt cột hoặc chọn khổ lớn hơn.");
    }
    if (soTo > 1) {
      canhBao.push("⚠️ Đơn mẫu này dài hơn 1 tờ " + tr.khoGiay + " — khi in sẽ sang " + soTo + " tờ (đường gạch cam là chỗ ước tính sang tờ mới). Có thể giảm cỡ chữ, thu hẹp lề hoặc chọn khổ lớn hơn.");
    }
    const cb = $("canh-bao-trang");
    cb.hidden = canhBao.length === 0;
    cb.innerHTML = canhBao.map(esc).join("<br>");

    danhDauCotChon(mv);
    chopChoVuaDoi(mv);

    const khung = $("khung-xem-thu");
    khung.style.width = w * PX_MOI_MM + "px";
    khung.style.height = giay.offsetHeight + "px";
    canTo(tr);
  }

  // Ô của 1 loại cột trên bản in thử (mẫu tùy chỉnh có class mi-…; mẫu gốc theo vị trí)
  function oCuaCot(mv, loai) {
    if (mv.tuyChinh) return docXem.querySelectorAll("th.mi-" + loai + ",td.mi-" + loai);
    const i = mv.cot.findIndex(function (c) { return c.loai === loai; });
    return i < 0 ? [] : docXem.querySelectorAll("table.inv-table tr > :nth-child(" + (i + 1) + ")");
  }

  function danhDauCotChon(mv) {
    oCuaCot(mv, cotChon).forEach(function (o) { o.classList.add("cot-dang-chon"); });
  }

  function chopChoVuaDoi(mv) {
    if (!doiCuoi) return;
    let cacO = [];
    if (doiCuoi.indexOf("cot:") === 0) cacO = Array.prototype.slice.call(oCuaCot(mv, doiCuoi.slice(4)));
    else {
      const chon = { dau: ".invoice-head", maDon: ".oid-value", tong: ".inv-total", chan: ".mi-chan-don", bang: "table.inv-table", qr: ".invoice-head", thung: ".mi-thung" }[doiCuoi];
      if (chon) cacO = Array.prototype.slice.call(docXem.querySelectorAll(chon));
    }
    cacO.forEach(function (o) { o.classList.add("vua-doi"); });
    doiCuoi = null;
  }

  // Thu nhỏ / phóng to tờ giấy cho vừa khung, giữ đúng tỉ lệ
  function canTo(tr) {
    const khung = $("khung-xem-thu"), boc = $("khung-giay");
    const w = khung.offsetWidth, h = khung.offsetHeight; // kích thước thật (không tính phóng to)
    if (!w) return;
    const rongCo = $("mat-ban").clientWidth - 32;
    const tiLe = Math.max(0.3, Math.min(1.6, rongCo / w));
    khung.style.transform = "scale(" + tiLe + ")";
    boc.style.width = w * tiLe + "px";
    boc.style.height = h * tiLe + "px";
    const t = tr || trangVe(mauVe(nhap));
    $("nhan-kho").textContent = t.khoGiay + " · " + KHO[t.khoGiay][0] + " × " + KHO[t.khoGiay][1] + " mm · lề " + t.leMm + " mm · đang xem " + Math.round(tiLe * 100) + "%";
  }

  function bamTrenBanIn(e) {
    const mv = mauVe(nhap);
    const o = e.target.closest("th,td");
    if (o && o.closest("table.inv-table")) {
      let loai = null;
      o.classList.forEach(function (lop) { if (lop.indexOf("mi-") === 0) loai = lop.slice(3); });
      if (!loai && mv.cot[o.cellIndex]) loai = mv.cot[o.cellIndex].loai;
      if (!loai) return;
      cotChon = loai;
      doiCuoi = "cot:" + loai;
      veLai();
      cuonToi("h-chu");
      return;
    }
    if (e.target.closest(".invoice-head,.inv-total,.mi-chan-don")) cuonToi("h-dau");
  }

  function cuonToi(id) {
    $(id).scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
  }

  // =========================================================================
  // DANH SÁCH THAY ĐỔI (so với mẫu đang dùng)
  // =========================================================================
  function danhSachThayDoi() {
    const a = JSON.parse(banDau), b = nhap, ds = [];
    if (a.bat !== b.bat) ds.push(b.bat ? "Bật mẫu tùy chỉnh (trang Vận Hành in theo mẫu này)" : "Quay về mẫu gốc (tắt mẫu tùy chỉnh)");
    if (a.trang.khoGiay !== b.trang.khoGiay) ds.push("Khổ giấy: " + a.trang.khoGiay + " → " + b.trang.khoGiay);
    if (a.trang.leMm !== b.trang.leMm) ds.push("Lề giấy: " + a.trang.leMm + " → " + b.trang.leMm + " mm");
    if (a.trang.coChuMaDon !== b.trang.coChuMaDon) ds.push("Cỡ chữ mã đơn: " + a.trang.coChuMaDon + " → " + b.trang.coChuMaDon + " px");
    if (a.trang.hienTongTien !== b.trang.hienTongTien) ds.push(b.trang.hienTongTien ? "Hiện tổng tiền" : "Ẩn tổng tiền");
    if (a.trang.hienQr !== b.trang.hienQr) ds.push(b.trang.hienQr ? "Hiện mã QR mã đơn" : "Ẩn mã QR mã đơn");
    if (a.trang.hienThung !== b.trang.hienThung) ds.push(b.trang.hienThung ? "Hiện dòng \"Thùng: …\"" : "Ẩn dòng \"Thùng: …\"");
    if (a.khoanhTronSoLuong !== b.khoanhTronSoLuong) ds.push(b.khoanhTronSoLuong ? "Bật khoanh tròn SL > 1" : "Tắt khoanh tròn SL > 1");
    if (a.trang.chanDon !== b.trang.chanDon) ds.push(b.trang.chanDon ? "Dòng chữ cuối đơn: “" + b.trang.chanDon + "”" : "Bỏ dòng chữ cuối đơn");
    if (a.dauDon.nhanMaVanDon !== b.dauDon.nhanMaVanDon) ds.push("Nhãn vận đơn: “" + a.dauDon.nhanMaVanDon + "” → “" + b.dauDon.nhanMaVanDon + "”");
    if (a.dauDon.nhanMaDon !== b.dauDon.nhanMaDon) ds.push("Nhãn mã đơn: “" + a.dauDon.nhanMaDon + "” → “" + b.dauDon.nhanMaDon + "”");
    if (a.nhanTongTien !== b.nhanTongTien) ds.push("Nhãn tổng tiền: “" + a.nhanTongTien + "” → “" + b.nhanTongTien + "”");
    if (a.cot.map(function (c) { return c.loai; }).join() !== b.cot.map(function (c) { return c.loai; }).join()) {
      ds.push("Thứ tự cột: " + b.cot.map(function (c) { return c.tieuDe; }).join(" → "));
    }
    const coTxt = function (v, loai) { return v ? v + " px" : mdCot(loai).co + " px (mặc định)"; };
    const rongTxt = function (v) { return v == null ? "mặc định" : v === "vua" ? "vừa chữ" : v; };
    b.cot.forEach(function (c) {
      const o = a.cot.find(function (x) { return x.loai === c.loai; });
      if (!o) return;
      const ten = "Cột " + c.tieuDe;
      if (o.hien !== c.hien) ds.push(ten + ": " + (c.hien ? "hiện" : "ẩn"));
      if (o.tieuDe !== c.tieuDe) ds.push("Tiêu đề cột “" + o.tieuDe + "” → “" + c.tieuDe + "”");
      if (o.coChu !== c.coChu) ds.push(ten + ": cỡ chữ " + coTxt(o.coChu, c.loai) + " → " + coTxt(c.coChu, c.loai));
      if (o.kieuChu !== c.kieuChu) ds.push(ten + ": kiểu chữ " + ({ dam: "đậm", thuong: "thường" }[c.kieuChu] || "mặc định"));
      if (o.phong !== c.phong) ds.push(ten + ": phông " + (c.phong || "mặc định"));
      if (o.canLe !== c.canLe) ds.push(ten + ": căn " + (c.canLe ? TEN_CAN[c.canLe].toLowerCase() : "mặc định"));
      if (o.doRong !== c.doRong) ds.push(ten + ": độ rộng " + rongTxt(o.doRong) + " → " + rongTxt(c.doRong));
    });
    return ds;
  }

  function veLai() {
    veKhoGiay();
    veDsCot();
    veChuCot();
    veDauChan();
    veXemThu();
    const n = danhSachThayDoi().length;
    const chip = $("chip-thay-doi");
    chip.className = "chip" + (n ? " nhap" : "");
    chip.innerHTML = '<span class="cham"></span>' + (n ? n + " thay đổi chưa lưu" : "Chưa có thay đổi");
    $("nut-hoan-tac").disabled = lichSuThaoTac.length === 0;
    $("nut-lam-lai").disabled = lamLaiThaoTac.length === 0;
    $("nut-luu").disabled = n === 0 || !dangDung.daTai;
    $("nut-luu").title = dangDung.daTai ? "" : "Chưa tải được mẫu đang dùng nên tạm khóa nút Lưu";
  }

  function veChipPhienBan() {
    const chip = $("chip-phien-ban");
    if (!dangDung.daTai) {
      chip.className = "chip loi";
      chip.innerHTML = '<span class="cham"></span>Chưa tải được mẫu đang dùng';
      return;
    }
    chip.className = "chip";
    chip.innerHTML = '<span class="cham"></span>Đang dùng: ' + (dangDung.bat ? "mẫu tùy chỉnh" : "mẫu gốc") + " · phiên bản " + esc(dangDung.phienBan);
    chip.title = dangDung.capNhat ? "Lưu lần cuối: " + dangDung.capNhat : "";
  }

  function bangTin(chu, laLoi, nutThuLai) {
    const b = $("bang-tin");
    if (!chu) { b.hidden = true; return; }
    b.className = "bang-tin" + (laLoi ? " loi" : "");
    b.textContent = chu;
    if (nutThuLai) {
      const nut = document.createElement("button");
      nut.className = "nut";
      nut.textContent = "Thử lại";
      nut.addEventListener("click", taiMauDangDung);
      b.appendChild(nut);
    }
    b.hidden = false;
  }

  function thongBao(chu) {
    const t = $("thong-bao");
    t.textContent = chu;
    t.hidden = false;
    clearTimeout(thongBao.h);
    thongBao.h = setTimeout(function () { t.hidden = true; }, 3800);
  }

  // =========================================================================
  // ĐỌC SHEET (chỉ đọc)
  // =========================================================================
  async function docSheet(vung, cachHien) {
    const url = "https://sheets.googleapis.com/v4/spreadsheets/" + CFG.SPREADSHEET_ID + "/values/" + encodeURIComponent(vung) +
      "?valueRenderOption=" + cachHien + "&key=" + CFG.API_KEY;
    const huy = new AbortController();
    const henGio = setTimeout(function () { huy.abort(); }, 10000);
    try {
      const resp = await fetch(url, { signal: huy.signal, cache: "no-store" });
      if (!resp.ok) throw new Error("Mã lỗi " + resp.status);
      return (await resp.json()).values || [];
    } finally {
      clearTimeout(henGio);
    }
  }

  async function docMauDangDung() {
    const bang = await docSheet(CFG.SHEET_NAME + "!" + CFG.VUNG, "UNFORMATTED_VALUE");
    const doc = MauIn.phanTichSheet(bang);
    const dongCapNhat = bang.find(function (d) { return d && d[0] === "CAP_NHAT"; });
    let mau = null, loi;
    try {
      mau = chuanHoa(doc);
      loi = MauIn.kiemTraMau(mau);
    } catch (e) {
      loi = [e.message];
    }
    return { mau: mau, loi: loi, phienBan: doc.phienBan, capNhat: dongCapNhat ? String(dongCapNhat[1]) : "" };
  }

  async function taiMauDangDung() {
    bangTin("");
    $("chip-phien-ban").className = "chip";
    $("chip-phien-ban").innerHTML = '<span class="cham"></span>Đang tải mẫu đang dùng…';
    try {
      const kq = await docMauDangDung();
      dangDung = { daTai: true, phienBan: kq.phienBan, bat: false, capNhat: kq.capNhat };
      if (kq.loi.length) {
        console.error("[Thiết kế mẫu in] Mẫu đang lưu không hợp lệ:\n - " + kq.loi.join("\n - "));
        nhap = mauGoc();
        bangTin("Mẫu đang lưu có chỗ không hợp lệ nên trang Vận Hành đang in mẫu gốc. Trang này nạp mẫu gốc làm nháp — chỉnh rồi lưu lại sẽ sửa được.", true);
      } else {
        nhap = kq.mau;
        dangDung.bat = kq.mau.bat;
        if (!kq.mau.bat) bangTin("Trang Vận Hành đang in mẫu gốc. Lần lưu đầu tiên sẽ bật mẫu tùy chỉnh theo đúng bản in thử bên phải.");
      }
      banDau = JSON.stringify(nhap);
    } catch (e) {
      console.error("[Thiết kế mẫu in] Không đọc được mẫu đang dùng:", e);
      dangDung = { daTai: false, phienBan: null, bat: false, capNhat: "" };
      nhap = mauGoc();
      banDau = JSON.stringify(nhap);
      bangTin("Không tải được mẫu đang dùng (kiểm tra mạng). Đang hiện mẫu gốc; nút Lưu tạm khóa để tránh ghi đè.", true, true);
    }
    lichSuThaoTac.length = 0;
    lamLaiThaoTac.length = 0;
    veChipPhienBan();
    veLai();
  }

  // =========================================================================
  // LƯU (Apps Script kiểm tra mật khẩu + hợp lệ, ghi lịch sử trước rồi mới ghi mẫu)
  // =========================================================================
  async function guiLuu(duLieu) {
    const huy = new AbortController();
    const henGio = setTimeout(function () { huy.abort(); }, 45000);
    try {
      // Gửi dạng chữ thường (text/plain) → không phát sinh bước kiểm tra CORS trước
      const resp = await fetch(URL_LUU_MAU, { method: "POST", body: JSON.stringify(duLieu), signal: huy.signal });
      if (!resp.ok) throw new Error("Mã lỗi " + resp.status);
      return await resp.json();
    } finally {
      clearTimeout(henGio);
    }
  }

  let dangLuu = false;
  let choPhepGhiDe = false;

  function thongDiepLuu(chu, loai) {
    const p = $("thong-diep-luu");
    p.hidden = !chu;
    p.className = "thong-diep " + (loai || "loi");
    p.textContent = chu || "";
  }

  function moHopLuu() {
    $("ds-thay-doi").innerHTML = danhSachThayDoi().map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("");
    if (!$("nguoi-luu").value) {
      try { $("nguoi-luu").value = localStorage.getItem(KHOA_TEN_NGUOI) || ""; } catch (e) { /* không đọc được tên → để trống */ }
    }
    choPhepGhiDe = false;
    $("xac-nhan-luu").textContent = "Lưu & áp dụng";
    thongDiepLuu("");
    $("hop-luu").hidden = false;
    ($("nguoi-luu").value ? $("ghi-chu") : $("nguoi-luu")).focus();
  }

  async function xacNhanLuu(e) {
    e.preventDefault();
    if (dangLuu) return;
    const matKhau = $("mat-khau").value;
    const nguoi = sach($("nguoi-luu").value.trim());
    if (!nguoi) { thongDiepLuu("Nhập tên người lưu."); $("nguoi-luu").focus(); return; }
    if (!matKhau) { thongDiepLuu("Nhập mật khẩu admin để lưu."); $("mat-khau").focus(); return; }
    const loi = MauIn.kiemTraMau(nhap);
    if (loi.length) {
      console.error("[Thiết kế mẫu in] Mẫu nháp không hợp lệ:\n - " + loi.join("\n - "));
      thongDiepLuu("Mẫu đang chỉnh có chỗ chưa hợp lệ nên chưa lưu.");
      return;
    }
    const nut = $("xac-nhan-luu");
    dangLuu = true;
    nut.disabled = true;
    nut.textContent = "Đang lưu…";
    let daGui = false;
    try {
      // 1. Có ai vừa lưu bản khác trong lúc mình đang chỉnh?
      if (!choPhepGhiDe) {
        const moi = await docMauDangDung();
        if (String(moi.phienBan) !== String(dangDung.phienBan)) {
          choPhepGhiDe = true;
          thongDiepLuu("Có người vừa lưu phiên bản " + moi.phienBan + (moi.capNhat ? " (" + moi.capNhat + ")" : "") +
            " trong lúc bạn đang chỉnh. Bấm “Vẫn lưu đè” để thay bằng bản của bạn, hoặc Hủy rồi tải lại trang để xem bản mới.", "canh-bao");
          return;
        }
      }
      // 2. Gửi lưu
      daGui = true;
      const kq = await guiLuu({ hanh_dong: "luu_mau", mat_khau: matKhau, mau: nhap, nguoi: nguoi, ghi_chu: sach($("ghi-chu").value.trim()) });
      if (!kq || !kq.ok) {
        const thongBaoLoi = kq && typeof kq.loi === "string" ? kq.loi : "";
        console.error("[Thiết kế mẫu in] Lưu không thành công:", thongBaoLoi);
        if (/mật khẩu/i.test(thongBaoLoi)) thongDiepLuu(thongBaoLoi);
        else if (/^Mẫu không hợp lệ/.test(thongBaoLoi)) thongDiepLuu("Mẫu đang chỉnh có chỗ chưa hợp lệ nên chưa lưu.");
        else thongDiepLuu("Máy chủ lưu mẫu báo lỗi, chưa lưu được. Thử lại sau ít phút.");
        return;
      }
      // 3. Đọc lại để chắc chắn đã ghi đúng
      const daLuu = JSON.parse(JSON.stringify(nhap));
      let khop = false;
      try {
        const lai = await docMauDangDung();
        khop = !lai.loi.length && JSON.stringify(lai.mau) === JSON.stringify(chuanHoa(daLuu));
        dangDung.capNhat = lai.capNhat;
      } catch (e2) {
        khop = false;
      }
      dangDung.phienBan = kq.phien_ban;
      dangDung.bat = daLuu.bat;
      banDau = JSON.stringify(chuanHoa(daLuu));
      $("mat-khau").value = "";
      $("ghi-chu").value = "";
      $("hop-luu").hidden = true;
      bangTin(dangDung.bat ? "" : "Trang Vận Hành sẽ in mẫu gốc (đã tắt mẫu tùy chỉnh).");
      veChipPhienBan();
      veLai();
      thongBao(khop
        ? "✓ Đã lưu phiên bản " + kq.phien_ban + ". Các máy nhận mẫu mới khi tải lại trang Vận Hành (F5)."
        : "Đã lưu phiên bản " + kq.phien_ban + " nhưng chưa đọc lại kiểm tra được — tải lại trang này để xem.");
    } catch (loiMang) {
      console.error("[Thiết kế mẫu in] Lỗi kết nối khi lưu:", loiMang);
      thongDiepLuu(daGui
        ? "Mất kết nối trong lúc lưu — không rõ đã lưu chưa. Đóng hộp này, mở 🕘 Lịch sử để kiểm tra trước khi lưu lại."
        : "Không kết nối được. Kiểm tra mạng rồi thử lại.");
    } finally {
      dangLuu = false;
      nut.disabled = false;
      nut.textContent = choPhepGhiDe && !$("hop-luu").hidden ? "Vẫn lưu đè" : "Lưu & áp dụng";
    }
  }

  // =========================================================================
  // LỊCH SỬ
  // =========================================================================
  let banLichSu = [];

  async function moLichSu() {
    $("hop-lich-su").hidden = false;
    const ds = $("ds-phien-ban"), td = $("thong-diep-lich-su");
    ds.innerHTML = "";
    td.hidden = false;
    td.className = "thong-diep canh-bao";
    td.textContent = "Đang tải lịch sử…";
    try {
      const bang = await docSheet(SHEET_LICH_SU + "!A2:E2000", "FORMATTED_VALUE");
      banLichSu = bang.filter(function (d) { return d && d.length >= 5; }).reverse().slice(0, 50).map(function (d) {
        let mau = null;
        try {
          mau = chuanHoa(JSON.parse(d[4]));
          if (MauIn.kiemTraMau(mau).length) mau = null;
        } catch (e) {
          mau = null;
        }
        return { luc: d[0], nguoi: d[1], phienBan: d[2], ghiChu: d[3], mau: mau };
      });
      td.hidden = true;
      if (!banLichSu.length) { td.hidden = false; td.textContent = "Chưa có lịch sử."; }
      ds.innerHTML = banLichSu.map(function (x, i) {
        const dangDungBanNay = String(x.phienBan) === String(dangDung.phienBan);
        return '<li class="' + (dangDungBanNay ? "dang-dung" : "") + '"><div><b>Phiên bản ' + esc(x.phienBan) + (dangDungBanNay ? " · đang dùng" : "") + "</b>" +
          "<small>" + esc(x.luc) + " · " + esc(x.nguoi) + (x.mau ? " · " + (x.mau.bat ? "mẫu tùy chỉnh" : "mẫu gốc") : "") + "</small>" +
          (x.ghiChu ? "<small>" + esc(x.ghiChu) + "</small>" : "") + "</div>" +
          (x.mau ? '<button class="nut" data-mo="' + i + '">Mở bản này</button>' : '<small title="Bản này không đọc được">—</small>') + "</li>";
      }).join("");
    } catch (e) {
      console.error("[Thiết kế mẫu in] Không đọc được lịch sử:", e);
      td.className = "thong-diep loi";
      td.textContent = "Không tải được lịch sử (kiểm tra mạng).";
    }
  }

  // =========================================================================
  // IN THỬ — dùng thẳng style.css + CSS sinh tự động, giống hệt nút "In đơn" của trang Vận Hành
  // =========================================================================
  function moHopInThu() {
    const tr = trangVe(mauVe(nhap));
    const n = danhSachThayDoi().length;
    $("tom-tat-in").innerHTML = [
      "Khổ " + tr.khoGiay + " · " + KHO[tr.khoGiay][0] + " × " + KHO[tr.khoGiay][1] + " mm",
      "Lề " + tr.leMm + " mm",
      nhap.cot.filter(function (c) { return c.hien; }).length + " cột",
      n ? n + " thay đổi chưa lưu" : "Giống mẫu đang dùng",
    ].map(function (x) { return "<span>" + esc(x) + "</span>"; }).join("");
    $("huong-dan-in").innerHTML = [
      "<b>Máy in:</b> máy in đơn hàng",
      "<b>Khổ giấy:</b> " + tr.khoGiay + " (trang đã đặt sẵn, thường tự đúng)",
      "<b>Lề:</b> Mặc định",
      "<b>Tỉ lệ:</b> Mặc định / 100% — không chọn “Vừa trang”",
      "<b>Bỏ chọn</b> “Đầu trang và chân trang” để không in ngày giờ, đường dẫn",
    ].map(function (x) { return "<li>" + x + "</li>"; }).join("");
    $("hop-in-thu").hidden = false;
  }

  // In TRỰC TIẾP từ trang này (không qua khung phụ) — đúng cơ chế nút "In đơn" của trang Vận Hành:
  // style.css (media print, khai báo trong thiet_ke_mau_in.html) + thẻ CSS mẫu đặt SAU style.css (khổ giấy, lề @page)
  // + đơn nằm trong #print-only-zone; khi in mọi phần khác của trang bị ẩn.
  function inThu() {
    $("hop-in-thu").hidden = true;
    const mv = mauVe(nhap);
    $("print-only-zone").innerHTML = MauIn.veDon(ctxDonMau(), mv).replace("invoice-box", "invoice-box page-break");
    // script_mau_in.js tự gắn CSS của mẫu ĐÃ LƯU vào trang này → tắt khi in, chỉ dùng mẫu nháp
    const cssDaLuu = document.getElementById("mau-in-tuy-chinh");
    if (cssDaLuu) cssDaLuu.media = "not all";
    let cssNhap = $("mau-in-nhap");
    if (!cssNhap) {
      cssNhap = document.createElement("style");
      cssNhap.id = "mau-in-nhap";
      cssNhap.media = "print";
    }
    cssNhap.textContent = mv.tuyChinh ? MauIn.sinhCss(mv) : "";
    document.head.appendChild(cssNhap); // luôn đứng cuối → @page của mẫu nháp được ưu tiên
    try {
      window.print();
    } catch (e) {
      console.error("[Thiết kế mẫu in] Không mở được hộp thoại in:", e);
      thongBao("Không mở được hộp thoại in. Tải lại trang rồi thử lại.");
    }
  }

  // =========================================================================
  // SỰ KIỆN
  // =========================================================================
  $("kho-giay").addEventListener("click", function (e) {
    const b = e.target.closest("[data-kho]");
    if (b && b.dataset.kho !== nhap.trang.khoGiay) doi("bang", function () { nhap.trang.khoGiay = b.dataset.kho; });
  });
  $("le-giay").addEventListener("input", function (e) { doiGop("le", "bang", function () { nhap.trang.leMm = +e.target.value; }); });
  $("le-md").addEventListener("click", function () { doi("bang", function () { nhap.trang.leMm = MauIn.TRANG_MAC_DINH.leMm; }); });

  const ds = $("ds-cot");
  ds.addEventListener("click", function (e) {
    if (e.target.closest("[data-dat-ktgh]")) {
      cotChon = "ghi_chu";
      doi("cot:ghi_chu", function () { cot("ghi_chu").tieuDe = "KTGH"; });
      return;
    }
    const an = e.target.closest("[data-an]"), len = e.target.closest("[data-len]"), xuong = e.target.closest("[data-xuong]");
    if (an) {
      const c = cot(an.dataset.an);
      if (c.hien && nhap.cot.filter(function (x) { return x.hien; }).length === 1) { thongBao("Phải hiện ít nhất 1 cột."); return; }
      doi("bang", function () { c.hien = !c.hien; });
      return;
    }
    if (len || xuong) {
      const loai = len ? len.dataset.len : xuong.dataset.xuong;
      const i = nhap.cot.findIndex(function (c) { return c.loai === loai; }), j = i + (len ? -1 : 1);
      if (j < 0 || j >= nhap.cot.length) return;
      doi("cot:" + loai, function () { const x = nhap.cot.splice(i, 1)[0]; nhap.cot.splice(j, 0, x); });
      return;
    }
    const li = e.target.closest("li");
    if (li && !e.target.closest("input") && li.dataset.loai !== cotChon) { cotChon = li.dataset.loai; doiCuoi = "cot:" + cotChon; veLai(); }
  });
  ds.addEventListener("focusin", function (e) {
    const li = e.target.closest("li");
    if (!li || !e.target.closest("input") || li.dataset.loai === cotChon) return;
    cotChon = li.dataset.loai;
    ds.querySelectorAll("li").forEach(function (x) { x.classList.toggle("dang-chon", x.dataset.loai === cotChon); });
    veChuCot();
    veXemThu();
  });
  ds.addEventListener("change", function (e) {
    const o = e.target.closest("[data-ten]");
    if (!o) return;
    const v = sach(o.value.trim());
    if (!v) { thongBao("Tiêu đề cột không được để trống."); veDsCot(); return; }
    if (v === cot(o.dataset.ten).tieuDe) { o.value = v; return; }
    doi("cot:" + o.dataset.ten, function () { cot(o.dataset.ten).tieuDe = v; });
  });
  ds.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.closest("[data-ten]")) e.target.blur(); });

  // Kéo thả đổi thứ tự cột
  let dangKeo = null;
  ds.addEventListener("dragstart", function (e) {
    const li = e.target.closest("li");
    if (!li) return;
    dangKeo = li.dataset.loai;
    li.classList.add("dang-keo");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dangKeo);
  });
  ds.addEventListener("dragend", function () {
    dangKeo = null;
    ds.querySelectorAll("li").forEach(function (li) { li.classList.remove("dang-keo", "cho-tha"); });
  });
  ds.addEventListener("dragover", function (e) {
    if (!dangKeo) return;
    e.preventDefault();
    const li = e.target.closest("li");
    ds.querySelectorAll("li").forEach(function (x) { x.classList.toggle("cho-tha", x === li && li.dataset.loai !== dangKeo); });
  });
  ds.addEventListener("drop", function (e) {
    e.preventDefault();
    const li = e.target.closest("li");
    if (!li || !dangKeo || li.dataset.loai === dangKeo) return;
    const loai = dangKeo;
    const tu = nhap.cot.findIndex(function (c) { return c.loai === loai; });
    const den = nhap.cot.findIndex(function (c) { return c.loai === li.dataset.loai; });
    doi("cot:" + loai, function () { const x = nhap.cot.splice(tu, 1)[0]; nhap.cot.splice(den, 0, x); });
  });

  // Chữ của cột — cỡ bằng mặc định thì lưu là "mặc định" (để trống)
  const giaTriCo = function (v) {
    v = Math.max(6, Math.min(48, v));
    return v === mdCot(cotChon).co ? null : v;
  };
  $("co-chu").addEventListener("input", function (e) {
    doiGop("co:" + cotChon, "cot:" + cotChon, function () { cot(cotChon).coChu = giaTriCo(+e.target.value); });
  });
  $("co-tru").addEventListener("click", function () {
    doi("cot:" + cotChon, function () { cot(cotChon).coChu = giaTriCo((cot(cotChon).coChu || mdCot(cotChon).co) - 1); });
  });
  $("co-cong").addEventListener("click", function () {
    doi("cot:" + cotChon, function () { cot(cotChon).coChu = giaTriCo((cot(cotChon).coChu || mdCot(cotChon).co) + 1); });
  });
  $("co-md").addEventListener("click", function () { doi("cot:" + cotChon, function () { cot(cotChon).coChu = null; }); });
  $("kieu-chu").addEventListener("click", function (e) {
    const b = e.target.closest("[data-kieu]");
    if (b) doi("cot:" + cotChon, function () { cot(cotChon).kieuChu = b.dataset.kieu === "md" ? null : b.dataset.kieu; });
  });
  $("can-le").addEventListener("click", function (e) {
    const b = e.target.closest("[data-can]");
    if (b) doi("cot:" + cotChon, function () { cot(cotChon).canLe = b.dataset.can === "md" ? null : b.dataset.can; });
  });
  $("do-rong").addEventListener("click", function (e) {
    const b = e.target.closest("[data-rong]");
    if (!b) return;
    const c = cot(cotChon);
    const moi = b.dataset.rong === "md" ? null : b.dataset.rong === "vua" ? "vua" : (c.doRong && c.doRong !== "vua" ? c.doRong : "20%");
    if (moi !== c.doRong) doi("cot:" + cotChon, function () { c.doRong = moi; });
  });
  $("phan-tram").addEventListener("input", function (e) {
    doiGop("pt:" + cotChon, "cot:" + cotChon, function () { cot(cotChon).doRong = e.target.value + "%"; });
  });
  $("ds-phong").addEventListener("click", function (e) {
    const b = e.target.closest("[data-phong]");
    if (b) doi("cot:" + cotChon, function () { cot(cotChon).phong = b.dataset.phong || null; });
  });

  // Đầu & chân đơn
  function theoNhan(id, lay, dat, cho) {
    $(id).addEventListener("change", function (e) {
      const v = sach(e.target.value.trim());
      if (!v) { thongBao("Nhãn không được để trống."); e.target.value = lay(); return; }
      if (v === lay()) { e.target.value = v; return; }
      doi(cho, function () { dat(v); });
    });
    $(id).addEventListener("keydown", function (e) { if (e.key === "Enter") e.target.blur(); });
  }
  theoNhan("nhan-vd", function () { return nhap.dauDon.nhanMaVanDon; }, function (v) { nhap.dauDon.nhanMaVanDon = v; }, "dau");
  theoNhan("nhan-md", function () { return nhap.dauDon.nhanMaDon; }, function (v) { nhap.dauDon.nhanMaDon = v; }, "maDon");
  theoNhan("nhan-tong", function () { return nhap.nhanTongTien; }, function (v) { nhap.nhanTongTien = v; }, "tong");
  $("co-ma-don").addEventListener("input", function (e) { doiGop("coMaDon", "maDon", function () { nhap.trang.coChuMaDon = +e.target.value; }); });
  $("co-ma-don-md").addEventListener("click", function () { doi("maDon", function () { nhap.trang.coChuMaDon = MauIn.TRANG_MAC_DINH.coChuMaDon; }); });
  $("hien-tong").addEventListener("change", function (e) { doi("tong", function () { nhap.trang.hienTongTien = e.target.checked; }); });
  $("khoanh-tron").addEventListener("change", function (e) { doi("cot:so_luong", function () { nhap.khoanhTronSoLuong = e.target.checked; }); });
  $("hien-qr").addEventListener("change", function (e) { doi("qr", function () { nhap.trang.hienQr = e.target.checked; }); });
  $("hien-thung").addEventListener("change", function (e) { doi("tong", function () { nhap.trang.hienThung = e.target.checked; }); });
  $("chan-don").addEventListener("input", function (e) {
    const v = sach(e.target.value).slice(0, 200);
    if (v !== e.target.value) e.target.value = v;
    doiGop("chan", "chan", function () { nhap.trang.chanDon = v; });
  });
  $("mau-de-vo").addEventListener("change", veXemThu);

  // Hoàn tác / Làm lại
  $("nut-hoan-tac").addEventListener("click", function () {
    if (!lichSuThaoTac.length) return;
    lamLaiThaoTac.push(JSON.stringify(nhap));
    nhap = JSON.parse(lichSuThaoTac.pop());
    nhomDangMo = null;
    doiCuoi = null;
    veLai();
    thongBao("Đã hoàn tác 1 bước — đổi ý thì bấm ↷ Làm lại.");
  });
  $("nut-lam-lai").addEventListener("click", function () {
    if (!lamLaiThaoTac.length) return;
    lichSuThaoTac.push(JSON.stringify(nhap));
    nhap = JSON.parse(lamLaiThaoTac.pop());
    nhomDangMo = null;
    doiCuoi = null;
    veLai();
    thongBao("Đã làm lại 1 bước.");
  });

  // Lưu
  $("nut-luu").addEventListener("click", moHopLuu);
  $("huy-luu").addEventListener("click", function () { if (!dangLuu) $("hop-luu").hidden = true; });
  $("form-luu").addEventListener("submit", xacNhanLuu);

  // Lịch sử
  $("nut-lich-su").addEventListener("click", moLichSu);
  $("ds-phien-ban").addEventListener("click", function (e) {
    const b = e.target.closest("[data-mo]");
    if (!b) return;
    const x = banLichSu[+b.dataset.mo];
    $("hop-lich-su").hidden = true;
    thayNhap(x.mau, "bang");
    thongBao("Đã mở phiên bản " + x.phienBan + " dưới dạng nháp — bấm Lưu & áp dụng nếu muốn dùng lại.");
  });
  $("ve-mau-goc").addEventListener("click", function () {
    $("hop-lich-su").hidden = true;
    thayNhap(mauGoc(), "bang");
    thongBao("Đã nạp mẫu gốc dưới dạng nháp — bấm Lưu & áp dụng để trang Vận Hành in lại mẫu gốc.");
  });
  $("dong-lich-su").addEventListener("click", function () { $("hop-lich-su").hidden = true; });

  // In thử
  $("nut-in-thu").addEventListener("click", moHopInThu);
  $("huy-in-thu").addEventListener("click", function () { $("hop-in-thu").hidden = true; });
  $("mo-in-thu").addEventListener("click", inThu);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (!dangLuu) $("hop-luu").hidden = true;
      $("hop-lich-su").hidden = true;
      $("hop-in-thu").hidden = true;
      return;
    }
    if (!(e.ctrlKey || e.metaKey) || e.target.closest("input:not([type=range]):not([type=checkbox]),textarea")) return;
    if (!$("hop-luu").hidden || !$("hop-lich-su").hidden) return;
    const k = e.key.toLowerCase();
    if (k === "z" && !e.shiftKey) { e.preventDefault(); $("nut-hoan-tac").click(); }
    else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); $("nut-lam-lai").click(); }
  });
  window.addEventListener("resize", function () { if (docXem) canTo(); });
  // Dữ liệu kích thước / thùng (script_kich_thuoc.js) tải xong sau → vẽ lại bản in thử cho đủ KTGH, Thùng
  window.addEventListener("kichthuoc:capnhat", function () { veXemThu(); });
  window.addEventListener("beforeunload", function (e) {
    if (danhSachThayDoi().length) { e.preventDefault(); e.returnValue = ""; }
  });

  // ── KHỞI ĐỘNG ──
  khoiTaoKhungXem();
  veLai();
  taiMauDangDung();
})();
