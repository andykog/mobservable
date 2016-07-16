const test = require('tape');
const mobx = require('..');
const { observable, reaction, disposeCurrentReaction, autorun } = mobx;

test('disposing current reaction', t => {
	const observableValue = observable(0);
	const values = [];

	reaction(
		() => {
			const value = observableValue.get();
			if (value >= 1) disposeCurrentReaction();
			return value;
		},
		newValue => values.push(newValue),
		true
	);

	observableValue.set(1);
	observableValue.set(2);

	t.deepEqual(values, [0, 1]);
	t.end();
});

test('disposing current reaction in autorun', t => {
	const observableValue = observable(0);
	const values = [];

	autorun(() => {
		const value = observableValue.get();
		if (value >= 1) disposeCurrentReaction();
		values.push(value);
	});

	observableValue.set(1);
	observableValue.set(2);

	t.deepEqual(values, [0, 1]);
	t.end();
});
