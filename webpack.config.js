import url from "url";
import path from "path";
import process from "process";
import fs from "fs/promises";

import webpack from "webpack";
import TerserPlugin from "terser-webpack-plugin";

process.chdir(path.dirname(url.fileURLToPath(import.meta.url)));

const entry = Object.fromEntries((await fs.readdir("./src/", { withFileTypes: true }))
    .filter(dirent => dirent.isDirectory())
    .map(dirent => [dirent.name, path.resolve("./src", dirent.name, "./index.js")]));

export default {
    entry,
    output: {
        path: path.resolve(process.cwd(), "./build/"),
        filename: "[name].js",
        clean: {
            dry: true,
        },
    },
    mode: "production",
    optimization: {
        minimizer: [new TerserPlugin({ extractComments: false })],
    },
    plugins: [
        new webpack.BannerPlugin("source at https://github.com/EmeraldBlock/shapez.io-mods"),
    ]
};
