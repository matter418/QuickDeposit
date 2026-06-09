# Quick Deposit

A [RyeLite](https://github.com/ash-of-the-meadow/RyeliteDesktop) plugin that lets you skip the right-click context menu in common bank and crafting interfaces. Pick the quantity you want for each system in the plugin settings, and left-clicking does that action directly instead of opening the menu.

## Supported systems

| System | What it does |
|---|---|
| **Inventory** | Left-click an item in your inventory (with the bank open) to deposit any amount. |
| **Bank** | Left-click an item in the bank to withdraw any amount. Honors the IOU toggle. |
| **Brewing** | Left-click a potion to brew any amount. |
| **Crafting** | Left-click an item at the kiln or crafting table to craft any amount. |
| **Smelting** | Left-click a bar at a furnace to smelt any amount. |
| **Smithing** | Left-click an item at an anvil to smith any amount. |

Each system has its own dropdown so you can set `Off`, `1`, `5`, `10`, `100`, `All`, `All But One`, or `X (last used)` independently. Anything set to `Off` falls through to the default game behavior — no interception, no overhead.

## Installation

The intended way to install is through RyeLite's built-in plugin hub once the plugin is published there. Open RyeLite, go to the plugins menu, find **Quick Deposit**, and enable it.

## Building from source

```bash
git clone https://github.com/matter418/QuickDeposit.git
cd QuickDeposit
yarn install
yarn build
```

The bundled output ends up at `dist/QuickDeposit.js`. To test it locally against a development copy of RyeLite, copy that file into `RyeliteDesktop/src/renderer/client/plugins/` and launch the client.

## How it works (briefly)

The plugin watches every left-click on the page. When it lands on a slot in one of the supported windows and the matching dropdown isn't `Off`, the plugin:

1. Suppresses the default left-click.
2. Synthesizes a right-click on the same slot to make the game build its context menu.
3. Reads the menu items via a registered context-menu hook, finds the one whose `_itemActionAmount` matches the configured quantity, and synthesizes a click on that item's container.
4. Cleans up. The whole sequence happens within a single animation frame and isn't visible during normal play.

## License

GPL-3.0-or-later. See [LICENSE](./LICENSE).
