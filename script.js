// =========================================================================
// HỆ THỐNG VẬN HÀNG DUAL-GRID ENGINE v6.4 (ZINZINMOTOR)
// Đã khôi phục 100% Thuật toán Regex bóc tách chuỗi gốc của file luồng xử lý
// Tích hợp Hệ thống Undo Stack, Smart Vertical Paste và Auto-Scroll boundaries
// Bản Cập Nhật: Thêm Alt+Enter xuống dòng, Tự động kiểm tra SKU Bảng 3 (x / +)
// =========================================================================

// ── TÊN NGƯỜI DÙNG (lưu vào bộ nhớ trình duyệt) ──
// ── TÊN NGƯỜI DÙNG (lưu vào bộ nhớ trình duyệt) ──
var tenNguoiDung = "Không rõ";
var _modalCallback = null;

function hienModal(
  tieuDe,
  moTa,
  placeholder,
  giaTriMacDinh,
  coHuy,
  nhanXacNhan,
  callback,
) {
  document.getElementById("modal-tieu-de").innerText = tieuDe;
  document.getElementById("modal-mo-ta").innerText = moTa;
  var input = document.getElementById("modal-input-ten");
  input.placeholder = placeholder;
  input.value = giaTriMacDinh || "";
  document.getElementById("modal-btn-xac-nhan").innerText = nhanXacNhan;
  document.getElementById("modal-btn-huy").style.display = coHuy
    ? "block"
    : "none";
  _modalCallback = callback;
  document.getElementById("modal-ten").classList.add("active");
  setTimeout(function () {
    input.focus();
    input.select();
  }, 50);
}

function khoiTaoTenNguoiDung() {
  var tenCu = localStorage.getItem("zzm_ten_nhan_vien");
  if (tenCu) {
    tenNguoiDung = tenCu;
    var el = document.getElementById("hien-thi-ten");
    if (el) el.innerText = tenNguoiDung;
  } else {
    hienModal(
      "Xin chào! 👋",
      "Bạn tên gì? Tên sẽ được ghi vào lịch sử xử lý đơn hàng.",
      "Nhập tên của bạn...",
      "",
      false,
      "BẮT ĐẦU LÀM VIỆC ➔",
      function (ten) {
        tenNguoiDung = ten;
        localStorage.setItem("zzm_ten_nhan_vien", tenNguoiDung);
        var el = document.getElementById("hien-thi-ten");
        if (el) el.innerText = tenNguoiDung;
      },
    );
  }
}

function doiTenNguoiDung() {
  hienModal(
    "Đổi tên",
    "Nhập tên mới của bạn:",
    "Tên mới...",
    tenNguoiDung,
    true,
    "LƯU TÊN MỚI",
    function (ten) {
      tenNguoiDung = ten;
      localStorage.setItem("zzm_ten_nhan_vien", tenNguoiDung);
      document.getElementById("hien-thi-ten").innerText = tenNguoiDung;
    },
  );
}

var C2_CONFIG = {
  SPREADSHEET_ID: "1Ro4FLShWGRQHilJ7m4RSmsfTp65QXpvJNfAjVjCLvrc",
  API_KEY: "AIzaSyANYGSIIawi6NyiSlWoWNVRJvUh1K_rqqw",
  SHEET_NAME: "MISA",
  COL_SKU: 0,
  COL_NAME: 1,
  COL_LOC: 6,
};

var LOG_CONFIG = {
  APPS_SCRIPT_URL:
    "https://script.google.com/macros/s/AKfycbwylHEFdL6J9ZBXLwU2k4dxezq5t358AxMo4BAN49N9yuV1DdwzQlzHj9Iy9Hf9TMX5eA/exec",
  SPREADSHEET_ID: "1Ro4FLShWGRQHilJ7m4RSmsfTp65QXpvJNfAjVjCLvrc",
  SHEET_NAME: "LOG",
};

var MISA_DIRECTORY = {};

const tieuDeBangNhap = ["Mã Vận Đơn", "Mã Đơn Hàng", "Thông Tin Đơn hàng"];
const tieuDeBangKq = ["Mã Vận Đơn", "Mã Đơn Hàng", "Mã SKU", "SL", "Giá"];
const tieuDeBangIn = tieuDeBangKq;

const thanhCotNhap = document.getElementById("thanh-cot-nhap");
const thanhCotKq = document.getElementById("thanh-cot-kq");
const thanhCotIn = document.getElementById("thanh-cot-in");

const thanBangNhap = document.getElementById("than-bang-nhap");
const thanBangKq = document.getElementById("than-bang-kq");
const thanBangIn = document.getElementById("than-bang-in");

const btnXuLy = document.getElementById("nut-xu-ly");
const btnTaoIn = document.getElementById("nut-tao-in");
const btnInDon = document.getElementById("nut-in-don");
const invoiceArea = document.getElementById("invoiceArea");
const printOnlyZone = document.getElementById("print-only-zone");

let dangKeoChuot = false;
let hangBatDau = -1;
let cotBatDauVung = -1;
let bangDangThaoTac = null;

// Khởi tạo Undo Stack quản lý lịch sử thao tác
let undoStack = [];
const MAX_HISTORY = 50;

function showToast(msg, type = "info") {
  const zone = document.getElementById("toast-zone");
  if (!zone) return;
  const div = document.createElement("div");
  div.className = `toast ${type}`;
  div.innerText = msg;
  zone.appendChild(div);
  setTimeout(() => {
    div.classList.add("fade");
    setTimeout(() => div.remove(), 400);
  }, 3000);
}

/* =========================================================================
   HÀM HỖ TRỢ KIỂM TRA SKU & LÀM NỔI BẬT DÒNG (BẢNG 3)
   ========================================================================= */
