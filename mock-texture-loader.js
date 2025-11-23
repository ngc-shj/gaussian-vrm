// Mock texture loader for Node.js - immediately resolves texture loading
import * as THREE from 'three';

// Mock ImageLoader
THREE.ImageLoader.prototype.load = function(url, onLoad, onProgress, onError) {
  console.log('[Mock ImageLoader] Loading:', url.substring(0, 60));

  // Create a simple 1x1 pixel canvas as mock image
  const canvas = {
    width: 1,
    height: 1,
    getContext: () => null
  };

  // Immediately call onLoad with mock canvas
  setTimeout(() => {
    if (onLoad) {
      console.log('[Mock ImageLoader] Calling onLoad for:', url.substring(0, 40));
      onLoad(canvas);
    }
  }, 0);

  return canvas;
};

// Mock TextureLoader to return empty textures immediately
THREE.TextureLoader.prototype.load = function(url, onLoad, onProgress, onError) {
  console.log('[Mock TextureLoader] Loading:', url.substring(0, 60));

  // Create a minimal mock texture
  const texture = new THREE.Texture();
  texture.image = {
    width: 1,
    height: 1,
    data: new Uint8Array([255, 255, 255, 255])
  };
  texture.needsUpdate = true;

  // Immediately call onLoad
  setTimeout(() => {
    if (onLoad) {
      console.log('[Mock TextureLoader] Calling onLoad');
      onLoad(texture);
    }
  }, 0);

  return texture;
};

console.log('✓ THREE.ImageLoader and TextureLoader mocked for CLI mode');
