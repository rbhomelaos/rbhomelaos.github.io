/* RB HOME LAOS – bộ máy tính dự toán (thuần logic, không phụ thuộc giao diện) */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RBEstimate = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const r2 = (x) => Math.round(x * 100) / 100;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

  /**
   * @param {object} input
   *  width, length            – kích thước đất (m)            [bắt buộc]
   *  floors                   – số tầng (1–4)                  [mặc định 2]
   *  pkg                      – basic | quality | premium      [mặc định quality]
   *  front, rear, sides       – khoảng lùi (m)                 [tự tính]
   *  houseWidth, houseLength  – kích thước nhà (m)             [tự tính]
   *  bedrooms, wc             – số phòng ngủ / WC               [tự tính]
   *  extras: { fence, gate, yard, drainage, garden:boolean, carportArea, fillHeight }
   * @param {object} cfg  window.RB_ESTIMATE_CONFIG
   */
  function compute(input, cfg) {
    const g = cfg.geometry;
    const W = num(input.width, 0), L = num(input.length, 0);
    if (!(W > 0 && L > 0)) throw new Error("INVALID_LAND");
    if (W > 200 || L > 200) throw new Error("LAND_TOO_LARGE");

    const floors = clamp(Math.round(num(input.floors, 2)), 1, 4);
    const pkg = cfg.packages[input.pkg] ? input.pkg : "quality";
    const land = W * L;

    // 1) Kích thước nhà (footprint)
    const sb = g.setbacks(W, L);
    const sides = num(input.sides, sb.sides), front = num(input.front, sb.front), rear = num(input.rear, sb.rear);
    let hw = num(input.houseWidth, NaN), hl = num(input.houseLength, NaN);
    if (!(hw > 0)) hw = Math.max(3, W - sides);
    if (!(hl > 0)) hl = Math.max(4, L - front - rear);
    hw = Math.min(hw, W); hl = Math.min(hl, L);
    let footprint = hw * hl;
    let capped = false;
    if (footprint > land * g.maxCoverage && !(input.houseWidth > 0 && input.houseLength > 0)) {
      const s = Math.sqrt((land * g.maxCoverage) / footprint);
      hw *= s; hl *= s; footprint = hw * hl; capped = true;
    }
    hw = r2(hw); hl = r2(hl); footprint = r2(hw * hl);

    // 2) Diện tích sàn & công năng
    const floorArea = r2(footprint * floors);
    const bedrooms = clamp(Math.round(num(input.bedrooms, NaN) || clamp(Math.round(floorArea / g.m2PerBedroom), 1, 6)), 1, 10);
    const wc = clamp(Math.round(num(input.wc, NaN) || bedrooms + (floors > 1 ? g.extraWC : 0)), 1, 12);

    // 3) Diện tích xây dựng quy đổi
    const cv = cfg.conversion;
    const fType = cv.foundation[input.foundation] != null ? input.foundation : cv.baseline.foundation;
    const rType = cv.roof[input.roof] != null ? input.roof : cv.baseline.roof;
    const tumArea = input.tum ? Math.min(num(input.tumArea, cv.tumArea), footprint) : 0;
    const conv = [
      { id: "foundation", type: fType, area: footprint, coef: cv.foundation[fType] },
      ...Array.from({ length: floors }, (_, i) => ({ id: "floor", n: i + 1, area: footprint, coef: cv.floor })),
      ...(tumArea > 0 ? [{ id: "tum", area: tumArea, coef: cv.tum }] : []),
      { id: "roof", type: rType, area: footprint, coef: cv.roof[rType] }
    ].map((x) => ({ ...x, converted: r2(x.area * x.coef) }));
    const convArea = r2(conv.reduce((s, x) => s + x.area * x.coef, 0));
    // diện tích quy đổi của phương án chuẩn (móng đơn + mái BTCT, không tum)
    const baseConv = footprint * (cv.foundation[cv.baseline.foundation] + floors * cv.floor + cv.roof[cv.baseline.roof]);

    // 4) Đơn giá: giá RB HOME / m² sàn → quy ra đơn giá / m² quy đổi
    const rate = cfg.packages[pkg].rate + num(cfg.floorRateAdjust[floors], 0);   // USD / m² sàn (chuẩn)
    const convRateExact = (rate * floorArea) / baseConv;
    const convRate = r2(convRateExact);                           // USD / m² quy đổi
    const official = convArea * convRateExact;
    const effRate = r2(official / floorArea);                                     // USD / m² sàn thực tế

    // Cơ sở khối lượng
    const base = {
      floorArea,
      convArea,
      footprint,
      roofArea: footprint * 1.05,
      wc,
      stairs: Math.max(0, floors - 1) + (tumArea > 0 ? 1 : 0),
      doors: bedrooms + wc + 1,
      balconyGlass: (floors - 1) * hw * g.balconyRatio * g.balconyGlassHeight,
      one: 1
    };

    // 5) Chia chi phí: khối lượng × đơn giá tham chiếu, nhân hệ số k để khớp tổng (sau dự phòng)
    const ff = cfg.finishFactor[pkg];
    const cont = num(cfg.contingency, 0);
    const raw = cfg.items.map((it) => {
      const qty = num(base[it.base], 0) * num(it.factor, 1);
      const unitRef = it.ref * (it.group === "finish" ? ff : 1);
      return { id: it.id, group: it.group, unit: it.unit, qty, unitRef, rawAmt: qty * unitRef };
    }).filter((x) => x.qty > 0 && x.unitRef > 0);
    const rawTotal = raw.reduce((s, x) => s + x.rawAmt, 0);
    const houseTotal = Math.round(official);
    const contingencyAmt = Math.round(houseTotal - houseTotal / (1 + cont));
    const k = (houseTotal - contingencyAmt) / rawTotal;
    const items = raw.map((x) => ({
      id: x.id, group: x.group, unit: x.unit,
      qty: r2(x.qty), unitPrice: Math.round(x.unitRef * k * 100) / 100,
      amount: Math.round(x.rawAmt * k)
    }));
    // làm tròn: dồn chênh lệch vào hạng mục lớn nhất để tổng khớp tuyệt đối
    const diff = houseTotal - contingencyAmt - items.reduce((s, x) => s + x.amount, 0);
    if (diff) { const big = items.reduce((a, b) => (b.amount > a.amount ? b : a)); big.amount += diff; }

    // 6) Hạng mục ngoài nhà (tùy chọn, giá thực)
    const e = cfg.extras, ex = input.extras || {};
    const open = Math.max(0, land - footprint);
    const extras = [];
    const add = (id, qty, unit, price) => { if (qty > 0) extras.push({ id, unit, qty: r2(qty), unitPrice: r2(price), amount: Math.round(qty * price) }); };
    if (ex.fence)    add("fence", Math.max(0, 2 * (W + L) - e.gateWidth), e.fence.unit, e.fence.price);
    if (ex.gate)     add("gate", 1, e.gate.unit, e.gate.price);
    const carport = num(ex.carportArea, 0);
    if (carport > 0) add("carport", carport, e.carport.unit, e.carport.price);
    if (ex.yard)     add("yard", open * (ex.garden ? 1 - e.gardenRatio : 1), e.yard.unit, e.yard.price);
    if (ex.garden)   add("garden", open * e.gardenRatio, e.garden.unit, e.garden.price);
    if (ex.drainage) add("drainage", 1, e.drainage.unit, e.drainage.price);
    const fill = num(ex.fillHeight, 0);
    if (fill > 0)    add("landfill", land * fill, e.landfill.unit, e.landfill.price);
    const extrasTotal = extras.reduce((s, x) => s + x.amount, 0);

    const total = houseTotal + extrasTotal;
    const dur = cfg.duration(floorArea);
    const payments = cfg.payments.map((p) => ({ pct: p, amount: Math.round((total * p) / 100) }));

    return {
      input: { W, L, floors, pkg, foundation: fType, roof: rType, tum: tumArea > 0 },
      conv, convArea, convRate, effRate,
      land: r2(land), house: { width: hw, length: hl, footprint, floorArea, capped, sides, front, rear },
      rooms: { bedrooms, wc, stairs: base.stairs },
      coverage: r2((footprint / land) * 100),
      rate, k: r2(k),
      items, contingency: contingencyAmt, contingencyPct: cont * 100, houseTotal,
      roughTotal: items.filter((x) => x.group === "rough").reduce((s, x) => s + x.amount, 0),
      finishTotal: items.filter((x) => x.group === "finish").reduce((s, x) => s + x.amount, 0),
      extras, extrasTotal, total,
      totalKip: Math.round(total * cfg.kipPerUsd),
      duration: dur, payments
    };
  }

  return { compute };
});
