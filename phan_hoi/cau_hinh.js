// =========================================================================
// CẤU HÌNH — Phản hồi kích thước gói hàng (ZinZinMotor)
// Chỉ sửa file này khi đổi bảng tính / địa chỉ nộp. Không cần sửa app.js.
// =========================================================================
window.CAU_HINH_PHAN_HOI = {
  // Bảng tính chính (cùng bảng với trang Vận Hành) — chỉ ĐỌC qua khóa API
  SPREADSHEET_ID: "1Ro4FLShWGRQHilJ7m4RSmsfTp65QXpvJNfAjVjCLvrc",
  API_KEY: "AIzaSyANYGSIIawi6NyiSlWoWNVRJvUh1K_rqqw",

  // Địa chỉ /exec của Apps Script "Phan Hoi Kich Thuoc ZZM" (apps_script/phan_hoi_kich_thuoc.gs).
  // Để trống = chưa triển khai → trang vẫn xem được đơn nhưng nút Nộp báo chưa sẵn sàng.
  URL_NOP: "https://script.google.com/macros/s/AKfycby1FYJuLMuv9jhMjnAnq86s5Ya7YnHnORfeIOF4z0bfhwl92gJiqietRwthc5sEiggd-A/exec",

  SO_NGAY_TIM_DON: 45, // chỉ tìm các đơn đã tạo mẫu in trong 45 ngày gần nhất
};
