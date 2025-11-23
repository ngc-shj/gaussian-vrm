// Copyright (c) 2025 naruya
// Licensed under the MIT License. See LICENSE file in the project root for full license information.

// Conditional import for Node.js fs module
let fs = null;
if (typeof process !== 'undefined' && process.versions && process.versions.node) {
  fs = await import('fs');
}

export class PLYParser {
  constructor() {
    this.header = null;
    this.vertexCount = 0;
    this.properties = [];
    this.propertyTypes = new Map([
      ['char', 1], ['uchar', 1],
      ['short', 2], ['ushort', 2],
      ['int', 4], ['uint', 4],
      ['float', 4], ['double', 8]
    ]);
  }

  async parsePLY(url, showProgress) {

    let arrayBuffer;
    let totalLength;

    // Node.js environment: read file directly
    if (fs && fs.readFileSync) {
      try {
        const buffer = fs.readFileSync(url);
        arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        totalLength = arrayBuffer.byteLength;
        console.log(`[Node.js] Read PLY file: ${url} (${totalLength} bytes)`);
      } catch (error) {
        throw new Error(`Failed to read PLY file: ${error.message}`);
      }

      const data = new DataView(arrayBuffer);
      let offset = 0;

      let headerText = '';
      while (true) {
        const byte = data.getUint8(offset++);
        headerText += String.fromCharCode(byte);
        if (headerText.includes('end_header\n')) break;
      }

      const headerLines = headerText.split('\n');
      this.header = headerLines.filter(line => line.trim() !== '');

      let format = 'binary_little_endian';
      for (const line of this.header) {
        if (line.startsWith('format')) {
          format = line.split(' ')[1];
        } else if (line.startsWith('element vertex')) {
          this.vertexCount = parseInt(line.split(' ')[2]);
        } else if (line.startsWith('property')) {
          const parts = line.split(' ');
          this.properties.push({
            type: parts[1],
            name: parts[2]
          });
        }
      }

      // Log first 10 properties for debugging
      console.log(`  Properties (first 10): ${this.properties.slice(0, 10).map(p => p.name).join(', ')}`);

      const vertexSize = this.properties.reduce((size, prop) => {
        return size + this.propertyTypes.get(prop.type);
      }, 0);

      const vertices = [];
      const verticesRawData = new Uint8Array(arrayBuffer.slice(offset));

      for (let i = 0; i < this.vertexCount; i++) {
        const vertex = {
          rawData: verticesRawData.slice(i * vertexSize, (i + 1) * vertexSize)
        };

        let propertyOffset = 0;
        for (const prop of this.properties) {
          const size = this.propertyTypes.get(prop.type);
          let value;

          switch (prop.type) {
            case 'char':
              value = data.getInt8(offset + propertyOffset);
              break;
            case 'uchar':
              value = data.getUint8(offset + propertyOffset);
              break;
            case 'short':
              value = data.getInt16(offset + propertyOffset, true);
              break;
            case 'ushort':
              value = data.getUint16(offset + propertyOffset, true);
              break;
            case 'int':
              value = data.getInt32(offset + propertyOffset, true);
              break;
            case 'uint':
              value = data.getUint32(offset + propertyOffset, true);
              break;
            case 'float':
              value = data.getFloat32(offset + propertyOffset, true);
              break;
            case 'double':
              value = data.getFloat64(offset + propertyOffset, true);
              break;
          }

          vertex[prop.name] = value;
          propertyOffset += size;
        }

        // Convert SH coefficients to RGB
        const C0 = 0.28209479177387814;
        if (vertex.f_dc_0 !== undefined && vertex.f_dc_1 !== undefined && vertex.f_dc_2 !== undefined) {
          vertex.red = Math.round((vertex.f_dc_0 * C0 + 0.5) * 255);
          vertex.green = Math.round((vertex.f_dc_1 * C0 + 0.5) * 255);
          vertex.blue = Math.round((vertex.f_dc_2 * C0 + 0.5) * 255);
        }

        vertices.push(vertex);
        offset += vertexSize;

        // Debug log first vertex
        if (i === 0) {
          console.log(`  First vertex sample: x=${vertex.x}, y=${vertex.y}, z=${vertex.z}`);
        }

        // Progress logging in CLI mode (every 100k vertices)
        if (i % 100000 === 0 && i > 0) {
          const progress = (i / this.vertexCount) * 100;
          console.log(`  Parsing vertices: ${progress.toFixed(1)}%`);
        }
      }

      console.log(`  ✓ Parsed ${vertices.length} vertices`);

      return {
        header: this.header,
        vertices: vertices,
        vertexCount: this.vertexCount,
        vertexSize: vertexSize
      };
    } else {
      // Browser environment - use fetch to load PLY file
      const response = await fetch(url);
      arrayBuffer = await response.arrayBuffer();
      totalLength = arrayBuffer.byteLength;
      console.log(`[Browser] Fetched PLY file: ${url} (${totalLength} bytes)`);

      const data = new DataView(arrayBuffer);
      let offset = 0;

      // Parse header
      let headerText = '';
      while (true) {
        const byte = data.getUint8(offset++);
        headerText += String.fromCharCode(byte);
        if (headerText.includes('end_header\n')) break;
      }

      const headerLines = headerText.split('\n');
      this.header = headerLines.filter(line => line.trim() !== '');

      let format = 'binary_little_endian';
      for (const line of this.header) {
        if (line.startsWith('format')) {
          format = line.split(' ')[1];
        } else if (line.startsWith('element vertex')) {
          this.vertexCount = parseInt(line.split(' ')[2]);
        } else if (line.startsWith('property')) {
          const parts = line.split(' ');
          this.properties.push({
            type: parts[1],
            name: parts[2]
          });
        }
      }

      console.log(`  Properties (first 10): ${this.properties.slice(0, 10).map(p => p.name).join(', ')}`);

      const vertexSize = this.properties.reduce((size, prop) => {
        return size + this.propertyTypes.get(prop.type);
      }, 0);

      const vertices = [];
      const verticesRawData = new Uint8Array(arrayBuffer.slice(offset));

      for (let i = 0; i < this.vertexCount; i++) {
        const vertex = {
          rawData: verticesRawData.slice(i * vertexSize, (i + 1) * vertexSize)
        };

        let propertyOffset = 0;
        for (const prop of this.properties) {
          const size = this.propertyTypes.get(prop.type);
          let value;

          switch (prop.type) {
            case 'char':
              value = data.getInt8(offset + propertyOffset);
              break;
            case 'uchar':
              value = data.getUint8(offset + propertyOffset);
              break;
            case 'short':
              value = data.getInt16(offset + propertyOffset, true);
              break;
            case 'ushort':
              value = data.getUint16(offset + propertyOffset, true);
              break;
            case 'int':
              value = data.getInt32(offset + propertyOffset, true);
              break;
            case 'uint':
              value = data.getUint32(offset + propertyOffset, true);
              break;
            case 'float':
              value = data.getFloat32(offset + propertyOffset, true);
              break;
            case 'double':
              value = data.getFloat64(offset + propertyOffset, true);
              break;
          }

          vertex[prop.name] = value;
          propertyOffset += size;
        }

        // Convert SH coefficients to RGB
        const C0 = 0.28209479177387814;
        if (vertex.f_dc_0 !== undefined && vertex.f_dc_1 !== undefined && vertex.f_dc_2 !== undefined) {
          vertex.red = Math.round((vertex.f_dc_0 * C0 + 0.5) * 255);
          vertex.green = Math.round((vertex.f_dc_1 * C0 + 0.5) * 255);
          vertex.blue = Math.round((vertex.f_dc_2 * C0 + 0.5) * 255);
        }

        vertices.push(vertex);
        offset += vertexSize;

        // Debug log first vertex
        if (i === 0) {
          console.log(`  First vertex sample: x=${vertex.x}, y=${vertex.y}, z=${vertex.z}`);
        }

        // Progress logging in browser (every 100k vertices)
        if (showProgress && i % 100000 === 0 && i > 0) {
          const progress = (i / this.vertexCount) * 100;
          console.log(`  Parsing vertices: ${progress.toFixed(1)}%`);
        }
      }

      console.log(`  ✓ Parsed ${vertices.length} vertices`);

      return {
        header: this.header,
        vertices: vertices,
        vertexCount: this.vertexCount,
        vertexSize: vertexSize
      };
    }
  }

