# MJPEG parser

Simple and lightweight parser for multipart MJPEG streams.

## Installation

1. Make sure you are logged in to our npm account using `npm login`.
2. Add this package to your project using `npm install --save @angelcam/mjpeg-parser`.

## Usage

Here is a simple usage example:

```JavaScript
const MjpegParser = require('@angelcam/mjpeg-parser');

...

// create a new MJPEG parser for streams with a given boundary
var parser = new MjpegParser(boundary);

parser.on('frame', function(headers, frame) {
    // process the frame here, e.g.:
    var ctype = headers['content-type'];
    
    ctype = ctype
        ? ctype.value
        : 'unknown';
    
    console.info('received %s frame of size %d', ctype, frame.length);
});

parser.on('end', function() {
    // handle the stream end, e.g.:
    console.info('stream end');
});

parser.on('error', function(err) {
    // handle possible parse errors:
    console.info('parse error: %s', err.message);
});

...
```

## Development

- Releasing a new version:
  - Change the package version in `package.json`.
  - Run `npm publish`.
