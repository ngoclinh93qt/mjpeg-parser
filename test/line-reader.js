'use strict';

const LineReader = require('../lib/line-reader');

describe("LineReader", function() {
    var reader;
    var lines;
    
    beforeEach(function() {
        reader = new LineReader();
        lines = [];

        reader.on('line', function(line) {
            lines.push(line.toString());
        });
    });
    
    it("parses given input correctly", function() {
        var data = "abc\rde\nf\r\nhello\r\n\r\nworld\r\naaa";
        var offset = 0;

        data = Buffer.from(data);

        while (offset < data.length) {
            offset += reader.push(data.slice(offset));
        }

        var expected = [
            "abc\rde\nf",
            "hello",
            "",
            "world"
        ];

        var lastLen  = reader._offset;
        var lastLine = reader._buffer.slice(0, lastLen);

        expect(lines).toEqual(expected);
        expect(lastLine).toEqual(Buffer.from("aaa"));
        
        reader.clear();
        
        expect(reader._offset).toEqual(0);
    });

    it("does not trigger the line event with not enough data", function() {
        let data   = Buffer.from("\r\n\r");
        let offset = 0;

        while (offset < data.length) {
            offset += reader.push(data.slice(offset));
        }

        offset  = reader._offset;

        expect(lines).toEqual([""]);
        expect(offset).toEqual(1);
    });

    it("fails when the line is too long", function() {
        reader = new LineReader("\r\n", 5);

        reader.on('line', function(line) {
            lines.push(line.toString());
        });

        var data   = Buffer.from("aaa\r\nbbbb\r\nccc");
        var offset = 0;
        var error  = null;
        var tmp;

        try {
            while (offset < data.length) {
                tmp = reader.push(data.slice(offset));
                if (tmp <= 0) {
                    break;
                }
                offset += tmp;
            }
        } catch (e) {
            error = e;
        }

        var lastLen  = reader._offset;
        var lastLine = reader._buffer.slice(0, lastLen);

        expect(lines).toEqual(["aaa"]);
        expect(error).not.toBe(null);
        expect(lastLen).toEqual(5);
        expect(lastLine).toEqual(Buffer.from("bbbb\r"));
    });
});
