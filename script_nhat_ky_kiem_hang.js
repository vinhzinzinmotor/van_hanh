// =========================================================================
// NHẬT KÝ KIỂM HÀNG (GIAI ĐOẠN 1) — ZinZinMotor
// Sổ nhật ký CHỈ GHI THÊM: mỗi lần quét / thao tác = 1 dòng (bảng su_kien_kiem_hang)
// Chạy song song với script_lich_su_kiem_hang.js (bảng cũ lich_su_kiem_hang)
// Hoạt động bằng Proxy Pattern — KHÔNG can thiệp vào thuật toán kiểm hàng chính
// Dùng lại SUPABASE_URL / SUPABASE_KEY / chuanHoaSku của script_van_don_kiem_hang.js
// =========================================================================

(function () {
  const KHOA_HANG_DOI = "zzm_nhat_ky_hang_doi"; // Sự kiện chờ gửi (lưu trong máy, mất mạng không mất)
  const KHOA_LOI = "zzm_nhat_ky_loi"; // Sự kiện bị máy chủ từ chối (để kiểm tra lại)
  const KHOA_THIET_BI = "zzm_thiet_bi";
  const CHU_KY_GUI_LAI = 5000; // 5 giây thử gửi lại 1 lần khi mất mạng

  // =========================================================================
  // PHẦN 1: TIỆN ÍCH
  // =========================================================================

  function taoUuid() {
    if (window.crypto && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    // Dự phòng cho trình duyệt cũ / trang mở bằng file://
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    return (
      h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" +
      h.slice(16, 20) + "-" + h.slice(20)
    );
  }

  function docJson(khoa, macDinh) {
    try {
      const v = JSON.parse(localStorage.getItem(khoa));
      return v == null ? macDinh : v;
    } catch (e) {
      return macDinh;
    }
  }

  function ghiJson(khoa, giaTri) {
    try {
      localStorage.setItem(khoa, JSON.stringify(giaTri));
    } catch (e) {
      console.error("[NhatKy] Không lưu được vào bộ nhớ máy:", e.message);
    }
  }

  // Mã máy kiểm: tạo 1 lần, giữ mãi trên máy đó
  function layThietBi() {
    let id = localStorage.getItem(KHOA_THIET_BI);
    if (!id) {
      id = "TB-" + taoUuid().slice(0, 8).toUpperCase();
      localStorage.setItem(KHOA_THIET_BI, id);
    }
    return id;
  }
  const THIET_BI = layThietBi();

  // Đọc lại mỗi lần ghi để luôn đúng người đang dùng máy
  function tenNhanVien() {
    return localStorage.getItem("zzm_ten_nhan_vien") || "Khách vãng lai";
  }

  // =========================================================================
  // PHẦN 2: HÀNG ĐỢI GỬI — ghi vào máy trước, gửi lên Supabase sau
  // Gửi lỗi thì giữ lại gửi tiếp; mỗi dòng có id riêng nên gửi lại không bị trùng
  // =========================================================================

  // Hàng đợi nằm trong bộ nhớ máy (localStorage) — dùng CHUNG cho mọi tab kiểm hàng trên máy.
  // Mỗi lần thay đổi đều đọc lại bộ nhớ trước rồi mới ghi (không giữ bản riêng trong tab)
  // → 2 tab cùng mở không ghi đè mất dòng của nhau.
  let dangGui = false;
  // Dự phòng: bộ nhớ máy không ghi được (ẩn danh / đầy) → giữ hàng đợi trong RAM của tab như cũ
  let boNhoHong = false;
  let hangDoiRam = [];

  function docHangDoi() {
    return boNhoHong ? hangDoiRam.slice() : docJson(KHOA_HANG_DOI, []);
  }

  function luuHangDoi(ds) {
    if (!boNhoHong) {
      try {
        localStorage.setItem(KHOA_HANG_DOI, JSON.stringify(ds));
        return;
      } catch (e) {
        boNhoHong = true;
        console.error("[NhatKy] Không ghi được bộ nhớ máy, chuyển sang giữ hàng đợi trong tab:", e.message);
      }
    }
    hangDoiRam = ds;
  }

  function themVaoHangDoi(bang, duLieu) {
    const hangDoi = docHangDoi();
    hangDoi.push({ bang: bang, duLieu: duLieu });
    luuHangDoi(hangDoi);
    guiHangDoi();
  }

  // Bỏ 1 dòng đã xử lý xong khỏi hàng đợi, theo id riêng của dòng (không có id → bỏ dòng đầu)
  function boKhoiHangDoi(muc) {
    const id = muc.duLieu && muc.duLieu.id;
    const hangDoi = docHangDoi();
    luuHangDoi(id
      ? hangDoi.filter(function (m) { return !(m.duLieu && m.duLieu.id === id); })
      : hangDoi.slice(1));
  }

  function guiMot(muc, keepalive) {
    return fetch(SUPABASE_URL + "/rest/v1/" + muc.bang, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(muc.duLieu),
      keepalive: !!keepalive,
    });
  }

  async function guiHangDoi() {
    if (dangGui) return;
    dangGui = true;
    try {
      while (docHangDoi().length > 0) {
        const muc = docHangDoi()[0];
        let resp;
        try {
          resp = await guiMot(muc, false);
        } catch (e) {
          break; // Mất mạng → để nguyên, lát gửi lại
        }

        if (resp.ok || resp.status === 409) {
          // Thành công, hoặc 409 = dòng này đã có trên máy chủ (lần gửi trước đã tới)
        } else if (resp.status >= 500 || resp.status === 408 || resp.status === 429) {
          break; // Máy chủ đang lỗi / quá tải → lát gửi lại
        } else {
          // Dữ liệu bị từ chối → cất sang danh sách lỗi để không chặn các dòng sau
          const chiTiet = (await resp.text()).slice(0, 300);
          const dsLoi = docJson(KHOA_LOI, []);
          dsLoi.push({ muc: muc, trangThai: resp.status, chiTiet: chiTiet });
          ghiJson(KHOA_LOI, dsLoi.slice(-200));
          console.error("[NhatKy] Máy chủ từ chối:", resp.status, chiTiet);
        }

        boKhoiHangDoi(muc);
      }
    } finally {
      dangGui = false;
    }
  }

  // Đóng trang: bắn hết hàng đợi đi ngay (keepalive). Dòng nào chưa tới
  // vẫn nằm trong hàng đợi và được gửi lại ở lần mở trang sau.
  function guiKhanCap() {
    docHangDoi().forEach(function (muc) {
      guiMot(muc, true).catch(function () {});
    });
  }

  // =========================================================================
  // PHẦN 3: GHI SỰ KIỆN
  // =========================================================================

  let phien = null; // { id, soThuTu, hoanTat } — phiên đang kiểm
  const cacLanQuet = []; // Các lần bấm Enter đang xử lý: { ma, daGhi }

  function ghiSuKien(loai, t, ngoaiPhien) {
    const p = ngoaiPhien ? null : phien;
    themVaoHangDoi("su_kien_kiem_hang", {
      id: taoUuid(),
      phien_id: p ? p.id : null,
      so_thu_tu: p ? ++p.soThuTu : null,
      loai: loai,
      ma_quet_goc: t.maQuetGoc || null,
      sku: t.sku || null,
      da_kiem_sau: t.daKiemSau == null ? null : t.daKiemSau,
      can_kiem: t.canKiem == null ? null : t.canKiem,
      ghi_chu: t.ghiChu || null,
      ten_nhan_vien: tenNhanVien(),
      thiet_bi: THIET_BI,
      thoi_gian_may: new Date().toISOString(),
    });
  }

  // Tìm lần quét (mới nhất, chưa ghi) khớp điều kiện — tránh nhầm khi bắn mã liên tục
  function timLanQuet(khop) {
    for (let i = cacLanQuet.length - 1; i >= 0; i--) {
      const q = cacLanQuet[i];
      if (!q.daGhi && khop(q)) return q;
    }
    return null;
  }

  // Danh sách SKU còn thiếu của đơn đang hiển thị, vd: "83500-K56-V00ZB 1/2; 17210-K2S-N00 0/1"
  function moTaConThieu() {
    const cards = (window.phienHienTai && window.phienHienTai.theCards) || {};
    const thieu = [];
    for (const key in cards) {
      const c = cards[key];
      if (c.daKiem < c.canKiem) {
        thieu.push((c.skuGoc || key) + " " + c.daKiem + "/" + c.canKiem);
      }
    }
    return thieu.join("; ");
  }

  function dongPhienChuaXong(loai, maQuetGoc, moTa) {
    if (phien && !phien.hoanTat) {
      ghiSuKien(loai, {
        maQuetGoc: maQuetGoc,
        ghiChu: moTa + " Còn thiếu: " + moTaConThieu(),
      });
    }
    phien = null;
  }

  function moPhien(rows, quet) {
    const cards = (window.phienHienTai && window.phienHienTai.theCards) || {};
    const danhSach = {};
    let tongSp = 0;
    for (const key in cards) {
      danhSach[key] = { sku_goc: cards[key].skuGoc || key, can_kiem: cards[key].canKiem };
      tongSp += cards[key].canKiem || 0;
    }

    phien = { id: taoUuid(), soThuTu: 0, hoanTat: false };
    themVaoHangDoi("phien_kiem_hang", {
      id: phien.id,
      ma_van_don: String(rows[0].ma_van_don || "").trim(),
      ma_don_hang: rows[0].ma_don_hang || null,
      phien_tao_don_id: rows[0].phien_id || null,
      danh_sach_can_kiem: danhSach,
      ten_nhan_vien: tenNhanVien(),
      thiet_bi: THIET_BI,
      thoi_gian_may: new Date().toISOString(),
    });
    ghiSuKien("MO_PHIEN", {
      maQuetGoc: quet ? quet.ma : null,
      ghiChu: Object.keys(danhSach).length + " mã SKU, tổng " + tongSp + " sản phẩm",
    });
  }

  // =========================================================================
  // PHẦN 4: PROXY PATTERN — NGHE LÉN CÁC HÀM CHÍNH
  // Chạy sau script_lich_su_kiem_hang.js nên bọc ra ngoài cả proxy của file đó
  // =========================================================================

  function boc(ten, taoHamBoc) {
    const goc = window[ten];
    if (typeof goc !== "function") {
      console.warn("[NhatKy] CẢNH BÁO: không tìm thấy hàm " + ten);
      return;
    }
    window[ten] = taoHamBoc(goc);
    console.log("[NhatKy] Đã gắn proxy " + ten + " ✓");
  }

  setTimeout(function () {
    // ── PROXY 1: xuLyQuetMaVach — bắt chuỗi quét nguyên văn + các mã không tìm thấy ──
    boc("xuLyQuetMaVach", function (goc) {
      return async function () {
        const input = document.getElementById("search-input");
        const quet = { ma: input ? input.value.trim() : "", daGhi: false };
        if (quet.ma) cacLanQuet.push(quet);

        try {
          return await goc.apply(this, arguments);
        } finally {
          cacLanQuet.splice(cacLanQuet.indexOf(quet), 1);
          // Không mở được đơn, cũng không phải SKU của đơn → ghi lại, không bỏ sót
          if (quet.ma && !quet.daGhi) {
            if (navigator.onLine === false) {
              ghiSuKien("LOI_MANG", {
                maQuetGoc: quet.ma,
                ghiChu: "Máy kiểm mất mạng khi tra cứu mã này",
              }, !(phien && !phien.hoanTat));
            } else if (phien && !phien.hoanTat) {
              ghiSuKien("QUET_SAI_MA", {
                maQuetGoc: quet.ma,
                ghiChu: "Mã không thuộc đơn đang kiểm, cũng không phải mã vận đơn",
              });
            } else {
              ghiSuKien("KHONG_TIM_THAY_DON", {
                maQuetGoc: quet.ma,
                ghiChu: "Không tìm thấy mã vận đơn trong hệ thống",
              }, true);
            }
          }
        }
      };
    });

    // ── PROXY 2: batDauKiemDon — đóng phiên cũ (nếu dở) và mở phiên mới ──
    boc("batDauKiemDon", function (goc) {
      return function (rows) {
        const maVanDon = rows && rows[0] ? String(rows[0].ma_van_don || "").trim() : "";
        const quet = timLanQuet(function (q) {
          return q.ma === maVanDon;
        });
        if (quet) quet.daGhi = true;

        // Đọc phần còn thiếu TRƯỚC khi hàm gốc xóa thẻ cũ
        dongPhienChuaXong(
          "BO_DO",
          quet ? quet.ma : maVanDon,
          "Chuyển sang đơn " + maVanDon + " khi đơn trước chưa đủ hàng.",
        );

        const ketQua = goc.apply(this, arguments);
        if (rows && rows.length > 0) moPhien(rows, quet);
        return ketQua;
      };
    });

    // ── PROXY 3: quetSku — ghi TRƯỚC khi hàm gốc chạy để đúng thứ tự với HOAN_TAT ──
    boc("quetSku", function (goc) {
      return function (sku) {
        const quet = timLanQuet(function (q) {
          return chuanHoaSku(q.ma) === sku;
        });
        if (quet) quet.daGhi = true;

        const cards = window.phienHienTai && window.phienHienTai.theCards;
        const card = cards ? cards[sku] : null;

        if (!card) {
          ghiSuKien("QUET_SAI_MA", {
            maQuetGoc: quet ? quet.ma : sku,
            sku: sku,
            ghiChu: "Mã không thuộc đơn đang kiểm",
          });
        } else if (card.daKiem >= card.canKiem) {
          ghiSuKien("QUET_THUA", {
            maQuetGoc: quet ? quet.ma : sku,
            sku: card.skuGoc || sku,
            daKiemSau: card.daKiem,
            canKiem: card.canKiem,
            ghiChu: "Đã đủ " + card.daKiem + "/" + card.canKiem + " nhưng vẫn quét thêm",
          });
        } else {
          ghiSuKien("QUET_DUNG", {
            maQuetGoc: quet ? quet.ma : sku,
            sku: card.skuGoc || sku,
            daKiemSau: card.daKiem + 1,
            canKiem: card.canKiem,
          });
        }

        return goc.apply(this, arguments);
      };
    });

    // ── PROXY 4: hienHoanTat — đóng phiên thành công ──
    boc("hienHoanTat", function (goc) {
      return function () {
        const ketQua = goc.apply(this, arguments);
        if (phien && !phien.hoanTat) {
          ghiSuKien("HOAN_TAT", { ghiChu: "Đủ toàn bộ hàng" });
          phien.hoanTat = true;
        }
        return ketQua;
      };
    });

    // ── PROXY 5: xoaGiaoDien — bấm Xóa / Esc khi đơn chưa đủ ──
    boc("xoaGiaoDien", function (goc) {
      return function () {
        dongPhienChuaXong("HUY", null, "Bấm Xóa/Esc khi đơn chưa đủ hàng.");
        return goc.apply(this, arguments);
      };
    });
  }, 0);

  // =========================================================================
  // PHẦN 5: GỬI LẠI & ĐÓNG TRANG
  // =========================================================================

  // e.persisted = trình duyệt chỉ TẠM CẤT trang (bấm sang trang khác, có thể bấm Back quay lại
  // nguyên trạng) → KHÔNG đóng phiên, chỉ gửi nốt dữ liệu. Chỉ đóng phiên khi trang bị đóng thật.
  // (Nếu không quay lại, phiên hiện ở mục "Phiên không có kết thúc" của trang tra cứu.)
  window.addEventListener("pagehide", function (e) {
    if (!e.persisted) dongPhienChuaXong("DONG_TRANG", null, "Đóng trang khi đơn chưa đủ hàng.");
    guiKhanCap();
  });
  // Quay lại trang đã tạm cất → gửi tiếp hàng đợi (nếu còn)
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) guiHangDoi();
  });

  window.addEventListener("online", guiHangDoi);
  setInterval(function () {
    if (docHangDoi().length > 0) guiHangDoi();
  }, CHU_KY_GUI_LAI);

  guiHangDoi(); // Gửi nốt những dòng còn tồn từ lần mở trang trước
})();
