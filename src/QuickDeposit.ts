import { Plugin, SettingsTypes } from "@ryelite/core";
import { ContextMenuManager } from "@ryelite/core";

const ITEM_ACTION_DEPOSIT = 9;
const ITEM_ACTION_WITHDRAW = 7;
const ITEM_ACTION_WITHDRAW_IOU = 8;
const ITEM_ACTION_CREATE = 16;

// When the IOU toggle is on in the bank, the framework swaps action 7 for action 8.
// We don't know which is active up front, so we accept either.
const WITHDRAW_ACTIONS = [ITEM_ACTION_WITHDRAW, ITEM_ACTION_WITHDRAW_IOU];
const DEPOSIT_ACTIONS = [ITEM_ACTION_DEPOSIT];
const CREATE_ACTIONS = [ITEM_ACTION_CREATE];

const AMOUNT_OFF = "Off";
const AMOUNT_LABEL_X_MEMORY = "X (last used)";
const DEPOSIT_AMOUNT_OPTIONS = [AMOUNT_OFF, "1", "5", "10", "100", "All"];
const WITHDRAW_AMOUNT_OPTIONS = [AMOUNT_OFF, "1", "5", "10", "100", AMOUNT_LABEL_X_MEMORY, "All", "All But One"];
const BREW_AMOUNT_OPTIONS = [AMOUNT_OFF, "1", "5", "10", "All"];
const CRAFT_AMOUNT_OPTIONS = [AMOUNT_OFF, "1", "5", "10", "All"];
const SMELT_AMOUNT_OPTIONS = [AMOUNT_OFF, "1", "5", "10", "All"];
const SMITH_AMOUNT_OPTIONS = [AMOUNT_OFF, "1", "5", "10", "All"];

const SLOT_SELECTOR = ".hs-inventory-item";
const INVENTORY_TABLE_SELECTOR = ".hs-item-table--inventory";
const BANK_TABLE_SELECTOR = ".hs-item-table--bank";
const BANK_MENU_ID = "hs-bank-menu";
const CREATE_PANEL_SELECTOR = ".hs-createable-item-panel";
const CREATE_MENU_SELECTOR = ".hs-create-items-menu";
const CREATE_MENU_TITLE_SELECTOR = ".hs-menu-header__title";

type CreateContext = "brew" | "craft" | "smelt" | "smith";

export default class QuickDeposit extends Plugin {
    pluginName = "Quick Deposit";
    author = "matter";
    contextMenuManager: ContextMenuManager = new ContextMenuManager();

    private hookInstalled = false;
    private pointerListener: ((e: PointerEvent) => void) | null = null;

    private inSyntheticFlow = false;
    private syntheticActions: number[] | null = null;
    private syntheticAmount: string | null = null;
    private capturedContainer: HTMLElement | null = null;

    constructor() {
        super();

        this.settings.leftClickActionHeader = {
            text: "Left click action",
            type: SettingsTypes.info,
            value: "Left click action",
            callback: () => {},
        };

        this.settings.depositAmount = {
            text: "Inventory",
            type: SettingsTypes.combobox,
            value: AMOUNT_OFF,
            options: DEPOSIT_AMOUNT_OPTIONS,
            callback: () => {},
        };

        this.settings.withdrawAmount = {
            text: "Bank",
            type: SettingsTypes.combobox,
            value: AMOUNT_OFF,
            options: WITHDRAW_AMOUNT_OPTIONS,
            callback: () => {},
        };

        this.settings.brewAmount = {
            text: "Brewing",
            type: SettingsTypes.combobox,
            value: AMOUNT_OFF,
            options: BREW_AMOUNT_OPTIONS,
            callback: () => {},
        };

        this.settings.craftAmount = {
            text: "Crafting",
            type: SettingsTypes.combobox,
            value: AMOUNT_OFF,
            options: CRAFT_AMOUNT_OPTIONS,
            callback: () => {},
        };

        this.settings.smeltAmount = {
            text: "Smelting",
            type: SettingsTypes.combobox,
            value: AMOUNT_OFF,
            options: SMELT_AMOUNT_OPTIONS,
            callback: () => {},
        };

        this.settings.smithAmount = {
            text: "Smithing",
            type: SettingsTypes.combobox,
            value: AMOUNT_OFF,
            options: SMITH_AMOUNT_OPTIONS,
            callback: () => {},
        };
    }

