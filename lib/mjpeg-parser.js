'use strict';

const MultipartParser = require('./multipart-parser');
const JpegParser      = require('./jpeg-parser');
const EventEmitter    = require('events');

/**
 * MJPEG parser module.
 * @module mjpeg-parser/mjpeg-parser
 */

/**
 * MJPEG parser class. Instances of this class are able to parse multipart/xxx
 * data containing JPEG images.
 *
 * Input data can be passed using the push() method. The parser will generate
 * the following events:
 *  - 'frame' if a frame has been successfully parsed
 *  - 'end' if the end of the stream has been reached
 */
class MjpegParser extends EventEmitter {

    /**
     * Create a new instance of the MJPEG parser.
     *
     * @param {string} boundary multipart boundary
     * @param {number} maxFrameSize maximum size of a single frame in bytes
     */
    constructor(boundary, maxFrameSize) {
        super();

        this._bodyParser   = new MultipartParser(boundary, 256);
        this._maxFrameSize = maxFrameSize || 0x800000;

        this._jpegParser = null;

        this._headers = null;
        this._data    = null;
        this._length  = 0;
        this._offset  = 0;

        var self = this;

        this._bodyParser.on('header', function(headers) {
            self._processHeader(headers);
        });

        this._bodyParser.on('data', function(data) {
            self._processData(data);
        });

        this._bodyParser.on('end', function() {
            self.emit('end');
        });
    }

    /**
     * Pass given data to the underlaying multipart body parser.
     *
     * @param {Buffer} data data
     */
    push(data) {
        this._bodyParser.push(data);
    }

    /**
     * Process 'header' event from the internal multipart parser.
     *
     * @param {Map} headers header fields
     * @private
     */
    _processHeader(headers) {
        // assume it's image/jpeg if there is no Content-Type header
        var ctypeh = headers['content-type'];
        var ctype  = ctypeh
            ? ctypeh.value.toLowerCase()
            : 'image/jpeg';
        var clengthh = headers['content-length'];
        var clength  = clengthh && parseInt(clengthh.value);

        var self = this;

        // some stupid cams send DataLen header instead of Content-Length
        if (!clength) {
            clengthh = headers['datalen'];
            // moreover, they send it as a decimal number with leading zeros
            clength = clengthh && parseInt(clengthh.value, 10);
        }

        this._headers = headers;
        this._data    = null;
        this._length  = 0;
        this._offset  = 0;

        if (ctype !== 'image/jpeg') {
            throw new Error('invalid frame content type');
        } else if (!clength) {
            // there are even more stupid cameras which do not send the
            // Content-Length at all in any form
            if (!this._jpegParser) {
                this._jpegParser = new JpegParser(this._maxFrameSize);

                this._jpegParser.on('frame', function(frame) {
                    self.emit('frame', self._headers, frame);
                });
            }
        } else if (clength < 0) {
            throw new Error('invalid frame size');
        } else if (clength > this._maxFrameSize) {
            throw new Error('received frame is too big: ' + clength);
        } else {
            this._data   = Buffer.alloc(clength);
            this._length = clength;
        }
    }

    /**
     * Process 'data' event from the internal multipart body parser.
     *
     * @param {Buffer} data data
     * @private
     */
    _processData(data) {
        var consume = data.length;

        if (this._data) {
            var expected = this._length - this._offset;
            if (consume > expected) {
                consume = expected;
            }

            data.copy(this._data, this._offset, 0, consume);

            this._offset += consume;

            // dispatch the frame as soon as it is complete
            if (this._offset >= this._length) {
                this.emit('frame', this._headers, this._data);
            }
        } else if (this._jpegParser) {
            consume = this._jpegParser.push(data);
        } else {
            return;
        }

        // send any remaining data back to the parser
        var rest = data.slice(consume);
        if (rest.length > 0) {
            this._bodyParser.clear();
            this._bodyParser.push(rest);
        }
    }
}

module.exports = MjpegParser;
