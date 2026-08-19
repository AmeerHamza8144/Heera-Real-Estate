#!/usr/bin/env python3
"""OCR numeric plot labels from the supplied high-resolution master plan."""
from __future__ import annotations

import argparse
import concurrent.futures
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


def process(job: tuple[int, str, str]) -> str:
    number, tile_path, output_dir = job
    target = Path(output_dir) / f"tile-{number:03d}.tsv"
    gray = np.asarray(Image.open(tile_path).convert("L"))
    ink = gray < 185
    horizontal = ndimage.binary_opening(ink, structure=np.ones((1, 35), dtype=bool))
    vertical = ndimage.binary_opening(ink, structure=np.ones((35, 1), dtype=bool))
    cleaned = np.where(ink & ~(horizontal | vertical), 0, 255).astype(np.uint8)
    cleaned_image = Image.fromarray(cleaned).resize((gray.shape[1] * 2, gray.shape[0] * 2), Image.Resampling.NEAREST)
    from io import BytesIO
    encoded = BytesIO()
    cleaned_image.save(encoded, format="PNG")
    try:
        result = subprocess.run(
            ["tesseract", "stdin", "stdout", "--psm", "11", "-l", "eng", "-c", "tessedit_char_whitelist=0123456789", "tsv"],
            input=encoded.getvalue(), capture_output=True, check=False, timeout=60,
        )
        target.write_bytes(result.stdout)
    except subprocess.TimeoutExpired:
        target.write_text("level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n", encoding="utf-8")
    return target.name


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("image", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--workers", type=int, default=6)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    Image.MAX_IMAGE_PIXELS = None
    image = Image.open(args.image)
    width, height = image.size
    tile_dir = args.output / "source-tiles"
    tile_dir.mkdir(exist_ok=True)
    jobs = []
    number = 0
    for y in range(0, height, 1000):
        for x in range(0, width, 1000):
            tile_path = tile_dir / f"source-{number:03d}.jpg"
            if not tile_path.exists():
                image.crop((x, y, min(x + 1000, width), min(y + 1000, height))).save(tile_path, quality=92)
            jobs.append((number, str(tile_path), str(args.output)))
            number += 1
    with concurrent.futures.ProcessPoolExecutor(max_workers=args.workers) as pool:
        completed = list(pool.map(process, jobs))
    print(f"Wrote {len(completed)} OCR TSV tiles to {args.output}")


if __name__ == "__main__":
    main()
