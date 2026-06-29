import fs from "fs";
import path from "path";
import csvParser from "csv-parser";
import type { ResultSetHeader } from "mysql2/promise";
import { exec, pool } from "../src/config/db";

const REQUIRED_COLUMNS = [
  "question_id",
  "question",
  "category",
  "role",
  "experience",
  "difficulty",
  "source_type",
  "ideal_answer",
] as const;

type RequiredColumn = (typeof REQUIRED_COLUMNS)[number];
type HrCsvRow = Record<RequiredColumn, string>;

const DATASET_PATH = path.resolve(__dirname, "../data/cleaned_hr_questions.csv");

const UPSERT_SQL = `
  INSERT INTO hr_questions (
    question_id, question, category, role, experience, difficulty, source_type, ideal_answer
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    question = VALUES(question),
    category = VALUES(category),
    role = VALUES(role),
    experience = VALUES(experience),
    difficulty = VALUES(difficulty),
    source_type = VALUES(source_type),
    ideal_answer = VALUES(ideal_answer)
`;

function normalizeDifficulty(value: string): "Easy" | "Medium" | "Hard" {
  const normalized = value.trim().toLowerCase();
  if (normalized === "easy") return "Easy";
  if (normalized === "hard") return "Hard";
  return "Medium";
}

function normalizeRow(row: Record<string, unknown>): HrCsvRow | null {
  const normalized = {} as HrCsvRow;

  for (const column of REQUIRED_COLUMNS) {
    normalized[column] = String(row[column] ?? "").trim();
  }

  if (!normalized.question_id || !normalized.question) return null;
  normalized.difficulty = normalizeDifficulty(normalized.difficulty);
  return normalized;
}

function readRows(): Promise<Array<Record<string, unknown>>> {
  return new Promise((resolve, reject) => {
    const rows: Array<Record<string, unknown>> = [];
    let headers: string[] = [];

    fs.createReadStream(DATASET_PATH)
      .pipe(
        csvParser({
          mapHeaders: ({ header, index }: { header: string; index: number }) =>
            (index === 0 ? header.replace(/^\uFEFF/, "") : header).trim(),
        }),
      )
      .on("headers", (parsedHeaders: string[]) => {
        headers = parsedHeaders.map((header) => header.trim());
      })
      .on("data", (row: Record<string, unknown>) => rows.push(row))
      .on("error", reject)
      .on("end", () => {
        const missingColumns = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
        if (missingColumns.length > 0) {
          reject(new Error(`CSV is missing required columns: ${missingColumns.join(", ")}`));
          return;
        }
        resolve(rows);
      });
  });
}

async function importRows(rows: Array<Record<string, unknown>>): Promise<void> {
  let insertedOrUpdated = 0;
  let skipped = 0;
  let errors = 0;

  for (const rawRow of rows) {
    const row = normalizeRow(rawRow);
    if (!row) {
      skipped += 1;
      continue;
    }

    try {
      await exec(UPSERT_SQL, [
        row.question_id,
        row.question,
        row.category,
        row.role,
        row.experience,
        row.difficulty,
        row.source_type,
        row.ideal_answer,
      ]) as ResultSetHeader;
      insertedOrUpdated += 1;
    } catch (error) {
      errors += 1;
      console.error(`Failed to import HR question ${row.question_id}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`Total rows read: ${rows.length}`);
  console.log(`Inserted/updated count: ${insertedOrUpdated}`);
  console.log(`Skipped count: ${skipped}`);
  console.log(`Error count: ${errors}`);
}

async function main(): Promise<void> {
  if (!fs.existsSync(DATASET_PATH)) {
    throw new Error(`CSV not found: ${DATASET_PATH}`);
  }

  const rows = await readRows();
  await importRows(rows);
}

main()
  .catch((error) => {
    console.error("HR questions import failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