    init(): void {
        this.log("Initialized");
    }

    start(): void {
        this.log("Started");
        this.installMenuHook();
        this.installPointerListener();
        this.injectHeaderStyle();
    }

    /**
     * The framework's `info`-type setting renders as a centered blue banner with
     * an icon, hard-coded with inline styles. We override those inline styles with
     * `!important` CSS to make our header look like a subtle left-aligned subtitle.
     */
    private injectHeaderStyle(): void {
        const STYLE_ID = "qd-header-style";
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
/* Strip the row's themed box (background, border, shadow). */
#highlite-settings-content-row-leftClickActionHeader {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    padding: 12px 4px 0 4px !important;
    transition: none !important;
}
/* Strip the framework's blue info-banner box. */
#highlite-settings-content-row-leftClickActionHeader > div {
    padding: 0 !important;
    border: none !important;
    background: transparent !important;
    border-radius: 0 !important;
    text-align: left !important;
    box-shadow: none !important;
    gap: 0 !important;
}
/* Make the title a quiet bold subtitle. */
#highlite-settings-content-row-leftClickActionHeader > div > div:first-child {
    font-weight: 700 !important;
    font-size: 20px !important;
    color: #d0d0d0 !important;
    margin: 0 !important;
    padding: 0 !important;
    text-align: left !important;
}
/* Hide the empty description div the framework appends. */
#highlite-settings-content-row-leftClickActionHeader > div > div:last-child {
    display: none !important;
}
        `;
        document.head.appendChild(style);
    }

    stop(): void {
        this.log("Stopped");
        this.removePointerListener();
    }

    private resolveAmount(label: string): string | null {
        if (label === AMOUNT_OFF) return null;
        if (label === AMOUNT_LABEL_X_MEMORY) return "XMemory";
        return label;
    }

    private depositAmount(): string | null {
        return this.resolveAmount(String(this.settings.depositAmount?.value ?? AMOUNT_OFF));
    }

    private withdrawAmount(): string | null {
        return this.resolveAmount(String(this.settings.withdrawAmount?.value ?? AMOUNT_OFF));
    }

    private brewAmount(): string | null {
        return this.resolveAmount(String(this.settings.brewAmount?.value ?? AMOUNT_OFF));
    }

    private craftAmount(): string | null {
        return this.resolveAmount(String(this.settings.craftAmount?.value ?? AMOUNT_OFF));
    }

    private smeltAmount(): string | null {
        return this.resolveAmount(String(this.settings.smeltAmount?.value ?? AMOUNT_OFF));
    }

    private smithAmount(): string | null {
        return this.resolveAmount(String(this.settings.smithAmount?.value ?? AMOUNT_OFF));
    }

    private getCreateAmount(context: CreateContext): string | null {
        switch (context) {
            case "brew": return this.brewAmount();
            case "craft": return this.craftAmount();
            case "smelt": return this.smeltAmount();
            case "smith": return this.smithAmount();
        }
    }

    /** Read the open create-items menu's header to decide which context we're in. */
    private detectCreateContext(): CreateContext | null {
        const menu = document.querySelector(CREATE_MENU_SELECTOR);
        if (!menu) return null;
        const title = menu.querySelector(CREATE_MENU_TITLE_SELECTOR)?.textContent?.trim() ?? "";
        if (/brew/i.test(title)) return "brew";
        if (/smelt/i.test(title)) return "smelt";
        if (/smith/i.test(title)) return "smith";
        if (/craft/i.test(title)) return "craft"; // covers both kiln and the crafting table
        return null;
    }

    private installMenuHook() {
        if (this.hookInstalled) return;
        const self = this;

        this.contextMenuManager.registerContextHook(
            "ContextMenuItemManager",
            "_createInventoryItemContextMenuItems",
            function (_args: any, result: any) {
                if (
                    !Array.isArray(result) ||
                    !self.inSyntheticFlow ||
                    !self.syntheticActions ||
                    !self.syntheticAmount
                ) {
                    return result;
                }
                const actions = self.syntheticActions;
                const target = result.find(
                    (it: any) =>
                        it &&
                        actions.indexOf(it._itemAction) !== -1 &&
                        it._itemActionAmount === self.syntheticAmount
                );
                if (target && target._container) {
                    self.capturedContainer = target._container as HTMLElement;
                }
                return result;
            }
        );

        this.hookInstalled = true;
    }

    private installPointerListener() {
        if (this.pointerListener) return;

        const handler = (e: PointerEvent) => {
            if (this.inSyntheticFlow) return;
            if (e.button !== 0) return;
            if (!this.settings.enable?.value) return;

            const target = (e.target as HTMLElement | null) ?? null;

            // Create-items menu (brewing / kiln / crafting table / smelting / smithing).
            // The slot class only exists while one of those windows is open, and the
            // window's header text tells us which one — so we can gate the intercept
            // *before* dispatching anything, avoiding the brief menu flash.
            const createPanelEl = target?.closest(CREATE_PANEL_SELECTOR) as HTMLElement | null;
            if (createPanelEl) {
                const context = this.detectCreateContext();
                if (!context) return;
                const amount = this.getCreateAmount(context);
                if (!amount) return;
                e.preventDefault();
                e.stopPropagation();
                this.runSyntheticFlow(createPanelEl, CREATE_ACTIONS, amount).catch((err) =>
                    this.error("Quick action failed:", err)
                );
                return;
            }

            const slotEl = target?.closest(SLOT_SELECTOR) as HTMLElement | null;
            if (!slotEl) return;

            const isInventorySlot = !!slotEl.closest(INVENTORY_TABLE_SELECTOR);
            const isBankSlot = !!slotEl.closest(BANK_TABLE_SELECTOR);
            if (!isInventorySlot && !isBankSlot) return;

            // Only act on inventory slots when the bank UI is actually open — otherwise
            // left-click should fall through to the game's default (Use, Offer, etc.).
            // Bank slots only exist while the bank is open, so no check needed there.
            if (isInventorySlot && !document.getElementById(BANK_MENU_ID)) return;

            const amount = isInventorySlot ? this.depositAmount() : this.withdrawAmount();
            if (!amount) return;

            e.preventDefault();
            e.stopPropagation();

            const actions = isInventorySlot ? DEPOSIT_ACTIONS : WITHDRAW_ACTIONS;
            this.runSyntheticFlow(slotEl, actions, amount).catch((err) =>
                this.error("Quick action failed:", err)
            );
        };

        this.pointerListener = handler;
        document.addEventListener("pointerdown", handler, true);
    }

    private removePointerListener() {
        if (this.pointerListener) {
            document.removeEventListener("pointerdown", this.pointerListener, true);
            this.pointerListener = null;
        }
    }

    private async runSyntheticFlow(
        slotEl: HTMLElement,
        actions: number[],
        amount: string
    ): Promise<void> {
        this.inSyntheticFlow = true;
        this.syntheticActions = actions;
        this.syntheticAmount = amount;
        this.capturedContainer = null;

        try {
            this.synthesizePointer(slotEl, /* button */ 2);
            await new Promise((r) => requestAnimationFrame(r));

            const container = this.capturedContainer;
            if (!container) {
                this.log(`No menu item matched amount "${amount}" for that slot.`);
                return;
            }

            this.synthesizePointer(container, /* button */ 0);
        } finally {
            queueMicrotask(() => {
                this.inSyntheticFlow = false;
                this.syntheticActions = null;
                this.syntheticAmount = null;
                this.capturedContainer = null;
            });
        }
    }

    private synthesizePointer(el: HTMLElement, button: 0 | 2): void {
        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const buttonsDown = button === 0 ? 1 : 2;
        const common = {
            clientX: x,
            clientY: y,
            bubbles: true,
            cancelable: true,
            pointerType: "mouse",
            isPrimary: true,
        };
        el.dispatchEvent(
            new PointerEvent("pointerdown", { ...common, button, buttons: buttonsDown })
        );
        el.dispatchEvent(new PointerEvent("pointerup", { ...common, button, buttons: 0 }));
    }
}