function kiemTraSkuBang3(row) {
  if (!row) return false;
  const skuCell = row.cells[3]; // Cột Mã SKU nằm ở vị trí thứ 4 (index 3) trong hàng
  if (skuCell) {
    const txt = skuCell.innerText;
    if (txt.includes("x") || txt.includes("+")) {
      row.classList.add("row-highlight-warn");
      return true;
    } else {
      row.classList.remove("row-highlight-warn");
      return false;
    }
  }
  return false;
}

/* =========================================================================
   HỆ THỐNG HOÀN TÁC (UNDO ENGINE) CHUẨN EXCEL
   ========================================================================= */
function captureState() {
  return {
    nhap: getTableData(thanBangNhap),
    kq: getTableData(thanBangKq),
    in: getTableData(thanBangIn),
  };
}

function saveState() {
  const state = captureState();
  if (undoStack.length > 0) {
    if (
      JSON.stringify(undoStack[undoStack.length - 1]) === JSON.stringify(state)
    ) {
      return;
    }
  }
  undoStack.push(state);
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
}

function undo() {
  if (undoStack.length === 0) {
    showToast("Không có thao tác nào để hoàn tác!", "warn");
    return;
  }
  const previousState = undoStack.pop();
  restoreTableData(thanBangNhap, previousState.nhap, 3);
  restoreTableData(thanBangKq, previousState.kq, 5);
  restoreTableData(thanBangIn, previousState.in, 5);

  // Quét lại toàn bộ bảng 3 sau khi khôi phục dữ liệu để cập nhật highlight nếu có lỗi cũ
  Array.from(thanBangIn.rows).forEach((row) => kiemTraSkuBang3(row));

  showToast("Đã hoàn tác thao tác vừa rồi!", "info");
}

function getTableData(tbody) {
  if (!tbody) return [];
  const rowsData = [];
  Array.from(tbody.rows).forEach((tr) => {
    const cellsData = [];
    const cells = Array.from(tr.cells);
    // Bỏ cell STT (đầu) và cell Thao tác (cuối)
    for (let i = 1; i < cells.length - 1; i++) {
      cellsData.push(cells[i].innerText);
    }
    rowsData.push(cellsData);
  });
  return rowsData;
}

function restoreTableData(tbody, data, colCount) {
  if (!tbody) return;
  tbody.innerHTML = "";
  if (data.length === 0) {
    taoBangTrong(tbody, 15, colCount);
    return;
  }
  data.forEach((rowData, rIdx) => {
    themMotHangVaoBang(tbody, rIdx, colCount);
    const tr = tbody.rows[rIdx];
    const cells = Array.from(
      tr.querySelectorAll("td:not(:first-child):not(:last-child)"),
    );
    rowData.forEach((text, cIdx) => {
      if (cells[cIdx]) cells[cIdx].innerText = text;
    });
  });
}

/* =========================================================================
   LUỒNG ĐỌC DỮ LIỆU TỪ GOOGLE SHEETS API V4
   ========================================================================= */
function taiDanhMucMisaTuGoogle() {
  const statusEl = document.getElementById("sheet-status");
  const txtEl = document.getElementById("status-text");

  if (
    !C2_CONFIG.SPREADSHEET_ID ||
    !C2_CONFIG.API_KEY ||
    C2_CONFIG.API_KEY.includes("rqqw") === false
  ) {
    if (statusEl) statusEl.className = "misa-status err";
    if (txtEl)
      txtEl.innerText = "Chế độ Offline: Chưa cấu hình chính xác API_KEY.";
    return;
  }

  var rangeStr = encodeURIComponent(C2_CONFIG.SHEET_NAME + "!A:G");
  var url =
    "https://sheets.googleapis.com/v4/spreadsheets/" +
    C2_CONFIG.SPREADSHEET_ID +
    "/values/" +
    rangeStr +
    "?key=" +
    C2_CONFIG.API_KEY;

  if (statusEl) statusEl.className = "misa-status loading";
  if (txtEl)
    txtEl.innerText = "Đang kết nối lấy dữ liệu từ Google Sheet MISA...";

  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error("Lỗi kết nối API: " + res.status);
      return res.json();
    })
    .then((data) => {
      var rows = data.values;
      if (!rows || rows.length === 0) {
        if (statusEl) statusEl.className = "misa-status err";
        if (txtEl) txtEl.innerText = "Kết nối thành công nhưng Sheet trống.";
        return;
      }
      var count = 0;
      for (var i = 1; i < rows.length; i++) {
        var row = rows[i];
        var sku = row[C2_CONFIG.COL_SKU]
          ? row[C2_CONFIG.COL_SKU].toString().trim()
          : "";
        if (!sku) continue;
        MISA_DIRECTORY[sku] = {
          name: row[C2_CONFIG.COL_NAME]
            ? row[C2_CONFIG.COL_NAME].toString().trim()
            : "",
          loc: row[C2_CONFIG.COL_LOC]
            ? row[C2_CONFIG.COL_LOC].toString().trim()
            : "Chưa xếp vị trí",
        };
        count++;
      }
      if (statusEl) statusEl.style.display = "none";
      showToast(`Đồng bộ thành công ${count} sản phẩm`, "ok");
    })
    .catch((err) => {
      console.error(err);
      if (statusEl) statusEl.className = "misa-status err";
      if (txtEl)
        txtEl.innerText =
          "Không lấy được danh mục trực tuyến. Hệ thống chuyển sang Offline.";
    });
}

function ghiLogLichSuLenGoogle(rowsData) {
  if (!LOG_CONFIG.APPS_SCRIPT_URL || rowsData.length === 0) return;
  var rows = rowsData.map(function (r) {
    return [
      r.vandon,
      r.orderId,
      r.sku,
      r.qty,
      r.price,
      tenNguoiDung,
      new Date().toLocaleString("vi-VN"),
    ];
  });
  fetch(LOG_CONFIG.APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      spreadsheet_id: LOG_CONFIG.SPREADSHEET_ID,
      sheet_name: LOG_CONFIG.SHEET_NAME,
      rows: rows,
    }),
  })
    .then((res) => {
      if (res.ok)
        showToast(
          `Đã lưu log ${rows.length} dòng lên Google Sheet History.`,
          "ok",
        );
    })
    .catch((e) => console.error("Lỗi mạng ghi log", e));
}

