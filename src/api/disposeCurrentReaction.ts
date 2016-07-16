import {globalState} from "../core/globalstate";
import {Reaction} from "../core/reaction";

export function disposeCurrentReaction() {
	const currentDerivation = globalState.derivationStack[globalState.derivationStack.length - 1];
	if (currentDerivation instanceof Reaction) {
		currentDerivation.dispose();
	} else {
		console.log(globalState.derivationStack);
		console.error('[mobx] disposeCurrentReaction() must be called inside reaction');
	}
}
