// Copyright (c) 2025 naruya
// Licensed under the MIT License. See LICENSE file in the project root for full license information.


import * as THREE from 'three';
import { PLYLoader } from './ply.js';

// Conditional import for Node.js vs Browser
let GS3D;
try {
  const module = await import('gaussian-splats-3d');
  GS3D = module;
} catch (e) {
  // Running in Node.js CLI - GS3D will be null
  GS3D = null;
}


export class GaussianSplatting extends THREE.Group {
  constructor(urls, scale, gsPosition, quaternion) {
    super();
    this.loadGS(urls, scale, gsPosition, quaternion);
  }

  loadGS(urls, scale, gsPosition=[0, 0, 0], quaternion=[0, 0, 1, 0]) {

    if (!Array.isArray(urls)) {
      urls = [urls];
    }

    this.loadingPromise = new Promise(async (resolve, reject) => {
      // Check if we're in Node.js CLI environment
      if (GS3D === null || !GS3D.DropInViewer) {
        // Node.js CLI path: Use PLYLoader directly
        console.log('[CLI Mode] Loading PLY files directly without visualization');

        const plyLoader = new PLYLoader();

        // Load PLY file and parse it
        try {
          const plyPath = urls[0]; // Take first URL
          const plyData = await plyLoader.load(plyPath);

          // Store the PLY data for processing
          this.plyData = plyData;
          this.vertices = plyData.vertices;

          // Set up transformation matrices
          this.position0 = new THREE.Vector3(...gsPosition);
          this.quaternion0 = new THREE.Quaternion(...quaternion);
          this.rotation0 = new THREE.Euler().setFromQuaternion(this.quaternion0);
          this.matrix0 = new THREE.Matrix4().compose(this.position0, this.quaternion0, new THREE.Vector3(1, 1, 1));

          // Create property arrays from vertex data
          const splatCount = this.vertices.length;

          // Colors array (RGBA format)
          this.colors = new Float32Array(splatCount * 4);
          // Positions array (XYZ format)
          this.positions = new Float32Array(splatCount * 3);
          // Scales array (XYZ format)
          this.scales = new Float32Array(splatCount * 3);
          // Rotations array (XYZW quaternion format)
          this.rotations = new Float32Array(splatCount * 4);

          for (let i = 0; i < splatCount; i++) {
            const vertex = this.vertices[i];

            // Colors (RGBA)
            this.colors[i * 4 + 0] = (vertex.red || 255) / 255.0;
            this.colors[i * 4 + 1] = (vertex.green || 255) / 255.0;
            this.colors[i * 4 + 2] = (vertex.blue || 255) / 255.0;
            this.colors[i * 4 + 3] = 1.0; // Alpha

            // Positions (XYZ)
            this.positions[i * 3 + 0] = vertex.x || 0;
            this.positions[i * 3 + 1] = vertex.y || 0;
            this.positions[i * 3 + 2] = vertex.z || 0;

            // Scales (XYZ) - using scale_0, scale_1, scale_2 or default
            this.scales[i * 3 + 0] = vertex.scale_0 || 0.01;
            this.scales[i * 3 + 1] = vertex.scale_1 || 0.01;
            this.scales[i * 3 + 2] = vertex.scale_2 || 0.01;

            // Rotations (XYZW quaternion) - using rot_0, rot_1, rot_2, rot_3 or default identity
            this.rotations[i * 4 + 0] = vertex.rot_0 || 0;
            this.rotations[i * 4 + 1] = vertex.rot_1 || 0;
            this.rotations[i * 4 + 2] = vertex.rot_2 || 0;
            this.rotations[i * 4 + 3] = vertex.rot_3 || 1;
          }

          // Create mock viewer and splatMesh for CLI compatibility
          this.viewer = {
            splatMesh: {
              scenes: [{
                matrixWorld: this.matrix0,
                position: this.position0,
                quaternion: this.quaternion0,
                splatBuffer: {
                  // Mock splatBuffer with vertex data
                  getSplatCount: () => splatCount
                }
              }],
              baseData: this.vertices, // Add baseData for preprocessing
              colors: this.colors,
              positions: this.positions,
              scales: this.scales,
              rotations: this.rotations,
              updateDataTexturesFromBaseData: () => {
                // No-op in CLI mode (no GPU textures to update)
              },
              renderOrder: 0
            },
            viewer: {
              splatMesh: {
                renderOrder: 0
              }
            },
            dispose: async () => {
              // No-op in CLI mode
            }
          };

          // Alias for direct access
          this.splatMesh = this.viewer.splatMesh;
          this.splatCount = splatCount;

          console.log(`✓ Loaded ${this.vertices.length} Gaussian splats from PLY`);
          resolve(this);
        } catch (error) {
          console.error('Error loading PLY file:', error);
          reject(error);
        }
      } else {
        // Browser path: Use DropInViewer for visualization
        let viewer = new GS3D.DropInViewer({
          // 'gpuAcceleratedSort': true,  // ?
          'sharedMemoryForWorkers': false,  // ?
          'dynamicScene': true,  // changed
          'sceneRevealMode': 2,
          'sphericalHarmonicsDegree': 2,
          // 'optimizeSplatData': false,  // not implemented at 8ef8abc
          // 'plyInMemoryCompressionLevel': 0,
        });

        const sceneOptions = urls.map(url => ({
          'path': url,
          'scale': [scale, scale, scale],
          'position': gsPosition,
          'rotation': quaternion,  // z rot 180
          'splatAlphaRemovalThreshold': 0
        }));

        await viewer.addSplatScenes(sceneOptions, false);

        this.add(viewer);  // THREE.Group
        this.viewer = viewer;
        // These are directly overwritten in splats and separated from the viewer's pose.
        this.position0 = new THREE.Vector3(...gsPosition);
        this.quaternion0 = new THREE.Quaternion(...quaternion);
        this.rotation0 = new THREE.Euler().setFromQuaternion(this.quaternion0);
        this.matrix0 = new THREE.Matrix4().compose(this.position0, this.quaternion0, new THREE.Vector3(1, 1, 1));

        resolve(this);
      }
    }, undefined, function (error) {
      console.error(error);
    });
  }
}
