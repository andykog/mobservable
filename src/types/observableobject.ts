import {ObservableValue, UNCHANGED} from "./observablevalue";
import {isComputedValue, ComputedValue} from "../core/computedvalue";
import {isAction} from "../api/action";
import {ValueMode, getModifier} from "./modifiers";
import {createInstanceofPredicate, isObject, Lambda, getNextId, invariant, assertPropertyConfigurable, isPlainObject, addHiddenFinalProp} from "../utils/utils";
import {runLazyInitializers} from "../utils/decorators";
import {hasInterceptors, IInterceptable, registerInterceptor, interceptChange} from "./intercept-utils";
import {IListenable, registerListener, hasListeners, notifyListeners} from "./listen-utils";
import {isSpyEnabled, spyReportStart, spyReportEnd} from "../core/spy";

export interface IObservableObject {
	"observable-object": IObservableObject;
}

// In 3.0, change to IObjectDidChange
export interface IObjectChange {
	name: string;
	object: any;
	type: "update" | "add";
	oldValue?: any;
	newValue: any;
}

export interface IObjectWillChange {
	object: any;
	type: "update" | "add";
	name: string;
	newValue: any;
}

export class ObservableObjectAdministration implements IInterceptable<IObjectWillChange>, IListenable {
	values: {[key: string]: ObservableValue<any>|ComputedValue<any>} = {};
	changeListeners = null;
	interceptors = null;

	constructor(public target: any, public name: string, public mode: ValueMode) { }

	/**
		* Observes this object. Triggers for the events 'add', 'update' and 'delete'.
		* See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/observe
		* for callback details
		*/
	observe(callback: (changes: IObjectChange) => void, fireImmediately?: boolean): Lambda {
		invariant(fireImmediately !== true, "`observe` doesn't support the fire immediately property for observable objects.");
		return registerListener(this, callback);
	}


	intercept(handler): Lambda {
		return registerInterceptor(this, handler);
	}
}

export interface IIsObservableObject {
	$mobx: ObservableObjectAdministration;
}

export function asObservableObject(target, name: string, mode: ValueMode = ValueMode.Recursive): ObservableObjectAdministration {
	if (isObservableObject(target))
		return target.$mobx;

	if (!isPlainObject(target))
		name = target.constructor.name + "@" + getNextId();
	if (!name)
		name = "ObservableObject@" + getNextId();

	const adm = new ObservableObjectAdministration(target, name, mode);
	addHiddenFinalProp(target, "$mobx", adm);
	return adm;
}

export function setObservableObjectInstanceProperty(adm: ObservableObjectAdministration, propName: string, descriptor: PropertyDescriptor) {
	if (adm.values[propName]) {
		invariant("value" in descriptor, "cannot redefine property " + propName);
		adm.target[propName] = descriptor.value; // the property setter will make 'value' reactive if needed.
	} else {
		if ("value" in descriptor)
			defineObservableProperty(adm, propName, descriptor.value, true, undefined);
		else
			defineObservableProperty(adm, propName, descriptor.get, true, descriptor.set);
	}
}

export function defineObservableProperty(adm: ObservableObjectAdministration, propName: string, newValue, asInstanceProperty: boolean, setter) {
	if (asInstanceProperty)
		assertPropertyConfigurable(adm.target, propName);

	let observable: ComputedValue<any>|ObservableValue<any>;
	let name = `${adm.name}.${propName}`;
	let isComputed = true;

	if (isComputedValue(newValue)) {
		// desugger computed(getter, setter)
		// TODO: deprecate this and remove in 3.0, to keep them boxed
		// get / set is now the idiomatic syntax for non-boxed computed values
		observable = newValue;
		newValue.name = name;
		if (!newValue.scope)
			newValue.scope = adm.target;
	} else if (typeof newValue === "function" && newValue.length === 0 && !isAction(newValue)) {
		// TODO: add warning in 2.6, see https://github.com/mobxjs/mobx/issues/421
		// TODO: remove in 3.0
		observable = new ComputedValue(newValue, adm.target, false, name, setter);
	} else if (getModifier(newValue) === ValueMode.Structure && typeof newValue.value === "function" && newValue.value.length === 0) {
		observable = new ComputedValue(newValue.value, adm.target, true, name, setter);
	} else {
		isComputed = false;
		if (hasInterceptors(adm)) {
			const change = interceptChange<IObjectWillChange>(adm, {
				object: adm.target,
				name: propName,
				type: "add",
				newValue
			});
			if (!change)
				return;
			newValue = change.newValue;
		}
		observable = new ObservableValue(newValue, adm.mode, name, false);
		newValue = (observable as any).value; // observableValue might have changed it
	}

	adm.values[propName] = observable;
	if (asInstanceProperty) {
		Object.defineProperty(adm.target, propName, isComputed ? generateComputedPropConfig(propName) : generateObservablePropConfig(propName));
	}
	if (!isComputed)
		notifyPropertyAddition(adm, adm.target, propName, newValue);
}

