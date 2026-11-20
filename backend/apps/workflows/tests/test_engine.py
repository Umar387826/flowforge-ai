from unittest import TestCase
from apps.workflows.engine import evaluate_conditions


class WorkflowConditionTests(TestCase):
    def test_empty_rules_pass(self):
        self.assertTrue(evaluate_conditions({}, {}))

    def test_and_conditions_pass(self):
        conditions = {
            "operator": "AND",
            "rules": [
                {"field": "score", "op": "gte", "value": 60},
                {"field": "lead.email", "op": "exists"},
            ],
        }
        self.assertTrue(evaluate_conditions(
            conditions, {"score": 75, "lead": {"email": "test@example.com"}}
        ))

    def test_and_conditions_fail(self):
        conditions = {
            "operator": "AND",
            "rules": [
                {"field": "score", "op": "gte", "value": 60},
                {"field": "status", "op": "eq", "value": "qualified"},
            ],
        }
        self.assertFalse(evaluate_conditions(
            conditions, {"score": 75, "status": "new"}
        ))

    def test_or_conditions_pass(self):
        conditions = {
            "operator": "OR",
            "rules": [
                {"field": "score", "op": "gt", "value": 90},
                {"field": "status", "op": "eq", "value": "qualified"},
            ],
        }
        self.assertTrue(evaluate_conditions(
            conditions, {"score": 50, "status": "qualified"}
        ))

    def test_nested_field_and_contains(self):
        conditions = {
            "rules": [
                {"field": "customer.email", "op": "contains", "value": "EXAMPLE"}
            ]
        }
        self.assertTrue(evaluate_conditions(
            conditions, {"customer": {"email": "user@example.com"}}
        ))

    def test_invalid_numeric_comparison_fails(self):
        conditions = {
            "rules": [{"field": "score", "op": "gte", "value": 60}]
        }
        self.assertFalse(evaluate_conditions(conditions, {"score": "unknown"}))
