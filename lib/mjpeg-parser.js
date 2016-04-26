import EventEmitter    from 'events';
import MultipartParser from './multipart-parser';

export default class MjpegParser extends EventEmitter {
    
    constructor(boundary, maxFrameSize) {
        super();
        
        this._parser       = new MultipartParser(boundary, 256);
        this._maxFrameSize = maxFrameSize || 0x800000;
        
        this._contentType = null;
        this._data        = null;
        this._length      = 0;
        this._offset      = 0;
        
        var self = this;
        
        this._parser.on('header', function(parser) {
            self._processHeader(parser);
        });
        
        this._parser.on('data', function(parser, data) {
            self._processData(parser, data);
        });
        
        this._parser.on('end', function(parser) {
            self.emit('end', self);
        });
        
        this._parser.on('error', function(err) {
            self._processError(err);
        });
    }
    
    add(data) {
        this._parser.add(data);
    }
    
    _processHeader(parser) {
        var tmp     = parser.getHeader('content-length');
        var clength = tmp && parseInt(tmp);
        
        // some stupid cams send DataLen header instead of Content-Length
        if (!clength) {
            tmp = parser.getHeader('datalen');
            // moreover, they send it as a decimal number with leading zeros
            clength = tmp && parseInt(tmp, 10);
        }
        
        this._contentType = parser.getHeader('content-type');
        this._data        = null;
        this._length      = 0;
        this._offset      = 0;
        
        if (!clength || clength < 0) {
            this._processError(new Error('missing or invalid frame length'));
        } else if (clength > this._maxFrameSize) {
            this._processError(new Error('received frame is too big: ' + clength));
        } else {
            this._data   = Buffer.alloc(clength);
            this._length = clength;
        }
    }
    
    _processData(parser, data) {
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
                this.emit('frame', this, this._contentType, this._data);
            }
            
            // send any remaining data back to the parser
            var rest = data.slice(consume);
            if (rest.length > 0) {
                this._parser.clear();
                this._parser.add(rest);
            }
        }
    }
    
    _processError(err) {
        this.emit('error', new Error('MJPEG error: ' + err.message));
    }
}
