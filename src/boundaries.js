"use strict";

const THREE = require("three");
const utils = require("./utils");

class Boundaries {
    constructor(sphericalMapping = true) {
        this._curves = [];
        this._width = 0.005;
        this._sphericalMapping = sphericalMapping;
    }

    load(url) {
        return fetch("resources/countries.geojson")
            .then(response => response.json())
            .then(data => {
                const curves = [];
                data.features.forEach(country => {
                    const positions = [];
                    country.geometry.coordinates.forEach(coordinate => {
                        positions.push(utils.mapWgs84(this._sphericalMapping, coordinate[1], coordinate[0], 1.001));
                    });
                    curves.push(positions);
                });

                this._createBoundaries(curves);
                return this._mesh;
            });
    }

    _calculateWidth(tangent1, tangent2) {
        let width = this._width;
        const dot = Math.abs(Math.acos(tangent1.dot(tangent2)));
        if (dot > Math.PI / 4) {
            tangent1.sub(tangent2)
                .normalize();
            width /= dot;
        }
        return width;
    }

    _createBoundaries(curves) {
        const geometry = new THREE.BufferGeometry();
        const visibility = [];
        const positions = [];
        const indices = [];
        const normals = [];
        let index = 0;
        let offset = 0;
        let indicesOffset = 0;

        curves.forEach(coordinates => {
            for (let n = 0; n < coordinates.length; ++n) {
                const left = n === 0 ?
                    0 :
                    n - 1;
                const right = n === coordinates.length - 1 ?
                    n :
                    n + 1;
                const position1 = new THREE.Vector3()
                    .fromArray(coordinates[n + 0]);
                const position2 = new THREE.Vector3()
                    .fromArray(coordinates[right]);
                const position3 = new THREE.Vector3()
                    .fromArray(coordinates[left]);

                let tangent = undefined;
                let width = this._width;

                tangent = new THREE.Vector3()
                    .subVectors(position2, position1)
                    .normalize();
                const tangent2 = new THREE.Vector3()
                    .subVectors(position3, position1)
                    .normalize();

                const dot = Math.abs(Math.acos(tangent.dot(tangent2)));
                if (dot > Math.PI / 4) {
                    tangent.sub(tangent2)
                        .normalize();
                    width /= dot;
                }

                utils.calculateOffsetVectors(position1, tangent, width, positions, normals);
            }

            for (let n = 0; n < coordinates.length * 2 - 2; n += 2) {
                indices[offset + 0] = n + indicesOffset + 2;
                indices[offset + 1] = n + indicesOffset + 1;
                indices[offset + 2] = n + indicesOffset + 0;

                indices[offset + 3] = n + indicesOffset + 1;
                indices[offset + 4] = n + indicesOffset + 2;
                indices[offset + 5] = n + indicesOffset + 3;

                visibility[offset + 0] = 1.0;
                visibility[offset + 1] = 1.0;
                visibility[offset + 2] = 1.0;
                visibility[offset + 3] = 1.0;
                visibility[offset + 4] = 1.0;
                visibility[offset + 5] = 1.0;

                offset += 6;
            }

            indicesOffset += coordinates.length * 2;
        });

        geometry.addAttribute("position", new THREE.BufferAttribute(Float32Array.from(positions), 3));
        geometry.addAttribute("normal", new THREE.BufferAttribute(Float32Array.from(normals), 3));
        geometry.addAttribute("visibility", new THREE.BufferAttribute(Float32Array.from(visibility), 1));
        geometry.setIndex(new THREE.BufferAttribute(Uint16Array.from(indices), 1));
        this._mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
            color: 0xffffff,
            depthTest: false,
            depthWrite: false,
            transparent: true
        }));
    }

    set sphericalMapping(sphericalMapping) {
        if (this._sphericalMapping !== sphericalMapping) {
            this._sphericalMapping = sphericalMapping;
            if (this._mesh) {
                const position = this._mesh.geometry.attributes.position.array;
                const normal = this._mesh.geometry.attributes.normal.array;

                utils.remapVertexBuffer(position, normal, this._sphericalMapping);

                this._mesh.geometry.attributes.position.needsUpdate = true;
                this._mesh.geometry.attributes.normal.needsUpdate = true;
            }
        }
    }

    get mesh() {
        return this._mesh;
    }
};

module.exports = Boundaries;
