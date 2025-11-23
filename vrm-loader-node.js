// VRM Loader for Node.js - Texture-less skeleton loading
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import * as THREE from 'three';
import fs from 'fs';

export class VRMLoaderNode {
  constructor() {
    this.io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  }

  async loadVRM(vrmPath, scene, scale = 1.0) {
    console.log(`[VRMLoaderNode] Loading VRM: ${vrmPath}`);

    // Read VRM file as binary
    const buffer = fs.readFileSync(vrmPath);

    // Parse GLB format to extract JSON
    console.log('[VRMLoaderNode] Parsing GLB format...');
    const gltfJson = this.parseGLB(buffer);

    console.log('[VRMLoaderNode] GLTF parsed, nodes:', gltfJson.nodes?.length || 0);
    console.log('[VRMLoaderNode] Meshes:', gltfJson.meshes?.length || 0);

    // Create a minimal Three.js scene from the GLTF structure
    // For GVRM preprocessing, we only need the skeleton
    const vrm = await this.createVRMFromGLTF(gltfJson, buffer, scene, scale);

    return vrm;
  }

  parseGLB(buffer) {
    // GLB format: 12-byte header + JSON chunk + BIN chunk
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    // Check magic number (glTF)
    const magic = view.getUint32(0, true);
    if (magic !== 0x46546C67) {
      throw new Error('Not a valid GLB file');
    }

    // Get JSON chunk length
    const jsonLength = view.getUint32(12, true);

    // Extract JSON
    const jsonBytes = new Uint8Array(buffer.buffer, buffer.byteOffset + 20, jsonLength);
    const jsonString = new TextDecoder().decode(jsonBytes);
    const json = JSON.parse(jsonString);

    console.log('[VRMLoaderNode] GLB parsed successfully');
    return json;
  }

