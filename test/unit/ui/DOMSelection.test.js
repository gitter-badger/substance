"use strict";

require('../qunit_extensions');

var isArray = require('lodash/isArray');
var DOMSelection = require('../../../ui/DOMSelection');
var Document = require('../../../model/Document');
var $ = require('../../../util/jquery');

QUnit.uiModule('ui/DOMSelection');

function StubDoc() {}

StubDoc.prototype.get = function(path) {
  var pathStr = path;
  if (isArray(path)) {
    pathStr = path.join('.');
  }
  var el = window.document.body.querySelector('*[data-path="'+pathStr+'"]');
  if (!el) {
    return "";
  }
  return el.textContent;
};
StubDoc.prototype.createSelection = Document.prototype.createSelection;

function StubSurface(el) {
  this.el = el;
  this.doc = new StubDoc();

  this.getDocument = function() {
    return this.doc;
  };
}

// Fixtures
var singlePropertyFixture = [
  '<div id="test1">',
    '<span data-path="test1.content">Hello World!</span>',
  '</div>'
].join('');

var emptyParagraphFixture = [
  '<div id="test1" class="content-node" data-id="test1">',
    '<span data-path="test1.content"></span>',
  '</div>'
].join('');

var mixedFixture = [
  '<div id="before">Before</div>',
  '<div id="test1">',
    '<span data-path="test1.content">The first property.</span>',
  '</div>',
  '<div id="test2">',
    '<span data-path="test2.content">The second property.</span>',
  '</div>',
  '<div id="between">Between</div>',
  '<div id="test3">',
    '<span data-path="test3.content">The third property.</span>',
  '</div>',
  '<div id="test4">',
    '<span data-path="test4.content">The forth property.</span>',
  '</div>',
  '<div id="after">After</div>'
].join('');

var wrappedTextNodes = [
  '<div id="test1">',
    '<span id="test1_content" data-path="test1.content">',
      '<span data-offset="0" data-length="2">..</span>',
      '<span data-offset="2" data-length="2">..</span>',
      '<span data-offset="4" data-length="2">..</span>',
      '<span data-offset="6" data-length="2">..</span>',
    '</span>',
  '</div>'
].join('');

var wrappedTextNodesWithExternals = [
  '<div id="test1">',
    '<span id="test1_content" data-path="test1.content">',
      '<span data-offset="0" data-length="2">..</span>',
      '<span data-inline="1">$</span>',
      '<span data-offset="3" data-length="2">..</span>',
      '<span data-inline="1">$</span>',
      '<span id="before-last" data-offset="4" data-length="2">..</span>',
      '<span data-inline="1">$</span>',
    '</span>',
  '</div>'
].join('');

var surfaceWithParagraphs = [
  '<div id="surface" class="surface">',
    '<p id="p1">',
      '<span data-path="p1.content">AA</span>',
    '</p>',
    '<p id="p2">',
      '<span data-path="p2.content">BBB</span>',
    '</p>',
    '<p id="p3">',
      '<span data-path="p3.content">CCCC</span>',
    '</p>',
  '</div>'
].join('');

QUnit.uiTest("Get coordinate for collapsed selection", function(assert) {
  var el = $('#qunit-fixture').html(singlePropertyFixture)[0];
  var domSelection = new DOMSelection(new StubSurface(el));
  var node = el.querySelector('#test1').childNodes[0].childNodes[0];
  var offset = 5;
  var coor = domSelection._getCoordinate(node, offset);
  assert.ok(coor, "Extrated coordinate should be !== null");
  assert.deepEqual(coor.path, ['test1', 'content'], 'Path should be extracted correctly.');
  assert.equal(coor.offset, 5, 'Offset should be extracted correctly.');
});

QUnit.uiTest("Search coordinate (before)", function(assert) {
  var el = $('#qunit-fixture').html(mixedFixture)[0];
  var domSelection = new DOMSelection(new StubSurface(el));
  var node = el.querySelector('#before').childNodes[0];
  var offset = 1;
  var coor = domSelection._searchForCoordinate(node, offset, {});
  assert.ok(coor, "Extracted coordinate should be !== null");
  assert.deepEqual(coor.path, ['test1', 'content'], 'Path should be extracted correctly.');
  assert.equal(coor.offset, 0, 'Offset should be extracted correctly.');
});

