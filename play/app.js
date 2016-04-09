

import * as mobx from 'mobx';
const { observable, autorun } = mobx;
self.mobx = mobx;


self.vObj = mobx.observable({
	v: 1
});

mobx.autorun(() => {
	vObj.v = Math.random();
});

self.testV = () => {
	vObj.v = 1;
};










self.arrObj = mobx.observable({
	arr: []
});

mobx.autorun(() => {
	arrObj.arr = [];
	console.info(arrObj.arr)
});

self.testArr = () => {
	arrObj.arr = [1];
};
