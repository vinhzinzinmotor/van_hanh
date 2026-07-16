// =========================================================================
// HỆ THỐNG TRA CỨU MÃ VẬN ĐƠN — ZinZinMotor
// Chuyển đổi 100% từ van_don_kiem_hang.py (PyQt6 → JavaScript)
// Bảo toàn toàn bộ thuật toán: RAM Cache O(1), Delta Sync,
// Live Fallback, Lọc phiên & Khử trùng
// =========================================================================

// ──────────────────────────────────────────────────
//  ⚙️ CẤU HÌNH HỆ THỐNG (sao chép từ Python)
//  ANH ĐIỀN ĐÚNG 2 GIÁ TRỊ VÀO ĐÂY
// ──────────────────────────────────────────────────
const SUPABASE_URL = "https://ecctfcqqibuaxfpfsimy.supabase.co"; // VD: https://xxxxxx.supabase.co
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjY3RmY3FxaWJ1YXhmcGZzaW15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5MTkyMjEsImV4cCI6MjA5OTQ5NTIyMX0.zCXn7O-sXkrDZMgJtn9OTA0JsVffs7Tc-FLgYhb4qqI";
const TABLE_NAME = "van_hanh_tao_don_hang";
const SYNC_INTERVAL = 30000; // 30 giây — giống Python SYNC_INTERVAL

const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: "Bearer " + SUPABASE_KEY,
  "Content-Type": "application/json",
};

const COL_KEYS = ["ma_van_don", "ma_don_hang", "sku", "so_luong", "gia"];
const COL_HEADERS = ["Mã vận đơn", "Mã đơn hàng", "SKU", "SL", "Giá (VNĐ)"];

// ──────────────────────────────────────────────────
//  🧠 CƠ SỞ DỮ LIỆU TRÊN RAM (TỐC ĐỘ O(1))
//  Tương đương: LOCAL_DB = {} và LAST_SYNC_TIME trong Python
// ──────────────────────────────────────────────────
let LOCAL_DB = {};
let LAST_SYNC_TIME = null;

// ──────────────────────────────────────────────────
//  🧠 THUẬT TOÁN LỌC PHIÊN VÀ KHỬ TRÙNG
//  Tương đương hàm: update_local_db(rows) trong Python
//  Bảo toàn 100% logic gốc
// ──────────────────────────────────────────────────
function updateLocalDb(rows) {
  if (!rows || rows.length === 0) return;

  // Gom nhóm theo ma_van_don (giống grouped_new trong Python)
  const groupedNew = {};
  for (const row of rows) {
    const mvn = row.ma_van_don ? String(row.ma_van_don).trim() : null;
    if (!mvn) continue;
    if (!groupedNew[mvn]) groupedNew[mvn] = [];
    groupedNew[mvn].push(row);
  }

  // Xử lý từng nhóm (giống for mvn, new_rows in grouped_new.items())
  for (const [mvn, newRows] of Object.entries(groupedNew)) {
    const existingRows = LOCAL_DB[mvn] || [];
    const combined = [...existingRows, ...newRows];

    // ── Khử trùng theo fingerprint (giống seen_fingerprints trong Python)
    const uniqueCombined = [];
    const seenFingerprints = new Set();
    for (const r of combined) {
      const fingerprint = JSON.stringify([
        r.id ?? null, // <-- thêm dòng này
        r.phien_id ?? null,
        r.ma_van_don ?? null,
        r.ma_don_hang ?? null,
        r.sku ?? null,
        r.so_luong ?? null,
        r.gia ?? null,
      ]);
      if (!seenFingerprints.has(fingerprint)) {
        seenFingerprints.add(fingerprint);
        uniqueCombined.push(r);
      }
    }

    if (uniqueCombined.length === 0) continue;

    // ── Tìm dòng mới nhất theo thoi_gian (giống max(...) trong Python)
    const latestRow = uniqueCombined.reduce((prev, curr) =>
      (curr.thoi_gian || "") > (prev.thoi_gian || "") ? curr : prev,
    );
    const latestPhienId = latestRow.phien_id;

    // ── Lọc chỉ giữ lại phiên mới nhất (Có hỗ trợ dung sai thời gian)
    let filteredRows;
    if (latestPhienId) {
      // Ưu tiên 1: Lọc tuyệt đối theo phien_id (nếu dữ liệu có phien_id)
      filteredRows = uniqueCombined.filter((r) => r.phien_id === latestPhienId);
    } else {
      // Ưu tiên 2: Lọc theo thời gian với khoảng dung sai (khi không có phien_id)
      const maxTimeStr = latestRow.thoi_gian || "";

      if (maxTimeStr) {
        const maxTimeMs = new Date(maxTimeStr).getTime();

        // ⚙️ CẤU HÌNH DUNG SAI THỜI GIAN (Đơn vị: Mili-giây)
        // 15000 = 15 giây. Có thể tăng lên 30000 (30s) hoặc 60000 (1 phút) tùy ý.
        const dungSaiMs = 15000;

        filteredRows = uniqueCombined.filter((r) => {
          if (!r.thoi_gian) return false;

          const rowTimeMs = new Date(r.thoi_gian).getTime();

          // Kiểm tra xem thời gian của dòng này có cách dòng mới nhất <= dung sai không
          return maxTimeMs - rowTimeMs <= dungSaiMs;
        });
      } else {
        // Trường hợp ngoại lệ không có thời gian
        filteredRows = uniqueCombined;
      }
    }

    LOCAL_DB[mvn] = filteredRows;
  }
}

