// Presentation failures may degrade the view; gameplay failures must not be
// silently retried against potentially partially-mutated state.
export class RuntimeHealth {
  constructor(report = () => {}) {
    this.report = report;
    this.disabled = new Set();
    this.failures = [];
    this.fatal = false;
  }

  record(subsystem, error, fatal = false) {
    if (fatal ? this.fatal : this.disabled.has(subsystem)) return;
    if (fatal) this.fatal = true;
    else this.disabled.add(subsystem);
    const entry = { subsystem, fatal, message:String(error?.message || error).slice(0,500), at:Date.now() };
    this.failures.push(entry);
    if (this.failures.length > 16) this.failures.shift();
    // A broken notification must never produce a second game-loop failure.
    try { this.report(entry, error); } catch (reportError) { console.error('Runtime error reporting failed', reportError); }
  }

  optional(subsystem, update, fallback = undefined) {
    if (this.disabled.has(subsystem)) return fallback;
    try { return update(); }
    catch (error) { this.record(subsystem, error); return fallback; }
  }
}
