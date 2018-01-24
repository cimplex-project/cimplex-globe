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

    vertexShader: ["varying vec2 vUv;", "void main() {", "vUv = uv;", "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );", "}"].join("\n"),

    fragmentShader: [

        "uniform sampler2D tDiffuse;",
        "varying vec2 vUv;",

        "uniform vec2 size;",
        "uniform float filter;",
        "uniform float cameraNear;",
        "uniform float cameraFar;",

        "#include <packing>",

        "float getViewZ( const in float depth ) {",
        "return perspectiveDepthToViewZ( depth, cameraNear, cameraFar );",
        "}",

        "float getDepth( const in vec2 screenPosition ) {",
        "return unpackRGBAToDepth( texture2D( tDiffuse, screenPosition ) );",
        "}",

        "void main(void)",
        "{",

        "float x = 1.0 / size.x;",
        "float y = 1.0 / size.y;",
        "float horizEdge = 0.0;",
        "horizEdge -= getViewZ( getDepth( vec2( vUv.x - x, vUv.y - y ) ) ) * 1.0;",
        "horizEdge -= getViewZ( getDepth( vec2( vUv.x - x, vUv.y     ) ) ) * 2.0;",
        "horizEdge -= getViewZ( getDepth( vec2( vUv.x - x, vUv.y + y ) ) ) * 1.0;",
        "horizEdge += getViewZ( getDepth( vec2( vUv.x + x, vUv.y - y ) ) ) * 1.0;",
        "horizEdge += getViewZ( getDepth( vec2( vUv.x + x, vUv.y     ) ) ) * 2.0;",
        "horizEdge += getViewZ( getDepth( vec2( vUv.x + x, vUv.y + y ) ) ) * 1.0;",
        "float vertEdge = 0.0;",
        "vertEdge -= getViewZ( getDepth( vec2( vUv.x - x, vUv.y - y ) ) ) * 1.0;",
        "vertEdge -= getViewZ( getDepth( vec2( vUv.x    , vUv.y - y ) ) ) * 2.0;",
        "vertEdge -= getViewZ( getDepth( vec2( vUv.x + x, vUv.y - y ) ) ) * 1.0;",
        "vertEdge += getViewZ( getDepth( vec2( vUv.x - x, vUv.y + y ) ) ) * 1.0;",
        "vertEdge += getViewZ( getDepth( vec2( vUv.x    , vUv.y + y ) ) ) * 2.0;",
        "vertEdge += getViewZ( getDepth( vec2( vUv.x + x, vUv.y + y ) ) ) * 1.0;",
        "float e = sqrt((horizEdge * horizEdge) + (vertEdge * vertEdge));",
        "gl_FragColor = vec4(vec3(1.0 - e * 20.0), 1.0);",
        "}"
    ].join("\n")
};
