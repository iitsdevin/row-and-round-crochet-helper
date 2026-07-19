import { useEffect, useMemo, useRef, useState } from "react";
import grannySquare from "./data/granny-square.json";

const STORAGE = {
  patterns: "row-and-round.patterns.v1",
  progress: "row-and-round.progress.v1",
  active: "row-and-round.active.v1",
  textSize: "row-and-round.large-text.v1",
};

const starterPattern = {
  schemaVersion: 1,
  id: "cosy-scarf-starter",
  name: "Cosy Ribbed Scarf",
  description: "A short sample pattern that shows how imported projects appear in your library.",
  category: "Accessories",
  difficulty: "Beginner",
  hook: "5 mm",
  yarn: "DK / light worsted",
  source: "Sample pattern",
  steps: [
    { id: "scarf-1", section: "Foundation", title: "Make a slip knot", instruction: "Leave a comfortable tail, then make a slip knot.", count: null },
    { id: "scarf-2", section: "Foundation", title: "Chain 26", instruction: "Chain 26 loosely so the foundation edge stays flexible.", count: 26 },
    { id: "scarf-3", section: "Row 1", title: "Half double crochet ×24", instruction: "Starting in the third chain from the hook, work one half double crochet in each chain.", count: 24 },
    { id: "scarf-4", section: "Row 2", title: "Chain 2 and turn", instruction: "Chain 2, then turn your work. The turning chain does not count as a stitch.", count: null },
    { id: "scarf-5", section: "Row 2", title: "Back-loop half double crochet ×24", instruction: "Work one half double crochet in the back loop of every stitch.", count: 24 },
  ],
};

const BUILT_INS = [grannySquare, starterPattern];

function readStorage(key, fallback) {
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "crochet-pattern";
}

function uniqueSections(pattern) {
  return [...new Set(pattern.steps.map((step) => step.section))];
}

function normalisePattern(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("The pattern must be a JSON object.");
  }
  if (!String(input.name || "").trim()) {
    throw new Error("Add a pattern name before importing.");
  }
  if (!Array.isArray(input.steps) || input.steps.length === 0) {
    throw new Error("The pattern needs at least one step.");
  }

  const cleanSteps = input.steps.map((step, index) => {
    const title = String(step.title || "").trim();
    const instruction = String(step.instruction || title).trim();
    if (!title || !instruction) {
      throw new Error(`Step ${index + 1} needs a title and instruction.`);
    }
    const rawCount = step.count;
    const count = rawCount === "" || rawCount == null ? null : Number(rawCount);
    if (count !== null && (!Number.isInteger(count) || count < 1 || count > 500)) {
      throw new Error(`Step ${index + 1} has an invalid count. Use a whole number from 1 to 500.`);
    }
    return {
      id: `${slugify(input.name)}-${index + 1}`,
      section: String(step.section || "Pattern").trim() || "Pattern",
      title,
      instruction,
      count,
    };
  });

  return {
    schemaVersion: 1,
    id: `${slugify(input.name)}-${Date.now()}`,
    name: String(input.name).trim(),
    description: String(input.description || "An imported crochet pattern.").trim(),
    category: String(input.category || "My patterns").trim(),
    difficulty: String(input.difficulty || "Not specified").trim(),
    hook: String(input.hook || "Not specified").trim(),
    yarn: String(input.yarn || "Not specified").trim(),
    source: String(input.source || "Imported pattern").trim(),
    steps: cleanSteps,
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);

  if (rows.length < 2) throw new Error("The CSV needs a header row and at least one pattern step.");
  const headers = rows[0].map((header) => header.toLowerCase());
  const required = ["section", "title", "instruction"];
  required.forEach((header) => {
    if (!headers.includes(header)) throw new Error(`The CSV is missing the “${header}” column.`);
  });

  const meta = {};
  const steps = rows.slice(1).map((values) => {
    const record = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
    ["name", "description", "difficulty", "hook", "yarn", "category"].forEach((key) => {
      if (!meta[key] && record[key]) meta[key] = record[key];
    });
    return {
      section: record.section,
      title: record.title,
      instruction: record.instruction,
      count: record.count || null,
    };
  });
  return normalisePattern({ ...meta, name: meta.name || "Imported crochet pattern", steps });
}

