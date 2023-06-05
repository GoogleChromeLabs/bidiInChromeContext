// DO NOT EDIT! This test has been generated by /html/canvas/tools/gentest.py.
// OffscreenCanvas test in a worker:2d.path.arc.angle.5
// Description:arc() wraps angles mod 2pi when clockwise and start > end+2pi
// Note:

importScripts("/resources/testharness.js");
importScripts("/html/canvas/resources/canvas-tests.js");

var t = async_test("arc() wraps angles mod 2pi when clockwise and start > end+2pi");
var t_pass = t.done.bind(t);
var t_fail = t.step_func(function(reason) {
    throw reason;
});
t.step(function() {

  var canvas = new OffscreenCanvas(100, 50);
  var ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0f0';
  ctx.fillRect(0, 0, 100, 50);
  ctx.fillStyle = '#f00';
  ctx.beginPath();
  ctx.moveTo(100, 0);
  ctx.arc(100, 0, 150, (1024-1)*Math.PI, (512+1/2)*Math.PI, false);
  ctx.fill();
  _assertPixel(canvas, 50,25, 0,255,0,255);
  t.done();
});
done();
