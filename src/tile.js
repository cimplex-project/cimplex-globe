"use strict";

const THREE = require("three");
const utils = require("./utils");

const textureLoader = new THREE.TextureLoader();
textureLoader.crossOrigin = "";

class Tile {
    constructor(provider, level, x, y, parent = undefined, {
        materialFactory = undefined,
        radius = 1,
        sphericalMapping = true
    } = {}) {
        this._provider = provider;
        this._level = level;
        this._x = x;
        this._y = y;
        this._radius = radius;
        this._parent = parent;
        this._rectangle = this._provider.getTile(this._level, x, y);
        this._boundingBox = this._rectangle.computeBoundigBox();
        this._samples = this._rectangle.sample();
        this._topleft = undefined;
        this._topright = undefined;
        this._bottomleft = undefined;
        this._bottomright = undefined;
        this._hasSubtiles = false;
        this._childMeshesReady = false;
        this._tileMeshAdded = false;
        this._materialFactory = materialFactory;
        this.sphericalMapping = sphericalMapping;
    }

    _createMaterial(resolve, reject) {
        const material = new THREE.MeshBasicMaterial({
            color: 0x000000,
        });
        const tileURL = this._provider.getTileURL(this._level, this._x, this._y);
        if (tileURL) {
            textureLoader.load(tileURL, texture => {
                material.map = texture;
                material.map.generateMipmaps = false;
                material.map.magFilter = THREE.LinearFilter;
                material.map.minFilter = THREE.LinearFilter;
                material.map.flipY = false;
                material.map.needsUpdate = true;
                material.color.setHex(0xFFFFFF);
                material.needsUpdate = true;
                resolve(this);
            });
        } else {
            resolve(this);
        }
        return material;
    }

    _addMesh(group) {
        if (this._mesh) {
            group.add(this._mesh);
            this._meshAdded = true;
        }
    }

    _removeMesh(group) {
        if (this._mesh) {
            group.remove(this._mesh);
            this._meshAdded = false;
        }
    }

    _removeSubtiles(level, group) {
        if (this._hasSubtiles) {
            this._topleft._removeMesh(group);
            this._topright._removeMesh(group);
            this._bottomleft._removeMesh(group);
            this._bottomright._removeMesh(group);

            this._topleft._removeSubtiles(level, group);
            this._topright._removeSubtiles(level, group);
            this._bottomleft._removeSubtiles(level, group);
            this._bottomright._removeSubtiles(level, group);
        }
    }

    _createSubtile(offsetX = 0, offsetY = 0) {
        return new Tile(this._provider, this._level + 1, this._x * 2 + offsetX, this._y * 2 + offsetY, this, {
            materialFactory: this._materialFactory,
            radius: this._radius,
            sphericalMapping: this._sphericalMapping
        });
    }

    createMesh() {
        return new Promise((resolve, reject) => {
            if (this._mesh) {
                resolve(this);
            } else {
                const geometry = createPlaneGeometryFromMercator(this._rectangle.west, this._rectangle.south, this._rectangle.width, this._rectangle.height, this._radius, 8, this._sphericalMapping);
                let material = undefined;
                if (this._materialFactory === undefined) {
                    material = this._createMaterial(resolve, reject);
                } else {
                    material = this._materialFactory(this);
                    resolve(this);
                }
                this._mesh = new THREE.Mesh(geometry, material);
            }
        });
    }

    createSubtiles() {
        this._hasSubtiles = true;
        this._topleft = this._createSubtile(0, 0);
        this._topright = this._createSubtile(1, 0);
        this._bottomleft = this._createSubtile(0, 1);
        this._bottomright = this._createSubtile(1, 1);

        const promises = [this._topleft.createMesh(), this._topright.createMesh(), this._bottomleft.createMesh(), this._bottomright.createMesh()];
        Promise.all(promises).then(values => {
            this._childMeshesReady = true;
        });
    }

    traverse(occluder, level, group) {
        const translatedsamples = [];
        this._samples.forEach((sample, index) => {
            translatedsamples.push(sample.clone().applyMatrix4(group.matrixWorld));
        });

        if (!occluder.isOccluded(translatedsamples)) {
            // current level reached
            if (level === this._level) {
                // if this mesh is already loaded; show it
                if (this._mesh && !this._meshAdded && !this.parent._meshAdded) {
                    this._addMesh(group);
                }

                // if this tile has any subtiles, delete them
                this._removeSubtiles(level, group);
            } else {
                // if children are ready remove mesh of this tile
                if (this._childMeshesReady && this._meshAdded) {
                    this._removeMesh(group);
                }

                if (this._level < level && !this._hasSubtiles) {
                    this.createSubtiles();
                }

                if (this._hasSubtiles) {
                    this._topleft.traverse(occluder, level, group);
                    this._topright.traverse(occluder, level, group);
                    this._bottomleft.traverse(occluder, level, group);
                    this._bottomright.traverse(occluder, level, group);
                }
            }
        } else {
            this._removeMesh(group);
            if (this._hasSubtiles) {
                this._topleft.traverse(occluder, level, group);
                this._topright.traverse(occluder, level, group);
                this._bottomleft.traverse(occluder, level, group);
                this._bottomright.traverse(occluder, level, group);
            }
        }
    }

    refetchTiles() {
        if (this._mesh) {
            const material = this._mesh.material;
            const tileURL = this._provider.getTileURL(this._level, this._x, this._y);
            if (tileURL) {
                material.map = textureLoader.load(tileURL, texture => {
                    material.map = texture;
                    material.map.magFilter = THREE.LinearFilter;
                    material.map.minFilter = THREE.LinearFilter;
                    material.map.flipY = false;
                    material.map.needsUpdate = true;
                    material.color.setHex(0xFFFFFF);
                    material.needsUpdate = true;
                });
            }
        }

        if (this._hasSubtiles) {
            this._topleft.refetchTiles();
            this._topright.refetchTiles();
            this._bottomleft.refetchTiles();
            this._bottomright.refetchTiles();
        }
    }

