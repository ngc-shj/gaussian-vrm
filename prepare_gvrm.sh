#!/bin/bash
# GVRM Preparation Helper Script
# This script prepares files and starts the server for GVRM generation

set -e

if [ "$#" -lt 2 ]; then
    echo "Usage: $0 <glb_file> <ply_file> [output_name]"
    echo ""
    echo "Example:"
    echo "  $0 avatar.glb gaussian.ply my_avatar"
    exit 1
fi

GLB_FILE="$1"
PLY_FILE="$2"
OUTPUT_NAME="${3:-avatar}"

# Check if files exist
if [ ! -f "$GLB_FILE" ]; then
    echo "Error: GLB file not found: $GLB_FILE"
    exit 1
fi

if [ ! -f "$PLY_FILE" ]; then
    echo "Error: PLY file not found: $PLY_FILE"
    exit 1
fi

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Create input directory if it doesn't exist
mkdir -p gvrm_input

# Copy files to input directory
echo "Copying files to gvrm_input/..."
cp "$GLB_FILE" "gvrm_input/${OUTPUT_NAME}.glb"
cp "$PLY_FILE" "gvrm_input/${OUTPUT_NAME}.ply"

echo ""
echo "========================================="
echo "GVRM Generation Setup Complete!"
echo "========================================="
echo ""
echo "Files prepared:"
echo "  VRM/GLB: gvrm_input/${OUTPUT_NAME}.glb"
echo "  PLY:     gvrm_input/${OUTPUT_NAME}.ply"
echo ""
echo "Next steps:"
echo "  1. Start the server (if not already running):"
echo "     cd $SCRIPT_DIR && node server.js"
echo ""
echo "  2. Open browser to:"
echo "     https://localhost:8080/apps/preprocess.html"
echo ""
echo "  3. Drag and drop the files:"
echo "     - First: gvrm_input/${OUTPUT_NAME}.glb"
echo "     - Second: gvrm_input/${OUTPUT_NAME}.ply"
echo ""
echo "  4. Click 'Preprocess' and wait for completion"
echo ""
echo "  5. Download the generated .gvrm file"
echo ""
echo "========================================="
