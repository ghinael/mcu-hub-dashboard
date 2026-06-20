import React, { useState, useEffect, useMemo, useRef } from "react";

/* =====================================================================
   KONFIGURASI — ganti bagian ini sesuai aset kamu
   ===================================================================== */

// URL CSV hasil "Publish to web" dari tab 90_EXPORT_DASHBOARD.
// Pakai URL publish yang sudah kamu pakai sekarang.
const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSxeXQjctXiL9WBqxDHgb4GtMIcUgw2OkoD6xZFwkrfLhvUMAA-hUPTP5D8mrqMjNwAmowpkfzmtk19/pub?gid=1965086356&single=true&output=csv";

// Foto besar di header (foto scoreboard PM / tim). Kosongkan ("") kalau belum ada.
// Pakai format thumbnail (bukan uc?export=view) supaya tidak diblokir sebagai background CSS.
const HERO_IMAGE =
  "https://drive.google.com/thumbnail?id=1hHXUbp27jvg9fK05zYIlMneHAs1zAf7M&sz=w1600";

// Meta per program: warna + foto "pelari" yang jalan di ujung bar Papan Performa.
// Kalau avatar kosong, otomatis pakai badge inisial berwarna.
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
   PARSER CSV (tanpa library) + helper angka
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

// Bersihkan angka: buang "Rp", spasi, pemisah ribuan; aman utk locale.
function num(v) {
  if (v == null || v === "") return 0;
  const s = String(v).trim().replace(/[^0-9.,-]/g, "");
  // kalau ada koma & titik -> anggap titik ribuan, koma desimal (locale ID)
  let clean = s;
  if (s.includes(",") && s.includes(".")) clean = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",") && !s.includes(".")) clean = s.replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}
const pct = (x) => `${Math.round(num(x) * 100)}%`;
const rupiah = (x) =>
  "Rp " + Math.round(num(x)).toLocaleString("id-ID");
const truthy = (v) => /^(true|ya|yes|1|done|selesai)$/i.test(String(v).trim());

const SECTIONS = [
  "PERFORMA_TIM", "PAPAN_PERFORMA", "KALDIK_EVENTS",
  "CASHFLOW_BULAN", "TOP_COMMITMENT", "PESERTA_AKTIF_RINGKASAN",
  "WEEKLY_LEADER",
];

function shapeData(rows) {
  const meta = {};
  const buckets = {};
  let section = null, sub = null;

  for (const r of rows) {
    const a = (r[0] || "").trim();
    if (SECTIONS.includes(a)) { section = a; sub = null; buckets[a] = []; continue; }
    if (a === "Header") { meta[(r[1] || "").trim()] = (r[2] || "").trim(); continue; }
    if (!section) continue;
    if (!sub) { sub = r.map((x) => (x || "").trim()); continue; } // baris sub-header
    if (r.every((x) => !x || !String(x).trim())) continue;        // baris kosong
    const obj = {};
    sub.forEach((key, idx) => { if (key) obj[key] = r[idx]; });
    buckets[section].push(obj);
  }

  return {
    periode: meta["Periode"] || "",
    pm: meta["PM"] || "",
    performaTim: buckets["PERFORMA_TIM"] || [],
    papan: buckets["PAPAN_PERFORMA"] || [],
    kaldik: buckets["KALDIK_EVENTS"] || [],
    cashflow: buckets["CASHFLOW_BULAN"] || [],
    commitment: buckets["TOP_COMMITMENT"] || [],
    pesertaAktif: buckets["PESERTA_AKTIF_RINGKASAN"] || [],
    weekly: buckets["WEEKLY_LEADER"] || [],
  };
}

/* =====================================================================
   DATA CONTOH (fallback) — hanya tampil saat CSV gagal di-fetch (preview).
   Saat dideploy dengan CSV_URL benar, data live otomatis menimpa ini.
   ===================================================================== */
