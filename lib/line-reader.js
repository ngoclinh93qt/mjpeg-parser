'use strict';

const EventEmitter = require('events');

/**
 * Line reader module.
 * @module mjpeg-parser/line-reader
 */

/**
 * Line rader class. Instances of this class are able to read lines from a
 * given input stream.
 *
 * This reader does NOT expect any character encoding. It simply splits a given
 * sequence of bytes according to a given delimiter.
 *
 * Input data can be passed using the push() method. The parser will generate
 * the following events:
 *  - 'line' if a line has been successfully read
 *  - 'error' in case of a parse error
 */
class LineReader extends EventEmitter {

    /**
     * Create a new instance of LineReader.
     *
     * @param {string} delimiter line delimiter (default value: "\r\n")
     * @param {number} maxLength maximum length of a single line (default
     * value: 4096)
     */
    constructor(delimiter, maxLength) {
        super();

        this._delimiter = delimiter
            ? Buffer.from(delimiter)
            : Buffer.from('\r\n');

        this._maxLength = maxLength || 4096;

        this._buffer = Buffer.alloc(this._maxLength);
        this._offset = 0;
    }

    /**
     * Pass given data to the reader.
     *
     * @param {Buffer} data data
     * @returns {number} number of bytes consumed from the given buffer
     */
    push(data) {
        var available = this._maxLength - this._offset;
        var consume   = data.length;

        if (consume > available) {
            consume = available;
        }

        if (consume <= 0 && data.length > 0) {
            this.emit('error', new Error('maximum line length exceeded'));
        } else {
            data.copy(this._buffer, this._offset, 0, consume);

            var dlen  = this._delimiter.length;
            var start = this._offset;

            this._offset += consume;

            var pos = this._findDelimiter(start - dlen);
            if (pos >= 0) {
                this.emit('line', this._buffer.slice(0, pos));
                this._offset = 0;
                consume = pos + dlen - start;
            }
        }

        return consume;
    }

    /**
     * Clear the reader. (All bytes from the current line will be discarded.)
     */
    clear() {
        this._offset = 0;
    }

    /**
     * Find the delimiter in the current line.
     *
     * @param {number} offset line offset
     * @returns {number} the first occurence of the delimiter or -1
     * @private
     */
    _findDelimiter(offset) {
        if (offset < 0) {
            offset = 0;
        }

        var haystack = this._buffer.slice(0, this._offset);

        return haystack.indexOf(this._delimiter, offset);
    }
}

module.exports = LineReader;
