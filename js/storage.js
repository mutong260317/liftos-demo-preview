/* localStorage persistence — WorkoutSession, plans, notes, history, prefs.
   Production NEVER injects demo training history. */

window.LiftOS = window.LiftOS || {};

LiftOS.Storage = (() => {
  const KEYS = {
    session: "liftos.session",
    plans: "liftos.plans",
    notes: "liftos.notes",
    history: "liftos.history",
    prefs: "liftos.prefs",
    schemaVersion: "liftos.schemaVersion",
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  /** Initialize only missing keys. Never overwrite existing user data. */
  function ensureDefaults() {
    if (localStorage.getItem(KEYS.history) == null) {
      write(KEYS.history, []);
    }
    if (localStorage.getItem(KEYS.plans) == null) {
      write(KEYS.plans, LiftOS.defaultPlans());
    }
    if (localStorage.getItem(KEYS.notes) == null) {
      write(KEYS.notes, {});
    }
    if (localStorage.getItem(KEYS.prefs) == null) {
      write(KEYS.prefs, {
        theme: "dark",
        restDefault: 90,
        weeklyTarget: 5,
        bodyWeight: 90,
        goal: "综合力量 + 减脂",
        name: "牧童",
      });
    }
  }

  /** Dev/demo only: ?demo=1 loads SeedHistory for UI testing. Never auto. */
  function loadDemoHistoryIfRequested() {
    try {
      const q = new URLSearchParams(location.search);
      if (q.get("demo") !== "1") return false;
      const hist = read(KEYS.history, []);
      const seed = LiftOS.SeedHistory || [];
      const seedIds = new Set(seed.map((x) => x.id));
      const merged = hist.filter((h) => !seedIds.has(h.id)).concat(seed);
      write(KEYS.history, merged);
      return true;
    } catch {
      return false;
    }
  }

  function init() {
    try {
      LiftOS.Migrations.run();
    } catch (_) {}
    ensureDefaults();
    loadDemoHistoryIfRequested();
  }

  function exportPayload() {
    return {
      exportVersion: 1,
      appVersion: LiftOS.APP_VERSION,
      schemaVersion: LiftOS.Migrations.getVersion(),
      exportedAt: new Date().toISOString(),
      plans: read(KEYS.plans, []),
      history: read(KEYS.history, []),
      notes: read(KEYS.notes, {}),
      prefs: read(KEYS.prefs, {}),
      activeSession: read(KEYS.session, null),
    };
  }

  function validateImport(data) {
    if (!data || typeof data !== "object") return { ok: false, error: "不是有效 JSON 对象" };
    if (data.exportVersion == null) return { ok: false, error: "缺少 exportVersion" };
    if (!Array.isArray(data.plans)) return { ok: false, error: "plans 必须是数组" };
    if (!Array.isArray(data.history)) return { ok: false, error: "history 必须是数组" };
    if (data.notes != null && typeof data.notes !== "object") return { ok: false, error: "notes 结构无效" };
    // basic per-item checks
    if (data.history.some((h) => !h || typeof h !== "object" || !h.id)) {
      return { ok: false, error: "history 条目缺少 id" };
    }
    if (data.plans.some((p) => !p || typeof p !== "object" || !p.id || !Array.isArray(p.exercises))) {
      return { ok: false, error: "plan 结构无效" };
    }
    return {
      ok: true,
      summary: {
        history: data.history.length,
        plans: data.plans.length,
        notes: data.notes ? Object.keys(data.notes).length : 0,
      },
    };
  }

  /** Snapshot current data to a backup key before destructive restore. */
  function snapshotBackup(tag = "pre-import") {
    const payload = exportPayload();
    const key = `liftos.backup.${tag}.${Date.now()}`;
    write(key, payload);
    // keep last 3 backups
    try {
      const keys = Object.keys(localStorage)
        .filter((k) => k.startsWith("liftos.backup."))
        .sort();
      while (keys.length > 3) {
        localStorage.removeItem(keys.shift());
      }
    } catch (_) {}
    return key;
  }

  /** Restore from validated import. Caller must validate first. */
  function importPayload(data) {
    snapshotBackup("pre-import");
    write(KEYS.plans, data.plans);
    write(KEYS.history, data.history);
    write(KEYS.notes, data.notes || {});
    if (data.prefs && typeof data.prefs === "object") write(KEYS.prefs, data.prefs);
    if (data.activeSession) write(KEYS.session, data.activeSession);
    else localStorage.removeItem(KEYS.session);
    if (typeof data.schemaVersion === "number" && data.schemaVersion > 0) {
      localStorage.setItem(KEYS.schemaVersion, String(Math.min(data.schemaVersion, LiftOS.CURRENT_SCHEMA_VERSION)));
    }
    // re-run migrations for older backups
    try {
      LiftOS.Migrations.run();
    } catch (_) {}
    return true;
  }

  return {
    KEYS,
    init,
    ensureDefaults,
    getSession: () => read(KEYS.session, null),
    saveSession(session) {
      if (!session) localStorage.removeItem(KEYS.session);
      else write(KEYS.session, session);
    },
    getPlans: () => read(KEYS.plans, []),
    savePlans(plans) {
      write(KEYS.plans, plans);
    },
    getNotes: () => read(KEYS.notes, {}),
    saveNotes(notes) {
      write(KEYS.notes, notes);
    },
    getNote(exerciseId) {
      const notes = read(KEYS.notes, {});
      return notes[exerciseId] || "";
    },
    setNote(exerciseId, text) {
      const notes = read(KEYS.notes, {});
      if (text && String(text).trim()) notes[exerciseId] = text;
      else delete notes[exerciseId];
      write(KEYS.notes, notes);
    },
    getHistory: () => read(KEYS.history, []),
    saveHistory(history) {
      write(KEYS.history, history);
    },
    appendHistory(entry) {
      const h = read(KEYS.history, []);
      h.unshift(entry);
      write(KEYS.history, h);
    },
    getPrefs: () => read(KEYS.prefs, { theme: "dark", restDefault: 90 }),
    savePrefs(prefs) {
      write(KEYS.prefs, Object.assign(read(KEYS.prefs, {}), prefs));
    },
    clearSession() {
      localStorage.removeItem(KEYS.session);
    },
    exportPayload,
    validateImport,
    importPayload,
    snapshotBackup,
    downloadExport(filename) {
      const payload = exportPayload();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || `liftos-backup-${LiftOS.localDateKey(new Date())}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return payload;
    },
  };
})();
