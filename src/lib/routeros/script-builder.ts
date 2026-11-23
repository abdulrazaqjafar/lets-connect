/** Small helper to assemble readable RouterOS CLI scripts. */
export class RouterOsScriptBuilder {
  private lines: string[] = [];

  blank() {
    this.lines.push("");
    return this;
  }

  comment(text: string) {
    this.lines.push(`# ${text}`);
    return this;
  }

  section(title: string) {
    this.blank();
    this.lines.push(`# --- ${title} ---`);
    return this;
  }

  cmd(command: string) {
    this.lines.push(command);
    return this;
  }

  /** Emit a command only when condition is true. */
  cmdIf(condition: boolean, command: string) {
    if (condition) this.lines.push(command);
    return this;
  }

  /**
   * Idempotent remove-then-add pattern using RouterOS find.
   * Example path: "/ip hotspot walled-garden"
   */
  removeByComment(path: string, comment: string) {
    this.lines.push(
      `:do { ${path} remove [find comment="${escapeRos(comment)}"] } on-error={}`,
    );
    return this;
  }

  removeByName(path: string, name: string) {
    this.lines.push(
      `:do { ${path} remove [find name="${escapeRos(name)}"] } on-error={}`,
    );
    return this;
  }

  build(): string {
    return `${this.lines.join("\n")}\n`;
  }
}

/** Escape double quotes inside RouterOS string literals. */
export function escapeRos(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
