'use babel';

import { CompositeDisposable } from 'atom';
const path = require('path');
_ = require('underscore-plus');

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
    advancedMode: {
      type: "object",
      collapsed: true,
      properties: {
        enable: {
          type: "boolean",
          order: 4,
          default: false
        },
        matchRegExp: {
          description : "Use Regular Expressions to define matching files",
          type: "array",
          "default": ["([^/\\\\]+?)(?:\\.c|\\.cc|\\.cpp|\\.cp|\\.cxx|\\.c\\+\\+|\\.cu|\\.h|\\.hh|\\.hpp|\\.hxx|\\.h\\+\\+|\\.cuh)",
                      "([^/\\\\]+?)(?:\\.js|\\.css|\\.html)"],
          order: 5,
          items: {
            type: "string",
          }
        }
      }
    }
  },

  activate(state) {
    this.subscriptions = new CompositeDisposable();

    this.subscriptions.add(atom.config.observe('tab-pair-header-source', () => {this.updateConfig()}));

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
    var useAdvancedMatch = atom.config.get('tab-pair-header-source.advancedMode.enable');
    if (useAdvancedMatch) {
      // get editor element so we can mark it in error
      var invalid_regexp = false;
      var editor = null;
      var n = document.evaluate('//*[text()="' + "Advanced Mode Match Reg Exp" + '"]', document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE).snapshotItem(0);
      if (n !== null) {
        var editors = n.parentElement.parentElement.getElementsByClassName('editor-container');
        if (editors.length > 0) {
          editor = editors[0];
        }
      }
      
      var pairPatterns = atom.config.get('tab-pair-header-source.advancedMode.matchRegExp');
      for(let index=0; index < pairPatterns.length; index++) {
        try {
          let regex = RegExp(pairPatterns[index]);
          this.pairRegExp.push( regex );
        }
        catch(err) {
          if (atom.inDevMode()) {
            console.log("invalid regexp")
          }
          // get advanced config settings line, add class highlight-error
          invalid_regexp = true;
          if (editor !== null) {
            editor.classList.add('highlight-error'); 
          }
        }
      }
      if (editor !== null && !invalid_regexp) {
        editor.classList.remove('highlight-error'); 
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

  groupPair(paths, items) {
    if (!Array.isArray(paths)) {
      return null;
    }
    var groups = []
    var matching_regex = null;
    var matching_stringify = null;
    for(let index=0; index < paths.length; index++) {
      let p = paths[index];
      let item = items[index];
      if (matching_regex === null) {
        let res = this.findMatch(p);
        matching_regex = res.matching_regex;
        matching_stringify = res.matching_stringify;
        if (matching_regex !== null) {
          groups.push( [item] ); // new group
        }
      } else { //see if we continue the group of break it
        let reg_result = matching_regex.exec(p);
        if (reg_result !== null && matching_stringify === JSON.stringify(reg_result.slice(1))) {
          groups[groups.length-1].push( item ); // add to last group
        } else { //doesn't match stringify
          let res = this.findMatch(p);
          matching_regex = res.matching_regex;
          matching_stringify = res.matching_stringify;
          if (matching_regex !== null) {
            groups.push( [item] ); // new group
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
    return {matching_regex, matching_stringify};
  },

  getPathsForPane(pane) {
    return pane.getItems().map( (paneitem, index, array) => {
      return atom.workspace.isTextEditor(paneitem) ? paneitem.getPath() : "";
    });
  },

  compressGroups(pane, pane_paths, groups) {
    groups.forEach( (group_items) => {
      if (group_items.length == 0) {return;}
      else if (group_items.length == 1) {this.setTabTitle(group_items[0], false);} //expand only tab
      else {
        var active_index = group_items.findIndex((element, index, array) =>{
          return atom.workspace.getActivePaneItem() === element;
        });
        if (active_index >= 0) { //  expand active_index, compress others.
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

    panes.forEach((pane, index, array) => {
      var pane_paths = this.getPathsForPane(pane);
      var pane_paths_pairs = this.groupPair(pane_paths, pane.getItems());
      if (atom.inDevMode()) {
        console.log(pane_paths);
        console.log(pane_paths_pairs);
      }

      this.compressGroups(pane, pane_paths, pane_paths_pairs);
    });

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

    var tab = this.getDocTab(item);
    if (typeof tab === "undefined") {
      return;
    }

    let filename = tab.getAttribute('data-name');

    if(tab && filename)
    {
      if (compress) {
        tab.textContent = path.extname(filename);
        tab.parentElement.classList.add('tab-pair-header-source');
      }
      else {
        tab.parentElement.classList.remove('tab-pair-header-source');
        
        // need to check to see if any sibling tabs have same title,
        // if so, update this one with long but don't update siblings,
        // this is how the tabs package does tab names
        var title = tab.parentElement.item.getTitle();
        var useLongTitle = false;
        var tabs = tab.parentElement.getTabs();
        for (let tab_index=0; tab_index < tabs.length; tab_index++) {
          let sib_tab = tabs[tab_index];
          if (sib_tab !== tab.parentElement && sib_tab.item.getTitle() === title) {
            useLongTitle = true;
            break;
          }
        }
        tab.parentElement.updateTitle({updateSiblings:false, useLongTitle: useLongTitle});
      }
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
