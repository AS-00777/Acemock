import fs from "fs";
import path from "path";
import csv from "csv-parser";
import { pool } from "../src/config/db";

type ResourceRow = {
  resource_id: string;
  category: string;
  topic: string;
  question: string;
  answer: string;
  explanation: string;
  difficulty: "Easy" | "Medium" | "Hard";
  tags: string;
  source: string;
};

const filePath = path.join(__dirname, "../data/resource_master_dataset_final.csv");

const rows: ResourceRow[] = [];
let skipped = 0;

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeDifficulty(value: string): "Easy" | "Medium" | "Hard" {
  const v = clean(value).toLowerCase();
  if (v === "easy") return "Easy";
  if (v === "hard") return "Hard";
  return "Medium";
}

fs.createReadStream(filePath)
  .pipe(csv())
  .on("data", (row) => {
    const resource_id = clean(row.resource_id);
    const category = clean(row.category);
    const topic = clean(row.topic);
    const question = clean(row.question);
    const answer = clean(row.answer);

    if (!resource_id || !category || !question || !answer) {
      skipped++;
      return;
    }

    rows.push({
      resource_id,
      category,
      topic,
      question,
      answer,
      explanation: clean(row.explanation),
      difficulty: normalizeDifficulty(row.difficulty),
      tags: clean(row.tags),
      source: clean(row.source),
    });
  })
  .on("end", async () => {
    console.log(`CSV loaded: ${rows.length} valid rows`);
    console.log(`Skipped rows: ${skipped}`);

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const sql = `
        INSERT INTO resource_questions
        (
          resource_id,
          category,
          topic,
          question,
          answer,
          explanation,
          difficulty,
          tags,
          source
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          category = VALUES(category),
          topic = VALUES(topic),
          question = VALUES(question),
          answer = VALUES(answer),
          explanation = VALUES(explanation),
          difficulty = VALUES(difficulty),
          tags = VALUES(tags),
          source = VALUES(source),
          updated_at = CURRENT_TIMESTAMP
      `;

      for (const row of rows) {
        await connection.execute(sql, [
          row.resource_id,
          row.category,
          row.topic || null,
          row.question,
          row.answer,
          row.explanation || null,
          row.difficulty,
          row.tags || null,
          row.source || null,
        ]);
      }

      await connection.commit();

      console.log("Resource dataset imported successfully.");
      console.log(`Inserted/updated rows: ${rows.length}`);
    } catch (error) {
      await connection.rollback();
      console.error("Import failed:", error);
    } finally {
      connection.release();
      process.exit(0);
    }
  });