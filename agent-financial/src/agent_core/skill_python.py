"""Execute reviewed Python scripts bundled in Skills inside Docker isolation."""

from __future__ import annotations

import re
import subprocess
import sys
import tempfile
from pathlib import Path

from langchain_core.tools import tool

from .config import SKILLS_ROOT


MAX_INPUT_BYTES = 1_000_000
MAX_OUTPUT_CHARS = 12_000
TIMEOUT_SECONDS = 20
SKILL_NAME = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")
SCRIPT_NAME = re.compile(r"^[a-z0-9_]+\.py$")


def _script_path(skill_name: str, script_name: str) -> Path:
    if not SKILL_NAME.fullmatch(skill_name):
        raise ValueError("skill_name must be a lowercase skill folder name")
    if not SCRIPT_NAME.fullmatch(script_name):
        raise ValueError("Only a Python script filename is allowed")

    root = SKILLS_ROOT.resolve(strict=True)
    skill_root = (root / skill_name).resolve(strict=True)
    scripts_root = (skill_root / "scripts").resolve(strict=True)
    script = (scripts_root / script_name).resolve(strict=True)
    if root not in skill_root.parents or scripts_root.parent != skill_root or script.parent != scripts_root:
        raise ValueError("The script must be directly inside the selected Skill's scripts/ directory")
    if not script.is_file():
        raise ValueError("The selected Skill script does not exist")
    return script


def _run(skill_name: str, script_name: str, input_json: str = "") -> str:
    if len(input_json.encode("utf-8")) > MAX_INPUT_BYTES:
        return "Python Skill runner rejected input larger than 1 MB."

    try:
        script = _script_path(skill_name, script_name)
    except (OSError, ValueError) as error:
        return f"Python Skill runner rejected the script: {error}"

    try:
        with tempfile.TemporaryDirectory(prefix="skill-python-") as working_directory:
            result = subprocess.run(
                [sys.executable, "-I", str(script)],
                input=input_json,
                text=True,
                encoding="utf-8",
                capture_output=True,
                cwd=working_directory,
                env={
                    "PYTHONIOENCODING": "utf-8",
                    "PYTHONUTF8": "1",
                    "PYTHONDONTWRITEBYTECODE": "1",
                },
                timeout=TIMEOUT_SECONDS,
                check=False,
            )
    except subprocess.TimeoutExpired:
        return f"Python Skill script timed out after {TIMEOUT_SECONDS} seconds."
    except OSError as error:
        return f"Could not start the Python Skill script: {error}"

    output = result.stdout.strip()
    errors = result.stderr.strip()
    if result.returncode != 0:
        detail = errors or output or f"container exited with status {result.returncode}"
        return f"Python Skill script failed: {detail[:MAX_OUTPUT_CHARS]}"
    return (output or "Python Skill script completed.")[:MAX_OUTPUT_CHARS]


@tool("run_skill_python_script")
def run_skill_python_script(skill_name: str, script_name: str, input_json: str = "") -> str:
    """Run one existing .py file from a Skill's scripts/ directory.

    The tool does not accept Python source code, shell commands, arbitrary file
    paths, or command-line options. It runs only an existing script in the
    selected Skill's scripts/ folder, in a Python subprocess with a timeout and
    minimal environment. Input is passed to the script through stdin.
    """
    return _run(skill_name, script_name, input_json)
