'use strict';

const MultipartParser = require('./multipart-parser');
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
 *  - 'error' in case of a parse error
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

        this._parser       = new MultipartParser(boundary, 256);
        this._maxFrameSize = maxFrameSize || 0x800000;

        this._headers = null;
        this._data    = null;
        this._length  = 0;
        this._offset  = 0;

        var self = this;

        this._parser.on('header', function(headers) {
            self._processHeader(headers);
        });

        this._parser.on('data', function(data) {
            self._processData(data);
        });

        this._parser.on('end', function() {
            self.emit('end');
        });

        this._parser.on('error', function(err) {
            self._processError(err);
        });
    }

    /**
     * Pass given data to the parser.
     *
     * @param {Buffer} data data
     */
    push(data) {
        this._parser.push(data);
    }

    /**
     * Process 'header' event from the internal multipart parser.
     *
     * @param {Map} headers header fields
     * @private
     */
    _processHeader(headers) {
        var tmp     = headers['content-length'];
        var clength = tmp && parseInt(tmp.value);

        // some stupid cams send DataLen header instead of Content-Length
        if (!clength) {
            tmp = headers['datalen'];
            // moreover, they send it as a decimal number with leading zeros
            clength = tmp && parseInt(tmp.value, 10);
        }

        this._headers = headers;
        this._data    = null;
        this._length  = 0;
        this._offset  = 0;

        if (!clength || clength < 0) {
            this._processError(new Error('missing or invalid frame length'));
        } else if (clength > this._maxFrameSize) {
            this._processError(new Error('received frame is too big: ' + clength));
        } else {
            this._data   = Buffer.alloc(clength);
            this._length = clength;
        }
    }

    /**
     * Process 'data' event from the internal multipart parser.
     *
     * @param {Buffer} data data
     * @private
     */
    _processData(data) {
        if (this._data) {
            var expected = this._length - this._offset;
            var consume  = data.length;
            if (consume > expected) {
                consume = expected;
            }

            data.copy(this._data, this._offset, 0, consume);

            this._offset += consume;

            // dispatch the frame as soon as it complete
            if (this._offset >= this._length) {
                this.emit('frame', this._headers, this._data);
            }

            // send any remaining data back to the parser
            var rest = data.slice(consume);
            if (rest.length > 0) {
                this._parser.clear();
                this._parser.push(rest);
            }
        }
    }

    /**
     * Process 'error' event from the internal multipart parser.
     *
     * @param {Error} err error
     * @private
     */
    _processError(err) {
        this.emit('error', new Error('MJPEG error: ' + err.message));
    }
}

module.exports = MjpegParser;
