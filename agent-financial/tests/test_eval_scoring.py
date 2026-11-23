"""Regression checks for live-data disclosure language in the chart evals."""

import unittest
from collections import Counter
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

from evals.run_chart_evals import discloses_missing_data, discloses_missing_live_data
from evals.run_document_evals import preserves_value
from evals.run_langsmith_evals import _cases

_MATH_SCRIPT_PATH = Path(__file__).resolve().parents[1] / "skills" / "math-rendering" / "scripts" / "validate_math_delimiters.py"
_MATH_SCRIPT_SPEC = spec_from_file_location("validate_math_delimiters", _MATH_SCRIPT_PATH)
assert _MATH_SCRIPT_SPEC and _MATH_SCRIPT_SPEC.loader
_MATH_SCRIPT = module_from_spec(_MATH_SCRIPT_SPEC)
_MATH_SCRIPT_SPEC.loader.exec_module(_MATH_SCRIPT)


class LiveDataDisclosureEvalTests(unittest.TestCase):
    def test_accepts_availability_disclosure_with_intervening_qualifier(self) -> None:
        response = "Não tenho acesso, nesta conversa, a cotações ao vivo da B3."
        self.assertTrue(discloses_missing_live_data(response))

    def test_accepts_direct_unavailability_disclosure(self) -> None:
        self.assertTrue(discloses_missing_live_data("Não consigo acessar cotações ao vivo."))

    def test_requires_both_unavailability_and_market_data_context(self) -> None:
        self.assertFalse(discloses_missing_live_data("Não tenho acesso a esse assunto."))

    def test_recognizes_live_cdi_unavailability(self) -> None:
        self.assertTrue(discloses_missing_live_data("Não consigo consultar uma fonte oficial em tempo real para o CDI."))

    def test_recognizes_request_for_missing_values(self) -> None:
        self.assertTrue(discloses_missing_data("Preciso dos valores de cada categoria para montar o gráfico."))

    def test_recognizes_missing_flow_relationship(self) -> None:
        self.assertTrue(discloses_missing_data("A série não identifica depósitos nem compras."))


class DocumentValueEvalTests(unittest.TestCase):
    def test_recognizes_missing_account_source_disclosure(self) -> None:
        from evals.run_document_evals import MISSING_DATA_TERMS

        response = "Não posso gerar extrato sem os dados da conta nem acesso autorizado."
        self.assertTrue(any(term in response.casefold() for term in MISSING_DATA_TERMS))

    def test_literal_can_be_preserved_inside_descriptive_text(self) -> None:
        payload = {"sections": [{"blocks": [{"text": "Observação literal: <script>alert('x')</script> & taxa"}]}]}
        self.assertTrue(preserves_value("<script>alert('x')</script> & taxa", payload))

    def test_numeric_value_still_requires_exact_number(self) -> None:
        payload = {"sections": [{"blocks": [{"text": "Valor informado: R$ 1.000,00; saldo: -37,40"}]}]}
        self.assertTrue(preserves_value(1000, payload))
        self.assertTrue(preserves_value(-37.4, payload))
        self.assertFalse(preserves_value(10000, payload))


class MathDelimiterScriptTests(unittest.TestCase):
    def test_accepts_standalone_display_delimiters(self) -> None:
        result = _MATH_SCRIPT.validate("Antes\n$$\nx = 1\n$$\nDepois")
        self.assertTrue(result["valid"], result["issues"])

    def test_rejects_inline_display_delimiters(self) -> None:
        result = _MATH_SCRIPT.validate("$$x = 1$$")
        self.assertFalse(result["valid"])
        self.assertIn("Put each $$ display delimiter on a line by itself.", result["issues"])


class EvalCatalogTests(unittest.TestCase):
    def test_catalog_has_150_unique_cases_balanced_by_suite_and_category(self) -> None:
        cases = _cases()
        self.assertEqual(len(cases), 150)
        self.assertEqual(len({(case["suite"], case["id"]) for case in cases}), 150)
        self.assertEqual(Counter(case["suite"] for case in cases), {
            "chart": 50,
            "document": 50,
            "presentation": 50,
        })
        self.assertEqual(Counter(case["category"] for case in cases), {
            "baseline": 50,
            "stress": 50,
            "quality": 50,
        })


if __name__ == "__main__":
    unittest.main()

