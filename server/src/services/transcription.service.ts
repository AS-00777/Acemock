import { execFile } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export type TranscriptionResult = {
  transcript: string;
  engine: "whisper" | "placeholder";
};

async function commandExists(command: string) {
  const lookup = process.platform === "win32" ? "where" : "which";
  try {
    await execFileAsync(lookup, [command], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function normalizeTranscript(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

async function transcribeWithWhisper(audioFilePath: string): Promise<string> {
  const outDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "acemock-whisper-"));
  try {
    await execFileAsync(
      "whisper",
      [audioFilePath, "--model", "base", "--language", "en", "--output_format", "txt", "--output_dir", outDir],
      { timeout: 5 * 60 * 1000, maxBuffer: 1024 * 1024 }
    );

    const transcriptPath = path.join(
      outDir,
      `${path.basename(audioFilePath, path.extname(audioFilePath))}.txt`
    );
    const transcript = await fs.promises.readFile(transcriptPath, "utf8");
    return normalizeTranscript(transcript);
  } finally {
    fs.promises.rm(outDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function transcribeAudioFile(audioFilePath: string): Promise<TranscriptionResult> {
  if (await commandExists("whisper")) {
    return {
      engine: "whisper",
      transcript: await transcribeWithWhisper(audioFilePath),
    };
  }

  return {
    engine: "placeholder",
    transcript: "",
  };
}
