'use strict';

const MjpegParser = require('../lib/mjpeg-parser');

describe("MjpegParser", function() {
    var parser;
    var frames;
    var end;
    var error;

    function init(boundary, maxFrameSize) {
        parser = new MjpegParser(boundary, maxFrameSize);
        frames = [];
        end    = false;
        error  = null;

        parser.on('frame', function(headers, data) {
            var frame = {
                "headers" : headers,
                "data"    : data,
            };

            frames.push(frame);
        });

        parser.on('end', function() {
            end = true;
        });
    }

    it("parses correctly given samples", function() {
        init("boundary", 100);

        var data = "foo\r\n"
            + "--boundary\r\n"
            + "Content-Length: \r\n"
            + " \r\n"
            + "\t5\r\n"
            + "\r\n"
            + "aaaaa\r\n"
            + "----boundary\r\n"
            + "DataLen: 3\r\n"
            + "Content-Type: image/jpeg\r\n"
            + "\r\n"
            + "bbb\r\n"
            + "--boundary"
            + "Content-Length: 4\r\n"
            + "\r\n"
            + "cccc\r\n"
            + "--boundary\r\n"
            + "Content-Type: image/jpg\r\n"
            + "Content-Length: 1\r\n"
            + "\r\n"
            + "a\r\n"
            + "--boundary\r\n"
            + "Content-Type: image/jpeg;foo=bar\r\n"
            + "Content-Length: 1\r\n"
            + "\r\n"
            + "b\r\n"
            + "--boundary--\r\n"
            + "foo";

        data = Buffer.from(data);

        parser.push(data);

        expect(end).toBe(true);
        expect(frames.length).toBe(5);
        expect(frames[0].headers['content-length']).toEqual({
            "name"  : "Content-Length",
            "value" : "5",
        });
        expect(frames[0].headers['content-type']).toBeUndefined();
        expect(frames[0].data.toString()).toEqual("aaaaa");
        expect(frames[1].headers['datalen']).toEqual({
            "name"  : "DataLen",
            "value" : "3",
        });
        expect(frames[1].headers['content-type']).toEqual({
            "name"  : "Content-Type",
            "value" : "image/jpeg",
        });
        expect(frames[1].data.toString()).toEqual("bbb");
        expect(frames[2].headers['content-length']).toEqual({
            "name"  : "Content-Length",
            "value" : "4",
        });
        expect(frames[2].headers['content-type']).toBeUndefined();
        expect(frames[2].data.toString()).toEqual("cccc");
        expect(frames[3].headers['content-type']).toEqual({
            "name"  : "Content-Type",
            "value" : "image/jpg",
        });
        expect(frames[4].headers['content-type']).toEqual({
            "name"  : "Content-Type",
            "value" : "image/jpeg;foo=bar",
        });
    });

    it("does not parse ivalid header fields", function() {
        init("boundary", 100);

        var data = "foo\r\n"
            + "--boundary\r\n"
            + "Content-Length: 5\r\n"
            + ": anonymous header\r\n"
            + "\r\n"
            + "aaaaa\r\n";

        data = Buffer.from(data);

        try {
            parser.push(data);
        } catch (e) {
            error = e;
        }

        expect(frames.length).toBe(0);
        expect(end).toBe(false);
    });

    it("does not parse a frame with invalid content type", function() {
        init("boundary", 100);

        var data = "foo\r\n"
            + "--boundary\r\n"
            + "Content-Type: image/png\r\n"
            + "Content-Length: 5\r\n"
            + "\r\n"
            + "aaaaa\r\n";

        data = Buffer.from(data);

        try {
            parser.push(data);
        } catch (e) {
            error = e;
        }

        expect(frames.length).toBe(0);
        expect(end).toBe(false);
        expect(error).not.toBe(null);
    });

    it("parses correctly a frame with unknown length", function() {
        init("boundary", 100);

        var header = "foo\r\n"
            + "--boundary\r\n"
            + "\r\n";
        var body = [0xff, 0xd8,
            1, 2,
            0xd8, 4, 0xd9,
            0xff, 0x00,
            0xff, 0xaa,
            0xff, 0xd9];

        header = Buffer.from(header);
        body   = Buffer.from(body);

        var data = Buffer.concat([header, body]);

        try {
            parser.push(data);
        } catch (e) {
            error = e;
        }

        expect(frames.length).toBe(1);
        expect(frames[0].data).not.toBe(null);
        expect(frames[0].data.length).toBe(body.length);
    });
});
