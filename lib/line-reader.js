import EventEmitter from 'events';

export default class LineReader extends EventEmitter {
    
    constructor(delimiter, maxLength) {
        super();
        
        this._delimiter = delimiter
            ? Buffer.from(delimiter)
            : Buffer.from('\r\n');
        
        this._maxLength = maxLength || 4096;
        
        this._buffer = Buffer.alloc(this._maxLength);
        this._offset = 0;
    }
    
    add(data) {
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
    
    clear() {
        this._offset = 0;
    }
    
    _findDelimiter = function(offset) {
        if (offset < 0) {
            offset = 0;
        }
        
        var haystack = this._buffer.slice(0, this._offset);
        
        return haystack.indexOf(this._delimiter, offset);
    }
}
