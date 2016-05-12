'use strict';

const EventEmitter = require('events');

/**
 * JPEG parser module.
 * @module mjpeg-parser/jpeg-parser
 */

/**
 * JPEG parser class. Instances of this class are able to parse single JPEG
 * images.
 *
 * Input data can be passed using the push() method. The parser will generate
 * the following events:
 *  - 'frame' if a frame has been successfully parsed
 */
class JpegParser extends EventEmitter {

    /**
     * Create a new instance of JpegParser with a given frame size limit.
     *
     * @param {number} maxFrameSize maximum frame size
     */
    constructor(maxFrameSize) {
        super();

        this._maxFrameSize = maxFrameSize;

        this._buffer = Buffer.alloc(0);

        this._expectedEOIs = 0;

        this._offset = 0;
        this._start  = -1;
        this._end    = -1;
    }

    /**
     * Push given data into the parser.
     *
     * @param {Buffer} data data
     * @returns {number} number of used bytes
     * @throws {Error} in case of a parse error
     */
    push(data) {
        var consumed = this._appendData(data);
        var offset   = this._offset - consumed - 1;

        // read all added JPEG fragments
        while (offset < this._offset && this._end < 0) {
            var pos = this._findFragment(offset);
            var id  = this._getFragmentId(pos);

            if (id < 0) {
                break;
            } else if (id === 0xd8) {
                this._soi(pos);
            } else if (id === 0xd9) {
                this._eoi(pos);
            }

            offset = pos + 1;
        }

        // emit the frame as soon as it's complete
        if (this._end >= 0) {
            var frame = this._buffer.slice(this._start, this._end);

            this.emit('frame', Buffer.from(frame));

            if (this._end < this._offset) {
                consumed -= this._offset - this._end;
            }

            this._reset();
        }

        return consumed;
    }

    _appendData(data) {
        var available = this._maxFrameSize - this._offset;
        var consume   = data.length;

        if (available <= 0 && data.length > 0) {
            throw new Error('maximum frame size exceeded');
        } else if (available < consume) {
            consume = available;
        }

        // grow the internal buffer if needed
        if ((this._offset + consume) > this._buffer.length) {
            var tmp = Buffer.alloc(this._offset + consume);
            this._buffer.copy(tmp, 0, 0, this._offset);
            this._buffer = tmp;
        }

        data.copy(this._buffer, this._offset, 0, consume);

        this._offset += consume;

        return consume;
    }

    /**
     * Find a JPEG fragment in the internal buffer starting at a given offset.
     *
     * @param {number} offset offset
     * @returns {number} index of the found fragment or -1
     */
    _findFragment(offset) {
        if (offset < 0) {
            offset = 0;
        }

        var haystack = this._buffer.slice(0, this._offset);
        var index    = haystack.indexOf(0xff, offset);

        if ((index + 1) >= haystack.length) {
            return -1;
        }

        return index;
    }

    /**
     * Get ID of a JPEG fragment starting at a given offset.
     *
     * @param {number} offset JPEG fragment offset
     * @returns {number} fragment ID or -1 in case of invalid fragment
     */
    _getFragmentId(offset) {
        if (offset < 0 || (offset + 1) >= this._offset) {
            return -1;
        }

        return this._buffer[offset + 1];
    }

    /**
     * Process next SOI fragment.
     *
     * @param {number} offset fragment offset
     */
    _soi(offset) {
        if (this._start < 0) {
            this._start = offset;
        }

        this._expectedEOIs += 1;
    }

    /**
     * Process next EOI fragment.
     *
     * @param {number} offset fragment offset
     * @throws {Error} in case of an unexpected EOI fragment
     */
    _eoi(offset) {
        this._expectedEOIs -= 1;

        if (this._expectedEOIs < 0) {
            throw new Error("unexpected EOI fragment");
        } else if (this._expectedEOIs === 0 && this._start >= 0) {
            this._end = offset + 2;
        }
    }

    /**
     * Reset the parser.
     */
    _reset() {
        this._expectedEOIs = 0;

        this._offset = 0;
        this._start  = -1;
        this._end    = -1;
    }
}

module.exports = JpegParser;
