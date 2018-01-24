"use strict";

const THREE = require("three");
const Transitions = require("./transitions");
const utils = require("./utils");
const Curve = require("./curve");

class PolylineTransitions extends Transitions {
    constructor(transitions, options) {
        super(transitions, options);
        this._frameNumber = 0;
    }

    build() {
        const curves = [];
        let length = 0;

        this._transitions.forEach(transition => {
            const curve = Curve.createCurve(transition.from, transition.to, {
                height: this._height,
                sampleCount: this._maxSegments,
                sphericalMapping: this._sphericalMapping
            });
            transition.frameNumber = 0;
            transition.speed = Math.random() * (2.0 - 1.0) + 1.0;
            transition.hideCurve = false;
            length += curve.length;
            curves.push(curve);
        });

        this._buildMaterial();
        this._buildPolylineMesh(curves, length);
    }

    update() {
        if (this._animate) {
            this._transitions.forEach((transition, index) => {
                if (!this._transitions[index].hideCurve) {
                    this._visibility.fill(0.0, transition.startIndex, transition.endIndex);
                    const position = transition.frameNumber % (transition.length * 2);
                    const from = Math.max(transition.startIndex, transition.startIndex + position - transition.length);
                    const to = Math.min(transition.startIndex + position, transition.startIndex + transition.length);
                    this._visibility.fill(1.0, from, to);
                    transition.frameNumber += transition.speed;
                }
            });
            this._polylineMesh.geometry.attributes.visibility.needsUpdate = true;
        }
    }

    dispose() {
        this._polylineMesh.geometry.dispose();
        this._polylineMesh.material.dispose();
        this._mesh.remove(this._polylineMesh);
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

    _buildMaterial() {
        this._polylineMaterial = new THREE.ShaderMaterial({
            uniforms: {
                transitionColor: {
                    value: this._color
                }
            },
            side: THREE.DoubleSide,
            vertexShader: `
attribute float visibility;
varying float vvisibility;

void main() {
  vvisibility = visibility;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}

`,
            fragmentShader: `
varying float vvisibility;
uniform vec3 transitionColor;

void main() {
  if (vvisibility < 0.9)
      discard;
  gl_FragColor = vec4(transitionColor, 0.5);
}
`,
            transparent: true
        });
    }

    _buildPolylineMesh(curves, length) {
        // clean this up
        const positions = new Float32Array(length * 3 * 2);
        const normals = new Float32Array(length * 3 * 2);
        const indices = new Uint32Array(length * 3 * 2);
        this._visibility = new Float32Array(length * 2);

        let index = 0;
        let offset = 0;
        let indicesOffset = 0;

        curves.forEach((curve, curveIndex) => {
            for (let n = 0; n < curve.length; ++n) {
                const position = curve.getPosition(n);
                const tangent1 = curve.getTangent(n);
                const tangent2 = curve.getTangent(n < curve.length - 1 ?
                    n + 1 :
                    n - 1);

                const width = 0.001 + Math.pow((this._transitions[curveIndex].weight / this._maxValue), 0.5) * this._calculateWidth(tangent1, tangent2);

                //hide very small lines
                if (width < 0.0015) {
                    this._transitions[curveIndex].hideCurve = true;
                }

                const normal = position.clone()
                    .normalize();
                const binormal = new THREE.Vector3()
                    .crossVectors(tangent1, normal)
                    .normalize();
                const offsetLeft = binormal.clone()
                    .multiplyScalar(width / 2);
                const offsetRight = binormal.clone()
                    .multiplyScalar(-width / 2);
                const positionLeft = new THREE.Vector3()
                    .addVectors(position, offsetLeft);
                const positionRight = new THREE.Vector3()
                    .addVectors(position, offsetRight);

                positions[index + 0] = positionLeft.x;
                positions[index + 1] = positionLeft.y;
                positions[index + 2] = positionLeft.z;
                positions[index + 3] = positionRight.x;
                positions[index + 4] = positionRight.y;
                positions[index + 5] = positionRight.z;

                normals[index + 0] = normal.x;
                normals[index + 1] = normal.y;
                normals[index + 2] = normal.z;

                normals[index + 3] = normal.x;
                normals[index + 4] = normal.y;
                normals[index + 5] = normal.z;

                index += 6;
            }

            const startIndex = indicesOffset;
            const endIndex = indicesOffset + curve.length * 2;
            const length = endIndex - startIndex;
            this._transitions[curveIndex].startIndex = startIndex;
            this._transitions[curveIndex].endIndex = endIndex;
            this._transitions[curveIndex].length = length;

            for (let n = 0; n < curve.length * 2 - 2; n += 2) {
                indices[offset + 0] = n + indicesOffset + 2;
                indices[offset + 1] = n + indicesOffset + 1;
                indices[offset + 2] = n + indicesOffset + 0;

                indices[offset + 3] = n + indicesOffset + 1;
                indices[offset + 4] = n + indicesOffset + 2;
                indices[offset + 5] = n + indicesOffset + 3;

                this._visibility[offset + 0] = (this._animate | this._transitions[curveIndex].hideCurve) ? 0.0 : 1.0;
                this._visibility[offset + 1] = (this._animate | this._transitions[curveIndex].hideCurve) ? 0.0 : 1.0;
                this._visibility[offset + 2] = (this._animate | this._transitions[curveIndex].hideCurve) ? 0.0 : 1.0;
                this._visibility[offset + 3] = (this._animate | this._transitions[curveIndex].hideCurve) ? 0.0 : 1.0;
                this._visibility[offset + 4] = (this._animate | this._transitions[curveIndex].hideCurve) ? 0.0 : 1.0;
                this._visibility[offset + 5] = (this._animate | this._transitions[curveIndex].hideCurve) ? 0.0 : 1.0;

                offset += 6;
            }

            indicesOffset += curve.length * 2;
        });

        const geometry = new THREE.BufferGeometry();
        geometry.addAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.addAttribute("normal", new THREE.BufferAttribute(normals, 3));
        geometry.addAttribute("visibility", new THREE.BufferAttribute(this._visibility, 1)
            .setDynamic(true));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));

        this._polylineMesh = new THREE.Mesh(geometry, this._polylineMaterial);
        this._mesh.add(this._polylineMesh);
    }
}

module.exports = PolylineTransitions;
