import "dotenv/config";
import express from "express";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "taskforge-backend",
    ts: new Date().toISOString(),
  });
});

const PORT = process.env.PORT ?? "3000";
app.listen(PORT, () => {
  console.log(`[backend] listening on http://localhost:${PORT}`);
});
