

import * as mobx from 'mobx';
Object.assign(self, mobx);

// window.x = observable([]);
window.y = observable(Array(3));


var yok = false;

// reaction(() => x[0],         v => console.log('x new val', v), true);
// x[0] = 0;

y.observe(change => console.log(change))

y[0] = 0;
y[1] = 1;
y[2] = 2;
y[3] = 3;
y[4] = 4;
y[5] = 5;
y[6] = 6;
y.pop();
y[6] = 6;
y[7] = 7;

console.log(y);
