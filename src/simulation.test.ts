import { expect, test } from "bun:test";
import {forceSimulation} from "./index.ts";
import assert from "assert";
import {converToNodes} from "./simulation.ts";

test("find",()=>{
  const a = {x: 5, y: 0}, b = {x: 10, y: 16}, c = {x: -10, y: -4};
  const nodeList = [a,b,c]
  const f = forceSimulation(
    converToNodes(nodeList)
  ).stop();

  expect(f.find(0, 0)).toBe(nodeList.indexOf(a));
  expect(f.find(0, 0, 1)).toBeUndefined();
  expect(f.find(0, 20)).toBe(nodeList.indexOf(b));
})