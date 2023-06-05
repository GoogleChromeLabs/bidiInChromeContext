// DO NOT EDIT! This test has been generated by /html/canvas/tools/gentest.py.
// OffscreenCanvas test in a worker:2d.pattern.repeat.empty
// Description:
// Note:

importScripts("/resources/testharness.js");
importScripts("/html/canvas/resources/canvas-tests.js");

var t = async_test("");
var t_pass = t.done.bind(t);
var t_fail = t.step_func(function(reason) {
    throw reason;
});
t.step(function() {

  var canvas = new OffscreenCanvas(100, 50);
  var ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f00';
  ctx.fillRect(0, 0, 100, 50);
  var promise = new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", '/images/green-1x1.png');
      xhr.responseType = 'blob';
      xhr.send();
      xhr.onload = function() {
          resolve(xhr.response);
      };
  });
  promise.then(function(response) {
      createImageBitmap(response).then(bitmap => {
          var pattern = ctx.createPattern(bitmap, "");
          ctx.fillStyle = pattern;
          ctx.fillRect(0, 0, 200, 50);
          _assertPixel(canvas, 1,1, 0,255,0,255);
          _assertPixel(canvas, 98,1, 0,255,0,255);
          _assertPixel(canvas, 1,48, 0,255,0,255);
          _assertPixel(canvas, 98,48, 0,255,0,255);
      }, t_fail);
  }).then(t_pass, t_fail);
});
done();
