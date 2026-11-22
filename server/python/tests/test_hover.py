from types import SimpleNamespace

from lsprotocol import types as lsp

from mcstas_ls.data import get_components
from mcstas_ls.hover import build_component_hover_markdown, find_hovered_component, hover


def test_find_hovered_component_matches_cursor_over_the_type_name():
    doc = "COMPONENT src = Arm(\n)\nAT (0,0,0) RELATIVE PREVIOUS\n"
    # "Arm" spans columns [16, 19) on line 0.
    assert find_hovered_component(doc, 0, 16) == "Arm"
    assert find_hovered_component(doc, 0, 19) == "Arm"
    assert find_hovered_component(doc, 0, 15) is None  # just before the token
    assert find_hovered_component(doc, 0, 20) is None  # just after the token


def test_find_hovered_component_ignores_non_component_lines():
    doc = "AT (0,0,0) RELATIVE PREVIOUS\n"
    assert find_hovered_component(doc, 0, 5) is None


def test_find_hovered_component_allows_keyword_prefixes():
    for prefix in ("SPLIT ", "SPLIT 10 ", "SPLIT 2*n ", "REMOVABLE ", "CPU ", "REMOVABLE CPU SPLIT 5 "):
        doc = prefix + "COMPONENT a = Arm()\n"
        col = doc.index("Arm")
        assert find_hovered_component(doc, 0, col) == "Arm", prefix


def test_find_hovered_component_returns_none_for_out_of_range_line():
    doc = "COMPONENT src = Arm()\n"
    assert find_hovered_component(doc, 5, 0) is None


def test_build_component_hover_markdown_includes_null_defaults():
    # Source_Maxwell_3 has several parameters whose JSON default is
    # explicitly `null` (not merely absent) -- these should still get a
    # "default: null" line, mirroring the TS `def !== undefined` check.
    spec = get_components()["Source_Maxwell_3"]
    hover = build_component_hover_markdown(spec)
    text = hover.contents.value
    assert "## Source\\_Maxwell\\_3" in text
    assert "*Category:* sources" in text
    assert "`Lmin`" in text
    assert "default: null" in text
    assert "default: 300.0" in text  # T2's default


def test_build_component_hover_markdown_handles_component_with_no_parameters():
    spec = get_components()["Arm"]
    hover = build_component_hover_markdown(spec)
    text = hover.contents.value
    assert "## Arm" in text
    assert "**Parameters**" in text


def test_hover_shows_unavailable_message_for_component_without_data(monkeypatch):
    monkeypatch.setattr("mcstas_ls.hover.get_components", lambda: {"Rotator": "Component information is unavailable"})
    doc = SimpleNamespace(source="COMPONENT r = Rotator()\n")
    ls = SimpleNamespace(workspace=SimpleNamespace(get_text_document=lambda uri: doc))
    params = lsp.HoverParams(
        text_document=lsp.TextDocumentIdentifier(uri="file:///a.instr"),
        position=lsp.Position(line=0, character=16),
    )
    text = hover(ls, params).contents.value
    assert text == "## Rotator\n\nComponent information is unavailable"
