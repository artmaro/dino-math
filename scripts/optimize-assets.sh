#!/bin/bash
# Сжимаем PNG-ассеты до разумного размера для веба.
# Использует macOS `sips` (встроенная утилита).
#
# Принцип: уменьшаем разрешение исходников до ~2× от того, как они отображаются
# в игре (см. displayH в IMAGE_ASSETS / TILESET в game.js). PNG автоматически
# становится меньше байтами после уменьшения числа пикселей.
#
# Идемпотентность: скрипт можно запускать многократно. Если файл уже меньше
# целевого размера — sips не увеличит его обратно.
#
# Запуск из корня проекта:  bash scripts/optimize-assets.sh

set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v sips >/dev/null 2>&1; then
    echo "❌ sips не найден. Запускай на macOS." >&2
    exit 1
fi

getdim() {
    sips -g pixelWidth -g pixelHeight "$1" 2>/dev/null | awk '/pixelWidth/{w=$NF}/pixelHeight/{h=$NF}END{print w" "h}'
}

resize() {
    local file="$1" maxdim="$2"
    if [[ ! -f "$file" ]]; then
        echo "  skip (нет файла): $file"
        return 0
    fi
    local dims before_w before_h before_size
    dims=$(getdim "$file")
    before_w=$(echo "$dims" | awk '{print $1}')
    before_h=$(echo "$dims" | awk '{print $2}')
    if (( before_w <= maxdim && before_h <= maxdim )); then
        echo "  skip ($before_w×$before_h уже ≤ $maxdim): $file"
        return 0
    fi
    before_size=$(stat -f %z "$file")
    sips -Z "$maxdim" "$file" --out "$file.tmp" >/dev/null 2>&1
    mv "$file.tmp" "$file"
    dims=$(getdim "$file")
    local after_w after_h after_size
    after_w=$(echo "$dims" | awk '{print $1}')
    after_h=$(echo "$dims" | awk '{print $2}')
    after_size=$(stat -f %z "$file")
    printf "  %s: %d×%d (%d KB) → %d×%d (%d KB)\n" \
        "$file" "$before_w" "$before_h" $((before_size/1024)) "$after_w" "$after_h" $((after_size/1024))
}

echo "=== Большие декорации/спрайты в assets/ ==="
# Деревья и кусты используют displayH 55-115. На retina x2 → ~230. Sips Z=512 даёт качественный запас.
resize assets/02_tree_broadleaf.png 512
resize assets/03_tree_evergreen.png 512
resize assets/04_tree_magic.png 512
resize assets/05_bush_leafy.png 384
resize assets/06_bush_berries.png 384
resize assets/07_bush_flowers.png 384
# Сундуки — displayH 60. Можно 256 без потери качества.
resize assets/08_chest_closed.png 384
resize assets/09_chest_open_full.png 384
resize assets/10_chest_open_empty.png 384
# Фрукты-пикапы — displayH 32, мелкие. 256 хватит за глаза.
resize assets/14_fruit_berry.png 256
resize assets/15_fruit_grape.png 256
resize assets/16_fruit_melon.png 256
resize assets/17_fruit_pineapple.png 256
# Сердечки — displayH 32. 128 — более чем достаточно.
resize assets/18_heart_full.png 128
resize assets/19_heart_empty.png 128

echo ""
echo "=== Спрайт-листы (анкилозавр + NPC walk-cycles) ==="
# Анкилозавр: исходник 1536×1024, scaleFactor 0.5 → 768×512. Делаем 1024 max
# (sheet станет 1024×683 — даже мельче, scaleFactor можно не трогать).
resize assets/01_ankylosaurus_sprite_sheet_6x4.png 1024
# NPC walk: 2172×724, scaleFactor 0.4 → 869×290. Снижаем sheet до 1280 max.
resize assets/11_npc_tyrannosaurus_walk_6x1.png 1280
resize assets/12_npc_brachiosaurus_walk_6x1.png 1280
resize assets/13_npc_spinosaurus_walk_6x1.png 1280

echo ""
echo "=== Статичные NPC (не используются в игре сейчас, агрессивнее) ==="
resize assets/20_npc_tyrannosaurus_static.png 512
resize assets/21_npc_brachiosaurus_static.png 512
resize assets/22_npc_spinosaurus_static.png 512

echo ""
echo "=== HUD-плашка (не используется пока) ==="
resize assets/23_hud_numeral.png 512
resize assets/24_hud_plaque.png 512

echo ""
echo "=== Итог ==="
du -sh assets/
