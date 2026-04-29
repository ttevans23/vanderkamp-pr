import { useState, useEffect, useCallback, useRef } from "react";

/* ════════════════════════════════════════════════════════════════════════
   SHARED STORAGE SHIM
   The artifact-runtime API was `window.storage.get/set` returning {value}.
   In production we proxy through /api/storage backed by Vercel KV so all
   team members see the same dashboard, library, SEO tracker, and dashboard
   moves. Falls back to localStorage if the API call fails (so a flaky
   network doesn't break the UI).
   ════════════════════════════════════════════════════════════════════════ */

const sharedStorage = {
  get: async (key) => {
    try {
      const res = await fetch(`/api/storage?key=${encodeURIComponent(key)}`);
      if (!res.ok) throw new Error(`storage GET ${res.status}`);
      const data = await res.json();
      if (data.value === null || data.value === undefined) {
        // Fall back to localStorage if remote has nothing yet
        const local = localStorage.getItem(key);
        return local === null ? null : { value: local };
      }
      // Cache to localStorage for instant subsequent loads
      try { localStorage.setItem(key, data.value); } catch {}
      return { value: data.value };
    } catch (err) {
      console.warn(`sharedStorage.get fallback for ${key}:`, err.message);
      const local = localStorage.getItem(key);
      return local === null ? null : { value: local };
    }
  },
  set: async (key, value) => {
    // Always write through to localStorage immediately for UI responsiveness
    try { localStorage.setItem(key, value); } catch {}
    try {
      const res = await fetch("/api/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) throw new Error(`storage SET ${res.status}`);
      return { value };
    } catch (err) {
      console.warn(`sharedStorage.set fallback for ${key}:`, err.message);
      return { value };
    }
  },
};

if (typeof window !== "undefined") {
  // Make storage available under window.storage so the rest of the
  // component code (originally written against window.storage) works
  // without further changes.
  window.storage = sharedStorage;
}

/* ════════════════════════════════════════════════════════════════════════
   VANDERKAMP PR COMMAND CENTER — v6
   Four-track coverage: Offsites & Fieldwork · Weddings · Stays · Wellness
   ════════════════════════════════════════════════════════════════════════ */

// ─── STYLES ──────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=DM+Mono:wght@300;400;500&family=Libre+Baskerville:ital@0;1&display=swap');
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  :root {
    --forest:#1a2e1f; --canopy:#243528; --moss:#3d5c42; --sage:#7aab7f;
    --mist:#b8d4bc; --cream:#f4efe6; --warm:#ede4d3; --amber:#d4a843; --ember:#c17a2e;
    --red:rgba(224,112,112,1); --blue:#a0b8d4; --purple:#c4a0d4;
    --green:#7aab7f; --teal:#5fa88a; --rose:#d4a0a8;
    --ghost:rgba(244,239,230,0.06); --border:rgba(122,171,127,0.18);
    --border-hi:rgba(122,171,127,0.45); --text-dim:rgba(244,239,230,0.42);
    --text-mid:rgba(244,239,230,0.70);
    --track-offsite:#7aab7f; --track-wedding:#d4a0a8; --track-stay:#a0b8d4; --track-wellness:#c4a0d4;
  }
  body { background:var(--forest); color:var(--cream); font-family:'DM Mono',monospace; }
  .app { min-height:100vh; background:var(--forest); background-image:radial-gradient(ellipse 80% 60% at 50% 0%,rgba(61,92,66,0.4) 0%,transparent 60%); padding-bottom:80px; }

  /* Header */
  .header { border-bottom:1px solid var(--border); padding:14px 24px; display:flex; align-items:center; justify-content:space-between; position:sticky; top:0; z-index:100; background:rgba(26,46,31,0.96); backdrop-filter:blur(12px); }
  .wordmark { font-family:'Playfair Display',serif; font-size:18px; font-weight:700; }
  .wordmark span { color:var(--sage); font-style:italic; }
  .tagline { font-size:9px; color:var(--text-dim); letter-spacing:0.14em; text-transform:uppercase; margin-left:10px; }
  .header-right { display:flex; gap:10px; align-items:center; }
  .phase-badge { font-size:9px; letter-spacing:0.1em; text-transform:uppercase; color:var(--amber); border:1px solid rgba(212,168,67,0.35); border-radius:3px; padding:3px 9px; }
  .cycle-badge { font-size:9px; letter-spacing:0.1em; text-transform:uppercase; color:var(--sage); border:1px solid var(--border); border-radius:3px; padding:3px 9px; }
  .version-badge { font-size:9px; letter-spacing:0.1em; text-transform:uppercase; color:var(--text-dim); padding:3px 9px; }

  /* Top nav */
  .top-nav { display:flex; border-bottom:1px solid var(--border); background:rgba(26,46,31,0.5); overflow-x:auto; }
  .top-nav-item { padding:11px 20px; font-size:10px; letter-spacing:0.14em; text-transform:uppercase; color:var(--text-mid); border-bottom:2px solid transparent; cursor:pointer; white-space:nowrap; transition:all .18s ease; background:transparent; border-left:none; border-right:none; border-top:none; }
  .top-nav-item.active { color:var(--cream); border-bottom-color:var(--sage); background:rgba(122,171,127,0.06); }
  .top-nav-item:hover:not(.active) { color:var(--cream); background:rgba(122,171,127,0.03); }

  /* Track filter */
  .track-filter-bar { display:flex; align-items:center; gap:12px; padding:14px 24px; border-bottom:1px solid var(--border); background:rgba(26,46,31,0.3); flex-wrap:wrap; }
  .tf-label { font-size:9px; letter-spacing:0.18em; text-transform:uppercase; color:var(--text-dim); }
  .tf-chip { font-size:10px; letter-spacing:0.1em; text-transform:uppercase; padding:5px 11px; border-radius:3px; cursor:pointer; border:1px solid var(--border); background:transparent; color:var(--text-mid); transition:all .15s ease; }
  .tf-chip:hover { color:var(--cream); border-color:var(--border-hi); }
  .tf-chip.active { background:var(--moss); color:var(--cream); border-color:var(--moss); }
  .tf-chip.all.active { background:var(--sage); color:var(--forest); border-color:var(--sage); }
  .tf-chip.offsite.active { background:var(--track-offsite); color:var(--forest); border-color:var(--track-offsite); }
  .tf-chip.wedding.active { background:var(--track-wedding); color:var(--forest); border-color:var(--track-wedding); }
  .tf-chip.stay.active { background:var(--track-stay); color:var(--forest); border-color:var(--track-stay); }
  .tf-chip.wellness.active { background:var(--track-wellness); color:var(--forest); border-color:var(--track-wellness); }

  /* Container */
  .container { max-width:1280px; margin:0 auto; padding:28px 24px 0; }
  .page-header { margin-bottom:22px; }
  .page-title { font-family:'Playfair Display',serif; font-size:26px; font-weight:600; color:var(--cream); margin-bottom:4px; }
  .page-title em { color:var(--sage); font-style:italic; font-weight:400; }
  .page-desc { font-size:12px; color:var(--text-mid); line-height:1.55; max-width:620px; }

  /* Phase banner */
  .phase-banner { margin-bottom:18px; padding:16px 20px; border:1px solid rgba(212,168,67,0.35); background:rgba(212,168,67,0.04); border-radius:3px; }
  .pb-head { display:flex; align-items:center; gap:10px; margin-bottom:9px; }
  .pb-mark { font-size:9px; letter-spacing:0.18em; text-transform:uppercase; color:var(--amber); padding:2px 8px; border:1px solid rgba(212,168,67,0.4); border-radius:3px; }
  .pb-title { font-size:12px; color:var(--cream); font-weight:500; }
  .pb-body { font-size:11px; color:var(--text-mid); line-height:1.6; }

  /* Idle center */
  .hero-card { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:64px 32px 72px; border:1px solid var(--border); border-radius:4px; background:rgba(244,239,230,0.015); }
  .hero-card h2 { font-family:'Playfair Display',serif; font-size:28px; font-weight:500; color:var(--cream); margin-bottom:10px; text-align:center; }
  .hero-card h2 em { color:var(--sage); font-style:italic; font-weight:400; }
  .hero-sub { font-size:12px; color:var(--text-mid); text-align:center; max-width:540px; line-height:1.7; margin-bottom:28px; }

  /* Buttons */
  .btn-primary { font-family:'DM Mono',monospace; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; padding:13px 28px; background:var(--sage); color:var(--forest); border:none; border-radius:3px; cursor:pointer; font-weight:500; transition:all .2s ease; }
  .btn-primary:hover:not(:disabled) { background:var(--mist); transform:translateY(-1px); }
  .btn-primary:disabled { opacity:.35; cursor:not-allowed; }
  .btn-ghost { font-family:'DM Mono',monospace; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; padding:9px 16px; background:transparent; color:var(--cream); border:1px solid var(--border); border-radius:3px; cursor:pointer; transition:all .18s ease; }
  .btn-ghost:hover { border-color:var(--sage); color:var(--sage); }
  .btn-tiny { font-family:'DM Mono',monospace; font-size:9px; letter-spacing:0.1em; text-transform:uppercase; padding:6px 11px; background:transparent; color:var(--text-mid); border:1px solid var(--border); border-radius:3px; cursor:pointer; transition:all .15s ease; }
  .btn-tiny:hover { color:var(--cream); border-color:var(--border-hi); }
  .btn-tiny.approved { background:var(--sage); color:var(--forest); border-color:var(--sage); }
  .btn-tiny.skipped { background:rgba(224,112,112,0.1); color:var(--red); border-color:rgba(224,112,112,0.3); }

  /* Log */
  .log-panel { margin:24px auto 12px; max-width:720px; border:1px solid var(--border); border-radius:3px; background:rgba(26,46,31,0.6); padding:18px; max-height:360px; overflow-y:auto; }
  .log-entry { font-size:10px; color:var(--text-mid); margin-bottom:6px; line-height:1.55; }
  .log-entry .ts { color:var(--text-dim); margin-right:8px; }
  .log-entry .ag { color:var(--amber); letter-spacing:0.05em; text-transform:uppercase; margin-right:6px; }

  /* Progress */
  .progress-wrap { max-width:640px; margin:20px auto; }
  .progress-label { font-size:11px; color:var(--text-mid); text-align:center; margin-bottom:9px; letter-spacing:0.05em; }
  .progress-bar { height:3px; background:rgba(122,171,127,0.12); border-radius:2px; overflow:hidden; }
  .progress-fill { height:100%; background:linear-gradient(90deg,var(--moss),var(--sage)); transition:width .5s ease; }
  .pulse-dots { display:flex; gap:6px; justify-content:center; margin-top:14px; }
  .pulse-dot { width:5px; height:5px; background:var(--sage); border-radius:50%; animation:pulse 1.2s ease-in-out infinite; }
  .pulse-dot:nth-child(2) { animation-delay:.2s; }
  .pulse-dot:nth-child(3) { animation-delay:.4s; }
  @keyframes pulse { 0%,100% { opacity:.3; transform:scale(0.85); } 50% { opacity:1; transform:scale(1.1); } }

  /* Opportunity cards */
  .cat-group { margin-bottom:26px; }
  .cat-head { display:flex; align-items:center; gap:10px; margin-bottom:10px; padding-bottom:6px; border-bottom:1px solid var(--border); }
  .cat-icon { width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:600; color:var(--forest); }
  .cat-title { font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color:var(--cream); font-weight:500; }
  .cat-count { font-size:10px; color:var(--text-dim); }
  .cat-track { font-size:9px; letter-spacing:0.12em; text-transform:uppercase; padding:2px 7px; border-radius:3px; margin-left:auto; }

  .opp-card { padding:14px 16px; border:1px solid var(--border); border-radius:3px; background:rgba(244,239,230,0.015); margin-bottom:10px; transition:border-color .15s ease; }
  .opp-card:hover { border-color:var(--border-hi); }
  .opp-card.approved { border-color:rgba(122,171,127,0.45); background:rgba(122,171,127,0.05); }
  .opp-card.skipped { opacity:.4; }
  .opp-top { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:8px; }
  .opp-name { font-size:12px; color:var(--cream); font-weight:500; line-height:1.4; }
  .opp-meta { display:flex; gap:8px; flex-shrink:0; align-items:center; }
  .opp-meta .tag { font-size:8px; letter-spacing:0.12em; text-transform:uppercase; padding:2px 7px; border-radius:3px; border:1px solid var(--border); color:var(--text-mid); }
  .opp-meta .tag.seo-high { color:var(--green); border-color:rgba(122,171,127,0.4); }
  .opp-meta .tag.seo-med { color:var(--amber); border-color:rgba(212,168,67,0.4); }
  .opp-meta .tag.seo-low { color:var(--text-dim); }
  .opp-why { font-size:10px; color:var(--text-mid); line-height:1.6; margin-bottom:6px; }
  .opp-action { font-size:10px; color:var(--cream); line-height:1.55; margin-bottom:10px; }
  .opp-action b { color:var(--amber); font-weight:500; }
  .opp-foot { display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; }
  .opp-btns { display:flex; gap:8px; flex-wrap:wrap; }

  /* SEO brief panel */
  .seo-brief { margin-top:10px; padding:12px 14px; border:1px dashed rgba(212,168,67,0.3); border-radius:3px; background:rgba(212,168,67,0.03); font-size:10px; color:var(--text-mid); line-height:1.65; white-space:pre-wrap; }
  .seo-brief .label { font-size:9px; letter-spacing:0.14em; text-transform:uppercase; color:var(--amber); display:block; margin-bottom:6px; }

  /* Approve bar */
  .approve-bar { position:fixed; bottom:0; left:0; right:0; background:rgba(26,46,31,0.98); backdrop-filter:blur(14px); border-top:1px solid var(--border-hi); padding:14px 24px; display:flex; justify-content:space-between; align-items:center; z-index:90; }
  .approve-bar-left { font-size:11px; color:var(--cream); }
  .approve-bar-left b { color:var(--sage); }
  .approve-bar-left span { color:var(--text-dim); margin-left:10px; font-size:10px; }
  .approve-bar-right { display:flex; gap:10px; }

  /* Draft cards */
  .draft-card { padding:18px 20px; border:1px solid var(--border); border-radius:3px; margin-bottom:14px; background:rgba(244,239,230,0.02); }
  .draft-head { display:flex; align-items:center; gap:10px; margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid var(--border); }
  .draft-name { font-size:12px; color:var(--cream); font-weight:500; flex:1; }
  .draft-cat { font-size:9px; letter-spacing:0.14em; text-transform:uppercase; padding:2px 7px; border-radius:3px; }
  .draft-body { font-size:12px; color:var(--cream); line-height:1.78; white-space:pre-wrap; font-family:'DM Mono',monospace; }
  .draft-body h3 { font-family:'Playfair Display',serif; font-size:14px; font-weight:500; margin:12px 0 6px; color:var(--cream); }
  .draft-meta-block { margin-top:14px; padding:12px 14px; border:1px solid var(--border); border-radius:3px; background:rgba(122,171,127,0.03); font-size:10px; color:var(--text-mid); line-height:1.65; }
  .draft-meta-block .label { font-size:9px; letter-spacing:0.14em; text-transform:uppercase; color:var(--sage); margin-bottom:6px; display:block; }
  .draft-meta-block pre { white-space:pre-wrap; font-family:inherit; color:var(--text-mid); }
  .draft-spin { display:flex; align-items:center; gap:12px; font-size:11px; color:var(--text-mid); font-style:italic; }
  .copy-btn { font-family:'DM Mono',monospace; font-size:9px; letter-spacing:0.1em; text-transform:uppercase; padding:4px 10px; background:transparent; color:var(--text-mid); border:1px solid var(--border); border-radius:3px; cursor:pointer; transition:all .15s ease; }
  .copy-btn:hover { color:var(--cream); border-color:var(--border-hi); }

  /* Dashboard */
  .dash-toolbar { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:16px; flex-wrap:wrap; }
  .dash-months-bar { display:flex; gap:6px; flex-wrap:wrap; flex:1; min-width:0; }
  .dash-month-chip { font-size:10px; letter-spacing:0.1em; text-transform:uppercase; padding:7px 13px; border-radius:3px; cursor:pointer; border:1px solid var(--border); background:transparent; color:var(--text-mid); transition:all .15s ease; white-space:nowrap; }
  .dash-month-chip:hover { color:var(--cream); border-color:var(--border-hi); }
  .dash-month-chip.active { background:var(--moss); color:var(--cream); border-color:var(--moss); }
  .dash-month-chip.current { border-color:var(--amber); color:var(--amber); }
  .dash-month-chip.current.active { background:var(--amber); color:var(--forest); border-color:var(--amber); }
  .dash-add-btn { font-family:'DM Mono',monospace; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; padding:8px 14px; background:transparent; color:var(--sage); border:1px solid var(--sage); border-radius:3px; cursor:pointer; flex-shrink:0; transition:all .15s ease; }
  .dash-add-btn:hover { background:var(--sage); color:var(--forest); }

  .dash-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:24px; }
  .dash-col { border:1px solid var(--border); border-radius:3px; padding:16px; background:rgba(244,239,230,0.015); min-height:200px; transition:background .15s ease, border-color .15s ease; }
  .dash-col.drag-over { border-color:var(--sage); background:rgba(122,171,127,0.08); }
  .dash-col.hold { background:rgba(212,168,67,0.03); border-color:rgba(212,168,67,0.2); }
  .dash-col.hold.drag-over { border-color:var(--amber); background:rgba(212,168,67,0.1); }
  .dash-col-head { font-size:10px; letter-spacing:0.18em; text-transform:uppercase; color:var(--amber); margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; gap:8px; }
  .dash-col-head .mo { color:var(--cream); font-weight:500; }
  .dash-col-head .count { font-size:9px; color:var(--text-dim); font-weight:400; letter-spacing:0.08em; }
  .dash-col.hold .dash-col-head { color:rgba(212,168,67,0.85); }

  .dash-item { display:flex; gap:9px; padding:8px 6px; font-size:10px; color:var(--text-mid); line-height:1.5; border-bottom:1px solid rgba(122,171,127,0.05); cursor:grab; transition:color .12s ease, background .12s ease, transform .12s ease; user-select:none; border-radius:2px; }
  .dash-item:last-child { border-bottom:none; }
  .dash-item:hover { color:var(--cream); background:rgba(122,171,127,0.04); }
  .dash-item.done { opacity:.4; text-decoration:line-through; }
  .dash-item.dragging { opacity:.35; cursor:grabbing; }
  .dash-item.custom { border-left:2px solid var(--sage); padding-left:8px; }
  .dash-item input[type="checkbox"] { flex-shrink:0; margin-top:1px; accent-color:var(--sage); cursor:pointer; }
  .dash-item .track-dot { flex-shrink:0; width:7px; height:7px; border-radius:50%; margin-top:5px; }
  .dash-item .item-text { flex:1; min-width:0; word-break:break-word; }
  .dash-item .remove-btn { flex-shrink:0; opacity:0; font-size:11px; color:var(--text-dim); background:transparent; border:none; cursor:pointer; padding:0 2px; transition:opacity .15s ease, color .15s ease; }
  .dash-item:hover .remove-btn { opacity:1; }
  .dash-item .remove-btn:hover { color:var(--red); }
  .dash-item .grip { flex-shrink:0; color:var(--text-dim); font-size:10px; line-height:1; padding-top:2px; cursor:grab; opacity:.5; transition:opacity .12s ease; }
  .dash-item:hover .grip { opacity:1; }
  .drop-placeholder { height:2px; background:var(--sage); margin:2px 0; border-radius:1px; }

  /* Add item modal */
  .add-modal-backdrop { position:fixed; inset:0; background:rgba(26,46,31,0.75); backdrop-filter:blur(6px); z-index:200; display:flex; align-items:center; justify-content:center; padding:24px; }
  .add-modal { background:var(--canopy); border:1px solid var(--border-hi); border-radius:4px; padding:24px; max-width:480px; width:100%; }
  .add-modal h3 { font-family:'Playfair Display',serif; font-size:18px; font-weight:500; color:var(--cream); margin-bottom:16px; }
  .add-modal h3 em { color:var(--sage); font-style:italic; }
  .add-field { margin-bottom:14px; }
  .add-field label { display:block; font-size:9px; letter-spacing:0.14em; text-transform:uppercase; color:var(--text-dim); margin-bottom:6px; }
  .add-field input, .add-field select, .add-field textarea { width:100%; background:rgba(26,46,31,0.7); border:1px solid var(--border); color:var(--cream); padding:9px 12px; border-radius:3px; font-family:'DM Mono',monospace; font-size:12px; }
  .add-field input:focus, .add-field select:focus, .add-field textarea:focus { outline:none; border-color:var(--sage); }
  .add-field textarea { min-height:70px; resize:vertical; line-height:1.5; }
  .add-actions { display:flex; gap:10px; justify-content:flex-end; margin-top:18px; }

  /* Library */
  .lib-entry { padding:14px 16px; border:1px solid var(--border); border-radius:3px; margin-bottom:10px; background:rgba(244,239,230,0.015); cursor:pointer; transition:border-color .15s ease; }
  .lib-entry:hover { border-color:var(--border-hi); }
  .lib-head { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:4px; }
  .lib-title { font-size:12px; color:var(--cream); font-weight:500; }
  .lib-meta { font-size:10px; color:var(--text-dim); display:flex; gap:12px; }
  .lib-body { margin-top:10px; padding-top:10px; border-top:1px solid var(--border); font-size:11px; color:var(--text-mid); line-height:1.65; white-space:pre-wrap; }

  /* SEO tracker */
  .seo-scorebar { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:18px; }
  .seo-stat { padding:14px 16px; border:1px solid var(--border); border-radius:3px; background:rgba(244,239,230,0.015); }
  .seo-stat-label { font-size:9px; letter-spacing:0.14em; text-transform:uppercase; color:var(--text-dim); margin-bottom:4px; }
  .seo-stat-value { font-family:'Playfair Display',serif; font-size:22px; color:var(--cream); font-weight:500; }
  .seo-stat-value em { color:var(--sage); font-style:italic; font-size:12px; }
  .kw-row { padding:12px 14px; border:1px solid var(--border); border-radius:3px; margin-bottom:8px; background:rgba(244,239,230,0.015); }
  .kw-top { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:8px; flex-wrap:wrap; }
  .kw-term { font-size:12px; color:var(--cream); font-weight:500; }
  .kw-tags { display:flex; gap:6px; flex-wrap:wrap; }
  .kw-tag { font-size:8px; letter-spacing:0.1em; text-transform:uppercase; padding:2px 7px; border-radius:3px; border:1px solid var(--border); color:var(--text-mid); }
  .kw-tag.high { color:var(--green); border-color:rgba(122,171,127,0.4); }
  .kw-tag.med { color:var(--amber); border-color:rgba(212,168,67,0.4); }
  .kw-meta { display:flex; gap:16px; flex-wrap:wrap; font-size:10px; color:var(--text-dim); }
  .kw-input-row { display:flex; gap:8px; align-items:center; margin-top:8px; }
  .kw-input { flex:1; background:rgba(26,46,31,0.7); border:1px solid var(--border); color:var(--cream); padding:6px 10px; border-radius:3px; font-family:'DM Mono',monospace; font-size:11px; }
  .kw-history { display:flex; gap:4px; margin-top:8px; align-items:flex-end; height:30px; }
  .kw-bar { flex:1; max-width:22px; background:var(--moss); border-radius:2px 2px 0 0; position:relative; cursor:pointer; transition:background .15s ease; }
  .kw-bar:hover { background:var(--sage); }
  .kw-bar-label { font-size:8px; color:var(--text-dim); text-align:center; margin-top:2px; white-space:nowrap; }

  /* Empty state */
  .empty { text-align:center; padding:48px 24px; font-size:11px; color:var(--text-dim); font-style:italic; }

  /* Error card */
  .error-card { margin:18px 0 24px; padding:18px 20px; border:1px solid rgba(224,112,112,0.4); background:rgba(224,112,112,0.06); border-radius:3px; }
  .error-card .err-head { display:flex; align-items:center; gap:10px; margin-bottom:8px; }
  .error-card .err-mark { font-size:9px; letter-spacing:0.18em; text-transform:uppercase; color:var(--red); padding:2px 8px; border:1px solid rgba(224,112,112,0.4); border-radius:3px; }
  .error-card .err-title { font-size:13px; color:var(--cream); font-weight:500; }
  .error-card .err-body { font-size:11px; color:var(--text-mid); line-height:1.6; margin-bottom:10px; white-space:pre-wrap; word-break:break-word; }
  .error-card .err-raw { margin-top:10px; padding:10px 12px; background:rgba(26,46,31,0.7); border:1px solid var(--border); border-radius:3px; font-size:10px; color:var(--text-mid); line-height:1.5; max-height:240px; overflow-y:auto; white-space:pre-wrap; word-break:break-word; }
  .error-card .err-actions { display:flex; gap:10px; margin-top:12px; }

  /* Brand context preview */
  .brand-preview { padding:16px 18px; border:1px solid var(--border); border-radius:3px; margin-bottom:14px; background:rgba(244,239,230,0.015); }
  .brand-label { font-size:10px; letter-spacing:0.18em; text-transform:uppercase; color:var(--amber); margin-bottom:8px; }
  .brand-body { font-size:11px; color:var(--text-mid); line-height:1.65; }
  .brand-body b { color:var(--cream); }

  /* Scrollbar */
  ::-webkit-scrollbar { width:8px; height:8px; }
  ::-webkit-scrollbar-track { background:rgba(26,46,31,0.4); }
  ::-webkit-scrollbar-thumb { background:rgba(122,171,127,0.25); border-radius:4px; }
  ::-webkit-scrollbar-thumb:hover { background:rgba(122,171,127,0.45); }
