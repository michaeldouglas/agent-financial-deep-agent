"""Detect likely unmatched math delimiters; does not validate KaTeX commands."""
import json
import re
import sys


def validate(text: str) -> dict[str, object]:
    issues: list[str] = []
    code = re.sub(r"(`{3,}|~{3,})[\s\S]*?\1", "", text)
    display = re.findall(r"(?<!\\)\$\$", code)
    inline_source = re.sub(r"(?<!\\)\$\$[\s\S]*?(?<!\\)\$\$", "", code)
    if len(display) % 2:
        issues.append("Unmatched $$ display math delimiter.")
    if any(
        line.strip() != "$$"
        for line in re.findall(r"(?m)^.*(?<!\\)\$\$.*$", code)
    ):
        issues.append("Put each $$ display delimiter on a line by itself.")
    if len(re.findall(r"(?<!\\)(?<!\$)\$(?!\$)", inline_source)) % 2:
        issues.append("Unmatched $ inline math delimiter.")
    if r"\(" in code or r"\[" in code:
        issues.append("Use $...$ or $$...$$; the frontend normalizes legacy delimiters but this check does not validate them.")
    return {"valid": not issues, "issues": issues, "note": "Delimiter checks do not prove KaTeX compatibility."}


def main() -> None:
    payload = json.load(sys.stdin)
    if not isinstance(payload, dict) or not isinstance(payload.get("text"), str):
        raise SystemExit("Expected JSON object with string field 'text'.")
    print(json.dumps(validate(payload["text"]), ensure_ascii=False))


if __name__ == "__main__":
    main()