// ──────────────────────────────────────────────────
//  🔄 ĐỒNG BỘ DỮ LIỆU TỪ SUPABASE
//  Tương đương class: SyncBackendThread trong Python
//  Có phân trang (limit/offset) giống vòng while True
// ──────────────────────────────────────────────────
async function dongBoSuapabase(isFirstRun) {
  const nowStr = new Date().toISOString();
  let startTime;

  if (isFirstRun) {
    // Lần đầu: lấy 3 ngày gần nhất (giống timedelta(days=3) trong Python)
    const d = new Date();
    d.setDate(d.getDate() - 3);
    startTime = d.toISOString();
  } else {
    // Delta sync: từ lần sync cuối (giống LAST_SYNC_TIME trong Python)
    startTime = LAST_SYNC_TIME;
    if (!startTime) return { count: 0, status: "Chưa có thời gian sync" };
  }

  let allRows = [];
  const limit = 1000;
  let offset = 0;

  try {
    // ── Vòng lặp phân trang (giống while True + break trong Python)
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
      if (rows.length < limit) break; // Hết trang
      offset += limit;
    }

    // ── Cập nhật RAM (giống update_local_db(all_rows) trong Python)
    if (allRows.length > 0) {
      updateLocalDb(allRows);
    }

    LAST_SYNC_TIME = nowStr;
    return { count: allRows.length, status: "Thành công" };
  } catch (e) {
    return { count: 0, status: "Lỗi hệ thống: " + e.message };
  }
}

// ──────────────────────────────────────────────────
//  🌐 TRA CỨU KHẨN CẤP TRỰC TIẾP TỪ INTERNET
//  Tương đương class: LiveFetchFallbackThread trong Python
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

    if (resp.ok) {
      return (await resp.json()) || [];
    }
    return [];
  } catch (e) {
    return [];
  }
}

