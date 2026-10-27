// =========================================================================
// TỰ CO THẺ VỪA MÀN HÌNH — ZinZinMotor
// Chỉ điều chỉnh GIAO DIỆN lưới thẻ (#the-grid): số cột + tỷ lệ thu nhỏ (zoom)
// KHÔNG đọc/ghi phienHienTai, KHÔNG bọc hàm nào của script_van_don_kiem_hang.js
// Xóa file này (và thẻ <script> của nó) thì trang trở về như cũ
// =========================================================================
(function () {
  // ── CẤU HÌNH ──
  // Mục tiêu: TẤT CẢ thẻ luôn nằm trọn trong 1 màn hình, không bao giờ phải cuộn
  const TY_LE_NHO_NHAT = 0.1; // Giới hạn kỹ thuật — thực tế thu nhỏ bao nhiêu cũng được để vừa màn hình
  const TY_LE_GON_DAU_TRANG = 0.7; // Thẻ phải thu nhỏ dưới mức này → thu gọn phần đầu trang để nhường chỗ
  const SO_COT_TOI_DA = 12;
  const RONG_THE_TOI_THIEU = 160; // Bề rộng "thật" tối thiểu của thẻ trước khi thu nhỏ (px) — tránh thẻ hẹp làm chữ vỡ vụn
  // Cỡ chữ SKU lấp kín bề ngang thẻ — đơn vị cqi = 1% bề rộng lòng thẻ
  const SKU_CQI_TOI_DA = 16; // SKU rất ngắn không phình quá to làm thẻ cao lên
  const SKU_CQI_TOI_THIEU = 5; // SKU cực dài thì giữ cỡ này và cho xuống dòng
  const SKU_HE_SO_AN_TOAN = 0.97; // Chừa 3% để chữ không chạm sát mép thẻ

  const grid = document.getElementById("the-grid");
  if (!grid) return;

  // ──────────────────────────────────────────────────
  //  📐 ĐẶT BỐ CỤC: số cột (null = bố cục gốc trong CSS) và tỷ lệ thu nhỏ
  // ──────────────────────────────────────────────────
  function datBoCuc(soCot, tyLe) {
    if (soCot) {
      grid.style.setProperty(
        "grid-template-columns",
        "repeat(" + soCot + ", minmax(0, 1fr))",
        "important",
      );
      // Khoảng cách giữa các thẻ cũng nhỏ lại theo thẻ
      grid.style.setProperty(
        "gap",
        Math.max(2, Math.round(10 * tyLe)) + "px",
        "important",
      );
    } else {
      grid.style.removeProperty("grid-template-columns");
      grid.style.removeProperty("gap");
    }
    grid.style.setProperty("--ty-le", tyLe);
  }

  // ──────────────────────────────────────────────────
  //  🔠 SKU LẤP KÍN BỀ NGANG THẺ: đo chữ ở cỡ 100px rồi quy ra cqi
  // ──────────────────────────────────────────────────
  const butDo = document.createElement("canvas").getContext("2d");

  function capNhatCoChuSku() {
    grid.querySelectorAll(".the-sku:not([data-da-do])").forEach(function (el) {
      const kieu = getComputedStyle(el);
      butDo.font = kieu.fontWeight + " 100px " + kieu.fontFamily;
      const rong100 = butDo.measureText(el.textContent.trim()).width;
      el.setAttribute("data-da-do", "1");
      if (!rong100) return;

      const cqi = Math.min(
        SKU_CQI_TOI_DA,
        Math.max(SKU_CQI_TOI_THIEU, (10000 / rong100) * SKU_HE_SO_AN_TOAN),
      );
      el.style.setProperty("font-size", cqi.toFixed(2) + "cqi", "important");
      el.style.setProperty("line-height", "1.15");
    });
  }

  function vuaKhit() {
    return grid.scrollHeight <= grid.clientHeight + 1;
  }

  // Tìm tỷ lệ lớn nhất (chữ to nhất) mà với soCot cột vẫn hiện hết thẻ. 0 = không vừa
  // tyLeTran: tỷ lệ cao nhất cho phép để thẻ không hẹp hơn RONG_THE_TOI_THIEU
  function timTyLe(soCot, tyLeTran) {
    datBoCuc(soCot, tyLeTran);
    if (vuaKhit()) return tyLeTran;
    datBoCuc(soCot, TY_LE_NHO_NHAT);
    if (!vuaKhit()) return 0;

    let thap = TY_LE_NHO_NHAT;
    let cao = tyLeTran;
    for (let i = 0; i < 9; i++) {
      const giua = (thap + cao) / 2;
      datBoCuc(soCot, giua);
      if (vuaKhit()) thap = giua;
      else cao = giua;
    }
    return thap;
  }

  // ──────────────────────────────────────────────────
  //  🧠 CĂN CHỈNH: thử từng số cột, chọn cách cho chữ to nhất
  // ──────────────────────────────────────────────────
  function timBoCucTotNhat(soThe) {
    const rongLuoi = grid.clientWidth;
    let tot = { soCot: 1, tyLe: 0 };
    for (let c = 1; c <= Math.min(soThe, SO_COT_TOI_DA); c++) {
      const tyLeTran = Math.min(1, rongLuoi / c / RONG_THE_TOI_THIEU);
      // Thẻ quá hẹp ngay cả khi thu nhỏ tối đa → bỏ qua các số cột lớn hơn
      if (tyLeTran < TY_LE_NHO_NHAT) break;
      const tyLe = timTyLe(c, tyLeTran);
      if (tyLe > tot.tyLe + 0.001) tot = { soCot: c, tyLe: tyLe };
    }
    return tot;
  }

  function canChinh() {
    const soThe = grid.children.length;

    document.body.classList.remove("gon-dau-trang");
    datBoCuc(null, 1);
    if (soThe === 0) return;

    capNhatCoChuSku();

    // Bố cục gốc đã hiện hết → giữ nguyên giao diện cũ
    if (vuaKhit()) return;

    let tot = timBoCucTotNhat(soThe);

    // Thẻ phải thu nhỏ nhiều → thu gọn phần đầu trang để thẻ được to hơn
    if (tot.tyLe < TY_LE_GON_DAU_TRANG) {
      document.body.classList.add("gon-dau-trang");
      datBoCuc(null, 1);
      if (vuaKhit()) return;
      tot = timBoCucTotNhat(soThe);
    }

    if (tot.tyLe === 0) {
      // Trường hợp cực hiếm (màn hình gần như không còn chỗ): thu nhỏ hết mức có thể
      tot = { soCot: Math.min(soThe, SO_COT_TOI_DA), tyLe: TY_LE_NHO_NHAT };
    }

    datBoCuc(tot.soCot, tot.tyLe);
  }

  // ──────────────────────────────────────────────────
  //  🎯 KÍCH HOẠT: khi đổi đơn, khi quét làm thẻ to ra, khi xoay/đổi cỡ màn hình
  // ──────────────────────────────────────────────────
  let henGio = 0;
  function lenLich() {
    if (henGio) return;
    henGio = requestAnimationFrame(function () {
      henGio = 0;
      canChinh();
    });
  }

  new MutationObserver(function (danhSach) {
    const doiThe = danhSach.some(function (m) {
      return m.target === grid;
    });
    // Đổi đơn → căn lại toàn bộ; quét SKU chỉ đổi chữ → chỉ căn lại nếu bị tràn
    if (doiThe || !vuaKhit()) lenLich();
  }).observe(grid, { childList: true, subtree: true, characterData: true });

  window.addEventListener("resize", lenLich);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", lenLich);
  }

  lenLich();
})();
