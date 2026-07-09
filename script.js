// File script.js
/* Danh sách hàng tiêu đề cột
thêm danh sách tiêu đề cột vào đây, ví dụ:
const danhSachHangTieuDe = [
  "Mã Vận Đơn (Tracking Number)",
  "Mã Đơn Hàng (order_sn)",
  "Thông Tin Đơn hàng (product_info)",
];
--------------------------------------*/
const danhSachHangTieuDe = [
  "Mã Vận Đơn (Tracking Number)",
  "Mã Đơn Hàng (order_sn)",
  "Thông Tin Đơn hàng (product_info)",
];
//--------------------------------------//
// 1. Cấu hình ban đầu
const soCot = danhSachHangTieuDe.length;
const thanhCot = document.getElementById("thanh-cot");
const thanBang = document.getElementById("than-bang");
let tổngSốHàngHiệnTại = 0;
// BIẾN THÊM MỚI: Quản lý trạng thái bôi đen vùng bằng chuột
let dangKeoChuot = false;
let hangBatDau = -1;
let cotBatDauVung = -1;
let cotKetThucVung = -1;

// 2. Tự động tạo các tiêu đề cột (A, B, C...)
for (let i = 0; i < soCot; i++) {
  const oTieuDe = document.createElement("th");
  oTieuDe.innerText = danhSachHangTieuDe[i];
  oTieuDe.style.width = "150px";
  oTieuDe.style.background = "#f0f0f0";
  thanhCot.appendChild(oTieuDe);
}

