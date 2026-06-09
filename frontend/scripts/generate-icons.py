"""
Generates all PWA/favicon assets from logo2.png:
- Removes white background (makes transparent)
- icon-192.png, icon-512.png (transparent, any purpose)
- icon-512-maskable.png (burgundy bg, maskable)
- apple-touch-icon.png (180x180, white bg)
- favicon.ico (multi-size: 16, 32, 48)
"""

from PIL import Image
import os

PUBLIC = os.path.join(os.path.dirname(__file__), "..", "public")
SRC = os.path.join(PUBLIC, "logo2.png")
BRAND_COLOR = (139, 21, 56, 255)  # #8B1538

def remove_white_bg(img: Image.Image, threshold: int = 240) -> Image.Image:
    img = img.convert("RGBA")
    data = img.getdata()
    new_data = []
    for r, g, b, a in data:
        if r >= threshold and g >= threshold and b >= threshold:
            new_data.append((r, g, b, 0))
        else:
            new_data.append((r, g, b, a))
    img.putdata(new_data)
    return img

def make_icon(base: Image.Image, size: int, bg: tuple | None = None) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), bg if bg else (0, 0, 0, 0))
    # Add padding: logo fills 80% for maskable, 85% for others
    padding_factor = 0.80 if bg else 0.85
    logo_size = int(size * padding_factor)
    logo = base.resize((logo_size, logo_size), Image.LANCZOS)
    offset = (size - logo_size) // 2
    canvas.paste(logo, (offset, offset), logo)
    return canvas

src = Image.open(SRC)
transparent = remove_white_bg(src)

# icon-192.png — transparent
icon192 = make_icon(transparent, 192)
icon192.save(os.path.join(PUBLIC, "icon-192.png"), "PNG")
print("✓ icon-192.png")

# icon-512.png — transparent
icon512 = make_icon(transparent, 512)
icon512.save(os.path.join(PUBLIC, "icon-512.png"), "PNG")
print("✓ icon-512.png")

# icon-512-maskable.png — brand color bg, logo in 80% safe zone
maskable = make_icon(transparent, 512, bg=BRAND_COLOR)
maskable.save(os.path.join(PUBLIC, "icon-512-maskable.png"), "PNG")
print("✓ icon-512-maskable.png")

# apple-touch-icon.png — white bg, 180x180
apple = make_icon(transparent, 180, bg=(255, 255, 255, 255))
apple_rgb = apple.convert("RGB")
apple_rgb.save(os.path.join(PUBLIC, "apple-touch-icon.png"), "PNG")
print("✓ apple-touch-icon.png")

# favicon.ico — multi-size 16, 32, 48 with white bg
fav_imgs = []
for size in [16, 32, 48]:
    fav = make_icon(transparent, size, bg=(255, 255, 255, 255)).convert("RGBA")
    fav_imgs.append(fav)

fav_imgs[0].save(
    os.path.join(PUBLIC, "favicon.ico"),
    format="ICO",
    sizes=[(16, 16), (32, 32), (48, 48)],
    append_images=fav_imgs[1:]
)
print("✓ favicon.ico")

print("\nAll icons generated in frontend/public/")
