#!/usr/bin/env python3
import os
import subprocess

SOURCE_SVG = "public/favicon.svg"
RES_DIR = "android/app/src/main/res"
TMP_ICON = "/tmp/fh-icon-1024.png"

def run(cmd):
    subprocess.run(cmd, check=True)

print(f"🎨 Rasterizando {SOURCE_SVG} a 1024x1024...")
run(["magick", "-background", "none", "-density", "1200", SOURCE_SVG, "-resize", "1024x1024", TMP_ICON])

# 1. ic_launcher.png (estándar cuadrado/squircle)
LAUNCHER_SIZES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}
print("📱 Generando ic_launcher.png...")
for density, size in LAUNCHER_SIZES.items():
    dest = os.path.join(RES_DIR, f"mipmap-{density}", "ic_launcher.png")
    run(["magick", TMP_ICON, "-resize", f"{size}x{size}", dest])

# 2. ic_launcher_round.png (circular con máscara)
print("⚪ Generando ic_launcher_round.png circular...")
for density, size in LAUNCHER_SIZES.items():
    dest = os.path.join(RES_DIR, f"mipmap-{density}", "ic_launcher_round.png")
    radius = size // 2
    cmd = [
        "magick", TMP_ICON, "-resize", f"{size}x{size}",
        "(", "-size", f"{size}x{size}", "xc:none", "-fill", "white", "-draw", f"circle {radius},{radius} {radius},0", ")",
        "-alpha", "set", "-compose", "DstIn", "-composite", dest
    ]
    run(cmd)

# 3. ic_launcher_foreground.png (Adaptive icon)
FG_SIZES = {
    "mdpi": 108,
    "hdpi": 162,
    "xhdpi": 216,
    "xxhdpi": 324,
    "xxxhdpi": 432,
}
print("🎯 Generando ic_launcher_foreground.png...")
for density, canvas_size in FG_SIZES.items():
    dest = os.path.join(RES_DIR, f"mipmap-{density}", "ic_launcher_foreground.png")
    logo_size = int(canvas_size * 0.72)
    cmd = [
        "magick", "-size", f"{canvas_size}x{canvas_size}", "xc:none",
        "(", TMP_ICON, "-resize", f"{logo_size}x{logo_size}", ")",
        "-gravity", "center", "-composite", dest
    ]
    run(cmd)

# 4. Splash Screen Portrait
SPLASH_PORT = {
    "mdpi": ("320x480", 120),
    "hdpi": ("480x800", 180),
    "xhdpi": ("720x1280", 260),
    "xxhdpi": ("960x1600", 340),
    "xxxhdpi": ("1280x1920", 440),
}
print("🖼️ Generando Splash Screen Portrait...")
for density, (dim, logo_w) in SPLASH_PORT.items():
    dest = os.path.join(RES_DIR, f"drawable-port-{density}", "splash.png")
    cmd = [
        "magick", "-size", dim, "xc:#0F172A",
        "(", TMP_ICON, "-resize", f"{logo_w}x{logo_w}", ")",
        "-gravity", "center", "-composite", dest
    ]
    run(cmd)

# 5. Splash Screen Landscape
SPLASH_LAND = {
    "mdpi": ("480x320", 120),
    "hdpi": ("800x480", 180),
    "xhdpi": ("1280x720", 260),
    "xxhdpi": ("1600x960", 340),
    "xxxhdpi": ("1920x1280", 440),
}
print("🖼️ Generando Splash Screen Landscape...")
for density, (dim, logo_w) in SPLASH_LAND.items():
    dest = os.path.join(RES_DIR, f"drawable-land-{density}", "splash.png")
    cmd = [
        "magick", "-size", dim, "xc:#0F172A",
        "(", TMP_ICON, "-resize", f"{logo_w}x{logo_w}", ")",
        "-gravity", "center", "-composite", dest
    ]
    run(cmd)

print("✅ Todos los recursos gráficos de Android generados exitosamente!")
