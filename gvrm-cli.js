#!/usr/bin/env node
// Copyright (c) 2025 naruya
// Licensed under the MIT License. See LICENSE file in the project root for full license information.

/**
 * GVRM CLI - Command-line tool for preprocessing Gaussian Splats to GVRM format
 *
 * Usage:
 *   node gvrm-cli.js input.ply output.gvrm [options]
 *
 * Options:
 *   --nocheck   Skip ground and pose validation checks
 *   --nobg      Remove background splats
 *   --cpu       Use CPU for processing (default: GPU if available)
 */

import fs from 'fs';
import path from 'path';
import gl from 'gl';
import { createCanvas } from 'canvas';

// Import texture loader mock before Three.js modules
import './mock-texture-loader.js';

// Create a mock style object
function createMockStyle() {
  return new Proxy({}, {
    get: (target, prop) => target[prop] || '',
    set: (target, prop, value) => {
      target[prop] = value;
      return true;
    }
  });
}

// Create a mock canvas element
function createMockCanvas() {
  const canvas = createCanvas(1024, 1024);
  if (!canvas.style) {
    canvas.style = createMockStyle();
  }
  // Add addEventListener if not present
  if (!canvas.addEventListener) {
    canvas.addEventListener = () => {};
  }
  if (!canvas.removeEventListener) {
    canvas.removeEventListener = () => {};
  }
  return canvas;
}

// Mock DOM elements for CLI environment
global.document = {
  getElementById: (id) => ({
    innerHTML: '',
    style: createMockStyle()
  }),
  createElement: (tag) => {
    if (tag === 'canvas') {
      return createMockCanvas();
    }
    return {
      style: createMockStyle(),
      appendChild: () => {},
      addEventListener: () => {},
      getContext: () => null,
      click: () => {}, //  For error download links
      href: '',
      download: ''
    };
  },
  createElementNS: (ns, tag) => {
    if (tag === 'canvas') {
      return createMockCanvas();
    }
    return {
      style: createMockStyle(),
      appendChild: () => {},
      addEventListener: () => {},
      getContext: () => null,
      setAttributeNS: () => {}
    };
  },
  body: {
    appendChild: () => {},
    removeChild: () => {}
  },
  querySelectorAll: () => []
};

// Ensure console methods are available
if (!global.console) {
  global.console = console;
}

global.window = {
  push: () => {},
  innerWidth: 1024,
  innerHeight: 1024,
  addEventListener: () => {},
  location: { href: '' },
  devicePixelRatio: 1,
  console: console,
  URL: class {
    constructor(url) {
      this.searchParams = new Map();
    }
  }
};

// Add self as an alias to global for web worker checks
global.self = global;

// Mock ImageBitmap for GLTFLoader texture loading
global.ImageBitmap = class ImageBitmap {
  constructor() {
    this.width = 512;
    this.height = 512;
  }
};

// Mock createImageBitmap for GLTFLoader
global.createImageBitmap = async (imageData) => {
  console.log('[Mock] createImageBitmap called');
  const bitmap = new global.ImageBitmap();
  // Set dimensions from imageData if available
  if (imageData && imageData.width) bitmap.width = imageData.width;
  if (imageData && imageData.height) bitmap.height = imageData.height;
  return bitmap;
};

// Mock HTMLImageElement for GLTFLoader texture loading
class MockHTMLImageElement {
  constructor() {
    console.log('[Mock HTMLImageElement] constructor called');
    this.width = 1;
    this.height = 1;
    this._src = '';
    this._onload = null;
    this._onerror = null;
    this.crossOrigin = null;
    this.complete = false;
  }

  get src() {
    return this._src;
  }

  set src(value) {
    this._src = value;
    const preview = value.length > 50 ? value.substring(0, 50) + '...' : value;
    console.log('[Mock HTMLImageElement] src set to:', preview);
    this.complete = false;
    // Immediately trigger onload for data URLs or blob URLs
    setImmediate(() => {
      this.complete = true;
      if (this._onload) {
        console.log('[Mock HTMLImageElement] Calling onload');
        this._onload();
      }
    });
  }

  get onload() {
    return this._onload;
  }

  set onload(handler) {
    console.log('[Mock HTMLImageElement] onload setter called');
    this._onload = handler;
  }

