"""Regenerate the local Bricolage faces. Use fonttools 4.60.1, brotli 1.2.1 and zopfli 0.4.3."""

from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont


root = Path(__file__).resolve().parent.parent
source = root / (
    "web/node_modules/@fontsource-variable/bricolage-grotesque/files/"
    "bricolage-grotesque-latin-standard-normal.woff2"
)
destination = root / "web/src/assets/fonts"
destination.mkdir(parents=True, exist_ok=True)

# Keep the complete optical-size axis, including its upstream default of 96.
# Titles and details retain every upstream Latin glyph, including dynamic token symbols.
faces = [
    ("titles", {"wght": 800, "wdth": 80}, None),
    ("wordmark", {"wght": 700, "wdth": 85}, "DeFi Checkup"),
    ("details", {"wght": (600, 700), "wdth": 100}, None),
]
for name, axes, text in faces:
    font = TTFont(source, recalcTimestamp=False)
    font = instantiateVariableFont(font, axes, inplace=True)
    output = destination / f"bricolage-{name}.woff2"
    font.save(output)
    if text:
        # Reload after instancing so the subsetter sees the serialized glyph variations.
        font = TTFont(output, recalcTimestamp=False)
        options = subset.Options()
        options.flavor = "woff2"
        subsetter = subset.Subsetter(options=options)
        subsetter.populate(text=text)
        subsetter.subset(font)
        font.save(output)
    print(f"{output.relative_to(root)}: {output.stat().st_size} bytes")
