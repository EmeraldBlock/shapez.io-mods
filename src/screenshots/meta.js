export default {
    website: "https://emeraldblock.github.io/",
    author: "Emerald Block",
    name: "Superb Screenshots",
    version: "0.1.1",
    id: "screenshots",
    description: "Fixes and improves screenshots, plus new features",
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
            "0.1.1": [
                "Added icon",
                "Edited readme",
            ],
            "0.1.0": [
                "Initial release",
                "Make screenshots match ingame camera",
                "Allow selecting screenshot region",
                "Add quality, map view, wires layer, and transparent background options",
            ],
        },
        source: "https://github.com/EmeraldBlock/shapez.io-mods",
        readme: `<p>Screenshots are buggy and broken! This mod fixes them (and makes them better).</p>
<p>No more disappearing buildings. No more glitched items. And no more off-centered pixel distribution!</p>
<p>Take screenshots of select regions of your base the same way you select blueprints. Say goodbye to image stitching!</p>
<p>Plus, now you can make map view screenshots! Or take one with a transparent background! You can even choose image quality! All with a fancy new screenshot dialog.</p>
<p>This mod makes the screenshot code exactly match your ingame view. So change your game settings, and your screenshots will change to match!</p>
<p>Yes, this used to be a <a href="https://github.com/tobspr/shapez.io/pull/1192" target="_blank">pull request</a> into the game itself, which has sat unclosed for over a year :( Here's the full fixes/changes/additions list, though!</p>
<h3>Fixes</h3>
<ul>
    <li>Fixes buildings not rendering where the camera is.</li>
    <li>Fixes item acceptors not processing their animations when taking a screenshot from map view.</li>
    <li>Fixes the hub not rendering.</li>
    <li>Fixes belt items not rendering.</li>
</ul>
<h3>Changes</h3>
<ul>
    <li>Shrinks the size of keybindings in dialogs (this also affects already-existing dialogs).</li>
    <li>Changes the formatting of the toggle switch dialog form option.</li>
    <li>Adds a 1-chunk border around base screenshots.</li>
    <li>Changes the rendering code to mimic the game rendering code.</li>
</ul>
<h3>Additions</h3>
<ul>
    <li>Adds multiple target resolutions for screenshots.</li>
    <li>Adds the ability to select a region (either the current mouse selection or the selected buildings) to take a screenshot of it.</li>
    <li>Adds the ability to take a screenshot in map view.</li>
    <li>Adds the ability to take a screenshot of the wires layer.</li>
    <li>Adds the ability to take a screenshot with a transparent background.</li>
    <li>Adds a toggle switch list dialog form option.</li>
    <li>Adds a cycle button dialog form option.</li>
    <li>Adds the ability to close the screenshot dialog with the key used to open it.</li>
</ul>
`,
    },
};
