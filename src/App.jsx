import React, { useState, useEffect, useMemo } from "react";
import { LineChart, Line, ResponsiveContainer } from "recharts";

// ─────────────────────────────────────────────────────────────
// LIVE DATA SOURCE
// Ganti CSV_URL dengan link publish-to-web tab 90_EXPORT_DASHBOARD:
// Google Sheets -> File -> Share -> Publish to web -> pilih tab
// 90_EXPORT_DASHBOARD -> format CSV -> copy link di sini.
// ─────────────────────────────────────────────────────────────
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSxeXQjctXiL9WBqxDHgb4GtMIcUgw2OkoD6xZFwkrfLhvUMAA-hUPTP5D8mrqMjNwAmowpkfzmtk19/pub?gid=1965086356&single=true&output=csv"; // <-- paste URL publish-to-web CSV di sini

function parseCSV(text) {
  const rows = text.split(/\r?\n/).map(r => {
    const out = []; let cur = ""; let q = false;
    for (let i=0;i<r.length;i++){
      const ch=r[i];
      if (ch==='"'){ q=!q; continue; }
      if (ch===',' && !q){ out.push(cur); cur=""; continue; }
      cur+=ch;
    }
    out.push(cur);
    return out;
  });
  return rows;
}

function num(v){ const n = parseFloat(String(v).replace(/[^0-9.\-]/g,"")); return isNaN(n)?0:n; }
function findSection(rows, label) {
  const idx = rows.findIndex(r => r[0] === label);
  if (idx === -1) return [];
  const out = [];
  for (let i=idx+2; i<rows.length; i++) {
    if (!rows[i] || (!rows[i][0] && !rows[i][1])) break;
    if (rows[i][0] && ["Header","PERFORMA_TIM","PAPAN_PERFORMA","KALDIK_EVENTS","CASHFLOW","RAPOT_INDEKS"].includes(rows[i][0])) break;
    out.push(rows[i]);
  }
  return out;
}
function progColorFallback(p){ const m={DBE:"#2563eb",MMBA:"#7c3aed",SIC:"#0891b2",DBS:"#ea580c",Brevet:"#16a34a",CCC:"#64748b"}; return m[p]||"#94a3b8"; }

function buildDataFromCSV(text) {
  const rows = parseCSV(text);
  const perf = findSection(rows, "PERFORMA_TIM").filter(r=>r[0]);
  const kaldikRaw = findSection(rows, "KALDIK_EVENTS").filter(r=>r[0]);
  const cashRaw = findSection(rows, "CASHFLOW").filter(r=>r[0]);

  const performaTim = perf.map(r => ({
    program: r[0], ujianT:num(r[1]), ujianR:num(r[2]), duT:num(r[3]), duR:num(r[4]),
    biayaT:num(r[5]), biayaR:num(r[6]), skor:num(r[7]),
    trend:[num(r[7])*0.9,num(r[7])*0.95,num(r[7]),num(r[7])],
    status: r[8] || "—",
  }));

  const kaldikEvents = kaldikRaw.map(r => ({ tgl:num(r[0]), prog:r[1], judul:r[2], done: String(r[3]).toUpperCase()==="TRUE" }));
  const cashflow = cashRaw.map(r=>({ bulan:r[0], plan:num(r[1]), actual:num(r[2]) }));
  const totalCashIn = cashflow.reduce((a,c)=>a+c.actual,0);
  const totalCashPlan = cashflow.reduce((a,c)=>a+c.plan,0);

  return {
    periode: rows.find(r=>r[1]==="Periode")?.[2] || "—",
    pm: rows.find(r=>r[1]==="PM")?.[2] || "—",
    ringkasan: {
      jumlahProgram: performaTim.filter(p=>p.skor>0).length,
      cashIn: totalCashIn, cashInDelta: totalCashPlan? (totalCashIn-totalCashPlan)/totalCashPlan : 0,
      cashOut: 0, cashOutDelta: 0,
      profit: totalCashIn, profitDelta: 0,
      performaRata: performaTim.filter(p=>p.skor).reduce((a,p)=>a+p.skor,0)/Math.max(1,performaTim.filter(p=>p.skor).length),
      kaldikDone: kaldikEvents.filter(e=>e.done).length, kaldikTotal: Math.max(1,kaldikEvents.length),
      rapotIndeks: 0,
    },
    performaTim,
    kaldik: { selesai:kaldikEvents.filter(e=>e.done).length, progress:0, terlambat:0, belum:kaldikEvents.filter(e=>!e.done).length, terbaru:[] },
    rapot: { indeks:0, aspek:[] },
    kalenderStrategi: { bulan:"", agenda: kaldikEvents.slice(0,5).map(e=>({tgl:e.tgl, warna: progColorFallback(e.prog), judul:e.judul})) },
    papanPerforma: { minggu:"Minggu ini", daftarUlang:[], daftarUjian:[] },
    kaldikKalender: { bulan: new Date().getMonth()+1, tahun: 2026, events: kaldikEvents },
  };
}

