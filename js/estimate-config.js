/* =====================================================================
 * RB HOME LAOS – CẤU HÌNH DỰ TOÁN (chỉ cần sửa số liệu ở file này)
 * ---------------------------------------------------------------------
 *  • Giá chính thức theo m² sàn xây dựng (đã gồm thiết kế):  packages
 *  • Đơn giá tham chiếu từng hạng mục (VND, theo file dự toán tự động) để CHIA chi phí:  items
 *    → Tổng tiền luôn = m² sàn × đơn giá gói; các đơn giá hạng mục
 *      được tự động nhân hệ số để khớp đúng tổng đó.
 *  • Hạng mục ngoài nhà (hàng rào, sân, cổng...) tính riêng: extras
 *    → các đơn giá này dùng NGUYÊN GIÁ, không nhân hệ số.
 *  Sửa xong chỉ cần tải file lên GitHub (thư mục js/) là web cập nhật.
 * ===================================================================== */
window.RB_ESTIMATE_CONFIG = {
  version: "2026-11",
  currency: "USD",
  kipPerUsd: 22000,               // Tỷ giá quy đổi (KIP / 1 USD)

  // Giá trọn gói theo m² sàn (USD/m²) – nguồn: bảng "3 gói thi công" RB HOME
  packages: {
    basic:   { rate: 450 },       // Cơ bản
    quality: { rate: 500 },       // Chất lượng (khuyên dùng)
    premium: { rate: 650 }        // Cao cấp
  },
  // Điều chỉnh đơn giá theo số tầng (USD/m² sàn). Nhà 1 tầng: 400 USD/m² cho gói Cơ bản.
  floorRateAdjust: { 1: -50, 2: 0, 3: 0, 4: 20 },

  /* DIỆN TÍCH XÂY DỰNG QUY ĐỔI (theo cách tính phổ biến của các nhà thầu Việt Nam)
   *  Tổng = Σ (diện tích × hệ số). Hệ số tính trên diện tích sàn tầng 1 (móng, mái).
   *  baseline = phương án chuẩn dùng để quy ra đơn giá/m² quy đổi sao cho
   *  nhà "móng đơn + mái BTCT" ra ĐÚNG giá báo RB HOME (USD/m² sàn × m² sàn).
   *  Chọn móng/mái khác chuẩn → giá tăng/giảm theo đúng tỷ lệ hệ số.            */
  conversion: {
    foundation: { single: 0.30, strip: 0.60, pile: 0.40, raft: 0.80 },   // đơn | băng | cọc (chưa gồm ép cọc) | bè
    roof: { rc: 0.50, rcTile: 1.00, steelTile: 0.70, metal: 0.30 },      // BTCT | ngói trên sàn BTCT | ngói kèo thép | tôn
    floor: 1.00,                  // mỗi tầng 100%
    tum: 1.00,                    // tum thang / phòng trên sân thượng 100%
    tumArea: 20,                  // diện tích tum mặc định (m²)
    baseline: { foundation: "single", roof: "rc" }
  },

  // Hệ số vật tư hoàn thiện theo gói (phần thô giống nhau ở cả 3 gói)
  finishFactor: { basic: 0.75, quality: 1.0, premium: 1.9 },

  // Kích thước mặc định
  geometry: {
    floorHeight: 3.6,             // chiều cao tầng (m)
    // Khoảng lùi mặc định theo kích thước đất (m) – có thể sửa trực tiếp trên web
    setbacks(width, length) {
      const sides = width >= 14 ? 2 : width >= 9 ? 1 : 0;
      const front = length >= 20 ? 6 : length >= 14 ? 4 : 2;
      const rear  = length >= 20 ? 2 : length >= 14 ? 1.5 : 1;
      return { sides, front, rear };
    },
    maxCoverage: 0.8,             // mật độ xây dựng tối đa (80% diện tích đất)
    extraWC: 1,                   // nhà ≥2 tầng: WC = phòng ngủ + 1 (WC chung)
    m2PerBedroom: 55,             // 1 phòng ngủ cho mỗi ~55 m² sàn (tối đa 6 nếu tự động)
    balconyRatio: 0.6,            // dài ban công = 0.6 × chiều rộng nhà, mỗi tầng trên
    balconyGlassHeight: 1.1       // chiều cao kính lan can ban công (m)
  },

  /* Hạng mục trong nhà – theo file "RB_HOME_LAOS_DU_TOAN_TU_DONG_THEO_DIEN_TICH.xlsx"
   *  base   : cơ sở tính khối lượng
   *           floorArea = tổng m² sàn | convArea = diện tích quy đổi (móng + tầng + mái + tum)
   *           footprint = m² sàn tầng 1 | roofArea | wc | stairs | doors | balconyGlass
   *  factor : hệ số khối lượng (sheet 05_HE_SO_TAM_TINH)
   *  ref    : đơn giá tham chiếu (VND – sheet 03_DON_GIA); dùng để CHIA tỷ trọng chi phí
   *  group  : rough = phần thô (giống nhau 3 gói) | finish = hoàn thiện (× finishFactor) */
  contingency: 0.05,              // dự phòng phát sinh 5% (đã nằm trong đơn giá gói)
  items: [
    { id: "design",      group: "rough",  unit: "m2",  base: "floorArea",   factor: 1,    ref: 210000 },
    { id: "labour",      group: "rough",  unit: "m2",  base: "convArea",    factor: 1,    ref: 1510320 },
    { id: "concrete",    group: "rough",  unit: "m3",  base: "floorArea",   factor: 0.28, ref: 1516494 },
    { id: "steel",       group: "rough",  unit: "kg",  base: "floorArea",   factor: 38,   ref: 17813 },
    { id: "bricks",      group: "rough",  unit: "pcs", base: "floorArea",   factor: 95,   ref: 1673 },
    { id: "aggregate",   group: "rough",  unit: "m3",  base: "floorArea",   factor: 0.18, ref: 674250 },
    { id: "wpWc",        group: "rough",  unit: "m2",  base: "wc",          factor: 5,    ref: 350000 },
    { id: "wpRoof",      group: "rough",  unit: "m2",  base: "roofArea",    factor: 1,    ref: 300000 },
    { id: "mep",         group: "rough",  unit: "m2",  base: "floorArea",   factor: 1,    ref: 800110 },
    { id: "paintOut",    group: "finish", unit: "m2",  base: "floorArea",   factor: 0.85, ref: 88102 },
    { id: "paintIn",     group: "finish", unit: "m2",  base: "floorArea",   factor: 2.2,  ref: 80011 },
    { id: "floorTile",   group: "finish", unit: "m2",  base: "floorArea",   factor: 0.95, ref: 350000 },
    { id: "wcTile",      group: "finish", unit: "m2",  base: "wc",          factor: 20,   ref: 350000 },
    { id: "windows",     group: "finish", unit: "m2",  base: "floorArea",   factor: 0.2,  ref: 1977800 },
    { id: "balconyGlass",group: "finish", unit: "m2",  base: "balconyGlass",factor: 1,    ref: 1258600 },
    { id: "railing",     group: "finish", unit: "md",  base: "stairs",      factor: 8,    ref: 1348500 },
    { id: "ceilingWc",   group: "finish", unit: "m2",  base: "wc",          factor: 4,    ref: 300000 },
    { id: "ceiling",     group: "finish", unit: "m2",  base: "floorArea",   factor: 0.7,  ref: 280000 },
    { id: "lobbyStone",  group: "finish", unit: "m2",  base: "floorArea",   factor: 0,    ref: 1123750 },
    { id: "doors",       group: "finish", unit: "set", base: "doors",       factor: 1,    ref: 4500000 },
    { id: "sanitary",    group: "finish", unit: "room",base: "wc",          factor: 1,    ref: 10906980 },
    { id: "electric",    group: "finish", unit: "m2",  base: "floorArea",   factor: 1,    ref: 350000 },
    { id: "elevator",    group: "finish", unit: "set", base: "one",         factor: 0,    ref: 0 }
  ],

  // Hạng mục ngoài nhà – tùy chọn, giá thực tế (USD), KHÔNG nằm trong đơn giá m²
  extras: {
    fence:    { unit: "md",  price: 120 },   // hàng rào xây + sơn
    gate:     { unit: "set", price: 2000 },  // cổng tự động (mô tơ + cổng)
    yard:     { unit: "m2",  price: 15 },    // sân bê tông
    drainage: { unit: "lot", price: 2450 },  // thoát nước + chiếu sáng ngoài nhà
    landfill: { unit: "m3",  price: 120000 / 22000 }, // san lấp: 120.000 KIP/m³
    carport:  { unit: "m2",  price: 47.5 },  // mái gara khung thép
    garden:   { unit: "m2",  price: 12 },    // cây xanh + bó vỉa
    gateWidth: 4.5,                          // chiều rộng cổng (m), trừ khỏi hàng rào
    gardenRatio: 0.25                        // 25% đất trống làm cây xanh, còn lại đổ sân
  },

  // Tiến độ thanh toán (%)
  payments: [25, 20, 20, 15, 10, 10],

  // Thời gian thi công (tháng) theo tổng m² sàn
  duration(totalFloor) {
    if (totalFloor <= 150) return [5, 6];
    if (totalFloor <= 300) return [6, 7];
    if (totalFloor <= 450) return [7, 8];
    return [8, 10];
  }
};
