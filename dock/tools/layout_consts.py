"""Reads sizes from the dock's own Layout.cs, so the generated icons can never drift from what is drawn."""
import os
import re

_LAYOUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "Core", "Layout.cs")


def layout_int(name):
    m = re.search(r"public const int " + re.escape(name) + r"\s*=\s*(\d+)\s*;", open(_LAYOUT, encoding="utf-8").read())
    if not m:
        raise SystemExit("constant missing in Layout.cs: " + name)
    return int(m.group(1))


# The focused icon is the largest the dock ever draws an icon, so icons are made at that size: it is
# never scaled up, and the smaller sizes are scaled down.
FOCUS_ICON = layout_int("FocusIcon")
