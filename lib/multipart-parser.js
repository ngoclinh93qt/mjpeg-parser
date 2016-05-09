'use strict';

const LineReader   = require('./line-reader');
const EventEmitter = require('events');

/**
 * Multipart parser module.
 * @module mjpeg-parser/multipart-parser
 */

/**
 * Multipart parser class. Instances of this class are able to parse multipart
 * data according to RFC2046.
 *
 * Input data can be passed using the push() method. The parser will generate
 * the following events:
 *  - 'header' if a new body part header has been received
 *  - 'data' if a new chunk of body part data has been received
 *  - 'end' if the terminating boundary has been received
 */
class MultipartParser extends EventEmitter {

    /**
     * Create a new instance of MultipartParser.
     *
     * @param {string} boundary multipart boundary
     * @param {number} maxHeaders maximum number of header fields per body part
     */
    constructor(boundary, maxHeaders) {
        super();

        // remove any leading dashes (in order to handle some stupid cams)
        var m = boundary.match(/^-*(.*)$/);
        if (m) {
            boundary = m[1];
        }

        this._lineReader = new LineReader('\r\n', 4096);
        this._maxHeaders = maxHeaders || 256;
        this._delimiter  = boundary;
        this._dre        = new RegExp("^---*" + boundary + "(.*)$");

        var self = this;

        this._lineReader.on('line', function(data) {
            self._processLine(data);
        });

        this._processData = this._processHeaderData;
        this._processLine = this._processDelimiterLine;

        this._headers   = [];
        this._headerMap = {};
        this._expected  = null;
    }

    /**
     * Pass given data to the parser.
     *
     * @param {Buffer} data data
     */
    push(data) {
        var offset = 0;

        while (offset < data.length) {
            var consumed = this._processData(data.slice(offset));
            // there was an error if no bytes has been consumed
            if (consumed <= 0) {
                break;
            }
            offset += consumed;
        }

        return offset;
    }

    /**
     * Reset the parser. (All data from the current body part will be
     * discarded.)
     */
    clear() {
        this._processData = this._processHeaderData;
        this._processLine = this._processDelimiterLine;

        this._headers     = [];
        this._headerMap   = {};
        this._expected    = null;

        this._lineReader.clear();
    }

    /**
     * Process body part header data.
     *
     * @param {Buffer} data data
     * @returns {number} number of bytes used from the given buffer
     * @private
     */
    _processHeaderData(data) {
        return this._lineReader.push(data);
    }

    /**
     * Process boundary line.
     *
     * @param {Buffer} line boundary line
     * @private
     */
    _processDelimiterLine(line) {
        var lstr = line.toString();
        var m    = lstr.match(this._dre);

        if (m) {
            if (m[1] && m[1] === '--') {
                this.emit('end');
                this._processData = this._processEpilogueData;
            } else {
                var tmp = m[1] || '';

                // some cameras do not send the CR LF bytes after sending 
                // the boundary, so we should try to parse the remainder as 
                // a header field line
                try {
                    this._processHeaderField(tmp);
                } catch (e) {
                    // let's just ignore the error
                }

                this._processLine = this._processHeaderLine;
            }
        }
    }

    /**
     * Process header line.
     *
     * @param {Buffer} line header line
     * @private
     */
    _processHeaderLine(line) {
        if (line.length === 0) {
            this._processHeaderEnd(line);
        } else if (line[0] === 0x20 || line[0] === 0x09) {
            this._processHeaderContinuation(line);
        } else {
            this._processHeaderField(line);
        }
    }

    /**
     * Process header field.
     *
     * @param {Buffer} line header field line
     * @private
     */
    _processHeaderField(line) {
        var lstr = line.toString();
        var m    = lstr.match(/^([^:\s]+)(:\s*(.*))?$/);

        if (m) {
            if (this._headers.length < this._maxHeaders) {
                var name   = m[1].toLowerCase();
                var value  = m[3] || "";
                var header = {
                    "name"  : m[1],
                    "value" : value,
                };
                this._headerMap[name] = header;
                this._headers.push(header);
            } else {
                throw new Error("maximum number of headers exceeded");
            }
        } else {
            throw new Error("invalid header field: \"" + lstr + "\"");
        }
    }

    /**
     * Process header field continuation.
     *
     * @param {Buffer} line header field continuation line
     * @private
     */
    _processHeaderContinuation(line) {
        var lstr = line.toString();
        if (this._headers.length > 0) {
            var header = this._headers.pop();
            header.value += lstr.trim();
            this._headers.push(header);
        } else {
            throw new Error("first header field cannot be a continuation");
        }
    }

    /**
     * Process header end.
     *
     * @param {Buffer} line line
     * @private
     */
    _processHeaderEnd(line) {
        var clength = this._headerMap['content-length'];

        this._expected = clength
            ? parseInt(clength.value)
            : null;

        this._processData = this._processBodyData;

        this.emit('header', this._headerMap);
    }

    /**
     * Process body data.
     *
     * @param {Buffer} data body data
     * @returns {number} number of bytes used from the given buffer
     * @private
     */
    _processBodyData(data) {
        var consume = this._expected;
        if (consume === null || consume > data.length) {
            consume = data.length;
        }

        if (consume > 0) {
            this.emit('data', data.slice(0, consume));
        }

        if (this._expected !== null) {
            this._expected -= consume;
        }

        if (this._expected === 0) {
            this.clear();
        }

        return consume;
    }

    /**
     * Process epilogue data.
     *
     * @param {Buffer} data epilogue data
     * @returns {number} number of bytes used from the given buffer
     * @private
     */
    _processEpilogueData(data) {
        // we are not interested in epilogue data
        return data.length;
    }
}

module.exports = MultipartParser;
