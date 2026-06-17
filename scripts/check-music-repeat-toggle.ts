import assert from "node:assert/strict";

type MusicRepeatMode = "off" | "one" | "all";

function toggleOne(prev: MusicRepeatMode): MusicRepeatMode {
  return prev === "one" ? "off" : "one";
}

function toggleAll(prev: MusicRepeatMode): MusicRepeatMode {
  return prev === "all" ? "off" : "all";
}

assert.equal(toggleAll("all"), "off");
assert.equal(toggleAll("off"), "all");
assert.equal(toggleAll("one"), "all");

assert.equal(toggleOne("one"), "off");
assert.equal(toggleOne("off"), "one");
assert.equal(toggleOne("all"), "one");

console.log("music repeat toggle logic ok");
