#!/usr/bin/env python3
"""Validate one document-renderer payload from stdin against the skill schema."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from jsonschema import Draft7Validator


SKILL_ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = SKILL_ROOT / "references" / "document.schema.json"


def validate_payload(raw: str) -> list[str]:
    try:
        payload: Any = json.loads(raw)
    except json.JSONDecodeError as error:
        return [f"Invalid JSON at line {error.lineno}, column {error.colno}: {error.msg}"]

    try:
        schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        return [f"Could not load document schema at {SCHEMA_PATH}: {error}"]

    validator = Draft7Validator(schema)
    issues = [
        f"{json.dumps(list(error.absolute_path), ensure_ascii=False)}: {error.message}"
        for error in validator.iter_errors(payload)
    ]
    if not issues and isinstance(payload, dict):
        issues.extend(_semantic_issues(payload))
    return issues


def _semantic_issues(payload: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    for section_index, section in enumerate(payload.get("sections", [])):
        for block_index, block in enumerate(section.get("blocks", [])):
            if block.get("type") != "table":
                continue
            location = f"sections[{section_index}].blocks[{block_index}]"
            keys = [column["key"] for column in block["columns"]]
            if len(keys) != len(set(keys)):
                issues.append(f"{location}: table column keys must be unique")
            expected = set(keys)
            for row_index, row in enumerate(block["rows"]):
                if set(row) != expected:
                    issues.append(f"{location}.rows[{row_index}]: cells must match the table columns")
    return issues


def main() -> int:
    issues = validate_payload(sys.stdin.read())
    if issues:
        print("Document payload is invalid:", file=sys.stderr)
        for issue in issues:
            print(f"- {issue}", file=sys.stderr)
        return 1
    print("Document payload is valid.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