`;

/* ════════════════════════════════════════════════════════════════════════
   BRAND CONTEXT — single source with audience-specific voice rules
   ════════════════════════════════════════════════════════════════════════ */

const BRAND = `
VANDERKAMP — 850 acres in upstate New York. The place designed for the state where deep work happens.

MASTER POSITIONING (do not contradict):
Vanderkamp is a place, not a product. Eight decades hosting gatherings. 850 acres of forest, glacial lake, wetland, and open field. The philosophy: the environment you are in shapes what becomes possible while you are in it.

FOUR REVENUE TRACKS:
1. OFFSITES & FIELDWORK™ (largest marketing focus — fills weekday/shoulder-season open capacity)
2. WEDDINGS (ten weddings a year, each with the full run of 850 acres; pipeline focus: 2027 and 2028)
3. NIGHTLY STAYS (shoulder-season lift + direct-booking from current Airbnb-heavy mix)
4. WELLNESS RETREATS (15 per year, focus on experienced practitioners, venue rental only in 2026)

═══ VOICE RULES BY TRACK ═══

OFFSITE / FIELDWORK VOICE:
- Use: deep work, clear thinking, strategic clarity, decision quality, thinking environment, cognitive bandwidth, attention, field work
- Avoid: wellness, self-care, mindfulness retreat, relaxation, escape, getaway, disconnect, unplug, spa
- Tone: thoughtful, grounded, confident without arrogance. A place that has quietly observed hundreds of leaders and is sharing what it has noticed.

