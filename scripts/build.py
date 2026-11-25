#!/usr/bin/env python3
"""Build static pages from _src templates into the site root."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "_src"
PARTIALS = SRC / "partials"
PAGES = {
    "home": ROOT / "index.html",
    "about": ROOT / "about" / "index.html",
    "contact": ROOT / "contact" / "index.html",
    "venues": ROOT / "venues" / "index.html",
    "venues-ballroom": ROOT / "venues" / "ballroom" / "index.html",
    "venues-nook": ROOT / "venues" / "the-nook" / "index.html",
    "venues-amore": ROOT / "venues" / "amore-garden" / "index.html",
    "packages": ROOT / "packages" / "index.html",
    "gallery": ROOT / "gallery" / "index.html",
    "faqs": ROOT / "faqs" / "index.html",
    "blog": ROOT / "blog" / "index.html",
    "blog-checklist": ROOT / "blog" / "wedding-planning-checklist" / "index.html",
    "blog-venue": ROOT / "blog" / "how-to-choose-your-wedding-venue" / "index.html",
    "book": ROOT / "book" / "index.html",
    "thanks": ROOT / "expo-inquiry-post-submit" / "index.html",
    "not-found": ROOT / "404.html",
    "redirect-home": ROOT / "home" / "index.html",
    "redirect-venues": ROOT / "portfolio-1" / "index.html",
}

INCLUDE = re.compile(r"{%\s*include\s+([a-z0-9_.-]+)\s*%}")
VAR = re.compile(r"{{\s*([a-z0-9_]+)\s*}}")


def load_partial(name: str) -> str:
    path = PARTIALS / name
    return path.read_text()


def render(template: str, context: dict[str, str]) -> str:
    def include(match: re.Match[str]) -> str:
        return render(load_partial(match.group(1)), context)

    text = INCLUDE.sub(include, template)

    def replace(match: re.Match[str]) -> str:
        key = match.group(1)
        return context.get(key, "")

    return VAR.sub(replace, text)


def nav_attr(current: str, name: str) -> str:
    return ' aria-current="page"' if current == name else ""


def build() -> None:
    for key, dest in PAGES.items():
        src = SRC / "pages" / f"{key}.html"
        text = src.read_text()
        # infer current from filename if not already... pages include it in their context via placeholders
        # Pages themselves provide {{title}} etc in a sidecar? Simpler: each page file is a full
        # template that already has values in {% include %} after we wrap context.
        # We'll parse a YAML-like header from the first --- block.
        context, body = split_front_matter(text)
        current = context.get("current", "")
        context.setdefault("extra_head", "")
        context.setdefault("og_image", "/assets/img/hero-pavilion.webp")
        context["nav_home"] = nav_attr(current, "home")
        context["nav_venues"] = nav_attr(current, "venues")
        context["nav_packages"] = nav_attr(current, "packages")
        context["nav_gallery"] = nav_attr(current, "gallery")
        context["nav_faqs"] = nav_attr(current, "faqs")
        context["nav_blog"] = nav_attr(current, "blog")
        context["nav_about"] = nav_attr(current, "about")
        context["nav_contact"] = nav_attr(current, "contact")
        html = render(body, context)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(html)
        print(f"wrote {dest.relative_to(ROOT)}")


def split_front_matter(text: str) -> tuple[dict[str, str], str]:
    if not text.startswith("---"):
        return {}, text
    _, rest = text.split("---", 1)
    matter, body = rest.split("---", 1)
    context: dict[str, str] = {}
    key = None
    acc: list[str] = []
    def flush():
        nonlocal key, acc
        if key:
            context[key] = "\n".join(acc).strip()
        key = None
        acc = []
    for line in matter.splitlines():
        if not line.strip():
            continue
        if ":" in line and not line.startswith(" ") and not line.startswith("\t"):
            flush()
            name, val = line.split(":", 1)
            key = name.strip()
            acc = [val.strip()] if val.strip() else []
        else:
            acc.append(line)
    flush()
    return context, body.lstrip("\n")


if __name__ == "__main__":
    build()