  get onerror() {
    return this._onerror;
  }

  set onerror(handler) {
    this._onerror = handler;
  }

  addEventListener(event, handler) {
    console.log(`[Mock HTMLImageElement] addEventListener('${event}') called`);
    if (event === 'load') {
      this._onload = handler;
    } else if (event === 'error') {
      this._onerror = handler;
    }
  }

  removeEventListener(event, handler) {
    if (event === 'load') {
      this._onload = null;
    } else if (event === 'error') {
      this._onerror = null;
    }
  }
}

global.Image = MockHTMLImageElement;
global.HTMLImageElement = MockHTMLImageElement;

// Mock FileReader for GLTFLoader texture loading
global.FileReader = class FileReader {
  constructor() {
    console.log('[Mock FileReader] constructor');
    this.result = null;
    this._onload = null;
    this._onerror = null;
    this.readyState = 0; // EMPTY
  }

  readAsDataURL(blob) {
    console.log(`[Mock FileReader] readAsDataURL called, blob size: ${blob.size}`);
    this.readyState = 1; // LOADING

    // Create a simple data URL
    setTimeout(async () => {
      try {
        // For images, create a minimal valid PNG data URL
        const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        this.result = `data:${blob.options?.type || 'image/png'};base64,${base64}`;
        this.readyState = 2; // DONE

        console.log('[Mock FileReader] Calling onload');
        if (this._onload) {
          this._onload({ target: this });
        }
      } catch (error) {
        console.error('[Mock FileReader] Error:', error);
        if (this._onerror) {
          this._onerror(error);
        }
      }
    }, 0);
  }

  readAsArrayBuffer(blob) {
    console.log(`[Mock FileReader] readAsArrayBuffer called, blob size: ${blob.size}`);
    this.readyState = 1; // LOADING

    setTimeout(async () => {
      this.result = await blob.arrayBuffer();
      this.readyState = 2; // DONE

      if (this._onload) {
        this._onload({ target: this });
      }
    }, 0);
  }

  get onload() {
    return this._onload;
  }

  set onload(handler) {
    this._onload = handler;
  }

  get onerror() {
    return this._onerror;
  }

  set onerror(handler) {
    this._onerror = handler;
  }

  addEventListener(event, handler) {
    if (event === 'load') {
      this._onload = handler;
    } else if (event === 'error') {
      this._onerror = handler;
    }
  }
};

// Mock Blob for GLTFLoader
global.Blob = class Blob {
  constructor(parts, options) {
    this.parts = parts;
    this.options = options || {};
    this.size = parts.reduce((sum, part) => sum + (part.byteLength || part.length || 0), 0);
    console.log(`[Mock Blob] Created blob, size: ${this.size}, type: ${this.options.type}`);
  }

  async arrayBuffer() {
    console.log('[Mock Blob] arrayBuffer() called');
    if (this.parts.length === 1 && this.parts[0] instanceof ArrayBuffer) {
      return this.parts[0];
    }
    // Combine parts into single ArrayBuffer
    const totalSize = this.size;
    const buffer = new ArrayBuffer(totalSize);
    const view = new Uint8Array(buffer);
    let offset = 0;
    for (const part of this.parts) {
      if (part instanceof ArrayBuffer) {
        view.set(new Uint8Array(part), offset);
        offset += part.byteLength;
      } else if (part instanceof Uint8Array) {
        view.set(part, offset);
        offset += part.byteLength;
      }
    }
    return buffer;
  }

  async text() {
    console.log('[Mock Blob] text() called');
    const buffer = await this.arrayBuffer();
    return new TextDecoder().decode(buffer);
  }
};

global.URL = class {
  constructor(url) {
    this.searchParams = {
      get: () => null,
      has: () => false
    };
  }
  static createObjectURL = (blob) => {
    console.log('[Mock URL] createObjectURL called');
    return 'blob://mock-' + Math.random();
  };
  static revokeObjectURL = (url) => {
    console.log('[Mock URL] revokeObjectURL called for', url);
  };
};

