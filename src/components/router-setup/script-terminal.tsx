"use client";

type ScriptTerminalProps = {
  script: string;
  emptyMessage?: string;
};

/** Lightweight RouterOS CLI highlighting for comments vs commands. */
export function ScriptTerminal({
  script,
  emptyMessage = "Select a site to generate RouterOS commands.",
}: ScriptTerminalProps) {
  if (!script) {
    return (
      <pre className="max-h-[520px] overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-500">
        {emptyMessage}
      </pre>
    );
  }

  const lines = script.split("\n");

  return (
    <pre className="max-h-[520px] overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-relaxed shadow-inner">
      {lines.map((line, index) => {
        const trimmed = line.trimStart();
        let className = "text-teal-100";

        if (!trimmed) {
          className = "text-transparent";
        } else if (trimmed.startsWith("#")) {
          className = "text-slate-500";
        } else if (trimmed.startsWith(":put") || trimmed.startsWith(":do")) {
          className = "text-amber-200";
        } else if (trimmed.startsWith("/")) {
          className = "text-emerald-300";
        }

        return (
          <div key={`${index}-${line.slice(0, 12)}`} className={className}>
            <span className="mr-3 inline-block w-8 select-none text-right text-slate-600">
              {index + 1}
            </span>
            {line || " "}
          </div>
        );
      })}
    </pre>
  );
}
