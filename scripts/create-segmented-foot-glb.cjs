/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, __dirname, Buffer, console */

const fs = require("fs");
const path = require("path");

const sourcePath = path.resolve(__dirname, "../public/models/podo360-foot-textured.glb");
const backupPath = path.resolve(__dirname, "../public/models/podo360-foot-original-backup.glb");
const outputPath = path.resolve(__dirname, "../public/models/podo360-foot-segmented.glb");

const regions = [
  ["hallux", [-0.7, -0.33, 0.18], [0.12, 0.16, 0.12]],
  ["second_toe", [-0.74, -0.16, 0.18], [0.1, 0.11, 0.11]],
  ["third_toe", [-0.75, 0, 0.18], [0.1, 0.11, 0.11]],
  ["fourth_toe", [-0.72, 0.16, 0.17], [0.1, 0.11, 0.1]],
  ["fifth_toe", [-0.65, 0.32, 0.14], [0.1, 0.12, 0.1]],
  ["hallux_nail", [-0.77, -0.33, 0.32], [0.07, 0.12, 0.05]],
  ["second_toe_nail", [-0.79, -0.16, 0.31], [0.06, 0.08, 0.05]],
  ["third_toe_nail", [-0.79, 0, 0.31], [0.06, 0.08, 0.05]],
  ["fourth_toe_nail", [-0.76, 0.16, 0.3], [0.06, 0.08, 0.05]],
  ["fifth_toe_nail", [-0.7, 0.31, 0.27], [0.06, 0.08, 0.05]],
  ["first_metatarsal_head", [-0.42, -0.34, 0.02], [0.12, 0.12, 0.1]],
  ["second_metatarsal_head", [-0.46, -0.17, 0.01], [0.11, 0.11, 0.1]],
  ["third_metatarsal_head", [-0.47, 0, 0], [0.11, 0.11, 0.1]],
  ["fourth_metatarsal_head", [-0.46, 0.17, 0.01], [0.11, 0.11, 0.1]],
  ["fifth_metatarsal_head", [-0.4, 0.34, 0.02], [0.12, 0.12, 0.1]],
  ["metatarsal_region", [-0.32, 0, -0.02], [0.16, 0.34, 0.12]],
  ["medial_arch", [0.02, -0.34, -0.1], [0.22, 0.14, 0.12]],
  ["lateral_arch", [0.02, 0.34, -0.1], [0.22, 0.14, 0.12]],
  ["plantar_heel", [0.52, 0, -0.1], [0.22, 0.34, 0.14]],
  ["medial_plantar_border", [-0.02, -0.53, 0], [0.38, 0.08, 0.12]],
  ["lateral_plantar_border", [-0.02, 0.53, 0], [0.38, 0.08, 0.12]],
  ["dorsal_forefoot", [-0.42, 0, 0.36], [0.2, 0.36, 0.1]],
  ["dorsal_midfoot", [-0.02, 0, 0.38], [0.24, 0.34, 0.1]],
  ["calcaneus", [0.6, 0, 0.14], [0.14, 0.28, 0.16]],
  ["medial_ankle", [0.72, -0.28, 0.42], [0.1, 0.12, 0.16]],
  ["lateral_ankle", [0.72, 0.28, 0.42], [0.1, 0.12, 0.16]]
];

function align4(value) {
  return (value + 3) & ~3;
}

function readGlb(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.toString("utf8", 0, 4) !== "glTF") throw new Error("Arquivo nao e GLB valido.");
  const length = buffer.readUInt32LE(8);
  let offset = 12;
  let json = null;
  let bin = Buffer.alloc(0);

  while (offset < length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.toString("utf8", offset + 4, offset + 8);
    const chunk = buffer.subarray(offset + 8, offset + 8 + chunkLength);
    if (chunkType === "JSON") json = JSON.parse(chunk.toString("utf8").trim());
    if (chunkType === "BIN\0") bin = Buffer.from(chunk);
    offset += 8 + chunkLength;
  }

  if (!json) throw new Error("Chunk JSON nao encontrado.");
  return { json, bin };
}

function createZoneGeometry() {
  const positions = [
    -1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1,
    -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1
  ];
  const indices = [
    0, 1, 2, 0, 2, 3,
    4, 6, 5, 4, 7, 6,
    0, 4, 5, 0, 5, 1,
    3, 2, 6, 3, 6, 7,
    1, 5, 6, 1, 6, 2,
    0, 3, 7, 0, 7, 4
  ];

  const positionBuffer = Buffer.alloc(positions.length * 4);
  positions.forEach((value, index) => positionBuffer.writeFloatLE(value, index * 4));

  const indexBuffer = Buffer.alloc(indices.length * 2);
  indices.forEach((value, index) => indexBuffer.writeUInt16LE(value, index * 2));

  return { positionBuffer, indexBuffer, vertexCount: positions.length / 3, indexCount: indices.length };
}

