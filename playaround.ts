import * as BBO from "buffer-backed-object";
const sab = new SharedArrayBuffer(1024);
// const buffer = new ArrayBuffer(sab);
const view = BBO.BufferBackedObject(sab, {
  id: BBO.Uint16({ endianness: "big" }),
  position: BBO.NestedBufferBackedObject({
    x: BBO.Float32(),
    y: BBO.Float32(),
    z: BBO.Float32(),
  }),
  normal: BBO.NestedBufferBackedObject({
    x: BBO.Float32(),
    y: BBO.Float32(),
    z: BBO.Float32(),
  }),
  textureId: BBO.Uint8(),
});


console.log(view.id);
console.log(view.id);
console.log(JSON.stringify(view));