// Mock fetch for loading local files in CLI mode
const originalFetch = global.fetch;
global.fetch = async function(url, options) {
  console.log(`[Mock fetch] Loading: ${url}`);

  // Handle local file URLs (relative paths like ./assets/default.json)
  if (url.startsWith('./') || url.startsWith('../') || !url.includes('://')) {
    const filePath = path.resolve(url);
    console.log(`[Mock fetch] Reading local file: ${filePath}`);

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => content,
        json: async () => JSON.parse(content),
        arrayBuffer: async () => {
          const buffer = fs.readFileSync(filePath);
          return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        },
        blob: async () => new global.Blob([fs.readFileSync(filePath)])
      };
    } catch (error) {
      console.error(`[Mock fetch] Error reading file ${filePath}:`, error.message);
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => { throw error; },
        json: async () => { throw error; },
        arrayBuffer: async () => { throw error; },
        blob: async () => { throw error; }
      };
    }
  }

  // For remote URLs, use original fetch if available
  if (originalFetch) {
    return originalFetch(url, options);
  }

  throw new Error(`fetch not available for URL: ${url}`);
};

// Add global error, warn, log functions for Three.js
global.error = console.error.bind(console);
global.warn = console.warn.bind(console);
global.log = console.log.bind(console);

// Mock gaussian-splats-3d - will be dynamically imported and replaced
class MockDropInViewer {
  constructor() {
    this.viewer = {
      loadingSpinner: {
        tasks: [],
        addTask: (name) => {
          const taskId = `task-${Date.now()}-${Math.random()}`;
          console.log(`[Task] ${name}`);
          return taskId;
        },
        removeTask: (taskId) => {
          console.log(`[Task completed] ${taskId}`);
        }
      }
    };
  }
}

// Store mock for later injection
global.MockDropInViewer = MockDropInViewer;

// Parse command-line arguments
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node gvrm-cli.js <input.ply> <output.gvrm> [options]');
    console.error('');
    console.error('Options:');
    console.error('  --nocheck   Skip ground and pose validation checks');
    console.error('  --nobg      Remove background splats');
    console.error('  --cpu       Use CPU for processing (default: GPU if available)');
    process.exit(1);
  }

  const inputPly = path.resolve(args[0]);
  const outputGvrm = path.resolve(args[1]);
  const options = {
    nocheck: args.includes('--nocheck'),
    nobg: args.includes('--nobg'),
    cpu: args.includes('--cpu')
  };

  // Validate input file
  if (!fs.existsSync(inputPly)) {
    console.error(`Error: Input file not found: ${inputPly}`);
    process.exit(1);
  }

  if (!inputPly.endsWith('.ply')) {
    console.error('Error: Input file must be a .ply file');
    process.exit(1);
  }

  return { inputPly, outputGvrm, options };
}

