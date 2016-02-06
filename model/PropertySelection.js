'use strict';

var isEqual = require('lodash/isEqual');
var isNumber = require('lodash/isNumber');
var Selection = require('./Selection');
var Coordinate = require('./Coordinate');

/* jshint latedef:nofunc */

/**
  A selection which is bound to a property. Implements {@link model/Selection}.

  @class
  @extends model/Selection

  @example

  ```js
  var propSel = doc.createSelection({
    type: 'property',
    path: ['p1', 'content'],
    startOffset: 3,
    endOffset: 6
  });
*/
function PropertySelection(path, startOffset, endOffset, reverse, surfaceId) {

  /**
    The path to the selected property.
    @type {String[]}
  */
  this.path = path;

  /**
    Start character position.
    @type {Number}
  */
  this.startOffset = startOffset;

  /**
    End character position.
    @type {Number}
  */
  this.endOffset = endOffset;

  /**
    Selection direction.
    @type {Boolean}
  */
  this.reverse = !!reverse;

  /**
    Identifier of the surface this selection should be active in.
    @type {String}
  */
  this.surfaceId = surfaceId;

  if (!path || !isNumber(startOffset)) {
    throw new Error('Invalid arguments: `path` and `startOffset` are mandatory');
  }
  this._internal = {
    // dynamic adapters for Coordinate oriented implementations
    start: new CoordinateAdapter(this, 'path', 'startOffset'),
    end: new CoordinateAdapter(this, 'path', 'endOffset'),
    // set when attached to document
    doc: null
  };
}

PropertySelection.Prototype = function() {

  /**
    Convert container selection to JSON.

    @returns {Object}
  */
  this.toJSON = function() {
    return {
      type: 'property',
      path: this.path,
      startOffset: this.startOffset,
      endOffset: this.endOffset,
      reverse: this.reverse,
      surfaceId: this.surfaceId
    };
  };

  /**
    @returns {Document} The attached document instance
  */
  this.getDocument = function() {
    var doc = this._internal.doc;
    if (!doc) {
      throw new Error('Selection is not attached to a document.');
    }
    return doc;
  };

  /**
    Attach document to a selection.

    @param {Document} doc document to attach
    @returns {Selection}
  */
  this.attach = function(doc) {
    this._internal.doc = doc;
    return this;
  };

  this.isPropertySelection = function() {
    return true;
  };

  this.isNull = function() {
    return false;
  };

  this.isCollapsed = function() {
    return this.startOffset === this.endOffset;
  };

  this.isReverse = function() {
    return this.reverse;
  };

  this.equals = function(other) {
    return (
      Selection.prototype.equals.call(this, other) &&
      (this.start.equals(other.start) && this.end.equals(other.end))
    );
  };

  this.toString = function() {
    return [
      "PropertySelection(", JSON.stringify(this.path), ", ",
        this.startOffset, " -> ", this.endOffset,
        (this.reverse?", reverse":""),
      ")"
    ].join('');
  };

  /**
    Collapse a selection to chosen direction.

    @param {String} direction either left of right
    @returns {PropertySelection}
  */
  this.collapse = function(direction) {
    var offset;
    if (direction === 'left') {
      offset = this.startOffset;
    } else {
      offset = this.endOffset;
    }
    return this.createWithNewRange(offset, offset);
  };

  // Helper Methods
  // ----------------------

  /**
    Get path of a selection, e.g. target property where selected data is stored.

    @returns {String[]} path
  */
  this.getPath = function() {
    return this.path;
  };

  /**
    Get start character position.

    @returns {Number} offset
  */
  this.getStartOffset = function() {
    return this.startOffset;
  };

  /**
    Get end character position.

    @returns {Number} offset
  */
  this.getEndOffset = function() {
    return this.endOffset;
  };

  /**
    Checks if this selection is inside another one.

    @param {Selection} other
    @param {Boolean} [strict] true if should check that it is strictly inside the other
    @returns {Boolean}
  */
  this.isInsideOf = function(other, strict) {
    if (other.isNull()) return false;
    if (other.isContainerSelection()) {
      // console.log('PropertySelection.isInsideOf: delegating to ContainerSelection.contains...');
      return other.contains(this);
    }
    if (strict) {
      return (isEqual(this.path, other.path) &&
        this.startOffset > other.startOffset &&
        this.endOffset < other.endOffset);
    } else {
      return (isEqual(this.path, other.path) &&
        this.startOffset >= other.startOffset &&
        this.endOffset <= other.endOffset);
    }
  };

  /**
    Checks if this selection contains another one.

    @param {Selection} other
    @param {Boolean} [strict] true if should check that it is strictly contains the other
    @returns {Boolean}
  */
  this.contains = function(other, strict) {
    if (other.isNull()) return false;
    if (other.isContainerSelection()) {
      // console.log('PropertySelection.contains: delegating to ContainerSelection.isInsideOf...');
      return other.isInsideOf(this);
    }
    if (strict) {
      return (isEqual(this.path, other.path) &&
        this.startOffset < other.startOffset &&
        this.endOffset > other.endOffset);
    } else {
      return (isEqual(this.path, other.path) &&
        this.startOffset <= other.startOffset &&
        this.endOffset >= other.endOffset);
    }
  };

  /**
    Checks if this selection overlaps another one.

    @param {Selection} other
    @param {Boolean} [strict] true if should check that it is strictly overlaps the other
    @returns {Boolean}
  */
  this.overlaps = function(other, strict) {
    if (other.isNull()) return false;
    if (other.isContainerSelection()) {
      // console.log('PropertySelection.overlaps: delegating to ContainerSelection.overlaps...');
      return other.overlaps(this);
    }
    if (!isEqual(this.path, other.path)) return false;
    if (strict) {
      return (! (this.startOffset>=other.endOffset||this.endOffset<=other.startOffset) );
    } else {
      return (! (this.startOffset>other.endOffset||this.endOffset<other.startOffset) );
    }
  };

  /**
    Checks if this selection has the right boundary in common with another one.

    @param {Selection} other
    @returns {Boolean}
  */
  this.isRightAlignedWith = function(other) {
    if (other.isNull()) return false;
    if (other.isContainerSelection()) {
      // console.log('PropertySelection.isRightAlignedWith: delegating to ContainerSelection.isRightAlignedWith...');
      return other.isRightAlignedWith(this);
    }
    return (isEqual(this.path, other.path) &&
      this.endOffset === other.endOffset);
  };

  /**
    Checks if this selection has the left boundary in common with another one.

    @param {Selection} other
    @returns {Boolean}
  */
  this.isLeftAlignedWith = function(other) {
    if (other.isNull()) return false;
    if (other.isContainerSelection()) {
      // console.log('PropertySelection.isLeftAlignedWith: delegating to ContainerSelection.isLeftAlignedWith...');
      return other.isLeftAlignedWith(this);
    }
    return (isEqual(this.path, other.path) &&
      this.startOffset === other.startOffset);
  };

  /**
    Expands selection to include another selection.

    @param {Selection} other
    @returns {Selection} a new selection
  */
  this.expand = function(other) {
    if (other.isNull()) return this;
    if (other.isContainerSelection()) {
      // console.log('PropertySelection.expand: delegating to ContainerSelection.expand...');
      return other.expand(this);
    }
    if (!isEqual(this.path, other.path)) {
      throw new Error('Can not expand PropertySelection to a different property.');
    }
    var newStartOffset = Math.min(this.startOffset, other.startOffset);
    var newEndOffset = Math.max(this.endOffset, other.endOffset);
    return this.createWithNewRange(newStartOffset, newEndOffset);
  };

  /**
    Creates a new selection with given range and same path.

    @param {Number} startOffset
    @param {Number} endOffset
    @returns {Selection} a new selection
  */
  this.createWithNewRange = function(startOffset, endOffset) {
    var sel = new PropertySelection(this.path, startOffset, endOffset, false, this.surfaceId);
    var doc = this._internal.doc;
    if (doc) {
      sel.attach(doc);
    }
    return sel;
  };

  /**
    Creates a new selection by truncating this one by another selection.

    @param {Selection} other
    @returns {Selection} a new selection
  */
  this.truncate = function(other) {
    if (other.isNull()) return this;
    // Checking that paths are ok
    // doing that in a generalized manner so that other can even be a ContainerSelection
    if (!isEqual(this.startPath, other.startPath) ||
      !isEqual(this.endPath, other.endPath)) {
      throw new Error('Can not expand PropertySelection to a different property.');
    }
    var newStartOffset;
    var newEndOffset;
    if (this.startOffset === other.startOffset) {
      newStartOffset = other.endOffset;
      newEndOffset = this.endOffset;
    } else if (this.endOffset === other.endOffset) {
      newStartOffset = this.startOffset;
      newEndOffset = other.startOffset;
    }
    return this.createWithNewRange(newStartOffset, newEndOffset);
  };

  /**
    Return fragments for a given selection.

    @returns {Selection.Fragment[]}
  */
  this.getFragments = function() {
    if (this.isCollapsed()) {
      return [new Selection.Cursor(this.path, this.startOffset)];
    } else {
      return [new Selection.Fragment(this.path, this.startOffset, this.endOffset)];
    }
  };
};

