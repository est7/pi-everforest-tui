/** Decide whether Everforest must install/reinstall its editor chrome wrapper. */
export function shouldInstallEditorChrome<T>(
	currentFactory: T | undefined,
	installedFactory: T | undefined,
	isTaggedEverforestFactory: (factory: T | undefined) => boolean,
): boolean {
	if (isTaggedEverforestFactory(currentFactory)) return false;
	return installedFactory === undefined || currentFactory !== installedFactory;
}