function useDashboardData() {
  const [data, setData] = useState(SAMPLE_DATA);
  const [status, setStatus] = useState(CSV_URL ? "loading" : "sample");
  useEffect(() => {
    if (!CSV_URL) return;
    fetch(CSV_URL)
      .then(r => { if (!r.ok) throw new Error("fetch failed"); return r.text(); })
      .then(text => { setData(buildDataFromCSV(text)); setStatus("live"); })
      .catch(() => setStatus("error"));
  }, []);
  return { data, status };
}

// ─────────────────────────────────────────────────────────────
// SAMPLE DATA — fallback kalau CSV_URL belum diisi atau fetch gagal.
// ─────────────────────────────────────────────────────────────
const SAMPLE_DATA = {
  periode: "Juni 2026",
  pm: "Aldi",
  ringkasan: {
    jumlahProgram: 6,
    cashIn: 2.45e9, cashInDelta: 0.125,
    cashOut: 1.98e9, cashOutDelta: -0.053,
    profit: 470e6, profitDelta: 0.287,
    performaRata: 0.82,
    kaldikDone: 18, kaldikTotal: 25,
    rapotIndeks: 4.2,
  },
  performaTim: [
    { program: "DBE",   ujianT: 120, ujianR: 128, duT: 80, duR: 72, biayaT: 800e6, biayaR: 860e6, skor: 0.85, trend: [78,80,83,85], status: "Baik" },
    { program: "MMBA",  ujianT: 100, ujianR: 95,  duT: 70, duR: 60, biayaT: 600e6, biayaR: 550e6, skor: 0.78, trend: [82,79,77,78], status: "Perhatian" },
    { program: "SIC",   ujianT: 80,  ujianR: 90,  duT: 50, duR: 55, biayaT: 400e6, biayaR: 440e6, skor: 0.90, trend: [85,88,89,90], status: "Baik" },
    { program: "DBS",   ujianT: 60,  ujianR: 50,  duT: 40, duR: 45, biayaT: 300e6, biayaR: 280e6, skor: 0.75, trend: [73,74,76,75], status: "Perhatian" },
    { program: "Brevet",ujianT: 90,  ujianR: 88,  duT: 60, duR: 58, biayaT: 350e6, biayaR: 345e6, skor: 0.83, trend: [80,81,82,83], status: "Baik" },
    { program: "CCC",   ujianT: 0,   ujianR: 0,   duT: 0,  duR: 0,  biayaT: 0,     biayaR: 0,     skor: 0,    trend: [0,0,0,0],     status: "—" },
  ],
  kaldik: { selesai: 18, progress: 5, terlambat: 2, belum: 0,
    terbaru: ["Review materi ujian — MMBA","Persiapan Daftar Ulang — DBE","Campaign Biaya Bulan Depan — SIC"] },
  rapot: { indeks: 4.2, aspek: [
    { nama: "Akademik", skor: 4.3 }, { nama: "Operasional", skor: 4.1 },
    { nama: "Keuangan", skor: 4.0 }, { nama: "Tim & SDM", skor: 4.4 },
    { nama: "Kepuasan Peserta", skor: 4.2 } ] },
  kalenderStrategi: { bulan: "Juni 2026", agenda: [
    { tgl: 7,  warna: "#22c55e", judul: "Evaluasi Bulanan Program" },
    { tgl: 12, warna: "#3b82f6", judul: "Launch Campaign MMBA" },
    { tgl: 16, warna: "#eab308", judul: "Review Cashflow" },
    { tgl: 21, warna: "#ef4444", judul: "Meeting PM & Tim Program" },
    { tgl: 28, warna: "#a855f7", judul: "Laporan Performa ke Direksi" },
  ]},
  // Papan Performa — ranking program (DU & Daftar Ujian) per minggu
  papanPerforma: {
    minggu: "Minggu 3 — Juni 2026",
    daftarUlang: [
      { program: "Brevet", pct: 1.50 }, { program: "DBS", pct: 1.00 },
      { program: "MMBA", pct: 0.60 }, { program: "DBE", pct: 0.40 }, { program: "SIC", pct: 0.33 },
    ],
    daftarUjian: [
      { program: "MMBA", pct: 0.14 }, { program: "DBE", pct: 0.10 },
      { program: "SIC", pct: 0.08 }, { program: "DBS", pct: 0.05 }, { program: "Brevet", pct: 0.03 },
    ],
  },
  // Kaldik kalender — event per tanggal
  kaldikKalender: { bulan: 6, tahun: 2026, events: [
    { tgl: 2,  prog: "DBE", judul: "Orientasi Batch 6", done: true },
    { tgl: 9,  prog: "SIC", judul: "Company Visit", done: true },
    { tgl: 11, prog: "MMBA", judul: "Webinar Publik", done: true },
    { tgl: 17, prog: "DBE", judul: "Sertifikasi", done: false },
    { tgl: 21, prog: "All", judul: "Graduation Bersama", done: false },
    { tgl: 26, prog: "DBS", judul: "Kelas Tamu", done: false },
  ]},
};

