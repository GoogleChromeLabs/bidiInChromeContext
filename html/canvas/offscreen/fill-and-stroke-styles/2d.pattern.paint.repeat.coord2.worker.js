// DO NOT EDIT! This test has been generated by /html/canvas/tools/gentest.py.
// OffscreenCanvas test in a worker:2d.pattern.paint.repeat.coord2
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

  var promise = new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", '/images/grgr-256x256.png');
      xhr.responseType = 'blob';
      xhr.send();
      xhr.onload = function() {
          resolve(xhr.response);
      };
  });
  promise.then(function(response) {
      createImageBitmap(response).then(bitmap => {
          var pattern = ctx.createPattern(bitmap, 'no-repeat');
          ctx.fillStyle = pattern;
          ctx.fillRect(0, 0, 100, 50);
          _assertPixel(canvas, 1,1, 0,255,0,255);
          _assertPixel(canvas, 98,1, 0,255,0,255);
          _assertPixel(canvas, 1,48, 0,255,0,255);
          _assertPixel(canvas, 98,48, 0,255,0,255);
      }, t_fail);
  }).then(t_pass, t_fail);
});
done();
