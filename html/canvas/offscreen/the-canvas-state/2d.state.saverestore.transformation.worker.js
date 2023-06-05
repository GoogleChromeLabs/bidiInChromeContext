// DO NOT EDIT! This test has been generated by /html/canvas/tools/gentest.py.
// OffscreenCanvas test in a worker:2d.state.saverestore.transformation
// Description:save()/restore() affects the current transformation matrix
// Note:

importScripts("/resources/testharness.js");
importScripts("/html/canvas/resources/canvas-tests.js");

var t = async_test("save()/restore() affects the current transformation matrix");
var t_pass = t.done.bind(t);
var t_fail = t.step_func(function(reason) {
    throw reason;
});
t.step(function() {

  var canvas = new OffscreenCanvas(100, 50);
  var ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0f0';
  ctx.fillRect(0, 0, 100, 50);
  ctx.save();
  ctx.translate(200, 0);
  ctx.restore();
  ctx.fillStyle = '#f00';
  ctx.fillRect(-200, 0, 100, 50);
  _assertPixel(canvas, 50,25, 0,255,0,255);
  t.done();
});
done();
