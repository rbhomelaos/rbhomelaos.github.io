/* RB HOME LAOS – giao diện trang dự toán */
(function () {
  "use strict";
  const CFG = window.RB_ESTIMATE_CONFIG, T = window.EST_I18N, E = window.RBEstimate;
  const LANGS = ["lo", "en", "vi", "zh"];
  const $ = (id) => document.getElementById(id);
  const WA = "8562095813368";
  let lang = "lo", floors = 2, pkg = "quality", last = null;

  const fmt = (n, d = 0) => Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const usd = (n) => fmt(n) + " USD";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const t = (k) => T[lang][k];

  function pickLang() {
    const q = new URLSearchParams(location.search).get("lang");
    if (LANGS.includes(q)) return q;
    try { const s = localStorage.getItem("rb_lang"); if (LANGS.includes(s)) return s; } catch (e) {}
    const n = (navigator.language || "").slice(0, 2).toLowerCase();
    return LANGS.includes(n) ? n : "lo";
  }

  function renderPkgs() {
    $("pkgs").innerHTML = ["basic", "quality", "premium"].map((p) => {
      const rate = CFG.packages[p].rate + (CFG.floorRateAdjust[floors] || 0);
      return `<div class="pkg${p === pkg ? " on" : ""}" data-p="${p}" role="radio" aria-checked="${p === pkg}" tabindex="0">
        ${p === "quality" ? `<span class="tag">${esc(t("rec"))}</span>` : ""}
        <b>${esc(t(p))}</b><span class="pr">${rate} <small style="display:inline;font-size:.7rem">${esc(t("perm2"))}</small></span>
        <small>${esc(t("pkgDesc")[p])}</small></div>`;
    }).join("");
    $("pkgs").querySelectorAll(".pkg").forEach((el) => {
      const sel = () => { pkg = el.dataset.p; renderPkgs(); if (last) run(); };
      el.onclick = sel; el.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sel(); } };
    });
  }

  function applyLang(l) {
    lang = l; document.documentElement.lang = l; document.title = t("title");
    document.querySelectorAll("[data-t]").forEach((el) => { const v = t(el.dataset.t); if (typeof v === "string") el.textContent = v; });
    document.querySelectorAll("[data-th]").forEach((el) => { el.innerHTML = t(el.dataset.th); });
    document.querySelectorAll(".lang button").forEach((b) => b.classList.toggle("active", b.dataset.lang === l));
    ["hw", "hl", "br", "wc"].forEach((id) => ($(id).placeholder = t("auto")));
    const fill = (id, map) => { const cur = $(id).value; $(id).innerHTML = Object.keys(map).map((k) => `<option value="${k}">${esc(map[k])}</option>`).join(""); if (cur) $(id).value = cur; };
    fill("fd", t("fd")); fill("rf", t("rf"));
    try { localStorage.setItem("rb_lang", l); } catch (e) {}
    renderPkgs();
    if (last) render(last);
  }

  function readInput() {
    const v = (id) => { const x = $(id).value.trim(); return x === "" ? undefined : Number(x); };
    return {
      width: v("w"), length: v("l"), floors, pkg,
      foundation: $("fd").value, roof: $("rf").value, tum: $("tum").checked,
      houseWidth: v("hw"), houseLength: v("hl"), bedrooms: v("br"), wc: v("wc"),
      extras: {
        fence: $("xfence").checked, gate: $("xgate").checked, yard: $("xyard").checked,
        garden: $("xgarden").checked, drainage: $("xdrain").checked,
        carportArea: v("xcarport") || 0, fillHeight: v("xfill") || 0
      }
    };
  }

  function row(no, it) {
    const name = (t("items")[it.id] || it.id);
    const unit = (t("units")[it.unit] || it.unit);
    const dp = it.unitPrice < 10 ? 2 : 0;
    return `<tr><td>${no}</td><td>${esc(name)}</td><td>${esc(unit)}</td><td class="n">${fmt(it.qty, it.qty % 1 ? 2 : 0)}</td><td class="n">${fmt(it.unitPrice, dp)}</td><td class="n">${fmt(it.amount)}</td></tr>`;
  }

  function render(r) {
    const months = `${r.duration[0]}–${r.duration[1]} ${t("months")}`;
    const rough = r.items.filter((x) => x.group === "rough"), fin = r.items.filter((x) => x.group === "finish");
    let n = 0, html = "";
    html += `<tr class="grp"><td colspan="6">${esc(t("gRough"))}</td></tr>` + rough.map((x) => row(++n, x)).join("");
    html += `<tr class="sub"><td></td><td colspan="4">${esc(t("sub"))} A</td><td class="n">${fmt(r.roughTotal)}</td></tr>`;
    n = 0;
    html += `<tr class="grp"><td colspan="6">${esc(t("gFinish"))} – ${esc(t(r.input.pkg))}</td></tr>` + fin.map((x) => row(++n, x)).join("");
    html += `<tr class="sub"><td></td><td colspan="4">${esc(t("sub"))} B</td><td class="n">${fmt(r.finishTotal)}</td></tr>`;
    html += `<tr class="sub"><td></td><td colspan="4">${esc(t("cont"))} (${fmt(r.contingencyPct)}%)</td><td class="n">${fmt(r.contingency)}</td></tr>`;
    html += `<tr class="tot"><td></td><td colspan="4">${esc(t("houseT"))} = ${fmt(r.convArea, 2)} m² × ${fmt(r.convRate, 2)} USD/m²</td><td class="n">${fmt(r.houseTotal)}</td></tr>`;
    if (r.extras.length) {
      n = 0;
      html += `<tr class="grp"><td colspan="6">${esc(t("gExtra"))}</td></tr>` + r.extras.map((x) => row(++n, x)).join("");
      html += `<tr class="sub"><td></td><td colspan="4">${esc(t("sub"))} C</td><td class="n">${fmt(r.extrasTotal)}</td></tr>`;
    }
    html += `<tr class="tot"><td></td><td colspan="4">${esc(t("total"))}</td><td class="n">${fmt(r.total)}</td></tr>`;

    const convRows = r.conv.map((c) => {
      const name = c.id === "foundation" ? t("fd")[c.type] : c.id === "roof" ? t("rf")[c.type] : c.id === "tum" ? t("cvTum") : `${t("cvFloor")} ${c.n}`;
      return `<tr><td>${esc(name)}</td><td class="n">${fmt(c.area, 2)}</td><td class="n">${Math.round(c.coef * 100)}%</td><td class="n">${fmt(c.converted, 2)}</td></tr>`;
    }).join("");
    const pays = r.payments.map((p, i) => `<div class="pay"><span>${i + 1}. ${esc(t("pays")[i] || "")}</span><b>${p.pct}% · ${fmt(p.amount)}</b></div>`).join("");
    const today = new Date().toLocaleDateString(lang === "zh" ? "zh-CN" : lang === "vi" ? "vi-VN" : lang === "lo" ? "lo-LA" : "en-GB");

    $("result").innerHTML = `
      <div class="print-head"><img src="img/logo-gold.png" alt=""><div><b>RB HOME LAOS CO., LTD</b><br><small>Design • Build • Quality • Lifetime Care · rbhomelaos.github.io · WhatsApp +856 20 958 133 68</small></div></div>
      <div class="r-head"><div><span class="eyebrow" style="color:var(--gold-3)">RB HOME LAOS</span><h2>${esc(t("res"))}</h2></div>
        <small>${esc(t("date"))}: ${today} · ${fmt(r.input.W, 2)} × ${fmt(r.input.L, 2)} m · ${r.input.floors} ${esc(t("fl"))} · ${esc(t(r.input.pkg))}</small></div>
      <div class="total-box">
        <div><span>${esc(t("total"))}</span><div class="big gold-text">${usd(r.total)}</div><div class="kip">${esc(t("kip"))}: ${fmt(r.totalKip)} KIP</div></div>
        <div><span>${esc(t("houseT"))}</span><div class="mid">${usd(r.houseTotal)}</div><div class="kip">${esc(t("effRateL"))}: ${fmt(r.effRate)} USD/m²</div></div>
        <div><span>${esc(t("extT"))}</span><div class="mid">${usd(r.extrasTotal)}</div></div>
      </div>
      <div class="stats">
        <div class="stat"><span>${esc(t("land"))}</span><b>${fmt(r.land, 2)} m²</b></div>
        <div class="stat"><span>${esc(t("house"))}</span><b>${fmt(r.house.width, 2)} × ${fmt(r.house.length, 2)} m</b></div>
        <div class="stat"><span>${esc(t("floorArea"))}</span><b>${fmt(r.house.floorArea, 2)} m² · ${esc(t("cvConv"))} ${fmt(r.convArea, 2)}</b></div>
        <div class="stat"><span>${esc(t("cover"))}</span><b>${fmt(r.coverage, 1)}%</b></div>
        <div class="stat"><span>${esc(t("rooms"))}</span><b>${r.rooms.bedrooms} / ${r.rooms.wc}</b></div>
        <div class="stat"><span>${esc(t("time"))}</span><b>${months}</b></div>
      </div>
      <h4 style="font-size:.95rem;color:var(--navy);margin:0 0 10px">${esc(t("convT"))}</h4>
      <div class="tbl-wrap" style="margin-bottom:22px"><table>
        <thead><tr><th>${esc(t("cvPart"))}</th><th class="n">${esc(t("cvArea"))}</th><th class="n">${esc(t("cvCoef"))}</th><th class="n">${esc(t("cvConv"))}</th></tr></thead>
        <tbody>${convRows}
        <tr class="tot"><td>${esc(t("convT"))}</td><td></td><td></td><td class="n">${fmt(r.convArea, 2)} m²</td></tr>
        <tr class="sub"><td colspan="3">${esc(t("convRateL"))}</td><td class="n">${fmt(r.convRate, 2)} USD</td></tr>
        <tr class="sub"><td colspan="3">${esc(t("effRateL"))}</td><td class="n">${fmt(r.effRate, 2)} USD</td></tr>
        </tbody></table></div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>${esc(t("thNo"))}</th><th>${esc(t("thItem"))}</th><th>${esc(t("thUnit"))}</th><th class="n">${esc(t("thQty"))}</th><th class="n">${esc(t("thPrice"))}</th><th class="n">${esc(t("thAmt"))}</th></tr></thead>
        <tbody>${html}</tbody></table></div>
      <div class="cols">
        <div class="box"><h4>${esc(t("payT"))}</h4>${pays}</div>
        <div class="box"><h4>${esc(t("incT"))}</h4><p>${esc(t("inc"))}</p><p>${esc(t("exc"))}</p></div>
      </div>
      <p class="note">${esc(t("note"))}${r.input.foundation === "pile" ? "<br>* " + esc(t("pileNote")) : ""}</p>
      <div class="actions">
        <button class="btn btn-wa" id="sendWa">${esc(t("wa"))}</button>
        <button class="btn btn-line" id="printBtn">${esc(t("print"))}</button>
      </div>`;
    $("printBtn").onclick = () => window.print();
    $("sendWa").onclick = () => {
      const msg = `${t("waMsg")}\n• ${fmt(r.input.W, 2)} × ${fmt(r.input.L, 2)} m, ${r.input.floors} ${t("fl")}, ${t(r.input.pkg)}\n• ${t("floorArea")}: ${fmt(r.house.floorArea, 2)} m²\n• ${t("houseT")}: ${usd(r.houseTotal)}\n• ${t("extT")}: ${usd(r.extrasTotal)}\n• ${t("total")}: ${usd(r.total)}`;
      window.open(`https://wa.me/${WA}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
    };
  }

  function run() {
    const input = readInput();
    try {
      last = E.compute(input, CFG);
      $("err").style.display = "none";
      render(last);
      return true;
    } catch (e) {
      $("err").style.display = "block";
      return false;
    }
  }

  // sự kiện
  document.querySelectorAll(".lang button").forEach((b) => (b.onclick = () => applyLang(b.dataset.lang)));
  document.querySelectorAll("#floors button").forEach((b) => (b.onclick = () => {
    floors = Number(b.dataset.v);
    document.querySelectorAll("#floors button").forEach((x) => x.classList.toggle("on", x === b));
    renderPkgs(); if (last) run();
  }));
  $("f").addEventListener("submit", (e) => {
    e.preventDefault();
    if (run() && window.innerWidth < 980) $("result").scrollIntoView({ behavior: "smooth" });
  });
  $("f").addEventListener("change", (e) => { if (last && e.target.id !== "w" && e.target.id !== "l") run(); });

  // tham số URL: ?w=10&l=20&f=2&p=quality
  const qs = new URLSearchParams(location.search);
  if (qs.get("w")) $("w").value = qs.get("w");
  if (qs.get("l")) $("l").value = qs.get("l");
  if (["1", "2", "3", "4"].includes(qs.get("f"))) floors = Number(qs.get("f"));
  if (CFG.packages[qs.get("p")]) pkg = qs.get("p");
  document.querySelectorAll("#floors button").forEach((x) => x.classList.toggle("on", Number(x.dataset.v) === floors));
  applyLang(pickLang());
  if (qs.get("w") && qs.get("l")) run();
})();