// ──────────────────────────────────────────────────
//  📊 RENDER KẾT QUẢ LÊN BẢNG
//  Tương đương hàm: _render_table_data(rows) trong Python
// ──────────────────────────────────────────────────
function renderKetQua(rows) {
  const tbody = document.getElementById("ket-qua-tbody");
  const statsLabel = document.getElementById("stats-label");
  const totalLabel = document.getElementById("total-label");

  tbody.innerHTML = "";
  let tongTien = 0;

  for (const row of rows) {
    const tr = document.createElement("tr");

    for (const key of COL_KEYS) {
      const td = document.createElement("td");
      const val = row[key] !== undefined ? row[key] : "";

      if (key === "gia") {
        // Giống: f"{int(val):,}".replace(",", ".") + " ₫" trong Python
        const gia = parseInt(val) || 0;
        const sl = parseInt(row.so_luong) || 1;
        td.textContent = gia.toLocaleString("vi-VN") + " ₫";
        td.className = "col-gia";
        tongTien += gia * sl;
      } else if (key === "so_luong") {
        td.textContent = String(val);
        td.className = "col-sl";
      } else if (key === "ma_van_don") {
        td.textContent = String(val);
        td.className = "col-mvd";
      } else if (key === "sku") {
        td.textContent = String(val);
        td.className = "col-sku";
      } else {
        td.textContent = String(val);
      }

      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }

  // ── Tính thống kê (giống stats_label và total_label trong Python)
  const nDon = new Set(rows.map((r) => r.ma_don_hang)).size;
  const nSku = rows.length;
  statsLabel.textContent =
    "Kết quả: " + nDon + " đơn hàng · " + nSku + " sản phẩm";
  totalLabel.textContent = "Tổng: " + tongTien.toLocaleString("vi-VN") + " ₫";
}

// ──────────────────────────────────────────────────
//  ⚡ XỬ LÝ KHI QUÉT MÃ VẠCH (Enter)
//  Tương đương hàm: _on_barcode_scanned() trong Python
//  Logic: RAM trước → Internet sau (fallback)
// ──────────────────────────────────────────────────
async function xuLyQuetMaVach() {
  const input = document.getElementById("search-input");
  const query = input.value.trim();
  if (!query) return;

  const tStart = performance.now();

  if (LOCAL_DB[query]) {
    // ── Tìm thấy trên RAM → TỨC THÌ (giống if query in LOCAL_DB)
    renderKetQua(LOCAL_DB[query]);
    const tElapsed = (performance.now() - tStart).toFixed(2);
    setStatus("⚡ XỬ LÝ TỨC THÌ: Tìm thấy trên RAM trong " + tElapsed + "ms");
    input.value = "";
    input.focus();
  } else {
    // ── Không có trên RAM → Tra cứu khẩn cấp (giống LiveFetchFallbackThread)
    setStatus(
      "🔍 Không có sẵn trên RAM. Đang truy vấn khẩn cấp từ Internet...",
    );
    input.value = "";

    const rows = await traKhanCap(query);

    if (rows && rows.length > 0) {
      // ── Cập nhật vào RAM luôn (giống update_local_db trong _on_fallback_result)
      updateLocalDb(rows);
      capNhatRamCache();
      renderKetQua(LOCAL_DB[query] || rows);
      setStatus("✓ Kết quả tìm kiếm từ Internet.");
    } else {
      // ── Không tìm thấy gì
      document.getElementById("ket-qua-tbody").innerHTML = "";
      document.getElementById("stats-label").textContent = "";
      document.getElementById("total-label").textContent = "";
      setStatus("❌ Không tìm thấy mã vận đơn: " + query);
    }

    input.focus();
  }
}

// ──────────────────────────────────────────────────
//  🗑️ XÓA GIAO DIỆN
//  Tương đương hàm: _on_clear() trong Python
// ──────────────────────────────────────────────────
function xoaGiaoDien() {
  document.getElementById("ket-qua-tbody").innerHTML = "";
  document.getElementById("stats-label").textContent = "";
  document.getElementById("total-label").textContent = "";
  const input = document.getElementById("search-input");
  input.value = "";
  input.focus();
  setStatus("Đã xóa giao diện. Sẵn sàng nhận lượt quét mới.");
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
    el.textContent =
      "RAM Cache: " + count.toLocaleString("vi-VN") + " mã vận đơn";
}

// ──────────────────────────────────────────────────
//  🚀 KHỞI ĐỘNG HỆ THỐNG
//  Tương đương __init__ + _on_initial_sync_done trong Python
// ──────────────────────────────────────────────────
async function khoiDong() {
  setStatus("🔄 Đang tải trước cơ sở dữ liệu về RAM để chuẩn bị quét...");
  document.getElementById("sub-title").textContent =
    "Chế độ: Đang nạp bộ nhớ đệm...";

  // ── Đồng bộ lần đầu (3 ngày gần nhất)
  const result = await dongBoSuapabase(true);

  if (result.status === "Thành công") {
    document.getElementById("sub-title").textContent =
      "Chế độ: ĐÃ SẴN SÀNG QUÉT ⚡ KHÔNG ĐỘ TRỄ";
    capNhatRamCache();
    setStatus(
      "✓ Đã đưa thành công vào RAM toàn bộ " +
        result.count.toLocaleString("vi-VN") +
        " bản ghi dữ liệu.",
    );

    // ── Bắt đầu delta sync mỗi 30 giây (giống sync_timer.start(SYNC_INTERVAL))
    setInterval(async function () {
      const r = await dongBoSuapabase(false);
      if (r.status === "Thành công") {
        capNhatRamCache();
        if (r.count > 0) {
          setStatus("🔄 Đã đồng bộ thêm " + r.count + " bản ghi mới.");
        }
      } else {
        setStatus("⚠️ Lỗi cập nhật ngầm: " + r.status);
      }
    }, SYNC_INTERVAL);
  } else {
    document.getElementById("sub-title").textContent =
      "Chế độ: ❌ LỖI ĐỒNG BỘ DỮ LIỆU";
    setStatus("🚨 " + result.status);
  }

  document.getElementById("search-input").focus();
}

// ──────────────────────────────────────────────────
//  🎯 GẮN SỰ KIỆN KHI TRANG LOAD XONG
// ──────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", function () {
  const input = document.getElementById("search-input");

  // Enter → quét mã vạch (giống returnPressed.connect)
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      xuLyQuetMaVach();
    }
  });

  // Escape toàn trang → xóa giao diện (giống QShortcut Escape)
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") xoaGiaoDien();
  });

  // Khởi động hệ thống
  khoiDong();
});
