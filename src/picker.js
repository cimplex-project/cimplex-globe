"use strict";

const THREE = require("three");

class Picker {
    constructor(size, basinManager) {
        this._basinManager = basinManager;
        this._currentSceneObjects = [];
        this._currentCamera = null;
        this._currentRenderer = null;
        this._rayCaster = new THREE.Raycaster();
        this._basinIDMaterial = new THREE.ShaderMaterial({
            side: THREE.DoubleSide,
            vertexShader: `
attribute vec3 id;
attribute float visibility;
varying vec3 vid;
varying float vvisibility;

void main() {
    vid = id;
    vvisibility = visibility;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,
            fragmentShader: `
varying vec3 vid;
varying float vvisibility;
void main() {
	if (vvisibility < 0.9)
		discard;
    gl_FragColor = vec4(vid, 1.0);
}
`,
            transparent: true
        });
        this._basinRenderTarget = new THREE.WebGLRenderTarget(size.width, size.height);
        this._pixelStorage = new Uint8Array(4);
    }

    pick(mouse) {
        if (!this._currentRenderer)
            return;
        this._currentRenderer.readRenderTargetPixels(this._basinRenderTarget, mouse.x, this._basinRenderTarget.height - mouse.y, 1, 1, this._pixelStorage);
        const id = (this._pixelStorage[0] << 16) + (this._pixelStorage[1] << 8) + this._pixelStorage[2];
        if (id > 0) {
            return this._basinManager.getBasin(id);
        } else {
            const ndcMouse = mouse.clone();
            ndcMouse.x = mouse.x / this._basinRenderTarget.width * 2 - 1;
            ndcMouse.y = -mouse.y / this._basinRenderTarget.height * 2 + 1;
            this._rayCaster.setFromCamera(ndcMouse, this._currentCamera);
            const intersections = this._rayCaster.intersectObjects(this._currentSceneObjects);
            return intersections[0];
        }
    }

    pickObject(mouse, object, recursive = true) {
        if (!this._currentRenderer)
            return;

        const ndcMouse = mouse.clone();
        ndcMouse.x = mouse.x / this._basinRenderTarget.width * 2 - 1;
        ndcMouse.y = -mouse.y / this._basinRenderTarget.height * 2 + 1;
        this._rayCaster.setFromCamera(ndcMouse, this._currentCamera);
        const intersections = this._rayCaster.intersectObject(object, recursive);
        return intersections[0];
    }

    update(renderer, scene, camera, ignore) {
        if(renderer.vr.enabled) {
            return;
        }

        const rendererSize = renderer.getSize();
        if (rendererSize.width !== this._basinRenderTarget.width || rendererSize.height !== this._basinRenderTarget.height)
            this._basinRenderTarget.setSize(rendererSize.width, rendererSize.height);
        scene.overrideMaterial = this._basinIDMaterial;
        renderer.clearTarget(this._basinRenderTarget, true, true, true);
        renderer.render(scene, camera, this._basinRenderTarget);
        scene.overrideMaterial = null;
        this._currentCamera = camera;
        this._currentRenderer = renderer;
        this._currentSceneObjects = scene.children.filter(c => c !== this._basinManager.mesh && ignore.indexOf(c) === -1);
    }
}

exports = module.exports = Picker;