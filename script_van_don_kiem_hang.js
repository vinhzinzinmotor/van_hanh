// =========================================================================
// HỆ THỐNG KIỂM HÀNG TỰ ĐỘNG — ZinZinMotor
// RAM Cache O(1), Delta Sync, Live Fallback — Giao diện thẻ card
// =========================================================================

// ── CẤU HÌNH — ĐIỀN VÀO 3 CHỖ NÀY ──
const SUPABASE_URL = "https://ecctfcqqibuaxfpfsimy.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjY3RmY3FxaWJ1YXhmcGZzaW15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5MTkyMjEsImV4cCI6MjA5OTQ5NTIyMX0.zCXn7O-sXkrDZMgJtn9OTA0JsVffs7Tc-FLgYhb4qqI";
const TABLE_NAME = "van_hanh_tao_don_hang";
const SYNC_INTERVAL = 30000; // 30 giây

// ── TẢI SẴN ÂM THANH KHI TRANG MỞ ──
const amThanhHoanTat = new Audio("sound/hoan_thanh.mp3");
amThanhHoanTat.preload = "auto";

// ── TẢI SẴN ÂM THANH LỖI ──
const amThanhLoi = new Audio("sound/error.mp3");
amThanhLoi.preload = "auto";

// ── TẢI SẴN ÂM THANH QUÉT ĐÚNG ──
const amThanhQuetDung = new Audio("sound/quet_ma_hang.mp3");
amThanhQuetDung.preload = "auto";

function phatAmThanhLoi() {
  amThanhLoi.currentTime = 0;
  amThanhLoi.play().catch(function () {});
}

function phatAmThanhQuetDung() {
  amThanhQuetDung.currentTime = 0;
  amThanhQuetDung.play().catch(function () {});
}

const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: "Bearer " + SUPABASE_KEY,
  "Content-Type": "application/json",
};
// Chuẩn hóa SKU: bỏ dấu gạch ngang để so khớp
function chuanHoaSku(sku) {
  return String(sku || "")
    .replace(/-/g, "")
    .trim()
    .toUpperCase();
}
// ──────────────────────────────────────────────────
//  🧠 RAM CACHE
// ──────────────────────────────────────────────────
let LOCAL_DB = {}; // { ma_van_don: [rows...] }
let LAST_SYNC_TIME = null;

// Trạng thái phiên kiểm hàng hiện tại
let phienHienTai = {
  maVanDon: null, // mã vận đơn đang kiểm
  maDonHang: null, // mã đơn hàng tương ứng
  theCards: {}, // { sku: { canKiem, daKiem } }
};

// ──────────────────────────────────────────────────
//  🧠 CẬP NHẬT RAM — giữ nguyên thuật toán gốc
// ──────────────────────────────────────────────────
function updateLocalDb(rows) {
  if (!rows || rows.length === 0) return;

  const groupedNew = {};
  for (const row of rows) {
    const mvn = row.ma_van_don ? String(row.ma_van_don).trim() : null;
    if (!mvn) continue;
    if (!groupedNew[mvn]) groupedNew[mvn] = [];
    groupedNew[mvn].push(row);
  }

  for (const [mvn, newRows] of Object.entries(groupedNew)) {
    const existingRows = LOCAL_DB[mvn] || [];
    const combined = [...existingRows, ...newRows];

    const uniqueCombined = [];
    const seenFingerprints = new Set();
    for (const r of combined) {
      const fp = JSON.stringify([
        r.id ?? null,
        r.phien_id ?? null,
        r.ma_van_don ?? null,
        r.ma_don_hang ?? null,
        r.sku ?? null,
        r.so_luong ?? null,
        r.gia ?? null,
      ]);
      if (!seenFingerprints.has(fp)) {
        seenFingerprints.add(fp);
        uniqueCombined.push(r);
      }
    }

    if (uniqueCombined.length === 0) continue;

    const latestRow = uniqueCombined.reduce((prev, curr) =>
      (curr.thoi_gian || "") > (prev.thoi_gian || "") ? curr : prev,
    );
    const latestPhienId = latestRow.phien_id;

    let filteredRows;
    if (latestPhienId) {
      filteredRows = uniqueCombined.filter((r) => r.phien_id === latestPhienId);
    } else {
      const maxTime = latestRow.thoi_gian || "";
      filteredRows = uniqueCombined.filter(
        (r) => (r.thoi_gian || "") === maxTime,
      );
    }

    LOCAL_DB[mvn] = filteredRows;
  }
}