// 3. Hàm chuyên dùng để tạo một hàng mới
function taoMoiMotHang() {
  const hangMoi = document.createElement("tr");
  hangMoi.className = "hang-du-lieu";

  // Tạo ô số thứ tự (STT)
  const oSoThuTu = document.createElement("td");
  oSoThuTu.style.background = "#f0f0f0";
  oSoThuTu.style.textAlign = "center";
  oSoThuTu.style.position = "relative";
  oSoThuTu.style.width = "60px";

  // Nhãn hiển thị con số
  const nhanSo = document.createElement("span");
  nhanSo.innerText = tổngSốHàngHiệnTại + 1;
  oSoThuTu.appendChild(nhanSo);

  // Khung chứa 2 nút hành động
  const khungNut = document.createElement("div");
  khungNut.className = "khung-nut-hanh-dong";
  khungNut.style.position = "absolute";
  khungNut.style.right = "2px";
  khungNut.style.top = "2px";
  khungNut.style.display = "flex";
  khungNut.style.gap = "2px";

  // Nút cộng (+)
  const nutCong = document.createElement("button");
  nutCong.innerText = "+";
  nutCong.style.cursor = "pointer";
  nutCong.style.fontSize = "10px";
  nutCong.style.padding = "0 3px";
  nutCong.onclick = function () {
    taoMoiMotHang();
  };

  // Nút trừ (-)
  const nutTru = document.createElement("button");
  nutTru.innerText = "-";
  nutTru.style.cursor = "pointer";
  nutTru.style.fontSize = "10px";
  nutTru.style.padding = "0 4px";
  nutTru.onclick = function () {
    hangMoi.remove();
    capNhatLaiSoThuTu();
  };

  khungNut.appendChild(nutCong);
  khungNut.appendChild(nutTru);
  oSoThuTu.appendChild(khungNut);
  hangMoi.appendChild(oSoThuTu);

  // Tạo các ô trống để nhập liệu (Có tính năng Paste từ Excel)
  for (let c = 0; c < soCot; c++) {
    const oTrong = document.createElement("td");
    oTrong.style.height = "22px";
    oTrong.setAttribute("contenteditable", "false"); // MẶC ĐỊNH: Khóa không cho hiện con trỏ nhập liệu khi click đơn//

    // THÊM DÒNG NÀY: Giúp ô <td> có thể nhận Focus hệ thống khi click đơn
    oTrong.setAttribute("tabindex", "0");

    /*=========================================================/
    /BẮT ĐẦU KHỐI PASTE DỮ LIỆU TỪ Excel - CẦN NGHIÊN CỨU LẠI*/

    // Bắt sự kiện khi người dùng PASTE dữ liệu vào ô này
    oTrong.addEventListener("paste", function (e) {
      // 1. Ngăn chặn hành vi dán mặc định
      e.preventDefault();

      // 2. Lấy dữ liệu từ clipboard
      const dataCopy = (e.clipboardData || window.clipboardData).getData(
        "text",
      );

      // 3. THUẬT TOÁN THÔNG MINH: Tách hàng và ô chuẩn Excel (Chấp nhận dấu xuống dòng trong ô)
      const cacHang = [];
      let hangHienTai = [];
      let oHienTai = "";
      let trongNgoatKep = false;

      for (let i = 0; i < dataCopy.length; i++) {
        const kyTu = dataCopy[i];
        const kyTuTiepTheo = dataCopy[i + 1];

        if (kyTu === '"') {
          // Nếu gặp dấu ngoặc kép, kiểm tra xem có phải dấu ngoặc kép bọc ngoài hay là dấu ngoặc kép viết đúp "" bên trong dữ liệu
          if (trongNgoatKep && kyTuTiepTheo === '"') {
            oHienTai += '"'; // Giữ lại một dấu ngoặc kép nếu viết đúp
            i++; // Bỏ qua ký tự tiếp theo
          } else {
            trongNgoatKep = !trongNgoatKep; // Đảo trạng thái (bật/tắt chế độ đang ở trong ô chứa dấu xuống dòng)
          }
        } else if (kyTu === "\t" && !trongNgoatKep) {
          // Nếu gặp dấu Tab ở ngoài ngoặc kép -> Kết thúc một ô
          hangHienTai.push(oHienTai);
          oHienTai = "";
        } else if ((kyTu === "\r" || kyTu === "\n") && !trongNgoatKep) {
          // Nếu gặp dấu xuống dòng ở ngoài ngoặc kép -> Kết thúc một hàng
          if (kyTu === "\r" && kyTuTiepTheo === "\n") i++; // Bỏ qua \n nếu đi liền sau \r
          hangHienTai.push(oHienTai);
          cacHang.push(hangHienTai);
          hangHienTai = [];
          oHienTai = "";
        } else {
          // Các ký tự thông thường (bao gồm cả dấu xuống dòng nằm trong ngoặc kép)
          oHienTai += kyTu;
        }
      }
      // Đẩy nốt phần dữ liệu cuối cùng vào mảng nếu còn dư
      if (oHienTai !== "" || hangHienTai.length > 0) {
        hangHienTai.push(oHienTai);
        cacHang.push(hangHienTai);
      }

      // 4. TIẾN HÀNH ĐỔ DỮ LIỆU VÀO BẢNG
      let hangDuyet = hangMoi;
      let cotBatDau = c;

      for (let i = 0; i < cacHang.length; i++) {
        const cacO = cacHang[i];

        // Kiểm tra nếu hàng toàn ô trống thì bỏ qua
        if (cacO.length === 1 && cacO[0].trim() === "") continue;

        // Nếu thiếu hàng bên dưới, tự động đẻ thêm hàng mới
        if (!hangDuyet) {
          taoMoiMotHang();
          hangDuyet = thanBang.lastElementChild;
        }

        // Lấy các ô nhập liệu của hàng hiện tại
        const danhSachOTrong = hangDuyet.querySelectorAll(
          "td:not(:first-child)",
        );

        // Đổ dữ liệu vào từng ô
        for (let j = 0; j < cacO.length; j++) {
          const viTriOChinhXac = cotBatDau + j;
          if (viTriOChinhXac < danhSachOTrong.length) {
            // Lưu ý: Dùng innerText để nó hiển thị đúng cả dấu xuống dòng \n bên trong ô web
            danhSachOTrong[viTriOChinhXac].innerText = cacO[j].trim();
          }
        }

        // Xuống hàng tiếp theo, reset cột bắt đầu về 0
        hangDuyet = hangDuyet.nextElementSibling;
        cotBatDau = 0;
      }
    });
    /*------------------------------------------/
    /KẾT THÚC KHỐI LỆNH PASTE DỮ LIỆU TỪ Excel */

    // ==========================================//
    // BẮT ĐẦU KHỐI LỆNH: HIỆU ỨNG CHỌN Ô & BÔI ĐEN VÙNG CHUỘT

    // 1. Khi bấm chuột xuống ô (Mousedown) - Kích hoạt điểm bắt đầu
    oTrong.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return; // Chỉ xử lý nếu bấm chuột trái

      // Nếu ô đang ở chế độ chỉnh sửa (đã dblclick) thì bỏ qua hoàn toàn
      if (oTrong.getAttribute("contenteditable") === "true") return;

      dangKeoChuot = true;

      // THÊM DÒNG NÀY: Ép trình duyệt phải Focus thực tế vào ô này ngay khi click đơn
      oTrong.focus();

      // Tìm vị trí hàng và cột hiện tại của ô này trong bảng
      const tatCaHang = Array.from(
        thanBang.getElementsByClassName("hang-du-lieu"),
      );
      hangBatDau = tatCaHang.indexOf(hangMoi);
      cotBatDauVung = c;
      cotKetThucVung = c;

      // Xóa toàn bộ các vùng ô đã bôi đen hoặc đang chọn trước đó
      xoaToanBoVungChon();

      // Đặt ô hiện tại làm ô chủ đạo (Chứa viền xanh đậm)
      oTrong.classList.add("dang-chon");
      // Chỉ bôi màu nền nếu ô hiện tại KHÔNG phải là ô STT đầu tiên
      if (c >= 0) oTrong.classList.add("vung-chon");
    });

    // 2. Khi di chuột xuyên qua ô (Mouseenter) - Tính toán vùng hình chữ nhật
    oTrong.addEventListener("mouseenter", function () {
      if (!dangKeoChuot) return; // Nếu không giữ chuột trái thì bỏ qua

      // THÊM ĐOẠN NÀY: Xóa sạch vết bôi đen chữ hệ thống phát sinh khi kéo chuột nhanh
      if (window.getSelection) {
        window.getSelection().removeAllRanges();
      } else if (document.selection) {
        document.selection.empty();
      }

      const tatCaHang = Array.from(
        thanBang.getElementsByClassName("hang-du-lieu"),
      );
      const hangHienTaiVtri = tatCaHang.indexOf(hangMoi);
      const cotHienTaiVtri = c;

      // Tính toán phạm vi hình chữ nhật từ ô đầu tiên đến ô hiện tại
      const minHang = Math.min(hangBatDau, hangHienTaiVtri);
      const maxHang = Math.max(hangBatDau, hangHienTaiVtri);
      const minCot = Math.min(cotBatDauVung, cotHienTaiVtri);
      const maxCot = Math.max(cotBatDauVung, cotHienTaiVtri);

      // Quét qua mọi ô trên bảng để bật/tắt màu xanh dựa theo vùng hình chữ nhật
      tatCaHang.forEach((h, indexH) => {
        const cacOTrongHang = h.querySelectorAll("td:not(:first-child)");
        cacOTrongHang.forEach((o, indexC) => {
          if (
            indexH >= minHang &&
            indexH <= maxHang &&
            indexC >= minCot &&
            indexC <= maxCot
          ) {
            o.classList.add("vung-chon");
          } else {
            o.classList.remove("vung-chon");
          }
        });
      });
      cotKetThucVung = cotHienTaiVtri; // Cập nhật cột kết thúc vùng khi di chuột qua ô mới
    });

    // 3. Giữ nguyên tính năng NHÁY ĐÚP CHUỘT ĐỂ SỬA SÂU (DBLCLICK)
    oTrong.addEventListener("dblclick", function (e) {
      e.stopPropagation(); // Ngăn chặn sự kiện mousedown can thiệp
      dangKeoChuot = false; // Ngăn chặn sự kiện kéo chuột can thiệp
      oTrong.setAttribute("contenteditable", "true");
      oTrong.focus();
      // Đặt con trỏ về sau ký tự CUỐI CÙNG trong ô
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(oTrong);
      range.collapse(false); // false = về cuối
      sel.removeAllRanges();
      sel.addRange(range);
    });

    // Khóa ô lại khi mất tập trung hoặc nhấn Enter
    oTrong.addEventListener("blur", function () {
      oTrong.setAttribute("contenteditable", "false");
    });
    oTrong.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        oTrong.blur();
      }
    });
    // KẾT THÚC KHỐI LỆNH: HIỆU ỨNG CHỌN Ô & BÔI ĐEN VÙNG CHUỘT
    // ==========================================//

    hangMoi.appendChild(oTrong); // Thêm ô trống vào hàng mới
  }

  // Vị trí chèn hàng (Vào giữa hoặc vào cuối)
  if (this && this.parentElement && this.parentElement.parentElement) {
    const hangHienTai = this.parentElement.parentElement;
    hangHienTai.insertAdjacentElement("afterend", hangMoi);
    capNhatLaiSoThuTu();
  } else {
    thanBang.appendChild(hangMoi);
  }

  tổngSốHàngHiệnTại++;
}

