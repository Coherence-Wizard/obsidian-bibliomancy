import esbuild from 'esbuild';
await esbuild.build({
    entryPoints: ['src/main.mjs'],
    bundle: true,
    external: ['obsidian'],
    format: 'cjs',
    platform: 'browser',
    target: 'es2018',
    outfile: 'main.js',
    minify: false,
    sourcemap: false,
    banner: { js: '/* Bibliomancy (Atmospheric Noise) | MIT License | Source: src/ */' }
});