/* =========================================================================
   THUẬT TOÁN TÁCH VÀ CHUẨN HÓA CHUỖI SKU
   ========================================================================= */
function splitProducts(infoStr) {
  if (!infoStr) return [];
  const regex = /\[\d+\]/g;
  const matches = [...infoStr.matchAll(regex)];
  if (matches.length === 0) return [infoStr.trim()];
  const blocks = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = matches[i + 1] ? matches[i + 1].index : infoStr.length;
    blocks.push(infoStr.slice(start, end).trim());
  }
  return blocks;
}

function grab(block, label) {
  const regex = new RegExp(label + "\\s*:\\s*([^;]*)", "i");
  const match = block.match(regex);
  return match ? match[1].trim() : null;
}

function normPrice(raw) {
  if (raw === null) return null;
  var s = String(raw).replace(/[^\d.,]/g, "");
  if (s === "") return null;
  s = s.replace(/,/g, "");
  return s;
}

function resolveSku(skuRaw, qtyNum) {
  var result = { sku: skuRaw, qty: qtyNum, warn: false };
  if (skuRaw && skuRaw.indexOf("+") !== -1) return result; // TRƯỜNG HỢP 1: SKU chứa dấu "+" → combo, giữ nguyên, không làm gì thêm

  // TRƯỜNG HỢP 2: SKU có dạng "ABC123x2" → tách và nhân số lượng
  var mGood = skuRaw ? skuRaw.match(/^(.*?)x([1-9]\d*)$/) : null;
  if (mGood) {
    result.sku = mGood[1].trim();
    result.qty = parseInt(mGood[2], 10) * qtyNum;
    return result;
  }
  // TRƯỜNG HỢP 3: SKU có chữ "x" nhưng sai định dạng → bật cảnh báo
  var mBad = skuRaw ? skuRaw.match(/x(\d*\D*)$/) : null;
  if (mBad) {
    var tail = mBad[1];
    if (tail === "" || /^0/.test(tail) || /\D/.test(tail)) {
      result.warn = true;
    }
  }
  return result;
}

/* =========================================================================
   GIAO DIỆN LƯỚI & TÍNH NĂNG CHỌN Ô CHUẨN GOOGLE SHEETS
   ========================================================================= */
function khoiTaoTieuDe() {
  if (thanhCotNhap) {
    tieuDeBangNhap.forEach((t) => {
      const th = document.createElement("th");
      th.innerText = t;
      thanhCotNhap.appendChild(th);
    });
    const thAct = document.createElement("th");
    thAct.innerText = "Thao tác";
    thAct.style.width = "75px";
    thanhCotNhap.appendChild(thAct);
  }
  if (thanhCotKq) {
    tieuDeBangKq.forEach((t) => {
      const th = document.createElement("th");
      th.innerText = t;
      thanhCotKq.appendChild(th);
    });
    const thAct = document.createElement("th");
    thAct.innerText = "Thao tác";
    thAct.style.width = "75px";
    thanhCotKq.appendChild(thAct);
  }
  if (thanhCotIn) {
    tieuDeBangIn.forEach((t) => {
      const th = document.createElement("th");
      th.innerText = t;
      thanhCotIn.appendChild(th);
    });
    const thAct = document.createElement("th");
    thAct.innerText = "Thao tác";
    thAct.style.width = "75px";
    thanhCotIn.appendChild(thAct);
  }
}

function taoBangTrong(tbody, dong, cot) {
  if (!tbody) return;
  tbody.innerHTML = "";
  for (let r = 0; r < dong; r++) {
    themMotHangVaoBang(tbody, r, cot);
  }
}

