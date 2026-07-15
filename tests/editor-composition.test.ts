import assert from "node:assert/strict";
import test from "node:test";
import { shouldInstallEditorChrome } from "../extensions/everforest-tui/editor-composition.ts";

const isTagged = (factory: { tagged?: boolean } | undefined) => factory?.tagged === true;

test("installs chrome when both the current and previous factories are absent", () => {
	assert.equal(shouldInstallEditorChrome(undefined, undefined, isTagged), true);
});

test("does not reinstall its currently owned or tagged factory", () => {
	const installed = {};
	assert.equal(shouldInstallEditorChrome(installed, installed, isTagged), false);
	assert.equal(shouldInstallEditorChrome({ tagged: true }, undefined, isTagged), false);
});

test("wraps a competing editor that replaced the previous Everforest factory", () => {
	assert.equal(shouldInstallEditorChrome({}, {}, isTagged), true);
});
