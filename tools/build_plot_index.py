#!/usr/bin/env python3
"""Compile OCR TSV map tiles into the public automatic plot-search index."""
from __future__ import annotations

import argparse
import csv
import json
import re
from datetime import datetime, timezone
from pathlib import Path

IMAGE_WIDTH = 12009
IMAGE_HEIGHT = 9009
TILE_SIZE = 1000
TILE_COLUMNS = 13
OCR_SCALE = 2.0
NUMBER = re.compile(r"^[0-9]{1,4}$")


def detected_block(x: float, y: float) -> str:
    if y >= 0.55:
        return "Overseas Block"
    return "A Block" if x < 0.27 else "B Block"


def compile_index(tsv_dir: Path) -> list[dict]:
    records: list[dict] = []
    for path in sorted(tsv_dir.glob("tile-*.tsv")):
        match = re.fullmatch(r"tile-(\d{3})\.tsv", path.name)
        if not match:
            continue
        tile_number = int(match.group(1))
        tile_x = (tile_number % TILE_COLUMNS) * TILE_SIZE
        tile_y = (tile_number // TILE_COLUMNS) * TILE_SIZE
        try:
            rows = csv.DictReader(path.open(encoding="utf-8", errors="ignore"), delimiter="\t")
            for row in rows:
                text = (row.get("text") or "").strip()
                if not NUMBER.fullmatch(text):
                    continue
                confidence = float(row.get("conf") or -1)
                left, top = float(row["left"]), float(row["top"])
                width, height = float(row["width"]), float(row["height"])
                original_width, original_height = width / OCR_SCALE, height / OCR_SCALE
                if confidence < 35 or not (3.5 <= original_height <= 15) or not (2.5 <= original_width <= 34):
                    continue
                x = (tile_x + (left + width / 2) / OCR_SCALE) / IMAGE_WIDTH
                y = (tile_y + (top + height / 2) / OCR_SCALE) / IMAGE_HEIGHT
                if not (0.015 <= x <= 0.94 and 0.04 <= y <= 0.98):
                    continue
                if x > 0.50 and y < 0.30:
                    continue
                records.append({"plot_number": str(int(text)), "block": detected_block(x, y), "normalized_x": round(x, 8), "normalized_y": round(y, 8), "confidence": round(confidence, 2)})
        except (OSError, ValueError, KeyError):
            continue
    deduplicated: list[dict] = []
    for record in sorted(records, key=lambda item: (int(item["plot_number"]), item["block"], item["normalized_y"], item["normalized_x"])):
        duplicate = next((item for item in deduplicated if item["plot_number"] == record["plot_number"] and abs(item["normalized_x"] - record["normalized_x"]) < 0.001 and abs(item["normalized_y"] - record["normalized_y"]) < 0.001), None)
        if duplicate:
            if record["confidence"] > duplicate["confidence"]:
                duplicate.update(record)
            continue
        record["id"] = len(deduplicated) + 1
        deduplicated.append(record)
    return deduplicated


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tsv-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "maps" / "phase2-plot-index.json")
    args = parser.parse_args()
    plots = compile_index(args.tsv_dir)
    payload = {"project": "Al-Rehman Garden Phase 2", "map_image": "maps/al-rehman-garden-phase-2-highres.jpg", "original_pdf": "maps/al-rehman-garden-phase-2-original.pdf", "original_width": IMAGE_WIDTH, "original_height": IMAGE_HEIGHT, "blocks": ["A Block", "B Block", "Overseas Block"], "generated_at": datetime.now(timezone.utc).isoformat(), "method": "OCR coordinates detected from the supplied vector master-plan PDF", "plots": plots}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {len(plots)} detected plot labels to {args.output}")


if __name__ == "__main__":
    main()
