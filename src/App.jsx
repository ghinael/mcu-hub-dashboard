import React, { useState, useEffect, useMemo } from "react";

/* =====================================================================
   KONFIGURASI
   ===================================================================== */

// URL CSV publish dari tab 90_EXPORT_DASHBOARD.
// HARUS format publish-to-web: .../pub?...&output=csv
// BUKAN URL edit (.../edit?gid=...). Cara dapat: File → Bagikan → Publish ke web → pilih tab 90 → format CSV.
const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSxeXQjctXiL9WBqxDHgb4GtMIcUgw2OkoD6xZFwkrfLhvUMAA-hUPTP5D8mrqMjNwAmowpkfzmtk19/pub?gid=1965086356&single=true&output=csv";

const HERO_IMAGE =
  "https://drive.google.com/thumbnail?id=1hHXUbp27jvg9fK05zYIlMneHAs1zAf7M&sz=w1600";

const PROGRAM_META = {
  DBE:    { color: "#2D6CDF", avatar: "https://drive.google.com/thumbnail?id=1MywpZ8s01M24c47m-jxeAHXqqhwtXCha&sz=w400" },
  MMBA:   { color: "#E8A317", avatar: "https://drive.google.com/thumbnail?id=1iSw_kPDCJSxWNLlYTfN25yrjc_azJVzX&sz=w400" },
  SIC:    { color: "#0E9F8E", avatar: "https://drive.google.com/thumbnail?id=183tPBw1vjeCzfeOICJ6RuwDyyh0q9jS7&sz=w400" },
  DBS:    { color: "#8B5CF6", avatar: "https://drive.google.com/thumbnail?id=12yZvrjALqe2hhV3y7n94je6eyjhQkKXg&sz=w400" },
  Brevet: { color: "#E5484D", avatar: "https://drive.google.com/thumbnail?id=1-hyWkWmrERA4cGR2p-yL67Gdr2Xz7C2U&sz=w400" },
  CCC:    { color: "#64748B", avatar: "" },
};
const metaOf = (p) => PROGRAM_META[p] || { color: "#94A3B8", avatar: "" };

/* =====================================================================
   HELPERS
   ===================================================================== */

function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else q = false;
      } else cell += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (c === "\r") { /* skip */ }
      else cell += c;
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function num(v) {
  if (v == null || v === "") return 0;
  const s = String(v).trim().replace(/[^0-9.,-]/g, "");
  let clean = s;
  if (s.includes(",") && s.includes(".")) clean = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",") && !s.includes(".")) clean = s.replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

// Persen pintar: kalau angka <=1.5, anggap desimal (0.33 -> 33%). Kalau >1.5, anggap sudah dalam persen (3.3 -> 3%).
function pct(x) {
  const n = num(x);
  const v = Math.abs(n) <= 1.5 ? n * 100 : n;
  return `${Math.round(v)}%`;
}
const rupiah = (x) => "Rp " + Math.round(num(x)).toLocaleString("id-ID");
const truthy = (v) => /^(true|ya|yes|1|done|selesai)$/i.test(String(v).trim());

// Section name -> nama bucket di state. Pakai alias karena nama section kadang ke-truncate di Sheets.
const SECTION_KEY = {
  PERFORMA_TIM: "performaTim",
  PAPAN_PERFORMA: "papan",
  KALDIK_EVENTS: "kaldik",
  CASHFLOW_BULAN: "cashflow",
  TOP_COMMITMENT: "commitment",
  PESERTA_AKTIF_RINGKASAN: "pesertaAktif",
  PESERTA_AKTIF_RINGKA: "pesertaAktif",
  PESERTA_AKTIF: "pesertaAktif",
  WEEKLY_LEADER: "weekly",
  PERFORMANCE_APPRAISAL: "appraisal",
};

// Section header = string ALL_CAPS_UNDERSCORE di kolom A, semua kolom lain kosong.
function isSectionHeader(rowVals) {
  const a = (rowVals[0] || "").trim();
  if (!a) return false;
  if (!/^[A-Z][A-Z0-9_]+$/.test(a)) return false;
  return rowVals.slice(1).every((x) => !x || !String(x).trim());
}

function shapeData(rows) {
  const meta = {};
  const buckets = {};
  let section = null, sub = null;

  for (const r of rows) {
    if (isSectionHeader(r)) {
      const a = r[0].trim();
      const key = SECTION_KEY[a] || a.toLowerCase();
      section = key;
      sub = null;
      buckets[key] = buckets[key] || [];
      continue;
    }
    const a = (r[0] || "").trim();
    if (a === "Header") { meta[(r[1] || "").trim()] = (r[2] || "").trim(); continue; }
    if (!section) continue;
    if (!sub) {
      sub = r.map((x) => (x || "").trim());
      continue;
    }
    if (r.every((x) => !x || !String(x).trim())) continue;
    const obj = {};
    sub.forEach((key, idx) => { if (key) obj[key] = r[idx]; });
    buckets[section].push(obj);
  }

  return {
    periode: meta["Periode"] || "",
    pm: meta["PM"] || "",
    performaTim: buckets.performaTim || [],
    papan: buckets.papan || [],
    kaldik: buckets.kaldik || [],
    cashflow: buckets.cashflow || [],
    commitment: buckets.commitment || [],
    pesertaAktif: buckets.pesertaAktif || [],
    weekly: buckets.weekly || [],
    appraisal: buckets.appraisal || [],
  };
}

/* =====================================================================
   SAMPLE (preview saat CSV gagal)
   ===================================================================== */
