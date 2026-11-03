import { libWrapper } from "../libs/libWrapper.js";
import { KarmaData } from "./KarmaData.js";
import { KarmaApp } from "./KarmaDialog.js";

Hooks.once("init", () => {
	libWrapper.register("karma", "CONFIG.Dice.termTypes.DiceTerm.prototype.roll", wrapDiceTermRoll, "MIXED");
	game.settings.registerMenu("karma", "KarmaDialog", {
		name: "KARMA.Karma",
		label: "KARMA.Settings.KarmaDialog.label",
		hint: "KARMA.Settings.KarmaDialog.hint",
		icon: "fas fa-praying-hands",
		type: KarmaApp,
		restricted: true,
	});

	const { ArrayField, EmbeddedDataField } = foundry.data.fields;
	game.settings.register("karma", "configs", {
		scope: "world",
		config: false,
		type: new ArrayField(
			new EmbeddedDataField(KarmaData),
			{
				empty: false,
				initial: [{
					id: "karma".padEnd(16, "0"),
					enabled: false,
					name: "d20",
					type: "simple",
					dice: 20,
					inequality: "≤",
					history: 2,
					threshold: 7,
					floor: 13,
					nudge: 5,
					cumulative: false,
					users: {},
					allGms: true,
					allPlayers: true,
				}]
			}
		)
	});

	game.settings.register("karma", "showChatMessageIcon", {
		name: "KARMA.Settings.showChatMessageIcon.label",
		hint: "KARMA.Settings.showChatMessageIcon.hint",
		scope: "world",
		config: true,
		type: Boolean,
		default: false,
		onChange: (value) => {
			game.messages.contents
				.slice(-100)
				.filter((m) => m.rolls?.length && m.rolls.find((r) => r.terms.find((t) => t.options.karma)))
				.forEach((m) => ui.chat.updateMessage(m));
		},
	});

	game.settings.register("karma", "controlsButton", {
		name: "KARMA.Settings.controlsButton.label",
		hint: "KARMA.Settings.controlsButton.hint",
		scope: "world",
		config: true,
		type: Boolean,
		default: true,
		onChange: async () => await ui.controls.render({ reset: true }),
	});

	game.keybindings.register("karma", "openKarmDialog", {
		name: "KARMA.Settings.KarmaDialog.label",
		onDown: () => {
			new KarmaApp().render(true);
		},
		restricted: true,
	});

	CONFIG.queries["karma-disable-fudge"] = async ({ id }) => {
		const settings = foundry.utils.deepClone(game.settings.get("karma", "configs"));
		settings.find((k) => k.id === id).enabled = false;
		await game.settings.set("karma", "configs", settings);
	};
});

Hooks.on("getSceneControlButtons", (controls) => {
	if (!game.user.isGM || !game.settings.get("karma", "controlsButton")) return;
	controls.tokens.tools.karma = {
		name: "karma",
		title: "KARMA.Karma",
		icon: "fas fa-praying-hands",
		onChange: () => new KarmaApp().render(true),
		button: true,
	};
});

Hooks.on("renderChatMessage", (message, html, data) => {
	if (!game.user.isGM || !message.rolls?.length || !game.settings.get("karma", "showChatMessageIcon")) return;
	const terms = message.rolls.filter((r) => r.terms.some((t) => t.options?.karma));
	if (terms?.length) {
		const karma = terms.flatMap((entry) => entry.terms)
			.map((term) => term.options.karma)
			.filterJoin("<br>");
		const button = $(
			`<span
			data-tooltip="${karma}"
			data-tooltip-direction="LEFT">
				<i class="fas fa-praying-hands"></i>
			</span>`
		);
		html.find(".message-metadata").append(button);
	}
});

function clampHistory(history, karma) {
	if (history.length > karma.history) {
		history.splice(0, history.length - karma.history);
	}
}

/**
 * Wrapper for raw dice
 * @param {function} wrapped
 * @param {object} options
 * @returns {{result: undefined, active: boolean}|*}
 */
async function wrapDiceTermRoll(wrapped, options) {
	const karma = game.settings.get("karma", "configs");
	const roll = await wrapped(options);
	const validKarma = karma.filter((k) => k.enabled && this.faces === k.dice);
	for (const k of validKarma) {
		if (!(game.user.isGM ? k.allGms : k.allPlayers) && !k.users[game.user.id]) continue;

		const userKarma = game.user.getFlag("karma", "stats") ?? {};
		const stats = userKarma[k.id] ??= { history: [], cumulative: 0 };
		const { history } = stats;

		history.push(roll.result);
		clampHistory(history, k);

		if (!options.maximize && !options.minimize) {
			const oldRoll = roll.result;

			const ineqCheck = (a, b) => {
				switch (k.inequality) {
					case "≤": return a <= b;
					case "<": return a < b;
					case "≥": return a >= b;
					case ">": return a > b;
				}
			};

			const isLower = k.inequality === "≤" || k.inequality === "<";
			const missedTarget = (result) => isLower ? result < k.floor : result > k.floor;
			const reroll = () => {
				while (missedTarget(roll.result)) {
					roll.result = Math.ceil(CONFIG.Dice.randomUniform() * this.faces);
				}
			};

			if (k.type === "simple") {
				const isValid = history.every((result) => ineqCheck(result, k.threshold));

				if (history.length === k.history && isValid) {
					reroll();
					history.push(roll.result);
				}
				clampHistory(history, k);
			} else if (k.type === "average") {
				const average = history.reduce((sum, result) => sum + result, 0) / history.length;

				if (history.length === k.history && ineqCheck(average, k.threshold)) {
					stats.cumulative = k.cumulative ? stats.cumulative + 1 : 1;

					const nudge = stats.cumulative * k.nudge;
					roll.result = Math.clamp(roll.result + (isLower ? nudge : -nudge), 1, this.faces);
					history.push(roll.result);
				} else stats.cumulative = 0;

				clampHistory(history, k);
			} else if (k.type === "fudge" && missedTarget(roll.result)) {
				reroll();

				if (!k.recurring) {
					await game.users.activeGM.query("karma-disable-fudge", { id: k.id });
				}
			}

			if (oldRoll !== roll.result) {
				const message = game.i18n.format("KARMA.AdjustRoll", { oldRoll, newRoll: roll.result });
				if (this.options.karma) this.options.karma.push(message);
				else this.options.karma = [message];
			}

			game.user.setFlag("karma", "stats", userKarma);
			this.results[this.results.length - 1] = roll;
		}
	}
	return roll;
}
