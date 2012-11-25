/*
  backgrid
  http://github.com/wyuenho/backgrid

  Copyright (c) 2012 Jimmy Yuen Ho Wong
  Licensed under the MIT @license.
*/
(function (root, $, _, Backbone) {

  var Backgrid = root.Backgrid = {
    VERSION: "0.1"
  };

  // Monkey-patch Backbone <= 0.9.2 with dispose() on the View
  if (!Backbone.View.prototype.dispose) {
    _.extend(Backbone.View.prototype, {
      dispose: function() {
        this.undelegateEvents();
        if (this.model && this.model.off) {
          this.model.off(null, null, this);
        }
        if (this.collection && this.collection.off) {
          this.collection.off(null, null, this);
        }
        return this;
      },
      remove: function() {
        this.dispose();
        this.$el.remove();
        return this;
      }
    });
  }

  function trim(s) {
    if (String.prototype.trim) {
      return String.prototype.trim.call(s, s);
    } else {
      return s.replace(/^\s+|\s+$/g, "");
    }
  }

  function capitalize(s) {
    return String.fromCharCode(s.charCodeAt(0) - 32) + s.slice(1);
  }

  function lpad(str, length, padstr) {
    var paddingLen = length - (str + "").length;
    paddingLen = paddingLen < 0 ? 0 : paddingLen;
    var padding = "";
    for (var i = 0; i < paddingLen; i++) {
      padding += padstr;
    }
    return padding + str;
  }

  /**
   Just a convenient class for interested parties to subclass.

   The default Cell classes don't require the formatter to be a subclass of
   Formatter as long as the fromRaw(rawData) and toRaw(formattedData) methods
   are defined.

   @abstract
   @class Backgrid.Formatter
*/
  var Formatter = Backgrid.Formatter = function() {};

  _.extend(Formatter.prototype, {
    /**
     Takes a raw value from a model and returns a formatted string for display.

     @member Backgrid.Formatter
     @param {*} rawData
     @return {string}
  */
    fromRaw: function(rawData) {
      return rawData;
    },
    /**
     Takes a formatted string, usually from user input, and returns a
     appropriately typed value for persistence in the model.

     If the user input is invalid or unable to be converted to a raw value
     suitable for persistence in the model, toRaw must return `undefined`.

     @member Backgrid.Formatter
     @param {string} formattedData
     @return {*|undefined}
  */
    toRaw: function(formattedData) {
      return formattedData;
    }
  });

  /**
   A floating point number formatter. Doesn't understand notation at the moment.

   @class Backgrid.NumberFormatter
   @extends Backgrid.Formatter
   @param {Object} options
   @param {number} [options.decimals=2] Number of decimals to display. Must be an integer.
   @param {string} [options.decimalSeparator='.'] The separator to use when
   displaying decimals.
   @param {string} [options.orderSeparator=','] The separator to use to
   separator thousands. May be an empty string.

   @throws {RangeError} If decimals < 0 or > 20.
*/
  var NumberFormatter = Backgrid.NumberFormatter = function(options) {
    options = options ? _.clone(options) : {};
    _.extend(this, this.defaults, options);
    if (this.decimals < 0 || this.decimals > 20) {
      throw new RangeError("decimals must be between 0 and 20");
    }
  };

  NumberFormatter.prototype = new Formatter();

  _.extend(NumberFormatter.prototype, {
    defaults: {
      decimals: 2,
      decimalSeparator: ".",
      orderSeparator: ","
    },
    HUMANIZED_NUM_RE: /(\d)(?=(?:\d{3})+$)/g,
    /**
     Takes a floating point number and convert it to a formatted string where
     every thousand is separated by `orderSeparator`, with a `decimal` number of
     decimals separated by `decimalSeparator`. The number returned is rounded
     the usual way.

     @member Backgrid.NumberFormatter
     @param {number} number
     @return {string}
  */
    fromRaw: function(number) {
      if (isNaN(number) || null === number) {
        return "";
      }
      number = number.toFixed(~~this.decimals);
      var parts = number.split(".");
      var integerPart = parts[0];
      var decimalPart = parts[1] ? (this.decimalSeparator || ".") + parts[1] : "";
      return integerPart.replace(this.HUMANIZED_NUM_RE, "$1" + this.orderSeparator) + decimalPart;
    },
    /**
     Takes a string, possibly formatted with `orderSeparator` and/or
     `decimalSeparator`, and convert it back to a number.

     @member Backgrid.NumberFormatter
     @param {string} formattedData
     @return {number|undefined} Undefined if the string cannot be converted to
     a number.
  */
    toRaw: function(formattedData) {
      var rawData = "";
      var thousands = trim(formattedData).split(this.orderSeparator);
      for (var i = 0; i < thousands.length; i++) {
        rawData += thousands[i];
      }
      var decimalParts = rawData.split(this.decimalSeparator);
      rawData = "";
      for (var i = 0; i < decimalParts.length; i++) {
        rawData = rawData + decimalParts[i] + ".";
      }
      if ("." === rawData[rawData.length - 1]) {
        rawData = rawData.slice(0, rawData.length - 1);
      }
      var result = 1 * (1 * rawData).toFixed(~~this.decimals);
      if (_.isNumber(result) && !_.isNaN(result)) {
        return result;
      } else {
        return void 0;
      }
    }
  });

  /**
   Formatter to converts between various datetime string formats.

   This class only understands ISO-8601 formatted datetime strings. If a
   timezone is specified, it must be an offset.

   @class Backgrid.DatetimeFormatter
   @extends Backgrid.Formatter

   @param {Object} options
   @param {boolean} [options.includeDate=true] Whether the values include the
   date part.
   @param {boolean} [options.includeTime=true] Whether the values include the
   time part.
   @param {boolean} [options.includeMilli=false] If `includeTime` is true,
   whether to include the millisecond part.

   @throws {Error} If both `includeDate` and `includeTime` are false.
*/
  var DatetimeFormatter = Backgrid.DatetimeFormatter = function(options) {
    options = options ? _.clone(options) : {};
    _.extend(this, this.defaults, options);
    if (!this.includeDate && !this.includeTime) {
      throw new Error("Either includeDate or includeTime must be true");
    }
  };

  DatetimeFormatter.prototype = new Formatter();

  _.extend(DatetimeFormatter.prototype, {
    defaults: {
      includeDate: true,
      includeTime: true,
      includeMilli: false
    },
    DATE_RE: /^([+\-]?\d{4})-(\d{2})-(\d{2})$/,
    TIME_RE: /^(\d{2}):(\d{2}):(\d{2})(\.\d{3})?$/,
    ZONE_RE: /^([+\-]\d{2}):?(\d{2})$/,
    ISO_SPLITTER_RE: /T|Z| +/,
    /**
     Converts an ISO-8601 formatted datetime string, possibly with a timezone,
     to a datetime string, date string or a time string in the __local
     timezone__, depending on the options supplied to this formatter instance at
     construction.

     @member Backgrid.DatetimeFormatter
     @param {string} rawData
     @return {string} ISO-8601 string. Always in local time.
  */
    fromRaw: function(rawData) {
      rawData = trim(rawData);
      var parts = rawData.split(this.ISO_SPLITTER_RE) || [];
      var date = this.includeDate ? parts[0] : "";
      var time = this.includeDate ? parts[1] : parts[0] || "";
      var zone = this.includeDate ? parts[2] : parts[1] || "";
      var YYYYMMDD = this.DATE_RE.exec(date) || [];
      var HHmmssSSS = this.TIME_RE.exec(time) || [];
      var zzZZ = this.ZONE_RE.exec(zone) || [];
      zzZZ[1] = 1 * zzZZ[1] || 0;
      zzZZ[2] = 1 * zzZZ[2] || 0;
      var jsDate = new Date(Date.UTC(1 * YYYYMMDD[1] || 0, 1 * YYYYMMDD[2] - 1 || 0, 1 * YYYYMMDD[3] || 0, (1 * HHmmssSSS[1] || null) + zzZZ[1], (1 * HHmmssSSS[2] || null) + zzZZ[2], 1 * HHmmssSSS[3] || null, 1 * HHmmssSSS[4] || null));
      var result = "";
      if (this.includeDate) {
        result = lpad(jsDate.getFullYear(), 4, 0) + "-" + lpad(jsDate.getMonth() + 1, 2, 0) + "-" + lpad(jsDate.getDate(), 2, 0);
      }
      if (this.includeTime) {
        result = result + " " + lpad(jsDate.getHours(), 2, 0) + ":" + lpad(jsDate.getMinutes(), 2, 0) + ":" + lpad(jsDate.getSeconds(), 2, 0);
        if (this.includeMilli) {
          result = result + "." + lpad(jsDate.getMilliseconds(), 3, 0);
        }
      }
      return result;
    },
    /**
     Converts a datetime, date or time string, to an ISO-8601 formatted
     datetime, date or time string, depending on the options supplied to this
     formatter instance at construction. If the string input does not include a
     time zone offset, the string is assumed to denote a local time, otherwise
     the date and time part are assumed to be in UTC.

     @member Backgrid.DatetimeFormatter
     @param {string} formattedData
     @return {string|undefined} ISO-8601 string. Undefined if unable to convert
     to an ISO-8601 string.
  */
    toRaw: function(formattedData) {
      formattedData = trim(formattedData);
      var parts = formattedData.split(this.ISO_SPLITTER_RE) || [];
      var date = this.includeDate ? parts[0] : "";
      var time = this.includeDate ? parts[1] : parts[0] || "";
      var zone = this.includeDate ? parts[2] : parts[1] || "";
      var YYYYMMDD = this.DATE_RE.exec(date) || [];
      var HHmmssSSS = this.TIME_RE.exec(time) || [];
      var zzZZ = this.ZONE_RE.exec(zone) || [];
      if (this.includeDate && _.isUndefined(YYYYMMDD[0])) {
        return void 0;
      }
      if (this.includeTime && _.isUndefined(HHmmssSSS[0])) {
        return void 0;
      }
      if (!this.includeDate && date) {
        return void 0;
      }
      if (!this.includeTime && time) {
        return void 0;
      }
      var jsDate = null;
      if (zzZZ && !_.isUndefined(zzZZ[0])) {
        zzZZ[1] = 1 * zzZZ[1] || 0;
        zzZZ[2] = 1 * zzZZ[2] || 0;
        jsDate = new Date(Date.UTC(1 * YYYYMMDD[1] || 0, 1 * YYYYMMDD[2] - 1 || 0, 1 * YYYYMMDD[3] || 0, (1 * HHmmssSSS[1] || null) + zzZZ[1], (1 * HHmmssSSS[2] || null) + zzZZ[2], 1 * HHmmssSSS[3] || null, 1 * HHmmssSSS[4] || null));
      } else {
        jsDate = new Date(1 * YYYYMMDD[1] || 0, 1 * YYYYMMDD[2] - 1 || 0, 1 * YYYYMMDD[3] || 0, 1 * HHmmssSSS[1] || null, 1 * HHmmssSSS[2] || null, 1 * HHmmssSSS[3] || null, 1 * HHmmssSSS[4] || null);
      }
      var result = "";
      if (this.includeDate) {
        result = lpad(jsDate.getUTCFullYear(), 4, 0) + "-" + lpad(jsDate.getUTCMonth() + 1, 2, 0) + "-" + lpad(jsDate.getUTCDate(), 2, 0);
      }
      if (this.includeTime) {
        if (this.includeDate) {
          result += "T";
        }
        result += lpad(jsDate.getUTCHours(), 2, 0) + ":" + lpad(jsDate.getUTCMinutes(), 2, 0) + ":" + lpad(jsDate.getUTCSeconds(), 2, 0);
        if (this.includeMilli) {
          result = result + "." + lpad(jsDate.getUTCMilliseconds(), 3, 0);
        }
        if (this.includeDate) {
          result += "Z";
        }
      }
      return result;
    }
  });

  /**
   Generic cell editor base class. Only defines an initializer for a number of
   required parameters.

   @abstract
   @class Backgrid.CellEditor
   @extends Backbone.View
*/
  var CellEditor = Backgrid.CellEditor = Backbone.View.extend({
    /**
     Initializer.

     @param {Object} options
     @param {*} options.parent
     @param {Backgrid.Formatter} options.formatter
     @param {Backgrid.Column} options.column
     @param {Backbone.Model} options.model
  */
    initialize: function(options) {
      Backbone.View.prototype.initialize.apply(this, arguments);
      this.parent = options.parent;
      this.formatter = options.formatter;
      this.column = options.column;
      if (!this.formatter) {
        throw new Error("formatter is required");
      }
      if (!this.column) {
        throw new Error("column is required");
      }
      if (this.parent && this.parent.on) {
        this.parent.on("editing", this.postRender, this);
      }
    },
    dispose: function() {
      this.column.off(null, null, this);
      if (this.parent && this.parent.off) {
        this.parent.off(null, null, this);
      }
      return Backbone.View.prototype.dispose.apply(this, arguments);
    },
    /**
     Post-rendering setup and initialization. Focuses the cell editor's `el` in
     this default implementation. **Should** be called by Cell classes after
     calling Backgrid.CellEditor#render.
  */
    postRender: function() {
      this.$el.focus();
      return this;
    }
  });

  /**
   A CellEditor subclass that uses a contenteditable `div` tag as the editing
   area. Used by most built-in cell types.

   @class Backgrid.DivCellEditor
   @extends Backgrid.CellEditor
*/
  var DivCellEditor = Backgrid.DivCellEditor = CellEditor.extend({
    /** @property */
    tagName: "div",
    /** @property */
    attributes: {
      contenteditable: "true"
    },
    /** @property */
    events: {
      blur: "saveOrCancel",
      keydown: "saveOrCancel"
    },
    /**
     Initializer. Removes this `el` from the DOM when a `done` event is
     triggered.

     @param {Object} options
     @param {Backgrid.Formatter} options.formatter
     @param {Backgrid.Column} options.column
     @param {Backbone.Model} options.model
  */
    initialize: function(options) {
      CellEditor.prototype.initialize.apply(this, arguments);
      this.on("done", this.remove, this);
    },
    /**
     Renders this editor.
  */
    render: function() {
      this.$el.text(this.formatter.fromRaw(this.model.get(this.column.get("name"))));
      return this;
    },
    /**
     Focuses the editor and moves the caret inside and to the end of the text.
     See Backgrid.CellEditor#postRender.
  */
    postRender: function() {
      this.$el.focus();
      if ("undefined" !== typeof window.getSelection && "undefined" !== typeof document.createRange) {
        var rng = document.createRange();
        rng.selectNodeContents(this.el);
        rng.collapse(false);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(rng);
      }
      if ("undefined" !== typeof document.body.createTextRange) {
        var txtRng = document.body.createTextRange();
        txtRng.moveToElementText(this.el);
        txtRng.collapse(false);
        txtRng.select();
      }
      return this;
    },
    /**
     If the key pressed is `enter` or `tab`, converts the value in the editor to
     a raw value for the model using the formatter.

     If the key pressed is `esc` or the event type is `blur`, undo the changes.

     Triggers a Backbone `done` event when successful. `error` if the value
     cannot be converted. Classes listening to the `error` event, usually the
     Cell classes, should respond appropriately, usually by rendering some kind
     of error feedback.

     @param {Event} e
  */
    saveOrCancel: function(e) {
      if ("keydown" === e.type) {
        // enter or tab
        if (13 === e.keyCode || 9 === e.keyCode) {
          e.preventDefault();
          var valueToSet = this.formatter.toRaw(this.$el.text());
          if ("undefined" === typeof valueToSet) {
            this.trigger("error");
            return;
          }
          if (this.model.set(this.column.get("name"), valueToSet)) {
            this.trigger("done");
          } else {
            this.trigger("error");
          }
        } else {
          if (27 === e.keyCode) {
            // undo
            e.stopPropagation();
            this.$el.text(this.formatter.fromRaw(this.model.get(this.column.get("name"))));
            this.trigger("done");
          }
        }
      } else {
        if ("blur" === e.type) {
          this.$el.text(this.formatter.fromRaw(this.model.get(this.column.get("name"))));
          this.trigger("done");
        }
      }
    },
    remove: function() {
      Backbone.View.prototype.remove.apply(this, arguments);
      // FF inexplicably still place a blanking caret at the beginning of the
      // parent's text after this editor element has been removed from the DOM
      if ("undefined" !== typeof window.getSelection) {
        var sel = window.getSelection();
        sel.removeAllRanges();
      }
      return this;
    }
  });

  /**
   The super-class for all Cell types. By default, this class renders a plain
   table cell with the model value converted to a string using the
   formatter. The table cell is clickable, upon which the cell will go into
   editor mode, which is rendered by a Backgrid.DivCellEditor instance by
   default. Upon any formatting errors, this class will add a `error` CSS class
   to the table cell.

   @abstract
   @class Backgrid.Cell
   @extends Backbone.View
*/
  var Cell = Backgrid.Cell = Backbone.View.extend({
    /** @property */
    tagName: "td",
    /**
     @property {Backgrid.Formatter|Object|string} [formatter=new Formatter()]
  */
    formatter: new Formatter(),
    /**
     @property {Backgrid.CellEditor} [editor=DivCellEditor] The default editor for all cell
     instances of this class. This value must be a class, it will be
     automatically instantiated upon entering edit mode.

     See Backgrid.CellEditor.
  */
    editor: DivCellEditor,
    /** @property */
    events: {
      click: "enterEditMode"
    },
    /**
     Initializer.

     @param {Object} options
     @param {Backbone.Model} options.model
     @param {Backgrid.Column} options.column
     @param {Backgrid.CellEditor} [options.editor]
     @param {Backgrid.Formatter} [options.formatter]

     @throws {ReferenceError} If formatter is a string but a formatter class of
     said name cannot be found in the Backgrid module.
  */
    initialize: function(options) {
      Backbone.View.prototype.initialize.apply(this, arguments);
      this.column = options.column;
      if (!this.column instanceof Column) {
        this.column = new Column(this.column);
      }
      this.editor = options.editor || this.editor;
      this.formatter = options.formatter || this.column.get("formatter") || this.formatter;
      if (_.isString(this.formatter)) {
        var formatter = Backgrid[capitalize(this.formatter) + "Formatter"];
        if (_.isUndefined(formatter)) {
          throw new ReferenceError("Formatter type '" + this.formatter + "' not found");
        } else {
          this.formatter = new formatter();
        }
      }
    },
    dispose: function() {
      if (this.currentEditor) {
        this.exitEditMode();
      }
      this.column.off(null, null, this);
      if (this.parent && this.parent.off) {
        this.parent.off(null, null, this);
      }
      return Backbone.View.prototype.dispose.apply(this, arguments);
    },
    /**
     Render a text string in a table cell. The text is converted from the
     model's raw value for this cell's column.
  */
    render: function() {
      this.$el.empty().text(this.formatter.fromRaw(this.model.get(this.column.get("name"))));
      return this;
    },
    /**
     If this column is editable, a new CellEditor instance is instantiated with
     its required parameters and listens on the editor's `done` and `error`
     events. When the editor is `done`, edit mode is exited. When the editor
     triggers an `error` event, it means the editor is unable to convert the
     current user input to an apprpriate value for the model's column. An
     `editor` CSS class is added to the cell upon entering edit mode.
  */
    enterEditMode: function(e) {
      if (this.column.get("editable")) {
        this.currentEditor = new this.editor({
          parent: this,
          column: this.column,
          model: this.model,
          formatter: this.formatter
        });
        /**
         Backbone Event. Fired when a cell is entering edit mode and an editor
         instance has been constructed, but before it is rendered and inserted
         into the DOM.

         @event edit
         @param {Backgrid.Cell} cell This cell instance.
         @param {Backgrid.CellEditor} editor The cell editor constructed.
       */
        this.trigger("edit", this, this.currentEditor);
        this.currentEditor.on("done", this.exitEditMode, this);
        this.currentEditor.on("error", this.renderError, this);
        this.$el.empty();
        this.undelegateEvents();
        this.$el.append(this.currentEditor.render().$el);
        this.$el.addClass("editor");
        /**
         Backbone Event. Fired when a cell has finished switching to edit mode.

         @event editing
         @param {Backgrid.Cell} cell This cell instance.
         @param {Backgrid.CellEditor} editor The cell editor constructed.
       */
        this.trigger("editing", this, this.currentEditor);
      }
    },
    /**
     Put an `error` CSS class on the table cell.
  */
    renderError: function() {
      this.$el.addClass("error");
    },
    /**
     Removes the editor and re-render in display mode.
  */
    exitEditMode: function() {
      this.$el.removeClass("error");
      this.currentEditor.off(null, null, this);
      this.currentEditor.remove();
      delete this.currentEditor;
      this.$el.removeClass("editor");
      this.render();
      this.delegateEvents();
    },
    remove: function() {
      Backbone.View.prototype.remove.apply(this, arguments);
      if (this.currentEditor) {
        this.currentEditor.remove();
        delete this.currentEditor;
      }
    }
  });

  /**
   StringCell displays HTML escaped strings and accepts anything typed in.

   @class Backgrid.StringCell
   @extends Backgrid.Cell
*/
  var StringCell = Backgrid.StringCell = Cell.extend({
    /** @property */
    className: "string-cell",
    formatter: {
      fromRaw: function(rawData) {
        return _.escape(rawData);
      },
      toRaw: function(formattedData) {
        return formattedData;
      }
    }
  });

  /**
   UriCell renders an HTML <a> anchor for the value and accepts URIs as user
   input values. A URI input is URI encoded using `encodeURI()` before writing
   to the underlying model.

   @class Backgrid.UriCell
   @extends Backgrid.Cell
*/
  var UriCell = Backgrid.UriCell = Cell.extend({
    /** @property */
    className: "uri-cell",
    formatter: {
      fromRaw: function(rawData) {
        return rawData;
      },
      toRaw: function(formattedData) {
        return encodeURI(formattedData);
      }
    },
    render: function() {
      this.$el.empty();
      var formattedValue = this.formatter.fromRaw(this.model.get(this.column.get("name")));
      this.$el.append($("<a>", {
        href: formattedValue,
        title: formattedValue,
        target: "_blank"
      }).text(formattedValue));
      return this;
    }
  });

  /**
   Like Backgrid.UriCell, EmailCell renders an HTML <a> anchor for the
   value. The `href` in the anchor is prefixed with `mailto:`. EmailCell will
   complain if the user enters a string that doesn't contain the `@` sign.

   @class Backgrid.EmailCell
   @extends Backgrid.Cell
*/
  var EmailCell = Backgrid.EmailCell = Cell.extend({
    /** @property */
    className: "email-cell",
    formatter: {
      fromRaw: function(rawData) {
        return rawData;
      },
      toRaw: function(formattedData) {
        return formattedData.indexOf("@") === -1 ? void 0 : formattedData;
      }
    },
    render: function() {
      this.$el.empty();
      var formattedValue = this.formatter.fromRaw(this.model.get(this.column.get("name")));
      this.$el.append($("<a>", {
        href: "mailto:" + formattedValue,
        title: formattedValue,
        target: "_blank"
      }).text(formattedValue));
      return this;
    }
  });

  /**
   NumberCell is a generic cell that renders all numbers. Numbers are formatted
   using Backgrid.NumberFormatter.

   @class Backgrid.NumberCell
   @extends Backgrid.Cell

   See:

   - Backgrid.NumberFormatter
*/
  var NumberCell = Backgrid.NumberCell = Cell.extend({
    /** @property */
    className: "number-cell",
    /**
     @property {number} [decimals=2] Must be an integer.
  */
    decimals: NumberFormatter.prototype.defaults.decimals,
    /** @property {string} [decimalSeparator='.'] */
    decimalSeparator: NumberFormatter.prototype.defaults.decimalSeparator,
    /** @property {string} [orderSeparator=','] */
    orderSeparator: NumberFormatter.prototype.defaults.orderSeparator,
    /**
     Initializer.

     @param {Object} options
     @param {Backbone.Model} options.model
     @param {Backgrid.Column} options.column
     @param {Backgrid.CellEditor} [options.editor]
     @param {Backgrid.Formatter} [options.formatter]
     @param {number} [options.decimals] Must be an integer.
     @param {string} [options.decimalSeparator]
     @param {string} [options.orderSeparator]
  */
    initialize: function(options) {
      Cell.prototype.initialize.apply(this, arguments);
      if (options) {
        this.decimals = _.isUndefined(options.decimals) ? this.decimals : options.decimals;
        this.decimalSeparator = _.isUndefined(options.decimalSeparator) ? this.decimalSeparator : options.decimalSeparator;
        this.orderSeparator = _.isUndefined(options.orderSeparator) ? this.orderSeparator : options.orderSeparator;
      }
      this.formatter = options.formatter || this.column.get("formatter") || new NumberFormatter({
        decimals: this.decimals,
        decimalSeparator: this.decimalSeparator,
        orderSeparator: this.orderSeparator
      });
    }
  });

  /**
   An IntegerCell is just a Backgrid.NumberCell with 0 decimals. If a floating point
   number is supplied, the number is simply rounded the usual way when
   displayed.

   @class Backgrid.IntegerCell
   @extends Backgrid.Cell
*/
  var IntegerCell = Backgrid.IntegerCell = NumberCell.extend({
    /** @property */
    className: "integer-cell",
    /**
     @property {number} decimals Must be an integer.
  */
    decimals: 0
  });

  /**
   DatetimeCell is a basic cell that accepts datetime string values in RFC-2822
   or W3C's subset of ISO-8601 and displays them in ISO-8601 format. For a much
   more sophisticated date time cell with better datetime formatted and a
   datepicker for an editor, take a look at the KalendaeCell extension.

   @class Backgrid.DatetimeCell
   @extends Backgrid.Cell

   See:

   - Backgrid.KalendaeCell
   - Backgrid.DatetimeFormatter
*/
  var DatetimeCell = Backgrid.DatetimeCell = Cell.extend({
    /** @property */
    className: "datetime-cell",
    /**
     @property {boolean} [includeDate=true]
  */
    includeDate: DatetimeFormatter.prototype.defaults.includeDate,
    /**
     @property {boolean} [includeTime=true]
  */
    includeTime: DatetimeFormatter.prototype.defaults.includeTime,
    /**
     @property {boolean} [includeMilli=false]
  */
    includeMilli: DatetimeFormatter.prototype.defaults.includeMilli,
    /**
     Initializer.

     @param {Object} options
     @param {Backbone.Model} options.model
     @param {Backgrid.Column} options.column
     @param {Backgrid.CellEditor} [options.editor]
     @param {Backgrid.Formatter} [options.formatter]
     @param {boolean} [options.includeDate]
     @param {boolean} [options.includeTime]
     @param {boolean} [options.includeMilli]
  */
    initialize: function(options) {
      Cell.prototype.initialize.apply(this, arguments);
      if (options) {
        this.includeDate = _.isUndefined(options.includeDate) ? this.includeDate : options.includeDate;
        this.includeTime = _.isUndefined(options.includeTime) ? this.includeTime : options.includeTime;
        this.includeMilli = _.isUndefined(options.includeMilli) ? this.includeMilli : options.includeMilli;
      }
      this.formatter = options.formatter || this.column.get("formatter") || new DatetimeFormatter({
        includeDate: this.includeDate,
        includeTime: this.includeTime,
        includeMilli: this.includeMilli
      });
    }
  });

  /**
   DateCell is a Backgrid.DatetimeCell without the time part.

   @class Backgrid.DateCell
   @extends Backgrid.DatetimeCell
*/
  var DateCell = Backgrid.DateCell = DatetimeCell.extend({
    /** @property */
    className: "date-cell",
    /** @property */
    includeTime: false
  });

  /**
   TimeCell is a Backgrid.DatetimeCell without the date part.

   @class Backgrid.TimeCell
   @extends Backgrid.DatetimeCell
*/
  var TimeCell = Backgrid.TimeCell = DatetimeCell.extend({
    /** @property */
    className: "time-cell",
    /** @property */
    includeDate: false
  });

  /**
   BooleanCell is a different kind of cell in that there's no difference between
   display mode and edit mode and this cell type always renders a checkbox for
   selection.

   @class Backgrid.BooleanCell
   @extends Backgrid.Cell
*/
  var BooleanCell = Backgrid.BooleanCell = Cell.extend({
    /** @property */
    className: "boolean-cell",
    /**
     BooleanCell simple uses a default HTML checkbox template instead of a
     CellEditor instance.

     @property {function(Object): string} editor The Underscore.js template to
     render the editor.
   */
    editor: _.template("<input type='checkbox'<%= checked ? checked='checked' : '' %> />'"),
    /**
     Since the editor is not an instance of a CellEditor subclass, more things
     need to be done in BooleanCell class to listen to editor mode events.
   */
    events: {
      click: "enterEditMode",
      "blur input[type=checkbox]": "exitEditMode",
      "change input[type=checkbox]": "save"
    },
    /**
     Renders a checkbox and check it if the model value of this column is true,
     uncheck otherwise.
   */
    render: function() {
      this.currentEditor = $(this.editor({
        checked: this.formatter.fromRaw(this.model.get(this.column.get("name")))
      }));
      this.$el.append(this.currentEditor);
      return this;
    },
    /**
     Simple focuses the checkbox and add an `editor` CSS class to the cell.
   */
    enterEditMode: function(e) {
      this.$el.addClass("editor");
      this.currentEditor.focus();
    },
    /**
     Removed the `editor` CSS class from the cell.
   */
    exitEditMode: function(e) {
      this.$el.removeClass("editor");
    },
    /**
     Set true to the model attribute if the checkbox is checked, false
     otherwise.
   */
    save: function(e) {
      var val = this.formatter.toRaw(this.currentEditor.prop("checked"));
      this.model.set(this.column.get("name"), val);
    }
  });

  /**
   SelectCellEditor renders an HTML <select> fragment as the editor.

   @class Backgrid.SelectCellEditor
   @extends Backgrid.CellEditor
*/
  var SelectCellEditor = Backgrid.SelectCellEditor = CellEditor.extend({
    /** @property */
    tagName: "select",
    /** @property */
    events: {
      change: "save",
      blur: "save"
    },
    template: _.template('<option value="<%= value %>" <%= selected ? \'selected="selected"\' : "" %>><%= text %></option>'),
    setOptionValues: function(optionValues) {
      this.optionValues = optionValues;
    },
    _renderOptions: function(nvps, currentValue) {
      var options = "";
      for (var i = 0; i < nvps.length; i++) {
        options += this.template({
          text: nvps[i][0],
          value: nvps[i][1],
          selected: currentValue === nvps[i][1]
        });
      }
      return options;
    },
    /**
     Renders the options if `optionValues` is a list of name-value pairs. The
     options are contained inside option groups if `optionValues` is a list of
     object hashes. The name is rendered at the option text and the value is the
     option value. If `optionValues` is a function, it is called without a
     parameter.
   */
    render: function() {
      var optionValues = _.result(this, "optionValues");
      var currentValue = this.model.get(this.column.get("name"));
      if (!_.isArray(optionValues)) {
        throw TypeError("optionValues must be an array");
      }
      var optionValue = null;
      var optionText = null;
      var optionValue = null;
      var optgroupName = null;
      for (var i = 0; i < optionValues.length; i++) {
        var optionValue = optionValues[i];
        if (_.isArray(optionValue)) {
          optionText = optionValue[0];
          optionValue = optionValue[1];
          this.$el.append(this.template({
            text: optionText,
            value: optionValue,
            selected: optionValue === currentValue
          }));
        } else {
          if (_.isObject(optionValue)) {
            optgroupName = optionValue.name;
            optgroup = $("<optgroup></optgroup>", {
              label: optgroupName
            });
            optgroup.append(this._renderOptions(optionValue.value, currentValue));
            this.$el.append(optgroup);
          } else {
            throw TypeError("optionValues elements must be a name-value pair or an object hash of { name: 'optgroup label', value: [option name-value pairs] }");
          }
        }
      }
      return this;
    },
    /**
     Saves the value of the selected option to the model attribute. Triggers
     `done` event.
   */
    save: function(e) {
      this.model.set(this.column.get("name"), this.$el.val());
      this.trigger("done");
    }
  });

  /**
   SelectCell is also a different kind of cell in that upon going into edit mode
   the cell renders a list of options for to pick from, as opposed to
   a contenteditable div.

   @class Backgrid.SelectCell
   @extends Backgrid.Cell
*/
  var SelectCell = Backgrid.SelectCell = Cell.extend({
    /** @property */
    className: "select-cell",
    /** @property */
    editor: SelectCellEditor,
    /**
     Besides the usual Cell constructor parameter, SelectCell also requires an
     optionValues parameter which can either be a list of name-value pairs, to
     be rendered as options, or a list of object hashes which consist of a key
     *name* which is the option group name, and a key *value* which is a list of
     name-value pairs to be rendered as options under that option group.

     In addition, optionValues can also be a parameter-less function that
     returns one of the above. If the options are static, it is recommended the
     returned values to be memoized. _.memoize() is a good function to help with
     that.

     @param {Object} options
     @param {Array.<Array>|Array.<Object>} options.optionValues
     @param {Backbone.Model} options.model
     @param {Backgrid.Column} options.column
     @throws {Error} If options.optionValues is missing.
  */
    initialize: function(options) {
      Cell.prototype.initialize.apply(this, arguments);
      this.optionValues = options.optionValues || this.optionValues;
      if (!this.optionValues) {
        throw new Error("optionValues is required");
      }
      this.on("edit", this.setOptionValues, this);
    },
    setOptionValues: function(cell, editor) {
      editor.setOptionValues(this.optionValues);
    },
    /**
     Renders the label using the raw value as key to look up from `optionValues`.

     @throws {TypeError} If `optionValues` is not a right data structure.
  */
    render: function() {
      var optionValues = _.result(this, "optionValues");
      var rawData = this.model.get(this.column.get("name"));
      for (var i = 0; i < optionValues.length; i++) {
        var optionValue = optionValues[i];
        if (_.isArray(optionValue)) {
          var optionText = optionValue[0];
          var optionValue = optionValue[1];
          if (optionValue === rawData) {
            this.$el.append(optionText);
          }
        } else {
          if (_.isObject(optionValue)) {
            var optionGroupValues = optionValue.value;
            for (var j = 0; j < optionGroupValues; j++) {
              var optionGroupValue = optionGroupValues[j];
              if (optionGroupValue[1] === rawData) {
                this.$el.append(optionGroupValue[0]);
              }
            }
          } else {
            throw TypeError("optionValues elements must be a list if name-value pairs or a list of object literals of { name: 'optgroup label', value: [option name-value pairs] }");
          }
        }
      }
      return this;
    }
  });

  /**
   A Column is a placeholder for column metadata.

   You usually don't need to create an instance of this class yourself as a
   collection of column instances will be created for you from a list of column
   attributes in the Backgrid.js view class constructors.

   @class Backgrid.Column
   @extends Backbone.Model
 */
  var Column = Backgrid.Column = Backbone.Model.extend({
    defaults: {
      name: null,
      label: null,
      sortable: true,
      editable: true,
      renderable: true,
      formatter: null,
      cell: null,
      headerCell: null
    },
    /**
     Initializes this Column instance.

     @param {Object} attrs Column attributes.
     @param {string} attrs.name The name of the model attribute.
     @param {string|Backgrid.Cell} attrs.cell The cell type.
     If this is a string, the capitalized form will be used to look up a
     cell class in Backbone, i.e.: string => StringCell. If a Cell subclass
     is supplied, it is initialized with a hash of parameters. If a Cell
     instance is supplied, it is used directly.
     @param {string|Backgrid.HeaderCell} attrs.headerCell The header cell type.
     @param {string} [attrs.label=null] The label to show in the header.
     @param {boolean} [attrs.sortable=true]
     @param {boolean} [attrs.editable=true]
     @param {boolean} [attrs.renderable=true]
     @param {Backgrid.Formatter|Object|string} [attrs.formatter=null] The
     formatter to use to convert between raw model values and user input.

     @throws {Error} If attrs.cell or attrs.options are not supplied.
     @throws {ReferenceError} If attrs.cell is a string but a cell class of
     said name cannot be found in the Backgrid module.

     See:

     - Backgrid.Cell
     - Backgrid.Formatter
   */
    initialize: function(attrs) {
      if (!this.has("label")) {
        this.set({
          label: this.get("name")
        }, {
          silent: true
        });
      }
      if (!attrs.cell) {
        throw new Error("cell is required");
      }
      if (!attrs.name) {
        throw new Error("name is required");
      }
      if ("string" === typeof attrs.cell) {
        var cell = Backgrid[capitalize(this.get("cell")) + "Cell"];
        if ("undefined" === typeof cell) {
          throw new ReferenceError("Cell type '" + attrs.cell + "' not found");
        }
        this.set({
          cell: cell
        }, {
          silent: true
        });
      } else {
        this.set({
          cell: attrs.cell
        }, {
          silent: true
        });
      }
    }
  });

  /**
   A Backbone collection of Column instances.

   @class Backgrid.Columns
   @extends Backbone.Collection
 */
  var Columns = Backgrid.Columns = Backbone.Collection.extend({
    /**
     @property {Backgrid.Column} model
   */
    model: Column
  });

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
    /**
     Initializes a row view instance.

     @param {Object} options
     @param {*} options.parent
     @param {Backbone.Collection.<Backgrid.Column>|Array.<Backgrid.Column>|Array.<Object>} options.columns Column metadata.
     @param {Backbone.Model} options.model The model instance to render.
   */
    initialize: function(options) {
      var self = this;
      self.parent = options.parent;
      self.columns = options.columns;
      if (!(self.columns instanceof Backbone.Collection)) {
        self.columns = new Columns(self.columns);
      }
      self.cells = [];
      self.columns.each(function(column) {
        if (column.get("renderable")) {
          var cell = column.get("cell");
          cell = new cell({
            column: column,
            model: self.model
          });
          self.cells.push(cell);
        }
      });
    },
    dispose: function() {
      this.columns.off(null, null, this);
      if (this.parent && this.parent.off) {
        this.parent.off(null, null, this);
      }
      var cell = null;
      for (var i = 0; i < this.cells.length; i++) {
        cell = this.cells[i];
        cell.off(null, null, this);
        cell.dispose();
      }
      return Backbone.View.prototype.dispose.apply(this, arguments);
    },
    /**
     Renders a row of cells for this row's model.
   */
    render: function() {
      this.$el.empty();
      for (var i = 0; i < this.cells.length; i++) {
        this.$el.append(this.cells[i].render().$el);
      }
      return this;
    }
  });

  /**
   HeaderCell is a special cell class that renders a column header if the column
   is renderable. If the column is sortable, a sorter is also rendered and will
   trigger a table refresh after sorting.

   @class Backgrid.HeaderCell
   @extends Backbone.View
 */
  var HeaderCell = Backgrid.HeaderCell = Backbone.View.extend({
    /** @property */
    tagName: "th",
    /** @property */
    events: {
      "click a": "triggerSort"
    },
    /**
    @property {null|"ascending"|"descending"} direction
  */
    direction: null,
    /**
     Initializer.

     @param {Object} options
     @param {*} options.parent
     @param {Backgrid.Column|Object} options.column
   */
    initialize: function(options) {
      this.parent = options.parent;
      this.column = options.column;
      if (!this.column instanceof Column) {
        this.column = new Column(this.column);
      }
    },
    dispose: function() {
      if (this.parent && this.parent.off) {
        this.parent.off(null, null, this);
      }
      this.column.off(null, null, this);
      return Backbone.View.prototype.dispose.apply(this, arguments);
    },
    /**
     This is an internal function used by Backgrid.Header to toggle the
     rendering of a sorting state.
   */
    toggle: function(columnName, direction) {
      var $label = this.$el.find("a");
      $label.removeClass("ascending descending");
      if (columnName === this.column.get("name")) {
        if (direction) {
          $label.addClass(direction);
        }
        this.direction = direction;
      } else {
        this.direction = null;
      }
    },
    /**
     Event handler for the `click` event on the cell's anchor. If the column is
     sortable, clicking on the anchor will cycle through 3 sorting orderings -
     `ascending`, `descending`, and default. If the ordering is not default, a
     CSS class corresponding to the ordering will be applied to the header cell.

     This method will trigger a Backbone `sort` event to listeners with a custom
     comparator. The default implementation will delegate to the underlying
     collection to do the sorting.
   */
    triggerSort: function(e) {
      e.preventDefault();
      var self = this;
      var columnName = self.column.get("name");
      if (self.column.get("sortable")) {
        if ("ascending" === this.direction) {
          /**
           Backbone event. Fired when the sorter is clicked on a sortable
           column.

           @event sort
           @param {function(*, *): number} comparator A Backbone.Collection#comparator.
         */
          self.trigger("sort", function(left, right) {
            var leftVal = left.get(columnName);
            var rightVal = right.get(columnName);
            if (leftVal === rightVal) {
              return 0;
            } else {
              if (leftVal > rightVal) {
                return -1;
              }
            }
            return 1;
          }, columnName, "descending");
        } else {
          if ("descending" === this.direction) {
            self.trigger("sort", null, columnName, null);
          } else {
            self.trigger("sort", function(left, right) {
              var leftVal = left.get(columnName);
              var rightVal = right.get(columnName);
              if (leftVal === rightVal) {
                return 0;
              } else {
                if (leftVal < rightVal) {
                  return -1;
                }
              }
              return 1;
            }, columnName, "ascending");
          }
        }
      }
    },
    /**
     Renders a header cell with a sorter and a label.
   */
    render: function() {
      this.$el.empty();
      var $label = $("<a>").text(this.column.get("label")).append("<b class='sort-caret'></b>");
      this.$el.append($label);
      return this;
    }
  });

  /**
   Header is a special structural view class that renders a table head with a
   single row of header cells.

   @class Backgrid.Header
   @extends Backbone.View
 */
  var Header = Backgrid.Header = Backbone.View.extend({
    /** @property */
    tagName: "thead",
    /**
     Initializer.

     @param {Object} options
     @param {*} [options.parent]
     @param {Backbone.Collection.<Backgrid.Column>|Array.<Backgrid.Column>|Array.<Object>} options.columns
     @param {Backgrid.HeaderCell} options.headerCell You can customize header
     cell rendering by supplying your own header cell view.

     See:

     - Backgrid.HeaderCell
   */
    initialize: function(options) {
      var self = this;
      self.parent = options.parent;
      self.columns = options.columns;
      if (!(self.columns instanceof Backbone.Collection)) {
        self.columns = new Columns(self.columns);
      }
      self.cells = [];
      self.headerCell = options.headerCell || HeaderCell;
      for (var i = 0; i < self.columns.length; i++) {
        var column = self.columns.at(i);
        if (column.get("renderable")) {
          var headerCell = column.get("headerCell") || self.headerCell;
          var cell = new headerCell({
            parent: self,
            column: column
          });
          cell.on("sort", self.dispatchSortEvent, self);
          self.cells.push(cell);
        }
      }
    },
    dispose: function() {
      this.columns.off(null, null, this);
      if (this.parent && this.parent.off) {
        this.parent.off(null, null, this);
      }
      var cell = null;
      for (var i = 0; i < this.cells.length; i++) {
        cell = this.cells[i];
        cell.off(null, null, this);
        cell.dispose();
      }
      return Backbone.View.prototype.dispose.apply(this, arguments);
    },
    /**
     Internal callback function to respond to a `sort` event from a
     HeaderCell. The comparator is dispatched to the underlying collection
     through the parent and the header cells are cycled to their correct
     rendering for this sorting event.
   */
    dispatchSortEvent: function(comparator, sortByColName, direction) {
      this.parent.sort(comparator);
      _.each(this.cells, function(cell) {
        cell.toggle(sortByColName, direction);
      });
    },
    /**
     Renders this table head with a single row of header cells.
     @chainable
   */
    render: function() {
      var self = this;
      self.$el.empty();
      var $tr = $("<tr>");
      _.each(self.cells, function(cell) {
        $tr.append(cell.render().$el);
      });
      self.$el.append($tr);
      return self;
    }
  });

  /**
   Body is the table body which contains the rows inside a table. Body is
   responsible for refreshing the rows after sorting, insertion and removal.

   @class Backgrid.Body
   @extends Backbone.View
*/
  var Body = Backgrid.Body = Backbone.View.extend({
    /** @property */
    tagName: "tbody",
    /**
     Initializer.

     @param {Object} options
     @param {*} options.parent
     @param {Backbone.Collection} options.collection
     @param {Backbone.Collection.<Backgrid.Column>|Array.<Backgrid.Column>|Array.<Object>} options.columns
     Column metadata
     @param {Backgrid.Row} [options.row=Backgrid.Row] The Row class to use.

     See:

     - Backgrid.Row
  */
    initialize: function(options) {
      var self = this;
      self.parent = options.parent;
      self.columns = options.columns;
      if (!(self.columns instanceof Backbone.Collection)) {
        self.columns = new Columns(self.columns);
      }
      this.row = options.row || Row;
      self.rows = self.collection.map(function(model) {
        var row = new self.row({
          parent: self,
          columns: self.columns,
          model: model
        });
        return row;
      });
      self.collection.on("add", self.insertRow, self);
      self.collection.on("remove", self.removeRow, self);
      self.collection.on("reset", self.refresh, self);
    },
    dispose: function() {
      this.columns.off(null, null, this);
      if (this.parent && this.parent.off) {
        this.parent.off(null, null, this);
      }
      var row = null;
      for (var i = 0; i < this.rows.length; i++) {
        row = this.rows[i];
        row.off(null, null, this);
        row.dispose();
      }
      return Backbone.View.prototype.dispose.apply(this, arguments);
    },
    /**
     If a comparator is given, it is attached to the collection so
     Backbone.Collection can use it to sort. If not, a default comparator that
     sorts the id and cid in ascending order is used instead.

     If the underlying collection instance has a comparator defined previously,
     it is restored after sorting.

     @param {function(*, *): number} [comparator]

     See:

     - [Backbone.Collection#comparator](http://backbonejs.org/#Collection-comparator)
  */
    sort: function(comparator) {
      var oldComparator = this.collection.comparator;
      this.collection.comparator = comparator || this._idCidComparator;
      this.collection.sort();
      this.collection.comparator = oldComparator;
    },
    /**
     Default comparator for Backbone.Collections. Sorts ids and cids in
     ascending order.

     @private
     @param {*} left
     @param {*} right
  */
    _idCidComparator: function(left, right) {
      var lid = left.id, lcid = left.cid, rid = right.id, rcid = right.cid;
      if (!_.isUndefined(lid) || !_.isUndefined(rid)) {
        if (lid < rid) {
          return -1;
        } else {
          if (lid > rid) {
            return 1;
          }
        }
      } else {
        if (!_.isUndefined(lid) && !_.isUndefined(rcid)) {
          if (lid < rcid) {
            return -1;
          } else {
            if (lid > rcid) {
              return 1;
            }
          }
        } else {
          if (!_.isUndefined(lcid) && !_.isUndefined(rid)) {
            if (lcid < rid) {
              return -1;
            } else {
              if (lcid > rid) {
                return 1;
              }
            }
          } else {
            if (!_.isUndefined(lcid) && !_.isUndefined(rcid)) {
              if (lcid < rcid) {
                return -1;
              } else {
                if (lcid > rcid) {
                  return 1;
                }
              }
            }
          }
        }
      }
      return 0;
    },
    /**
     This method can be called either directly or as a callback to a
     [Backbone.Collecton#add](http://backbonejs.org/#Collection-add) event.

     When called directly, it accepts a model and an option hash just like
     [Backbone.Collection#add](http://backbonejs.org/#Collection-add) and
     delegates to it. Once the model is added, a new row is inserted into the
     body and automatically rendered.

     When called as a callback of an `add` event, splices a new row into the
     body and renders it.

     @param {Backbone.Model} model The model to render as a row.
     @param {Backbone.Collection} collection When called directly, this
     parameter is actually the options to
     [Backbone.Collection#add](http://backbonejs.org/#Collection-add).
     @param {Object} options When called directly, this must be null.

     See:

     - [Backbone.Collection#add](http://backbonejs.org/#Collection-add)
  */
    insertRow: function(model, collection, options) {
      // insertRow() is called directly
      if (options) {
        var row = new self.row({
          parent: this,
          columns: this.columns,
          model: model
        });
        this.rows.splice(options.index, 0, row);
        if (_.isUndefined(options.render) || options.render) {
          if (options.index >= this.$el.children().length) {
            this.$el.children().last().after(row.render().$el);
          } else {
            this.$el.children().eq(options.index).before(row.render().$el);
          }
        }
      } else {
        this.collection.add(model, options = collection);
      }
    },
    /**
     The method can be called either directly or as a callback to a
     [Backbone.Collection#remove](http://backbonejs.org/#Collection-remove)
     event.

     When called directly, it accepts a model and an option hash just like
     [Backbone.Collection#remove](http://backbonejs.org/#Collection-remove) and
     delegates to it. Once the model is removed, a corresponding row is removed
     from the body.

     When called as a callback of a `remove` event, splices into the rows and
     removes the row responsible for rendering the model.

     @param {Backbone.Model} model The model to remove from the body.
     @param {Backbone.Collection} collection When called directly, this
     parameter is actually the options to
     [Backbone.Collection#remove](http://backbonejs.org/#Collection-remove).
     @param {Object} options When called directly, this must be null.

     See:

     - [Backbone.Collection#remove](http://backbonejs.org/#Collection-remove)
  */
    removeRow: function(model, collection, options) {
      // removeRow() is called directly
      if (options) {
        if (_.isUndefined(options.render) || options.render) {
          this.rows[options.index].remove();
        }
        this.rows.splice(options.index, 1);
      } else {
        this.collection.remove(model, options = collection);
      }
    },
    /**
     Reinitialize all the rows inside the body and re-render them.
  */
    refresh: function() {
      var self = this;
      _.each(self.rows, function(row) {
        row.dispose();
      });
      self.rows = self.collection.map(function(model) {
        var row = new self.row({
          parent: self,
          columns: self.columns,
          model: model
        });
        return row;
      });
      return self.render();
    },
    /**
     Renders all the rows inside this body.
  */
    render: function() {
      var self = this;
      self.$el.empty();
      _.each(self.rows, function(row) {
        self.$el.append(row.render().$el);
      });
      return this;
    }
  });

  /**
   A Footer is a generic class that only defines a default tag `tfoot` and
   number of required parameters in the initializer.

   @abstract
   @class Backgrid.Footer
   @extends Backbone.View
 */
  var Footer = Backgrid.Footer = Backbone.View.extend({
    /** @property */
    tagName: "tfoot",
    /**
     Initializer.

     @param {Object} options
     @param {*} options.parent The parent view class of this footer.
     @param {Backbone.Collection.<Backgrid.Column>|Array.<Backgrid.Column>|Array.<Object>} options.columns
     Column metadata.
     @param {Backbone.Collection} options.collection
  */
    initialize: function(options) {
      this.parent = options.parent;
      this.columns = options.columns;
      if (!(this.columns instanceof Backbone.Collection)) {
        this.columns = new Backgrid.Columns(this.columns);
      }
    },
    dispose: function() {
      this.columns.off(null, null, this);
      if (this.parent && this.parent.off) {
        this.parent.off(null, null, this);
      }
      return Backbone.View.prototype.dispose.apply(this, arguments);
    }
  });

  /**
   Grid represents a data grid that has a header, body and an optional footer.

   By default, a Grid treats each model in a collection as a row, and each
   attribute in a model as a column. To render a grid you must provide a list of
   column metadata and a collection to the Grid constructor. Just like any
   Backbone.View class, the grid is rendered as a DOM node fragment when you
   call render().

       @example
       var grid = Backgrid.Grid({
         columns: [{ name: "id", label: "ID", type: "string" },
          // ...
         ],
         collections: books
       });

       $("#table-container").append(grid.render().el);

   Optionally, if you want to customize the rendering of the grid's header and
   footer, you may choose to extend Backgrid.Header and Backgrid.Footer, and
   then supply that class or an instance of that class to the Grid constructor.
   See the documentation for Header and Footer for further details.

       @example
       var grid = Backgrid.Grid({
         columns: [{ name: "id", label: "ID", type: "string" }],
         collections: books,
         header: Backgrid.Header.extend({
              //...
         }),
         footer: Backgrid.Paginator
       });

   Finally, if you want to override how the rows are rendered in the table body,
   you can supply a Body subclass as the `body` attribute that uses a different
   Row class.

   @class Backgrid.Grid
   @extends Backbone.View

   See:

   - {@link Backgrid.Column}
   - {@link Backgrid.Header}
   - {@link Backgrid.Body}
   - {@link Backgrid.Row}
   - {@link Backgrid.Footer}
*/
  var Grid = Backgrid.Grid = Backbone.View.extend({
    /** @property */
    tagName: "table",
    /** @property */
    className: "backgrid",
    /**
     Initializes the a Grid instance.

     @param {Object} options
     @param {Backbone.Collection.<Backgrid.Column>|Array.<Backgrid.Column>|Array.<Object>} options.columns Column metadata.
     @param {Backbone.Collection} options.collection The collection of tabular model data to display.
     @param {Backgrid.Header} [options.header=Backgrid.Header] An optional Header class to override the default.
     @param {Backgrid.Body} [options.body=Backgrid.Body] An optional Body class to override the default.
     @param {Backgrid.Footer} [options.footer=Backgrid.Footer] An optional Footer class.
   */
    initialize: function(options) {
      this.columns = options.columns;
      // Convert the list of column objects here first so the subviews don't have
      // to.
      if (!(this.columns instanceof Backbone.Collection)) {
        this.columns = new Backgrid.Columns(this.columns);
      }
      this.header = options.header || Header;
      this.header = new this.header({
        parent: this,
        columns: this.columns,
        collection: this.collection
      });
      this.body = options.body || Body;
      this.body = new this.body({
        parent: this,
        columns: this.columns,
        collection: this.collection
      });
      this.footer = options.footer || void 0;
      if (this.footer) {
        this.footer = new this.footer({
          parent: this,
          columns: this.columns,
          collection: this.collection
        });
      }
    },
    dispose: function() {
      this.columns.off(null, null, this);
      this.header.off(null, null, this);
      this.header.dispose();
      this.body.off(null, null, this);
      this.body.dispose();
      if (this.footer) {
        this.footer.off(null, null, this);
        this.footer.dispose();
      }
      return Backbone.View.prototype.dispose.apply(this, arguments);
    },
    /**
     Sorts the rows. Delegates to Backgrid.Body#sort.

     @param {function(*, *)} comparator A 2-argument function suitable for
     [Backbone.Collection#sort](http://backbonejs.org/#Collection-sort).
   */
    sort: function(comparator) {
      return this.body.sort(comparator);
    },
    /**
     Delegates to Backgrid.Body#insertRow.
   */
    insertRow: function(model, collection, options) {
      return this.body.insertRow(model, collection, options);
    },
    /**
     Delegates to Backgrid.Body#removeRow.
   */
    removeRow: function(model, collection, options) {
      return this.body.removeRow(model, collection, options);
    },
    /**
     Renders the grid's header, then footer, then finally the body.
   */
    render: function() {
      this.$el.empty();
      this.$el.append(this.header.render().$el);
      if (this.footer) {
        this.$el.append(this.footer.render().$el);
      }
      this.$el.append(this.body.render().$el);
      /**
       Backbone Event. Fired when the grid has been successfully rendered.

       @event rendered
     */
      this.trigger("rendered");
      return this;
    }
  });}(this, $, _, Backbone));