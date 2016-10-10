'use babel';

import { CompositeDisposable } from 'atom';
const path = require('path');
_ = require('underscore-plus');  //TODO: use for each loops and other functions from this library

//TODO: what if multiple instances of a file are open in a single pane? can that happen?

export default {
  subscriptions: null,
  sourceExtensions: null,
  headerExtensions: null,
  useAdvancedMatch: null,
  pairRegExp: null,

  config: {
    pairExtensions: {
      type: "array",
      "default": ["c", "cc", "cpp", "cp", "cxx", "c++", "cu",
                  "h", "hh", "hpp", "hxx", "h++", "cuh",
                  "spec.js", "js", "html", "css"],
      order: 1,
      items: {
        "type": "string",
      }
    },
    matchFullPath: {
      type: "boolean",
      order: 3,
      default: false
    },
    //TODO: add option for compressing to icon only, no text

    advancedMatch: {
      type: "boolean",
      order: 4,
      default: false
    },
    advancedMatchRegExp: {
      type: "array",
      "default": ["([^/]+?)(?:\.c|\.cc|\.cpp|\.cp|\.cxx|\.c++|\.cu|\.h|\.hh|\.hpp|\.hxx|\.h++|\.cuh)",
                  "([^/]+?)(?:\.js|\.css|\.html)"],
      order: 5,
      items: {
        type: "string",
      }
    }
  },

  activate(state) {
    this.updateConfig();

    this.subscriptions = new CompositeDisposable();

    //TODO: this doesn't seem to be called when config is updated
    this.subscriptions.add(atom.config.onDidChange('tab-pair-header-source', () => {this.updateConfig}));

    // subscribe to events that change editor path, or panelitem position
    this.subscriptions.add(atom.workspace.onDidChangeActivePaneItem((ev)=>{this.changedActiveItem(ev)}));

    this.subscriptions.add(atom.workspace.observeTextEditors((editor) => {
        this.subscriptions.add(editor.onDidChangePath(()=>{this.changedPath(editor)}));
    }));

    this.subscriptions.add(atom.workspace.observePanes((pane) => {
      this.subscriptions.add(pane.onDidMoveItem((ev) => {
        setTimeout(()=>{this.movedInSamePane(pane, ev)}, 5);
      }));
      this.subscriptions.add(pane.onDidRemoveItem((ev)=>{
        this.removedPaneItem(pane, ev);
      }));
      this.subscriptions.add(pane.onDidAddItem((ev)=>{
        // wait a moment so the DOM has time to reflow
        // otherwise if we move the paneitem, it may not take
        setTimeout(()=>{this.addedPaneItem(pane, ev)}, 5);
      }));
    }));
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  updateConfig() {
    this.pairRegExp = []
    var useAdvancedMatch = atom.config.get('tab-pair-header-source.advancedMatch');
    if (useAdvancedMatch) {
      var pairPatterns = atom.config.get('tab-pair-header-source.advancedMatchRegEx');
      for(let index=0; index < pairPatterns.length; index++) {
        this.pairRegExp.push( RegExp(pairPatterns[index]) );
      }
    }
    else { //basic mode, automatically construct regex
      var useFullPath = atom.config.get('tab-pair-header-source.matchFullPath');
      var regstr = "";
      if (useFullPath) {
        regstr = "^(.+?)";
      }
      if (path.sep === "\\") {
        regstr += "([^\\\\]+?)(?:";
      } else {
        regstr += "([^/]+?)(?:";
      }
      pairExtensions = atom.config.get('tab-pair-header-source.pairExtensions');
      for(let index=0; index < pairExtensions.length; index++) {
        // ([^/]+?)(?:.c|.cc|.cpp|.cp|.cxx|.c++|.cu|.h|.hh|.hpp|.hxx|.h++|.cuh), ([^/]+?)(?:.js|.css|.html)
        regstr += "\\." + _.escapeRegExp( pairExtensions[index] ) + "|";
      }
      regstr = regstr.slice(0,-1) + ")$";
      this.pairRegExp.push( RegExp(regstr) );
    }
  },

  groupPair(paths) {
    if (!Array.isArray(paths)) {
      return null;
    }
    groups = Array(paths.length).fill(0)
    var matching_regex = null;
    var matching_stringify = null;
    var group_num = 1;
    for(let index=0; index < paths.length; index++) {
      let p = paths[index];
      if (matching_regex === null) {
        let res = this.findMatch(p);
        matching_regex = res.matching_regex;
        matching_stringify = res.matching_stringify;
        if (matching_regex !== null) {
          groups[index] = group_num;
        }
      } else { //see if we continue the group of break it
        let reg_result = matching_regex.exec(p);
        if (reg_result !== null && matching_stringify === JSON.stringify(reg_result.slice(1))) {
          groups[index] = group_num;
        } else { //doesn't match stringify
          group_num += 1;
          let res = this.findMatch(p);
          matching_regex = res.matching_regex;
          matching_stringify = res.matching_stringify;
          if (matching_regex !== null) {
            groups[index] = group_num;
          }
        }
      }
    }
    return groups;
  },

  findMatch(search_str) { // returns first matching regex, and stringified version of match
    matching_regex = null;
    matching_stringify = null;
    for(let index=0; index < this.pairRegExp.length; index++) {
      let reg_result = this.pairRegExp[index].exec(search_str);
      if (reg_result !== null) {
        matching_regex = this.pairRegExp[index];
        matching_stringify = JSON.stringify(reg_result.slice(1));
        break;
      }
    }
    return {matching_regex:matching_regex, matching_stringify:matching_stringify};
  },

  getPathsForPane(pane) {
    paneitems = pane.getItems();
    var item_paths = Array(paneitems.length).fill('');
    for (let paneitem_index in paneitems) { // TODO: verify, this assumes that getItems returns items in same order as they are displayed
      let paneitem = paneitems[paneitem_index];
      if (atom.workspace.isTextEditor(paneitem)) {
        item_paths[paneitem_index] = paneitem.getPath();
      }
    }
    return item_paths;
  },

  compressGroups(pane, pane_paths, pane_paths_pairs) {
    var max_group = Math.max.apply(Math, pane_paths_pairs);
    var groups = Array(max_group).fill([]);
    var paneitems = pane.getItems();
    if (paneitems.length !== pane_paths.length ||
        paneitems.length !== pane_paths_pairs.length ) {
          console.log("All array lengths must match");
          return;
        }

    for (let index=0; index < paneitems.length; index++) {
      let item = paneitems[index];
      if (pane_paths_pairs[index] == 0) {
        continue;
      }
      if (atom.workspace.isTextEditor(item) && item.getPath() !== pane_paths[index]) {
        throw new Error("pane item path does not match expected path");
      }
      groups[pane_paths_pairs[index]-1].push(item); //TODO: maybe return this structure from groupPair, instead of array of numbers
    }

    groups.forEach( (group_items) => {
      if (group_items.length == 0) {return;}
      else if (group_items.length == 1) {this.setTabTitle(group_items[0], false);} //expand only tab
      else {
        var active_index = group_items.findIndex((element, index, array) =>{
          return atom.workspace.getActivePaneItem() === element;
        });
        if (active_index) { //  expand active_index, compress others.
          for (let index=0; index < group_items.length; index++) {
            if (index === active_index) {
              this.setTabTitle(group_items[index], false);
            }
            else {
              this.setTabTitle(group_items[index], true);
            }
          }
        } else {
          var item_states = group_items.map((currentValue, index, array) => {return this.isCompressed(currentValue)});
          var expand_cnt = item_states.reduce((previousValue, currentValue, currentIndex, array) => {
            return currentValue ? previousValue : previousValue+1;
          }, 0);

          if (expand_cnt < 1) { // expand first one
            this.setTabTitle(group_items[0], false);
          } else if (expand_cnt > 1) { // compress all but first of the expanded
            var found_first_expanded = false;
            for (let index=0; index < group_items.length; index++) {
              if (!found_first_expanded && !item_states[index]) {
                found_first_expanded = true;
                continue
              }
              if(found_first_expanded && !item_states[index]) {
                this.setTabTitle(group_items[index], true);
              }
            }
          }
        }
      }
    });
  },

  checkPanes(panes=null) {
    var t0 = performance.now();
    if (panes === null || !Array.isArray(panes)) {
      var panes = atom.workspace.getPanes();
    }
    
    for (let pane_index in panes) {
      var pane = panes[pane_index];
      var pane_paths = this.getPathsForPane(pane);
      // go through item_paths and split it into group numbers depending on matches. ex [1 1 0 2 2 2 0 3 0 4], here groups 1 and 2 would have tabs shortened
      var pane_paths_pairs = this.groupPair(pane_paths);
      if (atom.inDevMode()) {
        console.log(pane_paths);
        console.log(pane_paths_pairs);
      }

      this.compressGroups(pane, pane_paths, pane_paths_pairs);
    }
    if (atom.inDevMode()) {
      var t1 = performance.now();
      console.log("Call to checkPanes took " + (t1 - t0) + " milliseconds.");
    }
  },
  
  getDocTab(item) {
    var index = atom.workspace.getPaneItems().indexOf(item);
    if (typeof index < 0)
      return;

    let tab = atom.views.getView(atom.workspace).querySelectorAll('li.tab .title')[index];
    return tab;
  },
  
  isCompressed() {
    var tab = this.getDocTab();
    if (typeof tab === "undefined") {
      return false;
    }
    return tab.parentElement.classList.contains('tab-pair-header-source');
  },

  setTabTitle(item, compress=false){
    if (atom.inDevMode()) {
      if (compress) {
        console.log("compressing tab: " + item.getPath());
      }
      else {
        console.log("expanding tab: " + item.getPath());
      }
    }

    var tab = this.getDocTab();
    if (typeof tab === "undefined") {
      return;
    }

    let filename = tab.getAttribute('data-name');

    if(tab && filename)
    {
      if (compress) {
        filename = path.extname(filename);
        tab.parentElement.classList.add('tab-pair-header-source');
      }
      else {
        tab.parentElement.classList.remove('tab-pair-header-source');
      }
      tab.innerText = filename;
    }
  },

  findPaneItem(paneitem) {
    var index;
    var pane;
    var panes = atom.workspace.getPanes();
    for(let i=0; i < panes.length; i++) {
      pane = panes[i];
      index = pane.getItems().indexOf(paneitem);
      if (index >= 0){
        break;
      }
    }

    return {pane, index};
  },

  addedPaneItem(pane, ev) {
    if (atom.inDevMode()) {
      console.log("addedPaneItem");
    }
    this.checkPanes([pane]);
  },

  removedPaneItem(pane, ev) {
    if (atom.inDevMode()) {
      console.log("removedPaneItem");
    }
    this.checkPanes();
  },

  movedInSamePane(pane, ev) {
    if (atom.inDevMode()) {
      console.log("movedInSamePane");
    }
    this.checkPanes(pane);
  },

  changedActiveItem(paneitem) {
    if (atom.inDevMode()) {
      console.log("changedActiveItem");
    }

    if(!atom.workspace.isTextEditor(paneitem)) {
      return;
    }
    var result = this.findPaneItem(paneitem);
    this.checkPanes(result.pane);
  },

  changedPath(editor) {
    if (atom.inDevMode()) {
      console.log("changedPath");
    }
    var result = this.findPaneItem(editor);
    this.checkPanes(result.pane);
  },
};