function themMotHangVaoBang(tbody, rowIndex, tongSoCot) {
  const tr = document.createElement("tr");
  const tdStt = document.createElement("td");
  tdStt.innerText = rowIndex + 1;
  tdStt.style.background = "#f0f0f0";
  tdStt.style.textAlign = "center";
  tdStt.style.fontWeight = "bold";
  tr.appendChild(tdStt);

  for (let c = 0; c < tongSoCot; c++) {
    const td = document.createElement("td");
    td.setAttribute("contenteditable", "false");
    td.setAttribute("tabindex", "0");

    td.addEventListener("paste", function (e) {
      if (td.getAttribute("contenteditable") === "true") {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData(
          "text/plain",
        );
        document.execCommand("insertText", false, text);

        // Kiểm tra SKU cục bộ ngay lập tức nếu đang chỉnh sửa ô SKU trực tiếp tại Bảng 3
        if (tbody === thanBangIn && c === 2) {
          setTimeout(() => {
            if (kiemTraSkuBang3(tr)) {
              showToast(
                `Dòng ${tr.cells[0].innerText}: SKU chứa kí tự đặc biệt 'x' hoặc '+'!`,
                "warn",
              );
            }
          }, 10);
        }
        return;
      }

      e.preventDefault();
      saveState();
      const dataCopy = (e.clipboardData || window.clipboardData).getData(
        "text",
      );
      const cacHang = parseTSV(dataCopy);

      // --- NÂNG CẤP CHỨC NĂNG DÁN ĐA Ô (GOOGLE SHEETS STYLE TILE PASTE) ---
      const selectedCells = tbody.querySelectorAll("td.vung-chon");
      if (selectedCells.length > 1) {
        let minR = Infinity;
        let minC = Infinity;
        const cellInfos = [];

        selectedCells.forEach((cell) => {
          const rowEl = cell.parentElement;
          const rIdx = Array.from(tbody.rows).indexOf(rowEl);
          const interactiveCellsInRow = Array.from(
            rowEl.querySelectorAll("td:not(:first-child):not(:last-child)"),
          );
          const cIdx = interactiveCellsInRow.indexOf(cell);
          if (rIdx !== -1 && cIdx !== -1) {
            minR = Math.min(minR, rIdx);
            minC = Math.min(minC, cIdx);
            cellInfos.push({ cell, rIdx, cIdx });
          }
        });

        const copiedRows = cacHang.length;
        cellInfos.forEach((info) => {
          const rOffset = info.rIdx - minR;
          const cOffset = info.cIdx - minC;

          const rData = cacHang[rOffset % copiedRows];
          if (rData && rData.length > 0) {
            const value = rData[cOffset % rData.length];
            if (value !== undefined) {
              info.cell.innerText = value.trim();
            }
          }

          if (tbody === thanBangIn) {
            kiemTraSkuBang3(info.cell.parentElement);
          }
        });

        if (tbody === thanBangIn) {
          setTimeout(() => {
            let countWarn = 0;
            Array.from(thanBangIn.rows).forEach((r) => {
              if (r.classList.contains("row-highlight-warn")) countWarn++;
            });
            if (countWarn > 0) {
              showToast(
                `Phát hiện mã SKU chứa 'x' hoặc '+' trong dữ liệu chuẩn bị in!`,
                "warn",
              );
            }
          }, 50);
        }
        return;
      }
      // --- KẾT THÚC ĐOẠN NÂNG CẤP DÁN ĐA Ô ---

      let hangDuyet = tr;

      for (let i = 0; i < cacHang.length; i++) {
        const cacO = cacHang[i];
        if (cacO.length === 1 && cacO[0].trim() === "") continue;
        if (!hangDuyet) {
          const newRowIndex = tbody.rows.length;
          themMotHangVaoBang(tbody, newRowIndex, tongSoCot);
          hangDuyet = tbody.rows[newRowIndex];
        }

        const danhSachOTrong = hangDuyet.querySelectorAll(
          "td:not(:first-child):not(:last-child)",
        );
        for (let j = 0; j < cacO.length; j++) {
          const viTriOChinhXac = c + j;
          if (viTriOChinhXac < danhSachOTrong.length) {
            danhSachOTrong[viTriOChinhXac].innerText = cacO[j].trim();
          }
        }

        // Kích hoạt quét cảnh báo SKU lỗi sau khi dán nhiều dòng dữ liệu vào Bảng 3
        if (tbody === thanBangIn) {
          kiemTraSkuBang3(hangDuyet);
        }

        hangDuyet = hangDuyet.nextElementSibling;
      }

      // Tạo một thông báo tổng hợp duy nhất nếu phát hiện lỗi sau khi paste hàng loạt
      if (tbody === thanBangIn) {
        setTimeout(() => {
          let countWarn = 0;
          Array.from(thanBangIn.rows).forEach((r) => {
            if (r.classList.contains("row-highlight-warn")) countWarn++;
          });
          if (countWarn > 0) {
            showToast(
              `Phát hiện mã SKU chứa 'x' hoặc '+' trong dữ liệu chuẩn bị in!`,
              "warn",
            );
          }
        }, 50);
      }
    });

    td.addEventListener("mousedown", (e) => {
      const currentR = Array.from(tbody.rows).indexOf(tr);
      suKienNhanChuot(e, currentR, c, tbody);
    });
    td.addEventListener("mouseenter", (e) => {
      const currentR = Array.from(tbody.rows).indexOf(tr);
      suKienReChuot(e, currentR, c);
    });
    td.addEventListener("dblclick", () => {
      td.setAttribute("contenteditable", "true");
      td.focus();
    });

    let oldText = "";
    td.addEventListener("focus", () => {
      oldText = td.innerText;
    });
    td.addEventListener("blur", () => {
      td.setAttribute("contenteditable", "false");
      if (td.innerText !== oldText) {
        saveState();

        // Kiểm tra SKU sau khi kết thúc việc chỉnh sửa thủ công bằng tay (blur)
        if (tbody === thanBangIn) {
          if (kiemTraSkuBang3(tr)) {
            showToast(
              `Dòng ${tr.cells[0].innerText}: SKU chứa kí tự đặc biệt 'x' hoặc '+'!`,
              "warn",
            );
          }
        }
      }
    });

    td.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") {
        if (evt.altKey) {
          // BỔ SUNG: Nhấn Alt + Enter để ngắt dòng ngay trong ô giống hệt Excel
          evt.preventDefault();
          document.execCommand("insertText", false, "\n");
        } else {
          evt.preventDefault();
          td.blur();
        }
      } else if (evt.key === "Escape") {
        // Nâng cấp: Hủy chỉnh sửa bằng phím Esc
        evt.preventDefault();
        td.innerText = oldText;
        td.blur();
      }
    });

    tr.appendChild(td);
  }

  // TẠO NÚT BẤM THÊM / XÓA HÀNG TRỰC TIẾP TẠI CHỖ
  const tdAction = document.createElement("td");
  tdAction.className = "cell-actions";
  tdAction.style.textAlign = "center";
  tdAction.style.background = "#f8f9fa";

  const btnAdd = document.createElement("button");
  btnAdd.innerText = "+";
  btnAdd.className = "btn-row-action btn-row-add";
  btnAdd.title = "Thêm hàng mới kế tiếp phía dưới";
  btnAdd.addEventListener("click", () => {
    saveState();
    const currentIdx = Array.from(tbody.rows).indexOf(tr);
    chenHangVaoViTri(tbody, currentIdx + 1, tongSoCot);
  });

  const btnDel = document.createElement("button");
  btnDel.innerText = "-";
  btnDel.className = "btn-row-action btn-row-del";
  btnDel.title = "Xóa hàng này";
  btnDel.addEventListener("click", () => {
    saveState();
    tr.remove();
    capNhatLaiSTT(tbody);
  });

  tdAction.appendChild(btnAdd);
  tdAction.appendChild(btnDel);
  tr.appendChild(tdAction);

  tbody.appendChild(tr);
}

