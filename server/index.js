import express from "express";
import cors from "cors";
import multer from "multer";

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.post("/api/identify", upload.single("photo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No photo uploaded" });

  const base64 = req.file.buffer.toString("base64");

  try {
    const r = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemma3:4b",
        stream: false,
        format: "json",
        keep_alive: "30m",
        options: { num_predict: 120, num_ctx: 2048 },
        messages: [
          {
            role: "user",
            content:
              'Identify the plant, tree, or bird in this photo. Reply only as JSON: {"name": "common name", "fact": "one short interesting fact", "confidence": "low|medium|high"}. If unsure, say so in confidence.',
            images: [base64],
          },
        ],
      }),
    });

    const data = await r.json();
    res.json(JSON.parse(data.message.content));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not identify the photo" });
  }
});

app.listen(5000, () => console.log("Server on http://localhost:5000"));