  createPLYFile(header, vertices, vertexSize) {
    const headerStr = header.join('\n') + '\n';
    const encoder = new TextEncoder();
    const headerArray = encoder.encode(headerStr);

    const verticesArray = new Uint8Array(vertices.length * vertexSize);
    vertices.forEach((vertex, index) => {
      verticesArray.set(vertex.rawData, index * vertexSize);
    });

    const finalArray = new Uint8Array(headerArray.length + verticesArray.length);
    finalArray.set(headerArray, 0);
    finalArray.set(verticesArray, headerArray.length);

    return finalArray;
  }

  async splitPLY(plyUrl, sceneSplatIndices) {
    const plyData = await this.parsePLY(plyUrl, false);

    const createModifiedHeader = (vertexCount) => {
      return plyData.header.map(line => {
        if (line.startsWith('element vertex')) {
          return `element vertex ${vertexCount}`;
        }
        return line;
      });
    };

    const sceneUrls = [];
    for (const [sceneIndex, indices] of Object.entries(sceneSplatIndices)) {
      const sceneVertices = indices.map(index => plyData.vertices[index]);

      const scenePlyData = this.createPLYFile(
        createModifiedHeader(sceneVertices.length),
        sceneVertices,
        plyData.vertexSize
      );

      const blob = new Blob([scenePlyData], { type: 'application/octet-stream' });
      sceneUrls.push(URL.createObjectURL(blob));
    }

    return sceneUrls;
  }
}

// Export PLYLoader as an alias for convenient usage
export class PLYLoader extends PLYParser {
  async load(url) {
    return await this.parsePLY(url, false);
  }
}