WEDDING VOICE:
- Use: intentional, unhurried, private, whole property, one wedding at a time, 850 acres, considered, specific to you
- Avoid: "destination," "luxury," "bespoke," "magical," "dream wedding" — these signal commodity wedding marketing
- Tone: thoughtful people describing a real place, not a brochure. Warm, visual, specific.

STAYS VOICE:
- Use: quiet, forest, glacial lake, wetland, season, property-wide, specific, grounded
- Avoid: "luxury," "hideaway," "escape," "getaway"
- Tone: closer to a naturalist's or an editor's voice than a travel agent's.

WELLNESS VOICE:
- This is the one place where Vanderkamp's voice interacts with wellness language — carefully.
- Vanderkamp never markets itself as wellness. It markets the venue to experienced practitioners.
- On the Events Calendar and newsletter, a wellness retreat is described factually — name, teacher, dates, one-line description from them, signup link to their site.
- In outreach to practitioners: peer-to-peer tone. Not a sales pitch. "Here's the property, here's what we've learned hosting 15 retreats a year, here's what we offer partners, would you like to visit?"
- Atmospheric content about the property during a wellness week uses Vanderkamp's normal Field Journal voice: weather, wildlife, light.

═══ SOCIAL MEDIA MODEL ═══

TWO-ACCOUNT STRUCTURE:
1. VK BRAND (primary, 3-4x/week): Balanced mix across four tracks.
   - 50% Field Journal and "What Became Clear?" cards (atmospheric, audience-neutral)
   - 20% "What We See" observational posts (offsite-leaning)
   - 15% Stays-specific content
   - 15% Wedding moments
   - Wellness retreats surfaced through atmospheric content, not explicit wellness marketing
2. TROY PERSONAL (rare, 3-4x per YEAR): Reposts VK 1-2x/month. Originals only for major moments: Fieldwork launch, podcast appearances, annual letter, major milestones. Restraint is the strategy.

TROY'S VOICE (for personal posts only): Humble, philosophical, grounded, conversational. Stories over data. Dry humor. Never self-promotional. References: David Brooks, Oliver Burkeman (Four Thousand Weeks), Peter Wohlleben. Troy = a thinker who built something. Never a guru.

FIELD JOURNAL POSTS: Atmospheric, minimal, visual-first. One-line captions. Date + weather + one observation. NO motivational quotes, NO CTAs, NO hashtag bait, NO "Book now!"

"WHAT WE SEE" POSTS (offsite-facing observational): Rooted in specific VK experience. Pattern posts, observations, curated research. Examples:
- "We've hosted 40+ leadership teams this year. Single biggest mistake: scheduling every minute. Breakthroughs happen in the gaps."
- "Something we've noticed across 3 years of hosting solo offsites: most people arrive with 10 priorities. By day two, they're down to 3. We've stopped being surprised."

═══ FIELDWORK™ — the signature program ═══
Structured solo offsite for leaders. Eight Nature Profiles (Awe Seeker, Detail Specialist, Flow Hunter, Forest Immersionist, Listener, Solitude Seeker, Blue Mind Seeker, Kinesthetic Grounder) identified pre-arrival via intake. The Field Guide is a customized, printed, bound 48-hour experience designed around the participant's profile. Three stages: Decompress, Deep Inquiry, Strategic Integration. Grounded in Attention Restoration Theory, Stress Recovery Theory, Blue Mind Theory, Biophilia, and five other fields of cognitive/environmental research.

═══ BROUGHT-BY COHORT MODEL (launching August 2026) ═══
Coaches bring 4-8 clients for parallel solo Fieldwork. Each does individual work; coach orchestrates arrival and closing debriefs. Target coach profile: Vistage Chairs, EO facilitators, executive coaches running peer groups or 3-6 month programs. First-mover incentive: complimentary solo Fieldwork for the first three coaches.

═══ WRITER-IN-RESIDENCE PROGRAM (launching June 2026) ═══
One writer, poet, or documentary photographer per quarter receives a 5-7 night shoulder-season stay in exchange for a piece of published or publicly-shared work. Writers retain full editorial freedom. Target writers with publication records in literary/travel publications, or engaged newsletters (3K+ Substack subscribers).

═══ WEDDINGS DIFFERENTIATOR ═══
"Ten weddings a year. Each with the full run of 850 acres." One wedding at a time. Not Hudson Valley — the quieter, less-trafficked CNY alternative. Target: fill 10/10 2027 weekends + secure 5+ for 2028. Microweddings and elopements fill the other 42 weekends.

═══ STAYS DIFFERENTIATOR ═══
"A stay that returns something you didn't know you needed." Shoulder-season stays are the quiet season locals know about. Nature Profile delivered post-booking — every stay gets personalized.

═══ IDEAL REFERRERS & PARTNERS ═══
OFFSITE: Vistage Chairs, EO Forum facilitators, executive coaches, YPO leaders, HR/L&D directors, leadership podcasters, business book authors.
WEDDINGS: CNY wedding photographers, NYC/Boston wedding planners, preferred vendors (florists, planners, caterers, DJs).
STAYS: Travel writers and photographers whose aesthetic fits Vanderkamp's atmospheric positioning.
WELLNESS: Experienced practitioners (multiple prior retreats, established followings of 5K+).

═══ SEO TARGETS ═══
corporate retreat upstate new york · leadership offsite new york · executive retreat upstate ny · solo executive retreat · think week retreat · cognitive performance retreat · fieldwork solo offsite · wedding venue upstate ny · barn wedding cny · intimate wedding venue new york · cabin rental upstate ny · forest cabin new york · upstate ny winter getaway · fall foliage cabin ny · retreat venue upstate ny · yoga retreat venue new york

WEBSITE: vanderkampny.com

