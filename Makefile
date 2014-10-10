BROWSERIFY = node_modules/.bin/browserify


dist:
	mkdir -p dist

dist/tkwb.uncompressed.js: $(shell $(BROWSERIFY) --list index.js)
	$(BROWSERIFY) -s TWKB --debug index.js > $@