function writeGlb(json, bin, filePath) {
  const jsonBufferRaw = Buffer.from(JSON.stringify(json));
  const jsonLength = align4(jsonBufferRaw.length);
  const jsonBuffer = Buffer.concat([jsonBufferRaw, Buffer.alloc(jsonLength - jsonBufferRaw.length, 0x20)]);
  const binLength = align4(bin.length);
  const binBuffer = Buffer.concat([bin, Buffer.alloc(binLength - bin.length)]);
  const totalLength = 12 + 8 + jsonBuffer.length + 8 + binBuffer.length;
  const header = Buffer.alloc(12);
  header.write("glTF", 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBuffer.length, 0);
  jsonHeader.write("JSON", 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binBuffer.length, 0);
  binHeader.write("BIN\0", 4);
  fs.writeFileSync(filePath, Buffer.concat([header, jsonHeader, jsonBuffer, binHeader, binBuffer]));
}

if (!fs.existsSync(sourcePath)) throw new Error(`GLB de origem nao encontrado: ${sourcePath}`);
if (!fs.existsSync(backupPath)) fs.copyFileSync(sourcePath, backupPath);

const { json, bin } = readGlb(sourcePath);
const geometry = createZoneGeometry();
const zoneBinOffset = align4(bin.length);
const paddedBin = Buffer.concat([bin, Buffer.alloc(zoneBinOffset - bin.length)]);
const positionOffset = zoneBinOffset;
const indexOffset = align4(positionOffset + geometry.positionBuffer.length);
const newBin = Buffer.concat([
  paddedBin,
  geometry.positionBuffer,
  Buffer.alloc(indexOffset - positionOffset - geometry.positionBuffer.length),
  geometry.indexBuffer
]);

json.buffers = json.buffers || [{ byteLength: 0 }];
json.bufferViews = json.bufferViews || [];
json.accessors = json.accessors || [];
json.materials = json.materials || [];
json.meshes = json.meshes || [];
json.nodes = json.nodes || [];
json.scenes = json.scenes || [{ nodes: [] }];
json.scenes[json.scene || 0].nodes = json.scenes[json.scene || 0].nodes || [];
json.buffers[0].byteLength = newBin.length;

const positionViewIndex = json.bufferViews.push({
  buffer: 0,
  byteOffset: positionOffset,
  byteLength: geometry.positionBuffer.length,
  byteStride: 12,
  target: 34962
}) - 1;
const indexViewIndex = json.bufferViews.push({
  buffer: 0,
  byteOffset: indexOffset,
  byteLength: geometry.indexBuffer.length,
  target: 34963
}) - 1;
const positionAccessorIndex = json.accessors.push({
  bufferView: positionViewIndex,
  byteOffset: 0,
  componentType: 5126,
  count: geometry.vertexCount,
  type: "VEC3",
  min: [-1, -1, -1],
  max: [1, 1, 1]
}) - 1;
const indexAccessorIndex = json.accessors.push({
  bufferView: indexViewIndex,
  byteOffset: 0,
  componentType: 5123,
  count: geometry.indexCount,
  type: "SCALAR",
  min: [0],
  max: [7]
}) - 1;
const materialIndex = json.materials.push({
  name: "podo360_click_zone_invisible",
  alphaMode: "BLEND",
  doubleSided: true,
  pbrMetallicRoughness: {
    baseColorFactor: [0, 0.85, 1, 0],
    metallicFactor: 0,
    roughnessFactor: 1
  },
  extras: {
    podo360InvisibleClickZone: true
  }
}) - 1;
const meshIndex = json.meshes.push({
  name: "podo360_click_zone_shared_mesh",
  primitives: [{
    attributes: { POSITION: positionAccessorIndex },
    indices: indexAccessorIndex,
    material: materialIndex,
    mode: 4
  }]
}) - 1;

for (const side of ["right", "left"]) {
  for (const [baseKey, position, scale] of regions) {
    const nodeName = `${side}_${baseKey}`;
    const nodeIndex = json.nodes.push({
      name: nodeName,
      mesh: meshIndex,
      translation: position,
      scale,
      extras: {
        podo360ClickZone: true,
        regionKey: nodeName,
        footSide: side
      }
    }) - 1;
    json.scenes[json.scene || 0].nodes.push(nodeIndex);
  }
}

json.asset = json.asset || { version: "2.0" };
json.asset.generator = `${json.asset.generator || "unknown"} + Podo360 segmented click zones`;

writeGlb(json, newBin, outputPath);

console.log(JSON.stringify({
  sourcePath,
  backupPath,
  outputPath,
  originalMeshes: (json.meshes.length - 1),
  clickZoneNodes: regions.length * 2,
  outputBytes: fs.statSync(outputPath).size
}, null, 2));