═══ PITCH ANGLES BY AUDIENCE ═══
HR conferences: "Fieldwork as an executive perk / retention tool. Your best leaders need structured thinking time."
Entrepreneur/CEO events: "The solo offsite as a strategic discipline. Most productive thing: leave your business for 48 hours."
Coaching conferences: "Vanderkamp as a partner for your practice. You help leaders think better. We provide the environment."
NYT/CNT/Strategist (stays): "The upstate alternative New Yorkers don't know yet — Tug Hill plateau, 850 acres, quieter than the Hudson Valley."
Local wedding (Syracuse.com): "Why couples are choosing upstate over the Catskills: one wedding at a time, whole property, local focus."
`;

/* ════════════════════════════════════════════════════════════════════════
   CATEGORY DEFINITIONS — 12 research/draft categories + auxiliary draft types
   ════════════════════════════════════════════════════════════════════════ */

const CATEGORIES = [
  // Offsite track
  { id:"vk_linkedin", name:"VK Brand — LinkedIn", track:"offsite", icon:"L", color:"var(--track-offsite)", desc:"Pattern posts, observations, Field Journal crossposts" },
  { id:"vk_instagram", name:"VK Brand — Instagram", track:"offsite", icon:"I", color:"var(--track-offsite)", desc:"Field Journal + What Became Clear cards (atmospheric)" },
  { id:"troy_personal", name:"Troy Personal Post", track:"offsite", icon:"T", color:"var(--track-offsite)", desc:"Rare, major moments only — reposts + 3-4 originals/yr" },
  { id:"pub_offsite", name:"Publication Pitches — Offsite", track:"offsite", icon:"P", color:"var(--track-offsite)", desc:"HBR, Fast Company, Inc., Forbes, Entrepreneur, Chief Executive" },
  { id:"partner_coach", name:"Partner Outreach — Coaches & Vistage", track:"offsite", icon:"C", color:"var(--track-offsite)", desc:"Vistage Chairs, EO facilitators, exec coaches (+ Brought-By angle)" },
  // Wedding track
  { id:"pub_wedding", name:"Publication Pitches — Weddings (Local)", track:"wedding", icon:"W", color:"var(--track-wedding)", desc:"Syracuse.com, Syracuse Bride, CNY Magazine, Post-Standard" },
  { id:"wedding_vendor", name:"Wedding Vendor Outreach", track:"wedding", icon:"V", color:"var(--track-wedding)", desc:"CNY photographers, NYC/Boston planners, florists, caterers" },
  { id:"pinterest", name:"Pinterest Pin Descriptions", track:"wedding", icon:"Pi", color:"var(--track-wedding)", desc:"Weddings + stays boards (SEO-aware, 100-500 char)" },
  // Stays track
  { id:"pub_stays", name:"Publication Pitches — Stays", track:"stay", icon:"S", color:"var(--track-stay)", desc:"NYT Travel, Strategist, Afar, Condé Nast Traveler, Outside" },
  { id:"travel_influencer", name:"Travel Influencer Outreach", track:"stay", icon:"Tr", color:"var(--track-stay)", desc:"Relationship-first content creators (atmospheric fit)" },
  // Wellness track
  { id:"wellness_practitioner", name:"Wellness Practitioner Outreach", track:"wellness", icon:"Ws", color:"var(--track-wellness)", desc:"Experienced practitioners for venue rental (peer tone)" },
  // Cross-cutting
  { id:"newsletter", name:"Newsletter Modules", track:"all", icon:"N", color:"var(--sage)", desc:"Monthly Field Notes modules per subscriber segment" },
];

const TRACK_META = {
  offsite: { name:"Offsites & Fieldwork", color:"var(--track-offsite)" },
  wedding: { name:"Weddings", color:"var(--track-wedding)" },
  stay: { name:"Nightly Stays", color:"var(--track-stay)" },
  wellness: { name:"Wellness Retreats", color:"var(--track-wellness)" },
  all: { name:"Cross-Cutting", color:"var(--sage)" },
};

/* ════════════════════════════════════════════════════════════════════════
   PHASE DASHBOARD DATA — repopulated from Section 12 of master plan
   ════════════════════════════════════════════════════════════════════════ */

const ACTION_CALENDAR = {
  // May = heavy foundation month
  "May 2026": {
    phase: "Phase 1 — Foundation",
    items: [
      { track:"offsite", text:"Launch VK Field Journal on Instagram (3–4x/week)" },
      { track:"offsite", text:"Submit HBR / Fast Company contributed article pitch" },
      { track:"offsite", text:"Reach out to 5 Vistage Chairs + 5 EO facilitators" },
      { track:"offsite", text:"Attend Vistage New England Summit (May 5)" },
      { track:"offsite", text:"Submit speaking proposals: SHRM NYS, ICF Converge" },
      { track:"offsite", text:"Contact INSPYRE/Kara Jones re: Fireside Chat" },
      { track:"offsite", text:"Host 2–3 coaches for Fieldwork preview experience" },
      { track:"wedding", text:"Photographers' Day at Vanderkamp (10–15 CNY photographers)" },
      { track:"wedding", text:"Submit first real wedding to Style Me Pretty" },
      { track:"wedding", text:"Pitch first Syracuse.com wedding feature" },
      { track:"wedding", text:"Upgrade The Knot to Storefront + launch Wedding Wire" },
      { track:"wedding", text:"Pinterest account live — first 3 wedding + 3 stays boards" },
      { track:"stay", text:"First travel influencer spring stay hosted" },
      { track:"stay", text:"Pitch summer upstate features (NYT, Strategist, CNT)" },
      { track:"stay", text:"Airbnb listing refresh + Google Business Profile refresh" },
      { track:"wellness", text:"Audit 15-retreat roster; identify top 3–5 for 2027" },
      { track:"wellness", text:"Build target list: 20–30 experienced NE practitioners" },
      { track:"all", text:"Website architecture: Stay / Offsite / Celebrate live" },
      { track:"all", text:"Events Calendar plugin built and populated" },
      { track:"all", text:"Flodesk segmentation: Stays/Offsites/Weddings/Wellness/All" },
      { track:"all", text:"First Field Notes newsletter (new template)" },
      { track:"all", text:"Nature Profile quiz live; Field Card printed" },
    ],
  },
  "June 2026": {
    phase: "Phase 2 — Fieldwork Launch",
    items: [
      { track:"offsite", text:"FIELDWORK PUBLIC LAUNCH — June 1 full sequence" },
      { track:"offsite", text:"Long-form piece: Introducing Fieldwork on website" },
      { track:"offsite", text:"Troy personal: original LinkedIn post (only one this qtr)" },
      { track:"offsite", text:"Activate 3–5 coach partners for amplification" },
      { track:"offsite", text:"Pitch 2–3 leadership podcasts with Troy" },
      { track:"wedding", text:"Microwedding + elopement landing pages live" },
      { track:"wedding", text:"NYC wedding planner networking event" },
      { track:"stay", text:"Writer-in-Residence applications open (June)" },
      { track:"stay", text:"Email 15–20 writer contacts for WiR program" },
      { track:"all", text:"Second monthly newsletter (Events Calendar featured)" },
      { track:"all", text:"Pinterest monthly review — adjust boards" },
    ],
  },
  "July 2026": {
    phase: "Phase 2 — Fieldwork Launch",
    items: [
      { track:"offsite", text:"2–3 podcast appearances recorded (from May pitches)" },
      { track:"offsite", text:"Pitch 'Rise of the Solo Offsite' to NYT Business / WSJ" },
      { track:"offsite", text:"Formal referral partner agreements (from preview)" },
      { track:"offsite", text:"Deep pattern post: 'Our first 20 Fieldwork participants'" },
      { track:"wedding", text:"Summer wedding documentation (publication permission)" },
      { track:"stay", text:"Pitch fall foliage features (3-month lead to Oct)" },
      { track:"stay", text:"Second travel influencer stay" },
    ],
  },
  "August 2026": {
    phase: "Phase 2 — Momentum",
    items: [
      { track:"offsite", text:"THE CLEARING — 2-day invite-only gathering on-property" },
      { track:"offsite", text:"BROUGHT-BY COHORT launch: 8–10 coach outreach" },
      { track:"offsite", text:"Heavy IG story coverage during The Clearing (atmospheric)" },
      { track:"offsite", text:"Troy personal: possible original post after Clearing" },
      { track:"offsite", text:"Invite one regional reporter to The Clearing" },
      { track:"wedding", text:"Pitch fall weddings to NYC lifestyle pubs" },
      { track:"wedding", text:"Second real wedding submission (Junebug/Magnolia Rouge)" },
      { track:"stay", text:"Pitch winter features (NYT, Afar, Outside)" },
      { track:"stay", text:"Writer-in-Residence: first resident selected" },
      { track:"stay", text:"Confirm fall influencer shoulder-season bookings" },
    ],
  },
  "September 2026": {
    phase: "Phase 3 — Authority",
    items: [
      { track:"offsite", text:"SHRM NYS Annual Conference (Sep 28–30, Buffalo)" },
      { track:"offsite", text:"Attention Manifesto LinkedIn article from VK page" },
      { track:"offsite", text:"Commission 'State of the Executive Offsite 2026' survey" },
      { track:"offsite", text:"Targeted outreach: 10 HR leaders/CPOs at NE mid-market cos" },
      { track:"offsite", text:"Publish 2–3 SEO blog posts (retreat upstate NY, etc.)" },
      { track:"wedding", text:"Fall foliage Pinterest push" },
      { track:"stay", text:"Direct-booking incentive campaign launched" },
      { track:"wellness", text:"Practitioners' Day at Vanderkamp — 6–8 targets" },
    ],
  },
  "October 2026": {
    phase: "Phase 3 — Authority & Scale",
    items: [
      { track:"offsite", text:"Release 'State of the Executive Offsite' report" },
      { track:"offsite", text:"Pitch report findings to 2–3 media (trend piece)" },
      { track:"offsite", text:"Apply to Q1 2027 conference speaking slots" },
      { track:"offsite", text:"ICF Converge DC — attend/exhibit" },
      { track:"offsite", text:"University guest lecture (Syracuse/Colgate/Hamilton)" },
      { track:"offsite", text:"Brought-By: target first cohort booking this month" },
      { track:"wedding", text:"Year-in-review wedding content; 2027 bookings aggressive push" },
      { track:"stay", text:"Writer-in-Residence: FIRST RESIDENT in-house (peak foliage)" },
      { track:"stay", text:"Atmospheric content capture for year-end library" },
    ],
  },
  "November 2026": {
    phase: "Phase 3 — 2027 Pipeline",
    items: [
      { track:"offsite", text:"Year-end campaign: Plan Your Best Quarter (Q1 2027)" },
      { track:"offsite", text:"Virtual roundtable: 3–5 coaches, Helping Leaders Plan 2027" },
      { track:"offsite", text:"Pitch year-end roundups and 2027 predictions" },
      { track:"offsite", text:"VK Gift Card / Fieldwork gifting product" },
      { track:"wedding", text:"2028 early-booking incentive campaign" },
      { track:"stay", text:"Winter shoulder-season paid search begins" },
      { track:"stay", text:"Writer-in-Residence: second resident; pitch program story to NYT" },
      { track:"wellness", text:"First 2027 wellness retreats confirmed" },
    ],
  },
  "December 2026": {
    phase: "Phase 3 — Year-End",
    items: [
      { track:"offsite", text:"VANDERKAMP ANNUAL LETTER (Troy original personal post)" },
      { track:"offsite", text:"Physical mail: handwritten notes to top 25" },
      { track:"offsite", text:"Internal review; 2027 targets set" },
      { track:"stay", text:"Pitch 'first quiet weeks of the year' for January pubs" },
      { track:"stay", text:"Writer-in-Residence: third resident; year-one program review" },
      { track:"wellness", text:"Finalize 2027 wellness retreat bookings" },
      { track:"all", text:"Q1 2027 content calendar; January VK posts drafted" },
    ],
  },
};

const MONTHS_ORDER = ["May 2026","June 2026","July 2026","August 2026","September 2026","October 2026","November 2026","December 2026"];

const HOLD_KEY = "On Hold";
// All possible bucket destinations (months + On Hold)
const ALL_BUCKETS = [...MONTHS_ORDER, HOLD_KEY];

// Stable IDs for pre-loaded items derived from their original month + index
const preloadedItemKey = (month, index) => `pl::${month}::${index}`;
const customItemKey = (id) => `cu::${id}`;

/* ════════════════════════════════════════════════════════════════════════
   SEO TRACKER — expanded keyword list covering all 4 tracks
   ════════════════════════════════════════════════════════════════════════ */

const SEED_KEYWORDS = [
  // Offsite
  { term:"corporate retreat upstate new york", track:"offsite", target:"/offsite", intent:"transactional", priority:"high" },
  { term:"leadership offsite new york", track:"offsite", target:"/offsite", intent:"transactional", priority:"high" },
  { term:"executive retreat upstate ny", track:"offsite", target:"/offsite", intent:"transactional", priority:"high" },
  { term:"solo executive retreat", track:"offsite", target:"/fieldwork", intent:"transactional", priority:"high" },
  { term:"think week retreat", track:"offsite", target:"/fieldwork", intent:"informational", priority:"medium" },
  { term:"fieldwork solo offsite", track:"offsite", target:"/fieldwork", intent:"brand", priority:"high" },
  // Wedding
  { term:"wedding venue upstate ny", track:"wedding", target:"/celebrate", intent:"transactional", priority:"high" },
  { term:"barn wedding cny", track:"wedding", target:"/celebrate", intent:"transactional", priority:"medium" },
  { term:"intimate wedding venue new york", track:"wedding", target:"/celebrate", intent:"transactional", priority:"high" },
  { term:"whole property wedding ny", track:"wedding", target:"/celebrate", intent:"transactional", priority:"medium" },
  // Stays
  { term:"cabin rental upstate ny", track:"stay", target:"/stay", intent:"transactional", priority:"high" },
  { term:"forest cabin new york", track:"stay", target:"/stay", intent:"transactional", priority:"medium" },
  { term:"upstate ny winter getaway", track:"stay", target:"/stay", intent:"transactional", priority:"high" },
  { term:"fall foliage cabin ny", track:"stay", target:"/stay", intent:"transactional", priority:"medium" },
  // Wellness
  { term:"retreat venue upstate ny", track:"wellness", target:"/celebrate", intent:"transactional", priority:"medium" },
  { term:"yoga retreat venue new york", track:"wellness", target:"/stay", intent:"transactional", priority:"low" },
];

/* ════════════════════════════════════════════════════════════════════════
   PROMPTS
   ════════════════════════════════════════════════════════════════════════ */

const buildResearchPrompt = (trackFilter, categoriesInScope) => `You are the Research Agent for Vanderkamp's PR Command Center (v6). Find REAL, CURRENT opportunities using web search.

${BRAND}

═══ THIS CYCLE ═══
Track filter: ${trackFilter === 'all' ? 'ALL TRACKS (offsite, wedding, stay, wellness)' : trackFilter.toUpperCase()}

Search for opportunities across these ${categoriesInScope.length} categories:
${categoriesInScope.map((c,i) => `${i+1}. ${c.name} [${c.track}] — ${c.desc}`).join('\n')}

═══ OUTPUT FORMAT ═══
Return ONLY valid JSON (no preamble, no markdown fences). Shape:

{
  "opportunities": [
    {
      "id": "unique-slug",
      "category": "vk_linkedin" | "vk_instagram" | "troy_personal" | "pub_offsite" | "partner_coach" | "pub_wedding" | "wedding_vendor" | "pinterest" | "pub_stays" | "travel_influencer" | "wellness_practitioner" | "newsletter",
      "track": "offsite" | "wedding" | "stay" | "wellness" | "all",
      "name": "Specific opportunity (publication, outlet, person, board, topic)",
      "why": "1-2 sentences on why this fits Vanderkamp right now",
      "action": "Concrete specific action to take — include names, deadlines, URLs if known",
      "priority": "high" | "medium" | "low",
      "seo_value": "high" | "medium" | "low",
      "da_estimate": "DA 90+" | "DA 70-89" | "DA 50-69" | "DA <50" | "N/A",
      "timing": "Deadline or best window"
    }
  ]
}

