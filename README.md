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

...

try {
    // parse given data
    parser.push(data);
} catch (e) {
    // handle possible parse errors
    console.info('parse error: %s', e.message);
}

...
```

## Development

- Before committing and/or publishing run `npm run syntax` and `npm run test`
  and fix all errors.
- In order to release a new version, change the package version in 
  `package.json` and run `npm publish`.
