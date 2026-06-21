import React, { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { indentUnit } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import type { Extension } from "@codemirror/state";

type CodingEditorProps = {
  value: string;
  language: string;
  dark: boolean;
  onChange: (value: string) => void;
  onFocus?: () => void;
};

function languageExtension(language: string): Extension {
  switch (language.trim().toLowerCase()) {
    case "javascript": return javascript();
    case "typescript": return javascript({ typescript: true });
    case "python": return python();
    case "java": return java();
    case "c":
    case "c++":
    case "cpp": return cpp();
    default: return [];
  }
}

export default function CodingEditor({ value, language, dark, onChange, onFocus }: CodingEditorProps) {
  const extensions = useMemo(() => [languageExtension(language), indentUnit.of("  ")], [language]);

  return (
    <div
      onFocusCapture={onFocus}
      className="h-80 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-neutral-700 dark:bg-[#1e1e1e] [&_.cm-editor]:h-80 [&_.cm-editor]:text-sm [&_.cm-scroller]:font-mono [&_.cm-scroller]:overflow-auto"
    >
      <CodeMirror
        value={value}
        height="320px"
        theme={dark ? oneDark : "light"}
        extensions={extensions}
        onChange={onChange}
        basicSetup={{
          autocompletion: true,
          bracketMatching: true,
          closeBrackets: true,
          foldGutter: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          highlightSelectionMatches: true,
          indentOnInput: true,
          lineNumbers: true,
        }}
      />
    </div>
  );
}