async function main() {
  const { inputPly, outputGvrm, options } = parseArgs();

  console.log('GVRM CLI - Gaussian Splat to GVRM Preprocessor');
  console.log('='.repeat(50));
  console.log(`Input:  ${inputPly}`);
  console.log(`Output: ${outputGvrm}`);
  console.log(`Options: nocheck=${options.nocheck}, nobg=${options.nobg}, cpu=${options.cpu}`);
  console.log('='.repeat(50));

  try {
    // Create headless WebGL context
    const width = 1024;
    const height = 1024;
    const glContext = gl(width, height, { preserveDrawingBuffer: true });

    // Add WebGL2 stubs for headless-gl (which is WebGL1)
    if (!glContext.texImage3D) {
      glContext.texImage3D = () => {};
    }
    if (!glContext.texSubImage3D) {
      glContext.texSubImage3D = () => {};
    }
    if (!glContext.compressedTexImage3D) {
      glContext.compressedTexImage3D = () => {};
    }
    if (!glContext.compressedTexSubImage3D) {
      glContext.compressedTexSubImage3D = () => {};
    }
    if (!glContext.TEXTURE_3D) {
      glContext.TEXTURE_3D = 0x806F;
    }
    if (!glContext.TEXTURE_2D_ARRAY) {
      glContext.TEXTURE_2D_ARRAY = 0x8C1A;
    }

    // Add VAO support (WebGL2 feature)
    if (!glContext.createVertexArray) {
      const mockVAO = { __isMockVAO: true };
      glContext.createVertexArray = () => mockVAO;
      glContext.bindVertexArray = () => {};
      glContext.deleteVertexArray = () => {};
      glContext.isVertexArray = (vao) => vao && vao.__isMockVAO;
    }

    // Add other WebGL2 constants and functions
    if (!glContext.READ_BUFFER) {
      glContext.READ_BUFFER = 0x0C02;
    }
    if (!glContext.DRAW_BUFFER0) {
      glContext.DRAW_BUFFER0 = 0x8825;
    }
    if (!glContext.readBuffer) {
      glContext.readBuffer = () => {};
    }
    if (!glContext.drawBuffers) {
      glContext.drawBuffers = () => {};
    }

    console.log('✓ WebGL context created');

    // Import Three.js and preprocessing modules
    console.log('Loading preprocessing modules...');

    const THREE = await import('three');
    const preprocessModule = await import('./apps/preprocess/preprocess.js');
    const preprocess = preprocessModule.preprocess;

    console.log('✓ Modules loaded');

    // Create Three.js scene, camera, renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(65.0, width / height, 0.01, 2000.0);
    camera.position.set(0.0, 0.8, 2.4);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    // Create a canvas with the gl context
    const canvas = createMockCanvas();
    canvas.getContext = (type) => {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
        return glContext;
      }
      return null;
    };

    // Use headless renderer with custom canvas
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      context: glContext,
      antialias: false  // Disable for headless
    });
    renderer.setSize(width, height);

    const light = new THREE.DirectionalLight(0xffffff, Math.PI);
    light.position.set(10.0, 10.0, 10.0);
    scene.add(light);

    console.log('✓ Three.js environment initialized');

    // VRM path (default)
    const vrmPath = './assets/sotai.vrm';

    if (!fs.existsSync(vrmPath)) {
      console.error(`Error: VRM file not found: ${vrmPath}`);
      console.error('Please ensure sotai.vrm is in the assets directory');
      process.exit(1);
    }

    console.log('Starting preprocessing...');
    console.log('This may take several minutes...');

    // Load default bone operations for VRM
    const defaultBoneOpsPath = './assets/default.json';
    let hints = null;
    if (fs.existsSync(defaultBoneOpsPath)) {
      const defaultConfig = JSON.parse(fs.readFileSync(defaultBoneOpsPath, 'utf8'));
      hints = {
        boneOperations: defaultConfig.boneOperations
      };
      console.log('✓ Loaded default bone operations');
    }

    // Run preprocessing
    // Note: When using --nocheck, skip cleaning splats by using stage='2'
    // This avoids pose/ground validation which doesn't work well with mesh2gaussian output
    const stage = options.nocheck ? '2' : null;  // stage 2 skips cleanSplats

    const result = await preprocess(
      vrmPath,           // VRM path
      inputPly,          // Gaussian Splat PLY path
      scene,             // Three.js scene
      camera,            // Three.js camera
      renderer,          // Three.js renderer
      stage,             // stage (null = auto, 2 = skip cleanSplats)
      !options.cpu,      // useGPU
      options.nobg,      // nobg
      options.nocheck,   // nocheck
      path.basename(outputGvrm, '.gvrm'),  // fileName
      false,             // savePly
      hints              // hints (contains boneOperations)
    );

    console.log('✓ Preprocessing completed');

    // Wait for final promise
    if (result.promise2) {
      await result.promise2;
      console.log('✓ Final processing completed');
    }

    // Save GVRM file
    const gvrm = result.gvrm;
    if (gvrm && gvrm.save) {
      console.log(`Saving GVRM to: ${outputGvrm}`);

      // Call gvrm.save with all required parameters
      // In CLI mode, pass the full output path to ensure correct filename
      await gvrm.save(
        result.vrmPath,
        result.gsPath,
        result.boneOperations,
        result.vrmScale,
        outputGvrm,  // Pass full path with .gvrm extension
        false  // savePly = false
      );

      console.log('✓ GVRM file saved successfully');
    } else {
      console.error('✗ Could not save GVRM file - result object missing save method');
      process.exit(1);
    }

    console.log('');
    console.log('='.repeat(50));
    console.log('✓ Conversion completed successfully!');
    console.log('='.repeat(50));
    console.log(`Output: ${outputGvrm}`);
    console.log('');
    console.log('You can now use this .gvrm file with gaussian-vrm');

  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run main if this is the entry point
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { parseArgs };