// 4. Hàm quét và cập nhật lại số thứ tự khi có hàng bị xóa/chèn giữa
function capNhatLaiSoThuTu() {
  const danhSachHang = thanBang.getElementsByClassName("hang-du-lieu");
  tổngSốHàngHiệnTại = danhSachHang.length;

  for (let i = 0; i < danhSachHang.length; i++) {
    const oSo = danhSachHang[i]
      .getElementsByTagName("td")[0]
      .getElementsByTagName("span")[0];
    if (oSo) {
      oSo.innerText = i + 1;
    }
  }
}

// 5. Khởi tạo 10 hàng mặc định lúc mở trang
for (let i = 0; i < 10; i++) {
  taoMoiMotHang();
}

/* =======================================================================/
BỔ SUNG: CÁC HÀM TRỢ NĂNG XỬ LÝ THẢ CHUỘT VÀ XOÁ VÙNG CHỌN TOÀN TRANG */

// Khi người dùng thả chuột trái ra ở bất kỳ vị trí nào trên màn hình -> Ngừng bôi đen
document.addEventListener("mouseup", function () {
  dangKeoChuot = false;
});

// Hàm dọn dẹp: Xóa sạch toàn bộ class chọn ô cũ để reset bảng
function xoaToanBoVungChon() {
  const tatCaO = thanBang.querySelectorAll("td:not(:first-child)");
  tatCaO.forEach((o) => {
    o.setAttribute("contenteditable", "false");
    o.classList.remove("dang-chon");
    o.classList.remove("vung-chon");
  });
}
/* ======================================================================= */

