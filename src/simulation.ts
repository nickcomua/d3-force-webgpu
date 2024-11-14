import {dispatch} from "d3-dispatch";
import {timer} from "d3-timer";
import lcg from "./lcg.js";
import * as buffer from "buffer";
import assert from "assert";

export function x(d) {
  return d.x;
}

export function y(d) {
  return d.y;
}

var initialRadius = 10,
  initialAngle = Math.PI * (3 - Math.sqrt(5));

type OldNodeObject = {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
}


export type Nodes = {
  x: Int32Array,
  y: Int32Array
  vx: Int32Array,
  vy: Int32Array,
  state: Uint8Array,
}

export const converToNodes = (nodes: OldNodeObject[], count?: number): Nodes => {
  if(!count){
    count = nodes.length;
  }
  if (count < nodes.length) {
    throw new Error("nodes must be greater than 0");
  }
  const x = new Int32Array(count)
  x.set(nodes.map((x) => x.x))
  const y = new Int32Array(count)
  y.set(nodes.map((x) => x.y))
  const vx = new Int32Array(count)
  vx.set(nodes.map((x) => x.vx ?? 0))
  const vy = new Int32Array(count)
  vy.set(nodes.map((x) => x.vy ?? 0))
  const state = new Uint8Array(count)
  state.set(nodes.map((x) => {
    if (Number.isFinite(x.fx) && Number.isFinite(x.fy)) {
      return NodeState.Fixed
    }
    if (Number.isFinite(x.fx)) {
      return NodeState.ActiveY
    }
    if (Number.isFinite(x.fy)) {
      return NodeState.ActiveX
    }
    return NodeState.Active
  }))
  return {
    x, y, vx, vy, state
  }
}

export enum NodeState {
  Inactive = 0,
  Active = 1,
  Fixed = 2,
  ActiveX = 3,
  ActiveY = 4,
}

export default function (nodes: Nodes = {
  x: new Int32Array(1000),
  y: new Int32Array(1000),
  vx: new Int32Array(1000),
  vy: new Int32Array(1000),
  state: new Uint8Array(1000),
}, radius?: number) {
  let alpha = 1,
    alphaMin = 0.001,
    alphaDecay = 1 - Math.pow(alphaMin, 1 / 300),
    alphaTarget = 0,
    velocityDecay = 0.6,
    forces = new Map(),
    stepper = timer(step),
    event = dispatch("tick", "end"),

    random = lcg();

  function step() {
    tick();
    event.call("tick", simulation);
    if (alpha < alphaMin) {
      stepper.stop();
      event.call("end", simulation);
    }
  }

  function tick(iterations?: number) {
    let i, n = nodes.x.length, state: NodeState;

    if (iterations === undefined) iterations = 1;

    for (let k = 0; k < iterations; ++k) {
      alpha += (alphaTarget - alpha) * alphaDecay;

      forces.forEach(function (force) {
        force(alpha);
      });

      for (i = 0; i < n; ++i) {
        state = Atomics.load(nodes.state, i)
        if (state === NodeState.Active || state === NodeState.ActiveX) {
          Atomics.add(nodes.x, i, Atomics.load(nodes.vx, i) * velocityDecay);
        }
        if (state === NodeState.Active || state === NodeState.ActiveY) {
          Atomics.add(nodes.y, i, Atomics.load(nodes.vy, i) * velocityDecay);
        }
        // if (node.fx == null) node.x += node.vx *= velocityDecay;
        // else node.x = node.fx, node.vx = 0;
        // if (node.fy == null) node.y += node.vy *= velocityDecay;
        // else node.y = node.fy, node.vy = 0;
      }
    }

    return simulation;
  }

  // function initializeNodes() {
  //   for (var i = 0, n = nodes.length, node; i < n; ++i) {
  //     node = nodes[i], node.index = i;
  //     if (node.fx != null) node.x = node.fx;
  //     if (node.fy != null) node.y = node.fy;
  //     if (isNaN(node.x) || isNaN(node.y)) {
  //       var radius = initialRadius * Math.sqrt(0.5 + i), angle = i * initialAngle;
  //       node.x = radius * Math.cos(angle);
  //       node.y = radius * Math.sin(angle);
  //     }
  //     if (isNaN(node.vx) || isNaN(node.vy)) {
  //       node.vx = node.vy = 0;
  //     }
  //   }
  // }

  function initializeForce(force) {
    if (force.initialize) force.initialize(nodes, random);
    return force;
  }


  const simulation = {
    tick: tick,

    restart: function () {
      return stepper.restart(step), simulation;
    },

    stop: function () {
      stepper.stop()
      return simulation;
    },

    nodes: <T extends Nodes | undefined>(v: T): T extends undefined ? Nodes : void => {
      if (v === undefined) {
        return nodes
      }
      nodes = v;
      return undefined
    },

    alpha: <T extends number | undefined>(v: T): T extends undefined ? number : undefined => {
      if (v === undefined) {
        return alpha
      }
      alpha = v;
      return undefined
    },
    // alpha: function (_) {
    //   return arguments.length ? (alpha = +_, simulation) : alpha;
    // },


    alphaMin: function (_) {
      return arguments.length ? (alphaMin = +_, simulation) : alphaMin;
    },

    alphaDecay: function (_) {
      return arguments.length ? (alphaDecay = +_, simulation) : +alphaDecay;
    },

    alphaTarget: function (_) {
      return arguments.length ? (alphaTarget = +_, simulation) : alphaTarget;
    },

    velocityDecay: function (_) {
      return arguments.length ? (velocityDecay = 1 - _, simulation) : 1 - velocityDecay;
    },

    randomSource: function (_) {
      return arguments.length ? (random = _, forces.forEach(initializeForce), simulation) : random;
    },

    force: function (name, _) {
      return arguments.length > 1 ? ((_ == null ? forces.delete(name) : forces.set(name, initializeForce(_))), simulation) : forces.get(name);
    },

    find: function (x: number, y: number, radius?: number) {
      var i = 0,
        n = nodes.x.length,
        dx: number,
        dy: number,
        d2: number,
        closest: number | undefined;

      if (!radius) radius = Infinity;
      else radius *= radius;

      for (i = 0; i < n; ++i) {
        // node = nodes[i];
        if (Atomics.load(nodes.state, i) === NodeState.Inactive) {
          continue
        }
        dx = x - Atomics.load(nodes.x, i);
        dy = y - Atomics.load(nodes.y, i);
        d2 = dx * dx + dy * dy;
        if (d2 < radius) {
          closest = i;
          radius = d2;
        }
      }

      return closest;
    },

    on: function (name, _) {
      return arguments.length > 1 ? (event.on(name, _), simulation) : event.on(name);
    }
  } as const;
  return simulation;
}
