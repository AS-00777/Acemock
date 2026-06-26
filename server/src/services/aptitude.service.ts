import type { RowDataPacket } from "mysql2/promise";
import { pool, query } from "../config/db";
import { ApiError } from "../middleware/error.middleware";

type QuestionRow = RowDataPacket & {
  question_id: string;
  source: string;
  company: string;
  section: string;
  topic: string;
  difficulty: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
};

type TestRow = RowDataPacket & {
  id: number;
  user_id: number;
  title: string;
  company: string | null;
  section: string | null;
  topic: string | null;
  difficulty: string | null;
  total_questions: number;
  duration_minutes: number | null;
  status: string;
  score: number | string | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
};

type AttemptRow = QuestionRow & RowDataPacket & {
  selected_answer: string | null;
  saved_correct_answer: string | null;
  is_correct: number | null;
  time_taken_seconds: number | null;
};

export type QuestionFilters = {
  company?: string;
  section?: string;
  topic?: string;
  difficulty?: string;
  limit: number;
};

export type SubmittedAnswer = {
  questionId: string;
  selectedAnswer: string | null;
  timeTakenSeconds: number;
};

function publicQuestion(row: QuestionRow) {
  return {
    questionId: row.question_id,
    source: row.source,
    company: row.company,
    section: row.section,
    topic: row.topic,
    difficulty: row.difficulty,
    question: row.question,
    options: {
      A: row.option_a,
      B: row.option_b,
      C: row.option_c,
      D: row.option_d,
    },
  };
}

function whereClause(filters: Omit<QuestionFilters, "limit">) {
  const conditions: string[] = [];
  const params: any[] = [];
  const company = filters.company?.trim() || "General";
  conditions.push("company = ?");
  params.push(company);

  for (const field of ["section", "topic", "difficulty"] as const) {
    const value = filters[field]?.trim();
    if (value) {
      conditions.push(`${field} = ?`);
      params.push(value);
    }
  }
  return { sql: `WHERE ${conditions.join(" AND ")}`, params };
}

export async function getAptitudeMeta() {
  const rows = await query<(RowDataPacket & {
    company: string;
    section: string;
    topic: string;
    difficulty: string;
    question_count: number;
  })[]>(`
    SELECT company, section, topic, difficulty, COUNT(*) AS question_count
    FROM aptitude_questions
    GROUP BY company, section, topic, difficulty
    ORDER BY company, section, topic, difficulty
  `);

  const topicsBySection: Record<string, string[]> = {};
  for (const row of rows) {
    if (!topicsBySection[row.section]) topicsBySection[row.section] = [];
    if (!topicsBySection[row.section].includes(row.topic)) topicsBySection[row.section].push(row.topic);
  }
  return {
    companies: [...new Set(rows.map((row) => row.company))],
    sections: [...new Set(rows.map((row) => row.section))],
    difficulties: [...new Set(rows.map((row) => row.difficulty))],
    topicsBySection,
    counts: rows.map((row) => ({
      company: row.company,
      section: row.section,
      topic: row.topic,
      difficulty: row.difficulty,
      count: Number(row.question_count),
    })),
  };
}

export async function getRandomQuestions(filters: QuestionFilters) {
  const where = whereClause(filters);
  const rows = await query<QuestionRow[]>(`
    SELECT question_id, source, company, section, topic, difficulty, question,
           option_a, option_b, option_c, option_d, correct_answer
    FROM aptitude_questions
    ${where.sql}
    ORDER BY RAND()
    LIMIT ${filters.limit}
  `, where.params);
  return rows.map(publicQuestion);
}

