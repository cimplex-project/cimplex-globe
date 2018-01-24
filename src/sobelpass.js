"use strict";

const THREE = require("three");
const SobelShader = require("./sobelshader");
const DepthMaterial = require("./depthmaterial");

class SobelPass {
    constructor(renderer) {
        this._renderer = renderer;
        this._currentSize = new THREE.Vector2(this._renderer.getSize().width, this._renderer.getSize().height);
        this._renderTarget = new THREE.WebGLRenderTarget(this._currentSize.width, this._currentSize.height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            stencilBuffer: false
        });

        this._uniforms = THREE.UniformsUtils.clone(SobelShader.uniforms);
        this._material = new THREE.ShaderMaterial({
            defines: SobelShader.defines || {},
            uniforms: this._uniforms,
            vertexShader: SobelShader.vertexShader,
            fragmentShader: SobelShader.fragmentShader,
            blending: THREE.MultiplyBlending,
            transparent: true,
            premultipliedAlpha: true
        });

        this._depthMaterial = new THREE.ShaderMaterial({
            side: THREE.DoubleSide,
            vertexShader: DepthMaterial.vertexShader,
            fragmentShader: DepthMaterial.fragmentShader
        });
        this._depthMaterial.depthPacking = THREE.RGBADepthPacking;
        this._depthMaterial.blending = THREE.NoBlending;

        this._clearColor = new THREE.Color(0x000000);
        this._clearColorAlpha = 1;

        this._camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this._scene = new THREE.Scene();
        this._quad = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), null);
        this._scene.add(this._quad);
    }

    _update(scene, camera) {
        const size = new THREE.Vector2(this._renderer.getSize().width, this._renderer.getSize().height);
        if (!size.equals(this._currentSize)) {
            this._renderTarget.setSize(size.x, size.y);
            this._currentSize = size;
        }
    }

    _renderSobel() {
        this._uniforms["tDiffuse"].value = this._renderTarget.texture;
        this._uniforms["size"].value = this._currentSize;
        this._quad.material = this._material;

        this._renderer.render(this._scene, this._camera, null, true);
    }

    render(scene, camera) {
        this._update(scene, camera);

        const oldClearColor = this._renderer.getClearColor().getHex();
        const oldClearAlpha = this._renderer.getClearAlpha();

        this._renderer.autoClearColor = true;
        this._renderer.autoClearDepth = true;
        this._renderer.autoClearStencil = true;

        scene.overrideMaterial = this._depthMaterial;
        this._renderer.render(scene, camera, this._renderTarget, null, false);
        scene.overrideMaterial = null;

        this._renderer.autoClearColor = false;
        this._renderer.autoClearDepth = false;
        this._renderer.autoClearStencil = false;

        this._renderSobel();
    }
};

module.exports = SobelPass;