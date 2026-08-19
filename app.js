// Columns: 0 zone, 1 district, 2 upazila, 3 instType, 4 institute, 5 category, 6 designation, 7 subject, 8 vacant
(function () {
  "use strict";

  const IDX = { ZONE: 0, DISTRICT: 1, UPAZILA: 2, TYPE: 3, INST: 4, CAT: 5, DESIG: 6, SUBJ: 7, VAC: 8 };
  const PAGE_SIZE = 60;

  const bnDigits = ["০","১","২","৩","৪","৫","৬","৭","৮","৯"];
  function toBn(n) {
    return String(n).replace(/[0-9]/g, d => bnDigits[+d]);
  }
  function fmt(n) {
    return toBn(n.toLocaleString("en-US"));
  }

  const els = {
    zone: document.getElementById("fZone"),
    district: document.getElementById("fDistrict"),
    upazila: document.getElementById("fUpazila"),
    instType: document.getElementById("fInstType"),
    category: document.getElementById("fCategory"),
    designation: document.getElementById("fDesignation"),
    subject: document.getElementById("fSubject"),
    institute: document.getElementById("fInstitute"),
    clear: document.getElementById("clearFilters"),
    openFilters: document.getElementById("openFilters"),
    closeFilters: document.getElementById("closeFilters"),
    applyFilters: document.getElementById("applyFilters"),
    drawer: document.getElementById("filterDrawer"),
    backdrop: document.getElementById("drawerBackdrop"),
    resultCount: document.getElementById("resultCount"),
    tableBody: document.getElementById("tableBody"),
    registerCount: document.getElementById("registerCount"),
    prevPage: document.getElementById("prevPage"),
    nextPage: document.getElementById("nextPage"),
    pageLabel: document.getElementById("pageLabel"),
    statStrip: document.getElementById("statStrip"),
    listSubject: document.getElementById("listSubject"),
    listCategory: document.getElementById("listCategory"),
    listCollege: document.getElementById("listCollege"),
    footTotal: document.getElementById("footTotal"),
    loadError: document.getElementById("loadError"),
  };

  let DATA = [];
  let filtered = [];
  let page = 0;

  function uniqueSorted(arr) {
    return Array.from(new Set(arr)).sort((a, b) => a.localeCompare(b, "bn"));
  }

  function fillSelect(select, values, placeholder) {
    const current = select.value;
    select.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = placeholder;
    select.appendChild(optAll);
    values.forEach(v => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      select.appendChild(o);
    });
    if (values.includes(current)) select.value = current;
  }

  function populateBaseFilters() {
    fillSelect(els.zone, uniqueSorted(DATA.map(d => d[IDX.ZONE])), "সব জোন");
    fillSelect(els.instType, uniqueSorted(DATA.map(d => d[IDX.TYPE])), "সব");
    fillSelect(els.category, uniqueSorted(DATA.map(d => d[IDX.CAT])), "সব");
    fillSelect(els.designation, uniqueSorted(DATA.map(d => d[IDX.DESIG])), "সব");
    fillSelect(els.subject, uniqueSorted(DATA.map(d => d[IDX.SUBJ])), "সব বিষয়");
    updateCascadingDistrict();
  }

  // District options depend on selected zone; Upazila depends on selected district.
  function updateCascadingDistrict() {
    const zone = els.zone.value;
    const pool = zone ? DATA.filter(d => d[IDX.ZONE] === zone) : DATA;
    fillSelect(els.district, uniqueSorted(pool.map(d => d[IDX.DISTRICT])), "সব জেলা");
    updateCascadingUpazila();
  }

  function updateCascadingUpazila() {
    const zone = els.zone.value;
    const district = els.district.value;
    let pool = DATA;
    if (zone) pool = pool.filter(d => d[IDX.ZONE] === zone);
    if (district) pool = pool.filter(d => d[IDX.DISTRICT] === district);
    fillSelect(els.upazila, uniqueSorted(pool.map(d => d[IDX.UPAZILA])), "সব উপজেলা");
  }

  function currentFilters() {
    return {
      zone: els.zone.value,
      district: els.district.value,
      upazila: els.upazila.value,
      instType: els.instType.value,
      category: els.category.value,
      designation: els.designation.value,
      subject: els.subject.value,
      institute: els.institute.value.trim().toLowerCase(),
    };
  }

  function applyFilters() {
    const f = currentFilters();
    filtered = DATA.filter(d => {
      if (f.zone && d[IDX.ZONE] !== f.zone) return false;
      if (f.district && d[IDX.DISTRICT] !== f.district) return false;
      if (f.upazila && d[IDX.UPAZILA] !== f.upazila) return false;
      if (f.instType && d[IDX.TYPE] !== f.instType) return false;
      if (f.category && d[IDX.CAT] !== f.category) return false;
      if (f.designation && d[IDX.DESIG] !== f.designation) return false;
      if (f.subject && d[IDX.SUBJ] !== f.subject) return false;
      if (f.institute && !d[IDX.INST].toLowerCase().includes(f.institute)) return false;
      return true;
    });
    page = 0;
    render();
  }

  function aggregate(rows, keyIdx, limit) {
    const map = new Map();
    for (const r of rows) {
      const key = r[keyIdx];
      map.set(key, (map.get(key) || 0) + r[IDX.VAC]);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
  }

  function renderRankList(el, entries, totalForBar) {
    el.innerHTML = "";
    if (!entries.length) {
      el.innerHTML = '<li class="rl-empty">কোনো তথ্য পাওয়া যায়নি</li>';
      return;
    }
    const max = entries[0][1] || 1;
    entries.forEach(([name, count]) => {
      const li = document.createElement("li");
      const nameSpan = document.createElement("span");
      nameSpan.className = "rl-name";
      nameSpan.title = name;
      nameSpan.textContent = name;
      const countSpan = document.createElement("span");
      countSpan.className = "rl-count";
      countSpan.textContent = fmt(count);
      const track = document.createElement("div");
      track.className = "rl-bar-track";
      const bar = document.createElement("div");
      bar.className = "rl-bar";
      bar.style.width = Math.max(3, (count / max) * 100) + "%";
      track.appendChild(bar);
      li.appendChild(nameSpan);
      li.appendChild(countSpan);
      li.appendChild(track);
      el.appendChild(li);
    });
  }

  function renderSummaries() {
    renderRankList(els.listSubject, aggregate(filtered, IDX.SUBJ, 10));
    renderRankList(els.listCategory, aggregate(filtered, IDX.CAT, 10));
    renderRankList(els.listCollege, aggregate(filtered, IDX.INST, 10));
  }

  function renderTable() {
    const total = filtered.length;
    const totalVacant = filtered.reduce((s, r) => s + r[IDX.VAC], 0);
    els.resultCount.innerHTML = `মিলেছে <strong>${fmt(total)}</strong> টি এন্ট্রি &middot; মোট শূন্যপদ <strong>${fmt(totalVacant)}</strong>`;
    els.registerCount.textContent = `(${fmt(total)} এন্ট্রি)`;

    const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
    if (page > maxPage) page = maxPage;
    const start = page * PAGE_SIZE;
    const rows = filtered.slice(start, start + PAGE_SIZE);

    els.tableBody.innerHTML = "";
    if (!rows.length) {
      const tr = document.createElement("tr");
      tr.className = "empty-row";
      tr.innerHTML = `<td colspan="10">এই ফিল্টারে কোনো এন্ট্রি পাওয়া যায়নি</td>`;
      els.tableBody.appendChild(tr);
    } else {
      const frag = document.createDocumentFragment();
      rows.forEach((r, i) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="col-no">${fmt(start + i + 1)}</td>
          <td>${r[IDX.ZONE]}</td>
          <td>${r[IDX.DISTRICT]}</td>
          <td>${r[IDX.UPAZILA]}</td>
          <td>${r[IDX.TYPE]}</td>
          <td class="institute-cell">${r[IDX.INST]}</td>
          <td>${r[IDX.CAT]}</td>
          <td>${r[IDX.DESIG]}</td>
          <td>${r[IDX.SUBJ] === "NULL" ? "—" : r[IDX.SUBJ]}</td>
          <td class="col-num">${fmt(r[IDX.VAC])}</td>`;
        frag.appendChild(tr);
      });
      els.tableBody.appendChild(frag);
    }

    els.pageLabel.textContent = `${fmt(page + 1)} / ${fmt(maxPage + 1)}`;
    els.prevPage.disabled = page <= 0;
    els.nextPage.disabled = page >= maxPage;
  }

  function render() {
    renderSummaries();
    renderTable();
  }

  function renderHeaderStats() {
    const total = DATA.length;
    const totalVacant = DATA.reduce((s, r) => s + r[IDX.VAC], 0);
    const institutes = new Set(DATA.map(d => d[IDX.INST])).size;
    const subjects = new Set(DATA.map(d => d[IDX.SUBJ])).size;
    const districts = new Set(DATA.map(d => d[IDX.DISTRICT])).size;

    els.footTotal.textContent = fmt(total);

    const stats = [
      { label: "মোট এন্ট্রি", value: fmt(total) },
      { label: "প্রতিষ্ঠান", value: fmt(institutes) },
      { label: "জেলা", value: fmt(districts) },
      { label: "বিষয়", value: fmt(subjects) },
    ];
    els.statStrip.innerHTML = stats
      .map(s => `<div class="stat"><span class="stat__value">${s.value}</span><span class="stat__label">${s.label}</span></div>`)
      .join("");
  }

  function wireEvents() {
    function setDrawer(open) {
      els.drawer.classList.toggle("is-open", open);
      els.drawer.setAttribute("aria-hidden", String(!open));
      els.openFilters.setAttribute("aria-expanded", String(open));
      els.backdrop.hidden = !open;
      document.body.classList.toggle("drawer-open", open);
    }
    els.openFilters.addEventListener("click", () => setDrawer(true));
    els.closeFilters.addEventListener("click", () => setDrawer(false));
    els.applyFilters.addEventListener("click", () => setDrawer(false));
    els.backdrop.addEventListener("click", () => setDrawer(false));
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") setDrawer(false);
    });
    els.zone.addEventListener("change", () => { updateCascadingDistrict(); applyFilters(); });
    els.district.addEventListener("change", () => { updateCascadingUpazila(); applyFilters(); });
    [els.upazila, els.instType, els.category, els.designation, els.subject].forEach(sel =>
      sel.addEventListener("change", applyFilters)
    );
    let debounceHandle;
    els.institute.addEventListener("input", () => {
      clearTimeout(debounceHandle);
      debounceHandle = setTimeout(applyFilters, 180);
    });
    els.clear.addEventListener("click", () => {
      els.zone.value = "";
      els.district.value = "";
      els.upazila.value = "";
      els.institute.value = "";
      updateCascadingDistrict();
      els.instType.value = "";
      els.category.value = "";
      els.designation.value = "";
      els.subject.value = "";
      applyFilters();
    });
    els.prevPage.addEventListener("click", () => { if (page > 0) { page--; renderTable(); } });
    els.nextPage.addEventListener("click", () => {
      const maxPage = Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1);
      if (page < maxPage) { page++; renderTable(); }
    });
  }

  function init(data) {
    if (!Array.isArray(data) || !data.length) throw new Error("ডেটা ফাইলটি খালি বা ভুল ফরম্যাটে আছে।");
    DATA = data
      .filter(row => Array.isArray(row) && row.length >= 9)
      .map(row => [...row.slice(0, 8), Number(row[8]) || 0]);
    if (!DATA.length) throw new Error("ব্যবহারযোগ্য কোনো ডেটা পাওয়া যায়নি।");
    filtered = DATA;
    populateBaseFilters();
    wireEvents();
    renderHeaderStats();
    render();
  }

  function showLoadError(message) {
    els.loadError.hidden = false;
    els.loadError.innerHTML = `<strong>ডেটা লোড করা যায়নি</strong><span>${message}</span><small>লোকাল ফাইল হিসেবে না খুলে সাইটটি একটি web server বা deployment URL থেকে চালান।</small>`;
  }

  // Resolve relative to the current page so the app also works from nested
  // deployment paths. A cache-busting request prevents stale JSON after an update.
  const dataUrl = new URL("data.json", document.baseURI);
  dataUrl.searchParams.set("v", "2026-08-19");
  fetch(dataUrl.href, { cache: "no-store", headers: { Accept: "application/json" } })
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(init)
    .catch(err => {
      showLoadError(err.message || "অজানা ত্রুটি");
      els.tableBody.innerHTML = `<tr class="empty-row"><td colspan="10">ডেটা পাওয়া যায়নি</td></tr>`;
    });
})();