Selection.extend(PropertySelection);

Object.defineProperties(PropertySelection.prototype, {
  /**
    @property {Coordinate} PropertySelection.start
  */
  start: {
    get: function() {
      return this._internal.start;
    },
    set: function() { throw new Error('immutable.'); }
  },
  /**
    @property {Coordinate} PropertySelection.end
  */
  end: {
    get: function() {
      return this._internal.end;
    },
    set: function() { throw new Error('immutable.'); }
  },

  // making this similar to ContainerSelection
  startPath: {
    get: function() {
      return this.path;
    },
    set: function() { throw new Error('immutable.'); }
  },
  endPath: {
    get: function() {
      return this.path;
    },
    set: function() { throw new Error('immutable.'); }
  },
});

PropertySelection.fromJSON = function(json) {
  var path = json.path;
  var startOffset = json.startOffset;
  var endOffset = json.hasOwnProperty('endOffset') ? json.endOffset : json.startOffset;
  var reverse = json.reverse;
  var surfaceId = json.surfaceId;
  return new PropertySelection(path, startOffset, endOffset, reverse, surfaceId);
};

/*
  Adapter for Coordinate oriented implementations.
  E.g. Coordinate transforms can be applied to update selections
  using OT.
*/
function CoordinateAdapter(propertySelection, pathProperty, offsetProperty) {
  this._sel = propertySelection;
  this._pathProp = pathProperty;
  this._offsetProp = offsetProperty;
}

Coordinate.extend(CoordinateAdapter);

Object.defineProperties(CoordinateAdapter.prototype, {
  path: {
    get: function() {
      return this._sel[this._pathProp];
    },
    set: function(path) {
      this._sel[this._pathProp] = path;
    }
  },
  offset: {
    get: function() {
      return this._sel[this._offsetProp];
    },
    set: function(offset) {
      this._sel[this._offsetProp] = offset;
    }
  }
});

PropertySelection.CoordinateAdapter = CoordinateAdapter;

module.exports = PropertySelection;