function chenHangVaoViTri(tbody, targetIdx, tongSoCot) {
  themMotHangVaoBang(tbody, tbody.rows.length, tongSoCot);
  const newRow = tbody.rows[tbody.rows.length - 1];
  if (targetIdx < tbody.rows.length - 1) {
    const referenceRow = tbody.rows[targetIdx];
    tbody.insertBefore(newRow, referenceRow);
  }
  capNhatLaiSTT(tbody);
}

function capNhatLaiSTT(tbody) {
  Array.from(tbody.rows).forEach((row, idx) => {
    row.cells[0].innerText = idx + 1;
  });
}

function parseTSV(dataCopy) {
  const cacHang = [];
  let hangHienTai = [];
  let oHienTai = "";
  let trongNgoatKep = false;
  for (let i = 0; i < dataCopy.length; i++) {
    const kyTu = dataCopy[i];
    const kyTuTiepTheo = dataCopy[i + 1];
    if (kyTu === '"') {
      if (trongNgoatKep && kyTuTiepTheo === '"') {
        oHienTai += '"';
        i++;
      } else {
        trongNgoatKep = !trongNgoatKep;
      }
    } else if (kyTu === "\t" && !trongNgoatKep) {
      hangHienTai.push(oHienTai);
      oHienTai = "";
    } else if ((kyTu === "\r" || kyTu === "\n") && !trongNgoatKep) {
      if (kyTu === "\r" && kyTuTiepTheo === "\n") i++;
      hangHienTai.push(oHienTai);
      cacHang.push(hangHienTai);
      hangHienTai = [];
      oHienTai = "";
    } else {
      oHienTai += kyTu;
    }
  }
  if (oHienTai !== "" || hangHienTai.length > 0) {
    hangHienTai.push(oHienTai);
    cacHang.push(hangHienTai);
  }
  return cacHang;
}

function suKienNhanChuot(e, r, c, tbody) {
  if (e.button !== 0) return;
  dangKeoChuot = true;
  hangBatDau = r;
  cotBatDauVung = c;
  bangDangThaoTac = tbody;
  giaiPhongVungChon(tbody);
  if (tbody.rows[r] && tbody.rows[r].cells[c + 1]) {
    const targetTd = tbody.rows[r].cells[c + 1];
    targetTd.focus();
    targetTd.classList.add("vung-chon", "dang-chon");
  }
}

function suKienReChuot(e, r, c) {
  if (!dangKeoChuot || !bangDangThaoTac) return;
  if (window.getSelection) {
    window.getSelection().removeAllRanges();
  }
  giaiPhongVungChon(bangDangThaoTac);
  const minH = Math.min(hangBatDau, r),
    maxH = Math.max(hangBatDau, r);
  const minC = Math.min(cotBatDauVung, c),
    maxC = Math.max(cotBatDauVung, c);
  for (let h = minH; h <= maxH; h++) {
    for (let k = minC; k <= maxC; k++) {
      if (bangDangThaoTac.rows[h] && bangDangThaoTac.rows[h].cells[k + 1]) {
        const td = bangDangThaoTac.rows[h].cells[k + 1];
        td.classList.add("vung-chon");
        if (h === hangBatDau && k === cotBatDauVung)
          td.classList.add("dang-chon");
      }
    }
  }
}

// Nâng cấp: CHỨC NĂNG TỰ ĐỘNG LĂN CHUỘT (AUTO-SCROLL) MƯỢT MÀ BẰNG SET-INTERVAL
let autoScrollTimer = null;
let currentMouseX = 0;
let currentMouseY = 0;

document.addEventListener("mousemove", (e) => {
  currentMouseX = e.clientX;
  currentMouseY = e.clientY;
});

function batDauAutoScroll() {
  if (autoScrollTimer) return;
  autoScrollTimer = setInterval(() => {
    if (!dangKeoChuot || !bangDangThaoTac) {
      dungAutoScroll();
      return;
    }
    const container = bangDangThaoTac.closest(".scroll-container");
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const threshold = 35;
    let scrolled = false;

    if (currentMouseY > rect.bottom - threshold) {
      container.scrollTop += 15;
      scrolled = true;
    } else if (currentMouseY < rect.top + threshold) {
      container.scrollTop -= 15;
      scrolled = true;
    }

    if (currentMouseX > rect.right - threshold) {
      container.scrollLeft += 15;
      scrolled = true;
    } else if (currentMouseX < rect.left + threshold) {
      container.scrollLeft -= 15;
      scrolled = true;
    }

    if (scrolled) {
      const elem = document.elementFromPoint(currentMouseX, currentMouseY);
      if (elem && elem.tagName === "TD" && bangDangThaoTac.contains(elem)) {
        const tr = elem.parentElement;
        const r = Array.from(bangDangThaoTac.rows).indexOf(tr);
        const c = Array.from(tr.cells).indexOf(elem) - 1;
        suKienReChuot(null, r, c);
      }
    }
  }, 30);
}

function dungAutoScroll() {
  if (autoScrollTimer) {
    clearInterval(autoScrollTimer);
    autoScrollTimer = null;
  }
}

document.addEventListener("mousedown", (e) => {
  if (bangDangThaoTac && !bangDangThaoTac.contains(e.target)) {
    giaiPhongVungChon(bangDangThaoTac);
    bangDangThaoTac = null;
    hangBatDau = -1;
    cotBatDauVung = -1;
  } else {
    batDauAutoScroll();
  }
});

document.addEventListener("mouseup", () => {
  dangKeoChuot = false;
  dungAutoScroll();
});

function giaiPhongVungChon(tbody) {
  if (tbody)
    tbody
      .querySelectorAll("td")
      .forEach((td) => td.classList.remove("vung-chon", "dang-chon"));
}

