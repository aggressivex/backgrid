/*
  backgrid
  http://github.com/wyuenho/backgrid

  Copyright (c) 2013 Jimmy Yuen Ho Wong and contributors
  Licensed under the MIT @license.
*/

/**
   Row is a simple container view that takes a model instance and a list of
   column metadata describing how each of the model's attribute is to be
   rendered, and apply the appropriate cell to each attribute.

   @class Backgrid.Row
   @extends Backbone.View
*/
var Row = Backgrid.Row = Backbone.View.extend({

  /** @property */
  tagName: "tr",

  initOptionRequires: ["columns", "model"],

  /**
     Initializes a row view instance.

     @param {Object} options
     @param {Backbone.Collection.<Backgrid.Column>|Array.<Backgrid.Column>|Array.<Object>} options.columns Column metadata.
     @param {Backbone.Model} options.model The model instance to render.

     @throws {TypeError} If options.columns or options.model is undefined.
  */
  initialize: function (options) {

    Backgrid.requireOptions(options, this.initOptionRequires);

    var columns = this.columns = options.columns;
    if (!(columns instanceof Backbone.Collection)) {
      columns = this.columns = new Columns(columns);
    }

    var cells = this.cells = [];
    for (var i = 0, l = columns.length; i < l; i++) {
      cells.push(this.makeCell(columns.models[i], options));
    }

    this.listenTo(columns, "change:renderable", this._onColumnChangeRenderable);
    this.listenTo(columns, "add", this._onColumnAdd);
    this.listenTo(columns, "remove", this._onColumnRemove);
  },

  _onColumnChangeRenderable: function (column, renderable) {
    var cells = this.cells;
    for (var i = 0, l = cells.length; i < l; i++) {
      var cell = cells[i];
      if (cell.column.get("name") == column.get("name")) {
        if (renderable) cell.$el.show(); else cell.$el.hide();
      }
    }
  },

  _onColumnAdd: function (column, columns) {
    var i = columns.indexOf(column);
    var cells = this.cells;
    var cell = this.makeCell(column, this.options);
    cells.splice(i, 0, cell);

    if (!cell.column.get("renderable")) cell.$el.hide();

    var $el = this.$el;
    if (i === 0) {
      $el.prepend(cell.render().$el);
    }
    else if (i === columns.length - 1) {
      $el.append(cell.render().$el);
    }
    else {
      $el.children().eq(i).before(cell.render().$el);
    }
  },

  _onColumnRemove: function (column, columns, opts) {
    var cells = this.cells;
    cells[opts.index].remove();
    cells.splice(opts.index, 1);
  },

  /**
     Factory method for making a cell. Used by #initialize internally. Override
     this to provide an appropriate cell instance for a custom Row subclass.

     @protected

     @param {Backgrid.Column} column
     @param {Object} options The options passed to #initialize.

     @return {Backgrid.Cell}
  */
  makeCell: function (column) {
    return new (column.get("cell"))({
      column: column,
      model: this.model
    });
  },

  /**
     Renders a row of cells for this row's model.
  */
  render: function (model) {
    var el = this.el;
    var firstChild = el.firstChild;
    while(firstChild = el.firstChild) {
      el.removeChild(firstChild);
    }

    if (model && model != this.model) {
      this.stopListening(this.model);
      this.model = model;
    }

    var cells = this.cells;
    var fragment = document.createDocumentFragment();
    for (var i = 0, l = cells.length; i < l; i++) {
      var cell = cells[i];
      fragment.appendChild(cell.render(model).el);
    }
    el.appendChild(fragment);

    if (this.events) this.delegateEvents();

    return this;
  },

  /**
     Clean up this row and its cells.
  */
  remove: function () {
    Backbone.View.prototype.remove.apply(this, arguments);
    var cells = this.cells;
    for (var i = 0, l = cells.length; i < l; i++) {
      cells[i].remove(arguments);
    }
    return this;
  }

});

/**
   EmptyRow is a simple container view that takes a list of column and render a
   row with a single column.

   @class Backgrid.EmptyRow
   @extends Backbone.View
*/
var EmptyRow = Backgrid.EmptyRow = Backbone.View.extend({

  /** @property */
  tagName: "tr",

  /** @property */
  emptyText: null,

  /**
     Initializer.

     @param {Object} options
     @param {string} options.emptyText
     @param {Backbone.Collection.<Backgrid.Column>|Array.<Backgrid.Column>|Array.<Object>} options.columns Column metadata.
  */
  initialize: function (options) {
    Backgrid.requireOptions(options, ["emptyText", "columns"]);

    this.emptyText = options.emptyText;
    this.columns =  options.columns;
  },

  /**
     Renders an empty row.
  */
  render: function () {
    this.$el.empty();

    var td = document.createElement("td");
    td.setAttribute("colspan", this.columns.length);
    td.textContent = this.emptyText;
    this.el.appendChild(td);

    this.el.className = "empty";

    return this;
  }
});