// ──────────────────────────────────────────────────
//  🔄 ĐỒNG BỘ SUPABASE — giữ nguyên thuật toán gốc
// ──────────────────────────────────────────────────
async function dongBoSupabase(isFirstRun) {
  const nowStr = new Date().toISOString();
  let startTime;

  if (isFirstRun) {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    startTime = d.toISOString();
  } else {
    startTime = LAST_SYNC_TIME;
    if (!startTime) return { count: 0, status: "Chưa có thời gian sync" };
  }

  let allRows = [];
  const limit = 1000;
  let offset = 0;

  try {
    while (true) {
      const params = new URLSearchParams({
        thoi_gian: "gte." + startTime,
        select: "id,phien_id,ma_van_don,ma_don_hang,sku,so_luong,gia,thoi_gian",
        limit: limit,
        offset: offset,
      });

      const resp = await fetch(
        SUPABASE_URL + "/rest/v1/" + TABLE_NAME + "?" + params,
        { headers: HEADERS },
      );

      if (!resp.ok) {
        const text = await resp.text();
        return {
          count: 0,
          status: "Lỗi API " + resp.status + ": " + text.slice(0, 120),
        };
      }

      const rows = await resp.json();
      if (!rows || rows.length === 0) break;

      allRows = allRows.concat(rows);
      if (rows.length < limit) break;
      offset += limit;
    }

    if (allRows.length > 0) updateLocalDb(allRows);

    LAST_SYNC_TIME = nowStr;
    return { count: allRows.length, status: "Thành công" };
  } catch (e) {
    return { count: 0, status: "Lỗi hệ thống: " + e.message };
  }
}

// ──────────────────────────────────────────────────
//  🌐 TRA CỨU KHẨN CẤP — giữ nguyên thuật toán gốc
// ──────────────────────────────────────────────────
async function traKhanCap(maVanDon) {
  try {
    const params = new URLSearchParams({
      ma_van_don: "eq." + maVanDon,
      select: "id,phien_id,ma_van_don,ma_don_hang,sku,so_luong,gia,thoi_gian",
    });

    const resp = await fetch(
      SUPABASE_URL + "/rest/v1/" + TABLE_NAME + "?" + params,
      { headers: HEADERS },
    );

    if (resp.ok) return (await resp.json()) || [];
    return [];
  } catch (e) {
    return [];
  }
}

// ──────────────────────────────────────────────────
//  🃏 RENDER THẺ CARD CHO ĐƠN HÀNG — BẢN ĐÃ SỬA CỘNG DỒN SKU
// ──────────────────────────────────────────────────
function renderTheCards(rows) {
  const grid = document.getElementById("the-grid");
  const choQue = document.getElementById("cho-quet");
  const donHienTai = document.getElementById("don-hien-tai");

  grid.innerHTML = "";
  phienHienTai.theCards = {};

  if (!rows || rows.length === 0) return;

  // Lấy thông tin đơn hàng
  phienHienTai.maVanDon = rows[0].ma_van_don || "";
  phienHienTai.maDonHang = rows[0].ma_don_hang || "";

  // Hiện info bar, ẩn màn chờ
  choQue.style.display = "none";
  donHienTai.style.display = "flex";
  document.getElementById("don-ma-van-don").textContent = phienHienTai.maVanDon;
  document.getElementById("don-ma-don-hang").textContent =
    phienHienTai.maDonHang;

  // 🔄 BƯỚC 1: TẠO BẢNG TẠM ĐỂ CỘNG DỒN SỐ LƯỢNG SKU TRÙNG NHAU
  const danhSachGop = {};

  rows.forEach(function (row) {
    const sku = String(row.sku || "").trim();
    const skuKey = chuanHoaSku(sku);
    const soLuong = parseInt(row.so_luong) || 1;
    const tenSp = row.ten_san_pham || "";

    // Nếu mã SKU này chưa có trong bảng tạm, hãy khởi tạo nó
    if (!danhSachGop[skuKey]) {
      danhSachGop[skuKey] = {
        skuGoc: sku,
        tenSp: tenSp,
        tongCanKiem: 0,
      };
    }
    // Lấy số lượng của dòng này cộng dồn vào tổng số lượng cần kiểm
    danhSachGop[skuKey].tongCanKiem += soLuong;
  });

  // 🎨 BƯỚC 2: DUYỆT QUA DANH SÁCH ĐÃ GỘP ĐỂ VẼ THẺ VÀ LƯU VÀO RAM PHIÊN
  Object.keys(danhSachGop).forEach(function (skuKey) {
    const item = danhSachGop[skuKey];

    // Lưu trạng thái đã được cộng dồn vào RAM phiên
    phienHienTai.theCards[skuKey] = {
      canKiem: item.tongCanKiem,
      daKiem: 0,
      skuGoc: item.skuGoc,
    };

    // Tạo thẻ DOM duy nhất cho mã SKU này dựa trên tổng số lượng
    const the = document.createElement("div");
    the.className = "the-san-pham trang-thai-chua-du";
    the.id = "the-" + skuKey;
    the.innerHTML =
      '<div class="the-sku">' +
      item.skuGoc +
      "</div>" +
      '<div class="the-ten">' +
      item.tenSp +
      "</div>" +
      '<div class="the-progress-wrap">' +
      '<div class="the-progress-bar" id="bar-' +
      skuKey +
      '" style="width:0%"></div>' +
      "</div>" +
      '<div class="the-dem">' +
      '<div class="the-so-luong" id="dem-' +
      skuKey +
      '">0 / ' +
      item.tongCanKiem +
      "</div>" +
      '<div class="the-trang-thai chua-du" id="tag-' +
      skuKey +
      '">Chưa đủ</div>' +
      "</div>";

    grid.appendChild(the);
  });

  // Cập nhật lại thanh tiến độ tổng
  capNhatTienDo();
}