document.addEventListener("keydown", function (e) {
  if (e.ctrlKey && e.key.toLowerCase() === "z") {
    e.preventDefault();
    undo();
    return;
  }

  if (e.ctrlKey && e.key.toLowerCase() === "c") {
    if (!bangDangThaoTac) return;
    const cacOChon = bangDangThaoTac.querySelectorAll("td.vung-chon");
    if (cacOChon.length === 0) return;

    e.preventDefault();
    let minH = Infinity,
      maxH = -Infinity,
      minC = Infinity,
      maxC = -Infinity;
    let duLieuO = [];

    cacOChon.forEach((o) => {
      const tr = o.parentElement;
      const r = Array.from(bangDangThaoTac.rows).indexOf(tr);
      const cacTd = Array.from(
        tr.querySelectorAll("td:not(:first-child):not(:last-child)"),
      );
      const c = cacTd.indexOf(o);
      minH = Math.min(minH, r);
      maxH = Math.max(maxH, r);
      minC = Math.min(minC, c);
      maxC = Math.max(maxC, c);
      duLieuO.push({ r, c, text: o.innerText.trim() });
    });

    let tsv = "";
    for (let r = minH; r <= maxH; r++) {
      let rowText = [];
      for (let c = minC; c <= maxC; c++) {
        const o = duLieuO.find((x) => x.r === r && x.c === c);
        let text = o ? o.text : "";
        if (text.includes("\t") || text.includes("\n") || text.includes('"')) {
          text = '"' + text.replace(/"/g, '""') + '"';
        }
        rowText.push(text);
      }
      tsv += rowText.join("\t") + "\n";
    }

    navigator.clipboard.writeText(tsv).then(() => {
      showToast(`Đã copy thành công ${cacOChon.length} ô dữ liệu!`, "ok");
    });
    return;
  }

  if (!bangDangThaoTac) return;
  const oDangChon = bangDangThaoTac.querySelector(".dang-chon");
  if (!oDangChon || oDangChon.getAttribute("contenteditable") === "true")
    return;

  const tr = oDangChon.parentElement;
  const c = Array.from(tr.cells).indexOf(oDangChon) - 1;
  const r = Array.from(bangDangThaoTac.rows).indexOf(tr);
  let nextR = r,
    nextC = c;

  if (e.key === "ArrowUp") {
    nextR--;
    e.preventDefault();
  } else if (e.key === "ArrowDown") {
    nextR++;
    e.preventDefault();
  } else if (e.key === "ArrowLeft") {
    nextC--;
    e.preventDefault();
  } else if (e.key === "ArrowRight") {
    nextC++;
    e.preventDefault();
  }

  if (nextR !== r || nextC !== c) {
    if (
      bangDangThaoTac.rows[nextR] &&
      bangDangThaoTac.rows[nextR].cells[nextC + 1]
    ) {
      giaiPhongVungChon(bangDangThaoTac);
      const oMoi = bangDangThaoTac.rows[nextR].cells[nextC + 1];
      oMoi.focus();
      oMoi.classList.add("vung-chon", "dang-chon");
      hangBatDau = nextR;
      cotBatDauVung = nextC;
    }
    return;
  }

  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    saveState();
    oDangChon.setAttribute("contenteditable", "true");
    oDangChon.innerText = e.key;
    oDangChon.focus();
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(oDangChon);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    e.preventDefault();
  } else if (e.key === "Backspace" || e.key === "Delete") {
    e.preventDefault();
    saveState();
    bangDangThaoTac.querySelectorAll("td.vung-chon").forEach((o) => {
      o.innerText = "";
      // Nếu thao tác xóa diễn ra ở Bảng 3, cập nhật lại trạng thái màu sắc dòng
      if (bangDangThaoTac === thanBangIn) {
        kiemTraSkuBang3(o.parentElement);
      }
    });
  }
});

/* =========================================================================
   LOGIC NÚT XỬ LÝ
   ========================================================================= */
