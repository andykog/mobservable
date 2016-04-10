

import * as mobx from 'mobx';
const { observable, autorun, computed } = mobx;
self.mobx = mobx;

class TodoStore {
	@observable todos = [{
		title: 'Find a clean mug',
		completed: true
	}];

	@computed get completedCount() {
		return this.todos.filter((todo) => todo.completed).length;
	}
}


self.TodoStore = TodoStore;
