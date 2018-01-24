"use strict";

const earcut = require("earcut");
const THREE = require("three");
const polygonCenter = require("geojson-polygon-center");
const utils = require("./utils");

class BasinLoader {
    constructor(basinManager, scaleBasins = 0.1) {
        this._basinManager = basinManager;
        this._scaleBasins = scaleBasins;
    }

    _defaultIdGeneratorbasin(basin, index) {
        return +basin.properties.CODE || index;
    }

    load(data, {
        idGenerator = this._defaultIdGeneratorbasin.bind(this),
        latlon = false
    } = {}) {
        data.features.forEach((basin, index) => {
            const geometry = basin.geometry;
            const properties = basin.properties;
            let triangulatedMeshData = null;
            let center = null;
            switch (geometry.type) {
                case "MultiPolygon":
                    triangulatedMeshData = triangulate(geometry.coordinates[0], this._basinManager.sphericalMapping, latlon);
                    center = polygonCenter(geometry.coordinates[0][0], latlon);
                    break;
                case "Polygon":
                    triangulatedMeshData = triangulate(geometry.coordinates, this._basinManager.sphericalMapping, latlon);
                    center = polygonCenter(geometry.coordinates[0], latlon);
                    break;
                default:
                    console.warn(`GeometryType ${geometry.type} not supported`);
                    break;
            }

            if (triangulatedMeshData) {
                this._basinManager.add({
                    id: idGenerator(basin, index),
                    geometry: solidify(triangulatedMeshData, this._scaleBasins),
                    center: [center.coordinates[1], center.coordinates[0]]
                });
            }
        });

        return this._basinManager;
    }
}

exports = module.exports = BasinLoader;

function triangulate(polygons, sphericalMapping = true, latlon = true) {
    const flatten = earcut.flatten(polygons);
    const index = earcut(flatten.vertices, flatten.holes, 2);
    const vertices = [];
    let normal = [];
    for (let n = 0; n < flatten.vertices.length; n += 2) {
        const mappedVertex = utils.mapWgs84(sphericalMapping, flatten.vertices[n + (latlon ? 0 : 1)], flatten.vertices[n + (latlon ? 1 : 0)])
        vertices.push(mappedVertex[0], mappedVertex[1], mappedVertex[2]);
        if (sphericalMapping) {
            normal.push(mappedVertex[0], mappedVertex[1], mappedVertex[2]);
        } else {
            normal.push(0, 0, 1);
        }
    }

    return {
        index: index,
        position: vertices,
        normal: normal
    };
}

function solidify(mesh, scaleBasin = 0.1, extrude = true, amount = 0.01) {
    const position = mesh.position;
    const normal = mesh.normal;
    const index = mesh.index;
    const oldVertexCount = position.length;

    for (let idx = 0; idx < oldVertexCount; idx += 3) {
        const x = position[idx];
        const y = position[idx + 1];
        const z = position[idx + 2];

        const nx = normal[idx];
        const ny = normal[idx + 1];
        const nz = normal[idx + 2];

        position.push(x + nx * amount);
        position.push(y + ny * amount);
        position.push(z + nz * amount);

        normal.push(nx);
        normal.push(ny);
        normal.push(nz);
    }

    const oldIndexLength = index.length;
    for (let idx = 0; idx < oldIndexLength; ++idx)
        index.push(oldVertexCount / 3 + index[idx])

    for (let idx = 0; idx < oldIndexLength; idx += 3) {
        const bottomV1Idx = index[idx];
        const bottomV2Idx = index[idx + 1];
        const bottomV3Idx = index[idx + 2];
        const topV1Idx = index[idx + oldIndexLength];
        const topV2Idx = index[idx + oldIndexLength + 1];
        const topV3Idx = index[idx + oldIndexLength + 2];

        index.push(bottomV1Idx);
        index.push(bottomV2Idx);
        index.push(topV1Idx);

        index.push(bottomV2Idx);
        index.push(topV1Idx);
        index.push(topV2Idx);

        index.push(bottomV3Idx);
        index.push(bottomV1Idx);
        index.push(topV3Idx);

        index.push(bottomV1Idx);
        index.push(topV3Idx);
        index.push(topV1Idx);

        index.push(bottomV2Idx);
        index.push(bottomV3Idx);
        index.push(topV2Idx);

        index.push(bottomV3Idx);
        index.push(topV2Idx);
        index.push(topV3Idx);
    }

    mesh.topVerticesStartIndex = oldVertexCount / 3;
    mesh.color = amount;
    return mesh;
}