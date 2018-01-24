"use strict";

const THREE = require("three");
const utils = require("./utils");

const fl = fastlane;

const startBufferSize = 10;
const orangeColorbrew = [
    0xfff5eb, 0xfee6ce, 0xfdd0a2, 0xfdae6b, 0xfd8d3c, 0xf16913, 0xd94801, 0xa63603, 0x7f2704
];

function convertLookup(input = orangeColorbrew) {
    const colorLookup = new Float32Array(input.length * 3);
    let index = 0;
    input.forEach(color => {
        colorLookup[index + 0] = ((color & 0xFF0000) >> 16) / 255.0;
        colorLookup[index + 1] = ((color & 0x00FF00) >> 8) / 255.0;
        colorLookup[index + 2] = ((color & 0x0000FF)) / 255.0;
        index += 3;
    });
    return colorLookup;
}

class BasinManager {
    constructor({
        sphericalMapping = true,
        scaleHeight = 0.04
    } = {}) {
        this._sphericalMapping = sphericalMapping;
        this._basins = new Map();
        this._buffers = {
            position: new Float32Array(startBufferSize * 3),
            normal: new Float32Array(startBufferSize * 3),
            color: new Float32Array(startBufferSize * 3),
            visibility: new Float32Array(startBufferSize),
            value: new Float32Array(startBufferSize),
            realvalue: new Float32Array(startBufferSize),
            index: new Uint32Array(startBufferSize * 3),
            id: new Float32Array(startBufferSize * 3)
        };
        this._currentVertex = 0;
        this._currentIndex = 0;

        this._flNode = new fl.Node({
            operator: new fl.Operator({
                name: "displacement",
                evaluate: function evaluate(env) {
                    var position = new Array(env.size);
                    var color = new Array(env.size);
                    var visibility = new Array(env.size);
                    for (var i = 0; i < env.size; ++i) {
                        var s = (env.value[i] / env.maxValue) * env.scaleHeight;
                        position[i] = env.normal[i].mul(s).add(env.position[i]);
                        var x = env.realvalue[i] / env.maxValue;
                        if (env.color[i].x < 0) {
                            color[i] = env.colorLookup[Math.floor(x * (env.colorLookup.length - 1))];
                        } else {
                            color[i] = env.color[i]
                        }
                        visibility[i] = env.visibility[i];
                    }

                    return {
                        position: position,
                        color: color,
                        visibility: visibility
                    }
                }
            })
        });

        this._flNode.setField("position", new fl.Buffer(fl.Types.vec3, this._buffers.position));
        this._flNode.setField("normal", new fl.Buffer(fl.Types.vec3, this._buffers.normal));
        this._flNode.setField("color", new fl.Buffer(fl.Types.vec3, this._buffers.color));
        this._flNode.setField("visibility", new fl.Buffer(fl.Types.float32, this._buffers.visibility));
        this._flNode.setField("index", new fl.Buffer(fl.Types.int32, this._buffers.index));
        this._flNode.setField("size", new fl.Buffer(fl.Types.int32, new Int32Array([this._currentVertex])));
        this._flNode.setField("value", new fl.Buffer(fl.Types.float32, this._buffers.value));
        this._flNode.setField("realvalue", new fl.Buffer(fl.Types.float32, this._buffers.realvalue));
        this._flNode.setField("id", new fl.Buffer(fl.Types.vec3, this._buffers.id));
        this._flNode.setField("maxValue", new fl.Buffer(fl.Types.float32, [1]));
        this._flNode.setField("scaleHeight", new fl.Buffer(fl.Types.float32, [1]));
        this._flNode.setField("colorLookup", new fl.Buffer(fl.Types.vec3, convertLookup()));
        this._flNode.fields.get("scaleHeight").set(0, scaleHeight);
        this._startFastlaneEvaluation();

        this._geometry = new THREE.BufferGeometry();
        this._basinMaterial = new THREE.ShaderMaterial({
            side: THREE.DoubleSide,
            vertexShader: `
attribute vec3 color;
attribute float visibility;
varying vec4 vcolor;

void main() {
    vcolor = vec4(color, visibility);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,
            fragmentShader: `
varying vec4 vcolor;
void main() {
    if (vcolor.a < 0.9)
        discard;
    gl_FragColor = vec4(vcolor.rgb, 1.0);
}
`,
            transparent: true
        });
        this._mesh = new THREE.Mesh(this._geometry, this._basinMaterial);
    }

    get mesh() {
        return this._mesh;
    }

    set sphericalMapping(enable) {
        this._sphericalMapping = enable;
        this._remapBuffer();
    }

    get sphericalMapping() {
        return this._sphericalMapping;
    }

    set scaleHeight(height) {
        this._flNode.fields.get("scaleHeight").set(0, Math.max(0.001, height));
    }

    get scaleHeight() {
        return this._flNode.fields.get("scaleHeight").get(0);
    }

    set colorLookup(colorLookup) {
        this._flNode.setField("colorLookup", new fl.Buffer(fl.Types.vec3, convertLookup(colorLookup)));
    }

    reset() {
        this._buffers = {
            position: new Float32Array(startBufferSize * 3),
            normal: new Float32Array(startBufferSize * 3),
            color: new Float32Array(startBufferSize * 3),
            visibility: new Float32Array(startBufferSize),
            value: new Float32Array(startBufferSize),
            realvalue: new Float32Array(startBufferSize),
            index: new Uint32Array(startBufferSize * 3),
            id: new Float32Array(startBufferSize * 3)
        };
        this._currentVertex = 0;
        this._currentIndex = 0;
        this._basins.clear();
    }

    getBasin(id) {
        const basinInfo = this._basins.get(id);
        if (basinInfo) {
            const geometry = new THREE.BufferGeometry();
            geometry.addAttribute("position", this._geometry.attributes.position);
            geometry.addAttribute("normal", this._geometry.attributes.normal);
            geometry.setIndex(this._geometry.index);
            geometry.drawRange.start = basinInfo.indexStart;
            geometry.drawRange.count = basinInfo.indexEnd - basinInfo.indexStart;
            const height = (this._buffers.value[basinInfo.topStart] / this._flNode.fields.get("maxValue").get(0)) * this.scaleHeight + 0.01;
            return {
                value: this._buffers.value[basinInfo.topStart],
                height: height,
                geometry: geometry,
                center: basinInfo.center,
                id: id
            }
        }
    }

    basins() {
        return [...this._basins.values()];
    }

    add(basin) {
        // ids start at 0 but we want them to start at 1
        // because glsl uses 0 as default value for undefined attributes
        const basinId = basin.id + 1;
        this._basins.set(basinId, {
            indexStart: this._currentIndex,
            indexEnd: this._currentIndex + basin.geometry.index.length,
            vertexStart: this._currentVertex,
            vertexEnd: this._currentVertex + basin.geometry.position.length / 3,
            topStart: this._currentVertex + basin.geometry.topVerticesStartIndex,
            center: basin.center
        });
        const id = new Float32Array(basin.geometry.position.length);
        const idColor = new Float32Array([
            ((basinId & 0xFF0000) >> 16) / 255.0,
            ((basinId & 0x00FF00) >> 8) / 255.0,
            ((basinId & 0x0000FF)) / 255.0
        ]);
        for (let i = 0; i < id.length; i += 3) {
            id[i + 0] = idColor[0];
            id[i + 1] = idColor[1];
            id[i + 2] = idColor[2];
        }

        this._addGeometry({
            position: Float32Array.from(basin.geometry.position),
            normal: Float32Array.from(basin.geometry.normal),
            index: Float32Array.from(basin.geometry.index),
            color: new Float32Array(basin.geometry.position.length).fill(0),
            value: new Float32Array(basin.geometry.position.length / 3).fill(0),
            realvalue: new Float32Array(basin.geometry.position.length / 3).fill(0),
            visibility: new Float32Array(basin.geometry.position.length / 3).fill(0),
            id: id
        });
    }

    updateBasinValues(newValues, colorValues) {
        let maxValue = 0.1;
        this._basins.forEach((basinInfo, id) => {
            const value = newValues[id - 1];
            const color = colorValues ? colorValues[id - 1] : undefined;
            if (value === undefined) {
                for (let i = basinInfo.vertexStart; i < basinInfo.vertexEnd; ++i) {
                    this._buffers.visibility[i] = 0;
                    if (i < basinInfo.topStart) {
                        this._buffers.value[i] = 0;
                    } else {
                        this._buffers.value[i] = 0.1;
                    }

                    if (color !== undefined) {
                        this._buffers.color[i * 3 + 0] = ((color & 0xFF0000) >> 16) / 255.0;
                        this._buffers.color[i * 3 + 1] = ((color & 0x00FF00) >> 8) / 255.0;
                        this._buffers.color[i * 3 + 2] = ((color & 0x0000FF)) / 255.0;
                    } else {
                        this._buffers.color[i * 3 + 0] = -1;
                    }
                }
            } else {
                maxValue = Math.max(maxValue, value);
                for (let i = basinInfo.vertexStart; i < basinInfo.vertexEnd; ++i) {
                    if (i < basinInfo.topStart) {
                        this._buffers.value[i] = 0;
                    } else {
                        this._buffers.value[i] = value;
                    }
                    this._buffers.realvalue[i] = value;
                    this._buffers.visibility[i] = 1;

                    if (color !== undefined) {
                        this._buffers.color[i * 3 + 0] = ((color & 0xFF0000) >> 16) / 255.0;
                        this._buffers.color[i * 3 + 1] = ((color & 0x00FF00) >> 8) / 255.0;
                        this._buffers.color[i * 3 + 2] = ((color & 0x0000FF)) / 255.0;
                    } else {
                        this._buffers.color[i * 3 + 0] = -1;
                    }
                }
            }
        });

        this._flNode.fields.get("value")._ndarray.data = this._buffers.value;
        this._flNode.fields.get("color")._ndarray.data = this._buffers.color;
        this._flNode.fields.get("realvalue")._ndarray.data = this._buffers.realvalue;
        this._flNode.fields.get("visibility")._ndarray.data = this._buffers.visibility;
        this._flNode.fields.get("maxValue").set(0, maxValue);
    }

    _addGeometry(geometry) {
        if (!this._canFit(geometry))
            this._growBuffersToFit(geometry);

        for (let name in this._buffers) {
            if (!geometry[name])
                throw new Error(`Basin geometry has to have ${name} buffer`);

            // index needs special handling
            if (name === "index") {
                this._buffers.index.set(geometry.index, this._currentIndex);
                for (let i = 0; i < geometry.index.length; ++i)
                    this._buffers.index[this._currentIndex + i] += this._currentVertex;
            } else {
                const buffer = this._buffers[name];
                buffer.set(geometry[name], this._currentVertex * this._flNode.fields.get(name).type.size);
            }
        }

        this._currentIndex += geometry.index.length;
        this._currentVertex += geometry.position.length / 3;

        this._flNode.fields.get("size").set(0, this._currentVertex);

        this._geometry.setDrawRange(0, this._currentIndex);
    }

    _canFit(geometry) {
        if (this._currentVertex * 3 + geometry.position.length > this._buffers.position.length)
            return false;

        if (this._currentIndex + geometry.index.length > this._buffers.index.length)
            return false;

        return true;
    }

    _growBuffersToFit(geometry) {
        for (let name in this._buffers) {
            if (!geometry[name])
                throw new Error(`Basin geometry has to have ${name} buffer`);
            this._buffers[name] = grownBuffer(this._buffers[name], geometry[name].length);
            //todo: need a better way for this in fastlane
            if (this._flNode.fields.has(name))
                this._flNode.fields.get(name)._ndarray.data = this._buffers[name];
        }
    }

    _startFastlaneEvaluation() {
        const program = this._flNode.createProgramToCompute(Object.keys(this._buffers), {
            forcePlatform: "cpu",
            useSIMD: false,
            benchmark: false
        });

        this._result = new fl.ComputeRequest(program);
        this._onNewData = data => this._updateMesh(data);
        this._result.on("value", this._onNewData);
        this._result.on("error", error => {
            console.error(error)
        });
        this._result.once("invalid", () => {
            this._result.removeListener("value", this._onNewData);
            this._startFastlaneEvaluation();
        });
    }

    _updateMesh(data) {
        this._running = Promise.resolve(data).then(result => {
            for (let name in result) {
                if (this._geometry.attributes[name]) {
                    const attribute = this._geometry.getAttribute(name);
                    attribute.setArray(result[name].data);
                    attribute.needsUpdate = true;
                } else {
                    const attribute = new THREE.BufferAttribute(result[name].data, result[name].type.size);
                    if (name === "index")
                        this._geometry.setIndex(attribute);
                    else
                        this._geometry.addAttribute(name, attribute);
                }
            }
            this._geometry.computeBoundingSphere();
        });
    }

    _remapBuffer() {
        const positions = this._buffers.position;
        const normals = this._buffers.normal;

        utils.remapVertexBuffer(positions, normals, this._sphericalMapping);

        this._flNode.fields.get("maxValue").set(0, this._flNode.fields.get("maxValue").get(0));
    }

}

exports = module.exports = BasinManager;

function grownBuffer(buffer, sizeToGrow) {
    const newBuffer = new buffer.constructor(Math.ceil((buffer.length + sizeToGrow) * 1.5));
    newBuffer.set(buffer);
    return newBuffer;
}