// ──────────────────────────────────────────────────
//  ➕ CẬP NHẬT KHI QUÉT SKU SẢN PHẨM
// ──────────────────────────────────────────────────
function quetSku(sku) {
  const card = phienHienTai.theCards[sku];
  const skuHienThi = card ? card.skuGoc || sku : sku; // ← THÊM DÒNG NÀY

  if (!card) {
    // SKU không thuộc đơn này
    setStatus("⚠️ SKU [" + skuHienThi + "] không có trong đơn hàng đang kiểm!");
    phatAmThanhLoi(); // ← THÊM
    const the = document.getElementById("the-" + sku);
    if (the) {
      the.classList.remove("flash-xanh");
      void the.offsetWidth; // reset animation
      the.classList.add("flash-do");
    }
    return;
  }

  if (card.daKiem >= card.canKiem) {
    // Đã đủ rồi — cảnh báo quét thừa
    setStatus("⚠️ SKU [" + skuHienThi + "] đã đủ số lượng rồi! Kiểm tra lại.");
    phatAmThanhLoi(); // ← THÊM
    return;
  }

  // Cộng thêm 1
  card.daKiem++;

  // 🚀 DÁN DÒNG NÀY VÀO ĐÂY ĐỂ KÍCH HOẠT HIỆU ỨNG BAY
  taoHieuUngBay(sku, skuHienThi);

  // Cập nhật UI thẻ
  const phanTram = Math.round((card.daKiem / card.canKiem) * 100);
  const bar = document.getElementById("bar-" + sku);
  const dem = document.getElementById("dem-" + sku);
  const tag = document.getElementById("tag-" + sku);
  const the = document.getElementById("the-" + sku);

  if (bar) {
    bar.style.width = phanTram + "%";
    bar.classList.toggle("day", card.daKiem >= card.canKiem);
  }
  if (dem) dem.textContent = card.daKiem + " / " + card.canKiem;

  if (card.daKiem >= card.canKiem) {
    // Đủ hàng
    if (the) {
      the.classList.remove("trang-thai-chua-du", "flash-do");
      the.classList.add("trang-thai-du-hang", "flash-xanh");
    }
    if (tag) {
      tag.textContent = "✅ Đủ hàng";
      tag.className = "the-trang-thai du-hang";
    }
    setStatus("✅ SKU [" + skuHienThi + "] — ĐỦ HÀNG!");
    // Chỉ phát tiếng quét đúng nếu đơn CHƯA hoàn tất toàn bộ
    var tatCaDu = Object.values(phienHienTai.theCards).every(function (c) {
      return c.daKiem >= c.canKiem;
    });
    if (!tatCaDu) {
      phatAmThanhQuetDung();
    }
  } else {
    // Chưa đủ
    if (the) {
      the.classList.remove("flash-xanh");
      void the.offsetWidth;
      the.classList.add("flash-xanh");
    }
    setStatus(
      "📦 SKU [" + skuHienThi + "] — " + card.daKiem + "/" + card.canKiem,
    );
    phatAmThanhQuetDung(); // ← THÊM
  }

  capNhatTienDo();

  // Kiểm tra toàn bộ đơn đã đủ chưa
  const tatCa = Object.values(phienHienTai.theCards);
  const dauDu = tatCa.filter((c) => c.daKiem >= c.canKiem).length;
  if (dauDu === tatCa.length && tatCa.length > 0) {
    hienHoanTat();
  }
}