QUnit.uiTest("Search coordinate (between)", function(assert) {
  var el = $('#qunit-fixture').html(mixedFixture)[0];
  var domSelection = new DOMSelection(new StubSurface(el));
  var node = el.querySelector('#between').childNodes[0];
  var offset = 1;
  var coor = domSelection._searchForCoordinate(node, offset, {});
  assert.ok(coor, "Extracted coordinate should be !== null");
  assert.deepEqual(coor.path, ['test3', 'content'], 'Path should be extracted correctly.');
  assert.equal(coor.offset, 0, 'Offset should be extracted correctly.');
});

QUnit.uiTest("Search coordinate (between, left)", function(assert) {
  var el = $('#qunit-fixture').html(mixedFixture)[0];
  var domSelection = new DOMSelection(new StubSurface(el));
  var node = el.querySelector('#between').childNodes[0];
  var offset = 1;
  var coor = domSelection._searchForCoordinate(node, offset, {direction: 'left'});
  assert.ok(coor, "Extracted coordinate should be !== null");
  assert.deepEqual(coor.path, ['test2', 'content'], 'Path should be extracted correctly.');
  assert.equal(coor.offset, 20, 'Offset should be extracted correctly.');
});

QUnit.uiTest("Search coordinate (after)", function(assert) {
  var el = $('#qunit-fixture').html(mixedFixture)[0];
  var domSelection = new DOMSelection(new StubSurface(el));
  var node = el.querySelector('#after').childNodes[0];
  var offset = 1;
  var coor = domSelection._searchForCoordinate(node, offset, {direction: 'left'});
  assert.ok(coor, "Extracted coordinate should be !== null");
  assert.deepEqual(coor.path, ['test3', 'content'], 'Path should be extracted correctly.');
  assert.equal(coor.offset, 19, 'Offset should be extracted correctly.');
});

QUnit.uiTest("coordinate via search", function(assert) {
  var el = $('#qunit-fixture').html(mixedFixture)[0];
  var domSelection = new DOMSelection(new StubSurface(el));
  var node = el.querySelector('#between').childNodes[0];
  var offset = 1;
  var coor = domSelection._searchForCoordinate(node, offset);
  assert.ok(coor, "Extrated coordinate should be !== null");
  assert.deepEqual(coor.path, ['test3', 'content'], 'Path should be extracted correctly.');
  assert.equal(coor.offset, 0, 'Offset should be extracted correctly.');
});

QUnit.uiTest("coordinate for empty paragraph", function(assert) {
  var el = $('#qunit-fixture').html(emptyParagraphFixture)[0];
  var domSelection = new DOMSelection(new StubSurface(el));
  var node = el.querySelector('#test1');
  var offset = 0;
  var coor = domSelection._getCoordinate(node, offset);
  assert.ok(coor, "Extrated coordinate should be !== null");
  assert.deepEqual(coor.path, ['test1', 'content'], 'Path should be extracted correctly.');
  assert.equal(coor.offset, 0, 'Offset should be extracted correctly.');
});

QUnit.uiTest("coordinate from wrapped text nodes", function(assert) {
  var el = $('#qunit-fixture').html(wrappedTextNodes)[0];
  var domSelection = new DOMSelection(new StubSurface(el));
  var node = el.querySelector('#test1_content');
  var offset = 4;
  var coor = domSelection._getCoordinate(node, offset);
  assert.ok(coor, "Extrated coordinate should be !== null");
  assert.deepEqual(coor.path, ['test1', 'content'], 'Path should be extracted correctly.');
  assert.equal(coor.offset, 8, 'Offset should be extracted correctly.');
});

QUnit.uiTest("coordinate from wrapped text nodes with externals", function(assert) {
  var el = $('#qunit-fixture').html(wrappedTextNodesWithExternals)[0];
  var domSelection = new DOMSelection(new StubSurface(el));
  var node = el.querySelector('#test1_content');
  var offset = 6;
  var coor = domSelection._getCoordinate(node, offset);
  assert.ok(coor, "Extrated coordinate should be !== null");
  assert.deepEqual(coor.path, ['test1', 'content'], 'Path should be extracted correctly.');
  assert.equal(coor.offset, 9, 'Offset should be extracted correctly.');
});