const NAVY = "#16335c", NAVY2 = "#1f4576", INK = "#0f1d33";
const rupiah = (n) => n >= 1e9 ? `Rp ${(n/1e9).toFixed(2)} M` : n >= 1e6 ? `Rp ${Math.round(n/1e6)} jt` : `Rp ${n.toLocaleString("id")}`;
const pct = (n) => `${Math.round(n*100)}%`;
const progColor = { DBE:"#2563eb", MMBA:"#7c3aed", SIC:"#0891b2", DBS:"#ea580c", Brevet:"#16a34a", CCC:"#64748b", All:"#16335c" };

function StatCard({ label, value, sub, delta, tone="neutral" }) {
  const tones = {
    blue:"#eff4fb", green:"#eaf6ee", red:"#fdecec", amber:"#fdf4e3",
    violet:"#f1ecfb", cyan:"#e8f4f8", mint:"#eaf6f0", neutral:"#f1f4f8",
  };
  const accents = {
    blue:"#2563eb", green:"#16a34a", red:"#dc2626", amber:"#d97706",
    violet:"#7c3aed", cyan:"#0891b2", mint:"#0d9488", neutral:"#475569",
  };
  return (
    <div style={{ background: tones[tone], borderRadius: 16, padding: "16px 18px", border:"1px solid rgba(0,0,0,.04)", minWidth: 0 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: accents[tone], lineHeight: 1.1, letterSpacing:"-.01em" }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color:"#334155", marginTop: 4, textTransform:"uppercase", letterSpacing:".04em" }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color:"#64748b", marginTop: 2 }}>{sub}</div>}
      {delta !== undefined && (
        <div style={{ fontSize: 11, fontWeight: 700, marginTop: 6, color: delta>=0 ? "#16a34a":"#dc2626" }}>
          {delta>=0 ? "▲":"▼"} {Math.abs(delta*100).toFixed(1)}% bulan ini
        </div>
      )}
    </div>
  );
}

function Donut({ value, size=120, stroke=14, color="#16a34a" }) {
  const r = (size-stroke)/2, circ = 2*Math.PI*r;
  const [anim, setAnim] = useState(0);
  useEffect(()=>{ const t=setTimeout(()=>setAnim(value),120); return ()=>clearTimeout(t); },[value]);
  return (
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e8edf3" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={circ*(1-anim)} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition:"stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1)" }}/>
      <text x="50%" y="48%" textAnchor="middle" dominantBaseline="central" fontSize={size*0.2} fontWeight="800" fill={INK}>{Math.round(value*100)}%</text>
    </svg>
  );
}

