/*
The MIT License

Copyright © 2010-2017 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
// https://github.com/mrdoob/three.js/blob/bc7c499e5d3ddfea7b6a63fbd477ca677c11ddc1/examples/js/shaders/FreiChenShader.js

/**
 * @author zz85 / https://github.com/zz85 | https://www.lab4games.net/zz85/blog
 *
 * Edge Detection Shader using Frei-Chen filter
 * Based on http://rastergrid.com/blog/2011/01/frei-chen-edge-detector
 *
 * aspect: vec2 of (1/width, 1/height)
 */

const THREE = require("three");

module.exports = {

    uniforms: {

        "tDiffuse": {
            value: null
        },
        "size": {
            value: new THREE.Vector2(1278, 736)
        },
        "filter": {
            value: 0.0
        },
        "cameraNear": {
            type: "f",
            value: 1
        },
        "cameraFar": {
            type: "f",
            value: 10
        }
    },

    vertexShader: `
        #include <common>
        #include <uv_pars_vertex>
        #include <displacementmap_pars_vertex>
        #include <morphtarget_pars_vertex>
        #include <skinning_pars_vertex>
        #include <logdepthbuf_pars_vertex>
        #include <clipping_planes_pars_vertex>
        attribute float visibility;
        varying float vvisibility;

        void main() {

        vvisibility = visibility;

      	#include <uv_vertex>

      	#include <skinbase_vertex>

      	#include <begin_vertex>
      	#include <displacementmap_vertex>
      	#include <morphtarget_vertex>
      	#include <skinning_vertex>
      	#include <project_vertex>
      	#include <logdepthbuf_vertex>
      	#include <clipping_planes_vertex>
        }`,

    fragmentShader: `
        varying float vvisibility;

        #if DEPTH_PACKING == 3200

    	  uniform float opacity;

        #endif

        #include <common>
        #include <packing>
        #include <uv_pars_fragment>
        #include <map_pars_fragment>
        #include <alphamap_pars_fragment>
        #include <logdepthbuf_pars_fragment>
        #include <clipping_planes_pars_fragment>

        void main() {
          if (vvisibility < 0.9) {
              discard;
          }

        	#include <clipping_planes_fragment>

        	vec4 diffuseColor = vec4( 1.0 );

        	#if DEPTH_PACKING == 3200

        		diffuseColor.a = opacity;

        	#endif

        	#include <map_fragment>
        	#include <alphamap_fragment>
        	#include <alphatest_fragment>

        	#include <logdepthbuf_fragment>

        	#if DEPTH_PACKING == 3200

        		gl_FragColor = vec4( vec3( gl_FragCoord.z ), opacity );

        	#elif DEPTH_PACKING == 3201

        		gl_FragColor = packDepthToRGBA( gl_FragCoord.z );

        	#endif

        }`
};