QUnit.uiTest("a selection spanning over a external at the end of a property", function(assert) {
  var el = $('#qunit-fixture').html(wrappedTextNodesWithExternals)[0];
  var domSelection = new DOMSelection(new StubSurface(el));
  var anchorNode = el.querySelector('#before-last').childNodes[0];
  var anchorOffset = 2;
  var focusNode = el.querySelector('#test1_content');
  var focusOffset = 6;
  var range = domSelection._getRange(anchorNode, anchorOffset, focusNode, focusOffset, false);
  assert.ok(range, "Range should be !== null");
  assert.notOk(range.isReverse, "Selection should be forward");
  assert.deepEqual(range.start.path, ['test1', 'content'], 'Path should be extracted correctly.');
  assert.deepEqual(range.start.offset, 8, 'startOffset should be extracted correctly.');
  assert.deepEqual(range.end.offset, 9, 'startOffset should be extracted correctly.');
});

// Test for issue #273

var textPropWithInlineElements = [
  '<span class="sc-text-property" data-path="prop.content" spellcheck="false" style="white-space: pre-wrap;">',
    'Historically, the sensation of fullness has been documented as far ',
    'back as Homers  Odyssey. Pioneering work by Cannon and Washburn ',
    'revealed a correlation between stomach expansion and satiety in humans ',
    '(Cannon and Washburn, 1911), which was later confirmed in rodents (',
    '<span id="test" data-id="test" data-inline="1" contenteditable="false">',
      '[5]',
    '</span>',
    '). Recently, several groups have shown that feeding-related neurons ',
    'are sensitive to satiety state but not nutrients in Drosophila (',
      '<span class="bib-item-citation citation annotation" data-id="bib_item_citation_cf288234a38ea4cd9c3d04337049584e" data-inline="1" contenteditable="false">',
        '[3]',
      '</span>',
    '). These studies argue that non-metabolic inputs such as mechanic tension could regulate feeding.<br>',
  '</span>'
].join('');

QUnit.uiTest("Issue #273: 'Could not find char position' when clicking right above an inline node", function(assert) {
  var el = $('#qunit-fixture').html(textPropWithInlineElements)[0];
  var domSelection = new DOMSelection(new StubSurface(el));
  var node = el.querySelector('#test').childNodes[0];
  var offset = 2;
  var coor = domSelection._getCoordinate(node, offset);
  assert.ok(coor, "Extrated coordinate should be !== null");
  assert.deepEqual(coor.path, ['prop', 'content'], 'Path should be extracted correctly.');
  assert.equal(coor.offset, 270, 'Offset should be extracted correctly.');
});

QUnit.firefoxTest("Issue #354: Wrong selection in FF when double clicking between lines", function(assert) {
  var el = $('#qunit-fixture').html(surfaceWithParagraphs)[0];
  var domSelection = new DOMSelection(new StubSurface(el));
  var surface = el.querySelector('#surface');
  QUnit.setDOMSelection(surface, 0, surface, 1);
  var range = domSelection.mapDOMSelection();
  // assert.ok(sel.isPropertySelection(), "Selection should be property selection.");
  assert.deepEqual(range.start.path, ['p1', 'content'], 'Path should be extracted correctly.');
  assert.deepEqual([range.start.offset, range.end.offset], [0, 2], 'Offsets should be extracted correctly.');
});

QUnit.uiTest("Issue #376: Wrong selection mapping at end of paragraph", function(assert) {
  var el = $('#qunit-fixture').html(surfaceWithParagraphs)[0];
  var domSelection = new DOMSelection(new StubSurface(el));
  var p1span = el.querySelector('#p1 span');
  var p2 = el.querySelector('#p2');
  QUnit.setDOMSelection(p1span, 1, p2, 0);
  var range = domSelection.mapDOMSelection();
  assert.deepEqual(range.start.path, ['p1', 'content'], 'startPath');
  assert.deepEqual(range.start.offset, 2, 'startOffset');
  assert.deepEqual(range.end.path, ['p2', 'content'], 'endPath');
  assert.deepEqual(range.end.offset, 0, 'endOffset');
});
