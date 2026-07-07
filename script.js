// File script.js
// 1. Cấu hình ban đầu
const soCot = 4;
const thanhCot = document.getElementById("thanh-cot");
const thanBang = document.getElementById("than-bang");
let tổngSốHàngHiệnTại = 0;

// 2. Tự động tạo các tiêu đề cột (A, B, C...)
for (let i = 0; i < soCot; i++) {
  const oTieuDe = document.createElement("th");
  oTieuDe.innerText = String.fromCharCode(65 + i);
  oTieuDe.style.width = "100px";
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

  // Tạo các ô trống để nhập liệu
  for (let c = 0; c < soCot; c++) {
    const oTrong = document.createElement("td");
    oTrong.style.height = "22px";
    oTrong.setAttribute("contenteditable", "true");
    hangMoi.appendChild(oTrong);
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
