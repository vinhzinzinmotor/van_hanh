// =========================================================================
// LỊCH SỬ KIỂM HÀNG — ZinZinMotor
// Ghi log phiên kiểm hàng lên bảng lich_su_kiem_hang trong Supabase
// Hoạt động bằng kỹ thuật Proxy Pattern — nghe lóng file gốc
// KHÔNG can thiệp vào thuật toán kiểm hàng chính
// =========================================================================

// ── DÙNG LẠI SUPABASE CLIENT ĐÃ KHỞI TẠO TỪ HTML ──
// (window.supabase đã được load từ CDN trong van_don_kiem_hang.html)
const _lichSu_supabase = window.supabase.createClient(
  "https://ecctfcqqibuaxfpfsimy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjY3RmY3FxaWJ1YXhmcGZzaW15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5MTkyMjEsImV4cCI6MjA5OTQ5NTIyMX0.zCXn7O-sXkrDZMgJtn9OTA0JsVffs7Tc-FLgYhb4qqI",
);

// ── LẤY TÊN NHÂN VIÊN TỪ LOCALSTORAGE ──
const _lichSu_tenNhanVien =
  localStorage.getItem("zzm_ten_nhan_vien") || "Khách vãng lai";

// ── BIẾN LƯU TRẠNG THÁI PHIÊN LỊCH SỬ ──
// Đặt tên khác hoàn toàn để không bị xung đột với file gốc
let _lichSu_phien = null;
let _lichSu_soLanQuet = 0; // Đếm số lần quét để auto-save mỗi 3 lần

// =========================================================================
// PHẦN 1: CÁC HÀM XỬ LÝ NỘI BỘ
// =========================================================================

function _lichSu_taoPhienId(maVanDon) {
  return maVanDon + "_" + new Date().getTime();
}

function _lichSu_khoiTaoPhien(maVanDon, maDonHang) {
  _lichSu_phien = {
    phien_id: _lichSu_taoPhienId(maVanDon),
    ma_van_don: maVanDon,
    ma_don_hang: maDonHang || "",
    tong_can_kiem: 0,
    chi_tiet: {
      thong_ke_sku: {}, // { skuKey: { can_kiem, da_kiem, trang_thai } }
      lich_su_thao_tac: [], // Mảng từng lần quét
    },
  };
  _lichSu_soLanQuet = 0;
}

// Tính tổng đã kiểm từ thong_ke_sku
function _lichSu_tinhTongDaKiem() {
  if (!_lichSu_phien) return 0;
  let tong = 0;
  for (const key in _lichSu_phien.chi_tiet.thong_ke_sku) {
    tong += _lichSu_phien.chi_tiet.thong_ke_sku[key].da_kiem || 0;
  }
  return tong;
}

// Chuẩn hóa SKU giống hệt file gốc
function _lichSu_chuanHoaSku(sku) {
  return String(sku || "")
    .replace(/-/g, "")
    .trim()
    .toUpperCase();
}

// =========================================================================
// PHẦN 2: GIAO TIẾP VỚI SUPABASE
// =========================================================================

async function _lichSu_dayLen(trangThai) {
  if (!_lichSu_phien) return;

  const payload = {
    phien_id: _lichSu_phien.phien_id,
    ma_van_don: _lichSu_phien.ma_van_don,
    ma_don_hang: _lichSu_phien.ma_don_hang,
    ten_nhan_vien: _lichSu_tenNhanVien,
    trang_thai_phien: trangThai,
    tong_can_kiem: _lichSu_phien.tong_can_kiem,
    tong_da_kiem: _lichSu_tinhTongDaKiem(),
    chi_tiet: _lichSu_phien.chi_tiet,
    cap_nhat_luc: new Date().toISOString(),
  };

  try {
    const { error } = await _lichSu_supabase
      .from("lich_su_kiem_hang")
      .upsert(payload, { onConflict: "phien_id" });

    if (error) {
      console.error("[LichSu] Lỗi ghi Supabase:", error.message);
    } else {
      console.log(
        "[LichSu] Đã lưu phiên:",
        _lichSu_phien.phien_id,
        "| Trạng thái:",
        trangThai,
      );
    }
  } catch (e) {
    console.error("[LichSu] Lỗi hệ thống:", e.message);
  }
}

// =========================================================================
// PHẦN 3: PROXY PATTERN — NGHE LÓNG CÁC HÀM CHÍNH
// Chờ file gốc chạy xong rồi mới thiết lập proxy
// =========================================================================

