export default {
    website: "https://emeraldblock.github.io/",
    author: "Emerald Block",
    name: "Drag, don't edit!",
    version: "1.0.2",
    id: "upmouse",
    description: "Dragging the map is prioritized over triggering stuff",
    minimumGameVersion: ">=1.5.0",
    doesNotAffectSavegame: true,

    extra: {
        authors: [
            {
                name: "Emerald Block",
                icon: "https://avatars.githubusercontent.com/u/69981203",
            },
        ],
        changelog: {
            "1.0.2": [
                "Fixed signal dialog opening twice",
            ],
            "1.0.1": [
                "Fixed mod not cleaning up when exiting save",
                "Fixed triggering when placing, etc.",
            ],
            "1.0.0": [
                "Initial release",
                "Support for editing signals, toggling buttons, and interacting with markers",
            ],
        },
        source: "https://github.com/EmeraldBlock/shapez.io-mods",
        readme: `<p>Tried to drag the map but accidentally clicked on something? Fear no more!</p>
<p>This mod stops that. Instead of triggering when you press your mouse, things trigger when you release your mouse without moving.</p>
<p>This affects editing signals, toggling buttons, and interacting with markers.</p>
`,
    },
};
