import React from "react";
import Editor from "@monaco-editor/react";

type CodingEditorProps = {
  value: string;
  language: string;
  dark: boolean;
  onChange: (value: string) => void;
  onFocus?: () => void;
};

function monacoLanguage(language: string) {
  const normalized = language.trim().toLowerCase();
  if (normalized === "typescript" || normalized === "ts") return "typescript";
  if (normalized === "javascript" || normalized === "js" || normalized === "node.js") return "javascript";
  if (normalized === "python" || normalized === "pandas" || normalized === "numpy") return "python";
  if (normalized === "c++" || normalized === "cpp") return "cpp";
  if (normalized === "c") return "c";
  if (normalized === "sql" || normalized.includes("mysql") || normalized.includes("postgres")) return "sql";
  if (normalized === "html" || normalized === "css" || normalized === "java") return normalized;
  return "plaintext";
}

export default function CodingEditor({ value, language, dark, onChange, onFocus }: CodingEditorProps) {
  return (
    <div onFocusCapture={onFocus} className="h-80 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-neutral-700 dark:bg-[#1e1e1e]">
      <Editor
        height="320px"
        language={monacoLanguage(language)}
        value={value}
        theme={dark ? "vs-dark" : "light"}
        onChange={(nextValue) => onChange(nextValue ?? "")}
        options={{
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: 14,
          tabSize: 2,
          wordWrap: "on",
          scrollBeyondLastLine: false,
          suggestOnTriggerCharacters: true,
          quickSuggestions: true,
          bracketPairColorization: { enabled: true },
        }}
      />
    </div>
  );
}
