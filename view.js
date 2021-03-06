define(function (require) {

  /**
  
  Leap/View
  
  is a base view that provides the following features for your Backbone Views

  
  * bindTo, unbindFrom, unbindAll methods provided by backbone-eventbinder
    that enable automatic event unbinding in the destroy method

  
  * destroy method inspired by Marionette and Chaplin that destroys subviews,
    unbinds events that were bound to via bindTo, and performs other sorts of
    cleanup. If you want to run some custom destroy code, you can implement
    `beforeDestroy` method in your view.

  
  * subview convention of storing all subviews in this.subviews hash. If the
    convention is followed, then `assign` method can be used for rendering
    the subviews and destroy methods will destroy all of the subviews.

    Example:
    ```
    // store views
    this.subviews.toolbar = new ToolbarView();
    // or arrays of views
    this.subviews.items = _.map([1,2,3], function (id) {
      return new ItemView({ id: id});
    });
    ```


  * assign method for rendering subviews into the view. If an array of views
    is passed, it loops over them and inserts them all
    (Inspired by
      http://ianstormtaylor.com/assigning-backbone-subviews-made-even-cleaner/)

    Example:
    ```
    this.assign({
      '.subview'             : "toolbar", // will grab this.subviews.toolbar
      '.list-of-items'       : "items",   // an array of views
      '.yet-another-subview' : this.subviews.yetanother // pass by reference
    });
    ```


  * `bindUIElements` method can be used to bind a `ui` hash for easy access of
     DOM elements in the view.

    Example
    ```
      LeapView.extend({

        ui: {
          checkbox: "input[type=checkbox]"
        },

        onRender: function() {
          if (this.model.get("selected")) {
            this.ui.checkbox.addClass('checked');
          }
        }
      });
    ```


  */


  // TODO temporary
  // require these Backbone Plugins to ensure correct order. If things get
  // loaded out of order, the plugins augment Backbone only after LeapView
  // extends Backbone.View
  require("backbone.stickit");


  var _              = require("underscore");
  var $              = require("jquery");
  var Backbone       = require("backbone");
  var assert         = require("./assert");
  var mediator       = require("./mediator");
  var addEventBinder = require("./add_event_binder");

  // var upcase = function (str) {
  //   return str.charAt(0).toUpperCase() + str.substring(1);
  // };

  var dashify = function (str) {
    return str.replace(/([A-Z])/g, function ($1) {
      return "-" + $1.toLowerCase();
    });
  };

  return Backbone.View.extend({

    constructor: function () {
      this.subviews = {};
      addEventBinder(this);

      Backbone.View.prototype.constructor.apply(this, arguments);

      this.bindEvents();

      // this.wrapMethod("render");
    },

    // wrapMethod: function (name) {
    //   var instance = this;
    //   // Enclose the original function
    //   var func = instance[name];
    //   // Set a flag
    //   instance["" + name + "IsWrapped"] = true;
    //   // Create the wrapper method
    //   instance[name] = function () {
    //     // Stop if the view was already disposed
    //     if (this.destroyed) {
    //       return false;
    //     }
    //     console.log("_after" + (upcase(name)));
    //     // Call the original method
    //     func.apply(instance, arguments);
    //     // Call the corresponding `after-` method
    //     instance["_after" + (upcase(name))].apply(instance, arguments);
    //     // Return the view
    //     return instance;
    //   };
    // },

    // _afterRender: function () {
    //   this.bindUIElements();
    // },

    render: function () {
      if (this.destroyed) {
        return this;
      }
      this.beforeRender();
      var html = "";
      if (this.template) {
        if (!_.isFunction(this.template)) {
          throw new Error("template should be a function");
        }
        html = this.template(_.extend({}, this.defaultTemplateData(), this.getTemplateData()));
      } else {
        html = "";
      }
      this.$el.html(html);
      _.each(this.subviews, function (view, name) {
        this.assign("." + dashify(name) + "-container", name);
      }, this);
      if (this.bindings) {
        this.stickit();
      }
      this.bindUIElements();
      this.afterRender();
      this.trigger("afterRender");
      return this;
    },

    beforeRender: function () {
      return this;
    },

    afterRender: function () {
      return this;
    },

    defaultTemplateData: function () {
      return {
        model: this.model,
        collection: this.collection,
        cid: this.cid,
        linkTo: _.bind(this.linkTo, this)
      };
    },

    // a way to generate links, delegates to router.generate
    linkTo: function () {
      if (mediator.router) {
        return mediator.router.generate.apply(mediator.router, arguments);
      }
    },

    transitionTo: function () {
      if (mediator.router) {
        return mediator.router.transitionTo.apply(mediator.router, arguments);
      }
    },

    replaceWith: function () {
      if (mediator.router) {
        return mediator.router.replaceWith.apply(mediator.router, arguments);
      }
    },

    getTemplateData: function () {},

    // This method binds the elements specified in the "ui" hash inside the
    // view's code with the associated jQuery selectors.
    bindUIElements: function () {
      if (!this.ui) { return; }

      var that = this;

      if (!this.uiBindings) {
        // We want to store the ui hash in uiBindings, since afterwards the
        // values in the ui hash will be overridden with jQuery selectors.
        this.uiBindings = this.ui;
      }

      // refreshing the associated selectors since they should point to the
      // newly rendered elements.
      this.ui = {};
      _.each(_.keys(this.uiBindings), function (key) {
        var selector = that.uiBindings[key];
        that.ui[key] = that.$(selector);
      });
    },

    bindEvents: function () {
      this.bindBackboneEntityTo(this.model, this.modelEvents);
      this.bindBackboneEntityTo(this.collection, this.collectionEvents);
    },

    // This method is used to bind a backbone "entity" (collection/model) to
    // methods on the view.
    bindBackboneEntityTo: function (entity, bindings) {
      if (!entity || !bindings) { return; }

      var view = this;
      _.each(bindings, function (methodName, evt) {

        var method = view[methodName];
        if (!method) {
          throw new Error("View method '" + methodName +
            "' was configured as an event handler, but does not exist.");
        }

        view.bindTo(entity, evt, method, view);
      });
    },

    assign: function (selector, view) {
      var selectors;
      var instance = this;
      if (_.isObject(selector)) {
        selectors = selector;
      } else {
        selectors = {};
        selectors[selector] = view;
      }
      if (!selectors) {
        return;
      }
      _.each(selectors, function (view, selector) {
        var viewName;
        if (_.isString(view)) {
          viewName = view;
          view = instance.subviews[viewName];
        }
        if (!view) {
          throw new Error("Can't assign subview '" + viewName +
            "', because it does not exist.");
        }

        // don't render if there is no container for it
        if (!this.$(selector).length) {
          return;
        }

        if (view instanceof Backbone.View) {
          // call setElement to redelegate events
          this.$(selector).html(view.setElement(view.$el).render().el);
        } else {
          // this.$(selector).empty();
          _.each(view, function (view) {
            // call setElement to redelegate events
            this.$(selector).append(view.setElement(view.$el).render().el);
          }, this);
        }
      }, this);
    },

    /**
      Replaces a subview with a new instance, but makes sure the old instance
      is destroyed first.
      Useful for subviews that are created and destroyed several times throughout
      the lifecycle of some view (e.g. modal dialogs, dropdowns)

      Example, usage:

      var settings = new SettingsModal({
        model: this.model
      });
      this.replaceSubview("settings", settings);
      this.assign(".settings-container", "settings");
    */
    replaceSubview: function (subviewName, newSubviewInstance) {
      if (this.subviews[subviewName]) {
        this.subviews[subviewName].destroy();
        delete this.subviews[subviewName];
      }
      if (newSubviewInstance) {
        this.subviews[subviewName] = newSubviewInstance;
      }
    },


    // Disposal
    // --------

    destroyed: false,

    destroy: function () {
      if (this.destroyed) {
        return;
      }

      // TODO, 13/06/2013, Karolis
      // should we keep another flag here called destroyCalled, to make sure
      // destroy can only always be called once?

      // if custom destroying logic is required, put it in the beforeDestroy
      this.beforeDestroy.apply(this, arguments);

      // TODO, 13/06/2013, Karolis
      // should we first unbindAll() and off() the events? so that if
      // destroying subviews triggers events, we've stopped listening and
      // can't go into some loop (e.g. subview triggers something in beforeDestroy
      // that causes the view to call destroy() on that subview, which goes into
      // a loop)

      // Destroy subviews. Handle arrays and individual views
      _.each(this.subviews, function (subview) {
        if (subview) {
          if (_.isArray(subview)) {
            _.invoke(subview, "destroy");
          } else if ($.isPlainObject(subview)) {
            _.invoke(_.values(subview), "destroy");
          } else {
            subview.destroy();
          }
        }
      });

      // unbind all events bound via bindTo
      this.unbindAll();

      // Remove all event handlers on this module
      this.off();

      // Remove the topmost element from DOM. This also removes all event
      // handlers from the element and all its children.
      this.$el.remove();

      // Remove element references, options,
      // model/collection references and subview lists
      var properties = [
        "el", "$el",
        "options", "model", "collection",
        "subviews"
      ];
      _.each(properties, function (prop) {
        delete this[prop];
      });

      // Finished
      this.destroyed = true;

      // You’re frozen when your heart’s not open
      if (_.has(Object, "freeze")) {
        Object.freeze(this);
      }
    },

    beforeDestroy: function () {}
  });

});