function downloadJson(pattern) {
  const exportPattern = { ...pattern, id: undefined };
  const blob = new Blob([JSON.stringify(exportPattern, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugify(pattern.name)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function ProgressRing({ value, label }) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div className="progress-summary" aria-label={`${Math.round(safe)}% complete`}>
      <strong>{Math.round(safe)}%</strong>
      <span>{label}</span>
      <progress max="100" value={safe}>{Math.round(safe)}%</progress>
    </div>
  );
}

function PatternCard({ pattern, progress, onOpen, onDelete, onExport }) {
  const completed = Math.min(progress?.index || 0, pattern.steps.length);
  const percentage = pattern.steps.length ? (completed / pattern.steps.length) * 100 : 0;
  return (
    <article className="pattern-card">
      <button className="pattern-card-main" onClick={onOpen} aria-label={`Open ${pattern.name}`}>
        <div className="pattern-card-topline"><span>{pattern.category}</span><span>{pattern.difficulty}</span></div>
        <h3>{pattern.name}</h3>
        <p>{pattern.description}</p>
        <div className="compact-progress" aria-hidden="true"><span style={{ width: `${percentage}%` }} /></div>
        <div className="pattern-card-meta"><span>{pattern.steps.length} steps</span><span>{completed ? `${completed} complete` : "Not started"}</span></div>
      </button>
      <div className="card-actions">
        <button className="text-button" onClick={onExport}>Download</button>
        {onDelete && <button className="text-button danger" onClick={onDelete}>Remove</button>}
      </div>
    </article>
  );
}

function Library({ patterns, progress, onOpen, onImport, onDelete, onExport, onContinue }) {
  const active = patterns.find((pattern) => progress[pattern.id]?.index > 0 && progress[pattern.id]?.index < pattern.steps.length);
  return (
    <main className="page library-page">
      <section className="hero-panel">
        <div>
          <span className="eyebrow">Your crochet companion</span>
          <h1>Pick up exactly where you left off.</h1>
          <p>Follow one calm step at a time, count repeated stitches, and keep every project organised in one place.</p>
        </div>
        <button className="primary-button" onClick={onImport}>Import a pattern</button>
      </section>

      {active && (
        <section className="continue-panel">
          <div>
            <span className="eyebrow">On your hook</span>
            <h2>{active.name}</h2>
            <p>{active.steps[progress[active.id].index]?.title || "Ready to finish"}</p>
            <button className="primary-button" onClick={() => onContinue(active.id)}>Continue crocheting</button>
          </div>
          <ProgressRing value={(progress[active.id].index / active.steps.length) * 100} label="complete" />
        </section>
      )}

      <section className="section-heading">
        <div><span className="eyebrow">Pattern library</span><h2>Your patterns</h2></div>
        <span className="pattern-count">{patterns.length} {patterns.length === 1 ? "pattern" : "patterns"}</span>
      </section>
      <section className="pattern-grid">
        {patterns.map((pattern) => (
          <PatternCard
            key={pattern.id}
            pattern={pattern}
            progress={progress[pattern.id]}
            onOpen={() => onOpen(pattern.id)}
            onExport={() => onExport(pattern)}
            onDelete={pattern.source === "Imported pattern" || !BUILT_INS.some((item) => item.id === pattern.id) ? () => onDelete(pattern.id) : null}
          />
        ))}
      </section>
    </main>
  );
}

function PatternOverview({ pattern, state, onBack, onStart, onJump, onReset, onExport }) {
  const currentIndex = Math.min(state?.index || 0, pattern.steps.length - 1);
  const percentage = ((state?.index || 0) / pattern.steps.length) * 100;
  const sections = uniqueSections(pattern);
  return (
    <main className="page overview-page">
      <button className="back-button" onClick={onBack}>Back to library</button>
      <section className="overview-hero">
        <div className="overview-copy">
          <div className="tag-row"><span>{pattern.category}</span><span>{pattern.difficulty}</span></div>
          <h1>{pattern.name}</h1>
          <p>{pattern.description}</p>
          <dl className="pattern-facts">
            <div><dt>Hook</dt><dd>{pattern.hook}</dd></div>
            <div><dt>Yarn</dt><dd>{pattern.yarn}</dd></div>
            <div><dt>Sections</dt><dd>{sections.length}</dd></div>
            <div><dt>Steps</dt><dd>{pattern.steps.length}</dd></div>
          </dl>
          <div className="button-row">
            <button className="primary-button" onClick={onStart}>{state?.index ? "Resume pattern" : "Start pattern"}</button>
            <button className="secondary-button" onClick={onExport}>Download pattern</button>
            {state?.index > 0 && <button className="text-button danger" onClick={onReset}>Reset progress</button>}
          </div>
        </div>
        <ProgressRing value={percentage} label={`${state?.index || 0} of ${pattern.steps.length}`} />
      </section>

      <section className="breakdown-panel">
        <div className="section-heading"><div><span className="eyebrow">Full breakdown</span><h2>All instructions</h2></div></div>
        {sections.map((section) => {
          const items = pattern.steps.map((step, index) => ({ step, index })).filter((item) => item.step.section === section);
          return (
            <details className="round-group" key={section} open={items.some((item) => item.index === currentIndex)}>
              <summary><span>{section}</span><span>{items.length} steps</span></summary>
              <div className="step-list">
                {items.map(({ step, index }) => (
                  <button key={step.id} className={`step-row ${index === currentIndex ? "current" : ""} ${index < (state?.index || 0) ? "done" : ""}`} onClick={() => onJump(index)}>
                    <span className="step-number">{index + 1}</span>
                    <span><strong>{step.title}</strong><small>{step.instruction}</small></span>
                    <span className="step-status">{index < (state?.index || 0) ? "Done" : index === currentIndex ? "Current" : "Open"}</span>
                  </button>
                ))}
              </div>
            </details>
          );
        })}
      </section>
    </main>
  );
}

function FocusView({ pattern, state, onChange, onExit, largeText, onLargeText }) {
  const [wakeLock, setWakeLock] = useState(null);
  const [wakeMessage, setWakeMessage] = useState("");
  const stepIndex = Math.min(state?.index || 0, pattern.steps.length);
  const finished = stepIndex >= pattern.steps.length;
  const step = pattern.steps[stepIndex];
  const tickKey = String(stepIndex);
  const checked = state?.ticks?.[tickKey] || 0;
  const notes = state?.notes || "";
  const sections = uniqueSections(pattern);
  const sectionIndex = step ? sections.indexOf(step.section) : sections.length - 1;
  const stepInSection = step ? pattern.steps.filter((item, index) => item.section === step.section && index <= stepIndex).length : 0;
  const sectionLength = step ? pattern.steps.filter((item) => item.section === step.section).length : 0;
  const notesRef = useRef(null);

  useEffect(() => {
    const handleKey = (event) => {
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
      if (event.key === "ArrowLeft" && stepIndex > 0) onChange({ index: stepIndex - 1 });
      if (event.key === "ArrowRight" && !finished) onChange({ index: stepIndex + 1 });
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [stepIndex, finished, onChange]);

  useEffect(() => () => wakeLock?.release?.(), [wakeLock]);

  const toggleWakeLock = async () => {
    if (wakeLock) {
      await wakeLock.release();
      setWakeLock(null);
      setWakeMessage("Screen wake lock is off.");
      return;
    }
    if (!("wakeLock" in navigator)) {
      setWakeMessage("Keep-awake is not supported in this browser.");
      return;
    }
    try {
      const lock = await navigator.wakeLock.request("screen");
      setWakeLock(lock);
      setWakeMessage("Screen will stay awake while this guide is open.");
      lock.addEventListener("release", () => setWakeLock(null), { once: true });
    } catch {
      setWakeMessage("The screen wake lock could not be started.");
    }
  };

  const setIndex = (index) => onChange({ index: Math.max(0, Math.min(pattern.steps.length, index)) });
  const handleCounter = (boxNumber) => {
    if (!step?.count) return;
    if (boxNumber <= checked) {
      onChange({ ticks: { ...(state?.ticks || {}), [tickKey]: boxNumber - 1 } });
      return;
    }
    if (boxNumber !== checked + 1) return;
    const nextTicks = { ...(state?.ticks || {}), [tickKey]: boxNumber };
    if (boxNumber === step.count) {
      onChange({ ticks: nextTicks, index: stepIndex + 1 });
    } else {
      onChange({ ticks: nextTicks });
    }
  };

  if (finished) {
    return (
      <main className="focus-shell completion-shell">
        <section className="completion-card">
          <span className="eyebrow">Pattern complete</span>
          <h1>You finished {pattern.name}.</h1>
          <p>Your progress and notes are saved on this device. Take a moment to admire your stitches.</p>
          <div className="button-row centered">
            <button className="primary-button" onClick={onExit}>Back to pattern</button>
            <button className="secondary-button" onClick={() => setIndex(pattern.steps.length - 1)}>Review last step</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={`focus-shell ${largeText ? "large-text" : ""}`}>
      <header className="focus-header">
        <button className="back-button" onClick={onExit}>Exit focus</button>
        <div className="focus-title"><span>{pattern.name}</span><small>{Math.round((stepIndex / pattern.steps.length) * 100)}% complete</small></div>
        <button className="text-size-button" onClick={onLargeText} aria-pressed={largeText}>{largeText ? "Standard text" : "Larger text"}</button>
      </header>

      <div className="focus-layout">
        <section className="focus-main">
          <div className="progress-track" aria-label={`Step ${stepIndex + 1} of ${pattern.steps.length}`}><span style={{ width: `${((stepIndex + 1) / pattern.steps.length) * 100}%` }} /></div>
          <article className="instruction-card">
            <div className="instruction-meta">
              <span>{step.section}</span>
              <span>Step {stepIndex + 1} of {pattern.steps.length}</span>
            </div>
            <div className="section-progress">Section {sectionIndex + 1} of {sections.length} · Instruction {stepInSection} of {sectionLength}</div>
            <h1>{step.title}</h1>
            <p>{step.instruction}</p>

            {step.count ? (
              <div className="counter-area">
                {step.count <= 12 ? (
                  <div className="counter-grid">
                    {Array.from({ length: step.count }, (_, index) => index + 1).map((number) => (
                      <button
                        key={number}
                        className={`count-box ${number <= checked ? "checked" : ""} ${number === step.count ? "final" : ""}`}
                        onClick={() => handleCounter(number)}
                        disabled={number > checked + 1}
                        aria-label={`${number <= checked ? "Unmark" : "Mark"} stitch ${number} of ${step.count}`}
                      >
                        <span>{number <= checked ? "Done" : number}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="compact-counter">
                    <div><strong>{checked}</strong><span>of {step.count}</span></div>
                    <div className="button-row centered">
                      <button className="secondary-button" onClick={() => handleCounter(checked)} disabled={checked === 0}>Undo one</button>
                      <button className="primary-button" onClick={() => handleCounter(checked + 1)}>{checked + 1 === step.count ? "Count final stitch" : "Count one stitch"}</button>
                    </div>
                  </div>
                )}
                <p className="counter-help">Count in order. The final stitch automatically opens the next instruction.</p>
              </div>
            ) : (
              <button className="complete-button" onClick={() => setIndex(stepIndex + 1)}>Mark complete and continue</button>
            )}

            <nav className="step-navigation" aria-label="Pattern step navigation">
              <button className="secondary-button" onClick={() => setIndex(stepIndex - 1)} disabled={stepIndex === 0}>Previous</button>
              <button className="text-button" onClick={() => setIndex(stepIndex + 1)}>Skip this step</button>
            </nav>
          </article>
        </section>

        <aside className="focus-sidebar">
          <section className="tool-card">
            <div className="tool-heading"><div><span className="eyebrow">Project notes</span><h2>Keep a reminder</h2></div><span className="save-state">Saved</span></div>
            <textarea ref={notesRef} value={notes} onChange={(event) => onChange({ notes: event.target.value })} placeholder="Yarn colour, hook change, row adjustment…" />
          </section>
          <section className="tool-card keep-awake-card">
            <div><span className="eyebrow">Hands-free helper</span><h2>Keep screen awake</h2><p>Useful when you are following a long repeat.</p></div>
            <button className="secondary-button" onClick={toggleWakeLock}>{wakeLock ? "Turn off" : "Keep awake"}</button>
            {wakeMessage && <small role="status">{wakeMessage}</small>}
          </section>
          <section className="tool-card quick-jump-card">
            <span className="eyebrow">Quick jump</span><h2>{step.section}</h2>
            <div className="mini-step-list">
              {pattern.steps.map((item, index) => ({ item, index })).filter(({ item }) => item.section === step.section).map(({ item, index }) => (
                <button key={item.id} className={index === stepIndex ? "active" : ""} onClick={() => setIndex(index)}><span>{index + 1}</span>{item.title}</button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

function ImportView({ onBack, onImport }) {
  const [mode, setMode] = useState("file");
  const [pasteValue, setPasteValue] = useState("");
  const [status, setStatus] = useState(null);
  const fileRef = useRef(null);

  const parseInput = (text, filename = "") => {
    const parsed = filename.toLowerCase().endsWith(".csv") || (!text.trim().startsWith("{") && text.includes(","))
      ? parseCsv(text)
      : normalisePattern(JSON.parse(text));
    onImport(parsed);
    setStatus({ type: "success", message: `“${parsed.name}” is ready in your library.` });
  };

  const handleFile = async (file) => {
    if (!file) return;
    try {
      parseInput(await file.text(), file.name);
    } catch (error) {
      setStatus({ type: "error", message: error instanceof SyntaxError ? "That JSON file is not formatted correctly." : error.message });
    }
  };

  const handlePaste = () => {
    try {
      parseInput(pasteValue);
    } catch (error) {
      setStatus({ type: "error", message: error instanceof SyntaxError ? "That JSON is not formatted correctly." : error.message });
    }
  };

  return (
    <main className="page import-page">
      <button className="back-button" onClick={onBack}>Back to library</button>
      <section className="import-hero"><span className="eyebrow">Add a pattern</span><h1>Turn a pattern into a calm step-by-step guide.</h1><p>Import a small JSON or CSV file. Everything is processed and stored in this browser.</p></section>
      <section className="import-layout">
        <div className="import-card">
          <div className="segmented-control" role="tablist" aria-label="Import method">
            <button role="tab" aria-selected={mode === "file"} onClick={() => setMode("file")}>Upload a file</button>
            <button role="tab" aria-selected={mode === "paste"} onClick={() => setMode("paste")}>Paste pattern data</button>
          </div>
          {mode === "file" ? (
            <div className="upload-zone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); handleFile(event.dataTransfer.files[0]); }}>
              <h2>Drop your JSON or CSV here</h2>
              <p>Maximum recommended size: 2 MB</p>
              <input ref={fileRef} type="file" accept=".json,.csv,application/json,text/csv" onChange={(event) => handleFile(event.target.files[0])} />
              <button className="primary-button" onClick={() => fileRef.current?.click()}>Choose a file</button>
            </div>
          ) : (
            <div className="paste-panel">
              <label htmlFor="pattern-data">Pattern JSON or CSV</label>
              <textarea id="pattern-data" value={pasteValue} onChange={(event) => setPasteValue(event.target.value)} placeholder={'{"name":"My blanket","steps":[{"section":"Row 1","title":"Chain 20","instruction":"Chain 20 loosely.","count":20}]}'} />
              <button className="primary-button" onClick={handlePaste} disabled={!pasteValue.trim()}>Import pattern</button>
            </div>
          )}
          {status && <div className={`import-status ${status.type}`} role="status">{status.message}</div>}
        </div>

        <aside className="format-guide">
          <span className="eyebrow">Recommended format</span>
          <h2>JSON is best for complete patterns.</h2>
          <p>It keeps the pattern details and every instruction together. CSV is handy when you prefer building rows in a spreadsheet.</p>
          <div className="schema-block">
            <strong>Each step can include</strong>
            <dl><div><dt>section</dt><dd>Round 1, Border, Assembly</dd></div><div><dt>title</dt><dd>A short action</dd></div><div><dt>instruction</dt><dd>The full guidance</dd></div><div><dt>count</dt><dd>Optional stitch counter</dd></div></dl>
          </div>
          <div className="template-links">
            <a className="secondary-button" href="./pattern-template.json" download>JSON template</a>
            <a className="secondary-button" href="./pattern-template.csv" download>CSV template</a>
          </div>
          <p className="privacy-note"><strong>Private by default.</strong> Pattern files are not uploaded to a server.</p>
        </aside>
      </section>
    </main>
  );
}

export function App() {
  const [importedPatterns, setImportedPatterns] = useState(() => readStorage(STORAGE.patterns, []));
  const [progress, setProgress] = useState(() => readStorage(STORAGE.progress, {}));
  const [activeId, setActiveId] = useState(() => window.localStorage.getItem(STORAGE.active) || grannySquare.id);
  const [view, setView] = useState("library");
  const [largeText, setLargeText] = useState(() => readStorage(STORAGE.textSize, false));
  const patterns = useMemo(() => [...BUILT_INS, ...importedPatterns], [importedPatterns]);
  const activePattern = patterns.find((pattern) => pattern.id === activeId) || patterns[0];

  useEffect(() => window.localStorage.setItem(STORAGE.patterns, JSON.stringify(importedPatterns)), [importedPatterns]);
  useEffect(() => window.localStorage.setItem(STORAGE.progress, JSON.stringify(progress)), [progress]);
  useEffect(() => window.localStorage.setItem(STORAGE.active, activeId), [activeId]);
  useEffect(() => window.localStorage.setItem(STORAGE.textSize, JSON.stringify(largeText)), [largeText]);
  useEffect(() => { window.scrollTo(0, 0); }, [view]);

  const navigate = (nextView) => setView(nextView);
  const openPattern = (id) => { setActiveId(id); navigate("overview"); };
  const openFocus = (id = activeId) => { setActiveId(id); navigate("focus"); };
  const updateProgress = (patch) => setProgress((current) => ({ ...current, [activeId]: { index: 0, ticks: {}, notes: "", ...(current[activeId] || {}), ...patch } }));
  const addPattern = (pattern) => { setImportedPatterns((items) => [...items.filter((item) => item.id !== pattern.id), pattern]); setActiveId(pattern.id); };
  const deletePattern = (id) => {
    if (!window.confirm("Remove this imported pattern and its saved progress from this device?")) return;
    setImportedPatterns((items) => items.filter((item) => item.id !== id));
    setProgress((current) => { const next = { ...current }; delete next[id]; return next; });
    if (activeId === id) setActiveId(grannySquare.id);
  };
  const resetProgress = () => {
    if (!window.confirm("Reset all progress and stitch counts for this pattern? Your notes will be kept.")) return;
    setProgress((current) => ({ ...current, [activeId]: { index: 0, ticks: {}, notes: current[activeId]?.notes || "" } }));
  };

  if (view === "focus") {
    return <FocusView pattern={activePattern} state={progress[activeId]} onChange={updateProgress} onExit={() => navigate("overview")} largeText={largeText} onLargeText={() => setLargeText((value) => !value)} />;
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand-button" onClick={() => navigate("library")}><span className="brand-mark" aria-hidden="true">R</span><span><strong>Row & Round</strong><small>Crochet helper</small></span></button>
        <nav aria-label="Main navigation">
          <button className={view === "library" ? "active" : ""} onClick={() => navigate("library")}>Library</button>
          <button className={view === "import" ? "active" : ""} onClick={() => navigate("import")}>Import pattern</button>
        </nav>
      </header>

      {view === "library" && <Library patterns={patterns} progress={progress} onOpen={openPattern} onImport={() => navigate("import")} onDelete={deletePattern} onExport={downloadJson} onContinue={openFocus} />}
      {view === "overview" && <PatternOverview pattern={activePattern} state={progress[activeId]} onBack={() => navigate("library")} onStart={() => openFocus()} onJump={(index) => { updateProgress({ index }); navigate("focus"); }} onReset={resetProgress} onExport={() => downloadJson(activePattern)} />}
      {view === "import" && <ImportView onBack={() => navigate("library")} onImport={addPattern} />}

      <footer className="site-footer"><span>Row & Round</span><span>Patterns and progress stay on this device.</span></footer>
    </div>
  );
}
