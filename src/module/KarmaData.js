const { fields } = foundry.data;

export class KarmaData extends foundry.abstract.DataModel {
	static defineSchema() {

		const maxDie = Math.max(
			...Object.keys(CONFIG.Dice.fulfillment.dice)
				.map((key) => Number(key.replace(/^d/, "")))
				.filter((key) => !Number.isNaN(key))
		);
		return {
			id: new fields.DocumentIdField({ nullable: false }),
			enabled: new fields.BooleanField({ label: "KARMA.Form.enabled" }),
			recurring: new fields.BooleanField({ initial: true, label: "KARMA.Form.Recurring.label", hint: "KARMA.Form.Recurring.hint" }),
			name: new fields.StringField({ required: true, nullable: false, initial: "New Karma", label: "Name" }),
			type: new fields.StringField({
				required: true,
				initial: "simple",
				choices: {
					simple: "KARMA.Form.Type.simple",
					average: "KARMA.Form.Type.average",
					fudge: "KARMA.Form.Type.fudge"
				},
				label: "KARMA.Form.Type.label"
			}),
			dice: requiredInt({ initial: 20, min: 2, max: maxDie, label: "KARMA.Form.Faces.label" }),
			inequality: new fields.StringField({
				required: true,
				initial: "≤",
				choices: Object.fromEntries(["≤", "<", "≥", ">"].map((value) => [value, value])),
				label: "KARMA.Form.Inequality.label"
			}),
			history: requiredInt({ initial: 2, min: 2, max: 100, label: "KARMA.Form.History.label" }),
			// Exclusive to Simple Karma
			threshold: requiredInt({ initial: 7, label: "KARMA.Form.Threshold.label" }),
			// This used to be Floor-only, but now works for Ceiling
			// TODO rename to "target"
			floor: requiredInt({ initial: 13, label: "KARMA.Form.Floor.label" }),
			// Exclusive to Average Karma
			nudge: requiredInt({ initial: 5, label: "KARMA.Form.Nudge.label" }),
			cumulative: new fields.BooleanField({ label: "KARMA.Form.Cumulative.label" }),
			// User Configuration
			allGms: new fields.BooleanField({ initial: true }),
			allPlayers: new fields.BooleanField({ initial: true }),
			users: new fields.TypedObjectField(new fields.BooleanField(),
				{ validateKey: foundry.data.validators.isValidId }),
		};
	}

	static migrateData(source) {
		if (!source.id) {
			source.id = foundry.utils.randomID(16);
		}
	}
}

function requiredInt(config) {
	return new fields.NumberField({
		integer: true,
		nullable: false,
		positive: true,
		required: true,
		...config
	});
}