export async function startAptitudeTest(input: {
  userId: number;
  title: string;
  company: string;
  section?: string;
  topic?: string;
  difficulty?: string;
  totalQuestions: number;
  durationMinutes: number;
}) {
  const where = whereClause(input);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [questions] = await connection.execute<QuestionRow[]>(`
      SELECT question_id, source, company, section, topic, difficulty, question,
             option_a, option_b, option_c, option_d, correct_answer
      FROM aptitude_questions
      ${where.sql}
      ORDER BY RAND()
      LIMIT ${input.totalQuestions}
    `, where.params);

    if (questions.length === 0) throw new ApiError(404, "No questions match the selected filters");
    const [testResult] = await connection.execute<any>(`
      INSERT INTO aptitude_tests
        (user_id, title, company, section, topic, difficulty, total_questions,
         duration_minutes, status, started_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'IN_PROGRESS', NOW())
    `, [
      input.userId, input.title, input.company, input.section ?? null, input.topic ?? null,
      input.difficulty ?? null, questions.length, input.durationMinutes,
    ]);

    const testId = Number(testResult.insertId);
    for (const question of questions) {
      await connection.execute(
        "INSERT INTO aptitude_attempts (test_id, question_id) VALUES (?, ?)",
        [testId, question.question_id],
      );
    }
    await connection.commit();
    return { testId, questions: questions.map(publicQuestion) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function percentage(correct: number, total: number) {
  return total ? Number(((correct / total) * 100).toFixed(2)) : 0;
}

function groupPerformance(rows: AttemptRow[], key: "section" | "topic" | "difficulty") {
  const groups = new Map<string, { total: number; correct: number; answered: number }>();
  for (const row of rows) {
    const name = row[key];
    const group = groups.get(name) ?? { total: 0, correct: 0, answered: 0 };
    group.total += 1;
    if (row.selected_answer) group.answered += 1;
    if (Boolean(row.is_correct)) group.correct += 1;
    groups.set(name, group);
  }
  return [...groups.entries()].map(([name, values]) => ({
    name,
    ...values,
    accuracy: percentage(values.correct, values.total),
  }));
}

function buildAnalysis(rows: AttemptRow[]) {
  const totalQuestions = rows.length;
  const correct = rows.filter((row) => Boolean(row.is_correct)).length;
  const unanswered = rows.filter((row) => !row.selected_answer).length;
  const wrong = totalQuestions - correct - unanswered;
  const answered = totalQuestions - unanswered;
  const times = rows.map((row) => Number(row.time_taken_seconds ?? 0));
  const topicPerformance = groupPerformance(rows, "topic");
  return {
    score: percentage(correct, totalQuestions),
    totalQuestions,
    correct,
    wrong,
    unanswered,
    accuracy: percentage(correct, answered),
    sectionPerformance: groupPerformance(rows, "section"),
    topicPerformance,
    difficultyPerformance: groupPerformance(rows, "difficulty"),
    averageTime: totalQuestions ? Number((times.reduce((sum, value) => sum + value, 0) / totalQuestions).toFixed(2)) : 0,
    weakTopics: topicPerformance.filter((item) => item.accuracy < 50).map((item) => item.name),
    strongTopics: topicPerformance.filter((item) => item.accuracy >= 75).map((item) => item.name),
  };
}

async function ownedTest(testId: number, userId: number, forUpdate = false) {
  const rows = await query<TestRow[]>(
    `SELECT * FROM aptitude_tests WHERE id = ?${forUpdate ? " FOR UPDATE" : ""}`,
    [testId],
  );
  if (!rows[0]) throw new ApiError(404, "Aptitude test not found");
  if (rows[0].user_id !== userId) throw new ApiError(403, "Forbidden");
  return rows[0];
}

async function attemptRows(testId: number): Promise<AttemptRow[]> {
  return query<AttemptRow[]>(`
    SELECT q.*, a.selected_answer, a.correct_answer AS saved_correct_answer,
           a.is_correct, a.time_taken_seconds
    FROM aptitude_attempts a
    JOIN aptitude_questions q ON q.question_id = a.question_id
    WHERE a.test_id = ?
    ORDER BY a.id
  `, [testId]);
}

export async function submitAptitudeTest(testId: number, userId: number, answers: SubmittedAnswer[]) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [tests] = await connection.execute<TestRow[]>(
      "SELECT * FROM aptitude_tests WHERE id = ? FOR UPDATE",
      [testId],
    );
    const test = tests[0];
    if (!test) throw new ApiError(404, "Aptitude test not found");
    if (test.user_id !== userId) throw new ApiError(403, "Forbidden");
    if (test.status === "COMPLETED") throw new ApiError(409, "Aptitude test has already been submitted");

    const [assigned] = await connection.execute<QuestionRow[]>(`
      SELECT q.* FROM aptitude_attempts a
      JOIN aptitude_questions q ON q.question_id = a.question_id
      WHERE a.test_id = ? ORDER BY a.id
    `, [testId]);
    const answerMap = new Map(answers.map((answer) => [answer.questionId, answer]));
    const assignedIds = new Set(assigned.map((question) => question.question_id));
    if (answers.some((answer) => !assignedIds.has(answer.questionId))) {
      throw new ApiError(400, "An answer contains a question that is not assigned to this test");
    }

    for (const question of assigned) {
      const answer = answerMap.get(question.question_id);
      const selected = answer?.selectedAnswer ?? null;
      await connection.execute(`
        UPDATE aptitude_attempts
        SET selected_answer = ?, correct_answer = ?, is_correct = ?, time_taken_seconds = ?
        WHERE test_id = ? AND question_id = ?
      `, [
        selected,
        question.correct_answer,
        selected ? selected === question.correct_answer : null,
        answer?.timeTakenSeconds ?? 0,
        testId,
        question.question_id,
      ]);
    }

    const correct = assigned.filter((question) => answerMap.get(question.question_id)?.selectedAnswer === question.correct_answer).length;
    const score = percentage(correct, assigned.length);
    await connection.execute(
      "UPDATE aptitude_tests SET status = 'COMPLETED', score = ?, completed_at = NOW() WHERE id = ?",
      [score, testId],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return buildAnalysis(await attemptRows(testId));
}

function testSummary(row: TestRow) {
  return {
    testId: Number(row.id), title: row.title, company: row.company, section: row.section,
    topic: row.topic, difficulty: row.difficulty, totalQuestions: Number(row.total_questions),
    durationMinutes: row.duration_minutes, status: row.status,
    score: row.score === null ? null : Number(row.score), startedAt: row.started_at,
    completedAt: row.completed_at, createdAt: row.created_at,
  };
}

export async function getAptitudeHistory(userId: number) {
  const rows = await query<TestRow[]>(
    "SELECT * FROM aptitude_tests WHERE user_id = ? ORDER BY created_at DESC",
    [userId],
  );
  return rows.map(testSummary);
}

export async function getAptitudeResult(testId: number, userId: number) {
  const test = await ownedTest(testId, userId);
  if (test.status !== "COMPLETED") throw new ApiError(409, "Aptitude test is not completed");
  const rows = await attemptRows(testId);
  return {
    test: testSummary(test),
    ...buildAnalysis(rows),
    questions: rows.map((row) => ({
      ...publicQuestion(row),
      selectedAnswer: row.selected_answer,
      correctAnswer: row.saved_correct_answer ?? row.correct_answer,
      isCorrect: Boolean(row.is_correct),
      timeTakenSeconds: Number(row.time_taken_seconds ?? 0),
    })),
  };
}
