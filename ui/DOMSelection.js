/* jshint latedef:nofunc */
'use strict';

var $ = require('../util/jquery');
var oo = require('../util/oo');
var Coordinate = require('../model/Coordinate');
var Range = require('../model/Range');
var Selection = require('../model/Selection');
var TextPropertyComponent = require('./TextPropertyComponent');

/*
 * A class that maps DOM selections to model selections.
 *
 * There are some difficulties with mapping model selections:
 * 1. DOM selections can not model discontinuous selections.
 * 2. Not all positions reachable via ContentEditable can be mapped to model selections. For instance,
 *    there are extra positions before and after non-editable child elements.
 * 3. Some native cursor behaviors need to be overidden.
 *
 * @class DOMSelection
 * @constructor
 * @param {Element} rootElement
 */
function DOMSelection(surface) {
  this.surface = surface;
}

DOMSelection.Prototype = function() {

  this.setSelection = function(sel) {
    // console.log('### renderSelection', sel.toString());
    var wSel = window.getSelection();
    if (sel.isNull() || sel.isTableSelection()) {
      return this.clear();
    }
    var startComp = this.surface._getTextPropertyComponent(sel.startPath);
    var start = startComp.getDOMCoordinate(sel.startOffset);
    var end;
    if (sel.isCollapsed()) {
      end = start;
    } else {
      var endComp = this.surface._getTextPropertyComponent(sel.endPath);
      end = endComp.getDOMCoordinate(sel.endOffset);
    }
    // if there is a range then set replace the window selection accordingly
    wSel.removeAllRanges();
    var wRange = window.document.createRange();
    if (sel.isReverse()) {
      wRange.setStart(end.container, end.offset);
      wSel.addRange(wRange);
      wSel.extend(start.container, start.offset);
    } else {
      wRange.setStart(start.container, start.offset);
      wRange.setEnd(end.container, end.offset);
      wSel.addRange(wRange);
    }
  };

  /*
    Maps the current DOM selection to a model range.

    @param {object} [options]
      - `direction`: `left` or `right`; a hint for disambiguations, used by Surface during cursor navigation.
    @returns {model/Range}
  */
  this.mapDOMSelection = function(options) {
    var range;
    var wSel = window.getSelection();
    // Use this log whenever the mapping goes wrong to analyze what
    // is actually being provided by the browser
    // console.log('DOMSelection.getSelection()', 'anchorNode:', wSel.anchorNode, 'anchorOffset:', wSel.anchorOffset, 'focusNode:', wSel.focusNode, 'focusOffset:', wSel.focusOffset, 'collapsed:', wSel.collapsed);
    if (wSel.rangeCount === 0) {
      return null;
    }
    if (wSel.isCollapsed) {
      var coor = this._getCoordinate(wSel.anchorNode, wSel.anchorOffset, options);
      range = _createRange(coor, coor, false);
    }
    // HACK: special treatment for edge cases as addressed by #354.
    // Sometimes anchorNode and focusNodes are the surface
    if ($(wSel.anchorNode).is('.surface')) {
      range = this._getEnclosingRange(wSel.getRangeAt(0));
    } else {
      range = this._getRange(wSel.anchorNode, wSel.anchorOffset, wSel.focusNode, wSel.focusOffset);
    }
    // console.log('### extracted range from DOM', range.toString);
    return range;
  };

  /*
    Map a DOM range to a model range.

    @param {Range} range
    @returns {model/Range}
  */
  this.mapDOMRange = function(wRange) {
    return this._getRange(wRange.startContainer, wRange.startOffset,
      wRange.endContainer, wRange.endOffset);
  };

  /*
    Clear the DOM selection.
  */
  this.clear = function() {
    window.getSelection().removeAllRanges();
  };

  /*
    Extract a model range from given DOM elements.

    @param {Node} anchorNode
    @param {number} anchorOffset
    @param {Node} focusNode
    @param {number} focusOffset
    @returns {model/Range}
  */
  this._getRange = function(anchorNode, anchorOffset, focusNode, focusOffset) {
    var start = this._getCoordinate(anchorNode, anchorOffset);
    var end;
    if (anchorNode === focusNode && anchorOffset === focusOffset) {
      end = start;
    } else {
      end = this._getCoordinate(focusNode, focusOffset);
    }
    var isReverse = _isReverse(anchorNode, anchorOffset, focusNode, focusOffset);
    if (start && end) {
      return _createRange(start, end, isReverse);
    } else {
      return null;
    }
  };

  /*
    Map a DOM coordinate to a model coordinate.

    @param {Node} node
    @param {number} offset
    @param {object} options
    @param {object} [options]
      - `direction`: `left` or `right`; a hint for disambiguation.
    @returns {model/Coordinate}

    @info

    `options.direction` can be used to control the result when this function is called
    after cursor navigation. The root problem is that we are using ContentEditable on
    Container level (as opposed to TextProperty level). The native ContentEditable allows
    cursor positions which do not make sense in the model sense.

    For example,

    ```
    <div contenteditable=true>
      <p data-path="p1.content">foo</p>
      <img>
      <p data-path="p1.content">bar</p>
    </div>
    ```
    would allow to set the cursor directly before or after the image, which
    we want to prevent, as it is not a valid insert position for text.
    Instead, if we find the DOM selection in such a situation, then we map it to the
    closest valid model address. And this depends on the direction of movement.
    Moving `left` would provide the previous address, `right` would provide the next address.
    The default direction is `right`.
  */
  this._getCoordinate = function(node, offset, options) {
    // Trying to apply the most common situation first
    // and after that covering known edge cases
    var coor = TextPropertyComponent.getCoordinate(this.surface.el, node, offset);
    if (!coor) {
      coor = this._searchForCoordinate(node, offset, options);
    }
    return coor;
  };

  /*
    Map a DOM coordinate to a model coordinate via a brute-force search
    on all properties.

    This is used as a backup strategy for delicate DOM selections.

    @param {Node} node
    @param {number} offset
    @param {object} options
    @param {'left'|'right'} options.direction
    @returns {model/Coordinate} the coordinate
  */
  this._searchForCoordinate = function(node, offset, options) {
    options = options || {};
    var elements = this.surface.el.querySelectorAll('*[data-path]');
    var idx, idx1, idx2, cmp1, cmp2;
    idx1 = 0;
    idx2 = elements.length-1;
    cmp1 = _compareNodes(elements[idx1], node);
    cmp2 = _compareNodes(elements[idx2], node);
    while(true) {
      var l = idx2-idx1+1;
      if (cmp2 < 0) {
        idx = idx2;
        break;
      } else if (cmp1 > 0) {
        idx = idx1;
        break;
      } else if (l<=2) {
        idx = idx2;
        break;
      }
      var pivotIdx = idx1 + Math.floor(l/2);
      var pivotCmp = _compareNodes(elements[pivotIdx], node);
      if (pivotCmp < 0) {
        idx1 = pivotIdx;
        cmp1 = pivotCmp;
      } else {
        idx2 = pivotIdx;
        cmp2 = pivotCmp;
      }
    }
    var charPos;
    var doc = this.surface.getDocument();
    var path = _getPath(elements[idx]);
    var text = doc.get(path);
    if (options.direction === "left") {
      if (idx === 0) {
        charPos = 0;
      } else {
        path = _getPath(elements[idx-1]);
        text = doc.get(path);
        charPos = text.length;
      }
    } else if (cmp2<0) {
      charPos = text.length;
    } else {
      charPos = 0;
    }
    return new Coordinate(path, offset);
  };

  /*
    Computes a model range that encloses all properties
    spanned by a given DOM range.

    This is used in edge cases, where DOM selection anchors are not
    within TextProperties.

    @param {Range} range
    @returns {model/Range}
  */
  this._getEnclosingRange = function(wRange) {
    var frag = wRange.cloneContents();
    var props = frag.querySelectorAll('*[data-path]');
    if (props.length === 0) {
      return null;
    } else {
      var doc = this.doc;
      var first = props[0];
      var last = props[props.length-1];
      var startPath = _getPath(first);
      var text;
      if (first === last) {
        text = doc.get(startPath);
        return new Range(
          new Coordinate(startPath, 0),
          new Coordinate(startPath, text.length),
          false
        );
      } else {
        var endPath = _getPath(last);
        text = doc.get(endPath);
        return new Range(
          new Coordinate(startPath, 0),
          new Coordinate(endPath, text.length),
          false
        );
      }
    }
  };


  function _compareNodes(node1, node2) {
    var cmp = node1.compareDocumentPosition(node2);
    if (cmp&window.document.DOCUMENT_POSITION_FOLLOWING) {
      return -1;
    } else if (cmp&window.document.DOCUMENT_POSITION_PRECEDING) {
      return 1;
    } else {
      return 0;
    }
  }

  function _isReverse(anchorNode, anchorOffset, focusNode, focusOffset) {
    // the selection is reversed when the focus propertyEl is before
    // the anchor el or the computed charPos is in reverse order
    var reverse = false;
    if (focusNode && anchorNode) {
      var cmp = _compareNodes(focusNode, anchorNode);
      reverse = ( cmp < 0 || (cmp === 0 && focusOffset < anchorOffset) );
    }
    return reverse;
  }

  function _getPath(el) {
    if (el && el.dataset && el.dataset.path) {
      return el.dataset.path.split('.');
    }
  }

  /*
   Helper for creating a model range correctly
   as for model/Range start should be before end.

   In contrast to that, DOM selections are described with anchor and focus coordinates,
   i.e. bearing the information of direction implicitly.
   To simplify the implementation we treat anchor and focus equally
   and only at the end exploit the fact deriving an isReverse flag
   and bringing start and end in the correct order.
  */
  function _createRange(start, end, isReverse) {
    if (isReverse) {
      var tmp = start;
      start = end;
      end = tmp;
    }
    return new Range(start, end, isReverse);
  }

};

oo.initClass(DOMSelection);

module.exports = DOMSelection;
