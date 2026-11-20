// =========================================================================
// TRANG "SẮP XẾP TỜ ĐƠN" — chỉnh bảng điều khiển tab SAP_XEP_DON trên web (giao diện hình mẫu 2, duyệt 20/11)
// - ĐỌC tab bằng khóa API (chỉ đọc). LƯU qua Apps Script "Sap Xep Don ZZM" (mật khẩu admin).
// - CÔNG TẮC KHẨN CẤP BAT_SAP_XEP: GIẤU HẲN — trang KHÔNG đọc, KHÔNG hiện, KHÔNG gửi (Apps Script cũng không bao giờ ghi).
// - Sheet giữ MÃ không dấu (mon_dau_co_vi_tri…), trang hiện chữ tiếng Việt có dấu.
// =========================================================================
(function () {
  "use strict";

  // ── Cấu hình ──
  const ID_BANG_TINH = "1Ro4FLShWGRQHilJ7m4RSmsfTp65QXpvJNfAjVjCLvrc";
  const KHOA_API = "AIzaSyANYGSIIawi6NyiSlWoWNVRJvUh1K_rqqw"; // khóa chỉ đọc, giống script.js
  const TEN_TAB = "SAP_XEP_DON";
  // Địa chỉ ứng dụng web Apps Script "Sap Xep Don ZZM" (chủ dự án triển khai rồi dán vào đây). Trống = chưa lưu được.
  const URL_LUU = window.__SXD_URL_LUU_THU || "https://script.google.com/macros/s/AKfycbxJ1y3gPI-0C06OahonkPUmqaUkrMULVyLKdnctkWL0qluNRXxN44Nrwlzw0ha3vYr0wQ/exec"; // __SXD_URL_LUU_THU: chỉ bài kiểm thử dùng
  const KHOA_TEN_NGUOI = "zzm_ten_nhan_vien"; // tên đang dùng ở trang Vận Hành (chỉ đọc)

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const sao = (o) => JSON.parse(JSON.stringify(o));
  const sach = (v) => (v === null || v === undefined ? "" : String(v).replace(/\s+/g, " ").trim());
  const T = (c, ch, cs, n) => ({ c: c || "", n: n === undefined ? "" : n, ch: ch || "tang", cs: cs || "so_tu_nhien" });
  const TRONG = T("");

  // Căn cứ: mã → [tên tiếng Việt, loại (vt = vị trí kho / so = con số / chu), nghĩa là…] — mã PHẢI giống apps_script + sap_xep_don.js
  const CAN_CU = {
    mon_dau_co_vi_tri: ["Món đầu tiên có vị trí kho", "vt", "Nhìn từ trên xuống trên tờ đơn, gặp món đầu tiên có ghi vị trí thì lấy vị trí đó. Giống đường đi lấy hàng nhất."],
    mon_dau: ["Món ở dòng đầu tiên", "vt", "Lấy vị trí của món dòng 1 trên tờ đơn. Món đó chưa có vị trí → đơn bị coi như không có vị trí ở quy tắc này."],
    mon_thu_n: ["Món ở dòng thứ N", "vt", "Lấy vị trí của món ở dòng thứ N (ghi số N bên cạnh). Đơn có ít món hơn N → coi như không có vị trí ở quy tắc này."],
    vi_tri_nho_nhat: ["Vị trí nhỏ nhất trong đơn", "vt", "Trong các món của đơn, lấy vị trí đứng đầu (A trước Z, 9 trước 13). Thường giống \"món đầu tiên có vị trí\"."],
    vi_tri_lon_nhat: ["Vị trí lớn nhất trong đơn", "vt", "Lấy vị trí đứng CUỐI trong các món của đơn — dùng khi muốn xếp theo chỗ xa nhất phải đi tới."],
    khu_chinh: ["Khu có nhiều món nhất", "vt", "Khu = phần trước dấu \"-\" đầu tiên (A-C1H2-01 → khu A). Đơn có nhiều món ở khu nào thì xếp vào khu đó."],
    so_mon: ["Số món trong đơn", "so", "Đếm số dòng hàng trên tờ đơn."],
    tong_so_luong: ["Tổng số lượng hàng", "so", "Cộng số lượng (SL) của tất cả các món."],
    ma_hang_dau: ["Mã hàng của món đầu tiên", "chu", "So mã SKU của món dòng 1."],
    hang_de_vo: ["Có hàng dễ vỡ hay không", "so", "Đơn có món được MISA đánh dấu HÀNG DỄ VỠ."],
    san: ["Sàn bán (Shopee / TikTok)", "chu", "Nhận sàn theo dạng mã đơn: mã 18 chữ số là TikTok, còn lại là Shopee."],
  };
  const CACH_SO = {
    so_tu_nhien: ["Số tự nhiên (9 trước 13)", "So số như đếm: A3-9 đứng trước A3-13. Nên dùng cho vị trí kho."],
    chu: ["Từng chữ (13 trước 9)", "So từng ký tự như tra từ điển: A3-13 đứng trước A3-9. Hiếm khi cần."],
    theo_danh_sach_uu_tien: ["Theo danh sách khu ưu tiên", "Khu nào ghi trên trong danh sách (bước 3) thì xếp trước; khu không có trong danh sách xếp sau; cùng nhóm thì so số tự nhiên."],
  };
  const KVT = ["cuoi", "dau"], NHIEU = ["lay_phan_dau", "giu_nguyen"], CHIEU = ["tang", "giam"];
  const loaiCc = (c) => (CAN_CU[c] ? CAN_CU[c][1] : "");
  const coCachSo = (c) => !!c && loaiCc(c) !== "so" && c !== "san"; // số / sàn: cách so không có ý nghĩa
  const chieuChu = (c, ch) => {
    if (c === "hang_de_vo") return ch === "tang" ? "đơn KHÔNG có hàng dễ vỡ trước, đơn CÓ hàng dễ vỡ để sau" : "đơn CÓ hàng dễ vỡ trước, đơn không dễ vỡ để sau";
    if (c === "san") return ch === "tang" ? "Shopee trước, TikTok sau" : "TikTok trước, Shopee sau";
    if (c === "so_mon" || c === "tong_so_luong") return ch === "tang" ? "đơn ÍT trước, đơn NHIỀU sau" : "đơn NHIỀU trước, đơn ÍT sau";
    if (c === "ma_hang_dau") return ch === "tang" ? "mã A → Z" : "mã Z → A";
    return ch === "tang" ? "từ A đến Z (đầu kho → cuối kho)" : "từ Z về A (cuối kho → đầu kho)";
  };
  const CHIEU_TEN = (c) => c === "hang_de_vo" ? [["tang", "Không dễ vỡ trước"], ["giam", "Dễ vỡ trước"]]
    : c === "so_mon" || c === "tong_so_luong" ? [["tang", "Ít trước → nhiều sau"], ["giam", "Nhiều trước → ít sau"]]
    : c === "san" ? [["tang", "Shopee trước"], ["giam", "TikTok trước"]] : [["tang", "Tăng dần (A → Z)"], ["giam", "Giảm dần (Z → A)"]];

  // CÁCH SẮP CÓ SẴN (bước 1) — mỗi cách = bộ 3 tầng ghi xuống Google Sheet
  const VT = T("mon_dau_co_vi_tri");
  const CACH = [
    { id: "duong_di", ten: "🚶 Theo đường đi trong kho", goi: "Khuyên dùng", khi: "Kho đi lấy hàng 1 vòng từ đầu kho tới cuối kho.", vd: "A-B6-03 → A-C1H2-03 → FE-C4H2-01 → SH20-C6H3-02", tang: [VT, TRONG, TRONG] },
    { id: "khu_uu_tien", ten: "🗺️ Theo thứ tự khu tôi tự đặt", khi: "Đường đi trong kho KHÔNG theo A → Z (vd đi khu SH20 trước rồi mới tới khu A).", vd: "Danh sách: SH20, FT → SH20-… → FT-… → các khu còn lại A → Z", tang: [T("mon_dau_co_vi_tri", "tang", "theo_danh_sach_uu_tien"), TRONG, TRONG] },
    { id: "nhieu_mon", ten: "📦 Đơn nhiều món làm trước", khi: "Muốn soạn đơn to (nhiều món) trước, đơn 1 món để sau; cùng số món thì theo đường đi.", vd: "Đơn 5 món → đơn 3 món → đơn 1 món", tang: [T("so_mon", "giam"), VT, TRONG] },
    { id: "de_vo", ten: "🥚 Hàng dễ vỡ để riêng cuối xấp", khi: "Muốn gom các đơn có hàng dễ vỡ xuống cuối để đóng gói cẩn thận; còn lại theo đường đi.", vd: "Đơn thường (theo vị trí) → đơn dễ vỡ (theo vị trí)", tang: [T("hang_de_vo", "tang"), VT, TRONG] },
    { id: "theo_san", ten: "🛒 Tách riêng từng sàn", khi: "Muốn xấp Shopee riêng, xấp TikTok riêng; trong mỗi sàn theo đường đi.", vd: "Shopee (theo vị trí) → TikTok (theo vị trí)", tang: [T("san", "tang", "chu"), VT, TRONG] },
    { id: "tu_chinh", ten: "⚙️ Tự chỉnh (nâng cao)", khi: "Cài đặt không giống cách nào ở trên — chỉnh ở phần Cài đặt nâng cao.", vd: "Mở \"Cài đặt nâng cao\" bên dưới", tang: null },
  ];
  const MAC_DINH = { tang: [VT, TRONG, TRONG], kvt: "cuoi", nhieu: "lay_phan_dau", kv: ["CHƯA XẾP VỊ TRÍ"], dungMd: false };

  let dangDung = null; // bản đọc từ sheet (đã chuẩn hóa) — để liệt kê "những gì sẽ đổi"
  let st = null;       // bản đang chỉnh trên trang
  let capNhatCu = "";  // ô CAP_NHAT lúc đọc — gửi kèm khi lưu để phát hiện người khác vừa lưu
  let dangLuu = false, choGhiDe = false;

  // ─────────────────────────────────────────────────────────────────────────
  // ĐỌC BẢNG (tìm theo CHỮ cột A; KHÔNG đọc dòng BAT_SAP_XEP)
  // ─────────────────────────────────────────────────────────────────────────
  function docBang(values) {
    const dong = (values || []).map((d) => (Array.isArray(d) ? d : []));
    const vt = {};
    dong.forEach((d, i) => { const k = sach(d[0]).toUpperCase(); if (k && vt[k] === undefined) vt[k] = i; });
    if (vt.TIEU_CHI === undefined || vt.DANH_SACH_UU_TIEN === undefined || vt.COI_NHU_KHONG_VI_TRI === undefined) return null;
    const canh = [];
    const gt = (nhan) => (vt[nhan] === undefined ? undefined : dong[vt[nhan]][1]);
    const chon = (nhan, ds, md, ten) => { const v = sach(gt(nhan)).toLowerCase(); if (!v) return md; if (ds.indexOf(v) < 0) { canh.push(ten + ': "' + sach(gt(nhan)) + '" không hợp lệ → tạm dùng mặc định'); return md; } return v; };
    const kq = {
      kvt: chon("DON_KHONG_VI_TRI", KVT, "cuoi", "Đơn chưa có vị trí"),
      nhieu: chon("VI_TRI_NHIEU", NHIEU, "lay_phan_dau", "Ô vị trí ghi nhiều chỗ"),
      dungMd: gt("DUNG_MAC_DINH") === true || sach(gt("DUNG_MAC_DINH")).toUpperCase() === "TRUE",
      tang: [sao(TRONG), sao(TRONG), sao(TRONG)], ut: [], kv: [],
    };
    for (let i = vt.TIEU_CHI + 1; i < vt.DANH_SACH_UU_TIEN; i++) {
      const d = dong[i], so = sach(d[0]);
      if (!/^[123]$/.test(so)) continue;
      const t = kq.tang[+so - 1], c = sach(d[1]).toLowerCase();
      if (!c) continue;
      if (!CAN_CU[c]) { canh.push("Tầng " + so + ': căn cứ "' + sach(d[1]) + '" không hợp lệ → bỏ tầng này'); continue; }
      t.c = c;
      t.n = c === "mon_thu_n" ? sach(d[2]) : "";
      const ch = sach(d[3]).toLowerCase(), cs = sach(d[4]).toLowerCase();
      t.ch = CHIEU.indexOf(ch) >= 0 ? ch : "tang";
      t.cs = CACH_SO[cs] ? cs : (c === "san" ? "chu" : "so_tu_nhien");
      if (ch && CHIEU.indexOf(ch) < 0) canh.push("Tầng " + so + ': chiều "' + sach(d[3]) + '" không hợp lệ → tạm dùng tăng dần');
      if (cs && !CACH_SO[cs]) canh.push("Tầng " + so + ': cách so "' + sach(d[4]) + '" không hợp lệ → tạm dùng số tự nhiên');
      if (!coCachSo(c)) t.cs = c === "san" ? "chu" : "so_tu_nhien";
    }
    if (!kq.tang[0].c) { // tầng 1 trống: dồn tầng 2/3 lên, không còn gì → mặc định
      kq.tang = kq.tang.filter((t) => t.c).concat([sao(TRONG), sao(TRONG), sao(TRONG)]).slice(0, 3);
      if (!kq.tang[0].c) { kq.tang[0] = sao(VT); canh.push("Tầng 1 đang trống → tạm dùng \"Theo đường đi trong kho\""); }
    }
    for (let i = vt.DANH_SACH_UU_TIEN + 1; i < vt.COI_NHU_KHONG_VI_TRI; i++) { const v = sach(dong[i][0]); if (v) kq.ut.push(v); }
    for (let i = vt.COI_NHU_KHONG_VI_TRI + 1; i < dong.length; i++) { const v = sach(dong[i][0]); if (v) kq.kv.push(v); }
    return { caiDat: kq, canh: canh, capNhat: gt("CAP_NHAT") === undefined ? "" : String(gt("CAP_NHAT")) };
  }

  function taiBang() {
    $("dang-tai").hidden = false; $("noi-dung").hidden = true; $("loi-tai").hidden = true;
    const url = "https://sheets.googleapis.com/v4/spreadsheets/" + ID_BANG_TINH + "/values/" + encodeURIComponent(TEN_TAB + "!A1:F700") +
      "?valueRenderOption=UNFORMATTED_VALUE&key=" + KHOA_API;
    return fetch(url, { cache: "no-store" })
      .then((r) => { if (r.status === 400) throw new Error("khong_tab"); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then((d) => {
        const kq = docBang(d.values);
        if (!kq) throw new Error("sai_bo_cuc");
        dangDung = Object.assign(sao(kq.caiDat), {});
        st = sao(kq.caiDat);
        capNhatCu = kq.capNhat;
        $("canh-bao-doc").innerHTML = kq.canh.length ? '<div class="bao vang"><b>Bảng trên Google Sheet có ô không hợp lệ</b> — trang đã tạm thay bằng giá trị an toàn, bấm Lưu để sửa lại:<br>⚠ ' + kq.canh.map(esc).join("<br>⚠ ") + "</div>" : "";
        $("dang-tai").hidden = true; $("noi-dung").hidden = false;
        $("nut-md").disabled = false;
        veHet();
      })
      .catch((e) => {
        console.warn("[SapXepDon] Không đọc được bảng điều khiển:", e);
        const ly = e && e.message === "khong_tab" ? "Chưa có tab bảng điều khiển trên Google Sheet." : e && e.message === "sai_bo_cuc" ? "Bảng điều khiển trên Google Sheet bị sửa mất dòng tiêu đề (TIEU_CHI / DANH_SACH_UU_TIEN / COI_NHU_KHONG_VI_TRI)." : "Không kết nối được Google Sheet (mất mạng?).";
        $("dang-tai").hidden = true;
        $("loi-tai").hidden = false;
        $("loi-tai").innerHTML = '<div class="bao do"><b>Không đọc được bảng điều khiển.</b> ' + ly + ' <button class="nut nut-nho" id="nut-tai-lai">↻ Thử lại</button></div>';
        $("chip").className = "chip doi"; $("chip").textContent = "Chưa đọc được bảng";
      });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VẼ
  // ─────────────────────────────────────────────────────────────────────────
  const giongTang = (a, b) => a.every((t, i) => t.c === b[i].c && (!t.c || (t.ch === b[i].ch && (!coCachSo(t.c) || t.cs === b[i].cs) && (t.c !== "mon_thu_n" || String(t.n) === String(b[i].n)))));
  const cachCua = (tg) => CACH.find((c) => c.tang && giongTang(tg, c.tang)) || CACH[CACH.length - 1];
  const dungDs = () => st.tang.some((t) => coCachSo(t.c) && t.cs === "theo_danh_sach_uu_tien");
  const utSach = () => st.ut.map(sach).filter(Boolean);
  const kvSach = () => st.kv.map(sach).filter(Boolean);

  function moTaTang(t) {
    const cc = CAN_CU[t.c];
    let s = "<b>" + cc[0] + (t.c === "mon_thu_n" ? " (N = " + esc(t.n || "?") + ")" : "") + "</b> — " + chieuChu(t.c, t.ch);
    if (coCachSo(t.c)) s += t.cs === "theo_danh_sach_uu_tien" ? ", theo thứ tự <b>danh sách khu ưu tiên</b> (khu không có trong danh sách xếp sau)" : t.cs === "chu" ? ", so <b>từng chữ</b> (A3-13 trước A3-9)" : ", so <b>số tự nhiên</b> (A3-9 trước A3-13)";
    return s;
  }
  function veTomTat() {
    const ds = [];
    if (st.dungMd) ds.push("<b>Đang tạm dùng BỘ MẶC ĐỊNH</b> (cài đặt bên dưới bị bỏ qua): xếp theo món đầu tiên có vị trí kho, từ A đến Z.");
    const tg = st.dungMd ? MAC_DINH.tang : st.tang;
    tg.filter((t) => t.c).forEach((t, i) => ds.push((i ? "Nếu vẫn bằng nhau, xếp tiếp theo " : "Xếp theo ") + moTaTang(t) + "."));
    ds.push("Các đơn bằng nhau hoàn toàn: đứng liền nhau, giữ đúng thứ tự như lúc dán vào Bảng 3.");
    ds.push("Đơn chưa có vị trí kho: xếp <b>" + ((st.dungMd ? "cuoi" : st.kvt) === "cuoi" ? "xuống CUỐI xấp" : "lên ĐẦU xấp") + "</b>.");
    if (!st.dungMd && dungDs() && !utSach().length) ds.push('<span style="color:var(--canh-bao)">⚠ Đang chọn theo danh sách khu ưu tiên nhưng danh sách trống → không có tác dụng, kết quả như xếp số tự nhiên.</span>');
    $("tom-tat").innerHTML = ds.map((x) => "<li>" + x + "</li>").join("");
  }
  function veCach() {
    const dc = cachCua(st.tang).id;
    $("cach-sap").innerHTML = CACH.map((c) => '<label class="the' + (c.id === dc ? " chon" : "") + '"><input type="radio" name="cach" value="' + c.id + '"' + (c.id === dc ? " checked" : "") + " />" +
      (c.goi ? '<span class="goi">' + c.goi + "</span>" : "") + "<b>" + c.ten + '</b><span class="khi">Phù hợp khi: ' + c.khi + '</span><span class="vd">Ví dụ: ' + esc(c.vd) + "</span></label>").join("");
  }
  function veRadio(id, ds, v, ten) {
    $(id).innerHTML = ds.map((o) => '<label class="the' + (o[0] === v ? " chon" : "") + '"><input type="radio" name="' + ten + '" value="' + o[0] + '"' + (o[0] === v ? " checked" : "") + " /><b>" + o[1] + '</b><span class="khi">' + o[2] + "</span></label>").join("");
  }
  const opt = (ds, v) => ds.map((o) => '<option value="' + o[0] + '"' + (o[0] === v ? " selected" : "") + ">" + o[1] + "</option>").join("");
  function veTang() {
    const dsCc = Object.keys(CAN_CU).map((k) => [k, CAN_CU[k][0]]);
    $("cac-tang").innerHTML = st.tang.map((t, i) => {
      const cc = t.c && CAN_CU[t.c];
      return '<div class="tang' + (t.c ? "" : " tat") + '"><h3>' + (i ? "Tầng " + (i + 1) + " — dùng khi tầng " + i + " bằng nhau" : "Tầng 1 — quy tắc chính") + '</h3><div class="o">' +
        '<div><label>Căn cứ để xếp</label><select data-i="' + i + '" data-k="c">' + (i ? '<option value="">— Không dùng tầng này —</option>' : "") + opt(dsCc, t.c) + "</select></div>" +
        (t.c === "mon_thu_n" ? '<div><label>Dòng thứ mấy (N)</label><input type="number" min="1" step="1" data-i="' + i + '" data-k="n" value="' + esc(t.n) + '" placeholder="vd 2" /></div>' : "") +
        (t.c ? '<div><label>Chiều</label><select data-i="' + i + '" data-k="ch">' + opt(CHIEU_TEN(t.c), t.ch) + "</select></div>" : "") +
        (coCachSo(t.c) ? '<div><label>Cách so</label><select data-i="' + i + '" data-k="cs">' + opt(Object.keys(CACH_SO).map((k) => [k, CACH_SO[k][0]]), t.cs) + "</select></div>" : "") +
        "</div>" + (t.c ? '<div class="nghia"><b>Nghĩa là:</b> ' + cc[2] + (coCachSo(t.c) ? " <b>Cách so:</b> " + CACH_SO[t.cs][1] : "") + "</div>" : "") + "</div>";
    }).join("");
  }
  function canhUt() {
    const ds = st.ut.map((v) => sach(v).toUpperCase()), kq = {};
    ds.forEach((v, j) => { for (let i = 0; i < j; i++) if (ds[i] && v && v.indexOf(ds[i]) === 0 && v !== ds[i]) { kq[j] = "Dòng " + (j + 1) + ' "' + esc(st.ut[j]) + '" sẽ KHÔNG BAO GIỜ được dùng vì dòng ' + (i + 1) + ' "' + esc(st.ut[i]) + '" ở trên đã khớp trước. Bấm ↑ đưa dòng ' + (j + 1) + " lên trên dòng " + (i + 1) + "."; break; } });
    ds.forEach((v, j) => { if (v && ds.indexOf(v) !== j) kq[j] = "Dòng " + (j + 1) + " trùng với dòng " + (ds.indexOf(v) + 1) + "."; });
    return kq;
  }
  function veCanhUt() {
    const c = canhUt();
    document.querySelectorAll("#ds-ut .ds-dong").forEach((d, i) => d.classList.toggle("canh", !!c[i]));
    const m = Object.keys(c).map((i) => c[i]);
    $("bao-ut").innerHTML = m.length ? '<div class="bao vang">⚠ ' + m.join("<br>⚠ ") + "</div>" : "";
  }
  function veDs(k) {
    const ds = st[k];
    $("ds-" + k).innerHTML = ds.length ? ds.map((v, i) => '<div class="ds-dong"><span class="stt">' + (i + 1) + '</span><input type="text" maxlength="100" data-ds="' + k + '" data-i="' + i + '" value="' + esc(v) + '" />' +
      '<span class="nhom-nut"><button class="nut nut-nho" data-len="' + k + '" data-i="' + i + '" title="Đưa lên"' + (i ? "" : " disabled") + '>↑</button><button class="nut nut-nho" data-xuong="' + k + '" data-i="' + i + '" title="Đưa xuống"' + (i < ds.length - 1 ? "" : " disabled") + '>↓</button><button class="nut nut-nho" data-xoa="' + k + '" data-i="' + i + '" title="Xóa dòng">✕</button></span></div>').join("")
      : '<div class="ds-trong">Danh sách đang trống.</div>';
    if (k === "ut") veCanhUt();
  }
  // Những gì sẽ đổi so với bản đang dùng (bằng lời)
  function dsDoi() {
    const d = [], a = dangDung, b = st;
    if (!giongTang(a.tang, b.tang)) d.push("Cách sắp: <b>" + cachCua(a.tang).ten + "</b> → <b>" + cachCua(b.tang).ten + "</b>" + (cachCua(b.tang).id === "tu_chinh" || cachCua(a.tang).id === cachCua(b.tang).id ? " (đổi chi tiết ở phần nâng cao)" : ""));
    if (a.kvt !== b.kvt) d.push("Đơn chưa có vị trí: " + (a.kvt === "cuoi" ? "cuối xấp" : "đầu xấp") + " → <b>" + (b.kvt === "cuoi" ? "cuối xấp" : "đầu xấp") + "</b>");
    if (a.nhieu !== b.nhieu) d.push("Ô vị trí ghi nhiều chỗ: <b>" + (b.nhieu === "lay_phan_dau" ? "chỉ lấy phần trước dấu phẩy" : "giữ nguyên cả ô") + "</b>");
    if (JSON.stringify(a.ut) !== JSON.stringify(utSach())) d.push("Danh sách khu ưu tiên: " + a.ut.length + " dòng → <b>" + utSach().length + " dòng</b>" + (a.ut.length === utSach().length ? " (sửa chữ / đổi thứ tự)" : ""));
    if (JSON.stringify(a.kv) !== JSON.stringify(kvSach())) d.push("Chữ coi như không có vị trí: <b>" + esc(kvSach().join(", ") || "(trống)") + "</b>");
    if (a.dungMd !== b.dungMd) d.push(b.dungMd ? "<b>Bật</b> tạm dùng bộ mặc định" : "<b>Tắt</b> tạm dùng bộ mặc định");
    return d;
  }
  function dsLoi() {
    const l = [];
    st.tang.forEach((t, i) => { if (t.c === "mon_thu_n" && (!/^\d+$/.test(sach(t.n)) || +t.n < 1 || +t.n > 999)) l.push("Tầng " + (i + 1) + ": chọn \"Món ở dòng thứ N\" nhưng chưa ghi N (số từ 1 trở lên) — mở Cài đặt nâng cao để ghi."); });
    if (cachCua(st.tang).id === "khu_uu_tien" && !utSach().length) l.push("Đã chọn \"Theo thứ tự khu tôi tự đặt\" nhưng danh sách khu ưu tiên (bước 3) còn trống — thêm ít nhất 1 dòng.");
    if (utSach().concat(kvSach()).some((v) => /^=/.test(v))) l.push("Không được ghi dòng bắt đầu bằng dấu \"=\".");
    return l;
  }
  function veLuu() {
    const d = dsDoi(), l = dsLoi();
    $("doi").innerHTML = (l.length ? '<div class="bao do">✕ ' + l.join("<br>✕ ") + "</div>" : "") +
      (d.length ? '<div class="bao vang"><b>Sẽ thay đổi ' + d.length + ' chỗ so với bản đang dùng:</b><ul class="doi-ds"><li>' + d.join("</li><li>") + "</li></ul></div>" : '<div class="bao xanh">Chưa thay đổi gì so với bản đang dùng.</div>');
    const khoa = dangLuu || !!l.length || !d.length;
    $("nut-luu").disabled = $("nut-luu-tren").disabled = khoa;
    $("nut-luu").textContent = dangLuu ? "Đang lưu…" : choGhiDe ? "Vẫn lưu đè" : "Lưu & áp dụng";
    $("chip").className = "chip" + (d.length ? " doi" : "");
    $("chip").textContent = d.length ? "Có " + d.length + " thay đổi CHƯA LƯU" : "Đang dùng bản lưu lúc " + (capNhatCu.split(" · ")[0] || "?");
    if (!d.length) choGhiDe = false;
  }
  function veHet() {
    veTomTat(); veCach();
    veRadio("kvt", [["cuoi", "⬇ Xếp xuống CUỐI xấp", "Lấy hết đơn có vị trí trước, đơn chưa có vị trí để cuối cùng (phải đi tìm hàng)."], ["dau", "⬆ Xếp lên ĐẦU xấp", "Xử lý đơn chưa có vị trí trước tiên (vd để người quen kho tìm hàng ngay từ đầu ca)."]], st.kvt, "kvt");
    veRadio("nhieu", [["lay_phan_dau", "Chỉ lấy phần trước dấu phẩy", "\"KHU D, PALLET 3\" → dùng \"KHU D\" để xếp."], ["giu_nguyen", "Giữ nguyên cả ô", "Dùng nguyên chữ \"KHU D, PALLET 3\" để xếp."]], st.nhieu, "nhieu");
    const can = dungDs();
    $("muc-ut").hidden = !can && !st.ut.length;
    $("ut-mo-ta").innerHTML = can ? "Cách sắp đang chọn dùng danh sách này. Ghi các khu theo đúng thứ tự người lấy hàng đi qua." : "Cách sắp đang chọn KHÔNG dùng danh sách này (danh sách vẫn được giữ lại cho lần sau).";
    veTang(); veDs("ut"); veDs("kv"); veLuu();
    $("dung-md").checked = st.dungMd;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LƯU (qua Apps Script — KHÔNG gửi công tắc khẩn cấp)
  // ─────────────────────────────────────────────────────────────────────────
  function baoLuu(chu, loai) { $("bao-luu").innerHTML = chu ? '<div class="bao ' + (loai || "do") + '">' + chu + "</div>" : ""; }
  async function luu() {
    if (dangLuu || dsLoi().length || !dsDoi().length) return;
    if (!URL_LUU) { baoLuu("Chưa cài địa chỉ lưu: Apps Script \"Sap Xep Don ZZM\" chưa được triển khai thành ứng dụng web (báo người quản trị)."); return; }
    const mk = $("mk").value;
    if (!mk) { baoLuu("Nhập mật khẩu admin để lưu."); $("mk").focus(); return; }
    const nguoi = sach($("nguoi").value);
    if (!nguoi) { baoLuu("Nhập tên người lưu."); $("nguoi").focus(); return; }
    const caiDat = {
      kvt: st.kvt, nhieu: st.nhieu, dungMd: !!st.dungMd,
      tieuChi: st.tang.map((t) => (t.c ? [t.c, t.c === "mon_thu_n" ? Number(t.n) : "", t.ch, coCachSo(t.c) ? t.cs : t.c === "san" ? "chu" : "so_tu_nhien"] : ["", "", "", ""])),
      uuTien: utSach(), khongViTri: kvSach(),
    };
    dangLuu = true; baoLuu("Đang lưu lên Google Sheet…", "vang"); veLuu();
    const huy = new AbortController(), hen = setTimeout(() => huy.abort(), 45000);
    try {
      const r = await fetch(URL_LUU, { method: "POST", body: JSON.stringify({ hanh_dong: "luu_cai_dat", mat_khau: mk, nguoi: nguoi, cap_nhat_cu: capNhatCu, ghi_de: choGhiDe, cai_dat: caiDat }), signal: huy.signal });
      if (!r.ok) throw new Error("Mã lỗi " + r.status);
      const kq = await r.json();
      if (kq.ok) {
        $("mk").value = ""; choGhiDe = false; dangLuu = false;
        await taiBang();
        baoLuu("✓ Đã lưu lúc " + esc((kq.cap_nhat || "").split(" · ")[0]) + ". Các máy đang mở trang Vận Hành bấm <b>F5</b> để nhận cách sắp mới.", "xanh");
        return;
      }
      if (kq.xung_dot) { choGhiDe = true; baoLuu("⚠ " + esc(kq.loi) + ' Nếu chắc chắn bản trên trang này đúng, bấm <b>"Vẫn lưu đè"</b>; nếu không, <button class="nut nut-nho" id="nut-tai-lai-luu">↻ Tải lại bản mới</button> (thay đổi trên trang sẽ mất).', "vang"); }
      else baoLuu("Không lưu được: " + esc(kq.loi || "lỗi không rõ"));
    } catch (e) {
      console.warn("[SapXepDon] Lưu lỗi:", e);
      baoLuu(e && e.name === "AbortError" ? "Lưu quá lâu không phản hồi — kiểm tra mạng rồi thử lại (có thể đã lưu: bấm F5 để xem)." : "Không kết nối được tới nơi lưu — kiểm tra mạng rồi thử lại.");
    } finally { clearTimeout(hen); dangLuu = false; if (st) veLuu(); }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SỰ KIỆN
  // ─────────────────────────────────────────────────────────────────────────
  document.addEventListener("change", (e) => {
    const el = e.target;
    if (!st) return;
    if (el.name === "cach") {
      const c = CACH.find((x) => x.id === el.value);
      if (c.tang) st.tang = sao(c.tang); else { $("nang-cao").open = true; }
      veHet();
      if (!c.tang) $("nang-cao").scrollIntoView({ behavior: "smooth" });
      if (c.id === "khu_uu_tien") $("muc-ut").scrollIntoView({ behavior: "smooth" });
    } else if (el.name === "kvt") { st.kvt = el.value; veHet(); }
    else if (el.name === "nhieu") { st.nhieu = el.value; veHet(); }
    else if (el.dataset.k && el.dataset.k !== "n") {
      const t = st.tang[+el.dataset.i];
      t[el.dataset.k] = el.value;
      if (el.dataset.k === "c") { if (!t.c) Object.assign(t, sao(TRONG)); else if (!coCachSo(t.c)) t.cs = t.c === "san" ? "chu" : "so_tu_nhien"; if (t.c !== "mon_thu_n") t.n = ""; }
      veHet();
    } else if (el.id === "dung-md") { st.dungMd = el.checked; veHet(); }
  });
  document.addEventListener("input", (e) => {
    const el = e.target;
    if (!st) return;
    if (el.dataset.ds) { st[el.dataset.ds][+el.dataset.i] = el.value; if (el.dataset.ds === "ut") veCanhUt(); veTomTat(); veLuu(); }
    if (el.dataset.k === "n") { st.tang[+el.dataset.i].n = el.value; veTomTat(); veCach(); veLuu(); }
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.id === "nut-tai-lai") { taiBang(); return; }
    if (b.id === "nut-tai-lai-luu") { choGhiDe = false; baoLuu(""); taiBang(); return; }
    if (!st) return;
    const d = b.dataset, i = +d.i;
    if (d.them) {
      const o = $("them-" + d.them);
      o.value.split(/\r?\n|;/).map(sach).filter(Boolean).forEach((v) => st[d.them].push(d.them === "ut" ? v.toUpperCase() : v));
      o.value = ""; veHet(); o.focus();
    } else if (d.xoa) { st[d.xoa].splice(i, 1); veHet(); }
    else if (d.len) { const a = st[d.len]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; veHet(); }
    else if (d.xuong) { const a = st[d.xuong]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; veHet(); }
    else if (b.id === "nut-md") {
      if (confirm("Đưa các cài đặt về mặc định (Theo đường đi trong kho)?\nDanh sách khu ưu tiên được GIỮ NGUYÊN.\n(Chưa lưu cho tới khi bấm \"Lưu & áp dụng\".)")) { const ut = st.ut; st = Object.assign(sao(MAC_DINH), { ut: ut }); veHet(); }
    } else if (b.id === "nut-luu-tren") { $("khu-luu").scrollIntoView({ behavior: "smooth" }); ($("nguoi").value ? $("mk") : $("nguoi")).focus(); }
    else if (b.id === "nut-luu") luu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || !e.target.id) return;
    if (e.target.id.indexOf("them-") === 0) { e.preventDefault(); document.querySelector('[data-them="' + e.target.id.slice(5) + '"]').click(); }
    else if (e.target.id === "mk") { e.preventDefault(); luu(); }
  });
  // Còn thay đổi chưa lưu mà rời trang → hỏi lại
  window.addEventListener("beforeunload", (e) => { if (st && dangDung && dsDoi().length) { e.preventDefault(); e.returnValue = ""; } });

  try { $("nguoi").value = localStorage.getItem(KHOA_TEN_NGUOI) || ""; } catch (e) { /* bỏ qua */ }
  // Cho bài kiểm thử
  window.__SapXepDonTrang = { docBang: docBang, layTrangThai: () => ({ st: st, dangDung: dangDung, capNhatCu: capNhatCu }) };
  taiBang();
})();
