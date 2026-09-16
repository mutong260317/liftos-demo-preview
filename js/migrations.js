/* LiftOS Storage migrations — never wipe user data. */

window.LiftOS = window.LiftOS || {};

LiftOS.APP_VERSION = "0.3.0";
LiftOS.CURRENT_SCHEMA_VERSION = 5;

LiftOS.Migrations = (() => {
  const KEY_VERSION = "liftos.schemaVersion";

  function getVersion() {
    const raw = localStorage.getItem(KEY_VERSION);
    const v = raw == null ? 0 : parseInt(raw, 10);
    return Number.isFinite(v) ? v : 0;
  }

  function setVersion(v) {
    localStorage.setItem(KEY_VERSION, String(v));
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  /** v0/v1/v2/v3 → v4: strip only known SeedHistory demo entries from history. */
  function migrateToV4() {
    const seedIds = new Set((LiftOS.SeedHistory || []).map((x) => x.id));
    const history = readJson("liftos.history", null);
    if (Array.isArray(history)) {
      const cleaned = history.filter((x) => !(x && seedIds.has(x.id)));
      writeJson("liftos.history", cleaned);
    }

    // Remove demo notes only if text matches old default demo content exactly.
    const DEMO_NOTES = {
      incline: "座椅调到 4\n靠背 30°\n肩胛下沉\n不要耸肩",
      hack_squat: "安全杆略低\n全程控制离心",
    };
    const notes = readJson("liftos.notes", null);
    if (notes && typeof notes === "object") {
      const next = { ...notes };
      Object.keys(DEMO_NOTES).forEach((id) => {
        if (typeof next[id] === "string") {
          const a = next[id].replace(/\r\n/g, "\n").trim();
          const b = DEMO_NOTES[id].replace(/\r\n/g, "\n").trim();
          if (a === b) delete next[id];
        }
      });
      writeJson("liftos.notes", next);
    }
  }

  /** v4 → v5: normalize loadMode consistently for session + history. */
  function migrateToV5() {
    const fixSets = (exerciseId, sets) => {
      (sets || []).forEach((s) => {
        if (LiftOS.Gym?.applyLegacySetFields) LiftOS.Gym.applyLegacySetFields(exerciseId, s);
        else {
          if (!s.type) s.type = "work";
          if (s.durationSec == null) s.durationSec = null;
        }
      });
    };

    const session = readJson("liftos.session", null);
    if (session && Array.isArray(session.exercises)) {
      session.exercises.forEach((ex) => fixSets(ex.exerciseId, ex.sets));
      session.schema = 5;
      writeJson("liftos.session", session);
    }
    const history = readJson("liftos.history", null);
    if (Array.isArray(history)) {
      history.forEach((h) => {
        (h.exercises || []).forEach((ex) => fixSets(ex.exerciseId, ex.sets));
      });
      writeJson("liftos.history", history);
    }
    const prefs = readJson("liftos.prefs", null);
    if (prefs && typeof prefs === "object") {
      if (prefs.previousValueMode == null) prefs.previousValueMode = "same_routine";
      if (prefs.keepAwake == null) prefs.keepAwake = true;
      writeJson("liftos.prefs", prefs);
    }
  }

  const STEPS = [
    { to: 1, run: () => {} },
    { to: 2, run: () => {} },
    { to: 3, run: () => {} },
    { to: 4, run: migrateToV4 },
    { to: 5, run: migrateToV5 },
  ];

  /**
   * Idempotent migration. On failure, leave data as-is and do not raise version
   * past the last successful step (retry next launch).
   */
  function run() {
    try {
      let v = getVersion();
      if (v >= LiftOS.CURRENT_SCHEMA_VERSION) return { from: v, to: v, changed: false };

      // Fresh install (no version key and no user keys) → stamp current, skip demo scrub
      const hasAny =
        localStorage.getItem("liftos.history") != null ||
        localStorage.getItem("liftos.plans") != null ||
        localStorage.getItem("liftos.session") != null ||
        localStorage.getItem("liftos.notes") != null ||
        localStorage.getItem("liftos.prefs") != null;

      if (!hasAny && v === 0) {
        setVersion(LiftOS.CURRENT_SCHEMA_VERSION);
        return { from: 0, to: LiftOS.CURRENT_SCHEMA_VERSION, changed: true, fresh: true };
      }

      // Existing installs that used the old global seed flag without schemaVersion
      if (v === 0 && localStorage.getItem("liftos.seeded.v3")) {
        v = 3;
      } else if (v === 0 && localStorage.getItem("liftos.seeded.v2")) {
        v = 3;
      } else if (v === 0 && hasAny) {
        // unknown pre-versioned data: treat as v3 so v4 scrub runs once
        v = 3;
      }

      for (const step of STEPS) {
        if (step.to <= v) continue;
        if (step.to > LiftOS.CURRENT_SCHEMA_VERSION) break;
        step.run();
        v = step.to;
        setVersion(v);
      }
      return { from: getVersion(), to: LiftOS.CURRENT_SCHEMA_VERSION, changed: true };
    } catch (err) {
      console.warn("LiftOS migration failed, keeping data", err);
      return { from: getVersion(), to: getVersion(), changed: false, error: String(err) };
    }
  }

  return { run, getVersion, KEY_VERSION, migrateToV4 };
})();
