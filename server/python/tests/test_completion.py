from mcstas_ls.data import get_components
from mcstas_ls.completion import (
    build_completion_items,
    get_component_context,
    get_declared_variables,
    get_input_parameters,
)

INSTR = """DEFINE INSTRUMENT test(a, double b=1.0, int c)
TRACE
DECLARE
%{
  int foo;
  double bar = 2.0;
%}
COMPONENT origin = Arm()
AT (0,0,0) ABSOLUTE
COMPONENT src = Source_Maxwell_3(
)
AT (0,0,0) RELATIVE PREVIOUS
END
"""


def test_get_input_parameters_extracts_names_ignoring_types_and_defaults():
    assert get_input_parameters(INSTR) == ["a", "b", "c"]


def test_get_declared_variables_extracts_names_ignoring_types_and_initializers():
    assert get_declared_variables(INSTR) == ["foo", "bar"]


def test_get_component_context_detects_cursor_inside_parens():
    lines = INSTR.split("\n")
    target_line = next(i for i, l in enumerate(lines) if "Source_Maxwell_3(" in l)
    offset = sum(len(lines[i]) + 1 for i in range(target_line + 1))  # start of the blank line after '('
    in_block, component_type = get_component_context(INSTR, offset)
    assert in_block is True
    assert component_type == "Source_Maxwell_3"


def test_get_component_context_false_outside_any_component_parens():
    in_block, component_type = get_component_context(INSTR, 0)
    assert in_block is False
    assert component_type is None


def test_build_completion_items_outside_component_block_offers_snippets_and_scope_vars():
    lines = INSTR.split("\n")
    items = build_completion_items(INSTR, len(lines) - 1, 0)
    labels = {it["label"] for it in items}

    assert "Arm" in labels  # component snippet
    assert {"foo", "bar", "a", "b", "c"} <= labels  # DECLARE vars + INSTRUMENT params
    assert "COMPONENT" in labels  # base keyword


def test_build_completion_items_inside_component_block_offers_only_its_parameters():
    lines = INSTR.split("\n")
    target_line = next(i for i, l in enumerate(lines) if "Source_Maxwell_3(" in l)
    items = build_completion_items(INSTR, target_line + 1, 0)
    labels = {it["label"] for it in items}

    assert "Lmin" in labels  # a real Source_Maxwell_3 parameter
    assert "Arm" not in labels  # component snippets are suppressed inside a block


def test_build_completion_items_fuzzy_filters_and_preselects_the_best_match():
    doc = "COMPONENT origin = Ar\n"
    items = build_completion_items(doc, 0, len("COMPONENT origin = Ar"))
    assert items[0]["label"] == "Arm"
    assert items[0]["preselect"] is True


def test_get_component_context_survives_nested_parens_in_values():
    src = "TRACE\nCOMPONENT s = Source_simple(radius=sin(0.1), foc\n)\nEND\n"
    offset = src.index("foc") + 3
    assert get_component_context(src, offset) == (True, "Source_simple")
    assert get_component_context(src, src.index("END")) == (False, None)


def test_snippet_after_typed_component_head_inserts_only_the_type():
    doc = "COMPONENT s = Sou\n"
    items = build_completion_items(doc, 0, len("COMPONENT s = Sou"))
    item = next(it for it in items if it["label"] == "Source_simple")
    assert item["insertText"].startswith("Source_simple(\n")
    assert "COMPONENT" not in item["insertText"]


def test_snippet_after_component_keyword_inserts_name_placeholder_and_type():
    doc = "SPLIT 10 COMPONENT Sour\n"
    items = build_completion_items(doc, 0, len("SPLIT 10 COMPONENT Sour"))
    item = next(it for it in items if it["label"] == "Source_simple")
    assert item["insertText"].startswith("$0 = Source_simple(\n")


def test_snippet_on_empty_line_inserts_full_component_block():
    items = build_completion_items("Sou\n", 0, 3)
    item = next(it for it in items if it["label"] == "Source_simple")
    assert item["insertText"].startswith("COMPONENT $0 = Source_simple(\n")


def test_fuzzy_filter_ignores_case():
    doc = "COMPONENT a = arm"
    assert build_completion_items(doc, 0, len(doc))[0]["label"] == "Arm"
    doc = "COMPONENT a = s"
    assert build_completion_items(doc, 0, len(doc))[0]["label"].startswith("S")


def test_no_items_after_non_component_paren():
    doc = "COMPONENT a = Arm()\nAT ("
    assert build_completion_items(doc, 1, len("AT (")) == []


PARAM_DOC = """DEFINE INSTRUMENT t(L=1)
DECLARE
%{
  double w;
%}
TRACE
COMPONENT s = Source_simple(radius = 0.1, dist = sin(L, w),
"""


def test_parameter_name_position_offers_only_the_components_parameters_in_order():
    line = PARAM_DOC.split("\n")[6]
    items = build_completion_items(PARAM_DOC, 6, len(line))
    assert [it["label"] for it in items] == get_components()["Source_simple"]["parameter_names"]
    assert [it["sortText"] for it in items] == sorted(it["sortText"] for it in items)


def test_parameter_value_position_offers_instrument_variables():
    line = "COMPONENT s = Source_simple(radius = "
    doc = PARAM_DOC.replace(PARAM_DOC.split("\n")[6], line)
    assert {it["label"] for it in build_completion_items(doc, 6, len(line))} == {"w", "L"}
