# GVRM Generation Guide

This guide explains how to generate GVRM files from GLB/VRM and PLY (Gaussian Splat) files.

## Quick Start

### 1. Prepare Your Files

Use the helper script to prepare your files:

```bash
./prepare_gvrm.sh <your_avatar.glb> <your_gaussian.ply> <output_name>
```

Example:
```bash
./prepare_gvrm.sh ~/models/avatar.glb ~/models/gaussian.ply my_character
```

This will:
- Copy your files to `gvrm_input/` directory
- Display instructions for the next steps

### 2. Start the Server

If not already running:

```bash
node server.js
```

The server will start on `https://localhost:8080`

### 3. Open Browser and Generate GVRM

1. Open your browser to: `https://localhost:8080/apps/preprocess.html`
2. Drag and drop your files:
   - First: The GLB/VRM file from `gvrm_input/`
   - Second: The PLY file from `gvrm_input/`
3. Click **Preprocess** button
4. Wait for processing to complete (this may take several minutes)
5. Download the generated `.gvrm` file

## Manual Process

If you prefer to do it manually:

1. Copy your GLB and PLY files to the `gaussian-vrm` directory
2. Start the server: `node server.js`
3. Open browser to `https://localhost:8080/apps/preprocess.html`
4. Drag and drop files in order (GLB first, then PLY)
5. Click Preprocess
6. Download the result

## Integration with Pipeline

To integrate GVRM generation into your processing pipeline:

### Python Example

```python
import subprocess
import shutil
import os

def prepare_gvrm_files(glb_path, ply_path, output_name, gaussian_vrm_dir):
    """Prepare files for GVRM generation"""

    # Create input directory
    input_dir = os.path.join(gaussian_vrm_dir, 'gvrm_input')
    os.makedirs(input_dir, exist_ok=True)

    # Copy files
    shutil.copy(glb_path, os.path.join(input_dir, f'{output_name}.glb'))
    shutil.copy(ply_path, os.path.join(input_dir, f'{output_name}.ply'))

    print(f"""
GVRM files prepared!

Next steps:
1. Open browser to: https://localhost:8080/apps/preprocess.html
2. Drag and drop:
   - {os.path.join(input_dir, f'{output_name}.glb')}
   - {os.path.join(input_dir, f'{output_name}.ply')}
3. Click 'Preprocess' and download the result
    """)

# Usage
prepare_gvrm_files(
    'path/to/avatar.glb',
    'path/to/gaussian.ply',
    'my_avatar',
    '/path/to/gaussian-vrm'
)
```

## Notes

- The browser-based preprocessing provides **proper bone assignment** using capsule-based detection
- Processing time depends on the size of your Gaussian Splat file
- Make sure the server is running before opening the browser
- The generated GVRM file will be downloaded to your browser's default download location

## Troubleshooting

### Server won't start
- Check if port 8080 is already in use: `lsof -i:8080`
- Make sure SSL certificates exist in `.server/` directory

### Browser shows security warning
- This is expected for self-signed certificates
- Click "Advanced" and "Proceed to localhost"

### Processing fails
- Check browser console for errors (F12)
- Ensure files are valid GLB/VRM and PLY formats
- Try with smaller files first to verify the setup
