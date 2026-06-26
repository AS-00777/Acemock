import fs from "fs";
import path from "path";
import type { PoolConnection } from "mysql2/promise";
import { pool } from "../src/config/db";

const REQUIRED_COLUMNS = [
  "question_id",
  "source",
  "company",
  "section",
  "topic",
  "difficulty",
  "question",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "correct_answer",
] as const;

type RequiredColumn = (typeof REQUIRED_COLUMNS)[number];
type AptitudeRow = Record<RequiredColumn, string>;

const DATASET_PATH = path.resolve(__dirname, "../data/aptitude_master_dataset.csv");

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error("CSV contains an unterminated quoted field");
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((value) => value.length > 0)) rows.push(row);
  }
  return rows;
}

function toAptitudeRow(
  values: string[],
  columnIndexes: Record<RequiredColumn, number>,
): AptitudeRow | null {
  const row = {} as AptitudeRow;
  for (const column of REQUIRED_COLUMNS) {
    row[column] = (values[columnIndexes[column]] ?? "").trim();
    if (!row[column]) return null;
  }

  row.correct_answer = row.correct_answer.toUpperCase();
  if (!/^[A-D]$/.test(row.correct_answer)) return null;
  if (row.question_id.length > 100) return null;
  if (row.source.length > 255 || row.company.length > 255 || row.topic.length > 255) return null;
  if (row.section.length > 100 || row.difficulty.length > 50) return null;
  return row;
}

const UPSERT_SQL = `
  INSERT INTO aptitude_questions (
    question_id, source, company, section, topic, difficulty, question,
    option_a, option_b, option_c, option_d, correct_answer
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    source = VALUES(source),
    company = VALUES(company),
    section = VALUES(section),
    topic = VALUES(topic),
    difficulty = VALUES(difficulty),
    question = VALUES(question),
    option_a = VALUES(option_a),
    option_b = VALUES(option_b),
    option_c = VALUES(option_c),
    option_d = VALUES(option_d),
    correct_answer = VALUES(correct_answer)
`;

async function importRows(connection: PoolConnection, records: string[][]): Promise<void> {
  if (records.length === 0) throw new Error("CSV is empty");

  const headers = records[0].map((header, index) =>
    (index === 0 ? header.replace(/^\uFEFF/, "") : header).trim().toLowerCase(),
  );
  const missingColumns = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  if (missingColumns.length > 0) {
    throw new Error(`CSV is missing required columns: ${missingColumns.join(", ")}`);
  }

  const columnIndexes = Object.fromEntries(
    REQUIRED_COLUMNS.map((column) => [column, headers.indexOf(column)]),
  ) as Record<RequiredColumn, number>;

  const dataRows = records.slice(1);
  let upserted = 0;
  let skipped = 0;

  await connection.beginTransaction();
  try {
    for (let index = 0; index < dataRows.length; index += 1) {
      const row = toAptitudeRow(dataRows[index], columnIndexes);
      if (!row) {
        skipped += 1;
        console.warn(`Skipping invalid CSV row ${index + 2}`);
        continue;
      }

      await connection.execute(UPSERT_SQL, [
        row.question_id,
        row.source,
        row.company,
        row.section,
        row.topic,
        row.difficulty,
        row.question,
        row.option_a,
        row.option_b,
        row.option_c,
        row.option_d,
        row.correct_answer,
      ]);
      upserted += 1;
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }

  console.log(`Total rows: ${dataRows.length}`);
  console.log(`Inserted/updated rows: ${upserted}`);
  console.log(`Skipped rows: ${skipped}`);
}

async function main(): Promise<void> {
  if (!fs.existsSync(DATASET_PATH)) {
    throw new Error(`Dataset not found: ${DATASET_PATH}`);
  }

  const csv = fs.readFileSync(DATASET_PATH, "utf8");
  const connection = await pool.getConnection();
  try {
    await importRows(connection, parseCsv(csv));
  } finally {
    connection.release();
  }
}

main()
  .catch((error) => {
    console.error("Aptitude dataset import failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