// ──────────────────────────────────────────────────
//  📊 CẬP NHẬT THANH TIẾN ĐỘ TỔNG
// ──────────────────────────────────────────────────
function capNhatTienDo() {
  const tatCa = Object.values(phienHienTai.theCards);
  const daXong = tatCa.filter((c) => c.daKiem >= c.canKiem).length;
  const el = document.getElementById("don-tien-do");
  if (el)
    el.textContent = daXong + " / " + tatCa.length + " sản phẩm đã đủ hàng";
}

// ──────────────────────────────────────────────────
//  🎉 THÔNG BÁO HOÀN TẤT
// ──────────────────────────────────────────────────
function hienHoanTat() {
  // ── PHÁT NGAY — KHÔNG TRỄ ──
  amThanhHoanTat.currentTime = 0;
  amThanhHoanTat.play().catch(function () {});
  const overlay = document.getElementById("hoan-tat-overlay");
  if (overlay) {
    overlay.style.display = "flex";
    setTimeout(function () {
      overlay.style.display = "none";
    }, 1000);
  }
  setStatus("🎉 ĐƠN HÀNG: " + phienHienTai.maVanDon + " — ĐÃ ĐỦ TOÀN BỘ HÀNG!");
}

// ──────────────────────────────────────────────────
//  ⚡ XỬ LÝ KHI QUÉT MÃ VẠCH (Enter)
//  Phân biệt: mã vận đơn → load đơn | mã SKU → kiểm hàng
// ──────────────────────────────────────────────────
async function xuLyQuetMaVach() {
  const input = document.getElementById("search-input");
  const query = input.value.trim();
  input.value = "";
  input.focus();
  if (!query) return;

  const tStart = performance.now();

  // ── Nếu đang có đơn và query là SKU thuộc đơn → kiểm hàng
  const queryKey = chuanHoaSku(query);
  if (phienHienTai.maVanDon && phienHienTai.theCards[queryKey] !== undefined) {
    quetSku(queryKey);
    return;
  }

  // ── Thử tìm như mã vận đơn trước
  let rows = LOCAL_DB[query] || null;

  if (rows) {
    // Tìm thấy trên RAM
    const tElapsed = (performance.now() - tStart).toFixed(2);
    setStatus("⚡ Hệ Thống: Tìm thấy đơn trong " + tElapsed + "ms");
    batDauKiemDon(rows);
  } else {
    // Không có trên RAM → tra cứu khẩn cấp
    setStatus("🔍 Không có trên RAM. Đang truy vấn Internet...");
    rows = await traKhanCap(query);

    if (rows && rows.length > 0) {
      updateLocalDb(rows);
      capNhatRamCache();
      batDauKiemDon(LOCAL_DB[query] || rows);
      setStatus("✓ Đã tải đơn từ Internet.");
    } else {
      // Không phải mã vận đơn → thử xem có phải SKU đang kiểm không
      if (
        phienHienTai.maVanDon &&
        phienHienTai.theCards[queryKey] !== undefined
      ) {
        quetSku(queryKey);
      } else {
        setStatus("❌ Không tìm thấy: [" + query + "]");
        phatAmThanhLoi(); // ← THÊM
      }
    }
  }
}

// ──────────────────────────────────────────────────
//  📦 BẮT ĐẦU KIỂM MỘT ĐƠN HÀNG MỚI
// ──────────────────────────────────────────────────
function batDauKiemDon(rows) {
  // Reset trạng thái hoàn tất cũ nếu có
  const overlay = document.getElementById("hoan-tat-overlay");
  if (overlay) overlay.style.display = "none";

  renderTheCards(rows);
}

// ──────────────────────────────────────────────────
//  🗑️ XÓA GIAO DIỆN
// ──────────────────────────────────────────────────
function xoaGiaoDien() {
  phienHienTai = { maVanDon: null, maDonHang: null, theCards: {} };

  document.getElementById("the-grid").innerHTML = "";
  document.getElementById("don-hien-tai").style.display = "none";
  document.getElementById("cho-quet").style.display = "flex";

  const overlay = document.getElementById("hoan-tat-overlay");
  if (overlay) overlay.style.display = "none";

  const input = document.getElementById("search-input");
  input.value = "";
  input.focus();

  setStatus("Đã xóa. Sẵn sàng quét mã vận đơn mới.");
}

// ──────────────────────────────────────────────────
//  🔧 HÀM PHỤ TRỢ
// ──────────────────────────────────────────────────
function setStatus(msg) {
  const el = document.getElementById("status-bar");
  if (el) el.textContent = msg;
}