const observablePropertyConfigs = {};
const computedPropertyConfigs = {};

export function generateObservablePropConfig(propName) {
	const config = observablePropertyConfigs[propName];
	if (config)
		return config;
	return observablePropertyConfigs[propName] = {
		configurable: true,
		enumerable: true,
		get: function() {
			return this.$mobx.values[propName].get();
		},
		set: function(v) {
			setObserblePropertyValue(this, propName, v);
		}
	};
}

export function generateComputedPropConfig(propName) {
	const config = computedPropertyConfigs[propName];
	if (config)
		return config;
	return computedPropertyConfigs[propName] = {
		configurable: true,
		enumerable: false,
		get: function() {
			return this.$mobx.values[propName].get();
		},
		set: function(v) {
			setPropertyValue(this, propName, v);
		}
	};
}

export function setPropertyValue(instance, name: string, newValue) {
	const adm = instance.$mobx;
	
	if (isComputedValue(newValue)) {
		defineObservableProperty(adm, name, newValue, true, undefined);
	} else {
		adm.values[name].set(newValue);
	}
}

export function setObserblePropertyValue(instance, name: string, newValue) {
	const adm = instance.$mobx;
	const observable = adm.values[name];

	// intercept
	if (hasInterceptors(adm)) {
		const change = interceptChange<IObjectWillChange>(adm, {
			type: "update",
			object: instance,
			name, newValue
		});
		if (!change)
			return;
		newValue = change.newValue;
	}
	if (typeof observable.prepareNewValue !== 'function') {
		debugger;
	}
	newValue = observable.prepareNewValue(newValue);

	// notify spy & observers
	if (newValue !== UNCHANGED) {
		const notify = hasListeners(adm);
		const notifySpy = isSpyEnabled();
		const change = notify || notifySpy ? {
				type: "update",
				object: instance,
				oldValue: (observable as any).value,
				name, newValue
			} : null;

		if (notifySpy)
			spyReportStart(change);

		if (isComputedValue(newValue)) {
			observable.setNewValue(newValue.get());
			observable.observers.forEach(reaction => reaction.track(() => newValue.get()));
			defineObservableProperty(adm, name, newValue, true, undefined);
		} else {
			observable.setNewValue(newValue);
		}
		
		if (notify)
			notifyListeners(adm, change);
		if (notifySpy)
			spyReportEnd();
	}
}

function notifyPropertyAddition(adm, object, name: string, newValue) {
	const notify = hasListeners(adm);
	const notifySpy = isSpyEnabled();
	const change = notify || notifySpy ? {
			type: "add",
			object, name, newValue
		} : null;

	if (notifySpy)
		spyReportStart(change);
	if (notify)
		notifyListeners(adm, change);
	if (notifySpy)
		spyReportEnd();
}


const isObservableObjectAdministration = createInstanceofPredicate("ObservableObjectAdministration", ObservableObjectAdministration);

export function isObservableObject<T>(thing: T): thing is T & IObservableObject {
	if (isObject(thing)) {
		// Initializers run lazily when transpiling to babel, so make sure they are run...
		runLazyInitializers(thing);
		return isObservableObjectAdministration((thing as any).$mobx);
	}
	return false;
}
