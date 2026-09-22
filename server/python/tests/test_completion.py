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