const SAMPLE = {
  periode: "Juni 2026", pm: "Ghina",
  performaTim: [
    { Program:"DBE",DUT:17,DUR:3,UjianT:28,UjianR:6,BiayaT:93000000,BiayaR:69546188,SIS:0.87,Rapot:0,Kaldik:0.33,Skor:0.49,Status:"Kritis" },
    { Program:"MMBA",DUT:20,DUR:8,UjianT:32,UjianR:9,BiayaT:171000000,BiayaR:156430000,SIS:0.87,Rapot:0,Kaldik:0.33,Skor:0.55,Status:"Aman" },
    { Program:"SIC",DUT:17,DUR:6,UjianT:30,UjianR:5,BiayaT:92500000,BiayaR:49200000,SIS:0.87,Rapot:0,Kaldik:0.33,Skor:0.41,Status:"Waspada" },
    { Program:"DBS",DUT:13,DUR:4,UjianT:18,UjianR:3,BiayaT:32500000,BiayaR:27200000,SIS:0.87,Rapot:0,Kaldik:0.33,Skor:0.46,Status:"Waspada" },
    { Program:"Brevet",DUT:8,DUR:2,UjianT:10,UjianR:1,BiayaT:54000000,BiayaR:12250000,SIS:0.87,Rapot:0,Kaldik:0.33,Skor:0.28,Status:"Kritis" },
    { Program:"CCC",DUT:0,DUR:0,UjianT:0,UjianR:0,BiayaT:0,BiayaR:0,SIS:0,Rapot:0,Kaldik:0,Skor:0,Status:"-" },
  ],
  papan: [
    { Program:"DBE",KPI:"Daftar Ujian",Pct:0.21 },{ Program:"MMBA",KPI:"Daftar Ujian",Pct:0.28 },
    { Program:"SIC",KPI:"Daftar Ujian",Pct:0.17 },{ Program:"DBS",KPI:"Daftar Ujian",Pct:0.16 },
    { Program:"Brevet",KPI:"Daftar Ujian",Pct:0.10 },{ Program:"CCC",KPI:"Daftar Ujian",Pct:0 },
    { Program:"DBE",KPI:"Daftar Ulang",Pct:0.18 },{ Program:"MMBA",KPI:"Daftar Ulang",Pct:0.40 },
    { Program:"SIC",KPI:"Daftar Ulang",Pct:0.35 },{ Program:"DBS",KPI:"Daftar Ulang",Pct:0.31 },
    { Program:"Brevet",KPI:"Daftar Ulang",Pct:0.25 },{ Program:"CCC",KPI:"Daftar Ulang",Pct:0 },
  ],
  kaldik: [
    { Tanggal:6,Program:"MMBA",Judul:"Asesmen CRA",Done:"True" },
    { Tanggal:20,Program:"DBE",Judul:"Orientasi",Done:"False" },
    { Tanggal:20,Program:"SIC",Judul:"Graduation",Done:"False" },
  ],
  cashflow: [{ Key:"Plan",Value:120000000 },{ Key:"Reality",Value:95000000 }],
  commitment: [
    { Judul:"Performance Tracking Board (minggu depan jadi)",Status:"URGENT",Deadline:"25/06/2026" },
    { Judul:"Pengisian Asertif (Deadline 25 Juni)",Status:"URGENT",Deadline:"30/06/2026" },
    { Judul:"Buat aturan reward & share ke group",Status:"URGENT",Deadline:"25/06/2026" },
  ],
  pesertaAktif: [
    { Batch:"DBE-5",Program:"DBE",Target:62,Aktif:51,Mundur:1,SudahBayar:43,BelumBayar:8,BayarPct:0.69 },
    { Batch:"MMBA-5",Program:"MMBA",Target:49,Aktif:46,Mundur:0,SudahBayar:30,BelumBayar:16,BayarPct:0.65 },
    { Batch:"SIC-4",Program:"SIC",Target:37,Aktif:20,Mundur:0,SudahBayar:14,BelumBayar:6,BayarPct:0.70 },
    { Batch:"DBS-3",Program:"DBS",Target:13,Aktif:12,Mundur:1,SudahBayar:9,BelumBayar:3,BayarPct:0.75 },
    { Batch:"Brevet-2",Program:"Brevet",Target:27,Aktif:11,Mundur:0,SudahBayar:6,BelumBayar:5,BayarPct:0.22 },
  ],
  weekly: [
    { Week:"W1",KPI:"Daftar Ujian",Program:"DBE",Pct:0.12 },{ Week:"W2",KPI:"Daftar Ujian",Program:"Brevet",Pct:0.15 },
    { Week:"W3",KPI:"Daftar Ujian",Program:"DBS",Pct:0.11 },{ Week:"W4",KPI:"Daftar Ujian",Program:"DBE",Pct:0.18 },
    { Week:"W5",KPI:"Daftar Ujian",Program:"MMBA",Pct:0.20 },
    { Week:"W1",KPI:"Daftar Ulang",Program:"MMBA",Pct:0.10 },{ Week:"W2",KPI:"Daftar Ulang",Program:"SIC",Pct:0.14 },
    { Week:"W3",KPI:"Daftar Ulang",Program:"DBS",Pct:0.12 },{ Week:"W4",KPI:"Daftar Ulang",Program:"MMBA",Pct:0.16 },
    { Week:"W5",KPI:"Daftar Ulang",Program:"DBE",Pct:0.09 },
  ],
};

