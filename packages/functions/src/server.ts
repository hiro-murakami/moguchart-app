// server.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client"; // pkg を経由せず直接 import
import { fileURLToPath } from "node:url";

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// データの取得
app.get("/api/gantt", async (req, res) => {
  try {
    // IDが1のレコードを取得（簡易的な実装として1つのチャートのみ扱う）
    let chart = await prisma.ganttChart.findUnique({
      where: { id: 1 },
    });

    if (!chart) {
      // データがない場合は空配列を返す
      res.json([]);
      return;
    }
    res.json(chart.data);
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// データの保存
app.post("/api/gantt", async (req, res) => {
  try {
    const data = req.body;
    // IDが1のレコードを作成または更新（Upsert）
    const chart = await prisma.ganttChart.upsert({
      where: { id: 1 },
      update: { data },
      create: { id: 1, data },
    });
    res.json(chart);
  } catch (error) {
    console.error("Error saving data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default app;

const start = async () => {
  try {
    await prisma.$connect();
    console.log("Database connected successfully.");
    app.listen(port, () => {
      console.log(`API Server running at http://localhost:${port}`);
    });
  } catch (e) {
    console.error("Error starting server:", e);
    process.exit(1);
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  start();
}