    get parent() {
        return this._parent;
    }

    get level() {
        return this._level;
    }

    get mesh() {
        return this._mesh;
    }

    set sphericalMapping(enable) {
        this._sphericalMapping = enable;

        if (this._hasSubtiles) {
            this._topleft.sphericalMapping = enable;
            this._topright.sphericalMapping = enable;
            this._bottomleft.sphericalMapping = enable;
            this._bottomright.sphericalMapping = enable;
        }

        if (this._mesh) {
            this._mesh.geometry.dispose();
            this._mesh.geometry = createPlaneGeometryFromMercator(this._rectangle.west, this._rectangle.south, this._rectangle.width, this._rectangle.height, this._radius, 8, this._sphericalMapping);
        }
    }

    get sphericalMapping() {
        return this._sphericalMapping;
    }
}

module.exports = Tile;

function createPlaneGeometryFromMercator(x, y, width, height, radius = 1, segments = 16, sphericalMapping = true) {
    const geometry = new THREE.BufferGeometry();
    const segmentWidthSize = width / segments;
    const segmentHeightSize = height / segments;
    const maxLatitude = utils.mercatorYToLat(y < 0 ?
        y :
        y + height);
    const additionalSegment = Math.abs(maxLatitude) >= utils.degrees(utils.maximumLatitude) ?
        1 :
        0;
    const gridX1 = segments + 1;
    const gridY1 = segments + 1 + additionalSegment;
    const vertices = new Float32Array(gridX1 * gridY1 * 3);
    const normals = new Float32Array(gridX1 * gridY1 * 3);
    const uvs = new Float32Array(gridX1 * gridY1 * 2);
    const visibility = new Float32Array(gridX1 * gridY1);

    let offset = 0;
    let offsetUV = 0;

    // calc top pole if necessary
    if (additionalSegment > 0 && maxLatitude < 0) {
        for (let segmentX = 0; segmentX <= segments; ++segmentX) {
            const spherical = utils.mapWgs84(sphericalMapping, -90, 0, radius);
            vertices[offset + 0] = spherical[0];
            vertices[offset + 1] = spherical[1];
            vertices[offset + 2] = spherical[2];

            normals[offset + 0] = spherical[0];
            normals[offset + 1] = spherical[1];
            normals[offset + 2] = spherical[2];

            uvs[offsetUV + 0] = (segmentX / segments);
            uvs[offsetUV + 1] = 1.0;

            offset += 3
            offsetUV += 2
        }
    }

    // calc tile
    for (let segmentY = 0; segmentY <= segments; ++segmentY) {
        for (let segmentX = 0; segmentX <= segments; ++segmentX) {
            const wsg84 = utils.mercatorToWgs84({
                x: x + segmentWidthSize * segmentX,
                y: y + segmentHeightSize * segmentY
            });
            const spherical = utils.mapWgs84(sphericalMapping, wsg84.lat, wsg84.lon, radius);

            vertices[offset + 0] = spherical[0];
            vertices[offset + 1] = spherical[1];
            vertices[offset + 2] = spherical[2];

            normals[offset + 0] = spherical[0];
            normals[offset + 1] = spherical[1];
            normals[offset + 2] = spherical[2];

            uvs[offsetUV] = (segmentX / segments);
            uvs[offsetUV + 1] = 1.0 - (segmentY / segments);

            offset += 3
            offsetUV += 2
        }
    }

    // calc top pole if necessary
    if (additionalSegment > 0 && maxLatitude > 0) {
        for (let segmentX = 0; segmentX <= segments; ++segmentX) {
            const spherical = utils.mapWgs84(sphericalMapping, 90, 0, radius);
            vertices[offset + 0] = spherical[0];
            vertices[offset + 1] = spherical[1];
            vertices[offset + 2] = spherical[2];

            normals[offset + 0] = spherical[0];
            normals[offset + 1] = spherical[1];
            normals[offset + 2] = spherical[2];

            uvs[offsetUV + 0] = (segmentX / segments);
            uvs[offsetUV + 1] = 0.0;

            offset += 3
            offsetUV += 2
        }
    }

    offset = 0;

    // from threejs planebuffergeometry
    const indices = new((vertices.length / 3) > 65535 ?
        Uint32Array :
        Uint16Array)((gridX1 - 1) * (gridY1 - 1) * 6);
    for (let iy = 0; iy < gridY1 - 1; iy++) {
        for (let ix = 0; ix < gridX1 - 1; ix++) {
            const a = ix + gridX1 * iy;
            const b = ix + gridX1 * (iy + 1);
            const c = (ix + 1) + gridX1 * (iy + 1);
            const d = (ix + 1) + gridX1 * iy;

            indices[offset] = d;
            indices[offset + 1] = b;
            indices[offset + 2] = a;

            indices[offset + 3] = d;
            indices[offset + 4] = c;
            indices[offset + 5] = b;

            visibility[offset + 0] = 1;
            visibility[offset + 1] = 1;
            visibility[offset + 2] = 1;
            visibility[offset + 3] = 1;
            visibility[offset + 4] = 1;
            visibility[offset + 5] = 1;

            offset += 6;
        }
    }

    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.addAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geometry.addAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geometry.addAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geometry.addAttribute("visibility", new THREE.BufferAttribute(visibility, 1));
    return geometry;
}