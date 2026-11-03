import { KarmaData } from "./KarmaData.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
export class KarmaApp extends HandlebarsApplicationMixin(ApplicationV2) {
	static DEFAULT_OPTIONS = {
		id: "karma-config",
		actions: {
			addKarma: KarmaApp.addKarma,
			deleteKarma: KarmaApp.deleteKarma,
			markUsers: KarmaApp.markUsers,
			selectDice: KarmaApp.selectDice
		},
		form: {
			handler: KarmaApp.#onSubmit,
			closeOnSubmit: false,
			submitOnChange: true,
			submitOnClose: true,
		},
		position: {
			width: 650
		},
		tag: "form",
		window: {
			contentClasses: ["karma-config", "standard-form"],
			icon: "fas fa-praying-hands",
			title: "KARMA.Form.title",
		},
	};

	static PARTS = {
		tabs: { template: "templates/generic/tab-navigation.hbs" },
		form: { template: "modules/karma/templates/karma-config.hbs" },
		buttons: { template: "templates/generic/form-footer.hbs" }
	};

	_karma;

	get karma() {
		return this._karma ??= foundry.utils.deepClone(game.settings.get("karma", "configs"));
	}

	set karma(value) {
		this._karma = value;
	}

	tabGroups = {
		main: "0",
		...this.karma.reduce((types, _, index) => {
			types[index] = "basics";
			return types;
		}, {})
	};

	#prepareTabs() {
		return this.karma.reduce((tabs, tabData, index) => {
			const active = this.tabGroups.main === String(index);
			const { name, enabled, recurring, type } = tabData;
			const cssClass = [];
			if (enabled) cssClass.push("enabled");
			if (active) cssClass.push("active");
			if (type === "fudge" && recurring !== false) cssClass.push("recurring");
			tabs[index] = {
				id: index,
				group: "main",
				label: name,
				active,
				cssClass: cssClass.join(" "),
				data: tabData
			};
			return tabs;
		}, {});
	}

	_prepareContext() {
		this.karma.forEach((k) => {
			this.getUsers(k);
			k.example = this.getExample(k);
		});
		return {
			diceList: Object.fromEntries(
				Object.entries(CONFIG.Dice.fulfillment.dice)
					.map(([key, value]) => {
						const number = key.replace(/^d/, ""); // Remove the 'd'
						return [value.label, Number(number)];
					})
					.filter(([key, value]) => !Number.isNaN(value))
			),
			tabs: this.#prepareTabs(),
			verticalTabs: true,
			fields: KarmaData.schema.fields,
			karma: this.karma,
			buttons: [
				{ type: "submit", icon: "fa-solid fa-save", label: "SETTINGS.Save" },
				{ type: "button", action: "deleteKarma", icon: "fa-solid fa-trash", label: "KARMA.Form.DeleteKarma" },
			]
		};
	}

	static markUsers(event, target) {
		const checked = !target.classList.contains("checked");
		target.classList.toggle("checked", checked);
		const users = target.dataset.users;
		for (const element of target.closest(".form-group").querySelectorAll(`.user-picker .karma-checkbox.${users}:has(input)`)) {
			element.querySelector("input").checked = checked;
			element.querySelector("label")?.classList.toggle("checked", checked);
		}
	}

	static selectDice(event, target) {
		const checked = !target.classList.contains("checked");
		if (!checked) return;
		const dice = target.dataset.dice;
		target.closest(".form-group").querySelector("range-picker").value = dice;
	}

	/**
	 *Return an array of all users (map of id and name), defaulting to ones currently active
	 */
	getUsers(karma, activeOnly = false) {
		karma.gms = [];
		karma.players = [];
		game.users
			.filter(({ active }) => (!activeOnly || active))
			.forEach(({ id, name, isGM }) => {
				if (isGM) {
					karma.gms.push({
						id,
						name: name,
						active: Boolean(karma.users[id]) || karma.allGms
					});
				} else {
					karma.players.push({
						id,
						name: name,
						active: Boolean(karma.users[id]) || karma.allPlayers
					});
				}
			});
	}

	getExample(karma) {
		let example = "";
		const leastMost = game.i18n.localize(`KARMA.Form.${["≤", "<"].includes(karma.inequality) ? "least" : "most"}`);
		const term = game.i18n.localize(`KARMA.Form.Inequality.options.${karma.inequality}`);
		const threshold = game.i18n.format("KARMA.Form.Threshold.hint", { term, number: karma.threshold });
		const target = game.i18n.format("KARMA.Form.Floor.hint", { leastMost, number: karma.floor });
		if (karma.type === "simple") {
			const history = game.i18n.format("KARMA.Form.History.hint.simple", { number: karma.history });
			example = `${history} ${threshold} ${target}`;
		} else if (karma.type === "average") {
			const history = game.i18n.format("KARMA.Form.History.hint.average", { number: karma.history });
			let adjustment = game.i18n.format("KARMA.Form.Nudge.hint", { number: karma.nudge, threshold: karma.threshold });
			if (karma.cumulative) {
				adjustment = `${adjustment.slice(0, -1)}, ${karma.nudge * 2}, ${karma.nudge * 3}...`;
			}
			example = `${history} ${threshold} ${adjustment}`;
		} else if (karma.type === "fudge") {
			example = target.capitalize();
		}
		return example;
	}

	_onRender(context, options) {
		const a = document.createElement("a");
		a.dataset.action = "addKarma";
		a.dataset.tab = "";
		const span = document.createElement("span");
		const i = document.createElement("i");
		i.className = "far fa-plus";
		span.append(i);
		span.innerText = game.i18n.localize("KARMA.Form.AddNewKarma");
		a.append(span);

		this.element.querySelector(".sheet-tabs").append(a);
	}

	static async addKarma(event) {
		event.preventDefault();
		this.tabGroups.main = String(this.karma.length);
		const name = game.i18n.localize("KARMA.Form.NewKarma");
		this.karma.push({
			...game.settings.settings.get("karma.configs").default[0],
			name,
			id: foundry.utils.randomID(16)
		});
		this.render();
	}

	static async deleteKarma(event) {
		event.preventDefault();
		this.karma.splice(Number(this.tabGroups.main), 1);
		this.tabGroups.main = String(Number(this.tabGroups.main) - 1);
		this.render();
	}

	static async #onSubmit(event, form, formData) {
		const expandForm = foundry.utils.expandObject(formData.object);
		const config = [];
		Object.entries(expandForm).forEach(([id, karma]) => {
			const gms = Object.entries(karma?.gms ?? {});
			const players = Object.entries(karma?.players ?? {});
			karma.allGms = gms.every(([id, bool]) => bool);
			karma.allPlayers = players.every(([id, bool]) => bool);
			const users = Object.fromEntries([...gms, ...players]);

			const { floor, nudge, cumulative } = game.settings.settings.get("karma.configs").default[0];
			config.push({ floor, nudge, cumulative, users, ...karma });
		});
		this.karma = config;

		if (event.type === "submit") {
			await game.settings.set("karma", "configs", this.karma);
			this.close();
		} else this.render();
	}
}