const SAMPLE = {
  periode: "Juni 2026", pm: "Ghina",
  performaTim: [
    { Program:"DBE",LeadsT:0,LeadsR:0,IntT:0,IntR:0,DUT:17,DUR:3,UjianT:28,UjianR:6,BiayaT:93000000,BiayaR:69546188,SIS:0.87,Status:"Kritis" },
    { Program:"MMBA",LeadsT:0,LeadsR:0,IntT:0,IntR:0,DUT:20,DUR:8,UjianT:32,UjianR:9,BiayaT:171000000,BiayaR:156430000,SIS:0.87,Status:"Aman" },
    { Program:"SIC",LeadsT:0,LeadsR:0,IntT:0,IntR:0,DUT:17,DUR:6,UjianT:30,UjianR:5,BiayaT:92500000,BiayaR:49200000,SIS:0.87,Status:"Waspada" },
    { Program:"DBS",LeadsT:0,LeadsR:0,IntT:0,IntR:0,DUT:13,DUR:4,UjianT:18,UjianR:3,BiayaT:32500000,BiayaR:27200000,SIS:0.87,Status:"Waspada" },
    { Program:"Brevet",LeadsT:0,LeadsR:0,IntT:0,IntR:0,DUT:8,DUR:2,UjianT:10,UjianR:1,BiayaT:54000000,BiayaR:12250000,SIS:0.87,Status:"Kritis" },
    { Program:"CCC",LeadsT:0,LeadsR:0,IntT:0,IntR:0,DUT:0,DUR:0,UjianT:0,UjianR:0,BiayaT:0,BiayaR:0,SIS:0,Status:"-" },
  ],
  papan: [
    { Program:"DBE",KPI:"Daftar Ujian",W1:0.05,W2:0.10,W3:0.15,W4:0.18,W5:0.21 },
    { Program:"MMBA",KPI:"Daftar Ujian",W1:0.04,W2:0.08,W3:0.16,W4:0.22,W5:0.28 },
    { Program:"SIC",KPI:"Daftar Ujian",W1:0.02,W2:0.06,W3:0.10,W4:0.14,W5:0.17 },
    { Program:"DBS",KPI:"Daftar Ujian",W1:0.03,W2:0.07,W3:0.11,W4:0.13,W5:0.16 },
    { Program:"Brevet",KPI:"Daftar Ujian",W1:0.01,W2:0.04,W3:0.06,W4:0.08,W5:0.10 },
    { Program:"DBE",KPI:"Daftar Ulang",W1:0.02,W2:0.06,W3:0.12,W4:0.15,W5:0.18 },
    { Program:"MMBA",KPI:"Daftar Ulang",W1:0.05,W2:0.12,W3:0.22,W4:0.31,W5:0.40 },
    { Program:"SIC",KPI:"Daftar Ulang",W1:0.04,W2:0.10,W3:0.20,W4:0.28,W5:0.35 },
    { Program:"DBS",KPI:"Daftar Ulang",W1:0.03,W2:0.08,W3:0.18,W4:0.25,W5:0.31 },
    { Program:"Brevet",KPI:"Daftar Ulang",W1:0.02,W2:0.06,W3:0.12,W4:0.18,W5:0.25 },
    { Program:"DBE",KPI:"Leads",W1:0.10,W2:0.20,W3:0.30,W4:0.40,W5:0.50 },
    { Program:"MMBA",KPI:"Leads",W1:0.15,W2:0.25,W3:0.35,W4:0.45,W5:0.55 },
    { Program:"SIC",KPI:"Leads",W1:0.08,W2:0.18,W3:0.28,W4:0.38,W5:0.48 },
    { Program:"DBE",KPI:"Interview",W1:0.05,W2:0.12,W3:0.20,W4:0.28,W5:0.35 },
    { Program:"MMBA",KPI:"Interview",W1:0.08,W2:0.18,W3:0.28,W4:0.38,W5:0.48 },
  ],
  kaldik: [
    { Tanggal:6,Program:"MMBA",Judul:"Asesmen CRA",Done:"True" },
    { Tanggal:20,Program:"DBE",Judul:"Orientasi",Done:"False" },
    { Tanggal:20,Program:"SIC",Judul:"Graduation",Done:"False" },
    { Tanggal:12,Program:"DBS",Judul:"Workshop Brand",Done:"True" },
    { Tanggal:25,Program:"Brevet",Judul:"Closing Batch",Done:"False" },
  ],
  cashflow: [{ Key:"Plan",Value:120000000 },{ Key:"Reality",Value:95000000 }],
  commitment: [
    { Judul:"Performance Tracking Board (minggu depan jadi)",Status:"URGENT",Deadline:"25/06/2026" },
    { Judul:"Pengisian Asertif (Deadline 25 Juni)",Status:"URGENT",Deadline:"30/06/2026" },
    { Judul:"Sosialisasi Presensi WHT",Status:"Selesai",Deadline:"13/06/2026" },
    { Judul:"Buat aturan reward & share ke group",Status:"URGENT",Deadline:"25/06/2026" },
  ],
  pesertaAktif: [
    { Batch:"DBE-5",Program:"DBE",Target:62,Aktif:51,Mundur:1,SudahBayar:43,BelumBayar:8,BayarPct:0.69 },
    { Batch:"MMBA-5",Program:"MMBA",Target:49,Aktif:46,Mundur:0,SudahBayar:30,BelumBayar:16,BayarPct:0.65 },
    { Batch:"SIC-4",Program:"SIC",Target:37,Aktif:20,Mundur:0,SudahBayar:14,BelumBayar:6,BayarPct:0.70 },
    { Batch:"DBS-3",Program:"DBS",Target:13,Aktif:12,Mundur:1,SudahBayar:9,BelumBayar:3,BayarPct:0.75 },
    { Batch:"Brevet-2",Program:"Brevet",Target:27,Aktif:11,Mundur:0,SudahBayar:6,BelumBayar:5,BayarPct:0.22 },
  ],
  weekly: [],
  appraisal: [
    { Tier:"WIG",Indikator:"Peserta Aktif",Bobot:"",Skor:"" },
    { Tier:"LM",Indikator:"Daftar Ulang",Bobot:"",Skor:"" },
    { Tier:"LM",Indikator:"Daftar Ujian",Bobot:"",Skor:"" },
    { Tier:"LM",Indikator:"Cashflow",Bobot:"",Skor:"" },
    { Tier:"DLM",Indikator:"Rapot",Bobot:"",Skor:"" },
    { Tier:"DLM",Indikator:"Kaldik",Bobot:"",Skor:"" },
  ],
};

/* =====================================================================
   IKON
   ===================================================================== */
