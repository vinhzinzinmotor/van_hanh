// =========================================================================
// TRA CỨU LỊCH SỬ KIỂM HÀNG — ZinZinMotor
// Chỉ ĐỌC qua các hàm báo cáo bc_* trên database
// (supabase/giai_doan_3_bao_cao.sql, giai_doan_3b_tra_cuu_chi_tiet.sql, giai_doan_3c_dat_chuan.sql)
// Không đọc thẳng bảng, không ghi gì cả
//
// ĐIỀU HƯỚNG BẤM XUYÊN (địa chỉ nằm sau dấu #, nút Back của trình duyệt dùng được):
//   #/tra-don/<mã>[/<phiên>]        Chi tiết đơn + người đã kiểm (double check)
//   #/nhan-vien                     Danh sách nhân viên
//   #/nhan-vien/<tên>               Hồ sơ nhân viên + danh sách đơn đã kiểm
//   #/tong-quan                     Tổng quan
//   #/tong-quan/ngay/<ngày>[/<tên>] Chi tiết 1 ngày + danh sách đơn
//   #/tong-quan/gio/<giờ>           Danh sách đơn kiểm trong khung giờ
//   #/bat-thuong                    Niêm phong & bất thường
// =========================================================================

// ── CẤU HÌNH — giống script_van_don_kiem_hang.js ──
const SUPABASE_URL = "https://ecctfcqqibuaxfpfsimy.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjY3RmY3FxaWJ1YXhmcGZzaW15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5MTkyMjEsImV4cCI6MjA5OTQ5NTIyMX0.zCXn7O-sXkrDZMgJtn9OTA0JsVffs7Tc-FLgYhb4qqI";
const MUI_GIO = "Asia/Ho_Chi_Minh";
const GIOI_HAN_PHIEN = 2000; // Khớp giới hạn trong bc_danh_sach_phien

// Nhãn cho từng loại sự kiện: icon + chữ (không dựa riêng vào màu)
const LOAI = {
  MO_PHIEN: { ten: "Mở phiên", icon: "📦", lop: "trung-tinh" },
  QUET_DUNG: { ten: "Quét đúng", icon: "✅", lop: "tot" },
  QUET_THUA: { ten: "Quét thừa", icon: "⚠️", lop: "loi-nguoi" },
  QUET_SAI_MA: { ten: "Quét sai mã", icon: "❌", lop: "loi-nguoi" },
  HOAN_TAT: { ten: "Hoàn tất", icon: "🎉", lop: "tot" },
  BO_DO: { ten: "Bỏ dở", icon: "⏸️", lop: "canh-bao" },
  HUY: { ten: "Hủy", icon: "🗑️", lop: "canh-bao" },
  DONG_TRANG: { ten: "Đóng trang", icon: "🚪", lop: "canh-bao" },
  KHONG_TIM_THAY_DON: { ten: "Không tìm thấy đơn", icon: "🔍", lop: "he-thong" },
  LOI_MANG: { ten: "Lỗi mạng", icon: "📡", lop: "he-thong" },
};
const LOAI_KET_THUC = ["HOAN_TAT", "BO_DO", "HUY", "DONG_TRANG"];

// 3 mức kết quả (icon + chữ, không dựa riêng vào màu)
//   ĐẠT CHUẨN   = đủ hàng, không quét thừa, không quét sai mã (và với đơn: danh sách hàng không đổi)
//   CẦN XEM XÉT = đủ hàng nhưng có lỗi
//   CHƯA ĐỦ HÀNG = bỏ dở / hủy / đóng trang / chưa kết thúc
const MUC = {
  DAT_CHUAN: { ten: "Đạt chuẩn", icon: "🟢", lop: "tot" },
  CAN_XEM_XET: { ten: "Cần xem xét", icon: "🟡", lop: "canh-bao" },
  CHUA_DU: { ten: "Chưa đủ hàng", icon: "🔴", lop: "loi-nguoi" },
};

// =========================================================================
// PHẦN 1: TIỆN ÍCH
// =========================================================================

async function goiRpc(ten, thamSo) {
  let resp;
  try {
    resp = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + ten, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(thamSo || {}),
    });
  } catch (e) {
    console.error("[TraCuu] " + ten + " không kết nối được:", e);
    throw new Error("Không kết nối được database. Kiểm tra mạng rồi thử lại.");
  }
  const duLieu = await resp.json().catch(function () {
    return null;
  });
  if (!resp.ok) {
    // Chi tiết kỹ thuật chỉ ghi vào Console (F12) — giao diện không hiện tên hàm / bảng / hệ thống
    console.error("[TraCuu] " + ten + " lỗi " + resp.status + ":", duLieu);
    // P0001 = thông báo do chính hàm báo cáo đặt ra (vd: "Chỉ xem tối đa 93 ngày") → hiện cho người dùng
    if (duLieu && duLieu.code === "P0001" && duLieu.message) throw new Error(duLieu.message);
    throw new Error("Không lấy được dữ liệu từ database (mã lỗi " + resp.status + ")");
  }
  return duLieu;
}

// Tên bảng gốc → tên hiển thị (không để lộ cấu trúc database trên giao diện)
const TEN_SO = {
  phien_kiem_hang: "Sổ phiên kiểm",
  su_kien_kiem_hang: "Sổ lần quét",
};
function tenSo(bang) {
  return TEN_SO[bang] || "Sổ nhật ký";
}