// Dùng setTimeout 0 để chắc chắn file gốc đã chạy xong và gán vào window
setTimeout(function () {
  // ── PROXY 1: batDauKiemDon — MỞ PHIÊN ──
  if (typeof window.batDauKiemDon === "function") {
    const _goc_batDauKiemDon = window.batDauKiemDon;

    window.batDauKiemDon = function (rows) {
      // B1: Chạy hàm gốc trước — UI render thẻ card bình thường
      _goc_batDauKiemDon(rows);

      // B2: Sau khi gốc chạy xong, đọc theCards từ window.phienHienTai
      if (!rows || rows.length === 0) return;

      const maVanDon = rows[0].ma_van_don || "";
      const maDonHang = rows[0].ma_don_hang || "";

      // Khởi tạo phiên lịch sử mới
      _lichSu_khoiTaoPhien(maVanDon, maDonHang);

      // Đọc theCards từ window.phienHienTai (file gốc đã gán vào window)
      const theCards = window.phienHienTai && window.phienHienTai.theCards;
      if (!theCards) return;

      let tongCan = 0;
      for (const skuKey in theCards) {
        const card = theCards[skuKey];
        _lichSu_phien.chi_tiet.thong_ke_sku[skuKey] = {
          sku_goc: card.skuGoc || skuKey,
          can_kiem: card.canKiem || 0,
          da_kiem: 0,
          trang_thai: "THIEU_HANG",
        };
        tongCan += card.canKiem || 0;
      }
      _lichSu_phien.tong_can_kiem = tongCan;

      // Ghi lần đầu lên Supabase để tạo bản ghi
      _lichSu_dayLen("DANG_DO");
    };

    console.log("[LichSu] Đã gắn proxy batDauKiemDon ✓");
  } else {
    console.warn(
      "[LichSu] CẢNH BÁO: window.batDauKiemDon không tìm thấy. Kiểm tra lại script_van_don_kiem_hang.js",
    );
  }

  // ── PROXY 2: quetSku — GHI MỖI LẦN QUÉT ──
  if (typeof window.quetSku === "function") {
    const _goc_quetSku = window.quetSku;

    window.quetSku = function (sku) {
      const inputGoc = sku;
      // A: Phân tích trạng thái TRƯỚC khi gốc chạy
      const skuKey = _lichSu_chuanHoaSku(sku);
      const theCards = window.phienHienTai && window.phienHienTai.theCards;
      const card = theCards ? theCards[skuKey] : null;

      let hanhDong, tinNhan;
      if (!card) {
        hanhDong = "QUET_SAI_MA";
        tinNhan = "Mã không có trong đơn hàng";
      } else if (card.daKiem >= card.canKiem) {
        hanhDong = "QUET_THUA_HANG";
        tinNhan =
          "Cảnh báo: quét thừa (" +
          (card.daKiem + 1) +
          "/" +
          card.canKiem +
          ")";
      } else {
        hanhDong = "QUET_THANH_CONG";
        tinNhan = "Thành công (" + (card.daKiem + 1) + "/" + card.canKiem + ")";
      }

      // B: Chạy hàm gốc — cộng số lượng, phát âm thanh, update UI
      _goc_quetSku(sku);

      // C: Ghi log vào phiên lịch sử
      if (_lichSu_phien) {
        // Ghi vào lịch sử thao tác
        _lichSu_phien.chi_tiet.lich_su_thao_tac.push({
          thoi_gian: new Date().toISOString(),
          sku: skuKey,
          sku_goc: card ? card.skuGoc || skuKey : inputGoc, // ← THÊM DÒNG NÀY
          hanh_dong: hanhDong,
          tin_nhan: tinNhan,
        });

        // Cập nhật thống kê SKU
        const thongKe = _lichSu_phien.chi_tiet.thong_ke_sku;
        if (!thongKe[skuKey]) {
          // SKU ngoại lai không có trong đơn
          thongKe[skuKey] = {
            sku_goc: skuKey,
            can_kiem: 0,
            da_kiem: 1,
            trang_thai: "NGOAI_LAI",
          };
        } else {
          thongKe[skuKey].da_kiem += 1;
          if (thongKe[skuKey].da_kiem > thongKe[skuKey].can_kiem) {
            thongKe[skuKey].trang_thai = "THUA_SO_LUONG";
          } else if (thongKe[skuKey].da_kiem === thongKe[skuKey].can_kiem) {
            thongKe[skuKey].trang_thai = "DU_HANG";
          }
        }

        // Auto-save mỗi 3 lần quét để không mất dữ liệu khi cúp điện
        _lichSu_soLanQuet++;
        if (_lichSu_soLanQuet % 3 === 0) {
          _lichSu_dayLen("DANG_DO");
        }
      }
    };

    console.log("[LichSu] Đã gắn proxy quetSku ✓");
  } else {
    console.warn("[LichSu] CẢNH BÁO: window.quetSku không tìm thấy.");
  }

  // ── PROXY 3: hienHoanTat — ĐÓNG PHIÊN ──
  if (typeof window.hienHoanTat === "function") {
    const _goc_hienHoanTat = window.hienHoanTat;

    window.hienHoanTat = function () {
      // Chạy hàm gốc trước — hiện overlay, phát âm thanh
      _goc_hienHoanTat();

      // Ghi lần cuối với trạng thái HOAN_TAT
      _lichSu_dayLen("HOAN_TAT");
    };

    console.log("[LichSu] Đã gắn proxy hienHoanTat ✓");
  } else {
    console.warn("[LichSu] CẢNH BÁO: window.hienHoanTat không tìm thấy.");
  }
}, 0); // setTimeout 0 — chờ file gốc chạy xong
