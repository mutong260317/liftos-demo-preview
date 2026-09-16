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
        bodyWeight: null,
        goal: "综合力量",
        name: "训练者",
        previousValueMode: "same_routine",
        keepAwake: true,
      });
    }
  }

  /**
   * Demo isolation: SeedHistory is overlay-only under liftos.demo.history.
   * Production liftos.history is never written with demo ids.
   */
  const DEMO_HISTORY_KEY = "liftos.demo.history";

  function isDemoMode() {
    try {
      return new URLSearchParams(location.search).get("demo") === "1";
    } catch {
      return false;
    }
  }

  function enterDemoMode() {
    try {
      if (!isDemoMode()) return false;
      const seed = LiftOS.SeedHistory || [];
      write(DEMO_HISTORY_KEY, seed);
      return true;
    } catch {
      return false;
    }
  }

  function clearDemoOverlay() {
    try {
      localStorage.removeItem(DEMO_HISTORY_KEY);
      return true;
    } catch {
      return false;
    }
  }

  /** History used by stats: production + optional demo overlay (never merged into prod). */
  function getHistoryForStats() {
    const prod = read(KEYS.history, []);
    if (!isDemoMode()) return prod;
    const demo = read(DEMO_HISTORY_KEY, []);
    const prodIds = new Set(prod.map((h) => h.id));
    return prod.concat(demo.filter((h) => h && !prodIds.has(h.id)));
  }

  function init() {
    try {
      LiftOS.Migrations.run();
    } catch (_) {}
    ensureDefaults();
    enterDemoMode();
  }

  function exportPayload() {
    return {
      exportVersion: 1,
      appVersion: LiftOS.APP_VERSION,
      schemaVersion: LiftOS.Migrations.getVersion(),
      exportedAt: new Date().toISOString(),
      plans: read(KEYS.plans, []),
      history: read(KEYS.history, []), // production only — demo overlay never exported
      notes: read(KEYS.notes, {}),
      prefs: read(KEYS.prefs, {}),
      activeSession: read(KEYS.session, null),
    };
  }

  const SUPPORTED_EXPORT_VERSIONS = new Set([1]);

  /** Snapshot only LiftOS business keys (presence + parsed value). */
  function captureCurrentState() {
    const keys = [KEYS.plans, KEYS.history, KEYS.notes, KEYS.prefs, KEYS.session, KEYS.schemaVersion];
    const snap = { keys: {} };
    keys.forEach((k) => {
      const raw = localStorage.getItem(k);
      if (raw == null) {
        snap.keys[k] = { present: false, raw: null };
      } else {
        snap.keys[k] = { present: true, raw };
      }
    });
    return snap;
  }

  /** Restore snapshot: missing keys stay missing; never localStorage.clear(). */
  function restoreState(snapshot) {
    if (!snapshot || !snapshot.keys) throw new Error("invalid snapshot");
    Object.keys(snapshot.keys).forEach((k) => {
      const cell = snapshot.keys[k];
      if (!cell.present) localStorage.removeItem(k);
      else localStorage.setItem(k, cell.raw);
    });
    return true;
  }

  function validateImport(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { ok: false, error: "不是有效 JSON 对象" };
    }
    if (data.exportVersion == null) {
      return { ok: false, error: "缺少 exportVersion" };
    }
    if (!SUPPORTED_EXPORT_VERSIONS.has(data.exportVersion)) {
      return {
        ok: false,
        error: "当前 LiftOS 不支持此备份格式，请先升级 App。",
        code: "UNSUPPORTED_EXPORT_VERSION",
      };
    }

    // schemaVersion: missing → treat as legacy (pre-schema); reject future
    let schemaVersion = LiftOS.CURRENT_SCHEMA_VERSION;
    if (data.schemaVersion != null) {
      if (typeof data.schemaVersion !== "number" || !Number.isFinite(data.schemaVersion)) {
        return { ok: false, error: "schemaVersion 无效", code: "INVALID_SCHEMA" };
      }
      if (data.schemaVersion > LiftOS.CURRENT_SCHEMA_VERSION) {
        return {
          ok: false,
          error: "此备份由更高版本 LiftOS 创建，请先升级 App 后再恢复。",
          code: "FUTURE_SCHEMA",
        };
      }
      if (data.schemaVersion < 0) {
        return { ok: false, error: "schemaVersion 无效", code: "INVALID_SCHEMA" };
      }
      schemaVersion = data.schemaVersion;
    }

    if (!Array.isArray(data.plans)) return { ok: false, error: "plans 必须是数组" };
    if (!Array.isArray(data.history)) return { ok: false, error: "history 必须是数组" };
    if (data.notes != null && (typeof data.notes !== "object" || Array.isArray(data.notes))) {
      return { ok: false, error: "notes 结构无效" };
    }
    if (data.history.some((h) => !h || typeof h !== "object" || !h.id)) {
      return { ok: false, error: "history 条目缺少 id" };
    }
    if (data.plans.some((p) => !p || typeof p !== "object" || !p.id || !Array.isArray(p.exercises))) {
      return { ok: false, error: "plan 结构无效" };
    }

    return {
      ok: true,
      schemaVersion,
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

  /** Re-read and assert imported structures are still valid. */
  function postImportIntegrityCheck() {
    const plans = read(KEYS.plans, null);
    const history = read(KEYS.history, null);
    const notes = read(KEYS.notes, null);
    const prefs = read(KEYS.prefs, null);
    const session = read(KEYS.session, null);
    const schemaRaw = localStorage.getItem(KEYS.schemaVersion);
    const schema = schemaRaw == null ? null : parseInt(schemaRaw, 10);

    if (!Array.isArray(plans)) return { ok: false, error: "plans 校验失败" };
    if (!Array.isArray(history)) return { ok: false, error: "history 校验失败" };
    if (!notes || typeof notes !== "object" || Array.isArray(notes)) return { ok: false, error: "notes 校验失败" };
    if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) return { ok: false, error: "prefs 校验失败" };
    if (session != null && (typeof session !== "object" || Array.isArray(session))) {
      return { ok: false, error: "session 校验失败" };
    }
    if (schema != null && (!Number.isFinite(schema) || schema < 0 || schema > LiftOS.CURRENT_SCHEMA_VERSION)) {
      return { ok: false, error: "schemaVersion 校验失败" };
    }
    return { ok: true };
  }

  /**
   * Atomic import: all-or-nothing.
   * Order: validate → capture → backup → write business data → migrate →
   * integrity check → commit schemaVersion. Any failure restores capture.
   */
  function importPayload(data) {
    const v = validateImport(data);
    if (!v.ok) {
      return { ok: false, error: v.error, code: v.code || "VALIDATE" };
    }

    const original = captureCurrentState();
    try {
      const backupKey = snapshotBackup("pre-import");
      if (!backupKey) throw new Error("backup failed");
    } catch (err) {
      console.error("LiftOS import aborted: backup failed", err);
      return {
        ok: false,
        error: "无法创建恢复备份，已中止导入，原数据未改动。",
        code: "BACKUP_FAILED",
      };
    }

    const failAt = LiftOS.__TEST_FAIL_AT || null;
    const shouldFail = (step) => failAt === step;

    try {
      if (shouldFail("plans")) throw new Error("forced fail plans");
      write(KEYS.plans, data.plans);

      if (shouldFail("history")) throw new Error("forced fail history");
      write(KEYS.history, data.history);

      if (shouldFail("notes")) throw new Error("forced fail notes");
      write(KEYS.notes, data.notes || {});

      if (shouldFail("prefs")) throw new Error("forced fail prefs");
      if (data.prefs && typeof data.prefs === "object") write(KEYS.prefs, data.prefs);

      if (shouldFail("session")) throw new Error("forced fail session");
      if (data.activeSession) write(KEYS.session, data.activeSession);
      else localStorage.removeItem(KEYS.session);

      // Business data written. Align schema to import source, then migrate up.
      // Do NOT commit CURRENT_SCHEMA_VERSION until integrity passes.
      if (shouldFail("migrate")) throw new Error("forced fail migrate");
      let startSchema = typeof data.schemaVersion === "number" ? data.schemaVersion : 1;
      if (startSchema > LiftOS.CURRENT_SCHEMA_VERSION) startSchema = LiftOS.CURRENT_SCHEMA_VERSION;
      localStorage.setItem(KEYS.schemaVersion, String(startSchema));
      try {
        LiftOS.Migrations.run();
      } catch (err) {
        console.error("LiftOS import: migration failed", err);
        throw err;
      }

      if (shouldFail("integrity")) throw new Error("forced fail integrity");
      const check = postImportIntegrityCheck();
      if (!check.ok) throw new Error(check.error || "post-import integrity failed");

      // Success: commit schema version last
      localStorage.setItem(KEYS.schemaVersion, String(LiftOS.CURRENT_SCHEMA_VERSION));
      return { ok: true, backedUp: true, schemaVersion: LiftOS.CURRENT_SCHEMA_VERSION };
    } catch (err) {
      console.error("LiftOS import failed, rolling back", err);
      try {
        restoreState(original);
        return {
          ok: false,
          error: "恢复失败，原数据已安全保留。",
          code: "ROLLBACK_OK",
          rolledBack: true,
          cause: String(err && err.message ? err.message : err),
        };
      } catch (rbErr) {
        console.error("LiftOS import rollback ALSO failed", rbErr);
        return {
          ok: false,
          error: "恢复失败，请不要继续操作，并使用最近备份恢复数据。",
          code: "ROLLBACK_FAILED",
          rolledBack: false,
          cause: String(err && err.message ? err.message : err),
        };
      }
    }
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
    getHistoryForStats,
    clearDemoOverlay,
    isDemoMode,
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
    captureCurrentState,
    restoreState,
    postImportIntegrityCheck,
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