/*=======================================================================/
BẮT ĐẦU KHỐI LỆNH: SỰ KIỆN BẮT PHÍM CHỌN Ô NHƯ EXCEL HOẶC GOOGLE SHEETS*/

// Sự kiện bắt phím trên toàn bộ trang web để ghi đè dữ liệu chuẩn Excel
document.addEventListener("keydown", function (e) {
  // Tìm xem có ô nào đang được chọn không
  const oDangChon = thanBang.querySelector(".dang-chon");
  if (!oDangChon) return; // Nếu không có ô nào được chọn thì bỏ qua

  if (e.ctrlKey && e.shiftKey && e.key === "ArrowDown") {
    e.preventDefault();
    const tatCaHang = Array.from(
      thanBang.getElementsByClassName("hang-du-lieu"),
    );

    // Tìm hàng cuối cùng có dữ liệu trong phạm vi các CỘT đang chọn
    const minCot = Math.min(cotBatDauVung, cotKetThucVung);
    const maxCot = Math.max(cotBatDauVung, cotKetThucVung);

    let hangCuoiCoData = -1;
    for (let i = tatCaHang.length - 1; i >= 0; i--) {
      const hang = tatCaHang[i].querySelectorAll("td:not(:first-child)");
      // Chỉ kiểm tra các cột nằm trong vùng đang chọn
      const coData = Array.from(hang).some(
        (o, index) =>
          index >= minCot && index <= maxCot && o.innerText.trim() !== "",
      );
      if (coData) {
        hangCuoiCoData = i;
        break;
      }
    }
    if (hangCuoiCoData === -1) return;

    // Mở rộng vùng bôi đen: giữ nguyên cột, kéo hàng xuống cuối
    const minHang = Math.min(hangBatDau, hangCuoiCoData);
    const maxHang = Math.max(hangBatDau, hangCuoiCoData);

    tatCaHang.forEach((h, indexH) => {
      const cacOTrongHang = h.querySelectorAll("td:not(:first-child)");
      cacOTrongHang.forEach((o, indexC) => {
        if (
          indexH >= minHang &&
          indexH <= maxHang &&
          indexC >= minCot &&
          indexC <= maxCot
        ) {
          o.classList.add("vung-chon");
        } else {
          o.classList.remove("vung-chon");
        }
      });
    });

    return;
  }

  // Nếu ô đó ĐANG ở chế độ chỉnh sửa sâu (nháy đúp con trỏ) thì để mặc định, không can thiệp
  if (oDangChon.getAttribute("contenteditable") === "true") return;

  // Kiểm tra xem phím bấm có phải là phím ký tự thông thường không (bỏ qua các phím chức năng như Enter, Ctrl, Alt, Arrow...)
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    oDangChon.setAttribute("contenteditable", "true"); // Bật quyền chỉnh sửa
    oDangChon.innerText = e.key; // Xóa sạch chữ cũ, ghi đè ký tự đầu tiên vừa bấm vào
    oDangChon.focus(); // Đưa con trỏ vào ô

    // Di chuyển con trỏ chuột ra sau ký tự vừa gõ (tránh bị lỗi con trỏ nhảy lên trước)
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(oDangChon);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);

    e.preventDefault();
  } else if (e.key === "Backspace" || e.key === "Delete") {
    e.preventDefault();
    // THAY ĐỔI Ở ĐÂY: Thay vì xóa 1 ô, ta quét và xóa toàn bộ ô trong vùng bôi đen
    const cacODangBoiDen = thanBang.querySelectorAll("td.vung-chon");
    cacODangBoiDen.forEach((o) => {
      o.innerText = "";
    });
  }
});
/* ========================================================/
/KẾT THÚC KHỐI LỆNH CHỌN Ô GIỐNG EXCEL HOẶC GOOGLE SHEETS */