═══ RULES ═══
- Produce 2–4 opportunities per category requested.
- Use web_search to find CURRENT, REAL opportunities — editor names, CFP deadlines, event dates, practitioner names, publication submission windows.
- Do NOT invent contacts. If you can't find a real contact, note "researched contact needed" in action.
- For Pinterest: opportunities are board expansions or seasonal pin pushes (not individual pins — those get drafted later).
- For wellness practitioners: only suggest established practitioners with public presence and multiple prior retreats.
- For wedding pubs: LOCAL FOCUS ONLY in 2026 (Syracuse.com, Syracuse Bride, CNY Magazine, Post-Standard, regional TV). Per Troy's explicit direction.
- For stays pubs: aim big (NYT Travel, Strategist, Afar, CNT, Outside).
- Respect the voice rules per track.
- Return JSON only. No explanation, no wrapper text.
`;

const buildDraftPrompt = (opp, seoBrief) => {
  const cat = CATEGORIES.find(c => c.id === opp.category);
  const trackName = TRACK_META[opp.track]?.name || opp.track;

  let instructions = "";

  switch (opp.category) {
    case "vk_linkedin":
      instructions = `Write for the VANDERKAMP BRAND ACCOUNT on LinkedIn. 150–260 words. Choose format: Pattern post | Observation post | Curated research | Contrarian take. Rooted in specific VK experience ("We've hosted X teams... here's what we've noticed"). No hashtag spam (0–2 max). End with a real observation or genuine question, never a CTA. Offsite voice rules.`;
      break;
    case "vk_instagram":
      instructions = `Write for the VANDERKAMP BRAND ACCOUNT on Instagram. Caption only. Max 30 words unless it's a "What Became Clear" card where caption = date + season only. Atmospheric, minimal. Format: [Date]. [Weather/condition]. [One-line observation]. No emojis, no CTAs, no hashtag bait. Example: "October 14. First hard frost. The whole property paused for a minute."`;
      break;
    case "troy_personal":
      instructions = `Write for TROY'S PERSONAL LinkedIn account — this is rare (3-4x/yr only). 200–350 words. First person, humble and philosophical. Stories over data. Dry humor where it lands. Reference: David Brooks, Oliver Burkeman, or Peter Wohlleben style. Never self-promotional. End with something honest, not a CTA.`;
      break;
    case "pub_offsite":
      instructions = `Write a pitch email to the editor at ${opp.name}. SUBJECT LINE on line one. Then 220–350 word pitch. Open with the article concept, not "Hi I'm Troy and I run..." Make timely. Troy's credibility: built Vanderkamp, 850 acres, works with leadership teams on this daily. Vanderkamp as evidence, not promotion. Close with one specific article title and 2-sentence synopsis. Offsite voice rules.`;
      break;
    case "partner_coach":
      instructions = `Write a warm outreach email from Troy to ${opp.name}. Personal, short (150–220 words). Reference their specific work. Make it clear this is an invitation to experience Vanderkamp (preview or comp Fieldwork) — not a sales pitch. If Brought-By angle applies, mention it lightly as "something we're exploring" not as a product pitch. Close with a low-friction ask (call, property visit).`;
      break;
    case "pub_wedding":
      instructions = `Write a pitch email to the editor at ${opp.name} (LOCAL CNY outlet). SUBJECT LINE on line one. 180–280 word pitch. Angle: "One wedding at a time. Full run of 850 acres. An upstate alternative that's quieter than the Catskills." Wedding voice rules — warm, specific, never "luxury" or "bespoke." Close with a specific story concept or real wedding feature offer.`;
      break;
    case "wedding_vendor":
      instructions = `Write a warm outreach email from Troy or Vanderkamp to ${opp.name} (wedding photographer/planner/vendor). 150–220 words. Specific reference to their work. Invite to Vanderkamp — offer tour, Photographers' Day, or preferred vendor relationship. Not transactional. Wedding voice.`;
      break;
    case "pinterest":
      instructions = `Write 4–6 Pinterest pin descriptions for this opportunity. Each pin: 100–500 characters. SEO-aware (work in keyword naturally). Descriptive, not salesy. Format as:

PIN 1: [description]
PIN 2: [description]
...

Board placement suggestion on a final line: "BOARD: [board name]"`;
      break;
    case "pub_stays":
      instructions = `Write a pitch email to the editor at ${opp.name} (national travel/lifestyle). SUBJECT LINE on line one. 220–350 word pitch. Angle: Tug Hill plateau, the upstate alternative New Yorkers don't know yet, 850 acres, glacial lake, shoulder-season or seasonal hook per the opportunity. Stays voice — naturalist/editorial. NO "luxury" or "hideaway" language. Close with a specific feature concept.`;
      break;
    case "travel_influencer":
      instructions = `Write a warm outreach from Vanderkamp to ${opp.name} (travel content creator/photographer). 150–230 words. Reference their specific aesthetic/work. Offer: comped shoulder-season stay in exchange for content. Clear but not transactional. Emphasize relationship, not "sponsored post" aesthetic. Stays voice.`;
      break;
    case "wellness_practitioner":
      instructions = `Write a peer-to-peer outreach from Troy to ${opp.name} (experienced wellness practitioner). 180–260 words. Tone: respectful, peer, never sales-pitchy. Structure:
1. "Here's the property" — briefly describe Vanderkamp
2. "Here's what we've learned hosting 15 retreats a year" — one real observation
3. "Here's what we offer partners" — venue rental, plus Events Calendar + newsletter amplification
4. "Would you like to visit?" — invite to property

Use wellness language only when it's describing THEIR work, never Vanderkamp's. Vanderkamp voice stays grounded.`;
      break;
    case "newsletter":
      instructions = `Write a newsletter module for the monthly Field Notes. Format:

HEADLINE: [short, observational, max 8 words]
BODY: [80–140 words]
LINK CTA: [one-line action — "Book a stay" / "Inquire about Fieldwork" / etc.]

Track-appropriate voice per opportunity. If the module is for the "Events Calendar" segment, list 3–4 upcoming items factually (name, date, link) in Vanderkamp's grounded voice.`;
      break;
    default:
      instructions = `Write appropriate content for this opportunity. Respect voice rules per track. 200-word range.`;
  }

  return `You are the Draft Agent for Vanderkamp's PR Command Center.

${BRAND}

═══ DRAFT REQUEST ═══
Category: ${cat?.name || opp.category}
Track: ${trackName}
Opportunity: ${opp.name}
Why it fits: ${opp.why}
Action: ${opp.action}
${seoBrief ? `\n═══ SEO BRIEF ═══\n${seoBrief}\n` : ''}

═══ INSTRUCTIONS ═══
${instructions}

═══ OUTPUT FORMAT ═══
Write the content. Then on a new line write "---METADATA---" and below that:

TITLE_TAG: [if applicable — 50-60 chars]
META_DESCRIPTION: [if applicable — 140-160 chars]
PRIMARY_KEYWORD: [target keyword]
SUPPORTING_KEYWORDS: [comma separated, 3-5]
BACKLINK_VALUE: [High | Medium | Low | N/A]

For purely internal content (Troy personal posts, Pinterest pins, newsletter modules, outreach emails), TITLE_TAG and META_DESCRIPTION may be "N/A".

Output exactly what Troy would post or send. Zero placeholders. No commentary around the draft.`;
};

const buildSeoBriefPrompt = (opp) => `You are the SEO Brief Agent for Vanderkamp.

${BRAND}

═══ OPPORTUNITY ═══
Category: ${opp.category}
Track: ${opp.track}
Name: ${opp.name}
Action: ${opp.action}

═══ TASK ═══
Produce a short SEO brief (plain text, no markdown). Structure:

PRIMARY KEYWORD: [one term]
SECONDARY KEYWORDS: [3–5 comma separated]
LONG-TAIL VARIANTS: [2–3]
SUGGESTED TITLE TAG: [50–60 chars]
META DESCRIPTION: [140–160 chars]
CONTENT TIPS: [2–3 short bullets on natural keyword placement]

Keep it under 200 words total. Pull keywords from Vanderkamp's target list where relevant.`;

/* ════════════════════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════════════════════ */

