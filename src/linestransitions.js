"use strict";

const THREE = require("three");
const Transitions = require("./transitions");
const utils = require("./utils");
const Curve = require("./curve");

class LinesTransitions extends Transitions {
    constructor(transitions, options) {
        super(transitions, options);
    }

    build() {
        const curves = [];
        let length = 0;
        this._transitions.forEach(transition => {
            const curve = Curve.createCurve(transition.from, transition.to, {
                sampleCount: this._maxSegments,
                sphericalMapping: this._sphericalMapping,
                height: this._height
            });
            curve.weight = transition.weight;
            length += curve.length;
            curves.push(curve);
        })

        this._buildMaterial();
        this._buildLinesMesh(curves, length);
        this._buildPointMesh();
    }

    update() {}

    dispose() {
        this._mesh.remove(this._pointMesh);
        this._mesh.remove(this._linesMesh);

        this._pointMesh.geometry.dispose();
        this._pointMesh.material.dispose();

        this._linesMesh.geometry.dispose();
        this._linesMesh.material.dispose();
    }

    _createBasinsMap() {
        const basinsMap = new Map()
        this._transitions.forEach(transition => {
            if (!basinsMap.has(transition.from.id)) {
                basinsMap.set(transition.from.id, transition.from);
            }

            if (!basinsMap.has(transition.to.id)) {
                basinsMap.set(transition.to.id, transition.to);
            }
        });
        return basinsMap;
    }

    _buildMaterial() {
        this._lineMaterial = new THREE.ShaderMaterial({
            uniforms: {
                transitionColor: {
                    value: this._color
                }
            },

            vertexShader: `
                attribute float alpha;
                varying float valpha;

                void main() {
                    valpha = alpha;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
          `,

            fragmentShader: `
              varying float valpha;
              uniform vec3 transitionColor;
              void main() {
                  gl_FragColor = vec4(transitionColor, 1.0);
              }
          `
        });
    }

    _buildPointMesh() {
        const basinsMap = this._createBasinsMap();
        const positions = new Float32Array(basinsMap.size * 3);

        let index = 0;
        for (let basin of basinsMap.values()) {
            const p = utils.mapWgs84(this._sphericalMapping, basin.center[0], basin.center[1], 1.0 + basin.height);
            positions[index++] = p[0] * 1.001;
            positions[index++] = p[1] * 1.001;
            positions[index++] = p[2] * 1.001;
        }

        const material = new THREE.PointsMaterial({
            color: 0,
            size: 5,
            transparent: false,
            sizeAttenuation: false
        });
        const geometry = new THREE.BufferGeometry();
        geometry.addAttribute("position", new THREE.BufferAttribute(positions, 3));

        this._pointMesh = new THREE.Points(geometry, material);
        this._mesh.add(this._pointMesh);
    }

    _buildLinesMesh(curves, length) {
        const positions = new Float32Array(length * 3 * 2);
        const alpha = new Float32Array(length * 2);


        let index = 0;
        let alphaIndex = 0;
        curves.forEach(curve => {
            const a = 0.01 + Math.pow((curve.weight / this._maxValue), 1 / 2.0) * 0.8;
            for (let n = 0; n < curve.length - 1; ++n) {
                const position1 = curve.getPosition(n);
                const position2 = curve.getPosition(n + 1);

                positions[index + 0] = position1.x;
                positions[index + 1] = position1.y;
                positions[index + 2] = position1.z;

                positions[index + 3] = position2.x;
                positions[index + 4] = position2.y;
                positions[index + 5] = position2.z;

                alpha[alphaIndex + 0] = a;
                alpha[alphaIndex + 1] = a;

                index += 6;
                alphaIndex += 2;
            }
        });

        const geometry = new THREE.BufferGeometry();
        geometry.addAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.addAttribute("alpha", new THREE.BufferAttribute(alpha, 1));

        this._linesMesh = new THREE.LineSegments(geometry, this._lineMaterial);
        this._mesh.add(this._linesMesh);
    }
}

module.exports = LinesTransitions;
