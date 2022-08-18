# Emerald Block's shapez mods

_they exist now!_

This mod development environment aims to be similar to coding in shapez itself, while still following the structure of a mod. It features import syntax for shapez globals and support for Sass files, as well as TypeScript and shapez typings. However, there is no automatic class extension, CSS registering, etc.; you are still in full control of what your mod does.

This is based on [dengr1065's mod development environment](https://github.com/dengr1065/shapez-mods). It uses webpack to bundle, and thanks to hacky aliases and a hacky regex, shapez imports are super convenient!

## Setup

Replace `[shapez.io]` in the `*.template.*` files (for [`config.js`](./config.js) and [`tsconfig.json`](./tsconfig.json)) with your shapez source directory and rename.

## Usage

Mods are contained in subfolders of [`src/`](./src/). The entry point is `index.ts` or `index.js`, and metadata should be in `meta.js` (for the banner comment in the built mod).
Build with `npm run build`, which will build to [`build/`](./build/).

Importing from shapez can be done like `"shapez.io/translations.js"`. Note it resolves `shapez.io` straight to `[shapez.io]/src/js/`. These are converted to destructuring from the global `window.shapez`.
Likewise, Sass imports can be done like `"shapez.io/mixins.scss"`, resolving straight to `[shapez.io]/src/css/`. These actually import shapez files, since Sass features are transpiled at build time.

TypeScript imports should be extensionless, so that both TypeScript and webpack can process them.
If shapez typings are incomplete for something, it's recommended to augment them in [`src/typings.d.ts`](./src/typings.d.ts).

See my mods for example usage.

## Issues

* Mod class extension type augmentations bleed across mods.
* You can't build just a specific mod.
* Since some shapez mixin files also include CSS declarations, importing those will lead to registering duplicate CSS declarations.