btnXuLy.addEventListener("click", function () {
  saveState();
  const rows = thanBangNhap.rows;
  let danhSachKq = [];
  let mangDuLieuLog = [];

  for (let i = 0; i < rows.length; i++) {
    const mvd = rows[i].cells[1].innerText.trim();
    const mdh = rows[i].cells[2].innerText.trim();
    const inf = rows[i].cells[3].innerText.trim();
    if (!mvd && !mdh && !inf) continue;

    const blocks = splitProducts(inf);
    blocks.forEach((b) => {
      if (!b) return;

      const skuRaw = grab(b, "SKU Reference No\\.");
      const qtyRaw = grab(b, "Quantity");
      const priceRaw = grab(b, "Price");

      const priceNorm = normPrice(priceRaw);
      const qtyNum =
        qtyRaw !== null ? parseInt(qtyRaw.replace(/[^\d]/g, ""), 10) : NaN;

      const res = resolveSku(skuRaw, isNaN(qtyNum) ? 1 : qtyNum);
      const finalSku =
        res.sku === "" || res.sku === null ? "(thiếu SKU)" : res.sku;
      const finalQty = isNaN(res.qty) ? "(thiếu)" : res.qty;
      const finalPrice = priceNorm === null ? "(thiếu)" : priceNorm;

      danhSachKq.push({
        vandon: mvd,
        donhang: mdh,
        sku: finalSku,
        qty: finalQty,
        price: finalPrice,
        warn: res.warn, // ← THÊM DÒNG NÀY
      });

      mangDuLieuLog.push({
        orderId: mdh,
        vandon: mvd,
        sku: finalSku,
        qty: finalQty,
        price: finalPrice,
      });
    });
  }

  thanBangKq.innerHTML = "";
  if (danhSachKq.length === 0) {
    showToast("Không có dữ liệu hợp lệ để xử lý!", "warn");
    return;
  }

  danhSachKq.forEach((kq, idx) => {
    const tr = document.createElement("tr");
    const tdStt = document.createElement("td");
    tdStt.innerText = idx + 1;
    tdStt.style.background = "#f0f0f0";
    tdStt.style.textAlign = "center";
    tr.appendChild(tdStt);

    const c1 = document.createElement("td");
    tr.appendChild(c1).innerText = kq.vandon;
    const c2 = document.createElement("td");
    tr.appendChild(c2).innerText = kq.donhang;
    const c3 = document.createElement("td");
    tr.appendChild(c3).innerText = kq.sku;
    c3.className = "i-sku";
    const c4 = document.createElement("td");
    tr.appendChild(c4).innerText = kq.qty;
    c4.style.textAlign = "center";
    const c5 = document.createElement("td");
    tr.appendChild(c5).innerText = kq.price;
    c5.style.textAlign = "right";

    const tdAction = document.createElement("td");
    tdAction.className = "cell-actions";
    tdAction.style.textAlign = "center";
    tdAction.style.background = "#f8f9fa";
    const btnAdd = document.createElement("button");
    btnAdd.innerText = "+";
    btnAdd.className = "btn-row-action btn-row-add";
    btnAdd.addEventListener("click", () => {
      saveState();
      const cIdx = Array.from(thanBangKq.rows).indexOf(tr);
      chenHangVaoViTri(thanBangKq, cIdx + 1, 5);
    });
    const btnDel = document.createElement("button");
    btnDel.innerText = "×";
    btnDel.className = "btn-row-action btn-row-del";
    btnDel.addEventListener("click", () => {
      saveState();
      tr.remove();
      capNhatLaiSTT(thanBangKq);
    });
    tdAction.appendChild(btnAdd);
    tdAction.appendChild(btnDel);
    tr.appendChild(tdAction);

    const interactiveCells = Array.from(tr.cells).slice(1, -1);
    interactiveCells.forEach((td, cIdx) => {
      td.setAttribute("tabindex", "0");

      // Paste fix cho bảng 2
      td.addEventListener("paste", function (e) {
        if (td.getAttribute("contenteditable") === "true") {
          e.preventDefault();
          const text = (e.clipboardData || window.clipboardData).getData(
            "text/plain",
          );
          document.execCommand("insertText", false, text);
          return;
        }

        // --- NÂNG CẤP CHỨC NĂNG DÁN ĐA Ô CHO BẢNG 2 KHI ĐƯỢC CHỌN ---
        e.preventDefault();
        saveState();
        const dataCopy = (e.clipboardData || window.clipboardData).getData(
          "text",
        );
        const cacHang = parseTSV(dataCopy);

        const selectedCells = thanBangKq.querySelectorAll("td.vung-chon");
        if (selectedCells.length > 1) {
          let minR = Infinity;
          let minC = Infinity;
          const cellInfos = [];

          selectedCells.forEach((cell) => {
            const rowEl = cell.parentElement;
            const rIdx = Array.from(thanBangKq.rows).indexOf(rowEl);
            const interactiveCellsInRow = Array.from(
              rowEl.querySelectorAll("td:not(:first-child):not(:last-child)"),
            );
            const cIdx = interactiveCellsInRow.indexOf(cell);
            if (rIdx !== -1 && cIdx !== -1) {
              minR = Math.min(minR, rIdx);
              minC = Math.min(minC, cIdx);
              cellInfos.push({ cell, rIdx, cIdx });
            }
          });

          const copiedRows = cacHang.length;
          cellInfos.forEach((info) => {
            const rOffset = info.rIdx - minR;
            const cOffset = info.cIdx - minC;

            const rData = cacHang[rOffset % copiedRows];
            if (rData && rData.length > 0) {
              const value = rData[cOffset % rData.length];
              if (value !== undefined) {
                info.cell.innerText = value.trim();
              }
            }
          });
          return;
        }
      });

      td.addEventListener("mousedown", (e) => {
        suKienNhanChuot(
          e,
          Array.from(thanBangKq.rows).indexOf(tr),
          cIdx,
          thanBangKq,
        );
      });
      td.addEventListener("mouseenter", (e) => {
        suKienReChuot(e, Array.from(thanBangKq.rows).indexOf(tr), cIdx);
      });
      td.addEventListener("dblclick", () => {
        td.setAttribute("contenteditable", "true");
        td.focus();
      });
      let oldText = "";
      td.addEventListener("focus", () => {
        oldText = td.innerText;
      });
      td.addEventListener("blur", () => {
        td.setAttribute("contenteditable", "false");
        if (td.innerText !== oldText) saveState();
      });
      td.addEventListener("keydown", (evt) => {
        if (evt.key === "Enter") {
          if (evt.altKey) {
            // Hỗ trợ Alt+Enter cho cả bảng số 2 khi chỉnh sửa thủ công
            evt.preventDefault();
            document.execCommand("insertText", false, "\n");
          } else {
            evt.preventDefault();
            td.blur();
          }
        } else if (evt.key === "Escape") {
          // Esc fix cho bảng 2
          evt.preventDefault();
          td.innerText = oldText;
          td.blur();
        }
      });
    });
    thanBangKq.appendChild(tr);
    if (kq.warn) {
      // ← THÊM
      tr.classList.add("row-highlight-warn"); // ← THÊM
    } // ← THÊM
  });

  showToast(`Chuẩn hóa hoàn tất ${danhSachKq.length} hàng!`, "ok");
});