function statusPill(s) {
  const map = { "Baik":["#dcfce7","#15803d"], "Perhatian":["#fef3c7","#b45309"], "Kritis":["#fee2e2","#b91c1c"], "—":["#f1f5f9","#94a3b8"] };
  const [bg,fg] = map[s]||map["—"];
  return <span style={{ background:bg, color:fg, fontSize:11, fontWeight:800, padding:"4px 12px", borderRadius:999, textTransform:"uppercase", letterSpacing:".03em" }}>{s}</span>;
}

// ── OVERVIEW ──
function Overview({ data }) {
  const d = data, r = d.ringkasan;
  const tot = d.performaTim.reduce((a,p)=>({ujianT:a.ujianT+p.ujianT,ujianR:a.ujianR+p.ujianR,duT:a.duT+p.duT,duR:a.duR+p.duR,biayaT:a.biayaT+p.biayaT,biayaR:a.biayaR+p.biayaR}),{ujianT:0,ujianR:0,duT:0,duR:0,biayaT:0,biayaR:0});
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:12, marginBottom:16 }}>
        <StatCard tone="blue"   label="Program Dimonitor" value={r.jumlahProgram} sub="program aktif"/>
        <StatCard tone="green"  label="Cash In"  value={rupiah(r.cashIn)}  delta={r.cashInDelta}/>
        <StatCard tone="red"    label="Cash Out" value={rupiah(r.cashOut)} delta={r.cashOutDelta}/>
        <StatCard tone="amber"  label="Profit"   value={rupiah(r.profit)}  delta={r.profitDelta}/>
        <StatCard tone="violet" label="Rata-rata Performa" value={pct(r.performaRata)} sub="skor program"/>
        <StatCard tone="cyan"   label="Kaldik"   value={`${r.kaldikDone}/${r.kaldikTotal}`} sub={`${Math.round(r.kaldikDone/r.kaldikTotal*100)}% terlaksana`}/>
        <StatCard tone="mint"   label="Rapot — Indeks" value={`${r.rapotIndeks}/5`} sub="rata-rata"/>
      </div>

      {/* A. Performa Tim */}
      <section style={card}>
        <SectionTitle eyebrow="A" title="Performa Tim (Utama)" note="Ujian · Daftar Ulang · Biaya Pendidikan"/>
        <div style={{ overflowX:"auto" }}>
          <table style={tbl}>
            <thead>
              <tr>
                <th style={thL}>Program</th>
                <th style={th}>Ujian T</th><th style={th}>Ujian R</th><th style={th}>%</th>
                <th style={th}>DU T</th><th style={th}>DU R</th><th style={th}>%</th>
                <th style={th}>Biaya T</th><th style={th}>Biaya R</th><th style={th}>%</th>
                <th style={th}>Skor</th><th style={th}>Trend</th><th style={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {d.performaTim.map((p,i)=>(
                <tr key={p.program} style={{ background: i%2?"#f8fafc":"#fff" }}>
                  <td style={tdL}><span style={{ width:9,height:9,borderRadius:3,background:progColor[p.program],display:"inline-block",marginRight:8}}/>{p.program}</td>
                  <td style={td}>{p.ujianT||"—"}</td><td style={td}>{p.ujianR||"—"}</td><td style={tdPct(p.ujianR,p.ujianT)}>{p.ujianT?pct(p.ujianR/p.ujianT):"—"}</td>
                  <td style={td}>{p.duT||"—"}</td><td style={td}>{p.duR||"—"}</td><td style={tdPct(p.duR,p.duT)}>{p.duT?pct(p.duR/p.duT):"—"}</td>
                  <td style={td}>{p.biayaT?rupiah(p.biayaT):"—"}</td><td style={td}>{p.biayaR?rupiah(p.biayaR):"—"}</td><td style={tdPct(p.biayaR,p.biayaT)}>{p.biayaT?pct(p.biayaR/p.biayaT):"—"}</td>
                  <td style={{...td,fontWeight:800}}>{p.skor?pct(p.skor):"—"}</td>
                  <td style={td}>
                    <div style={{ width:64, height:26, margin:"0 auto" }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={p.trend.map((v,ix)=>({x:ix,y:v}))}>
                          <Line type="monotone" dataKey="y" stroke={progColor[p.program]} strokeWidth={2} dot={false} isAnimationActive/>
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </td>
                  <td style={td}>{statusPill(p.status)}</td>
                </tr>
              ))}
              <tr style={{ background:"#eef2f7", fontWeight:800 }}>
                <td style={tdL}>TOTAL/AVG</td>
                <td style={td}>{tot.ujianT}</td><td style={td}>{tot.ujianR}</td><td style={td}>{pct(tot.ujianR/tot.ujianT)}</td>
                <td style={td}>{tot.duT}</td><td style={td}>{tot.duR}</td><td style={td}>{pct(tot.duR/tot.duT)}</td>
                <td style={td}>{rupiah(tot.biayaT)}</td><td style={td}>{rupiah(tot.biayaR)}</td><td style={td}>{pct(tot.biayaR/tot.biayaT)}</td>
                <td style={td}>{pct(d.performaTim.filter(p=>p.skor).reduce((a,p)=>a+p.skor,0)/d.performaTim.filter(p=>p.skor).length)}</td>
                <td style={td}>—</td><td style={td}>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* B-E grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:16, marginTop:16 }}>
        {/* B. Kaldik */}
        <section style={card}>
          <SectionTitle eyebrow="B" title="Kaldik — Checklist"/>
          <div style={{ display:"flex", gap:16, alignItems:"center" }}>
            <Donut value={d.kaldik.selesai/(d.kaldik.selesai+d.kaldik.progress+d.kaldik.terlambat+d.kaldik.belum)} color="#16a34a"/>
            <div style={{ flex:1, fontSize:13 }}>
              {[["Selesai",d.kaldik.selesai,"#22c55e"],["Progress",d.kaldik.progress,"#eab308"],["Terlambat",d.kaldik.terlambat,"#ef4444"],["Belum",d.kaldik.belum,"#94a3b8"]].map(([l,v,c])=>(
                <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"3px 0" }}>
                  <span><span style={{display:"inline-block",width:8,height:8,borderRadius:99,background:c,marginRight:7}}/>{l}</span>
                  <b>{v}</b>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop:12, fontSize:12, color:"#475569" }}>
            <div style={{ fontWeight:700, marginBottom:4 }}>Perlu perhatian:</div>
            {d.kaldik.terbaru.map((t,i)=><div key={i} style={{padding:"2px 0"}}>• {t}</div>)}
          </div>
        </section>

        {/* C. Cashflow */}
        <section style={card}>
          <SectionTitle eyebrow="C" title="Efisiensi Cashflow"/>
          <div style={{ display:"flex", gap:10 }}>
            <div style={{ flex:1, background:"#eaf6ee", borderRadius:12, padding:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#15803d" }}>CASH IN</div>
              <div style={{ fontSize:18, fontWeight:800, color:"#16a34a" }}>{rupiah(r.cashIn)}</div>
              <div style={{ fontSize:11, color:"#16a34a" }}>▲ {(r.cashInDelta*100).toFixed(1)}% vs target</div>
            </div>
            <div style={{ flex:1, background:"#fdecec", borderRadius:12, padding:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#b91c1c" }}>CASH OUT</div>
              <div style={{ fontSize:18, fontWeight:800, color:"#dc2626" }}>{rupiah(r.cashOut)}</div>
              <div style={{ fontSize:11, color:"#dc2626" }}>▼ {Math.abs(r.cashOutDelta*100).toFixed(1)}% vs budget</div>
            </div>
          </div>
          <div style={{ marginTop:10, background:"#fdf4e3", borderRadius:12, padding:12, textAlign:"center" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#b45309" }}>PROFIT</div>
            <div style={{ fontSize:24, fontWeight:800, color:"#d97706" }}>{rupiah(r.profit)}</div>
            <div style={{ fontSize:11, color:"#16a34a" }}>▲ {(r.profitDelta*100).toFixed(1)}% vs target</div>
          </div>
        </section>

        {/* D. Rapot/SIS */}
        <section style={card}>
          <SectionTitle eyebrow="D" title="Rapot — SIS"/>
          <div style={{ textAlign:"center", marginBottom:8 }}>
            <div style={{ fontSize:30, fontWeight:800, color:INK }}>{d.rapot.indeks} <span style={{fontSize:16,color:"#94a3b8"}}>/5</span></div>
            <div style={{ color:"#eab308", fontSize:20, letterSpacing:2 }}>{"★".repeat(Math.round(d.rapot.indeks))}<span style={{color:"#e2e8f0"}}>{"★".repeat(5-Math.round(d.rapot.indeks))}</span></div>
          </div>
          {d.rapot.aspek.map(a=>(
            <div key={a.nama} style={{ marginBottom:7 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:2 }}><span>{a.nama}</span><b>{a.skor}</b></div>
              <div style={{ height:7, background:"#eef2f7", borderRadius:99 }}>
                <div style={{ width:`${a.skor/5*100}%`, height:"100%", background:"#16a34a", borderRadius:99, transition:"width 1s" }}/>
              </div>
            </div>
          ))}
        </section>

        {/* E. Kalender Strategi */}
        <section style={card}>
          <SectionTitle eyebrow="E" title="Kalender Strategi"/>
          <MiniCalendar bulan={6} tahun={2026} agenda={d.kalenderStrategi.agenda}/>
          <div style={{ marginTop:10, fontSize:12 }}>
            <div style={{ fontWeight:700, marginBottom:5 }}>Agenda terdekat:</div>
            {d.kalenderStrategi.agenda.map((a,i)=>(
              <div key={i} style={{ display:"flex", gap:8, padding:"3px 0", alignItems:"center" }}>
                <span style={{ width:9, height:9, borderRadius:99, background:a.warna }}/>
                <b style={{ width:48 }}>{a.tgl} Jun</b><span style={{ color:"#475569" }}>{a.judul}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function MiniCalendar({ bulan, tahun, agenda }) {
  const first = new Date(tahun, bulan-1, 1).getDay(); // 0=Sun
  const offset = (first+6)%7; // Mon-first
  const days = new Date(tahun, bulan, 0).getDate();
  const marks = Object.fromEntries(agenda.map(a=>[a.tgl,a.warna]));
  const cells = [...Array(offset).fill(null), ...Array.from({length:days},(_,i)=>i+1)];
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, fontSize:10, textAlign:"center", color:"#94a3b8", fontWeight:700, marginBottom:4 }}>
        {["Sen","Sel","Rab","Kam","Jum","Sab","Min"].map(d=><div key={d}>{d}</div>)}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
        {cells.map((c,i)=>(
          <div key={i} style={{ aspectRatio:"1", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, borderRadius:7,
            position:"relative", background: c&&marks[c]?marks[c]:c?"#f4f7fb":"transparent", color: c&&marks[c]?"#fff":"#334155", fontWeight: marks[c]?800:500 }}>
            {c}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PAPAN PERFORMA ──
function PapanPerforma({ data }) {
  const { minggu, daftarUlang, daftarUjian } = data.papanPerforma;
  return (
    <div>
      <div style={{ textAlign:"center", marginBottom:20 }}>
        <h2 style={{ fontSize:34, fontWeight:900, color:NAVY, margin:0, letterSpacing:"-.02em" }}>🚀 PAPAN PERFORMA</h2>
        <div style={{ color:"#64748b", fontWeight:600, marginTop:2 }}>{minggu}</div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))", gap:20 }}>
        <RankBoard title="DAFTAR ULANG" rows={daftarUlang} accent="#7c3aed"/>
        <RankBoard title="DAFTAR UJIAN" rows={daftarUjian} accent="#0891b2"/>
      </div>
    </div>
  );
}

function RankBoard({ title, rows, accent }) {
  const max = Math.max(...rows.map(r=>r.pct), 0.01);
  const sorted = [...rows].sort((a,b)=>b.pct-a.pct);
  const [show, setShow] = useState(false);
  useEffect(()=>{ const t=setTimeout(()=>setShow(true),100); return ()=>clearTimeout(t); },[]);
  return (
    <div style={{ ...card, padding:20 }}>
      <h3 style={{ textAlign:"center", color:NAVY, fontWeight:800, marginTop:0, marginBottom:18, letterSpacing:".02em" }}>{title}</h3>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        {sorted.map((r,i)=>(
          <div key={r.program} style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:64, textAlign:"right", fontWeight:700, fontSize:13, color:"#334155" }}>
              {i===0 && <span style={{marginRight:4}}>👑</span>}{r.program}
            </div>
            <div style={{ flex:1, background:"#eef2f7", borderRadius:99, height:34, position:"relative", overflow:"hidden" }}>
              <div style={{ width: show?`${Math.max(r.pct/max*100,8)}%`:"0%", height:"100%",
                background: i===0?`linear-gradient(90deg,${accent},#a855f7)`:accent, borderRadius:99,
                transition:`width 1.1s cubic-bezier(.34,1.2,.4,1) ${i*0.12}s`, display:"flex", alignItems:"center", justifyContent:"flex-end",
                paddingRight:12, boxSizing:"border-box" }}>
                <span style={{ color:"#fff", fontWeight:800, fontSize:13 }}>{Math.round(r.pct*100)}%</span>
              </div>
              {i===0 && <span style={{ position:"absolute", right:-2, top:-2, fontSize:18 }}>🏆</span>}
            </div>
          </div>
        ))}
      </div>
      <div style={{ textAlign:"center", marginTop:16, fontSize:12, color:"#64748b" }}>
        Top minggu ini: <b style={{ color:accent }}>{sorted[0]?.program}</b> 🎉
      </div>
    </div>
  );
}

// ── KALDIK KALENDER ──
function KaldikView({ data }) {
  const { bulan, tahun, events } = data.kaldikKalender;
  const first = new Date(tahun, bulan-1, 1).getDay();
  const offset = (first+6)%7;
  const days = new Date(tahun, bulan, 0).getDate();
  const byDay = {};
  events.forEach(e=>{ (byDay[e.tgl]=byDay[e.tgl]||[]).push(e); });
  const cells = [...Array(offset).fill(null), ...Array.from({length:days},(_,i)=>i+1)];
  const done = events.filter(e=>e.done).length;
  const namaBulan = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"][bulan-1];
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
        <h2 style={{ fontSize:26, fontWeight:800, color:NAVY, margin:0 }}>📅 Kaldik — {namaBulan} {tahun}</h2>
        <div style={{ background:"#eaf6ee", borderRadius:12, padding:"8px 16px", fontWeight:700, color:"#15803d" }}>
          {done}/{events.length} terlaksana ({Math.round(done/events.length*100)}%)
        </div>
      </div>
      <section style={card}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:6, fontSize:12, fontWeight:700, color:"#64748b", textAlign:"center", marginBottom:6 }}>
          {["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"].map(d=><div key={d}>{d}</div>)}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:6 }}>
          {cells.map((c,i)=>(
            <div key={i} style={{ minHeight:84, borderRadius:10, padding:6, background: c?"#f8fafc":"transparent", border: c?"1px solid #eef2f7":"none" }}>
              {c && <div style={{ fontSize:12, fontWeight:700, color:"#94a3b8", marginBottom:3 }}>{c}</div>}
              {(byDay[c]||[]).map((e,ix)=>(
                <div key={ix} style={{ fontSize:10, background: progColor[e.prog]+"1a", color: progColor[e.prog], borderLeft:`3px solid ${progColor[e.prog]}`,
                  borderRadius:4, padding:"2px 5px", marginBottom:3, lineHeight:1.25 }}>
                  <b>{e.prog}</b> {e.judul} {e.done?"✅":"⏳"}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ── shared styles ──
const card = { background:"#fff", borderRadius:18, padding:20, border:"1px solid #eef2f7", boxShadow:"0 1px 3px rgba(15,29,51,.05)" };
const tbl = { width:"100%", borderCollapse:"collapse", fontSize:12, minWidth:760 };
const th = { padding:"8px 6px", color:"#64748b", fontWeight:700, fontSize:10, textTransform:"uppercase", letterSpacing:".03em", borderBottom:"2px solid #eef2f7", textAlign:"center" };
const thL = { ...th, textAlign:"left", paddingLeft:10 };
const td = { padding:"9px 6px", textAlign:"center", borderBottom:"1px solid #f1f5f9" };
const tdL = { ...td, textAlign:"left", paddingLeft:10, fontWeight:700 };
const tdPct = (r,t) => ({ ...td, fontWeight:700, color: !t?"#94a3b8": r/t>=1?"#16a34a": r/t>=0.8?"#d97706":"#dc2626" });

function SectionTitle({ eyebrow, title, note }) {
  return (
    <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:14 }}>
      <span style={{ background:NAVY, color:"#fff", width:24, height:24, borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:13 }}>{eyebrow}</span>
      <h3 style={{ margin:0, fontSize:16, fontWeight:800, color:INK }}>{title}</h3>
      {note && <span style={{ fontSize:12, color:"#94a3b8" }}>{note}</span>}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    live:    { bg:"#dcfce7", fg:"#15803d", label:"🟢 Live dari Google Sheets" },
    sample:  { bg:"#fef3c7", fg:"#b45309", label:"🟡 Data contoh — isi CSV_URL untuk live" },
    loading: { bg:"#e0f2fe", fg:"#0369a1", label:"⏳ Memuat data..." },
    error:   { bg:"#fee2e2", fg:"#b91c1c", label:"🔴 Gagal memuat — pakai data contoh" },
  };
  const s = map[status] || map.sample;
  return <div style={{ background:s.bg, color:s.fg, fontSize:11, fontWeight:700, padding:"6px 14px", borderRadius:999, display:"inline-block" }}>{s.label}</div>;
}

export default function App() {
  const [tab, setTab] = useState("overview");
  const { data, status } = useDashboardData();
  const tabs = [["overview","Overview"],["papan","Papan Performa"],["kaldik","Kaldik"]];
  return (
    <div style={{ fontFamily:"'Inter',system-ui,sans-serif", background:"#eef1f6", minHeight:"100vh", padding:"0 0 40px" }}>
      {/* header */}
      <header style={{ background:`linear-gradient(120deg,${INK},${NAVY2})`, color:"#fff", padding:"22px 28px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:14 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:900, letterSpacing:"-.02em" }}>PM Scoreboard — Overview Performa</h1>
          <div style={{ opacity:.8, fontSize:13, marginTop:2 }}>Monitoring kinerja program di bawah pengawasan PM</div>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <div style={{ background:"rgba(255,255,255,.12)", borderRadius:12, padding:"8px 16px", textAlign:"center" }}>
            <div style={{ fontSize:10, opacity:.7, textTransform:"uppercase" }}>Periode</div>
            <div style={{ fontWeight:800 }}>{data.periode}</div>
          </div>
          <div style={{ background:"rgba(255,255,255,.12)", borderRadius:12, padding:"8px 16px", textAlign:"center" }}>
            <div style={{ fontSize:10, opacity:.7, textTransform:"uppercase" }}>Project Manager</div>
            <div style={{ fontWeight:800 }}>{data.pm}</div>
          </div>
        </div>
      </header>

      {/* tabs + status */}
      <nav style={{ display:"flex", gap:6, padding:"14px 28px 0", background:"#fff", borderBottom:"1px solid #eef2f7", position:"sticky", top:0, zIndex:5, alignItems:"center", justifyContent:"space-between", flexWrap:"wrap" }}>
        <div style={{ display:"flex", gap:6 }}>
          {tabs.map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)} style={{
              border:"none", background:"none", padding:"10px 16px", fontSize:14, fontWeight:700, cursor:"pointer",
              color: tab===k?NAVY:"#94a3b8", borderBottom: tab===k?`3px solid ${NAVY}`:"3px solid transparent", marginBottom:-1 }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ paddingBottom:10 }}><StatusBadge status={status}/></div>
      </nav>

      <main style={{ padding:"22px 28px", maxWidth:1280, margin:"0 auto" }}>
        {tab==="overview" && <Overview data={data}/>}
        {tab==="papan" && <PapanPerforma data={data}/>}
        {tab==="kaldik" && <KaldikView data={data}/>}
      </main>

      <footer style={{ textAlign:"center", fontSize:11, color:"#94a3b8", padding:"0 28px" }}>
        Sumber data: tab 90_EXPORT_DASHBOARD (publish-to-web CSV). Refresh halaman untuk update terbaru.
      </footer>
    </div>
  );
}
