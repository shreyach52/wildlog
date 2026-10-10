import { useState, useEffect } from "react";

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

      const form = new FormData();
      form.append("photo", jpeg, "photo.jpg");

      const res = await fetch("http://localhost:5000/api/identify", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      setResult(data);
      setSeconds(((Date.now() - start) / 1000).toFixed(1));
    } catch (err) {
      setError(err.message);
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
          <p>{result.fact}</p>
          <small>
            Confidence: {result.confidence}
            {seconds && ` · ${seconds}s`}
          </small>
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