const callClaude = async (system, user, webSearch = false) => {
  const body = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    system,
    messages: [{ role: "user", content: user }],
  };
  if (webSearch) body.tools = [{ type: "web_search_20250305", name: "web_search" }];
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    // Try to extract a useful error message from whatever came back
    let detail = text;
    try {
      const parsed = JSON.parse(text);
      detail = parsed.error?.message || parsed.error || parsed.message || text;
      if (typeof detail === "object") detail = JSON.stringify(detail);
    } catch {}
    throw new Error(`HTTP ${res.status}: ${detail.slice(0, 500)}`);
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Proxy returned non-JSON response: ${text.slice(0, 200)}`);
  }
  if (data.error) {
    const msg = data.error?.message || data.error;
    throw new Error(`Anthropic API error: ${typeof msg === "string" ? msg : JSON.stringify(msg)}`);
  }
  return data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";
};

const ts = () => new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", second:"2-digit" });
const today = () => new Date().toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
const currentMonth = () => {
  const d = new Date();
  return d.toLocaleDateString("en-US", { month:"long", year:"numeric" });
};

const parseJsonSafe = (text) => {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
};

const parseDraftWithMeta = (text) => {
  const sepIndex = text.indexOf("---METADATA---");
  if (sepIndex === -1) return { body: text, metadata: null };
  const body = text.slice(0, sepIndex).trim();
  const metaText = text.slice(sepIndex + "---METADATA---".length).trim();
  const meta = {};
  metaText.split("\n").forEach(line => {
    const m = line.match(/^([A-Z_]+):\s*(.+)$/);
    if (m) meta[m[1].toLowerCase()] = m[2].trim();
  });
  return { body, metadata: meta };
};

/* ════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════════ */

export default function VanderkampPR() {
  // Core state
  const [activeTab, setActiveTab] = useState("dashboard");
  const [phase, setPhase] = useState("idle");
  const [log, setLog] = useState([]);
  const [errorState, setErrorState] = useState(null); // { title, body, raw } | null
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [opportunities, setOpportunities] = useState([]);
  const [decisions, setDecisions] = useState({});
  const [drafts, setDrafts] = useState({});
  const [draftMeta, setDraftMeta] = useState({});
  const [draftLoading, setDraftLoading] = useState({});
  const [seoBriefs, setSeoBriefs] = useState({});
  const [seoBriefLoading, setSeoBriefLoading] = useState({});

  // Track filter — A/B scope decision — default ALL
  const [trackFilter, setTrackFilter] = useState("all");

  // Persistent
  const [history, setHistory] = useState([]);
  const [cycleNum, setCycleNum] = useState(1);
  const [keywords, setKeywords] = useState(SEED_KEYWORDS.map(k => ({ ...k, history: [] })));
  const [dashDone, setDashDone] = useState({});
  // v6.1 additions
  const [dashMoves, setDashMoves] = useState({});       // { itemKey: newBucketKey }
  const [dashCustom, setDashCustom] = useState({});     // { bucketKey: [{ id, text, track }] }
  const [dashRemoved, setDashRemoved] = useState({});   // { itemKey: true }
  const [dashWindowStart, setDashWindowStart] = useState(0); // index into MONTHS_ORDER for the leftmost visible month
  const [draggingKey, setDraggingKey] = useState(null);
  const [dragOverBucket, setDragOverBucket] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({ text:"", track:"offsite", bucket:"" });

  // Load storage
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("vk_history_v6");
        if (r) setHistory(JSON.parse(r.value));
        const cn = await window.storage.get("vk_cycle_num_v6");
        if (cn) setCycleNum(parseInt(cn.value) || 1);
        const kw = await window.storage.get("vk_keywords_v6");
        if (kw) setKeywords(JSON.parse(kw.value));
        const dd = await window.storage.get("vk_dash_done_v6");
        if (dd) {
          // Migrate v6 keys (`${month}::${i}`) to v6.1 keys (`pl::${month}::${i}`) one-time
          const raw = JSON.parse(dd.value);
          const migrated = {};
          let didMigrate = false;
          for (const [k, v] of Object.entries(raw)) {
            if (k.startsWith("pl::") || k.startsWith("cu::")) {
              migrated[k] = v;
            } else if (k.includes("::") && !k.startsWith("pl::")) {
              migrated[`pl::${k}`] = v;
              didMigrate = true;
            } else {
              migrated[k] = v;
            }
          }
          setDashDone(migrated);
          if (didMigrate) {
            try { await window.storage.set("vk_dash_done_v6", JSON.stringify(migrated)); } catch {}
          }
        }
        // v6.1 stores
        const dm = await window.storage.get("vk_dash_moves_v61");
        if (dm) setDashMoves(JSON.parse(dm.value));
        const dc = await window.storage.get("vk_dash_custom_v61");
        if (dc) setDashCustom(JSON.parse(dc.value));
        const dr = await window.storage.get("vk_dash_removed_v61");
        if (dr) setDashRemoved(JSON.parse(dr.value));
      } catch {}
      // Default window: current month if in range, else first month
      const now = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
      const idx = MONTHS_ORDER.indexOf(now);
      if (idx >= 0) {
        // Place current month as leftmost, but clamp so window fits (need 3 columns)
        setDashWindowStart(Math.min(idx, MONTHS_ORDER.length - 3));
      }
    })();
  }, []);

  const persist = useCallback(async (key, value) => {
    try { await window.storage.set(key, JSON.stringify(value)); } catch {}
  }, []);

  const addLog = useCallback((agent, msg) => {
    setLog(l => [...l, { ts: ts(), agent, msg }]);
  }, []);

  // ─── Research cycle ────────────────────────────────────────────────────
  const runResearch = async () => {
    setPhase("researching");
    setLog([]);
    setProgress(0);
    setOpportunities([]);
    setDecisions({});
    setDrafts({});
    setDraftMeta({});
    setSeoBriefs({});
    setErrorState(null);

    const categoriesInScope = trackFilter === "all"
      ? CATEGORIES
      : CATEGORIES.filter(c => c.track === trackFilter || c.track === "all");

    addLog("SYS", `PR Research Cycle initiated — ${trackFilter === 'all' ? 'ALL TRACKS' : trackFilter.toUpperCase()}`);
    setProgress(8);
    setProgressLabel("Loading brand context...");
    await new Promise(r => setTimeout(r, 400));

    addLog("RESEARCH", `Scanning ${categoriesInScope.length} categories across ${trackFilter === 'all' ? '4 tracks' : '1 track'}...`);
    setProgress(22);
    setProgressLabel("Searching publications, events, partners...");

    let raw = "";
    try {
      raw = await callClaude(
        buildResearchPrompt(trackFilter, categoriesInScope),
        `Today is ${today()}. Current marketing month: ${currentMonth()}. Find current opportunities in the categories above.`,
        true
      );
    } catch (err) {
      console.error("[VK] Research API call failed:", err);
      addLog("ERROR", `API call failed: ${err.message}`);
      setErrorState({
        title: "Research API call failed",
        body: err.message || String(err),
        raw: null,
      });
      setPhase("idle");
      return;
    }

    setProgress(75);
    setProgressLabel("Parsing results...");
    addLog("RESEARCH", `Got ${raw.length} chars from Claude. Parsing...`);
    console.log("[VK] Raw research response (first 1000 chars):", raw.slice(0, 1000));

    const parsed = parseJsonSafe(raw);
    if (!parsed?.opportunities?.length) {
      console.error("[VK] Failed to parse research output. Raw response:", raw);
      addLog("ERROR", "Could not parse research output as JSON.");
      setErrorState({
        title: "Could not parse research output",
        body: "Claude responded but the output wasn't structured opportunities. The full raw response is below — share it with whoever maintains this tool.",
        raw,
      });
      setPhase("idle");
      return;
    }

    setProgress(100);
    setProgressLabel("Complete");
    addLog("RESEARCH", `Found ${parsed.opportunities.length} opportunities across ${new Set(parsed.opportunities.map(o => o.category)).size} categories`);

    setOpportunities(parsed.opportunities);
    setPhase("reviewing");
  };

  // ─── SEO brief for one opportunity ─────────────────────────────────────
  const generateSeoBrief = async (opp) => {
    setSeoBriefLoading(prev => ({ ...prev, [opp.id]: true }));
    try {
      const brief = await callClaude(buildSeoBriefPrompt(opp), "Generate the SEO brief now.");
      setSeoBriefs(prev => ({ ...prev, [opp.id]: brief }));
    } catch (err) {
      setSeoBriefs(prev => ({ ...prev, [opp.id]: `Error: ${err.message}` }));
    }
    setSeoBriefLoading(prev => ({ ...prev, [opp.id]: false }));
  };

  // ─── Drafting ──────────────────────────────────────────────────────────
  const runDrafting = async () => {
    const approved = opportunities.filter(o => decisions[o.id] === "approved");
    if (!approved.length) return;
    setPhase("drafting");
    addLog("DRAFT", `Generating ${approved.length} draft${approved.length > 1 ? "s" : ""}...`);

    for (const opp of approved) {
      setDraftLoading(prev => ({ ...prev, [opp.id]: true }));
      try {
        const raw = await callClaude(
          buildDraftPrompt(opp, seoBriefs[opp.id]),
          "Generate the draft now."
        );
        const { body, metadata } = parseDraftWithMeta(raw);
        setDrafts(prev => ({ ...prev, [opp.id]: body }));
        setDraftMeta(prev => ({ ...prev, [opp.id]: metadata }));
      } catch (err) {
        setDrafts(prev => ({ ...prev, [opp.id]: `Error generating draft: ${err.message}` }));
      }
      setDraftLoading(prev => ({ ...prev, [opp.id]: false }));
    }

    addLog("DRAFT", `All drafts complete`);

    // Persist to history
    const entry = {
      cycle: cycleNum,
      date: today(),
      track: trackFilter,
      opportunities: approved.map(o => ({
        ...o,
        draft: drafts[o.id] || null,
        meta: draftMeta[o.id] || null,
        seoBrief: seoBriefs[o.id] || null,
      })),
    };
    const newHistory = [entry, ...history];
    setHistory(newHistory);
    persist("vk_history_v6", newHistory);
    persist("vk_cycle_num_v6", cycleNum + 1);
    setCycleNum(cycleNum + 1);

    setPhase("complete");
  };

  const reset = () => {
    setPhase("idle");
    setOpportunities([]);
    setDecisions({});
    setDrafts({});
    setDraftMeta({});
    setSeoBriefs({});
    setLog([]);
    setProgress(0);
  };

  const toggleApprove = (id) => {
    setDecisions(prev => {
      const curr = prev[id];
      const next = { ...prev };
      if (curr === "approved") delete next[id];
      else next[id] = "approved";
      return next;
    });
  };

  const toggleSkip = (id) => {
    setDecisions(prev => {
      const curr = prev[id];
      const next = { ...prev };
      if (curr === "skipped") delete next[id];
      else next[id] = "skipped";
      return next;
    });
  };

  // ─── SEO tracker functions ─────────────────────────────────────────────
  const logKeywordRank = (term, rank) => {
    const n = parseInt(rank);
    if (isNaN(n) || n < 1 || n > 200) return;
    const updated = keywords.map(k => {
      if (k.term === term) {
        return { ...k, history: [...k.history, { date: today(), rank: n }] };
      }
      return k;
    });
    setKeywords(updated);
    persist("vk_keywords_v6", updated);
  };

  // ─── Dashboard done toggle ─────────────────────────────────────────────
  const toggleDashDone = (key) => {
    const next = { ...dashDone, [key]: !dashDone[key] };
    setDashDone(next);
    persist("vk_dash_done_v6", next);
  };

  // ─── Dashboard v6.1: move / add / remove / drag ────────────────────────
  const moveItem = (itemKey, destBucket) => {
    const next = { ...dashMoves, [itemKey]: destBucket };
    setDashMoves(next);
    persist("vk_dash_moves_v61", next);
  };

  const addCustomItem = () => {
    if (!addForm.text.trim() || !addForm.bucket) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    const bucket = addForm.bucket;
    const newItem = { id, text: addForm.text.trim(), track: addForm.track };
    const next = {
      ...dashCustom,
      [bucket]: [...(dashCustom[bucket] || []), newItem],
    };
    setDashCustom(next);
    persist("vk_dash_custom_v61", next);
    setAddModalOpen(false);
    setAddForm({ text:"", track:"offsite", bucket:"" });
  };

  const removeCustomItem = (bucketKey, id) => {
    const filtered = (dashCustom[bucketKey] || []).filter(it => it.id !== id);
    const next = { ...dashCustom, [bucketKey]: filtered };
    setDashCustom(next);
    persist("vk_dash_custom_v61", next);
  };

  const removePreloadedItem = (itemKey) => {
    if (!window.confirm("Remove this item from the dashboard? (You can always re-add it via + Add Item.)")) return;
    const next = { ...dashRemoved, [itemKey]: true };
    setDashRemoved(next);
    persist("vk_dash_removed_v61", next);
  };

  const restoreAllRemoved = () => {
    setDashRemoved({});
    persist("vk_dash_removed_v61", {});
  };

  const handleDragStart = (e, itemKey) => {
    setDraggingKey(itemKey);
    e.dataTransfer.effectAllowed = "move";
    // Firefox requires a non-empty setData to start a drag
    try { e.dataTransfer.setData("text/plain", itemKey); } catch {}
  };

  const handleDragEnd = () => {
    setDraggingKey(null);
    setDragOverBucket(null);
  };

  const handleDragOver = (e, bucketKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverBucket !== bucketKey) setDragOverBucket(bucketKey);
  };

  const handleDragLeave = (e, bucketKey) => {
    // Only clear if we're leaving the column itself, not a child
    if (e.currentTarget.contains(e.relatedTarget)) return;
    if (dragOverBucket === bucketKey) setDragOverBucket(null);
  };

  const handleDrop = (e, destBucket) => {
    e.preventDefault();
    const itemKey = draggingKey || e.dataTransfer.getData("text/plain");
    if (!itemKey) return;

    if (itemKey.startsWith("pl::")) {
      moveItem(itemKey, destBucket);
    } else if (itemKey.startsWith("cu::")) {
      // Custom item: find which bucket it's in, remove from there, add to dest
      const customId = itemKey.slice(4);
      let sourceBucket = null;
      let item = null;
      for (const [b, items] of Object.entries(dashCustom)) {
        const found = (items || []).find(it => it.id === customId);
        if (found) { sourceBucket = b; item = found; break; }
      }
      if (item && sourceBucket !== destBucket) {
        const next = { ...dashCustom };
        next[sourceBucket] = (next[sourceBucket] || []).filter(it => it.id !== customId);
        next[destBucket] = [...(next[destBucket] || []), item];
        setDashCustom(next);
        persist("vk_dash_custom_v61", next);
      }
    }
    setDraggingKey(null);
    setDragOverBucket(null);
  };

  // Compute items per bucket, applying moves/removes/custom additions
  const getBucketItems = (bucketKey) => {
    const items = [];
    // Pre-loaded items that belong here (accounting for moves)
    for (const monthKey of MONTHS_ORDER) {
      const data = ACTION_CALENDAR[monthKey];
      if (!data) continue;
      data.items.forEach((item, idx) => {
        const key = preloadedItemKey(monthKey, idx);
        if (dashRemoved[key]) return;
        // Where does this item live?
        const currentLocation = dashMoves[key] || monthKey;
        if (currentLocation === bucketKey) {
          items.push({ kind: "preloaded", key, track: item.track, text: item.text, originalMonth: monthKey });
        }
      });
    }
    // Custom items
    (dashCustom[bucketKey] || []).forEach(c => {
      items.push({ kind: "custom", key: customItemKey(c.id), id: c.id, track: c.track, text: c.text, bucket: bucketKey });
    });
    return items;
  };

  // ─── Copy to clipboard ─────────────────────────────────────────────────
  const copyDraft = async (text) => {
    try { await navigator.clipboard.writeText(text); } catch {}
  };

  // ─── Compute SEO stats ─────────────────────────────────────────────────
  const seoStats = (() => {
    const withEntries = keywords.filter(k => k.history.length > 0);
    const avgRank = withEntries.length === 0 ? "—" :
      (withEntries.reduce((sum, k) => sum + k.history[k.history.length - 1].rank, 0) / withEntries.length).toFixed(1);
    const improving = withEntries.filter(k => {
      if (k.history.length < 2) return false;
      return k.history[k.history.length - 1].rank < k.history[k.history.length - 2].rank;
    }).length;
    return { tracked: keywords.length, withEntries: withEntries.length, avgRank, improving };
  })();

  // ─── Current month from calendar ───────────────────────────────────────
  const getCurrentPhase = () => {
    const now = currentMonth();
    const data = ACTION_CALENDAR[now];
    return data ? data.phase : "Phase 1 — Foundation";
  };

  // ─── RENDER ────────────────────────────────────────────────────────────
  return (
    <>
      <style>{styles}</style>
      <div className="app">
        {/* Header */}
        <header className="header">
          <div>
            <span className="wordmark">Vanderkamp <span>PR Command Center</span></span>
            <span className="tagline">v6.1 · Drag & Drop Planning</span>
          </div>
          <div className="header-right">
            <span className="phase-badge">{getCurrentPhase()}</span>
            <span className="cycle-badge">Cycle #{cycleNum}</span>
          </div>
        </header>

        {/* Top nav */}
        <nav className="top-nav">
          {[
            { id:"dashboard", label:"Dashboard" },
            { id:"research", label:"Research & Draft" },
            { id:"library", label:`Library (${history.reduce((s,h) => s + h.opportunities.length, 0)})` },
            { id:"seo", label:"SEO Tracker" },
            { id:"brand", label:"Brand Context" },
          ].map(tab => (
            <button
              key={tab.id}
              className={`top-nav-item ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Track filter — only shown on Research & Draft tab */}
        {activeTab === "research" && phase === "idle" && (
          <div className="track-filter-bar">
            <span className="tf-label">Filter cycle:</span>
            {[
              { id:"all", label:"All Tracks", cls:"all" },
              { id:"offsite", label:"Offsites & Fieldwork", cls:"offsite" },
              { id:"wedding", label:"Weddings", cls:"wedding" },
              { id:"stay", label:"Stays", cls:"stay" },
              { id:"wellness", label:"Wellness", cls:"wellness" },
            ].map(t => (
              <button
                key={t.id}
                className={`tf-chip ${t.cls} ${trackFilter === t.id ? "active" : ""}`}
                onClick={() => setTrackFilter(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div className="container">

          {/* ════════════════════════════════════════════════════════════
              DASHBOARD TAB  (v6.1)
              ════════════════════════════════════════════════════════════ */}
          {activeTab === "dashboard" && (
            <>
              <div className="page-header">
                <h1 className="page-title">Next 90 <em>Days</em></h1>
                <p className="page-desc">Action items across the four tracks, pre-populated from the 2026 Integrated Marketing & PR Plan. Drag items between months or into <b>On Hold</b>. Pick any 3-month window with the chips below. Check items off as you complete them — all changes persist.</p>
              </div>

              <div className="dash-toolbar">
                <div className="dash-months-bar">
                  {(() => {
                    const nowStr = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
                    return MONTHS_ORDER.map((m, idx) => {
                      const isCurrent = m === nowStr;
                      const isActive = idx >= dashWindowStart && idx < dashWindowStart + 3;
                      return (
                        <button
                          key={m}
                          className={`dash-month-chip ${isCurrent ? "current" : ""} ${isActive ? "active" : ""}`}
                          onClick={() => setDashWindowStart(Math.min(idx, MONTHS_ORDER.length - 3))}
                          title={isCurrent ? `${m} (current month)` : m}
                        >
                          {m.split(" ")[0].slice(0, 3)}
                        </button>
                      );
                    });
                  })()}
                </div>
                <button className="dash-add-btn" onClick={() => setAddModalOpen(true)}>+ Add Item</button>
                {Object.keys(dashRemoved).length > 0 && (
                  <button className="btn-tiny" onClick={restoreAllRemoved} title="Restore removed pre-loaded items">
                    Restore {Object.keys(dashRemoved).length} removed
                  </button>
                )}
              </div>

              <div className="dash-grid">
                {(() => {
                  const visibleMonths = MONTHS_ORDER.slice(dashWindowStart, dashWindowStart + 3);
                  const buckets = [...visibleMonths, HOLD_KEY];
                  return buckets.map((bucketKey) => {
                    const isHold = bucketKey === HOLD_KEY;
                    const items = getBucketItems(bucketKey);
                    const data = isHold ? null : ACTION_CALENDAR[bucketKey];
                    const isDragOver = dragOverBucket === bucketKey;
                    return (
                      <div
                        key={bucketKey}
                        className={`dash-col ${isHold ? "hold" : ""} ${isDragOver ? "drag-over" : ""}`}
                        onDragOver={(e) => handleDragOver(e, bucketKey)}
                        onDragLeave={(e) => handleDragLeave(e, bucketKey)}
                        onDrop={(e) => handleDrop(e, bucketKey)}
                      >
                        <div className="dash-col-head">
                          <span>
                            {isHold ? "On Hold" : <span className="mo">{bucketKey.split(" ")[0]}</span>}
                            {!isHold && data && <span style={{color:"var(--text-dim)", fontSize:"8px", marginLeft:"6px"}}>{data.phase?.replace(/Phase \d+ — /, "")}</span>}
                          </span>
                          <span className="count">{items.length}</span>
                        </div>

                        {items.length === 0 && (
                          <div className="empty" style={{padding:"24px 0", fontSize:"10px"}}>
                            {isHold ? "Drag items here to set aside" : "Drop items here"}
                          </div>
                        )}

                        {items.map((item) => {
                          const isDone = dashDone[item.key];
                          const isDragging = draggingKey === item.key;
                          const isMoved = item.kind === "preloaded" && item.originalMonth !== bucketKey;
                          return (
                            <div
                              key={item.key}
                              className={`dash-item ${isDone ? "done" : ""} ${isDragging ? "dragging" : ""} ${item.kind === "custom" ? "custom" : ""}`}
                              draggable={true}
                              onDragStart={(e) => handleDragStart(e, item.key)}
                              onDragEnd={handleDragEnd}
                            >
                              <span className="grip" title="Drag to move">⋮⋮</span>
                              <input
                                type="checkbox"
                                checked={!!isDone}
                                onChange={() => toggleDashDone(item.key)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="track-dot" style={{background: TRACK_META[item.track]?.color || "var(--sage)"}} />
                              <span className="item-text">
                                {item.text}
                                {isMoved && <span style={{color:"var(--text-dim)", fontSize:"9px", marginLeft:"6px", fontStyle:"italic"}}> (from {item.originalMonth.split(" ")[0]})</span>}
                              </span>
                              <button
                                className="remove-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (item.kind === "custom") removeCustomItem(item.bucket, item.id);
                                  else removePreloadedItem(item.key);
                                }}
                                title="Remove from dashboard"
                              >
                                ×
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Add Item Modal */}
              {addModalOpen && (
                <div className="add-modal-backdrop" onClick={() => setAddModalOpen(false)}>
                  <div className="add-modal" onClick={(e) => e.stopPropagation()}>
                    <h3>Add <em>Custom Item</em></h3>
                    <div className="add-field">
                      <label>Task</label>
                      <textarea
                        value={addForm.text}
                        onChange={(e) => setAddForm({...addForm, text: e.target.value})}
                        placeholder="E.g. Pitch Fast Company on Fieldwork origin story"
                        autoFocus
                      />
                    </div>
                    <div className="add-field">
                      <label>Track</label>
                      <select
                        value={addForm.track}
                        onChange={(e) => setAddForm({...addForm, track: e.target.value})}
                      >
                        <option value="offsite">Offsites & Fieldwork</option>
                        <option value="wedding">Weddings</option>
                        <option value="stay">Nightly Stays</option>
                        <option value="wellness">Wellness Retreats</option>
                        <option value="all">Cross-cutting</option>
                      </select>
                    </div>
                    <div className="add-field">
                      <label>Place in</label>
                      <select
                        value={addForm.bucket}
                        onChange={(e) => setAddForm({...addForm, bucket: e.target.value})}
                      >
                        <option value="">Select a month or Hold...</option>
                        {MONTHS_ORDER.map(m => <option key={m} value={m}>{m}</option>)}
                        <option value={HOLD_KEY}>On Hold</option>
                      </select>
                    </div>
                    <div className="add-actions">
                      <button className="btn-ghost" onClick={() => setAddModalOpen(false)}>Cancel</button>
                      <button
                        className="btn-primary"
                        onClick={addCustomItem}
                        disabled={!addForm.text.trim() || !addForm.bucket}
                      >
                        Add Item
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ════════════════════════════════════════════════════════════
              RESEARCH & DRAFT TAB
              ════════════════════════════════════════════════════════════ */}
          {activeTab === "research" && (
            <>
              {/* ERROR (persistent until dismissed) */}
              {errorState && phase === "idle" && (
                <div className="error-card">
                  <div className="err-head">
                    <span className="err-mark">Last cycle failed</span>
                    <span className="err-title">{errorState.title}</span>
                  </div>
                  <div className="err-body">{errorState.body}</div>
                  {errorState.raw && (
                    <>
                      <div style={{fontSize:"9px", letterSpacing:"0.14em", textTransform:"uppercase", color:"var(--text-dim)", marginTop:"10px"}}>Raw response</div>
                      <div className="err-raw">{errorState.raw}</div>
                    </>
                  )}
                  <div className="err-actions">
                    <button className="btn-ghost" onClick={() => setErrorState(null)}>Dismiss</button>
                  </div>
                </div>
              )}

              {/* LOG (visible when an error occurred so you can see what happened) */}
              {errorState && phase === "idle" && log.length > 0 && (
                <div className="log-panel">
                  {log.map((entry, i) => (
                    <div key={i} className="log-entry">
                      <span className="ts">{entry.ts}</span>
                      <span className="ag">{entry.agent}</span>
                      {entry.msg}
                    </div>
                  ))}
                </div>
              )}

              {/* IDLE */}
              {phase === "idle" && (
                <div className="hero-card">
                  <h2>Run a research cycle <em>for the selected track(s)</em></h2>
                  <p className="hero-sub">
                    The Research Agent will scan publications, events, partners, and content opportunities across {trackFilter === "all" ? "all 12 categories" : "the selected track's categories"}. You'll review and approve what to pursue, then the Draft Agent will write each approved piece in the right voice for the right channel.
                  </p>
                  <button className="btn-primary" onClick={runResearch}>
                    Run Research Cycle
                  </button>
                </div>
              )}

              {/* RESEARCHING */}
              {phase === "researching" && (
                <>
                  <div className="progress-wrap">
                    <div className="progress-label">{progressLabel}</div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="pulse-dots">
                      <div className="pulse-dot" />
                      <div className="pulse-dot" />
                      <div className="pulse-dot" />
                    </div>
                  </div>
                  <div className="log-panel">
                    {log.map((entry, i) => (
                      <div key={i} className="log-entry">
                        <span className="ts">{entry.ts}</span>
                        <span className="ag">{entry.agent}</span>
                        {entry.msg}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* REVIEWING */}
              {phase === "reviewing" && (
                <>
                  <div className="phase-banner">
                    <div className="pb-head">
                      <span className="pb-mark">Review Phase</span>
                      <span className="pb-title">{opportunities.length} opportunities · {Object.values(decisions).filter(d => d === "approved").length} approved</span>
                    </div>
                    <div className="pb-body">
                      Approve the opportunities you want to pursue. Optionally generate an SEO brief for any opportunity before drafting — briefs pass to the drafting agent and shape keyword placement.
                    </div>
                  </div>

                  {CATEGORIES.map(cat => {
                    const items = opportunities.filter(o => o.category === cat.id);
                    if (!items.length) return null;
                    const trackLabel = TRACK_META[cat.track]?.name || "";
                    return (
                      <div key={cat.id} className="cat-group">
                        <div className="cat-head">
                          <div className="cat-icon" style={{ background: cat.color }}>{cat.icon}</div>
                          <div className="cat-title">{cat.name}</div>
                          <div className="cat-count">{items.length}</div>
                          <div className="cat-track" style={{ color: cat.color, border: `1px solid ${cat.color}40` }}>{trackLabel}</div>
                        </div>
                        {items.map(opp => {
                          const decision = decisions[opp.id];
                          const brief = seoBriefs[opp.id];
                          const briefLoading = seoBriefLoading[opp.id];
                          return (
                            <div key={opp.id} className={`opp-card ${decision === "approved" ? "approved" : ""} ${decision === "skipped" ? "skipped" : ""}`}>
                              <div className="opp-top">
                                <div className="opp-name">{opp.name}</div>
                                <div className="opp-meta">
                                  <span className={`tag seo-${opp.seo_value || "low"}`}>SEO: {opp.seo_value || "?"}</span>
                                  <span className="tag">{opp.da_estimate || "DA: ?"}</span>
                                  <span className="tag">{opp.priority || "med"}</span>
                                </div>
                              </div>
                              <div className="opp-why">{opp.why}</div>
                              <div className="opp-action"><b>Action:</b> {opp.action}</div>
                              {opp.timing && <div className="opp-action" style={{fontStyle:"italic"}}><b>Timing:</b> {opp.timing}</div>}

                              {brief && (
                                <div className="seo-brief">
                                  <span className="label">SEO Brief</span>
                                  {brief}
                                </div>
                              )}
                              {briefLoading && (
                                <div className="seo-brief">
                                  <span className="label">SEO Brief</span>
                                  <span style={{fontStyle:"italic"}}>Generating brief...</span>
                                </div>
                              )}

                              <div className="opp-foot">
                                <div className="opp-btns">
                                  <button
                                    className={`btn-tiny ${decision === "approved" ? "approved" : ""}`}
                                    onClick={() => toggleApprove(opp.id)}
                                  >
                                    {decision === "approved" ? "✓ Approved" : "Approve"}
                                  </button>
                                  <button
                                    className={`btn-tiny ${decision === "skipped" ? "skipped" : ""}`}
                                    onClick={() => toggleSkip(opp.id)}
                                  >
                                    {decision === "skipped" ? "✕ Skipped" : "Skip"}
                                  </button>
                                  {!brief && !briefLoading && (
                                    <button className="btn-tiny" onClick={() => generateSeoBrief(opp)}>
                                      + SEO Brief
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </>
              )}

              {/* DRAFTING / COMPLETE */}
              {(phase === "drafting" || phase === "complete") && (
                <>
                  <div className="phase-banner">
                    <div className="pb-head">
                      <span className="pb-mark">{phase === "complete" ? "Drafts Complete" : "Drafting"}</span>
                      <span className="pb-title">Cycle #{cycleNum - (phase === "complete" ? 1 : 0)} · {Object.keys(drafts).length} drafts</span>
                    </div>
                    <div className="pb-body">
                      Review drafts below. Copy the ones you want to use. Drafts are saved to the Library permanently.
                    </div>
                  </div>

                  {opportunities.filter(o => decisions[o.id] === "approved").map(opp => {
                    const cat = CATEGORIES.find(c => c.id === opp.category);
                    const draft = drafts[opp.id];
                    const meta = draftMeta[opp.id];
                    const loading = draftLoading[opp.id];
                    return (
                      <div key={opp.id} className="draft-card">
                        <div className="draft-head">
                          <div className="draft-cat" style={{ background: cat?.color || "var(--sage)", color: "var(--forest)" }}>
                            {cat?.name || opp.category}
                          </div>
                          <div className="draft-name">{opp.name}</div>
                          {draft && (
                            <button className="copy-btn" onClick={() => copyDraft(draft)}>Copy</button>
                          )}
                        </div>
                        {loading ? (
                          <div className="draft-spin">
                            <div className="pulse-dots" style={{margin:0}}>
                              <div className="pulse-dot" />
                              <div className="pulse-dot" />
                              <div className="pulse-dot" />
                            </div>
                            Drafting in Vanderkamp voice...
                          </div>
                        ) : (
                          <>
                            <div className="draft-body">{draft || "Pending..."}</div>
                            {meta && Object.keys(meta).length > 0 && (
                              <div className="draft-meta-block">
                                <span className="label">SEO Metadata</span>
                                {meta.title_tag && meta.title_tag !== "N/A" && <div><b>Title:</b> {meta.title_tag}</div>}
                                {meta.meta_description && meta.meta_description !== "N/A" && <div><b>Meta:</b> {meta.meta_description}</div>}
                                {meta.primary_keyword && <div><b>Primary KW:</b> {meta.primary_keyword}</div>}
                                {meta.supporting_keywords && <div><b>Supporting:</b> {meta.supporting_keywords}</div>}
                                {meta.backlink_value && <div><b>Backlink Value:</b> {meta.backlink_value}</div>}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}

                  {phase === "complete" && (
                    <div style={{ marginTop: "28px", textAlign: "center" }}>
                      <p style={{ fontSize: "10px", color: "var(--text-dim)", marginBottom: "14px" }}>
                        Cycle complete · {Object.keys(drafts).length} drafts saved to Library
                      </p>
                      <button className="btn-primary" onClick={reset}>Start New Cycle</button>
                    </div>
                  )}
                </>
              )}

              {/* Approve bar */}
              {phase === "reviewing" && (
                <div className="approve-bar">
                  <div className="approve-bar-left">
                    <b>{Object.values(decisions).filter(d => d === "approved").length}</b> of {opportunities.length} approved
                    <span>· {Object.values(seoBriefs).filter(Boolean).length} with SEO brief</span>
                  </div>
                  <div className="approve-bar-right">
                    <button className="btn-ghost" onClick={reset}>Start Over</button>
                    <button
                      className="btn-primary"
                      onClick={runDrafting}
                      disabled={!Object.values(decisions).filter(d => d === "approved").length}
                    >
                      Draft {Object.values(decisions).filter(d => d === "approved").length} Item{Object.values(decisions).filter(d => d === "approved").length === 1 ? "" : "s"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ════════════════════════════════════════════════════════════
              LIBRARY TAB
              ════════════════════════════════════════════════════════════ */}
          {activeTab === "library" && (
            <>
              <div className="page-header">
                <h1 className="page-title">Draft <em>Library</em></h1>
                <p className="page-desc">Every approved draft from every cycle. Click to expand, copy, reuse.</p>
              </div>

              {history.length === 0 && (
                <div className="empty">No cycles completed yet. Start one on the Research & Draft tab.</div>
              )}

              {history.flatMap(h => h.opportunities.map(opp => ({ ...opp, cycle: h.cycle, date: h.date, track: h.track }))).map((item, i) => {
                const cat = CATEGORIES.find(c => c.id === item.category);
                return (
                  <details key={`${item.id}-${i}`} className="lib-entry">
                    <summary style={{cursor:"pointer", listStyle:"none"}}>
                      <div className="lib-head">
                        <div className="lib-title">{item.name}</div>
                        <div className="lib-meta">
                          <span style={{ color: cat?.color || "var(--sage)" }}>{cat?.name || item.category}</span>
                          <span>Cycle #{item.cycle}</span>
                          <span>{item.date}</span>
                        </div>
                      </div>
                    </summary>
                    <div className="lib-body">
                      {item.draft || "(no draft)"}
                      {item.meta && (
                        <div className="draft-meta-block" style={{marginTop:"12px"}}>
                          <span className="label">SEO Metadata</span>
                          {item.meta.title_tag && item.meta.title_tag !== "N/A" && <div><b>Title:</b> {item.meta.title_tag}</div>}
                          {item.meta.meta_description && item.meta.meta_description !== "N/A" && <div><b>Meta:</b> {item.meta.meta_description}</div>}
                          {item.meta.primary_keyword && <div><b>Primary KW:</b> {item.meta.primary_keyword}</div>}
                        </div>
                      )}
                    </div>
                  </details>
                );
              })}
            </>
          )}

          {/* ════════════════════════════════════════════════════════════
              SEO TRACKER TAB
              ════════════════════════════════════════════════════════════ */}
          {activeTab === "seo" && (
            <>
              <div className="page-header">
                <h1 className="page-title">SEO <em>Tracker</em></h1>
                <p className="page-desc">Target keywords across all four tracks. Log monthly ranks from Google Search Console — the tracker builds your rank history visually so you can see movement.</p>
              </div>

              <div className="seo-scorebar">
                <div className="seo-stat">
                  <div className="seo-stat-label">Keywords Tracked</div>
                  <div className="seo-stat-value">{seoStats.tracked}</div>
                </div>
                <div className="seo-stat">
                  <div className="seo-stat-label">With Rank Entries</div>
                  <div className="seo-stat-value">{seoStats.withEntries} <em>/ {seoStats.tracked}</em></div>
                </div>
                <div className="seo-stat">
                  <div className="seo-stat-label">Improving</div>
                  <div className="seo-stat-value">{seoStats.improving}</div>
                </div>
              </div>

              <div className="phase-banner" style={{marginBottom:"20px"}}>
                <div className="pb-head">
                  <span className="pb-mark">Data source</span>
                  <span className="pb-title">Google Search Console (free)</span>
                </div>
                <div className="pb-body">
                  Connect vanderkampny.com to Google Search Console. Check monthly for your real ranks on these terms, then enter them here. Ranks over time show you what's working and what needs more content/links.
                </div>
              </div>

              {["offsite","wedding","stay","wellness"].map(track => {
                const trackKws = keywords.filter(k => k.track === track);
                if (!trackKws.length) return null;
                return (
                  <div key={track} className="cat-group">
                    <div className="cat-head">
                      <div className="cat-icon" style={{ background: TRACK_META[track].color }} />
                      <div className="cat-title">{TRACK_META[track].name}</div>
                      <div className="cat-count">{trackKws.length} keywords</div>
                    </div>
                    {trackKws.map(kw => {
                      const latestRank = kw.history.length > 0 ? kw.history[kw.history.length - 1].rank : null;
                      const maxHistRank = kw.history.length > 0 ? Math.max(...kw.history.map(h => h.rank), 100) : 100;
                      return (
                        <div key={kw.term} className="kw-row">
                          <div className="kw-top">
                            <div className="kw-term">{kw.term}</div>
                            <div className="kw-tags">
                              <span className={`kw-tag ${kw.priority}`}>{kw.priority}</span>
                              <span className="kw-tag">{kw.intent}</span>
                              <span className="kw-tag">→ {kw.target}</span>
                            </div>
                          </div>
                          <div className="kw-meta">
                            <span>Latest rank: <b style={{color: latestRank ? "var(--sage)" : "var(--text-dim)"}}>{latestRank || "—"}</b></span>
                            <span>Entries: {kw.history.length}</span>
                          </div>
                          <div className="kw-input-row">
                            <input
                              className="kw-input"
                              type="number"
                              placeholder="Enter current rank (1-200)"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  logKeywordRank(kw.term, e.target.value);
                                  e.target.value = "";
                                }
                              }}
                            />
                          </div>
                          {kw.history.length > 0 && (
                            <div className="kw-history">
                              {kw.history.slice(-12).map((h, i) => (
                                <div
                                  key={i}
                                  className="kw-bar"
                                  style={{
                                    height: `${Math.max(4, 100 - (h.rank / maxHistRank) * 100)}%`,
                                    minHeight: "4px",
                                  }}
                                  title={`${h.date}: #${h.rank}`}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}

          {/* ════════════════════════════════════════════════════════════
              BRAND CONTEXT TAB
              ════════════════════════════════════════════════════════════ */}
          {activeTab === "brand" && (
            <>
              <div className="page-header">
                <h1 className="page-title">Brand <em>Context</em></h1>
                <p className="page-desc">The brand context every agent uses for every draft. This is the single source of truth — voice rules per track, positioning, key product details.</p>
              </div>

              <div className="brand-preview">
                <div className="brand-label">Master Positioning</div>
                <div className="brand-body">
                  <b>Vanderkamp is a place, not a product.</b> 850 acres of forest, glacial lake, wetland, and open field in upstate New York. The place designed for the state where deep work happens. The philosophy: the environment you are in shapes what becomes possible while you are in it.
                </div>
              </div>

              <div className="brand-preview">
                <div className="brand-label">Four Revenue Tracks</div>
                <div className="brand-body">
                  <b>Offsites & Fieldwork™</b> — largest marketing focus. Fills weekday/shoulder-season open capacity.<br />
                  <b>Weddings</b> — 10 per year, each with the full run of 850 acres. Pipeline focus: 2027 and 2028.<br />
                  <b>Nightly Stays</b> — shoulder-season lift + direct-booking from Airbnb-heavy mix.<br />
                  <b>Wellness Retreats</b> — 15 per year, experienced practitioners, venue rental only in 2026.
                </div>
              </div>

              <div className="brand-preview">
                <div className="brand-label">Voice Rules — Offsites</div>
                <div className="brand-body">
                  <b>Use:</b> deep work, clear thinking, strategic clarity, decision quality, thinking environment, cognitive bandwidth, attention, field work<br /><br />
                  <b>Avoid:</b> wellness, self-care, mindfulness retreat, relaxation, escape, getaway, disconnect, unplug, spa<br /><br />
                  <b>Tone:</b> thoughtful, grounded, confident without arrogance. A place that has quietly observed hundreds of leaders and is sharing what it has noticed.
                </div>
              </div>

              <div className="brand-preview">
                <div className="brand-label">Voice Rules — Weddings</div>
                <div className="brand-body">
                  <b>Use:</b> intentional, unhurried, private, whole property, one wedding at a time, 850 acres, considered, specific to you<br /><br />
                  <b>Avoid:</b> "destination," "luxury," "bespoke," "magical," "dream wedding" — these signal commodity wedding marketing<br /><br />
                  <b>Tone:</b> thoughtful people describing a real place, not a brochure.
                </div>
              </div>

              <div className="brand-preview">
                <div className="brand-label">Voice Rules — Stays</div>
                <div className="brand-body">
                  <b>Use:</b> quiet, forest, glacial lake, wetland, season, property-wide, specific, grounded<br /><br />
                  <b>Avoid:</b> "luxury," "hideaway," "escape," "getaway"<br /><br />
                  <b>Tone:</b> closer to a naturalist's or an editor's voice than a travel agent's.
                </div>
              </div>

              <div className="brand-preview">
                <div className="brand-label">Voice Rules — Wellness</div>
                <div className="brand-body">
                  Vanderkamp never markets itself as wellness. It markets the venue to experienced practitioners. Wellness retreats on the Events Calendar and newsletter are described factually — name, teacher, dates, signup link. In outreach to practitioners: peer-to-peer tone, never sales-pitchy.
                </div>
              </div>

              <div className="brand-preview">
                <div className="brand-label">Two-Account Social Model</div>
                <div className="brand-body">
                  <b>VK Brand (primary, 3-4x/week):</b> 50% Field Journal + What Became Clear cards · 20% What We See posts · 15% Stays · 15% Weddings<br /><br />
                  <b>Troy Personal (rare, 3-4x/year):</b> Reposts VK 1-2x/month. Originals only for major moments. Restraint is the strategy.
                </div>
              </div>

              <div className="brand-preview">
                <div className="brand-label">Key Programs Launching in 2026</div>
                <div className="brand-body">
                  <b>Fieldwork™</b> — June 1 public launch. Structured solo offsite, 8 Nature Profiles, custom Field Guide.<br /><br />
                  <b>Writer-in-Residence</b> — June applications open, October first resident. Quarterly shoulder-season stays for writers/photographers in exchange for published work.<br /><br />
                  <b>Brought-By Cohort</b> — August launch. Coaches bring 4-8 clients for parallel Fieldwork. Target first booking October.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
