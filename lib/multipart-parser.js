'use strict';

const LineReader   = require('./line-reader');
const EventEmitter = require('events');

class MultipartParser extends EventEmitter {
    
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
        this._dre        = new RegExp("^---*" + boundary + "(--)?$");
        
        var self = this;
        
        this._lineReader.on('line', function(data) {
            self._processLine(data);
        });
        
        this._lineReader.on('error', function(err) {
            self._parseError(err.message);
        });
        
        this._processData = this._processHeaderData;
        this._processLine = this._processDelimiterLine;
        
        this._headers   = [];
        this._headerMap = {};
        this._expected  = null;
    }
    
    add(data) {
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
    
    getHeader(name) {
        var lcn = name.toLowerCase();
        var res = this._headerMap[lcn];
        return res && res.value || null;
    }
    
    clear() {
        this._processData = this._processHeaderData;
        this._processLine = this._processDelimiterLine;
        
        this._headers     = [];
        this._headerMap   = {};
        this._expected    = null;
        
        this._lineReader.clear();
    }
    
    _processHeaderData(data) {
        return this._lineReader.add(data);
    }
    
    _processDelimiterLine(line) {
        var lstr = line.toString();
        var m    = lstr.match(this._dre);
        
        if (m) {
            if (m[1]) {
                this.emit('end');
                this._processData = this._processEpilogueData;
            } else {
                this._processLine = this._processHeaderLine;
            }
        }
    }
    
    _processHeaderLine(line) {
        if (line.length == 0) {
            this._processHeaderEnd(line);
        } else if (line[0] == 0x20 || line[0] == 0x09) {
            this._processHeaderContinuation(line);
        } else {
            this._processHeaderField(line);
        }
    }
    
    _processHeaderField(line) {
        var lstr = line.toString();
        var m    = lstr.match(/^([^:\s]+)(:\s*(.*))?$/);
        
        if (m) {
            if (this._headers.length < this._maxHeaders) {
                var name   = m[1].toLowerCase();
                var value  = m[3] || null;
                var header = {
                    "name"  : m[1],
                    "value" : value
                };
                this._headerMap[name] = header;
                this._headers.push(header);
            } else {
                this._parseError("maximum number of headers exceeded");
            }
        } else {
            this._parseError("invalid header field: \"" + lstr + "\"");
        }
    }
    
    _processHeaderContinuation(line) {
        var lstr = line.toString();
        if (this._headers.length > 0) {
            var header = this._headers.pop();
            header.value += lstr.trim();
            this._headers.push(header);
        } else {
            this._parseError("first header field cannot be a continuation");
        }
    }
    
    _processHeaderEnd(line) {
        var clength = this._headerMap['content-length'];
        
        this._expected = clength
            ? parseInt(clength.value)
            : null;
        
        this._processData = this._processBodyData;
        
        this.emit('header', this);
    }
    
    _processBodyData(data) {
        var consume = this._expected;
        if (consume === null || consume > data.length) {
            consume = data.length;
        }
        
        if (consume > 0) {
            this.emit('data', this, data.slice(0, consume));
        }
        
        if (this._expected !== null) {
            this._expected -= consume;
        }
        
        if (this._expected === 0) {
            this.emit('delimiter', this);
            this.clear();
        }
        
        return consume;
    }
    
    _processEpilogueData(data) {
        // we are not interested in epilogue data
    }
    
    _parseError(msg) {
        this.emit('error', new Error('parse error: ' + msg));
    }
}

module.exports = MultipartParser;
