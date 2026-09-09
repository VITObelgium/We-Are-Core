//
// Copyright 2024 VITO
//

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pkg = require("./package.json");
import typescript from "rollup-plugin-typescript2";

export default {
    input: {
        main: "./src/index.ts",
        browser: "./src/index-browser.ts"
    },
    output: [
        {
            dir: "dist",
            entryFileNames: "[name].mjs",
            format: "esm",
            preserveModules: true,
            sourcemap: true
        },
        {
            dir: "dist",
            entryFileNames: "[name].js",
            format: "cjs",
            preserveModules: true,
            sourcemap: true
        }
    ],
    plugins: [
        typescript({
            // Use our own version of TypeScript, rather than the one bundled with the plugin:
            typescript: require("typescript"),
            // Workaround for rollup-plugin-typescript2's default include glob no longer matching
            // .ts files with picomatch >=2.3.2 (see https://github.com/ezolenko/rollup-plugin-typescript2/issues/480)
            include: ["**/*.ts{,x}", "**/*.cts", "**/*.mts"]
        })
    ],
    external: [...Object.keys(pkg.dependencies)],
};