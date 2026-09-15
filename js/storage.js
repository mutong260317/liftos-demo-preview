/* localStorage persistence — WorkoutSession, plans, notes, history, prefs. */

window.LiftOS = window.LiftOS || {};

LiftOS.Storage = (() => {
  const KEYS = {
    session: "liftos.session",
    plans: "liftos.plans",
    notes: "liftos.notes",
    history: "liftos.history",
    prefs: "liftos.prefs",
    seeded: "liftos.seeded.v3",
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

  function seedIfNeeded() {
    if (localStorage.getItem(KEYS.seeded)) return;
    write(KEYS.plans, LiftOS.defaultPlans());
    write(KEYS.history, LiftOS.SeedHistory);
    write(KEYS.notes, {
      incline: "座椅调到 4\n靠背 30°\n肩胛下沉\n不要耸肩",
      hack_squat: "安全杆略低\n全程控制离心",
    });
    write(KEYS.prefs, {
      theme: "dark",
      restDefault: 90,
      weeklyTarget: 5,
      bodyWeight: 90,
      goal: "综合力量 + 减脂",
      name: "牧童",
    });
    localStorage.setItem(KEYS.seeded, "1");
  }

  return {
    KEYS,
    seedIfNeeded,
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
  };
})();