// Nâng cấp: CHỈNH SỬA MẪU IN ĐƠN
btnTaoIn.addEventListener("click", function () {
  const rows = thanBangIn.rows;
  let donHangGrouped = {};
  let coDuLieu = false;
  for (let i = 0; i < rows.length; i++) {
    const vandon = rows[i].cells[1].innerText.trim();
    const donhang = rows[i].cells[2].innerText.trim();
    const sku = rows[i].cells[3].innerText.trim();
    const qty = rows[i].cells[4].innerText.trim();
    const price = rows[i].cells[5].innerText.trim();
    if (!donhang && !sku) continue;
    coDuLieu = true;

    let tenSanPham = "Sản phẩm ZinZin",
      viTriKho = "Chưa xếp vị trí";
    if (MISA_DIRECTORY[sku]) {
      tenSanPham = MISA_DIRECTORY[sku].name || tenSanPham;
      viTriKho = MISA_DIRECTORY[sku].loc || viTriKho;
    }
    if (!donHangGrouped[donhang])
      donHangGrouped[donhang] = { vandon: vandon, items: [] };
    donHangGrouped[donhang].items.push({
      sku: sku,
      name: tenSanPham,
      loc: viTriKho,
      qty: qty,
      price: price,
    });
  }

  if (!coDuLieu) {
    invoiceArea.innerHTML = `<div style="text-align:center;color:red;padding:20px;">Bảng 3 không có dữ liệu để tạo!</div>`;
    return;
  }
  let htmlPreview = "",
    htmlPrint = "";
  Object.keys(donHangGrouped).forEach((idDon) => {
    const don = donHangGrouped[idDon];

    var total = don.items.reduce(function (s, it) {
      var pNum = parseFloat(normPrice(it.price)) || 0;
      return s + pNum;
    }, 0);

    // ── SẮP XẾP: Vị trí A→Z, không có vị trí xuống cuối ──
    don.items.sort(function (a, b) {
      var vA = a.loc === "Chưa xếp vị trí" || a.loc === "" ? "" : a.loc;
      var vB = b.loc === "Chưa xếp vị trí" || b.loc === "" ? "" : b.loc;
      if (vA === "" && vB === "") return 0; // cả hai trống → giữ nguyên
      if (vA === "") return 1; // a trống → a xuống cuối
      if (vB === "") return -1; // b trống → b xuống cuối
      return vA.localeCompare(vB, "vi"); // so sánh A→Z theo tiếng Việt
    });
    // ── KẾT THÚC SẮP XẾP ──

    // Cập nhật tiêu đề và bổ sung cột Ghi Chú
    let template = `
      <div class="invoice-box">
        <div class="invoice-head"><div><b>Mã Vận Đơn:</b> ${don.vandon}</div><div class="oid-value">ĐƠN HÀNG: ${idDon}</div></div>
        <table class="inv-table">
          <thead><tr><th>Mã SKU</th><th>Tên Sản Phẩm</th><th>Vị Trí Kho</th><th>SL</th><th>Ghi Chú</th></tr></thead>
          <tbody>`;

    don.items.forEach((it) => {
      // Khoanh tròn số lượng nếu lớn hơn 1
      let displayQty = it.qty;
      if (parseInt(it.qty) > 1) {
        displayQty = `<span class="circle-qty">${it.qty}</span>`;
      }

      template += `<tr><td class="i-sku">${it.sku}</td><td>${it.name}</td><td><b>${it.loc}</b></td><td style="text-align:center; font-weight:bold;">${displayQty}</td><td></td></tr>`;
    });

    template += `</tbody></table>
        <div class="inv-total">Total Price:<span class="num">${total.toLocaleString("vi-VN")}</span></div>
      </div>`;

    htmlPreview += template;
    htmlPrint += template.replace("invoice-box", "invoice-box page-break");
  });
  invoiceArea.innerHTML = htmlPreview;
  printOnlyZone.innerHTML = htmlPrint;
  showToast("Tạo mẫu in đơn thành công!", "ok");
  // Ghi log từ dữ liệu Bảng 3
  const mangLogBang3 = [];
  const rowsBang3 = thanBangIn.rows;
  for (let i = 0; i < rowsBang3.length; i++) {
    const vandon = rowsBang3[i].cells[1].innerText.trim();
    const donhang = rowsBang3[i].cells[2].innerText.trim();
    const sku = rowsBang3[i].cells[3].innerText.trim();
    const qty = rowsBang3[i].cells[4].innerText.trim();
    const price = rowsBang3[i].cells[5].innerText.trim();
    if (!donhang && !sku) continue; // bỏ qua hàng trống
    mangLogBang3.push({ vandon, orderId: donhang, sku, qty, price });
  }
  ghiLogLichSuLenGoogle(mangLogBang3);
});

btnInDon.addEventListener("click", () => {
  if (printOnlyZone.innerHTML.trim() === "") {
    showToast("Vui lòng nhấn nút 'TẠO MẪU IN ĐƠN' trước!", "warn");
    return;
  }
  window.print();
});

window.addEventListener("DOMContentLoaded", () => {
  khoiTaoTieuDe();
  taoBangTrong(thanBangNhap, 30, 3);
  taoBangTrong(thanBangKq, 30, 5);
  taoBangTrong(thanBangIn, 30, 5);
  taiDanhMucMisaTuGoogle();
  khoiTaoTenNguoiDung();

  // ── SỰ KIỆN CHO MODAL NHẬP TÊN ──
  document
    .getElementById("modal-btn-xac-nhan")
    .addEventListener("click", function () {
      var val = document.getElementById("modal-input-ten").value.trim();
      if (!val) {
        document.getElementById("modal-input-ten").focus();
        return;
      }
      document.getElementById("modal-ten").classList.remove("active");
      if (_modalCallback) _modalCallback(val);
    });
  document
    .getElementById("modal-btn-huy")
    .addEventListener("click", function () {
      document.getElementById("modal-ten").classList.remove("active");
    });
  document
    .getElementById("modal-input-ten")
    .addEventListener("keydown", function (e) {
      if (e.key === "Enter")
        document.getElementById("modal-btn-xac-nhan").click();
      if (
        e.key === "Escape" &&
        document.getElementById("modal-btn-huy").style.display !== "none"
      ) {
        document.getElementById("modal-ten").classList.remove("active");
      }
    });
});
