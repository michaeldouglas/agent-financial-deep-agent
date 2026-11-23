"""Check common Markdown structure without rewriting source content."""
import json
import re
import sys


def validate(text: str) -> dict[str, object]:
    issues: list[str] = []
    fences: list[tuple[str, int]] = []
    for line_number, line in enumerate(text.splitlines(), 1):
        match = re.match(r"^\s{0,3}(`{3,}|~{3,})", line)
        if not match:
            continue
        marker = match.group(1)
        if not fences:
            fences.append((marker[0], len(marker)))
        elif marker[0] == fences[-1][0] and len(marker) >= fences[-1][1]:
            fences.pop()
    if fences:
        issues.append("A fenced code block is not closed.")
    return {"valid": not issues, "issues": issues}


def main() -> None:
    payload = json.load(sys.stdin)
    if not isinstance(payload, dict) or not isinstance(payload.get("markdown"), str):
        raise SystemExit("Expected JSON object with string field 'markdown'.")
    print(json.dumps(validate(payload["markdown"]), ensure_ascii=False))


if __name__ == "__main__":
    main()