function capNhatRamCache() {
  const count = Object.keys(LOCAL_DB).length;
  const el = document.getElementById("ram-cache");
  if (el)
    el.textContent = "MÃ VẬN ĐƠN: " + count.toLocaleString("vi-VN") + " mã";
}

// ──────────────────────────────────────────────────
//  🚀 KHỞI ĐỘNG HỆ THỐNG
// ──────────────────────────────────────────────────
async function khoiDong() {
  setStatus("🔄 Đang tải dữ liệu về RAM...");
  document.getElementById("sub-title").textContent = "Đang nạp bộ nhớ đệm...";

  const result = await dongBoSupabase(true);

  if (result.status === "Thành công") {
    document.getElementById("sub-title").textContent = "ĐÃ SẴN SÀNG QUÉT ⚡";
    capNhatRamCache();
    setStatus(
      "✓ Đã nạp " +
        result.count.toLocaleString("vi-VN") +
        " bản ghi vào hệ thống.",
    );

    // Delta sync mỗi 30 giây
    setInterval(async function () {
      const r = await dongBoSupabase(false);
      if (r.status === "Thành công") {
        capNhatRamCache();
        if (r.count > 0)
          setStatus("🔄 Đồng bộ thêm " + r.count + " bản ghi mới.");
      } else {
        setStatus("⚠️ Lỗi cập nhật ngầm: " + r.status);
      }
    }, SYNC_INTERVAL);

    // Cập nhật màn chờ
    const choQuetSub = document.getElementById("cho-quet-sub");
    if (choQuetSub) {
      choQuetSub.textContent =
        "Đã nạp " +
        Object.keys(LOCAL_DB).length.toLocaleString("vi-VN") +
        " mã vận đơn vào hệ thống";
    }
  } else {
    document.getElementById("sub-title").textContent = "❌ LỖI ĐỒNG BỘ";
    setStatus("🚨 " + result.status);
  }

  document.getElementById("search-input").focus();
}

// ──────────────────────────────────────────────────
//  🎯 GẮN SỰ KIỆN
// ──────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", function () {
  const input = document.getElementById("search-input");

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      xuLyQuetMaVach();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") xoaGiaoDien();
  });

  khoiDong();
});

//=================== BẮT ĐẦU HÀM =========================//
// 🛸 HÀM XỬ LÝ HIỆU ỨNG THẺ BAY CHÍNH XÁC THEO SKU
function taoHieuUngBay(skuKey, skuHienThi) {
  // Tìm ô tìm kiếm bằng ID search-input đang có sẵn trong hệ thống
  const searchBox = document.getElementById("search-input");
  // Tìm chính xác thẻ sản phẩm mục tiêu dựa trên ID được render tự động
  const targetCard = document.getElementById("the-" + skuKey);

  if (!searchBox || !targetCard) return;

  // 1. Lấy tọa độ thực tế của Ô tìm kiếm và Thẻ đích trên màn hình
  const boxRect = searchBox.getBoundingClientRect();
  const cardRect = targetCard.getBoundingClientRect();

  // 2. Tạo ra thẻ bay tạm thời mang phong cách Cyber
  const flyer = document.createElement("div");
  flyer.className = "the-bay-phong-to";
  flyer.textContent = `📦 ${skuHienThi}`; // Hiển thị mã SKU gốc có dấu gạch đầy đủ

  // Đặt vị trí xuất phát ngay tại vị trí ô Search Box
  flyer.style.left = `${boxRect.left + 20}px`;
  flyer.style.top = `${boxRect.top + 5}px`;

  document.body.appendChild(flyer);

  // 3. Kích hoạt hoạt ảnh lao thẳng vào tâm thẻ sản phẩm
  requestAnimationFrame(() => {
    // Tính toán tọa độ để viên đạn rơi vào đúng giữa tâm thẻ sản phẩm
    flyer.style.left = `${cardRect.left + cardRect.width / 2 - 60}px`;
    flyer.style.top = `${cardRect.top + cardRect.height / 2 - 15}px`;

    // Thu nhỏ siêu nhỏ và biến mất khi chạm vào bề mặt thẻ
    flyer.style.transform = "scale(0.1)";
    flyer.style.opacity = "0";
  });

  // 4. Dọn dẹp thẻ bay sau khi hoàn thành hành trình (0.6 giây)
  setTimeout(() => {
    flyer.remove();
  }, 600);
}
//========================== KẾT THÚC HÀM ================================//
