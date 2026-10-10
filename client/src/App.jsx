import { useState, useEffect } from "react";

const API =
  import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000`;

const IS_LOCAL =
  ["localhost", "127.0.0.1"].includes(window.location.hostname) ||
  /^(192\.168\.|10\.|172\.)/.test(window.location.hostname);

// Replace each fact with the real text Gemma gave you during your outdoor tests.
const DEMO_RESULTS = [
  { name: "Mango tree", fact: "PASTE A REAL FACT FROM YOUR JOURNAL", confidence: "high" },
  { name: "Holy basil (Tulsi)", fact: "PASTE A REAL FACT FROM YOUR JOURNAL", confidence: "high" },
  { name: "Boston fern", fact: "PASTE A REAL FACT FROM YOUR JOURNAL", confidence: "medium" },
];

const QUESTS = [
  "Find something with five petals",
  "Find a tree older than you",
  "Find three different shades of green",
  "Find something that is making a sound",
  "Find something growing through a crack",
  "Find a seed or a fruit",
  "Find a bird, without chasing it",
  "Find a leaf with an interesting pattern",
  "Find something that smells good",
  "Find an insect doing something",
  "Find the smallest flower you can",
  "Find a plant you've walked past a hundred times",
];

function resizeToJpeg(file, maxSize = 800, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Could not convert image"))),
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => reject(new Error("Could not read image"));
    img.src = url;
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem("wildlog-entries")) || [];
  } catch {
    return [];
  }
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

function todaysQuests() {
  const day = Math.floor(Date.now() / 86400000);
  return [0, 1, 2].map((i) => QUESTS[(day * 3 + i) % QUESTS.length]);
}

function Quests() {
  const key = "wildlog-quest-" + new Date().toDateString();
  const quests = todaysQuests();
  const [done, setDone] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch {
      return [];
    }
  });

  function toggle(i) {
    const next = done.includes(i) ? done.filter((x) => x !== i) : [...done, i];
    setDone(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
  }

  return (
    <section className="quests">
      <h2>Today's quest</h2>
      {quests.map((q, i) => (
        <label key={i}>
          <input
            type="checkbox"
            checked={done.includes(i)}
            onChange={() => toggle(i)}
          />{" "}
          {q}
        </label>
      ))}
      <small>{done.length}/3 found</small>
    </section>
  );
}

export default function App() {
  const [preview, setPreview] = useState(null);
  const [thumb, setThumb] = useState(null);
  const [result, setResult] = useState(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(null);
  const [error, setError] = useState("");
  const [entries, setEntries] = useState(loadEntries);

  useEffect(() => {
    try {
      localStorage.setItem("wildlog-entries", JSON.stringify(entries));
    } catch {
      setError("Could not save to the journal (storage may be full).");
    }
  }, [entries]);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    setError("");
    setResult(null);
    setNote("");
    setSeconds(null);
    setPreview(URL.createObjectURL(file));
    setLoading(true);

    const start = Date.now();
    try {
      const jpeg = await resizeToJpeg(file);
      const small = await resizeToJpeg(file, 200, 0.7);
      setThumb(await blobToDataUrl(small));

      if (!IS_LOCAL && !import.meta.env.VITE_API_URL) {
        await new Promise((r) => setTimeout(r, 1200));
        setResult({
          ...DEMO_RESULTS[Math.floor(Math.random() * DEMO_RESULTS.length)],
          demo: true,
        });
        return;
      }

      const form = new FormData();
      form.append("photo", jpeg, "photo.jpg");

      const res = await fetch(`${API}/api/identify`, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(90000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      setResult(data);
      setSeconds(((Date.now() - start) / 1000).toFixed(1));
    } catch (err) {
      if (!IS_LOCAL) {
        setResult({
          ...DEMO_RESULTS[Math.floor(Math.random() * DEMO_RESULTS.length)],
          demo: true,
        });
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  function saveEntry() {
    const entry = {
      id: Date.now(),
      name: result.name,
      fact: result.fact,
      confidence: result.confidence,
      note,
      thumb,
      date: new Date().toLocaleString(),
    };
    setEntries([entry, ...entries]);
    setResult(null);
    setPreview(null);
    setThumb(null);
    setNote("");
  }

  function deleteEntry(id) {
    setEntries(entries.filter((en) => en.id !== id));
  }

  return (
    <main className="app">
      <h1>WildLog</h1>
      <p className="sub">Point, snap, learn. Then put the phone away.</p>

      <Quests />

      <label className="capture">
        {loading ? "Identifying..." : "Take or choose a photo"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          disabled={loading}
          hidden
        />
      </label>

      {preview && <img className="preview" src={preview} alt="Your photo" />}

      {error && <p className="error">{error}</p>}

      {result && (
        <section className="result">
          <h2>{result.name}</h2>
          {result.demo && (
            <p className="demo">
              Demo mode: the real app runs Gemma locally on my laptop. This is
              a sample result from my outdoor tests, not a live identification.
            </p>
          )}
          <p>{result.fact}</p>
          <small>
            Confidence: {result.confidence}
            {seconds && ` · ${seconds}s`}
          </small>
          <button
            className="save"
            onClick={() => speak(`${result.name}. ${result.fact}`)}
          >
            Read aloud
          </button>
          <textarea
            placeholder="Where were you? What did you notice?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button className="save" onClick={saveEntry}>
            Save to journal
          </button>
        </section>
      )}

      <h2 className="journal-title">Your journal ({entries.length})</h2>
      {entries.length === 0 && (
        <p className="sub">Nothing yet. Go find something outside.</p>
      )}
      {entries.map((en) => (
        <article className="entry" key={en.id}>
          {en.thumb && <img src={en.thumb} alt={en.name} />}
          <div>
            <h3>{en.name}</h3>
            <p>{en.fact}</p>
            {en.note && <p className="note">"{en.note}"</p>}
            <small>
              {en.date} · {en.confidence}
            </small>
            <button className="del" onClick={() => deleteEntry(en.id)}>
              Delete
            </button>
          </div>
        </article>
      ))}
    </main>
  );
}