'use strict';

var BlockNode = require('../../model/BlockNode');
var ParentNodeMixin = require('../../model/ParentNodeMixin');

// Note: we have chosen a semi-hierarchical model for lists
// consisting of one list wrapper with many list items.
// Nesting and type information is stored on the items.
// This will make life easier for editing.
// The wrapping list node helps us to create a scope for rendering, and
// import/export.
function List() {
  List.super.apply(this, arguments);
}

BlockNode.extend(List, ParentNodeMixin, function ListPrototype() {

  this.getChildrenProperty = function() {
    return 'items';
  };

  this.removeItem = function(id) {
    var doc = this.getDocument();
    var offset = this.items.indexOf(id);
    if (offset >= 0) {
      doc.update([this.id, 'items'], { "delete": { offset: offset } });
    } else {
      throw new Error('List item is not a child of this list: ' + id);
    }
  };

  this.insertItemAt = function(offset, id) {
    var doc = this.getDocument();
    doc.update([this.id, 'items'], { "insert": { offset: offset, value: id } });
  };

});

List.static.name = "list";

List.static.defineSchema({
  ordered: { type: "boolean", default: false },
  items: { type: ["id"], defaut: [] }
});

module.exports = List;
