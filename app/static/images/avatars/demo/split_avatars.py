from pathlib import Path
from PIL import Image


BASE_DIR = Path(__file__).resolve().parent

SOURCE = BASE_DIR / "avatars.png"
OUTPUT_DIR = BASE_DIR

COLS = 6
ROWS = 5

OUTPUT_SIZE = 256

# Petite marge pour ne pas prendre
# les séparations entre les cases.
MARGIN_X = 8
MARGIN_Y = 8


image = Image.open(SOURCE).convert("RGB")

width, height = image.size

print(f"Image source : {width} x {height}")

cell_width = width / COLS
cell_height = height / ROWS

number = 1


for row in range(ROWS):

    for col in range(COLS):

        left = round(
            col * cell_width
            + MARGIN_X
        )

        top = round(
            row * cell_height
            + MARGIN_Y
        )

        right = round(
            (col + 1) * cell_width
            - MARGIN_X
        )

        bottom = round(
            (row + 1) * cell_height
            - MARGIN_Y
        )

        avatar = image.crop(
            (
                left,
                top,
                right,
                bottom
            )
        )

        # On transforme la découpe
        # en carré sans déformer l'image.

        crop_width, crop_height = avatar.size

        square_size = min(
            crop_width,
            crop_height
        )

        x = (
            crop_width - square_size
        ) // 2

        y = (
            crop_height - square_size
        ) // 2

        avatar = avatar.crop(
            (
                x,
                y,
                x + square_size,
                y + square_size
            )
        )

        avatar = avatar.resize(
            (
                OUTPUT_SIZE,
                OUTPUT_SIZE
            ),
            Image.Resampling.LANCZOS
        )

        filename = (
            f"avatar_{number:02d}.png"
        )

        avatar.save(
            OUTPUT_DIR / filename
        )

        print(
            f"✓ {filename}"
        )

        number += 1


print()
print("30 avatars créés.")