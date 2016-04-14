

import * as mobx from 'mobx';
Object.assign(self, mobx);

class Field {
	@observable bound = {
		field: null,
	};

	constructor(fieldName) {
		this.bound.field = fieldName;
	}
}

self.field = new Field("AAA");
self.field2 = new Field("BBB");

console.log(field.bound.field, field2.bound.field);