/* =====================================================================
   IKON (inline SVG, tanpa library)
   ===================================================================== */
const Crown = ({ size = 18, color = "#E8A317" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
    <path d="M3 7l4.5 3.2L12 4l4.5 6.2L21 7l-1.6 11H4.6L3 7z" />
  </svg>
);

/* =====================================================================
   KOMPONEN
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
      style={{ width: size, height: size, background: m.color }}>
      {program.slice(0, 2).toUpperCase()}
    </span>
  );
}

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

const statusTone = (s = "") => {
  const t = s.toLowerCase();
  if (t.includes("kritis")) return "crit";
  if (t.includes("waspada")) return "warn";
  if (t.includes("aman")) return "ok";
  return "muted";
};

/* ----- A. PERFORMA TIM (tabel dikelompokkan per kategori T/R) ----- */
function PerformaTim({ rows }) {
  const groups = [
    { key: "DU", label: "Daftar Ulang", t: "DUT", r: "DUR", kind: "count" },
    { key: "DJ", label: "Daftar Ujian", t: "UjianT", r: "UjianR", kind: "count" },
    { key: "BY", label: "Biaya Pendidikan", t: "BiayaT", r: "BiayaR", kind: "money" },
  ];
  const single = [
    { key: "SIS", label: "SIS" }, { key: "Rapot", label: "Rapot" }, { key: "Kaldik", label: "Kaldik" },
  ];
  const fmt = (kind, v) => kind === "money" ? rupiah(v) : Math.round(num(v));

  return (
    <Section letter="A" title="Performa Tim" caption="Target vs Realisasi per kategori">
      <div className="pm-tablewrap">
        <table className="pm-table">
          <thead>
            <tr className="pm-table__grouprow">
              <th rowSpan={2} className="pm-sticky">Program</th>
              {groups.map((g) => <th key={g.key} colSpan={2} className="pm-grouphd">{g.label}</th>)}
              {single.map((s) => <th key={s.key} rowSpan={2}>{s.label}</th>)}
              <th rowSpan={2}>Skor</th>
              <th rowSpan={2}>Status</th>
            </tr>
            <tr className="pm-table__subrow">
              {groups.map((g) => (
                <React.Fragment key={g.key}>
                  <th className="pm-tr">Target</th><th className="pm-tr pm-tr--real">Realisasi</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.Program}>
                <td className="pm-sticky pm-prog">
                  <span className="pm-chip" style={{ background: metaOf(row.Program).color }} />
                  {row.Program}
                </td>
                {groups.map((g) => (
                  <React.Fragment key={g.key}>
                    <td className="pm-tr">{fmt(g.kind, row[g.t])}</td>
                    <td className="pm-tr pm-tr--real">{fmt(g.kind, row[g.r])}</td>
                  </React.Fragment>
                ))}
                {single.map((s) => <td key={s.key}>{pct(row[s.key])}</td>)}
                <td className="pm-skor">{pct(row.Skor)}</td>
                <td><span className={`pm-badge pm-badge--${statusTone(row.Status)}`}>{row.Status || "—"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* ----- B. PESERTA AKTIF (angkatan berjalan) ----- */
function PesertaAktif({ rows }) {
  return (
    <Section letter="B" title="Peserta Aktif" caption="Angkatan berjalan tiap program">
      <div className="pm-grid pm-grid--cards">
        {rows.map((r) => {
          const aktif = r.Aktif === "" || r.Aktif == null ? null : num(r.Aktif);
          const target = num(r.Target);
          const bayar = num(r.BayarPct);
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
                  width: `${Math.min(100, bayar * 100)}%`,
                  background: metaOf(r.Program).color,
                }} />
              </div>
              <div className="pm-card__stats">
                <span>Sudah bayar <b>{num(r.SudahBayar)}</b></span>
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

/* ----- C. KALDIK CHECKLIST ----- */
function KaldikChecklist({ rows }) {
  const sorted = [...rows].sort((a, b) => num(a.Tanggal) - num(b.Tanggal));
  return (
    <Section letter="C" title="Kaldik Checklist" caption="Agenda kalender akademik bulan ini">
      <ul className="pm-checklist">
        {sorted.length === 0 && <li className="pm-empty">Belum ada agenda bulan ini.</li>}
        {sorted.map((e, i) => {
          const done = truthy(e.Done);
          return (
            <li key={i} className={`pm-check ${done ? "is-done" : ""}`}>
              <span className="pm-check__box">{done ? "✓" : ""}</span>
              <span className="pm-check__date">{num(e.Tanggal)}</span>
              <span className="pm-chip" style={{ background: metaOf(e.Program).color }} />
              <span className="pm-check__prog">{e.Program}</span>
              <span className="pm-check__title">{e.Judul}</span>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/* ----- D. EFISIENSI CASHOUT ----- */
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
          width: `${Math.min(100, eff * 100)}%`,
          background: over ? "#E5484D" : "#0E9F8E",
        }} />
        <span className="pm-bar__mid">{pct(eff)} terpakai dari plan</span>
      </div>
    </Section>
  );
}

/* ----- E. KOMITMEN URGENT ----- */
function KomitmenUrgent({ rows }) {
  return (
    <Section letter="E" title="Komitmen Urgent" caption="Yang harus dieksekusi paling dulu">
      <div className="pm-urgent">
        {rows.length === 0 && <div className="pm-empty">Tidak ada komitmen urgent. 🎉</div>}
        {rows.map((c, i) => (
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

/* ----- PAPAN PERFORMA (racing lanes + history mingguan) ----- */
function PapanPerforma({ papan, weekly }) {
  const kpis = ["Daftar Ujian", "Daftar Ulang"];
  const [kpi, setKpi] = useState("Daftar Ujian");
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t); }, []);

  const lanes = useMemo(() => {
    const list = papan.filter((r) => (r.KPI || "").trim() === kpi)
      .map((r) => ({ program: r.Program, pct: num(r.Pct) }))
      .sort((a, b) => b.pct - a.pct);
    return list;
  }, [papan, kpi]);
  const max = Math.max(0.0001, ...lanes.map((l) => l.pct));
  const leader = lanes[0]?.program;

  return (
    <Section letter="" title="Papan Performa" caption="Balapan capaian antar program">
      <div className="pm-kpitoggle">
        {kpis.map((k) => (
          <button key={k} className={`pm-toggle ${kpi === k ? "is-active" : ""}`}
            onClick={() => setKpi(k)}>{k}</button>
        ))}
      </div>

      <div className="pm-track">
        {lanes.map((l, i) => {
          const w = mounted ? Math.max(8, (l.pct / max) * 100) : 8;
          const isLead = l.program === leader && l.pct > 0;
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
        {lanes.length === 0 && <div className="pm-empty">Belum ada data untuk {kpi}.</div>}
      </div>

      <WeeklyHistory weekly={weekly} />
    </Section>
  );
}

function WeeklyHistory({ weekly }) {
  const build = (kpi) => {
    const wk = weekly.filter((r) => (r.KPI || "").trim() === kpi)
      .map((r) => ({ week: r.Week, program: r.Program, pct: num(r.Pct) }))
      .sort((a, b) => a.week.localeCompare(b.week));
    const tally = {};
    wk.forEach((w) => { if (w.program) tally[w.program] = (tally[w.program] || 0) + 1; });
    const champ = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    return { wk, champ };
  };
  const cols = [
    { kpi: "Daftar Ujian", ...build("Daftar Ujian") },
    { kpi: "Daftar Ulang", ...build("Daftar Ulang") },
  ];
  if (weekly.length === 0) {
    return (
      <div className="pm-weekly pm-weekly--empty">
        <div className="pm-empty">
          History mingguan belum tersedia. Tambahkan section <code>WEEKLY_LEADER</code> di tab
          90_EXPORT_DASHBOARD (lihat catatan dari Claude).
        </div>
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

/* ----- primitif ----- */
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

  useEffect(() => {
    let alive = true;
    fetch(CSV_URL)
      .then((r) => { if (!r.ok) throw new Error("fetch"); return r.text(); })
      .then((t) => {
        if (!t || t.includes("<html")) throw new Error("not csv");
        const shaped = shapeData(parseCSV(t));
        if (alive) { setData(shaped); setLive(true); }
      })
      .catch(() => { if (alive) setData(SAMPLE); });
    return () => { alive = false; };
  }, []);

  if (!data) return <div className="pm-loading">Memuat scoreboard…</div>;

  return (
    <div className="pm-root">
      <StyleTag />
      <Hero periode={data.periode} pm={data.pm} />
      {!live && <div className="pm-banner">Mode pratinjau (data contoh). Ganti <code>CSV_URL</code> untuk data live.</div>}

      <nav className="pm-tabs">
        <button className={tab === "dashboard" ? "is-active" : ""} onClick={() => setTab("dashboard")}>Dashboard</button>
        <button className={tab === "papan" ? "is-active" : ""} onClick={() => setTab("papan")}>Papan Performa</button>
      </nav>

      <main className="pm-main">
        {tab === "dashboard" ? (
          <>
            <PerformaTim rows={data.performaTim} />
            <PesertaAktif rows={data.pesertaAktif} />
            <KaldikChecklist rows={data.kaldik} />
            <CashoutEfisiensi rows={data.cashflow} />
            <KomitmenUrgent rows={data.commitment} />
          </>
        ) : (
          <PapanPerforma papan={data.papan} weekly={data.weekly} />
        )}
      </main>

      <footer className="pm-footer">Scoreboard PM · {data.periode} · diperbarui otomatis dari Google Sheets</footer>
    </div>
  );
}

/* =====================================================================
   STYLE (di-inject sekali; plain CSS, tanpa Tailwind)
   ===================================================================== */
function StyleTag() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@600&display=swap');

.pm-root{--ink:#14213D;--ink2:#3A4663;--line:#E4E8F0;--bg:#F2F4F8;--card:#fff;
  --gold:#E8A317;--teal:#0E9F8E;--red:#E5484D;
  font-family:'Inter',system-ui,sans-serif;color:var(--ink);background:var(--bg);min-height:100vh;}
*{box-sizing:border-box}
.pm-loading{font-family:'Inter',sans-serif;padding:80px;text-align:center;color:#64748B}
.pm-banner{max-width:1180px;margin:14px auto 0;padding:9px 16px;background:#FEF3C7;border:1px solid #FCD34D;
  border-radius:10px;font-size:13px;color:#92400E}
.pm-banner code,.pm-empty code{background:#fff;padding:1px 6px;border-radius:5px;font-family:'JetBrains Mono',monospace;font-size:12px}

/* HERO */
.pm-hero{position:relative;min-height:230px;background:linear-gradient(135deg,#14213D,#22386b 60%,#2D6CDF);
  background-size:cover;background-position:center;display:flex;align-items:flex-end;overflow:hidden}
.pm-hero__scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,18,38,.25),rgba(11,18,38,.82))}
.pm-hero__inner{position:relative;max-width:1180px;width:100%;margin:0 auto;padding:30px 24px 26px}
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
.pm-skor{font-weight:800;font-family:'Plus Jakarta Sans',sans-serif}
.pm-badge{font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;letter-spacing:.02em}
.pm-badge--crit{background:#FDECEC;color:#C0392B}
.pm-badge--warn{background:#FEF6E7;color:#B7791F}
.pm-badge--ok{background:#E7F6F1;color:#0B7A66}
.pm-badge--muted{background:#EEF1F6;color:#7C879F}

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

/* CHECKLIST */
.pm-checklist{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.pm-check{display:flex;align-items:center;gap:11px;border:1px solid var(--line);border-radius:11px;padding:10px 13px;font-size:14px}
.pm-check.is-done{background:#F6FBF9;border-color:#CDEBE2}
.pm-check__box{width:21px;height:21px;border-radius:6px;border:1.5px solid #CBD4E3;display:grid;place-items:center;
  color:#fff;font-size:13px;font-weight:800;flex:none}
.pm-check.is-done .pm-check__box{background:var(--teal);border-color:var(--teal)}
.pm-check__date{font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;width:26px;text-align:center}
.pm-check__prog{font-weight:700;font-size:13px}
.pm-check__title{color:var(--ink2)}
.pm-check.is-done .pm-check__title{text-decoration:line-through;color:#9AA4B8}

/* URGENT */
.pm-urgent{display:flex;flex-direction:column;gap:9px}
.pm-urgent__item{display:flex;align-items:center;gap:13px;border:1px solid #F3D2D2;background:#FEF7F7;border-radius:11px;padding:11px 14px}
.pm-urgent__flag{font-size:10px;font-weight:800;letter-spacing:.06em;color:#fff;background:var(--red);padding:4px 9px;border-radius:6px;flex:none}
.pm-urgent__title{font-weight:600;font-size:14px}
.pm-urgent__due{margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:12px;color:#C0392B;flex:none}

/* PAPAN PERFORMA */
.pm-kpitoggle{display:flex;gap:8px;margin-bottom:20px}
.pm-toggle{font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:13px;border:1px solid var(--line);
  background:#fff;color:var(--ink2);padding:8px 16px;border-radius:9px;cursor:pointer}
.pm-toggle.is-active{background:var(--ink);color:#fff;border-color:var(--ink)}
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
.pm-ava--init{display:grid;place-items:center;color:#fff;font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;
  font-size:11px;border:2px solid #fff}
.pm-empty{color:#8A93A8;font-size:13px;padding:10px 2px}
.pm-footer{max-width:1180px;margin:8px auto 0;padding:20px 24px 36px;color:#9AA4B8;font-size:12px;text-align:center}

@media(max-width:720px){
  .pm-grid--3{grid-template-columns:1fr}
  .pm-weekly__cols{grid-template-columns:1fr}
  .pm-lane__name{width:50px;font-size:12px}
}
@media(prefers-reduced-motion:reduce){
  .pm-bar__fill,.pm-lane__fill,.pm-lane__runner{transition:none}
  .pm-lane__crown{animation:none}
}
`;
