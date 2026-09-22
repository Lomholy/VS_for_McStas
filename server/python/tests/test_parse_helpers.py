from mcstas_ls.parse_helpers import (
    extract_identifier_from_declarator,
    looks_like_function_prototype,
    remove_top_level_initializer,
    split_top_level_by,
    strip_comments_and_strings,
)


def test_strip_comments_and_strings_removes_line_and_block_comments():
    src = "int a; // comment\n/* block\ncomment */ int b;"
    result = strip_comments_and_strings(src)
    assert "comment" not in result
    assert "int a;" in result
    assert "int b;" in result


def test_strip_comments_and_strings_neutralizes_string_and_char_literals():
    src = "char c = 'x'; char *s = \"hello, world\";"
    result = strip_comments_and_strings(src)
    assert "hello" not in result
    assert "x" not in result.split("=")[1].split(";")[0]


def test_split_top_level_by_ignores_nested_delimiters():
    s = "a, b(c, d), e[f, g], h"
    parts = [p.strip() for p in split_top_level_by(s, ",")]
    assert parts == ["a", "b(c, d)", "e[f, g]", "h"]


def test_remove_top_level_initializer():
    assert remove_top_level_initializer("int a = compute(1, 2)").strip() == "int a"
    assert remove_top_level_initializer("int arr[4]") == "int arr[4]"


def test_looks_like_function_prototype():
    assert looks_like_function_prototype("void foo(int a)") is True
    assert looks_like_function_prototype("int a = foo(1)") is False
    assert looks_like_function_prototype("int arr[10]") is False


def test_extract_identifier_from_declarator_handles_pointers_and_arrays():
    assert extract_identifier_from_declarator("int *a") == "a"
    assert extract_identifier_from_declarator("const unsigned long arr[10]") == "arr"
    assert extract_identifier_from_declarator("struct S *p") == "p"
    assert extract_identifier_from_declarator("char *names[3]") == "names"


def test_extract_identifier_from_declarator_function_pointer_known_limitation():
    # Ported as-is from parse_helpers.ts, which has the same gap: the
    # trailing-suffix scanner strips both "(int)" and "(*fp)" and never
    # recovers the "fp" identifier, despite the .ts docstring's claim.
    assert extract_identifier_from_declarator("int (*fp)(int)") is None
