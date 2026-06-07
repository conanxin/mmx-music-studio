#!/bin/bash
# scripts/package-weapp-dist.sh
# Phase 3D: 打包 apps/weapp/dist 为 zip（不含 node_modules/private config）
# 不真实生成，不消耗额度

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$PROJECT_DIR/apps/weapp/dist"
OUTPUT_DIR="/tmp"
OUTPUT_ZIP="$OUTPUT_DIR/mmx-music-studio-weapp-dist.zip"

echo "=== mmx-music-studio: 打包微信小程序 dist ==="
echo ""

# 1. 检查 dist 是否存在
if [ ! -d "$DIST_DIR" ]; then
  echo "❌ dist 目录不存在: $DIST_DIR"
  echo "   请先运行: npm run weapp:build"
  exit 1
fi

# 2. 编译（如 dist 已存在则跳过）
echo "[1] 检查 dist 产物..."
REQUIRED_FILES="app.js app.json app.wxss pages/home/index.js pages/studio/index.js pages/library/index.js pages/settings/index.js pages/docs/index.js project.config.json"
for f in $REQUIRED_FILES; do
  if [ ! -f "$DIST_DIR/$f" ]; then
    echo "⚠️  缺少: $f，重新编译..."
    npm run weapp:build
    break
  fi
done
echo "   dist 产物检查完成 ✓"

# 3. 清理临时文件（防止误打包）
echo ""
echo "[2] 清理临时文件..."
find "$DIST_DIR" -name "*.map" -type f -delete 2>/dev/null || true
find "$DIST_DIR" -name ".DS_Store" -type f -delete 2>/dev/null || true
echo "   清理完成 ✓"

# 4. 打包（Python zipfile，兼容无 zip 命令的环境）
echo ""
echo "[3] 打包 dist 为 zip (Python)..."
if [ -f "$OUTPUT_ZIP" ]; then
  rm -f "$OUTPUT_ZIP"
fi

python3 -c "
import zipfile, os, pathlib

dist = pathlib.Path('$DIST_DIR')
out  = '$OUTPUT_ZIP'

with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zf:
    for f in dist.rglob('*'):
        if f.is_file() and '.map' not in f.name and '.DS_Store' not in f.name:
            zf.write(f, f.relative_to(dist.parent.parent))
print('done')
"

ZIP_SIZE=$(du -h "$OUTPUT_ZIP" | cut -f1)
FILE_COUNT=$(find "$DIST_DIR" -type f | wc -l)

echo ""
echo "=== 打包完成 ==="
echo "   输出路径: $OUTPUT_ZIP"
echo "   文件数量: $FILE_COUNT"
echo "   zip 大小: $ZIP_SIZE"
echo ""
echo "   使用方法："
echo "   1. 下载 zip 到本地电脑"
echo "   2. 解压到本地目录"
echo "   3. 微信开发者工具导入该目录"
echo ""
echo "✅ Phase 3D dist 打包完成"