const Crown = ({ size = 18, color = "#E8A317" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
    <path d="M3 7l4.5 3.2L12 4l4.5 6.2L21 7l-1.6 11H4.6L3 7z" />
  </svg>
);

/* =====================================================================
   AVATAR
   ===================================================================== */
function Avatar({ program, size = 34 }) {
  const m = metaOf(program);
  const [broken, setBroken] = useState(false);
  if (m.avatar && !broken) {
    return <img className="pm-ava" src={m.avatar} alt={program}
      onError={() => setBroken(true)}
      style={{ width: size, height: size, borderColor: m.color }} />;
  }
  return (
    <span className="pm-ava pm-ava--init"
      style={{ width: size, height: size, background: m.color, fontSize: size * 0.32 }}>
      {(program || "?").slice(0, 2).toUpperCase()}
    </span>
  );
}

/* =====================================================================
   HERO
   ===================================================================== */
function Hero({ periode, pm }) {
  return (
    <header className="pm-hero" style={HERO_IMAGE ? { backgroundImage: `url(${HERO_IMAGE})` } : undefined}>
      <div className="pm-hero__scrim" />
      <div className="pm-hero__inner">
        <span className="pm-eyebrow">Performance Management · MCU</span>
        <h1 className="pm-hero__title">Scoreboard Program Manager</h1>
        <div className="pm-hero__meta">
          <span><b>{periode || "—"}</b></span>
          <span className="pm-dot" />
          <span>PM&nbsp;<b>{pm || "—"}</b></span>
        </div>
      </div>
    </header>
  );
}

/* =====================================================================
   SUMMARY CARDS (di atas Performa Tim)
   ===================================================================== */
function SummaryCards({ data }) {
  const programs = (data.performaTim || []).filter((r) => r.Program && (r.Status || "").trim() !== "-");

  // Performance Appraisal: weighted average pakai bobot dari section appraisal
  const pa = data.appraisal || [];
  const totalBobot = pa.reduce((s, r) => s + num(r.Bobot), 0);
  const weighted = pa.reduce((s, r) => s + num(r.Bobot) * num(r.Skor), 0);
  const paScore = totalBobot > 0 ? weighted / totalBobot : null;

  // Kaldik
  const kaldikDone = (data.kaldik || []).filter((e) => truthy(e.Done)).length;
  const kaldikTotal = (data.kaldik || []).length;

  // SIS rata-rata
  const sisVals = programs.map((r) => num(r.SIS)).filter((v) => v > 0);
  const sisAvg = sisVals.length ? sisVals.reduce((a, b) => a + b, 0) / sisVals.length : 0;

  const cards = [
    { label: "Program Dimonitor", value: programs.length, sub: "program aktif", tone: "ink" },
    { label: "Skor Performance Appraisal", value: paScore != null ? pct(paScore) : "—",
      sub: totalBobot > 0 ? `bobot ${pct(totalBobot)} terkonfigurasi` : "bobot belum diisi di sheet 90", tone: "violet" },
    { label: "Kaldik", value: kaldikTotal ? `${kaldikDone}/${kaldikTotal}` : "—",
      sub: kaldikTotal ? `${pct(kaldikDone / kaldikTotal)} terlaksana` : "belum ada agenda", tone: "teal" },
    { label: "SIS Rata-rata", value: sisAvg ? pct(sisAvg) : "—", sub: "kepatuhan WHT", tone: "gold" },
  ];

  return (
    <div className="pm-summary">
      {cards.map((c) => (
        <div key={c.label} className={`pm-summary__card pm-summary__card--${c.tone}`}>
          <div className="pm-summary__value">{c.value}</div>
          <div className="pm-summary__label">{c.label}</div>
          <div className="pm-summary__sub">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

/* =====================================================================
   A. PERFORMA TIM
   ===================================================================== */
function PerformaTim({ rows }) {
  // Hanya 5 kategori, semua T|R. Hapus SIS/Rapot/Kaldik/Skor/Status.
  const groups = [
    { label: "Leads",         t: "LeadsT",  r: "LeadsR",  kind: "count" },
    { label: "Interview",     t: "IntT",    r: "IntR",    kind: "count" },
    { label: "Daftar Ujian",  t: "UjianT",  r: "UjianR",  kind: "count" },
    { label: "Daftar Ulang",  t: "DUT",     r: "DUR",     kind: "count" },
    { label: "Biaya",         t: "BiayaT",  r: "BiayaR",  kind: "money" },
  ];
  const fmt = (kind, v) => (v === "" || v == null) ? "—" : (kind === "money" ? rupiah(v) : Math.round(num(v)));

  return (
    <Section letter="A" title="Performa Tim" caption="Target vs Realisasi per kategori funnel">
      <div className="pm-tablewrap">
        <table className="pm-table">
          <thead>
            <tr className="pm-table__grouprow">
              <th rowSpan={2} className="pm-sticky">Program</th>
              {groups.map((g) => <th key={g.label} colSpan={2} className="pm-grouphd">{g.label}</th>)}
            </tr>
            <tr className="pm-table__subrow">
              {groups.map((g) => (
                <React.Fragment key={g.label}>
                  <th className="pm-tr">Target</th><th className="pm-tr pm-tr--real">Realisasi</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td className="pm-empty" colSpan={1 + groups.length * 2}>Belum ada data Performa Tim di export.</td></tr>
            )}
            {rows.map((row) => (
              <tr key={row.Program}>
                <td className="pm-sticky pm-prog">
                  <span className="pm-chip" style={{ background: metaOf(row.Program).color }} />
                  {row.Program}
                </td>
                {groups.map((g) => (
                  <React.Fragment key={g.label}>
                    <td className="pm-tr">{fmt(g.kind, row[g.t])}</td>
                    <td className="pm-tr pm-tr--real">{fmt(g.kind, row[g.r])}</td>
                  </React.Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* =====================================================================
   B. PESERTA AKTIF
   ===================================================================== */
function PesertaAktif({ rows }) {
  if (!rows || rows.length === 0) {
    return (
      <Section letter="B" title="Peserta Aktif" caption="Angkatan berjalan tiap program">
        <div className="pm-empty">
          Belum ada data Peserta Aktif. Pastikan section <code>PESERTA_AKTIF_RINGKASAN</code> ada di tab 90 dan
          baris sub-header berisi <code>Batch | Program | Target | Aktif | Mundur | SudahBayar | BelumBayar | BayarPct</code>.
        </div>
      </Section>
    );
  }
  return (
    <Section letter="B" title="Peserta Aktif" caption="Angkatan berjalan tiap program">
      <div className="pm-grid pm-grid--cards">
        {rows.map((r) => {
          const aktif = r.Aktif === "" || r.Aktif == null ? null : num(r.Aktif);
          const target = num(r.Target);
          const bayar = num(r.BayarPct);
          const bayarVal = Math.abs(bayar) <= 1.5 ? bayar : bayar / 100;
          return (
            <div key={r.Batch} className="pm-card">
              <div className="pm-card__head">
                <Avatar program={r.Program} size={30} />
                <div>
                  <div className="pm-card__title">{r.Batch}</div>
                  <div className="pm-card__sub">Target {target || "—"} peserta</div>
                </div>
                <div className="pm-card__big">{aktif == null ? "—" : aktif}<span>aktif</span></div>
              </div>
              <div className="pm-bar pm-bar--thin">
                <div className="pm-bar__fill" style={{
                  width: `${Math.min(100, bayarVal * 100)}%`,
                  background: metaOf(r.Program).color,
                }} />
              </div>
              <div className="pm-card__stats">
                <span>Bayar <b>{num(r.SudahBayar)}</b></span>
                <span>Belum <b>{num(r.BelumBayar)}</b></span>
                <span>Mundur <b>{num(r.Mundur)}</b></span>
                <span className="pm-card__pct">{pct(r.BayarPct)} bayar</span>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* =====================================================================
   C. KALDIK CHECKLIST (gaya lingkaran)
   ===================================================================== */
function KaldikChecklist({ rows }) {
  const sorted = [...rows].sort((a, b) => num(a.Tanggal) - num(b.Tanggal));
  return (
    <Section letter="C" title="Kaldik Checklist" caption="Agenda kalender akademik bulan ini">
      {sorted.length === 0 && <div className="pm-empty">Belum ada agenda bulan ini.</div>}
      <div className="pm-kal-row">
        {sorted.map((e, i) => {
          const done = truthy(e.Done);
          const color = metaOf(e.Program).color;
          return (
            <div key={i} className={`pm-kal-item ${done ? "is-done" : ""}`}>
              <div className="pm-kal-circle" style={{ borderColor: color, color: done ? "#fff" : color, background: done ? color : "#fff" }}>
                <span className="pm-kal-num">{num(e.Tanggal)}</span>
                {done && <span className="pm-kal-check">✓</span>}
              </div>
              <div className="pm-kal-prog" style={{ color }}>{e.Program}</div>
              <div className="pm-kal-title">{e.Judul}</div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* =====================================================================
   KALDIK CALENDAR (tab tersendiri)
   ===================================================================== */
const MONTHS_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

function KaldikCalendar({ rows, periode }) {
  const [mName, yStr] = (periode || "").split(" ");
  const month = MONTHS_ID.indexOf(mName);
  const year = parseInt(yStr) || new Date().getFullYear();
  if (month < 0) {
    return <Section letter="" title="Kaldik Kalender">
      <div className="pm-empty">Periode tidak valid: <code>{periode || "(kosong)"}</code>. Format yang diharapkan: <code>Juni 2026</code>.</div>
    </Section>;
  }

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const byDay = {};
  (rows || []).forEach((e) => {
    const d = num(e.Tanggal);
    if (d > 0) (byDay[d] = byDay[d] || []).push(e);
  });

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

  return (
    <Section letter="" title={`Kaldik · ${mName} ${year}`} caption="Kalender akademik bulanan">
      <div className="pm-cal">
        <div className="pm-cal__head">
          {dayNames.map((d, i) => <div key={d} className={`pm-cal__hd ${i === 0 ? "is-sun" : ""}`}>{d}</div>)}
        </div>
        <div className="pm-cal__grid">
          {cells.map((d, i) => (
            <div key={i} className={`pm-cal__cell ${d == null ? "is-empty" : ""} ${i % 7 === 0 && d != null ? "is-sun" : ""}`}>
              {d != null && (
                <>
                  <div className="pm-cal__num">{d}</div>
                  <div className="pm-cal__events">
                    {(byDay[d] || []).map((e, j) => (
                      <div key={j} className={`pm-cal__event ${truthy(e.Done) ? "is-done" : ""}`}
                        style={{ borderLeftColor: metaOf(e.Program).color }}
                        title={`${e.Program}: ${e.Judul}`}>
                        <span className="pm-cal__prog" style={{ color: metaOf(e.Program).color }}>{e.Program}</span>
                        <span className="pm-cal__title">{e.Judul}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* =====================================================================
   D. EFISIENSI CASHOUT
   ===================================================================== */
function CashoutEfisiensi({ rows }) {
  const get = (k) => num((rows.find((r) => (r.Key || "").toLowerCase() === k) || {}).Value);
  const plan = get("plan"), reality = get("reality");
  const variance = plan - reality;
  const eff = plan > 0 ? reality / plan : 0;
  const over = reality > plan;
  return (
    <Section letter="D" title="Efisiensi Cashout" caption="Rencana vs realisasi pengeluaran">
      <div className="pm-grid pm-grid--3">
        <Stat label="Cash Out Plan" value={rupiah(plan)} tone="muted" />
        <Stat label="Cash Out Reality" value={rupiah(reality)} tone={over ? "crit" : "ok"} />
        <Stat label="Variance" value={rupiah(Math.abs(variance))}
          tone={over ? "crit" : "ok"} hint={over ? "Over budget" : "Hemat"} />
      </div>
      <div className="pm-bar pm-bar--cash">
        <div className="pm-bar__fill" style={{
          width: `${Math.min(100, Math.abs(eff) <= 1.5 ? eff * 100 : eff)}%`,
          background: over ? "#E5484D" : "#0E9F8E",
        }} />
        <span className="pm-bar__mid">{pct(eff)} terpakai dari plan</span>
      </div>
    </Section>
  );
}

/* =====================================================================
   E. KOMITMEN URGENT (FILTER URGENT ONLY)
   ===================================================================== */
function KomitmenUrgent({ rows }) {
  const filtered = (rows || []).filter((c) => /urgent/i.test(c.Status || ""));
  return (
    <Section letter="E" title="Komitmen Urgent" caption="Yang harus dieksekusi paling dulu">
      <div className="pm-urgent">
        {filtered.length === 0 && <div className="pm-empty">Tidak ada komitmen urgent. 🎉</div>}
        {filtered.map((c, i) => (
          <div key={i} className="pm-urgent__item">
            <span className="pm-urgent__flag">URGENT</span>
            <span className="pm-urgent__title">{c.Judul}</span>
            <span className="pm-urgent__due">{c.Deadline || "—"}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* =====================================================================
   PAPAN PERFORMA (per-minggu, KPI: Leads/Int/DJ/DU)
   ===================================================================== */
function PapanPerforma({ papan, weekly }) {
  const kpis = ["Leads", "Interview", "Daftar Ujian", "Daftar Ulang"];
  const [kpi, setKpi] = useState("Daftar Ujian");
  const [week, setWeek] = useState("W1");
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t); }, []);

  // Format: cek apakah ada kolom W1..W5
  const hasWeekly = papan.length > 0 && (papan[0].W1 !== undefined || papan[0].W2 !== undefined);
  const weekOpts = hasWeekly ? ["W1", "W2", "W3", "W4", "W5"] : [];

  const lanes = useMemo(() => {
    const filtered = papan.filter((r) => (r.KPI || "").trim() === kpi);
    const out = filtered.map((r) => ({
      program: r.Program,
      pct: hasWeekly ? num(r[week]) : num(r.Pct),
    }));
    return out.sort((a, b) => b.pct - a.pct);
  }, [papan, kpi, week, hasWeekly]);

  const maxPct = Math.max(0.0001, ...lanes.map((l) => Math.abs(l.pct) <= 1.5 ? l.pct : l.pct / 100));
  const leader = lanes[0]?.program;

  return (
    <Section letter="" title="Papan Performa" caption={hasWeekly ? `Capaian per minggu · ${week}` : "Capaian per program"}>
      <div className="pm-kpitoggle">
        {kpis.map((k) => (
          <button key={k} className={`pm-toggle ${kpi === k ? "is-active" : ""}`}
            onClick={() => setKpi(k)}>{k}</button>
        ))}
      </div>

      {hasWeekly && (
        <div className="pm-weekselect">
          <span className="pm-weekselect__label">Minggu</span>
          {weekOpts.map((w) => (
            <button key={w} className={`pm-weekbtn ${week === w ? "is-active" : ""}`}
              onClick={() => setWeek(w)}>{w}</button>
          ))}
        </div>
      )}

      <div className="pm-track">
        {lanes.map((l, i) => {
          const v = Math.abs(l.pct) <= 1.5 ? l.pct : l.pct / 100;
          const w = mounted ? Math.max(8, (v / maxPct) * 100) : 8;
          const isLead = l.program === leader && v > 0;
          return (
            <div key={l.program} className="pm-lane">
              <div className="pm-lane__rank">{i + 1}</div>
              <div className="pm-lane__name">{l.program}</div>
              <div className="pm-lane__rail">
                <div className="pm-lane__fill" style={{ width: `${w}%`, background: metaOf(l.program).color }}>
                  <span className="pm-lane__pct">{pct(l.pct)}</span>
                </div>
                <div className="pm-lane__runner" style={{ left: `calc(${w}% - 17px)` }}>
                  {isLead && <span className="pm-lane__crown"><Crown /></span>}
                  <Avatar program={l.program} size={34} />
                </div>
              </div>
            </div>
          );
        })}
        {lanes.length === 0 && <div className="pm-empty">Belum ada data untuk {kpi}{hasWeekly ? ` (${week})` : ""}.</div>}
      </div>

      <WeeklyHistory weekly={weekly} />
    </Section>
  );
}

function WeeklyHistory({ weekly }) {
  const build = (kpi) => {
    const wk = weekly.filter((r) => (r.KPI || "").trim() === kpi)
      .map((r) => ({ week: r.Week, program: r.Program, pct: num(r.Pct) }))
      .sort((a, b) => (a.week || "").localeCompare(b.week || ""));
    const tally = {};
    wk.forEach((w) => { if (w.program) tally[w.program] = (tally[w.program] || 0) + 1; });
    const champ = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    return { wk, champ };
  };
  const cols = [
    { kpi: "Daftar Ujian", ...build("Daftar Ujian") },
    { kpi: "Daftar Ulang", ...build("Daftar Ulang") },
  ];
  if (!weekly || weekly.length === 0) {
    return (
      <div className="pm-weekly pm-weekly--empty">
        <div className="pm-empty">History mingguan belum tersedia. Isi section <code>WEEKLY_LEADER</code> di tab 90.</div>
      </div>
    );
  }
  return (
    <div className="pm-weekly">
      <div className="pm-weekly__head">History Mingguan · Pemuncak per Minggu</div>
      <div className="pm-weekly__cols">
        {cols.map((c) => (
          <div key={c.kpi} className="pm-weekly__col">
            <div className="pm-weekly__kpi">{c.kpi}</div>
            <ol className="pm-weekly__list">
              {c.wk.map((w, i) => (
                <li key={i}>
                  <span className="pm-weekly__wk">{w.week}</span>
                  <Avatar program={w.program} size={22} />
                  <span className="pm-weekly__prog">{w.program}</span>
                  <span className="pm-weekly__pct">{pct(w.pct)}</span>
                </li>
              ))}
            </ol>
            {c.champ && (
              <div className="pm-weekly__champ">
                <Crown size={16} />
                <span><b>{c.champ[0]}</b> unggul {c.champ[1]}× → kandidat reward</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* =====================================================================
   PRIMITIF
   ===================================================================== */
function Section({ letter, title, caption, children }) {
  return (
    <section className="pm-section">
      <div className="pm-section__head">
        {letter && <span className="pm-section__letter">{letter}</span>}
        <div>
          <h2 className="pm-section__title">{title}</h2>
          {caption && <p className="pm-section__caption">{caption}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
function Stat({ label, value, tone = "muted", hint }) {
  return (
    <div className={`pm-stat pm-stat--${tone}`}>
      <div className="pm-stat__label">{label}</div>
      <div className="pm-stat__value">{value}</div>
      {hint && <div className="pm-stat__hint">{hint}</div>}
    </div>
  );
}

/* =====================================================================
   APP
   ===================================================================== */
export default function App() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [live, setLive] = useState(false);
  const [fetchErr, setFetchErr] = useState("");

  useEffect(() => {
    let alive = true;
    if (CSV_URL.includes("GANTI_DENGAN_PUB_ID")) {
      setFetchErr("CSV_URL belum diganti di App.jsx baris ~12. Tempel URL publish-to-web milikmu.");
      setData(SAMPLE);
      return;
    }
    fetch(CSV_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
        return r.text();
      })
      .then((t) => {
        if (!t) throw new Error("Respons kosong");
        if (t.trim().toLowerCase().startsWith("<")) {
          throw new Error("URL mengembalikan HTML, bukan CSV. Pastikan link adalah /pub?...&output=csv (bukan /edit?...). Cara: File → Bagikan → Publikasikan ke web → pilih tab 90 → format CSV.");
        }
        const shaped = shapeData(parseCSV(t));
        if (alive) { setData(shaped); setLive(true); }
      })
      .catch((err) => { if (alive) { setData(SAMPLE); setFetchErr(err.message || String(err)); } });
    return () => { alive = false; };
  }, []);

  if (!data) return <div className="pm-loading">Memuat scoreboard…</div>;

  return (
    <div className="pm-root">
      <StyleTag />
      <Hero periode={data.periode} pm={data.pm} />

      {!live && (
        <div className="pm-banner">
          <b>Data contoh ditampilkan.</b> {fetchErr}
        </div>
      )}

      <nav className="pm-tabs">
        <button className={tab === "dashboard" ? "is-active" : ""} onClick={() => setTab("dashboard")}>Overview</button>
        <button className={tab === "papan" ? "is-active" : ""} onClick={() => setTab("papan")}>Papan Performa</button>
        <button className={tab === "kaldik" ? "is-active" : ""} onClick={() => setTab("kaldik")}>Kaldik</button>
      </nav>

      <main className="pm-main">
        {tab === "dashboard" && (
          <>
            <SummaryCards data={data} />
            <PerformaTim rows={data.performaTim} />
            <PesertaAktif rows={data.pesertaAktif} />
            <KaldikChecklist rows={data.kaldik} />
            <CashoutEfisiensi rows={data.cashflow} />
            <KomitmenUrgent rows={data.commitment} />
          </>
        )}
        {tab === "papan" && <PapanPerforma papan={data.papan} weekly={data.weekly} />}
        {tab === "kaldik" && <KaldikCalendar rows={data.kaldik} periode={data.periode} />}
      </main>

      <footer className="pm-footer">Scoreboard PM · {data.periode || "—"} · diperbarui otomatis dari Google Sheets</footer>
    </div>
  );
}

/* =====================================================================
   STYLE
   ===================================================================== */
function StyleTag() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@600&display=swap');

.pm-root{--ink:#14213D;--ink2:#3A4663;--line:#E4E8F0;--bg:#F2F4F8;--card:#fff;
  --gold:#E8A317;--teal:#0E9F8E;--red:#E5484D;--violet:#8B5CF6;
  font-family:'Inter',system-ui,sans-serif;color:var(--ink);background:var(--bg);min-height:100vh;}
*{box-sizing:border-box}
.pm-loading{font-family:'Inter',sans-serif;padding:80px;text-align:center;color:#64748B}
.pm-banner{max-width:1180px;margin:14px auto 0;padding:11px 16px;background:#FEF3C7;border:1px solid #FCD34D;
  border-radius:10px;font-size:13px;color:#92400E;line-height:1.5}
.pm-banner code,.pm-empty code{background:#fff;padding:1px 6px;border-radius:5px;font-family:'JetBrains Mono',monospace;font-size:12px}

/* HERO */
.pm-hero{position:relative;min-height:260px;background:linear-gradient(135deg,#14213D,#22386b 60%,#2D6CDF);
  background-size:cover;background-position:center;display:flex;align-items:flex-end;overflow:hidden}
.pm-hero__scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,18,38,.3),rgba(11,18,38,.85))}
.pm-hero__inner{position:relative;max-width:1180px;width:100%;margin:0 auto;padding:32px 24px 28px}
.pm-eyebrow{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#9DB4E8;font-weight:600}
.pm-hero__title{font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;color:#fff;
  font-size:clamp(28px,4.4vw,46px);margin:8px 0 10px;line-height:1.02;letter-spacing:-.02em}
.pm-hero__meta{display:flex;align-items:center;gap:12px;color:#DDE6F7;font-size:15px}
.pm-hero__meta b{color:#fff}
.pm-dot{width:5px;height:5px;border-radius:50%;background:#7E97C9}

/* TABS */
.pm-tabs{max-width:1180px;margin:18px auto 0;padding:0 24px;display:flex;gap:8px}
.pm-tabs button{font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:14px;border:1px solid var(--line);
  background:#fff;color:var(--ink2);padding:10px 20px;border-radius:11px;cursor:pointer;transition:.15s}
.pm-tabs button:hover{border-color:#C3CCE0}
.pm-tabs button.is-active{background:var(--ink);color:#fff;border-color:var(--ink)}

.pm-main{max-width:1180px;margin:0 auto;padding:8px 24px 10px}

/* SUMMARY CARDS */
.pm-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:18px}
.pm-summary__card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px 20px;position:relative;overflow:hidden}
.pm-summary__card::before{content:"";position:absolute;top:0;left:0;width:5px;height:100%}
.pm-summary__card--ink::before{background:var(--ink)}
.pm-summary__card--violet::before{background:var(--violet)}
.pm-summary__card--teal::before{background:var(--teal)}
.pm-summary__card--gold::before{background:var(--gold)}
.pm-summary__value{font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:32px;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.pm-summary__card--ink .pm-summary__value{color:var(--ink)}
.pm-summary__card--violet .pm-summary__value{color:var(--violet)}
.pm-summary__card--teal .pm-summary__value{color:var(--teal)}
.pm-summary__card--gold .pm-summary__value{color:var(--gold)}
.pm-summary__label{margin-top:8px;font-size:12px;font-weight:700;color:var(--ink);text-transform:uppercase;letter-spacing:.04em}
.pm-summary__sub{margin-top:3px;font-size:12px;color:#7C879F}

/* SECTION */
.pm-section{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:22px 22px 24px;margin-top:18px;
  box-shadow:0 1px 2px rgba(20,33,61,.04)}
.pm-section__head{display:flex;align-items:center;gap:14px;margin-bottom:18px}
.pm-section__letter{font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:16px;color:#fff;
  background:var(--ink);width:34px;height:34px;border-radius:10px;display:grid;place-items:center;flex:none}
.pm-section__title{font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:21px;margin:0;letter-spacing:-.01em}
.pm-section__caption{margin:2px 0 0;font-size:13px;color:#7C879F}

/* TABLE PERFORMA TIM */
.pm-tablewrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px}
.pm-table{border-collapse:collapse;width:100%;font-size:13px;min-width:760px}
.pm-table th,.pm-table td{padding:10px 12px;text-align:center;white-space:nowrap}
.pm-table thead th{background:#F7F9FC;font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;color:var(--ink2);
  border-bottom:1px solid var(--line)}
.pm-table__grouprow .pm-grouphd{border-left:1px solid var(--line);border-bottom:1px solid var(--line);color:var(--ink)}
.pm-table__subrow th{font-size:11px;font-weight:600;color:#8A93A8;padding-top:6px;padding-bottom:6px;border-bottom:1px solid var(--line)}
.pm-tr{border-left:1px solid var(--line)}
.pm-tr--real{font-weight:700;color:var(--ink)}
.pm-table tbody td{border-bottom:1px solid #EEF1F6;font-variant-numeric:tabular-nums}
.pm-table tbody tr:last-child td{border-bottom:none}
.pm-table tbody tr:hover td{background:#FAFBFE}
.pm-sticky{position:sticky;left:0;background:#fff;text-align:left;z-index:1}
.pm-table thead .pm-sticky{background:#F7F9FC}
.pm-prog{font-weight:700;display:flex;align-items:center;gap:8px}
.pm-chip{width:10px;height:10px;border-radius:3px;flex:none;display:inline-block}

/* CARDS / GRID */
.pm-grid{display:grid;gap:14px}
.pm-grid--cards{grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}
.pm-grid--3{grid-template-columns:repeat(3,1fr)}
.pm-card{border:1px solid var(--line);border-radius:14px;padding:15px}
.pm-card__head{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.pm-card__title{font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:15px}
.pm-card__sub{font-size:12px;color:#8A93A8}
.pm-card__big{margin-left:auto;font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:26px;line-height:1;text-align:right}
.pm-card__big span{display:block;font-size:10px;font-weight:600;color:#8A93A8;letter-spacing:.05em;text-transform:uppercase}
.pm-card__stats{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:11px;font-size:12px;color:var(--ink2)}
.pm-card__stats b{color:var(--ink)}
.pm-card__pct{margin-left:auto;font-weight:700}

/* BARS */
.pm-bar{position:relative;background:#EEF1F6;border-radius:20px;overflow:hidden}
.pm-bar--thin{height:7px;margin-top:4px}
.pm-bar--cash{height:30px;margin-top:14px}
.pm-bar__fill{height:100%;border-radius:20px;transition:width .9s cubic-bezier(.22,1,.36,1)}
.pm-bar__mid{position:absolute;inset:0;display:grid;place-items:center;font-size:12px;font-weight:700;color:var(--ink)}

/* STAT */
.pm-stat{border:1px solid var(--line);border-radius:14px;padding:15px 16px}
.pm-stat__label{font-size:12px;color:#8A93A8;font-weight:600}
.pm-stat__value{font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:22px;margin-top:5px;font-variant-numeric:tabular-nums}
.pm-stat__hint{font-size:11px;font-weight:700;margin-top:3px}
.pm-stat--crit .pm-stat__value,.pm-stat--crit .pm-stat__hint{color:var(--red)}
.pm-stat--ok .pm-stat__value,.pm-stat--ok .pm-stat__hint{color:var(--teal)}

/* KALDIK CHECKLIST (lingkaran) */
.pm-kal-row{display:flex;flex-wrap:wrap;gap:18px;padding:8px 0 2px}
.pm-kal-item{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:96px;max-width:130px}
.pm-kal-circle{width:54px;height:54px;border-radius:50%;border:2px solid;display:grid;place-items:center;font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:18px;position:relative}
.pm-kal-item.is-done .pm-kal-num{opacity:.95}
.pm-kal-check{position:absolute;bottom:-3px;right:-3px;background:var(--teal);color:#fff;width:18px;height:18px;border-radius:50%;display:grid;place-items:center;font-size:11px;border:2px solid #fff}
.pm-kal-prog{font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
.pm-kal-title{font-size:12px;color:var(--ink2);text-align:center;line-height:1.3}

/* KALDIK CALENDAR */
.pm-cal{border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#fff}
.pm-cal__head{display:grid;grid-template-columns:repeat(7,1fr);background:#F7F9FC;border-bottom:1px solid var(--line)}
.pm-cal__hd{padding:11px 8px;text-align:center;font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:12px;color:var(--ink2);letter-spacing:.04em;text-transform:uppercase}
.pm-cal__hd.is-sun{color:var(--red)}
.pm-cal__grid{display:grid;grid-template-columns:repeat(7,1fr);grid-auto-rows:minmax(96px,auto)}
.pm-cal__cell{border-right:1px solid #EEF1F6;border-bottom:1px solid #EEF1F6;padding:8px;display:flex;flex-direction:column;gap:4px;background:#fff}
.pm-cal__cell:nth-child(7n){border-right:none}
.pm-cal__cell.is-empty{background:#FAFBFE}
.pm-cal__num{font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:14px;color:var(--ink)}
.pm-cal__cell.is-sun .pm-cal__num{color:var(--red)}
.pm-cal__events{display:flex;flex-direction:column;gap:3px}
.pm-cal__event{display:flex;flex-direction:column;border-left:3px solid;padding:4px 6px;background:#F7F9FC;border-radius:0 6px 6px 0;font-size:11px;line-height:1.3}
.pm-cal__event.is-done{opacity:.55;text-decoration:line-through}
.pm-cal__prog{font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.05em}
.pm-cal__title{color:var(--ink2)}

/* URGENT */
.pm-urgent{display:flex;flex-direction:column;gap:9px}
.pm-urgent__item{display:flex;align-items:center;gap:13px;border:1px solid #F3D2D2;background:#FEF7F7;border-radius:11px;padding:11px 14px}
.pm-urgent__flag{font-size:10px;font-weight:800;letter-spacing:.06em;color:#fff;background:var(--red);padding:4px 9px;border-radius:6px;flex:none}
.pm-urgent__title{font-weight:600;font-size:14px}
.pm-urgent__due{margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:12px;color:#C0392B;flex:none}

/* PAPAN PERFORMA */
.pm-kpitoggle{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}
.pm-toggle{font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:13px;border:1px solid var(--line);
  background:#fff;color:var(--ink2);padding:8px 16px;border-radius:9px;cursor:pointer}
.pm-toggle.is-active{background:var(--ink);color:#fff;border-color:var(--ink)}
.pm-weekselect{display:flex;align-items:center;gap:6px;margin-bottom:18px;padding:9px 13px;background:#F7F9FC;border-radius:10px;width:fit-content}
.pm-weekselect__label{font-size:11px;font-weight:700;color:#8A93A8;text-transform:uppercase;letter-spacing:.06em;margin-right:4px}
.pm-weekbtn{font-family:'JetBrains Mono',monospace;font-weight:600;font-size:12px;border:none;background:transparent;color:var(--ink2);padding:5px 11px;border-radius:7px;cursor:pointer}
.pm-weekbtn.is-active{background:var(--ink);color:#fff}
.pm-track{display:flex;flex-direction:column;gap:16px;padding:8px 0 4px}
.pm-lane{display:flex;align-items:center;gap:12px}
.pm-lane__rank{font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;color:#B6C0D4;width:18px;text-align:center;flex:none}
.pm-lane__name{font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;width:64px;flex:none;font-size:14px}
.pm-lane__rail{position:relative;flex:1;height:40px;background:#EEF1F6;border-radius:22px;
  background-image:repeating-linear-gradient(90deg,transparent,transparent 58px,#E1E6F0 58px,#E1E6F0 60px)}
.pm-lane__fill{position:absolute;left:0;top:0;height:100%;border-radius:22px;display:flex;align-items:center;
  transition:width 1s cubic-bezier(.22,1,.36,1);min-width:40px}
.pm-lane__pct{position:absolute;left:50%;transform:translateX(-50%);font-weight:800;font-size:13px;color:#fff;
  font-family:'Plus Jakarta Sans',sans-serif;text-shadow:0 1px 2px rgba(0,0,0,.25);white-space:nowrap}
.pm-lane__runner{position:absolute;top:50%;transform:translateY(-50%);transition:left 1s cubic-bezier(.22,1,.36,1);
  display:flex;flex-direction:column;align-items:center}
.pm-lane__crown{position:absolute;top:-15px;animation:pm-bob 1.6s ease-in-out infinite}
@keyframes pm-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}

/* WEEKLY HISTORY */
.pm-weekly{margin-top:26px;border-top:1px dashed var(--line);padding-top:20px}
.pm-weekly--empty{border-top:1px dashed var(--line)}
.pm-weekly__head{font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:15px;margin-bottom:14px}
.pm-weekly__cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.pm-weekly__col{border:1px solid var(--line);border-radius:14px;padding:14px 16px}
.pm-weekly__kpi{font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:14px;margin-bottom:10px;color:var(--ink)}
.pm-weekly__list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px}
.pm-weekly__list li{display:flex;align-items:center;gap:9px;font-size:13px}
.pm-weekly__wk{font-family:'JetBrains Mono',monospace;font-weight:600;font-size:12px;color:#8A93A8;width:26px}
.pm-weekly__prog{font-weight:600}
.pm-weekly__pct{margin-left:auto;font-variant-numeric:tabular-nums;color:var(--ink2);font-weight:600}
.pm-weekly__champ{display:flex;align-items:center;gap:8px;margin-top:12px;padding-top:11px;border-top:1px solid #EEF1F6;
  font-size:13px;color:#92400E;background:linear-gradient(0deg,#FFFBF0,#fff);}
.pm-weekly__champ b{color:var(--ink)}

/* AVATAR */
.pm-ava{border-radius:50%;object-fit:cover;border:2px solid #fff;box-shadow:0 1px 4px rgba(20,33,61,.2)}
.pm-ava--init{display:grid;place-items:center;color:#fff;font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;border:2px solid #fff}
.pm-empty{color:#8A93A8;font-size:13px;padding:14px 6px;text-align:center}
.pm-footer{max-width:1180px;margin:8px auto 0;padding:20px 24px 36px;color:#9AA4B8;font-size:12px;text-align:center}

@media(max-width:960px){
  .pm-summary{grid-template-columns:repeat(2,1fr)}
}
@media(max-width:720px){
  .pm-grid--3{grid-template-columns:1fr}
  .pm-weekly__cols{grid-template-columns:1fr}
  .pm-lane__name{width:50px;font-size:12px}
  .pm-summary{grid-template-columns:1fr}
  .pm-cal__grid{grid-auto-rows:minmax(72px,auto)}
  .pm-cal__event{font-size:10px}
}
@media(prefers-reduced-motion:reduce){
  .pm-bar__fill,.pm-lane__fill,.pm-lane__runner{transition:none}
  .pm-lane__crown{animation:none}
}
`;
