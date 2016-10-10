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
      this.subscriptions.add(pane.onWillRemoveItem((ev)=>{
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

  // serialize() {
  //   return {
  //     tabPairHeaderSourceViewState: this.tabPairHeaderSourceView.serialize()
  //   };
  // },

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
  
  checkEverything() {
    var panes = atom.workspace.getPanes();
    for (let pane_index in panes) {
      var pane = panes[pane_index];
      var pane_paths = this.getPathsForPane(pane);
      var pane_paths_pairs = this.groupPair(pane_paths);
      console.log(pane_paths);
      console.log(pane_paths_pairs);
      // go through item_paths and split it into group numbers depending on matches. ex [1 1 0 2 2 2 0 3 0 4], here groups 1 and 2 would have tabs shortened
      
    }
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
    var pItems = atom.workspace.getPaneItems();
    var index;
    for ( let i = 0; i < pItems.length; i++ ) {
      if (pItems[i] == item) {
        index = i;
        break;
      }
    }
    if (typeof index === "undefined")
      return;

    let tab = atom.views.getView(atom.workspace).querySelectorAll('li.tab .title')[index];
    if (typeof tab === "undefined") {
      return;
    }

    let filename = tab.getAttribute('data-name');

    if(tab && filename)
    {
      if (compress) {
        filename = path.extname(filename)
        tab.parentElement.classList.add('tab-pair-header-source')
      }
      else {
        tab.parentElement.classList.remove('tab-pair-header-source')
      }
      tab.innerText = filename;
    }
  },

  findPaneItem(paneitem) {
    var index;
    var items;
    var pane;
    var panes = atom.workspace.getPanes();
    for(let i=0; i < panes.length; i++) {
      pane = panes[i]
      items = pane.getItems()
      for (let j=0; j < items.length; j++) {
        if (items[j] == paneitem) {
          index = j;
          break;
        }
      }
      if(index) {
        break;
      }
    }

    return {pane, index};
  },

  checkNeighbors(pane, index, parsedPath, compress=false) {
    if(typeof index === "undefined" || index < 0) {
      return; // bail if we couldn't find the item
    }

    var items = pane.getItems();
    if (items.length > index+1) {
      let editor = items[index+1];
      if (atom.workspace.isTextEditor(editor)) {
        let filepath = editor.getPath();
        if (typeof filepath !== "undefined") {
          let editor_parsedPath = path.parse(filepath);
          if (this.isSourceHeaderPair(parsedPath, editor_parsedPath)) {
            this.setTabTitle(editor, compress);
          }
        }
      }
    }
    if (index-1 >= 0) {
      let editor = items[index-1];
      if (atom.workspace.isTextEditor(editor)) {
        let filepath = editor.getPath();
        if (typeof filepath !== "undefined") {
          let editor_parsedPath = path.parse(editor.getPath());
          if (this.isSourceHeaderPair(parsedPath, editor_parsedPath)) {
            this.setTabTitle(editor, compress);
          }
        }
      }
    }
  },
  
  addedPaneItem(pane, ev) {
    if (atom.inDevMode()) {
      console.log("addedPaneItem");
    }
    this.checkEverything();
    return;
    //only worry about text editors
    if (!atom.workspace.isTextEditor(ev.item)) {
      return;
      //TODO: need to check to see, if we opened a new item in the middle of
      // and existing matched pair, if so then we should move the item, or
      // expand the tabs of the newly seperated pair
    }

    var filepath = ev.item.getPath();
    if (typeof filepath === "undefined") {
      return;
    }

    var parsedPath = path.parse(filepath);
    if( !(this.isSource(parsedPath.ext) || this.isHeader(parsedPath.ext)) ){
      return;
    }
    
    if (atom.inDevMode()) {
      console.log("  added at index: " + ev.index);
    }

    var newIndex = -1;
    var panes = pane.getItems();
    for (let index=0; index < panes.length; index++)
    {
      //Only check text editors
      if (!atom.workspace.isTextEditor(panes[index])) {
        continue;
      }
      filepath = panes[index].getPath();
      if (typeof filepath === "undefined") {
        continue;
      }

      let editor_parsedPath = path.parse(filepath);
      if (this.isSourceHeaderPair(parsedPath, editor_parsedPath)) {
        if (this.isSource(parsedPath.ext))
        {
          newIndex = index; //put source on left side
        }
        else { //isHeader
          newIndex = index+1; //put header on right side
        }
        if (newIndex > ev.index) {
          newIndex -= 1; // account for the affect of removing this tab
        }
        break;
      }
    }
    if (newIndex >= 0 && newIndex != ev.index) {
      // console.log("Item was moved to new location: " + newIndex);
      pane.moveItem(ev.item, newIndex);
    }
    else if (newIndex == ev.index) {
      //TODO: opened the file in the correct location, need to adjust tab size
      // since moveitem event will not be triggered.
    }
    else {
      //TODO: need to check to see, if we opened a new item in the middle of
      // and existing matched pair, if so then we should move the item, or
      // expand the tabs of the newly seperated pair
      // maybe handled by changed active item? however that event is called before add event
    }
  },

  //TODO: may need to add removedPaneItem subscription,
  // if removed item causes pair to be next to each other
  // than that pair should be compressed somehow
  removedPaneItem(pane, ev) {
    if (atom.inDevMode()) {
      console.log("removedPaneItem");
    }
    
    this.checkEverything();
    return;

    //only worry about text editors
    if (!atom.workspace.isTextEditor(ev.item)) {
      return;
    }

    var filepath = ev.item.getPath();
    if (typeof filepath === "undefined") {
      return;
    }
    var parsedPath = path.parse(filepath);
    if( !(this.isSource(parsedPath.ext) || this.isHeader(parsedPath.ext)) ){
      return;
    }

    this.checkNeighbors(pane, ev.index, parsedPath, false)
  },

  //TODO: handle tab expand/compress from this function, (addedPaneItem() is replying on this function to do the job)
  movedInSamePane(pane, ev) {
    if (atom.inDevMode()) {
      console.log("movedInSamePane");
    }
    //can you tell if the user requested it moved or the application moved it?

    // TODO: moved to same spot, should something be done?
    // if(ev.nexIndex == ev.oldIndex) {
    //   return;
    // }

    //only worry about text editors
    if (!atom.workspace.isTextEditor(ev.item)) {
      return;
      //TODO: need to check to see, if we moved an item in the middle of
      // and existing matched pair, than expand the tabs of the newly
      // seperated pair
    }

    var filepath = ev.item.getPath();
    if (typeof filepath === "undefined") {
      return;
    }
    var parsedPath = path.parse(filepath);
    if( !(this.isSource(parsedPath.ext) || this.isHeader(parsedPath.ext)) ){
      return;
    }

    this.setTabTitle(ev.item, false); //TODO: does this need to be done here?

    // if we moved an item in the middle of
    // and existing matched pair, than expand the tabs of the newly
    // seperated pair
    //TODO: should we check to see if one of the tabs is compressed?
    // or does that just add unnecessary computing?
    var items = pane.getItems();
    if (items.length > ev.newIndex+1 && ev.newIndex > 0) {
      this.setTabTitle(items[ev.newIndex-1], false);
      this.setTabTitle(items[ev.newIndex+1], false);
    }

    // if we moved the active tab away from its pair, then we need to expand its pair
    this.checkNeighbors(pane, ev.oldIndex, parsedPath, false);

    // compress new pair
    this.checkNeighbors(pane, ev.newIndex, parsedPath, true);
  },

  changedActiveItem(paneitem) {
    if (atom.inDevMode()) {
      console.log("changedActiveItem");
    }
    
    this.checkEverything();
    return;

    if(!atom.workspace.isTextEditor(paneitem)) {
      return;
    }

    this.setTabTitle(paneitem, false);

    var result = this.findPaneItem(paneitem);
    var filepath = paneitem.getPath();
    if (typeof filepath === "undefined") {
      return;
    }
    var parsedPath = path.parse(filepath);
    this.checkNeighbors(result.pane, result.index, parsedPath, true);

    //TODO: handle tab expand/compress from this function
    // in the case were the compressed tab is picked, it should be expanded
    // and the matching pair compressed, in this use case, this is the only
    // event to trigger
  },

  changedPath(editor) {
    if (atom.inDevMode()) {
      console.log("changedPath");
    }
    
    this.checkEverything();
    return;

    var filepath = editor.getPath();
    if (typeof filepath === "undefined") {
      return;
    }
    var parsedPath = path.parse(filepath);
    
    this.setTabTitle(editor, false);

    var result = this.findPaneItem(editor);
    this.checkNeighbors(result.pane, result.index, parsedPath, true);
  },
};