  async createVRMFromGLTF(gltfJson, buffer, scene, scale) {
    // Load the actual GLB file using gltf-transform to get mesh data
    const doc = await this.io.readBinary(new Uint8Array(buffer));

    const vrmExtension = gltfJson.extensions?.VRM;
    if (!vrmExtension) {
      throw new Error('No VRM extension found in file');
    }

    console.log('[VRMLoaderNode] VRM extension found');

    // Create minimal VRM object
    const vrmScene = new THREE.Group();
    vrmScene.name = 'VRMScene';

    const vrm = {
      scene: vrmScene,
      humanoid: {
        humanBones: {},
        getNormalizedBoneNode: (boneName) => {
          const bone = vrm.humanoid.humanBones[boneName];
          return bone?.node;
        },
        getRawBoneNode: (boneName) => {
          const bone = vrm.humanoid.humanBones[boneName];
          return bone?.node;
        },
        resetRawPose: () => {
          // No-op for skeleton-only mode
        },
        resetNormalizedPose: () => {
          // No-op for skeleton-only mode
        },
        update: (deltaTime) => {
          // No-op for skeleton-only mode
        }
      },
      meta: vrmExtension.meta || {},
      metaVersion: vrmExtension.specVersion || '1.0',
      springBoneManager: {
        joints: [],
        colliders: []
      },
      update: (deltaTime) => {
        // No-op for skeleton-only mode
      }
    };

    // Create mock skeleton and skinned mesh for CLI compatibility
    // Parse humanoid bones and build skeleton structure
    const mockBones = [];
    const boneNodeMap = {};

    if (vrmExtension.humanoid && vrmExtension.humanoid.humanBones) {
      for (const boneDef of vrmExtension.humanoid.humanBones) {
        const bone = new THREE.Bone();
        bone.name = boneDef.bone;

        // Store both the bone and create an Object3D reference for humanBones
        const boneNode = new THREE.Object3D();
        boneNode.name = boneDef.bone;
        boneNode.position.copy(bone.position);

        vrm.humanoid.humanBones[boneDef.bone] = {
          node: boneNode
        };

        boneNodeMap[boneDef.bone] = bone;
        mockBones.push(bone);
      }
    }

    console.log(`[VRMLoaderNode] Loaded ${Object.keys(vrm.humanoid.humanBones).length} humanoid bones`);

    // Create a simple hips node for hipPos0 if not exists
    if (!vrm.humanoid.humanBones['hips']) {
      const hipsNode = new THREE.Object3D();
      hipsNode.name = 'hips';
      hipsNode.position.set(0, 1, 0); // Default position
      vrm.humanoid.humanBones['hips'] = { node: hipsNode };

      const hipsBone = new THREE.Bone();
      hipsBone.name = 'hips';
      hipsBone.position.set(0, 1, 0);
      mockBones.push(hipsBone);
    }

    vrm.hipPos0 = vrm.humanoid.getNormalizedBoneNode('hips').position.clone();

    // Create mock skeleton from bones
    const mockSkeleton = new THREE.Skeleton(mockBones);

    // Extract actual mesh geometry from GLB
    const meshes = doc.getRoot().listMeshes();
    let realGeometry = new THREE.BufferGeometry();

    if (meshes.length > 0) {
      console.log(`[VRMLoaderNode] Loading ${meshes.length} mesh(es) from GLB`);

      // Get the first mesh
      const mesh = meshes[0];
      const primitives = mesh.listPrimitives();

      if (primitives.length > 0) {
        const primitive = primitives[0];

        // Get position attribute
        const positionAccessor = primitive.getAttribute('POSITION');
        if (positionAccessor) {
          const positionArray = positionAccessor.getArray();
          const vertexCount = positionAccessor.getCount();

          console.log(`[VRMLoaderNode] Loaded ${vertexCount} vertices from mesh geometry`);

          // Create Three.js buffer attribute
          realGeometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));

          // Get indices if available
          const indicesAccessor = primitive.getIndices();
          if (indicesAccessor) {
            const indicesArray = indicesAccessor.getArray();
            realGeometry.setIndex(new THREE.BufferAttribute(indicesArray, 1));
          }
        } else {
          console.warn('[VRMLoaderNode] No POSITION attribute found, using minimal geometry');
          const positions = new Float32Array(9);
          realGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
          realGeometry.setIndex([0, 1, 2]);
        }
      }
    } else {
      console.warn('[VRMLoaderNode] No meshes found in GLB, using minimal geometry');
      const positions = new Float32Array(9);
      realGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      realGeometry.setIndex([0, 1, 2]);
    }

    const mockMaterial = [new THREE.MeshStandardMaterial()]; // Array for forEach compatibility

    // Create skinned mesh with actual geometry
    const mockSkinnedMesh = new THREE.SkinnedMesh(realGeometry, mockMaterial);
    mockSkinnedMesh.name = 'Body';
    mockSkinnedMesh.skeleton = mockSkeleton;
    mockSkinnedMesh.bind(mockSkeleton);

    // VRM scenes typically have simple structure: [0] = container/root, [1] = body mesh
    // Don't add individual bones as scene children - they're part of the skeleton
    const containerNode = new THREE.Object3D();
    containerNode.name = 'Root';
    vrm.scene.add(containerNode);  // children[0]
    vrm.scene.add(mockSkinnedMesh); // children[1]

    // Set up scene transforms
    vrm.scene.scale.setScalar(scale);
    vrm.scene.updateMatrix();
    vrm.scene.position0 = vrm.scene.position.clone();
    vrm.scene.rotation0 = vrm.scene.rotation.clone();
    vrm.scene.quaternion0 = vrm.scene.quaternion.clone();
    vrm.scene.matrix0 = vrm.scene.matrix.clone();

    // Add to Three.js scene
    scene.add(vrm.scene);

    console.log('[VRMLoaderNode] ✓ VRM loaded (skeleton only)');

    return { userData: { vrm }, scene: vrm.scene };
  }
}
