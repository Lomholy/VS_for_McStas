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


def test_get_component_context_detects_cursor_before_the_closing_paren_is_written():
    # The realistic, most common moment a user needs parameter completions:
    # right after opening a component's parens, before they've written the
    # closing ")" at all. This used to fall through to "not in a block"
    # until the block was already fully closed.
    doc = "COMPONENT src = Source_Maxwell_3(\n  Lm"
    in_block, component_type = get_component_context(doc, len(doc))
    assert in_block is True
    assert component_type == "Source_Maxwell_3"


def test_get_component_context_unclosed_component_does_not_bleed_into_a_later_one():
    # An earlier component is still unclosed, but a later, complete
    # component already exists further down in the document -- the later
    # one's punctuation must not be mistaken for the earlier one's closing
    # paren.
    doc = "COMPONENT a = Source_Maxwell_3(\n  Lmin = 1,\nCOMPONENT b = Arm()\nAT (0,0,0) ABSOLUTE\n"
    offset = doc.index("Lmin = 1,") + len("Lmin = 1,")
    in_block, component_type = get_component_context(doc, offset)
    assert in_block is True
    assert component_type == "Source_Maxwell_3"

    outside_offset = doc.index("AT (0,0,0)") + 3
    in_block, component_type = get_component_context(doc, outside_offset)
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


def test_build_completion_items_offers_parameters_before_the_block_is_closed():
    doc = "COMPONENT src = Source_Maxwell_3(\n"
    items = build_completion_items(doc, 1, 0)
    labels = {it["label"] for it in items}

    assert "Lmin" in labels  # a real Source_Maxwell_3 parameter
    assert "Arm" not in labels  # component snippets are suppressed inside a block


def test_build_completion_items_fuzzy_filters_and_preselects_the_best_match():
    doc = "COMPONENT origin = Ar\n"
    items = build_completion_items(doc, 0, len("COMPONENT origin = Ar"))
    assert items[0]["label"] == "Arm"
    assert items[0]["preselect"] is True