// Chống chèn mã độc: mọi dữ liệu từ máy quét đều đi qua hàm này trước khi hiển thị
function esc(giaTri) {
  return String(giaTri == null ? "" : giaTri)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function so(n) {
  return Number(n || 0).toLocaleString("vi-VN");
}

function phanTram(tu, mau) {
  if (!mau) return "—";
  return ((tu / mau) * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + "%";
}

function gioVN(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("vi-VN", {
    timeZone: MUI_GIO,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function chiGioVN(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("vi-VN", {
    timeZone: MUI_GIO,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function ngayVN(chuoiNgay) {
  const p = String(chuoiNgay).split("-");
  return p[2] + "/" + p[1] + "/" + p[0];
}

function thoiLuong(giay) {
  if (giay == null || isNaN(giay)) return "—";
  giay = Math.round(giay);
  const phut = Math.floor(giay / 60);
  const conLai = giay % 60;
  if (phut === 0) return conLai + " giây";
  if (phut < 60) return phut + " phút " + conLai + " giây";
  return Math.floor(phut / 60) + " giờ " + (phut % 60) + " phút";
}

// Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD
function homNay() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: MUI_GIO }).format(new Date());
}

function congNgay(chuoiNgay, soNgay) {
  const d = new Date(chuoiNgay + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + soNgay);
  return d.toISOString().slice(0, 10);
}

function nhanLoai(loai) {
  const m = LOAI[loai] || { ten: loai, icon: "•", lop: "trung-tinh" };
  return '<span class="tc-nhan ' + m.lop + '">' + m.icon + " " + esc(m.ten) + "</span>";
}

// Nhãn kết quả của 1 phiên kiểm (null = chưa có sự kiện kết thúc)
function nhanKetQua(ketThuc) {
  return ketThuc ? nhanLoai(ketThuc) : '<span class="tc-nhan canh-bao">⏳ Chưa kết thúc</span>';
}

// Nhãn 3 mức, kèm lý do ngắn (vd: "thừa 2 · sai 1")
function nhanMuc(muc, lyDo) {
  const m = MUC[muc];
  return '<span class="tc-nhan ' + m.lop + '">' + m.icon + " " + m.ten +
    (lyDo ? ' <span class="ly-do">· ' + esc(lyDo) + "</span>" : "") + "</span>";
}

// Mức của 1 dòng trong danh sách phiên (bc_danh_sach_phien) — theo tay nghề người kiểm
// (khớp với số liệu Nhân viên / Tổng quan). "Danh sách hàng đổi" hiện thành nhãn riêng (nhanDsDoi)
function mucHang(r) {
  if (r.ket_thuc !== "HOAN_TAT") return { muc: "CHUA_DU", lyDo: r.ket_thuc ? (LOAI[r.ket_thuc] || {}).ten : "chưa kết thúc" };
  const lyDo = [];
  if (r.so_quet_thua > 0) lyDo.push("thừa " + r.so_quet_thua);
  if (r.so_quet_sai > 0) lyDo.push("sai " + r.so_quet_sai);
  return lyDo.length ? { muc: "CAN_XEM_XET", lyDo: lyDo.join(" · ") } : { muc: "DAT_CHUAN", lyDo: "" };
}

function nhanDsDoi(r) {
  return r.ds_thay_doi
    ? ' <span class="tc-nhan canh-bao" title="Danh sách hàng khác lần kiểm trước của cùng đơn → đơn cần xem xét">📝 DS hàng đổi</span>'
    : "";
}

// Báo rõ nếu database chưa được cập nhật bản báo cáo 3C (thiếu cột mới)
function kiemTraSql3c(dong, cot) {
  if (dong.length > 0 && dong[0][cot] === undefined) {
    console.error("[TraCuu] Thiếu cột " + cot + " — cần chạy file SQL giai đoạn 3C");
    throw new Error("Database chưa được cập nhật bản báo cáo mới (3C). Vui lòng báo quản trị cập nhật.");
  }
}

function bang(cot, hang) {
  return (
    '<div class="tc-cuon-ngang"><table class="tc-bang"><thead><tr>' +
    cot.map(function (c) {
      return "<th" + (c.so ? ' class="so"' : "") + ">" + esc(c.ten) + "</th>";
    }).join("") +
    "</tr></thead><tbody>" +
    hang.join("") +
    "</tbody></table></div>"
  );
}

// Hàng bấm được: bấm (hoặc Enter) → đi tới địa chỉ duongDan
function hangBam(duongDan, noiDung) {
  return '<tr class="tc-hang-bam" tabindex="0" data-href="' + esc(duongDan) + '">' + noiDung + "</tr>";
}

function oSo(nhan, giaTri, phu) {
  return '<div class="tc-o-so"><div class="nhan">' + nhan + '</div><div class="gia-tri">' + giaTri +
    '</div><div class="phu">' + phu + "</div></div>";
}

function setTrangThai(thongDiep, laLoi) {
  const el = document.getElementById("trang-thai");
  el.textContent = thongDiep;
  el.classList.toggle("loi", !!laLoi);
}

function khoangNgay() {
  return {
    p_tu: document.getElementById("tu-ngay").value,
    p_den: document.getElementById("den-ngay").value,
  };
}

function chuKhoangNgay() {
  const k = khoangNgay();
  return k.p_tu === k.p_den ? ngayVN(k.p_tu) : ngayVN(k.p_tu) + " → " + ngayVN(k.p_den);
}

function enc(chuoi) {
  return encodeURIComponent(chuoi);
}

// =========================================================================
// PHẦN 2: ĐIỀU HƯỚNG (theo địa chỉ sau dấu #)
// =========================================================================

let luotVe = 0; // Mỗi lần chuyển trang +1 → kết quả tải chậm của trang cũ không ghi đè trang mới
let soLanChuyenTrang = 0; // > 0 nghĩa là đã đi trong trang → nút Quay lại dùng history.back()
const TAB_CO_LOC_NGAY = ["nhan-vien", "tong-quan", "bat-thuong"];

function diToi(duongDan) {
  if (location.hash === duongDan) dinhTuyen();
  else location.hash = duongDan;
}

function phanTichDiaChi() {
  const phan = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(function (p) {
    try {
      return decodeURIComponent(p);
    } catch (e) {
      return p;
    }
  });
  return phan;
}

// Ghi nội dung vào khung, bỏ qua nếu người dùng đã chuyển sang trang khác
function ghiKhung(id, html, luot) {
  if (luot !== luotVe) return false;
  document.getElementById(id).innerHTML = html;
  return true;
}

// Thanh vị trí: [{ten, link}] — mục cuối không có link. Kèm nút Quay lại
function thanhViTri(cacMuc, linkCha) {
  const mucs = cacMuc.map(function (m, i) {
    const laCuoi = i === cacMuc.length - 1;
    return laCuoi || !m.link
      ? '<span class="hien-tai">' + m.ten + "</span>"
      : '<a href="' + esc(m.link) + '">' + m.ten + "</a>";
  }).join('<span class="phan-cach">›</span>');
  return '<div class="tc-vi-tri">' +
    (linkCha ? '<button class="tc-chip" data-quay-lai="' + esc(linkCha) + '">← Quay lại</button>' : "") +
    "<nav>" + mucs + "</nav></div>";
}

async function dinhTuyen() {
  const luot = ++luotVe;
  const p = phanTichDiaChi();
  const tab = ["tra-don", "nhan-vien", "tong-quan", "bat-thuong"].indexOf(p[0]) >= 0 ? p[0] : "tra-don";

  document.querySelectorAll(".tc-tab").forEach(function (t) {
    t.classList.toggle("active", t.getAttribute("data-tab") === tab);
  });
  document.querySelectorAll(".tc-tab-noi-dung").forEach(function (s) {
    s.classList.toggle("active", s.id === "tab-" + tab);
  });
  // Trang chi tiết 1 ngày tự có ngày riêng → ẩn bộ lọc ngày
  const coLocNgay = TAB_CO_LOC_NGAY.indexOf(tab) >= 0 && !(tab === "tong-quan" && p[1] === "ngay");
  document.getElementById("bo-loc-ngay").hidden = !coLocNgay;
  try { localStorage.setItem("zzm_tra_cuu_tab", tab); } catch (e) {}
  an(document.getElementById("tooltip"));

  try {
    if (tab === "tra-don") {
      if (p[1]) await veChiTietDon(p[1], p[2], luot);
      else veTraDonTrong();
    } else if (tab === "nhan-vien") {
      if (p[1]) await veHoSoNhanVien(p[1], luot);
      else await veDanhSachNhanVien(luot);
    } else if (tab === "tong-quan") {
      if (p[1] === "ngay" && /^\d{4}-\d{2}-\d{2}$/.test(p[2] || "")) await veNgay(p[2], p[3] || "", luot);
      else if (p[1] === "gio" && /^\d{1,2}$/.test(p[2] || "")) await veKhungGio(+p[2], luot);
      else await veTongQuan(luot);
    } else {
      await veBatThuong(luot);
    }
  } catch (e) {
    if (luot === luotVe) setTrangThai("❌ " + e.message, true);
  }
}

function an(el) {
  if (el) el.hidden = true;
}

// =========================================================================
// PHẦN 3: TRA ĐƠN — CHI TIẾT ĐƠN + NGƯỜI ĐÃ KIỂM (DOUBLE CHECK)
// =========================================================================

function veTraDonTrong() {
  document.getElementById("o-ma-van-don").focus();
  document.getElementById("kq-tra-don").innerHTML =
    '<div class="tc-goi-y">Nhập hoặc bắn mã vận đơn / mã đơn hàng để xem toàn bộ lịch sử kiểm: ' +
    "ai kiểm, kiểm mấy lần, lúc nào, quét gì, đủ / thiếu / thừa.<br>Hoặc vào tab <b>Nhân viên</b> / " +
    "<b>Tổng quan</b> rồi bấm vào một dòng để xem danh sách đơn.</div>";
  setTrangThai("Sẵn sàng tra cứu");
}

async function veChiTietDon(ma, phienChon, luot) {
  const input = document.getElementById("o-ma-van-don");
  input.value = ma;
  setTrangThai("🔍 Đang tra cứu " + ma + "...");

  const duLieu = await goiRpc("bc_tra_van_don", { p_ma: ma });
  const dsPhien = duLieu.phien.slice().reverse(); // Cũ → mới để đánh số lần kiểm 1, 2, 3...
  const dsPhanTich = dsPhien.map(function (p, i) {
    return phanTichPhien(p, i > 0 ? dsPhien[i - 1] : null);
  });
  let html = thanhViTri(
    [{ ten: "🔍 Tra đơn", link: "#/tra-don" }, { ten: esc(ma) }],
    "#/tra-don",
  );

  if (dsPhien.length === 0 && duLieu.khong_tim_thay.length === 0) {
    html += '<div class="tc-goi-y">Chưa có lần kiểm nào cho mã <b>' + esc(ma) + "</b>.</div>";
  } else {
    if (dsPhien.length > 0) html += veTomTatDon(dsPhien, dsPhanTich);
    // Hiện phiên mới nhất trước; phiên được chọn (bấm từ danh sách) mở sẵn chi tiết
    for (let i = dsPhien.length - 1; i >= 0; i--) {
      const p = dsPhien[i];
      const moSan = phienChon ? p.id === phienChon : i === dsPhien.length - 1;
      html += vePhien(p, dsPhanTich[i], i + 1, dsPhien.length, moSan, p.id === phienChon);
    }
    if (duLieu.khong_tim_thay.length > 0) html += veKhongTimThay(duLieu.khong_tim_thay);
  }

  if (!ghiKhung("kq-tra-don", html, luot)) return;
  setTrangThai("✓ " + ma + ": kiểm " + dsPhien.length + " lần, " +
    duLieu.khong_tim_thay.length + " lần quét không tìm thấy đơn");

  const theChon = phienChon && document.getElementById("phien-" + phienChon);
  if (theChon) theChon.scrollIntoView({ block: "start", behavior: "smooth" });
}

// Kết quả của 1 phiên: sự kiện kết thúc đầu tiên
function ketThucPhien(p) {
  return (p.su_kien || []).filter(function (s) {
    return LOAI_KET_THUC.indexOf(s.loai) >= 0;
  })[0] || null;
}

// Danh sách hàng dạng chuẩn (SKU + số lượng) → chuỗi để so sánh giữa các lần kiểm
function khoaDanhSach(ds) {
  return JSON.stringify(Object.keys(ds || {}).sort().map(function (k) {
    return [k, (ds[k] || {}).can_kiem || 0];
  }));
}

// So 2 danh sách hàng → các dòng mô tả khác biệt
function khacBietDanhSach(truoc, sau) {
  const t = truoc || {};
  const s = sau || {};
  const ten = function (ds, k) { return (ds[k] && ds[k].sku_goc) || k; };
  const kq = [];
  Object.keys(s).forEach(function (k) {
    if (!t[k]) kq.push("Thêm " + ten(s, k) + " ×" + (s[k].can_kiem || 0));
    else if ((t[k].can_kiem || 0) !== (s[k].can_kiem || 0)) {
      kq.push(ten(s, k) + ": " + (t[k].can_kiem || 0) + " → " + (s[k].can_kiem || 0));
    }
  });
  Object.keys(t).forEach(function (k) {
    if (!s[k]) kq.push("Bỏ " + ten(t, k) + " ×" + (t[k].can_kiem || 0));
  });
  return kq;
}

// Phân tích 1 lần kiểm: đủ / thiếu từng SKU, lỗi quét, danh sách hàng có đổi so với lần trước
function phanTichPhien(p, truoc) {
  const suKien = p.su_kien || [];
  const kt = ketThucPhien(p);
  const dsCan = p.danh_sach_can_kiem || {};
  const skus = Object.keys(dsCan).map(function (key) {
    const skuGoc = dsCan[key].sku_goc || key;
    const can = dsCan[key].can_kiem || 0;
    let daKiem = 0;
    let thua = 0;
    suKien.forEach(function (s) {
      if (s.sku !== skuGoc) return;
      if (s.loai === "QUET_DUNG") daKiem = Math.max(daKiem, s.da_kiem_sau || 0);
      if (s.loai === "QUET_THUA") thua++;
    });
    return { sku: skuGoc, can: can, daKiem: daKiem, thua: thua };
  });
  const thua = suKien.filter(function (s) { return s.loai === "QUET_THUA"; });
  const sai = suKien.filter(function (s) { return s.loai === "QUET_SAI_MA"; });
  const khacBiet = truoc && khoaDanhSach(truoc.danh_sach_can_kiem) !== khoaDanhSach(dsCan)
    ? khacBietDanhSach(truoc.danh_sach_can_kiem, dsCan)
    : [];
  const hoanTat = !!kt && kt.loai === "HOAN_TAT";

  // Mức theo tay nghề người kiểm (chỉ tính quét thừa / quét sai) — dùng để đánh giá nhân viên
  const mucNguoi = !hoanTat ? "CHUA_DU" : thua.length + sai.length > 0 ? "CAN_XEM_XET" : "DAT_CHUAN";
  // Mức của gói hàng (tính thêm danh sách hàng đổi) — dùng để kết luận đơn
  const muc = mucNguoi === "DAT_CHUAN" && khacBiet.length > 0 ? "CAN_XEM_XET" : mucNguoi;

  const lyDoNguoi = [];
  if (!hoanTat) lyDoNguoi.push(kt ? (LOAI[kt.loai] || {}).ten : "chưa kết thúc");
  if (thua.length) lyDoNguoi.push("thừa " + thua.length);
  if (sai.length) lyDoNguoi.push("sai " + sai.length);
  const lyDo = lyDoNguoi.concat(khacBiet.length ? ["DS hàng đổi"] : []);

  return {
    kt: kt, skus: skus, thua: thua, sai: sai, khacBiet: khacBiet, dsDoi: khacBiet.length > 0,
    lanDau: !truoc, khoaDs: khoaDanhSach(dsCan),
    mucNguoi: mucNguoi, lyDoNguoi: lyDoNguoi.join(" · "),
    muc: muc, lyDo: lyDo.join(" · "),
    tongCan: skus.reduce(function (a, x) { return a + x.can; }, 0),
    tongDa: skus.reduce(function (a, x) { return a + Math.min(x.daKiem, x.can); }, 0),
  };
}

function hopKetLuan(lop, tieuDe, chiTiet, phu, lichSu) {
  return '<div class="tc-hop ' + lop + '"><span class="tc-hop-tieu-de">' + tieuDe + "</span> — " + chiTiet +
    '<span class="phu">' + phu + "</span>" +
    (lichSu.length ? '<span class="phu tc-lich-su">📜 Lịch sử: ' + esc(lichSu.join(" ; ")) + "</span>" : "") +
    "</div>";
}

function oChiSo(trangThai, nhan, giaTri, phu) {
  return '<div class="tc-o-so tt-' + trangThai + '"><div class="nhan">' + nhan + '</div><div class="gia-tri">' +
    giaTri + '</div><div class="phu">' + phu + "</div></div>";
}

function moTaLoi(pt) {
  const kq = [];
  if (pt.thua.length) kq.push("quét thừa " + pt.thua.length + " lần");
  if (pt.sai.length) kq.push("quét sai mã " + pt.sai.length + " lần");
  if (pt.dsDoi) kq.push("danh sách hàng thay đổi so với lần kiểm trước");
  return kq.join(", ");
}

// Khối tóm tắt đơn: kết luận 3 mức + chỉ số lần cuối + điểm cần kiểm tra + người đã kiểm + các lần kiểm
function veTomTatDon(dsPhien, dsPt) {
  const n = dsPhien.length;
  const cuoi = dsPhien[n - 1];
  const pt = dsPt[n - 1];
  const luc = esc(cuoi.ten_nhan_vien) + " · " + gioVN(cuoi.thoi_gian_chu);

  // Kiểm chéo = những người kiểm đạt chuẩn trên CÙNG danh sách hàng với lần cuối
  const nguoiDat = [];
  dsPhien.forEach(function (p, i) {
    if (dsPt[i].mucNguoi === "DAT_CHUAN" && dsPt[i].khoaDs === pt.khoaDs &&
      nguoiDat.indexOf(p.ten_nhan_vien) < 0) nguoiDat.push(p.ten_nhan_vien);
  });

  // Các lần trước từng có vấn đề → ghi chú để không bị che mất
  const lichSu = dsPt.slice(0, n - 1).map(function (x, i) {
    return x.muc === "DAT_CHUAN" ? null
      : "Lần " + (i + 1) + " (" + dsPhien[i].ten_nhan_vien + "): " + MUC[x.muc].ten.toLowerCase() +
        (x.lyDo ? " — " + x.lyDo : "");
  }).filter(Boolean);

  let ketLuan;
  if (pt.muc === "DAT_CHUAN" && nguoiDat.length >= 2) {
    ketLuan = hopKetLuan("tot", "✅ ĐẠT CHUẨN – ĐÃ KIỂM CHÉO",
      nguoiDat.length + " người kiểm đạt chuẩn: " + esc(nguoiDat.join(", ")),
      "Lần kiểm gần nhất: " + luc, lichSu);
  } else if (pt.muc === "DAT_CHUAN") {
    ketLuan = hopKetLuan("tot", "✅ ĐẠT CHUẨN", "đủ hàng, không quét thừa, không quét sai mã",
      "Kiểm bởi " + luc + " · chưa có người thứ hai kiểm chéo", lichSu);
  } else if (pt.muc === "CAN_XEM_XET") {
    ketLuan = hopKetLuan("vang", "⚠️ CẦN XEM XÉT", "đủ hàng nhưng có lỗi: " + esc(moTaLoi(pt)),
      "Lần kiểm gần nhất: " + luc + " · xem mục \"Các điểm cần kiểm tra lại\" bên dưới", lichSu);
  } else {
    ketLuan = hopKetLuan("xau", "❌ CHƯA ĐỦ HÀNG", esc(pt.lyDo),
      "Lần kiểm gần nhất: " + luc + " · kiểm tra lại đơn này trước khi giao cho khách", lichSu);
  }

  // 5 ô chỉ số của lần kiểm gần nhất — ô nào có vấn đề thì đổi màu viền
  const duHang = pt.mucNguoi !== "CHUA_DU";
  const chiSo = '<div class="tc-luoi-so tc-chi-so">' +
    oChiSo(duHang ? "tot" : "xau", "📦 Đủ hàng", pt.tongDa + "/" + pt.tongCan,
      duHang ? "đủ số lượng" : "thiếu " + (pt.tongCan - pt.tongDa) + " sản phẩm") +
    oChiSo(pt.thua.length ? "xau" : "tot", "⚠️ Quét thừa", so(pt.thua.length),
      pt.thua.length ? "có thể bỏ dư hàng" : "không có") +
    oChiSo(pt.sai.length ? "xau" : "tot", "❌ Quét sai mã", so(pt.sai.length),
      pt.sai.length ? "có thể lọt hàng lạ" : "không có") +
    oChiSo(pt.dsDoi ? "vang" : "tot", "📝 Danh sách hàng",
      pt.lanDau ? "Lần đầu" : pt.dsDoi ? "Đã đổi" : "Không đổi",
      pt.lanDau ? "chưa có lần trước để so" : pt.dsDoi ? "khác lần kiểm trước" : "giống lần kiểm trước") +
    oChiSo(nguoiDat.length >= 2 ? "tot" : "trung", "👥 Kiểm chéo", so(nguoiDat.length) + " người",
      "kiểm đạt chuẩn cùng danh sách hàng") +
    "</div>";

  // Các điểm cần kiểm tra lại (chỉ khi lần cuối chưa đạt chuẩn)
  let diemKiem = "";
  if (pt.muc !== "DAT_CHUAN") {
    const muc = [];
    pt.skus.forEach(function (x) {
      if (x.daKiem < x.can) {
        muc.push("❌ Thiếu <b>" + esc(x.sku) + "</b>: mới kiểm " + x.daKiem + "/" + x.can +
          " → bổ sung hàng hoặc kiểm lại");
      }
    });
    pt.sai.forEach(function (s) {
      muc.push("❌ Quét mã lạ <b>" + esc(s.ma_quet_goc) + "</b> lúc " + chiGioVN(s.thoi_gian_chu) +
        " → kiểm tra hàng lạ có lọt vào gói không");
    });
    pt.thua.forEach(function (s) {
      muc.push("⚠️ Quét thừa <b>" + esc(s.sku || s.ma_quet_goc) + "</b> (đã đủ " + esc(s.da_kiem_sau) + "/" +
        esc(s.can_kiem) + ") lúc " + chiGioVN(s.thoi_gian_chu) + " → kiểm tra có bỏ dư hàng không");
    });
    if (pt.dsDoi) {
      muc.push("📝 Danh sách hàng đổi so với lần " + (n - 1) + " (" + esc(dsPhien[n - 2].ten_nhan_vien) + "): <b>" +
        esc(pt.khacBiet.join("; ")) + "</b> → đối chiếu gói hàng với danh sách mới");
    }
    if (muc.length) {
      diemKiem = '<div class="tc-khoi tc-khoi-diem-kiem"><h3>🔎 Các điểm cần kiểm tra lại <span class="tc-dem">lần kiểm ' +
        n + " · " + luc + "</span></h3><ul class=\"tc-diem-kiem\">" +
        muc.map(function (m) { return "<li>" + m + "</li>"; }).join("") + "</ul></div>";
    }
  }

  // Gom theo nhân viên — đánh giá theo tay nghề (không tính danh sách hàng đổi)
  const theoNv = {};
  dsPhien.forEach(function (p, i) {
    const x = dsPt[i];
    const t = theoNv[p.ten_nhan_vien] || (theoNv[p.ten_nhan_vien] = {
      ten: p.ten_nhan_vien, soLan: 0, DAT_CHUAN: 0, CAN_XEM_XET: 0, CHUA_DU: 0, cuoi: null, ptCuoi: null,
    });
    t.soLan++;
    t[x.mucNguoi]++;
    t.cuoi = p.thoi_gian_chu;
    t.ptCuoi = x;
  });
  const dsNv = Object.keys(theoNv).map(function (k) { return theoNv[k]; });
  const bangNguoi = bang(
    [{ ten: "Nhân viên" }, { ten: "Số lần kiểm", so: true }, { ten: "🟢 Đạt chuẩn", so: true },
      { ten: "🟡 Có lỗi", so: true }, { ten: "🔴 Chưa đủ", so: true }, { ten: "Lần cuối" }, { ten: "Đánh giá lần cuối" }],
    dsNv.map(function (t) {
      return "<tr><td>" + linkNhanVien(t.ten) + '</td><td class="so">' + t.soLan + '</td><td class="so">' +
        t.DAT_CHUAN + '</td><td class="so">' + t.CAN_XEM_XET + '</td><td class="so">' + t.CHUA_DU +
        "</td><td>" + gioVN(t.cuoi) + "</td><td>" + nhanMuc(t.ptCuoi.mucNguoi, t.ptCuoi.lyDoNguoi) + "</td></tr>";
    }),
  );

  const dongThoiGian = dsPhien.map(function (p, i) {
    return '<a class="tc-moc" href="#phien-' + esc(p.id) + '" data-cuon="phien-' + esc(p.id) + '">' +
      "<b>Lần " + (i + 1) + "</b> · " + gioVN(p.thoi_gian_chu) + " · " + esc(p.ten_nhan_vien) + " · " +
      nhanMuc(dsPt[i].muc, dsPt[i].lyDo) + "</a>";
  }).join("");

  return ketLuan + chiSo + diemKiem +
    '<div class="tc-khoi"><h3>👥 Người đã kiểm đơn này <span class="tc-dem">kiểm ' + n +
    " lần bởi " + dsNv.length + " người · đánh giá theo tay nghề (quét thừa / quét sai)</span></h3>" + bangNguoi +
    '<div class="tc-dong-thoi-gian">' + dongThoiGian + "</div></div>";
}

function vePhien(p, pt, lanThu, tongLan, moSan, duocChon) {
  const suKien = p.su_kien || [];

  const hangSku = pt.skus.map(function (x) {
    const ketQua = x.daKiem >= x.can
      ? '<span class="tc-ket-qua-tot">✅ Đủ</span>'
      : '<span class="tc-ket-qua-xau">❌ Thiếu ' + (x.can - x.daKiem) + "</span>";
    return '<tr><td class="ma">' + esc(x.sku) + '</td><td class="so">' + x.can +
      '</td><td class="so">' + x.daKiem + "</td><td>" + ketQua +
      (x.thua ? ' <span class="tc-ket-qua-xau">· quét thừa ' + x.thua + " lần</span>" : "") +
      "</td></tr>";
  });
  const maLa = pt.sai.map(function (s) {
    return '<tr class="tc-dong-loi"><td class="ma">' + esc(s.ma_quet_goc) +
      '</td><td class="so">—</td><td class="so">—</td><td><span class="tc-ket-qua-xau">❌ Mã lạ, không thuộc đơn</span></td></tr>';
  });

  const thoiGianKiem = pt.kt
    ? (new Date(pt.kt.thoi_gian_chu) - new Date(p.thoi_gian_chu)) / 1000
    : null;

  return (
    '<div class="tc-khoi' + (duocChon ? " duoc-chon" : "") + '" id="phien-' + esc(p.id) + '"><h3>' +
    nhanMuc(pt.muc, pt.lyDo) +
    " Lần kiểm " + lanThu + "/" + tongLan + " · " + gioVN(p.thoi_gian_chu) +
    (lanThu === tongLan && tongLan > 1 ? ' <span class="tc-dem">· mới nhất</span>' : "") +
    "</h3>" +
    '<div class="tc-thong-tin">' +
    "<span>Mã vận đơn: <b>" + esc(p.ma_van_don) + "</b></span>" +
    "<span>Mã đơn: <b>" + esc(p.ma_don_hang || "—") + "</b></span>" +
    "<span>Nhân viên: " + linkNhanVien(p.ten_nhan_vien) + "</span>" +
    "<span>Máy: <b>" + esc(p.thiet_bi || "—") + "</b></span>" +
    "<span>Kết thúc: " + nhanKetQua(pt.kt ? pt.kt.loai : null) + "</span>" +
    "<span>Thời gian kiểm: <b>" + thoiLuong(thoiGianKiem) + "</b></span>" +
    "<span>Danh sách hàng phiên bản: <b>" + esc(p.phien_tao_don_id || "—") + "</b></span>" +
    "</div>" +
    (pt.dsDoi
      ? '<div class="tc-canh-bao-ds">📝 Danh sách hàng khác lần kiểm trước: <b>' + esc(pt.khacBiet.join("; ")) + "</b></div>"
      : "") +
    bang(
      [{ ten: "SKU" }, { ten: "Cần kiểm", so: true }, { ten: "Đã kiểm", so: true }, { ten: "Kết quả" }],
      hangSku.concat(maLa),
    ) +
    '<details class="tc-bang-an"' + (moSan ? " open" : "") + "><summary>Từng lần quét (" + suKien.length +
    (pt.thua.length + pt.sai.length ? " · " + (pt.thua.length + pt.sai.length) + " lần lỗi được tô đỏ" : "") +
    ")</summary>" +
    bang(
      [{ ten: "#" }, { ten: "Giờ máy chủ" }, { ten: "Loại" }, { ten: "Mã quét" }, { ten: "Tiến độ" },
        { ten: "Ghi chú" }, { ten: "Niêm phong" }],
      suKien.map(function (s) {
        const loi = s.loai === "QUET_THUA" || s.loai === "QUET_SAI_MA";
        return "<tr" + (loi ? ' class="tc-dong-loi"' : "") + '><td class="so">' + esc(s.so_thu_tu) + "</td><td>" +
          gioVN(s.thoi_gian_chu) + "</td><td>" + nhanLoai(s.loai) + '</td><td class="ma">' + esc(s.ma_quet_goc || "") +
          '</td><td class="so">' + (s.da_kiem_sau != null ? s.da_kiem_sau + "/" + s.can_kiem : "") +
          "</td><td>" + esc(s.ghi_chu || "") + '</td><td class="mo">#' + esc(s.so_chuoi) +
          " · " + esc(s.ma_bam) + "</td></tr>";
      }),
    ) +
    "</details></div>"
  );
}

function veKhongTimThay(ds) {
  return '<div class="tc-khoi"><h3>🔍 Quét mã này nhưng không tìm thấy đơn <span class="tc-dem">' +
    ds.length + " lần · lỗi hệ thống, không tính cho nhân viên</span></h3>" +
    bang(
      [{ ten: "Lúc" }, { ten: "Loại" }, { ten: "Nhân viên" }, { ten: "Máy" }, { ten: "Ghi chú" }],
      ds.map(function (s) {
        return "<tr><td>" + gioVN(s.thoi_gian_chu) + "</td><td>" + nhanLoai(s.loai) +
          "</td><td>" + linkNhanVien(s.ten_nhan_vien) + '</td><td class="mo">' +
          esc(s.thiet_bi) + "</td><td>" + esc(s.ghi_chu) + "</td></tr>";
      }),
    ) +
    "</div>";
}

function linkNhanVien(ten) {
  return '<a class="nhan-vien" href="#/nhan-vien/' + esc(enc(ten)) + '">' + esc(ten) + "</a>";
}

function linkDon(ma, phienId) {
  return "#/tra-don/" + enc(ma) + (phienId ? "/" + enc(phienId) : "");
}

// =========================================================================
// PHẦN 4: DANH SÁCH ĐƠN ĐÃ KIỂM (dùng chung cho Nhân viên / Ngày / Khung giờ)
// =========================================================================

const NHOM_LOC = [
  { ma: "tat-ca", ten: "Tất cả", khop: function () { return true; } },
  { ma: "dat-chuan", ten: "🟢 Đạt chuẩn", khop: function (r) { return mucHang(r).muc === "DAT_CHUAN"; } },
  { ma: "can-xem-xet", ten: "🟡 Cần xem xét", khop: function (r) { return mucHang(r).muc === "CAN_XEM_XET"; } },
  { ma: "chua-du", ten: "🔴 Chưa đủ hàng", khop: function (r) { return mucHang(r).muc === "CHUA_DU"; } },
  { ma: "ds-doi", ten: "📝 DS hàng đổi", khop: function (r) { return !!r.ds_thay_doi; } },
  { ma: "nhieu-lan", ten: "👥 Kiểm nhiều lần", khop: function (r) { return r.so_lan_kiem_don > 1; } },
];

let dsHienTai = null; // { rows, nhom, tim, nv, gio, anNhanVien, chiGio }

// opts: { anNhanVien, chiGio, locNhanVien, nv, gio }
function veDanhSachPhien(rows, opts) {
  kiemTraSql3c(rows, "ds_thay_doi");
  dsHienTai = {
    rows: rows,
    nhom: "tat-ca",
    tim: "",
    nv: opts.nv || "",
    gio: opts.gio == null ? null : opts.gio,
    anNhanVien: !!opts.anNhanVien,
    chiGio: !!opts.chiGio,
    locNhanVien: !!opts.locNhanVien,
  };
  const dsTen = Array.from(new Set(rows.map(function (r) { return r.ten_nhan_vien; }))).sort();

  return '<div class="tc-khoi" id="khoi-ds-phien"><h3>📋 Danh sách đơn đã kiểm <span class="tc-dem">' +
    "bấm vào một đơn để xem chi tiết · mức đánh giá theo tay nghề; 📝 = danh sách hàng khác lần kiểm trước " +
    "(đơn cần xem xét, không tính lỗi cho người kiểm)</span></h3>" +
    '<div class="tc-hang-loc">' +
    '<div class="tc-nhom-nut" id="ds-nhom"></div>' +
    '<input type="text" id="ds-tim" placeholder="Tìm mã vận đơn / mã đơn..." autocomplete="off" />' +
    (opts.locNhanVien
      ? '<select id="ds-nv"><option value="">Tất cả nhân viên</option>' +
        dsTen.map(function (t) {
          return '<option value="' + esc(t) + '"' + (t === dsHienTai.nv ? " selected" : "") + ">" + esc(t) + "</option>";
        }).join("") + "</select>"
      : "") +
    '<span id="ds-gio"></span>' +
    "</div>" +
    '<div id="ds-bang"></div></div>';
}

function locDanhSach() {
  const d = dsHienTai;
  const tim = d.tim.trim().toLowerCase();
  return d.rows.filter(function (r) {
    if (d.nv && r.ten_nhan_vien !== d.nv) return false;
    if (d.gio != null && gioCuaPhien(r) !== d.gio) return false;
    if (tim && String(r.ma_van_don).toLowerCase().indexOf(tim) < 0 &&
      String(r.ma_don_hang || "").toLowerCase().indexOf(tim) < 0) return false;
    return true;
  });
}

function gioCuaPhien(r) {
  return +new Date(r.mo_luc).toLocaleString("en-GB", { timeZone: MUI_GIO, hour: "2-digit", hour12: false });
}

function capNhatDanhSach() {
  const d = dsHienTai;
  if (!d || !document.getElementById("ds-bang")) return;
  const coSo = locDanhSach();
  const nhomHienTai = NHOM_LOC.filter(function (n) { return n.ma === d.nhom; })[0];
  const hien = coSo.filter(nhomHienTai.khop);

  document.getElementById("ds-nhom").innerHTML = NHOM_LOC.map(function (n) {
    return '<button class="tc-chip' + (n.ma === d.nhom ? " dang-chon" : "") + '" data-nhom="' + n.ma + '">' +
      n.ten + " <b>" + coSo.filter(n.khop).length + "</b></button>";
  }).join("");
  document.getElementById("ds-gio").innerHTML = d.gio == null ? ""
    : '<button class="tc-chip dang-chon" data-bo-gio="1">🕒 ' + d.gio + ":00–" + d.gio + ":59 ✕</button>";

  const cot = [{ ten: d.chiGio ? "Giờ" : "Mở lúc" }, { ten: "Mã vận đơn" }, { ten: "Mã đơn" }]
    .concat(d.anNhanVien ? [] : [{ ten: "Nhân viên" }])
    .concat([{ ten: "Kết quả" }, { ten: "SP", so: true }, { ten: "Thừa / Sai", so: true },
      { ten: "Thời gian", so: true }, { ten: "Kiểm chéo" }]);

  const hang = hien.map(function (r) {
    const giay = r.ket_thuc_luc ? (new Date(r.ket_thuc_luc) - new Date(r.mo_luc)) / 1000 : null;
    const loi = r.so_quet_thua + r.so_quet_sai;
    const m = mucHang(r);
    const kiemCheo = r.so_lan_kiem_don > 1
      ? '<span class="tc-nhan trung-tinh">👥 Lần ' + r.lan_kiem_thu + "/" + r.so_lan_kiem_don +
        " · " + r.so_nguoi_kiem_don + " người</span>"
      : '<span class="mo">—</span>';
    return hangBam(linkDon(r.ma_van_don, r.phien_id),
      "<td>" + (d.chiGio ? chiGioVN(r.mo_luc) : gioVN(r.mo_luc)) + '</td><td class="ma">' + esc(r.ma_van_don) +
      '</td><td class="mo">' + esc(r.ma_don_hang || "—") + "</td>" +
      (d.anNhanVien ? "" : '<td class="nhan-vien">' + esc(r.ten_nhan_vien) + "</td>") +
      "<td>" + nhanMuc(m.muc, m.lyDo) + nhanDsDoi(r) + '</td><td class="so">' + so(r.so_quet_dung) + "/" + so(r.so_sp_can) +
      '</td><td class="so' + (loi ? " tc-ket-qua-xau" : "") + '">' + so(r.so_quet_thua) + " / " + so(r.so_quet_sai) +
      '</td><td class="so">' + thoiLuong(giay) + "</td><td>" + kiemCheo + "</td>");
  });

  document.getElementById("ds-bang").innerHTML =
    (hang.length === 0
      ? '<div class="tc-chu-thich">Không có đơn phù hợp.</div>'
      : bang(cot, hang)) +
    '<div class="tc-chu-thich tc-dem-ds">Hiển thị ' + so(hien.length) + " / " + so(d.rows.length) + " lần kiểm" +
    (d.rows.length >= GIOI_HAN_PHIEN ? " · đã chạm giới hạn " + so(GIOI_HAN_PHIEN) + " lần kiểm mới nhất, hãy thu hẹp khoảng ngày" : "") +
    "</div>";
}

function ganDanhSachPhien() {
  const khoi = document.getElementById("khoi-ds-phien");
  if (!khoi) return;
  khoi.addEventListener("click", function (e) {
    const nut = e.target.closest("[data-nhom]");
    if (nut) {
      dsHienTai.nhom = nut.getAttribute("data-nhom");
      capNhatDanhSach();
    }
    if (e.target.closest("[data-bo-gio]")) datGioDanhSach(null);
  });
  document.getElementById("ds-tim").addEventListener("input", function (e) {
    dsHienTai.tim = e.target.value;
    capNhatDanhSach();
  });
  const chonNv = document.getElementById("ds-nv");
  if (chonNv) {
    chonNv.addEventListener("change", function (e) {
      dsHienTai.nv = e.target.value;
      capNhatDanhSach();
    });
  }
  capNhatDanhSach();
}

function datNhanVienDanhSach(ten) {
  if (!dsHienTai) return;
  dsHienTai.nv = dsHienTai.nv === ten ? "" : ten;
  const chonNv = document.getElementById("ds-nv");
  if (chonNv) chonNv.value = dsHienTai.nv;
  capNhatDanhSach();
  document.getElementById("khoi-ds-phien").scrollIntoView({ block: "start", behavior: "smooth" });
}

function datGioDanhSach(gio) {
  if (!dsHienTai) return;
  dsHienTai.gio = gio;
  if (bieuDoHienTai) {
    bieuDoHienTai.gioChon = gio;
    veLaiBieuDo();
  }
  capNhatDanhSach();
}

// =========================================================================
// PHẦN 5: NHÂN VIÊN
// =========================================================================

// Cộng dồn các dòng bc_nang_suat theo nhân viên
function tongHopNhanVien(dong) {
  const theoNv = {};
  dong.forEach(function (r) {
    const t = theoNv[r.ten_nhan_vien] || (theoNv[r.ten_nhan_vien] = {
      ten_nhan_vien: r.ten_nhan_vien, so_phien: 0, so_hoan_tat: 0, so_bo_do: 0, so_huy: 0,
      so_dong_trang: 0, so_sp_da_kiem: 0, so_quet_thua: 0, so_quet_sai: 0, so_loi_he_thong: 0,
      so_dat_chuan: 0, tongGiay: 0, soDonCoGiay: 0, soNgay: 0,
    });
    ["so_phien", "so_hoan_tat", "so_bo_do", "so_huy", "so_dong_trang", "so_sp_da_kiem",
      "so_quet_thua", "so_quet_sai", "so_loi_he_thong", "so_dat_chuan"].forEach(function (k) {
      t[k] += Number(r[k] || 0);
    });
    if (Number(r.so_phien) > 0) t.soNgay++;
    if (r.giay_tb_moi_don != null && r.so_hoan_tat > 0) {
      t.tongGiay += Number(r.giay_tb_moi_don) * r.so_hoan_tat;
      t.soDonCoGiay += Number(r.so_hoan_tat);
    }
  });
  Object.keys(theoNv).forEach(function (k) {
    const t = theoNv[k];
    t.giayTb = t.soDonCoGiay ? t.tongGiay / t.soDonCoGiay : null;
  });
  return theoNv;
}

const COT_NANG_SUAT = [
  { ten: "Phiên", so: true }, { ten: "🟢 Đạt chuẩn", so: true }, { ten: "🟡 Có lỗi", so: true },
  { ten: "🔴 Chưa đủ", so: true }, { ten: "Tỷ lệ đạt chuẩn", so: true }, { ten: "SP đã kiểm", so: true },
  { ten: "Quét thừa", so: true }, { ten: "Quét sai", so: true }, { ten: "Tỷ lệ lỗi quét", so: true },
  { ten: "TB mỗi đơn", so: true }, { ten: "Lỗi hệ thống", so: true },
];

// Đạt chuẩn = đủ hàng + không quét thừa / sai; Có lỗi = đủ hàng nhưng có quét thừa / sai;
// Chưa đủ = số phiên không đi tới hoàn tất (bỏ dở, hủy, đóng trang, treo)
function chiaMuc(r) {
  const n = function (k) { return Number(r[k] || 0); };
  return {
    dat: n("so_dat_chuan"),
    coLoi: Math.max(0, n("so_hoan_tat") - n("so_dat_chuan")),
    chuaDu: Math.max(0, n("so_phien") - n("so_hoan_tat")),
  };
}

function oNangSuat(r, giayTb) {
  const n = function (k) { return Number(r[k] || 0); };
  const m = chiaMuc(r);
  const tongQuet = n("so_sp_da_kiem") + n("so_quet_thua") + n("so_quet_sai");
  return '<td class="so">' + so(n("so_phien")) + '</td><td class="so">' + so(m.dat) +
    '</td><td class="so">' + so(m.coLoi) + '</td><td class="so">' + so(m.chuaDu) +
    '</td><td class="so"><b>' + phanTram(m.dat, n("so_phien")) +
    '</b></td><td class="so">' + so(n("so_sp_da_kiem")) + '</td><td class="so">' + so(n("so_quet_thua")) +
    '</td><td class="so">' + so(n("so_quet_sai")) + '</td><td class="so">' +
    phanTram(n("so_quet_thua") + n("so_quet_sai"), tongQuet) + '</td><td class="so">' + thoiLuong(giayTb) +
    '</td><td class="so mo">' + so(n("so_loi_he_thong")) + "</td>";
}

const CHU_THICH_LOI =
  '<p class="tc-chu-thich"><b>🟢 Đạt chuẩn</b> = đủ hàng, không quét thừa, không quét sai mã. ' +
  "<b>🟡 Có lỗi</b> = đủ hàng nhưng có quét thừa / quét sai. <b>🔴 Chưa đủ</b> = bỏ dở, hủy, đóng trang. " +
  "Đánh giá nhân viên chỉ tính lỗi do người kiểm: <b>danh sách hàng thay đổi</b> (đơn bị tạo lại) và " +
  "<b>lỗi hệ thống</b> (không tìm thấy đơn, mất mạng) <b>không tính cho nhân viên</b>.</p>";

async function veDanhSachNhanVien(luot) {
  setTrangThai("🔄 Đang tải danh sách nhân viên...");
  const dong = await goiRpc("bc_nang_suat", khoangNgay());
  kiemTraSql3c(dong, "so_dat_chuan");
  const theoNv = tongHopNhanVien(dong);
  const ten = Object.keys(theoNv).sort(function (a, b) {
    return theoNv[b].so_phien - theoNv[a].so_phien || a.localeCompare(b, "vi");
  });
  const cuaToi = localStorage.getItem("zzm_ten_nhan_vien");

  let html = thanhViTri([{ ten: "👤 Nhân viên" }], null) +
    '<div class="tc-hang-loc">' +
    (cuaToi ? '<a class="tc-chip" href="#/nhan-vien/' + esc(enc(cuaToi)) + '">🙋 Hồ sơ của tôi (' + esc(cuaToi) + ")</a>" : "") +
    "</div>" + CHU_THICH_LOI;

  html += ten.length === 0
    ? '<div class="tc-goi-y">Không có dữ liệu trong khoảng ngày này.</div>'
    : '<div class="tc-khoi"><h3>Nhân viên đã kiểm hàng <span class="tc-dem">' + chuKhoangNgay() +
      " · bấm vào một nhân viên để xem các đơn người đó đã kiểm</span></h3>" +
      bang([{ ten: "Nhân viên" }, { ten: "Số ngày làm", so: true }].concat(COT_NANG_SUAT),
        ten.map(function (k) {
          const t = theoNv[k];
          return hangBam("#/nhan-vien/" + enc(k),
            '<td class="nhan-vien">' + esc(k) + ' <span class="tc-mui-ten">›</span></td><td class="so">' +
            so(t.soNgay) + "</td>" + oNangSuat(t, t.giayTb));
        })) + "</div>";

  if (!ghiKhung("kq-nhan-vien", html, luot)) return;
  setTrangThai("✓ " + ten.length + " nhân viên kiểm hàng trong " + chuKhoangNgay());
}

async function veHoSoNhanVien(ten, luot) {
  setTrangThai("🔄 Đang tải hồ sơ " + ten + "...");
  const k = khoangNgay();
  const ketQua = await Promise.all([
    goiRpc("bc_nang_suat", k),
    goiRpc("bc_danh_sach_phien", { p_tu: k.p_tu, p_den: k.p_den, p_nhan_vien: ten }),
  ]);
  kiemTraSql3c(ketQua[0], "so_dat_chuan");
  const dongNv = ketQua[0].filter(function (r) { return r.ten_nhan_vien === ten; });
  const phien = ketQua[1];
  const t = tongHopNhanVien(dongNv)[ten] || tongHopNhanVien([{ ten_nhan_vien: ten }])[ten];
  const m = chiaMuc(t);
  const tongQuet = t.so_sp_da_kiem + t.so_quet_thua + t.so_quet_sai;
  const soDonKhac = new Set(phien.map(function (r) { return r.ma_van_don; })).size;
  const soKiemCheo = phien.filter(function (r) { return r.so_nguoi_kiem_don > 1; }).length;

  let html = thanhViTri(
    [{ ten: "👤 Nhân viên", link: "#/nhan-vien" }, { ten: esc(ten) }],
    "#/nhan-vien",
  ) +
    '<div class="tc-ho-so"><div class="tc-anh-dai-dien">' + esc(ten.trim().charAt(0).toUpperCase() || "?") +
    '</div><div><div class="tc-ten-lon">' + esc(ten) + '</div><div class="tc-chu-thich">' + chuKhoangNgay() +
    " · " + so(t.soNgay) + " ngày có kiểm hàng</div></div></div>" +
    '<div class="tc-luoi-so">' +
    oSo("Đơn đã kiểm", so(soDonKhac), so(t.so_phien) + " lần kiểm") +
    oSo("🟢 Tỷ lệ đạt chuẩn", phanTram(m.dat, t.so_phien), so(m.dat) + " lần kiểm sạch") +
    oSo("🟡 Đủ hàng nhưng có lỗi", so(m.coLoi), "lần · cần xem xét") +
    oSo("🔴 Chưa đủ hàng", so(m.chuaDu), "lần bỏ dở / hủy / đóng") +
    oSo("Sản phẩm đã kiểm", so(t.so_sp_da_kiem), "lần quét đúng") +
    oSo("Tỷ lệ lỗi quét", phanTram(t.so_quet_thua + t.so_quet_sai, tongQuet),
      so(t.so_quet_thua) + " thừa · " + so(t.so_quet_sai) + " sai") +
    oSo("TB mỗi đơn", thoiLuong(t.giayTb), "từ mở phiên đến đủ hàng") +
    oSo("Đơn có kiểm chéo", so(soKiemCheo), "đơn này cũng được người khác kiểm") +
    "</div>";

  if (dongNv.length > 0) {
    html += '<details class="tc-khoi tc-gap"><summary><b>📅 Theo ngày</b> <span class="tc-dem">' + dongNv.length +
      " ngày · bấm vào ngày để xem chi tiết ngày đó</span></summary>" +
      bang([{ ten: "Ngày" }].concat(COT_NANG_SUAT), dongNv.map(function (r) {
        return hangBam("#/tong-quan/ngay/" + r.ngay + "/" + enc(ten),
          "<td>" + ngayVN(r.ngay) + ' <span class="tc-mui-ten">›</span></td>' + oNangSuat(r, r.giay_tb_moi_don));
      })) + "</details>";
  }

  html += phien.length === 0
    ? '<div class="tc-goi-y">' + esc(ten) + " chưa kiểm đơn nào trong khoảng ngày này.</div>"
    : veDanhSachPhien(phien, { anNhanVien: true });

  if (!ghiKhung("kq-nhan-vien", html, luot)) return;
  ganDanhSachPhien();
  setTrangThai("✓ " + ten + ": " + so(phien.length) + " lần kiểm trong " + chuKhoangNgay());
}

// =========================================================================
// PHẦN 6: TỔNG QUAN → NGÀY → KHUNG GIỜ
// =========================================================================

async function veTongQuan(luot) {
  setTrangThai("🔄 Đang tải tổng quan...");
  const ketQua = await Promise.all([
    goiRpc("bc_tong_quan", khoangNgay()),
    goiRpc("bc_theo_gio", khoangNgay()),
  ]);
  const theoNgay = ketQua[0];
  const theoGio = ketQua[1];
  kiemTraSql3c(theoNgay, "so_dat_chuan");

  let html = thanhViTri([{ ten: "📊 Tổng quan" }], null) + veOSoTongQuan(theoNgay) +
    '<div class="tc-khoi"><h3>Sản phẩm kiểm đúng theo giờ trong ngày <span class="tc-dem">' + chuKhoangNgay() +
    " · bấm vào cột để xem các đơn kiểm trong giờ đó</span></h3>" +
    '<div class="tc-bieu-do" id="bieu-do-gio"></div>' + veBangGio(theoGio) + "</div>" +
    '<div class="tc-khoi"><h3>Theo ngày <span class="tc-dem">bấm vào một ngày để xem danh sách đơn ngày đó</span></h3>' +
    (theoNgay.length === 0
      ? '<div class="tc-goi-y">Không có dữ liệu trong khoảng ngày này.</div>'
      : bang(
          [{ ten: "Ngày" }, { ten: "Đơn", so: true }, { ten: "Phiên", so: true }, { ten: "🟢 Đạt chuẩn", so: true },
            { ten: "🟡 Có lỗi", so: true }, { ten: "🔴 Chưa đủ", so: true }, { ten: "Tỷ lệ đạt chuẩn", so: true },
            { ten: "Nhân viên", so: true }, { ten: "SP đã kiểm", so: true }, { ten: "Lỗi hệ thống", so: true }],
          theoNgay.map(function (r) {
            const m = chiaMuc(r);
            return hangBam("#/tong-quan/ngay/" + r.ngay,
              "<td>" + ngayVN(r.ngay) + ' <span class="tc-mui-ten">›</span></td><td class="so">' + so(r.so_don) +
              '</td><td class="so">' + so(r.so_phien) + '</td><td class="so">' + so(m.dat) +
              '</td><td class="so">' + so(m.coLoi) + '</td><td class="so">' + so(m.chuaDu) +
              '</td><td class="so"><b>' + phanTram(m.dat, +r.so_phien) +
              '</b></td><td class="so">' + so(r.so_nhan_vien) + '</td><td class="so">' + so(r.so_sp_da_kiem) +
              '</td><td class="so mo">' + so(r.so_loi_he_thong) + "</td>");
          }),
        )) +
    "</div>";

  if (!ghiKhung("kq-tong-quan", html, luot)) return;
  datBieuDo(theoGio, null, function (gio) {
    diToi("#/tong-quan/gio/" + gio);
  });
  setTrangThai("✓ Đã tải tổng quan " + theoNgay.length + " ngày");
}

function veOSoTongQuan(theoNgay) {
  const t = theoNgay.reduce(function (a, r) {
    const m = chiaMuc(r);
    a.don += +r.so_don; a.phien += +r.so_phien; a.dat += m.dat; a.coLoi += m.coLoi; a.chuaDu += m.chuaDu;
    a.sp += +r.so_sp_da_kiem; a.loiNguoi += +r.so_loi_nguoi; a.loiHeThong += +r.so_loi_he_thong;
    return a;
  }, { don: 0, phien: 0, dat: 0, coLoi: 0, chuaDu: 0, sp: 0, loiNguoi: 0, loiHeThong: 0 });

  return '<div class="tc-luoi-so">' +
    oSo("Đơn đã kiểm", so(t.don), so(t.phien) + " phiên kiểm") +
    oSo("🟢 Tỷ lệ đạt chuẩn", phanTram(t.dat, t.phien), so(t.dat) + " phiên kiểm sạch") +
    oSo("🟡 Cần xem xét", so(t.coLoi), "đủ hàng nhưng quét thừa / sai") +
    oSo("🔴 Chưa đủ hàng", so(t.chuaDu), "bỏ dở / hủy / đóng trang") +
    oSo("Sản phẩm đã kiểm", so(t.sp), so(t.loiNguoi) + " lần quét lỗi · " + phanTram(t.loiNguoi, t.sp + t.loiNguoi)) +
    oSo("Lỗi hệ thống", so(t.loiHeThong), "không tìm thấy đơn + mất mạng") +
    "</div>";
}

function veBangGio(theoGio) {
  return '<details class="tc-bang-an"><summary>Xem dạng bảng</summary>' +
    bang(
      [{ ten: "Giờ" }, { ten: "SP kiểm đúng", so: true }, { ten: "Đơn hoàn tất", so: true }],
      theoGio.map(function (r) {
        return "<tr><td>" + r.gio + ":00 – " + r.gio + ':59</td><td class="so">' + so(r.so_sp_da_kiem) +
          '</td><td class="so">' + so(r.so_don_hoan_tat) + "</td></tr>";
      }),
    ) + "</details>";
}

async function veNgay(ngay, tenLoc, luot) {
  setTrangThai("🔄 Đang tải ngày " + ngayVN(ngay) + "...");
  const k = { p_tu: ngay, p_den: ngay };
  const ketQua = await Promise.all([
    goiRpc("bc_tong_quan", k),
    goiRpc("bc_nang_suat", k),
    goiRpc("bc_theo_gio", k),
    goiRpc("bc_danh_sach_phien", k),
  ]);
  kiemTraSql3c(ketQua[1], "so_dat_chuan");
  const theoNv = tongHopNhanVien(ketQua[1]);
  const ten = Object.keys(theoNv).sort(function (a, b) {
    return theoNv[b].so_phien - theoNv[a].so_phien || a.localeCompare(b, "vi");
  });
  const phien = ketQua[3];
  const homNayVN = homNay();

  let html = thanhViTri(
    [{ ten: "📊 Tổng quan", link: "#/tong-quan" }, { ten: "Ngày " + ngayVN(ngay) }],
    "#/tong-quan",
  ) +
    '<div class="tc-hang-loc">' +
    '<a class="tc-chip" href="#/tong-quan/ngay/' + congNgay(ngay, -1) + '">‹ Ngày trước</a>' +
    '<input type="date" id="chon-ngay" value="' + ngay + '" />' +
    (ngay < homNayVN ? '<a class="tc-chip" href="#/tong-quan/ngay/' + congNgay(ngay, 1) + '">Ngày sau ›</a>' : "") +
    (ngay !== homNayVN ? '<a class="tc-chip" href="#/tong-quan/ngay/' + homNayVN + '">Hôm nay</a>' : "") +
    "</div>" +
    veOSoTongQuan(ketQua[0]);

  html += ten.length === 0 ? "" :
    '<div class="tc-khoi"><h3>👥 Nhân viên trong ngày <span class="tc-dem">bấm vào nhân viên để lọc danh sách đơn bên dưới</span></h3>' +
    bang([{ ten: "Nhân viên" }].concat(COT_NANG_SUAT), ten.map(function (k2) {
      const t = theoNv[k2];
      return '<tr class="tc-hang-bam" tabindex="0" data-loc-nv="' + esc(k2) + '"><td class="nhan-vien">' +
        esc(k2) + ' <a class="tc-chip tc-chip-nho" href="#/nhan-vien/' + esc(enc(k2)) + '">Hồ sơ ›</a></td>' +
        oNangSuat(t, t.giayTb) + "</tr>";
    })) + "</div>";

  html += '<div class="tc-khoi"><h3>Sản phẩm kiểm đúng theo giờ <span class="tc-dem">bấm vào cột để lọc danh sách đơn theo giờ</span></h3>' +
    '<div class="tc-bieu-do" id="bieu-do-gio"></div>' + veBangGio(ketQua[2]) + "</div>";

  html += phien.length === 0
    ? '<div class="tc-goi-y">Không có đơn nào được kiểm ngày ' + ngayVN(ngay) + ".</div>"
    : veDanhSachPhien(phien, { chiGio: true, locNhanVien: true, nv: tenLoc });

  if (!ghiKhung("kq-tong-quan", html, luot)) return;
  ganDanhSachPhien();
  datBieuDo(ketQua[2], null, function (gio) {
    datGioDanhSach(dsHienTai && dsHienTai.gio === gio ? null : gio);
  });
  document.getElementById("chon-ngay").addEventListener("change", function (e) {
    if (e.target.value) diToi("#/tong-quan/ngay/" + e.target.value);
  });
  setTrangThai("✓ Ngày " + ngayVN(ngay) + ": " + so(phien.length) + " lần kiểm");
}

async function veKhungGio(gio, luot) {
  setTrangThai("🔄 Đang tải các đơn kiểm lúc " + gio + "h...");
  const k = khoangNgay();
  const phien = await goiRpc("bc_danh_sach_phien", { p_tu: k.p_tu, p_den: k.p_den, p_gio: gio });

  const html = thanhViTri(
    [{ ten: "📊 Tổng quan", link: "#/tong-quan" }, { ten: "Khung giờ " + gio + ":00 – " + gio + ":59" }],
    "#/tong-quan",
  ) +
    '<div class="tc-hang-loc">' +
    (gio > 0 ? '<a class="tc-chip" href="#/tong-quan/gio/' + (gio - 1) + '">‹ ' + (gio - 1) + "h</a>" : "") +
    '<span class="tc-chu-thich">Các lần kiểm mở trong khung ' + gio + ":00–" + gio + ":59, " + chuKhoangNgay() + "</span>" +
    (gio < 23 ? '<a class="tc-chip" href="#/tong-quan/gio/' + (gio + 1) + '">' + (gio + 1) + "h ›</a>" : "") +
    "</div>" +
    (phien.length === 0
      ? '<div class="tc-goi-y">Không có đơn nào được kiểm trong khung giờ này.</div>'
      : veDanhSachPhien(phien, { locNhanVien: true }));

  if (!ghiKhung("kq-tong-quan", html, luot)) return;
  ganDanhSachPhien();
  setTrangThai("✓ " + gio + "h: " + so(phien.length) + " lần kiểm trong " + chuKhoangNgay());
}

// ── BIỂU ĐỒ CỘT THEO GIỜ (1 chuỗi số liệu → 1 màu, không cần chú giải) ──
let bieuDoHienTai = null; // { theoGio, gioChon, khiBam }

function datBieuDo(theoGio, gioChon, khiBam) {
  bieuDoHienTai = { theoGio: theoGio, gioChon: gioChon, khiBam: khiBam };
  veLaiBieuDo();
  ganTooltipBieuDo();
}

// Vẽ theo đúng bề rộng khung hiện tại; xoay / đổi cỡ màn hình thì vẽ lại
function veLaiBieuDo() {
  const khung = document.getElementById("bieu-do-gio");
  if (!khung || !bieuDoHienTai || khung.offsetParent === null) return;
  khung.innerHTML = veBieuDoGio(bieuDoHienTai.theoGio, Math.max(560, khung.clientWidth), bieuDoHienTai.gioChon);
}
let henGioVeLai = 0;
window.addEventListener("resize", function () {
  clearTimeout(henGioVeLai);
  henGioVeLai = setTimeout(veLaiBieuDo, 150);
});

// Mốc trục tròn: 0, 5, 10, 20, 50, 100, 200, 500...
function mocTron(max) {
  if (max <= 0) return 4;
  const buoc = [1, 2, 5];
  let mu = 1;
  while (true) {
    for (let i = 0; i < buoc.length; i++) {
      const b = buoc[i] * mu;
      if (b * 4 >= max) return b;
    }
    mu *= 10;
  }
}

function veBieuDoGio(theoGio, W, gioChon) {
  const H = 220, trai = 44, phai = 8, tren = 12, duoi = 26;
  const rongVe = W - trai - phai, caoVe = H - tren - duoi;
  const max = Math.max.apply(null, theoGio.map(function (r) { return +r.so_sp_da_kiem; }).concat([0]));
  const buoc = mocTron(max);
  const dinh = buoc * 4;
  const rongO = rongVe / 24;
  const rongCot = Math.min(24, rongO - 6);
  const y = function (v) { return tren + caoVe - (v / dinh) * caoVe; };

  let svg = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H +
    '" role="img" aria-label="Số sản phẩm kiểm đúng theo từng giờ trong ngày">';
  for (let i = 0; i <= 4; i++) {
    const v = buoc * i;
    svg += '<line class="luoi" x1="' + trai + '" x2="' + (W - phai) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>' +
      '<text class="truc-chu" x="' + (trai - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + so(v) + "</text>";
  }
  theoGio.forEach(function (r, i) {
    const v = +r.so_sp_da_kiem;
    const x = trai + i * rongO + (rongO - rongCot) / 2;
    const cao = (v / dinh) * caoVe;
    if (gioChon === i) {
      svg += '<rect class="nen-chon" x="' + (trai + i * rongO) + '" y="' + tren + '" width="' + rongO +
        '" height="' + caoVe + '"/>';
    }
    // Vùng chạm cao hết cột để dễ rê chuột / bấm; cột bo 4px ở đầu, vuông ở gốc
    svg += '<rect class="vung-cham" data-gio="' + i + '" x="' + (trai + i * rongO) + '" y="' + tren +
      '" width="' + rongO + '" height="' + caoVe + '"/>';
    if (v > 0) {
      const r4 = Math.min(4, cao);
      const yd = y(v);
      svg += '<path class="cot' + (gioChon === i ? " sang" : "") + '" data-cot="' + i + '" d="M' + x + "," + (tren + caoVe) +
        " V" + (yd + r4) + " Q" + x + "," + yd + " " + (x + r4) + "," + yd + " H" + (x + rongCot - r4) +
        " Q" + (x + rongCot) + "," + yd + " " + (x + rongCot) + "," + (yd + r4) +
        " V" + (tren + caoVe) + ' Z"/>';
    }
    if (i % 3 === 0) {
      svg += '<text class="truc-chu" x="' + (trai + i * rongO + rongO / 2) + '" y="' + (H - 8) +
        '" text-anchor="middle">' + i + "h</text>";
    }
  });
  svg += '<line class="luoi" x1="' + trai + '" x2="' + (W - phai) + '" y1="' + (tren + caoVe) + '" y2="' + (tren + caoVe) + '"/>';
  return svg + "</svg>";
}

function ganTooltipBieuDo() {
  const khung = document.getElementById("bieu-do-gio");
  const tip = document.getElementById("tooltip");
  if (!khung) return;
  function anTip() {
    tip.hidden = true;
    khung.querySelectorAll(".cot.ro").forEach(function (c) { c.classList.remove("ro"); });
  }
  khung.addEventListener("mousemove", function (e) {
    const vung = e.target.closest(".vung-cham");
    if (!vung) return anTip();
    const gio = +vung.getAttribute("data-gio");
    const r = bieuDoHienTai.theoGio[gio];
    khung.querySelectorAll(".cot.ro").forEach(function (c) { c.classList.remove("ro"); });
    const cot = khung.querySelector('.cot[data-cot="' + gio + '"]');
    if (cot) cot.classList.add("ro");
    tip.innerHTML = "<b>" + gio + ":00 – " + gio + ":59</b><br>" + so(r.so_sp_da_kiem) +
      " sản phẩm kiểm đúng<br>" + so(r.so_don_hoan_tat) + " đơn hoàn tất<br><i>Bấm để xem danh sách đơn</i>";
    tip.hidden = false;
    const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
    tip.style.left = x + "px";
    tip.style.top = e.clientY - tip.offsetHeight - 10 + "px";
  });
  khung.addEventListener("mouseleave", anTip);
  khung.addEventListener("click", function (e) {
    const vung = e.target.closest(".vung-cham");
    if (!vung || !bieuDoHienTai.khiBam) return;
    anTip();
    bieuDoHienTai.khiBam(+vung.getAttribute("data-gio"));
  });
}

// =========================================================================
// PHẦN 7: BẤT THƯỜNG & NIÊM PHONG
// =========================================================================

async function veBatThuong(luot) {
  setTrangThai("🔄 Đang kiểm tra niêm phong & bất thường...");
  const d = await goiRpc("bc_bat_thuong", khoangNgay());
  let html = thanhViTri([{ ten: "🛡️ Bất thường" }], null);

  html += d.niem_phong.length === 0
    ? '<div class="tc-hop tot">✅ Sổ nhật ký toàn vẹn — không phát hiện dòng nào bị sửa, xóa hay chèn trong khoảng ngày này' +
      '<span class="phu">Kiểm tra bằng cách băm lại từng dòng và đối chiếu với dòng ngay trước nó.</span></div>'
    : '<div class="tc-hop xau">🚨 PHÁT HIỆN ' + d.niem_phong.length + " CHỖ BẤT THƯỜNG TRONG NIÊM PHONG" +
      '<span class="phu">Có thể có người can thiệp trực tiếp vào database. Chụp lại màn hình này làm bằng chứng.</span></div>' +
      '<div class="tc-khoi">' + bang(
        [{ ten: "Sổ" }, { ten: "Số chuỗi", so: true }, { ten: "Vấn đề" }],
        d.niem_phong.map(function (r) {
          return "<tr><td>" + esc(tenSo(r.bang)) + '</td><td class="so">' + esc(r.so_chuoi) +
            '</td><td class="tc-ket-qua-xau">' + esc(r.van_de) + "</td></tr>";
        }),
      ) + "</div>";

  html += '<div class="tc-khoi"><h3>📌 Điểm neo hiện tại <span class="tc-dem">chép lại cuối mỗi ngày ra ngoài database (sổ tay, Google Sheet) để đối chiếu</span>' +
    ' <button class="tc-chip" id="nut-chep-neo">📋 Chép</button></h3>' +
    bang(
      [{ ten: "Sổ" }, { ten: "Số dòng", so: true }, { ten: "Số chuỗi cuối", so: true }, { ten: "Mã băm cuối" }],
      d.diem_neo.map(function (r) {
        return "<tr><td>" + esc(tenSo(r.bang)) + '</td><td class="so">' + so(r.so_dong) + '</td><td class="so">' +
          esc(r.so_chuoi_cuoi) + '</td><td class="ma">' + esc(r.ma_bam_cuoi) + "</td></tr>";
      }),
    ) + "</div>";

  html += khoiBatThuong("🧩 Phiên bị thiếu lần quét", "Lần quét đã xảy ra trên máy nhưng không tới được máy chủ",
    d.phien_thieu_su_kien,
    [{ ten: "Mở phiên" }, { ten: "Mã vận đơn" }, { ten: "Nhân viên" }, { ten: "Thiếu số thứ tự" }],
    function (r) {
      return hangBam(linkDon(r.ma_van_don, r.phien_id), "<td>" + gioVN(r.mo_phien_luc) + '</td><td class="ma">' +
        esc(r.ma_van_don) + '</td><td class="nhan-vien">' + esc(r.ten_nhan_vien) + "</td><td>" + esc(r.thieu_tu_so) +
        (r.thieu_den_so > r.thieu_tu_so ? " → " + esc(r.thieu_den_so) : "") + "</td>");
    });

  html += khoiBatThuong("⏳ Phiên không có kết thúc", "Mở quá 1 giờ mà không hoàn tất / bỏ dở / hủy — máy hết pin, treo…",
    d.phien_treo,
    [{ ten: "Mở phiên" }, { ten: "Mã vận đơn" }, { ten: "Nhân viên" }, { ten: "Máy" }, { ten: "Hoạt động cuối" }],
    function (r) {
      return hangBam(linkDon(r.ma_van_don, r.phien_id), "<td>" + gioVN(r.mo_phien_luc) + '</td><td class="ma">' +
        esc(r.ma_van_don) + '</td><td class="nhan-vien">' + esc(r.ten_nhan_vien) + '</td><td class="mo">' +
        esc(r.thiet_bi) + "</td><td>" + gioVN(r.hoat_dong_cuoi) + "</td>");
    });

  html += khoiBatThuong("👻 Lần quét không có phiên", "Có lần quét nhưng dòng phiên tương ứng bị thất lạc",
    d.su_kien_mo_coi,
    [{ ten: "Từ" }, { ten: "Đến" }, { ten: "Nhân viên" }, { ten: "Số lần quét", so: true }],
    function (r) {
      return "<tr><td>" + gioVN(r.tu) + "</td><td>" + gioVN(r.den) + '</td><td class="nhan-vien">' +
        esc(r.ten_nhan_vien) + '</td><td class="so">' + so(r.so_su_kien) + "</td></tr>";
    });

  html += khoiBatThuong("🕒 Giờ máy kiểm lệch", "Đồng hồ máy chạy sai, hoặc gửi trễ do mất mạng (tối đa 200 dòng mới nhất)",
    d.lech_gio,
    [{ ten: "Giờ máy chủ" }, { ten: "Giờ máy kiểm" }, { ten: "Lệch" }, { ten: "Máy" }, { ten: "Nhân viên" }, { ten: "Nhận định" }],
    function (r) {
      const lech = (new Date(r.thoi_gian_may) - new Date(r.thoi_gian_chu)) / 1000;
      return "<tr><td>" + gioVN(r.thoi_gian_chu) + "</td><td>" + gioVN(r.thoi_gian_may) + "</td><td>" +
        (lech > 0 ? "Máy nhanh " : "Máy chậm / gửi trễ ") + thoiLuong(Math.abs(lech)) + '</td><td class="mo">' +
        esc(r.thiet_bi) + '</td><td class="nhan-vien">' + esc(r.ten_nhan_vien) + "</td><td>" + esc(r.nhan_dinh) + "</td></tr>";
    });

  if (!ghiKhung("kq-bat-thuong", html, luot)) return;

  document.getElementById("nut-chep-neo").addEventListener("click", function () {
    const chu = d.diem_neo.map(function (r) {
      return homNay() + "\t" + tenSo(r.bang) + "\t" + r.so_dong + "\t" + r.so_chuoi_cuoi + "\t" + r.ma_bam_cuoi;
    }).join("\n");
    navigator.clipboard.writeText(chu).then(
      function () { setTrangThai("✓ Đã chép điểm neo — dán vào Google Sheet / sổ tay"); },
      function () { setTrangThai("❌ Trình duyệt chặn chép, hãy bôi đen bảng và Ctrl+C", true); },
    );
  });
  setTrangThai("✓ Đã kiểm tra niêm phong & bất thường");
}

function khoiBatThuong(tieuDe, moTa, ds, cot, veHang) {
  return '<div class="tc-khoi"><h3>' + tieuDe + ' <span class="tc-dem">' + ds.length + " · " + esc(moTa) +
    "</span></h3>" +
    (ds.length === 0 ? '<div class="tc-chu-thich">✓ Không có</div>' : bang(cot, ds.map(veHang))) +
    "</div>";
}

// =========================================================================
// PHẦN 8: KHỞI ĐỘNG & SỰ KIỆN CHUNG
// =========================================================================

function datKhoangNgay(soNgay) {
  const den = homNay();
  document.getElementById("den-ngay").value = den;
  document.getElementById("tu-ngay").value = congNgay(den, -(soNgay - 1));
  document.querySelectorAll(".tc-chip[data-so-ngay]").forEach(function (c) {
    c.classList.toggle("dang-chon", +c.getAttribute("data-so-ngay") === soNgay);
  });
}

document.addEventListener("DOMContentLoaded", function () {
  datKhoangNgay(7);

  document.querySelectorAll(".tc-tab").forEach(function (t) {
    t.addEventListener("click", function () {
      diToi("#/" + t.getAttribute("data-tab"));
    });
  });
  document.querySelectorAll(".tc-chip[data-so-ngay]").forEach(function (c) {
    c.addEventListener("click", function () {
      datKhoangNgay(+c.getAttribute("data-so-ngay"));
      dinhTuyen();
    });
  });
  ["tu-ngay", "den-ngay"].forEach(function (id) {
    document.getElementById(id).addEventListener("change", function () {
      document.querySelectorAll(".tc-chip[data-so-ngay]").forEach(function (c) {
        c.classList.remove("dang-chon");
      });
    });
  });
  document.getElementById("nut-xem").addEventListener("click", dinhTuyen);

  // Tra đơn: Enter (máy quét) hoặc nút Tra cứu
  function traTuO() {
    const ma = document.getElementById("o-ma-van-don").value.trim();
    if (ma) diToi(linkDon(ma));
  }
  document.getElementById("nut-tra").addEventListener("click", traTuO);
  document.getElementById("o-ma-van-don").addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      traTuO();
    }
  });

  // Bấm hàng / nút quay lại / mốc thời gian / lọc theo nhân viên (dùng chung cho mọi trang)
  document.addEventListener("click", function (e) {
    const quayLai = e.target.closest("[data-quay-lai]");
    if (quayLai) {
      if (soLanChuyenTrang > 0) history.back();
      else diToi(quayLai.getAttribute("data-quay-lai"));
      return;
    }
    const moc = e.target.closest("[data-cuon]");
    if (moc) {
      e.preventDefault();
      const dich = document.getElementById(moc.getAttribute("data-cuon"));
      if (dich) {
        const chiTiet = dich.querySelector("details");
        if (chiTiet) chiTiet.open = true;
        dich.scrollIntoView({ block: "start", behavior: "smooth" });
      }
      return;
    }
    if (e.target.closest("a, button, input, select, summary")) return;
    const locNv = e.target.closest("[data-loc-nv]");
    if (locNv) {
      datNhanVienDanhSach(locNv.getAttribute("data-loc-nv"));
      return;
    }
    const hang = e.target.closest("[data-href]");
    if (hang) diToi(hang.getAttribute("data-href"));
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" || !e.target.classList || !e.target.classList.contains("tc-hang-bam")) return;
    e.preventDefault();
    e.target.click();
  });

  window.addEventListener("hashchange", function () {
    soLanChuyenTrang++;
    dinhTuyen();
  });

  // Link cũ dạng ?ma=... → chuyển sang địa chỉ mới
  const maTuLink = new URLSearchParams(location.search).get("ma");
  if (maTuLink) {
    history.replaceState(null, "", location.pathname + linkDon(maTuLink));
  } else if (!location.hash) {
    let tabDau = "tra-don";
    try { tabDau = localStorage.getItem("zzm_tra_cuu_tab") || "tra-don"; } catch (e) {}
    if (tabDau === "van-don") tabDau = "tra-don"; // tên tab cũ
    history.replaceState(null, "", location.pathname + "#/" + tabDau);
  }
  dinhTuyen();
});
